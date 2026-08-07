"use strict"

/* Self-play trajectory generator / arena for the hierarchical recurrent policy.
 *
 * Data mode:
 *   node rollout.js --games 10 --model m.json --league dir --out traj.jsonl --seed 1
 *     opponent per game: 70% current model, 20% random league checkpoint, 10% heuristic
 * Arena mode:
 *   node rollout.js --arena --games 30 --model A.json --opp B.json|heuristic [--search]
 *
 * Episodes: Historical scenario truncated after MAX_TURN turns, VP adjudication.
 * Only decision points with >1 candidate are recorded / advance the GRU.
 */

const fs = require("fs")
const path = require("path")
const ROOT = path.join(__dirname, "..")
const RULES = require(path.join(ROOT, "rules.js"))
const data = require(path.join(ROOT, "data.js"))
const F = require(path.join(ROOT, "features.js"))
const { policy_step, softmax_sample, new_hidden } = require("./jsnn.js")
const { list_actions, heuristic_eval, AP, CP } = require(path.join(ROOT, "rl", "players.js"))

const MAX_TURN = 3        // truncate after this turn completes (1914 campaign)
const MAX_STEPS = 4000
const MAX_CANDS = 16
const N_STATE = F.N_FEATURES   // 537
const OBS_DIM = N_STATE + 65 + 1

/* ---------- observation / candidate features ---------- */

function hand_onehot(s, role) {
	const v = new Array(65).fill(0)
	const hand = role === CP ? s.cp.hand : s.ap.hand
	for (const c of hand)
		v[(c > 65 ? c - 65 : c) - 1] = 1
	return v
}

function build_obs(s, role) {
	const obs = F.extract(s)
	obs.push(...hand_onehot(s, role))
	obs.push(role === CP ? 1 : 0)
	return obs
}

function build_priv(s, role) {
	return hand_onehot(s, role === CP ? AP : CP)
}

const VG = ["play_event","play_ops","play_sr","play_rps","card","space","piece","attack","confirm","next","pass","other"]
function verb_group(verb) {
	if (VG.includes(verb)) return verb
	if (verb === "attack" || verb === "flank") return "attack"
	if (/^confirm|^accept/.test(verb)) return "confirm"
	if (verb === "next" || verb === "done") return "next"
	if (/^pass$|^skip$|^stop$|^no_attack$|^end_|^reject$/.test(verb)) return "pass"
	return "other"
}

function get_control_bit(s, sp) {
	return (s.control[sp >> 5] >>> (sp & 31)) & 1
}

function cand_features(s, verb, noun) {
	const f = new Array(20).fill(0)
	const g = VG.indexOf(verb_group(verb))
	f[g >= 0 ? g : 11] = 1
	if ((verb === "card" || verb.startsWith("play_")) && typeof noun === "number" && data.cards[noun]) {
		const c = data.cards[noun]
		f[12] = c.ops / 5; f[13] = c.sr / 5; f[14] = (c.ws || 0) / 2
		f[15] = c.remove ? 1 : 0; f[16] = c.cc ? 1 : 0
	} else if ((verb === "space" || verb === "attack") && typeof noun === "number" && data.spaces[noun]) {
		f[17] = (data.spaces[noun].vp || 0) / 3
		f[18] = get_control_bit(s, noun)
	} else if (typeof noun === "number" && data.pieces[noun] && (verb === "piece" || verb === "eliminate" || verb === "retreat" || verb === "use")) {
		f[19] = data.pieces[noun].cf / 5
	}
	return f
}

/* ---------- policies ---------- */

function make_nn_agent(model, temp) {
	return {
		kind: "nn", model, temp: temp || 1.0, h: new_hidden(),
		reset() { this.h = new_hidden() },
		choose(s, role, cands, record) {
			let pool = cands
			if (pool.length > MAX_CANDS) {
				pool = cands.slice()
				for (let i = pool.length - 1; i > 0; --i) {
					const j = (Math.random() * (i + 1)) | 0
					;[pool[i], pool[j]] = [pool[j], pool[i]]
				}
				pool.length = MAX_CANDS
			}
			const obs = build_obs(s, role)
			const cf = pool.map(c => cand_features(s, c[0], c[1]))
			const st = policy_step(this.model, obs, this.h, cf)
			this.h = st.h
			const pick = softmax_sample(st.logits, this.temp)
			if (record)
				record({ obs, priv: build_priv(s, role), cands: cf, k: pick.idx, lp: pick.logp })
			return pool[pick.idx]
		},
	}
}

function make_heuristic_agent() {
	return {
		kind: "heuristic",
		reset() {},
		choose(s, role, cands) {
			const sign = role === CP ? 1 : -1
			let pool = cands
			if (pool.length > MAX_CANDS) {
				pool = cands.slice()
				for (let i = pool.length - 1; i > 0; --i) {
					const j = (Math.random() * (i + 1)) | 0
					;[pool[i], pool[j]] = [pool[j], pool[i]]
				}
				pool.length = MAX_CANDS
			}
			let best = pool[0], bs = -Infinity
			for (const c of pool) {
				let t = JSON.parse(JSON.stringify(s))
				t.seed = (Math.random() * 0x7fffffff) | 0
				try {
					t = RULES.action(t, role, c[0], c[1])
					const sc = sign * heuristic_eval(t) + Math.random() * 1e-3
					if (sc > bs) { bs = sc; best = c }
				} catch (e) {}
			}
			return best
		},
	}
}

/* belief-sampled lookahead wrapper (arm D): at card decisions, re-rank the
 * policy's top-3 by short policy rollouts over determinized opponent hands */
function make_search_agent(model, n_det, depth) {
	const base = make_nn_agent(model, 0.5)
	return {
		kind: "nn+search", h: base.h,
		reset() { base.reset() },
		choose(s, role, cands, record) {
			const card_decision = cands.length > 2 && cands.some(c => c[0].startsWith("play_") || c[0] === "card")
			if (!card_decision)
				return base.choose(s, role, cands, record)
			// score all with policy first
			let pool = cands.slice(0, MAX_CANDS)
			const obs = build_obs(s, role)
			const cf = pool.map(c => cand_features(s, c[0], c[1]))
			const st = policy_step(base.model, obs, base.h, cf)
			base.h = st.h
			const order = st.logits.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0])
			const top = order.slice(0, 3).map(x => x[1])
			let bestIdx = top[0], bestQ = -Infinity
			const sign = role === CP ? 1 : -1
			for (const idx of top) {
				let q = 0
				for (let d = 0; d < n_det; d++) {
					let t = JSON.parse(JSON.stringify(s))
					t.seed = (Math.random() * 0x7fffffff) | 0
					shuffle_unknown(t, role)
					try {
						t = RULES.action(t, role, pool[idx][0], pool[idx][1])
						t = greedy_rollout(t, depth)
						q += sign * heuristic_eval(t)
					} catch (e) { q -= 1e5 }
				}
				q /= n_det
				if (q > bestQ) { bestQ = q; bestIdx = idx }
			}
			return pool[bestIdx]
		},
	}

	function shuffle_unknown(t, role) {
		// determinize: shuffle opponent hand together with their deck
		const opp = role === CP ? t.ap : t.cp
		const pool = opp.hand.concat(opp.deck)
		for (let i = pool.length - 1; i > 0; --i) {
			const j = (Math.random() * (i + 1)) | 0
			;[pool[i], pool[j]] = [pool[j], pool[i]]
		}
		const nh = opp.hand.length
		opp.hand = pool.slice(0, nh)
		opp.deck = pool.slice(nh)
	}

	function greedy_rollout(t, depth) {
		for (let d = 0; d < depth && t.state !== "game_over"; d++) {
			let r = t.active
			if (r === "Both" || r === "All") r = CP
			let v = RULES.view(t, r)
			let c = list_actions(v)
			if (!c.length) {
				r = r === CP ? AP : CP
				v = RULES.view(t, r)
				c = list_actions(v)
				if (!c.length) break
			}
			const pick = c[(Math.random() * c.length) | 0]
			try { t = RULES.action(t, r, pick[0], pick[1]) } catch (e) { break }
		}
		return t
	}
}

/* ---------- episode ---------- */

function final_reward(s) {
	// CP perspective in [-1.2, 1.2]: win/loss + small VP margin
	if (s.state === "game_over") {
		if (s.result === CP) return 1
		if (s.result === AP) return -1
		return 0
	}
	const margin = 0.2 * Math.tanh((s.vp - 10) / 4)
	if (s.vp > 10) return 0.6 + margin      // adjudicated: softer than real win
	if (s.vp < 10) return -0.6 + margin
	return margin
}

function play_episode(agents, seed, sink) {
	let s = RULES.setup(seed, "Historical", {})
	agents[CP].reset()
	agents[AP].reset()
	let steps = 0
	const records = { [CP]: [], [AP]: [] }
	while (s.state !== "game_over" && s.turn <= MAX_TURN && steps < MAX_STEPS) {
		let role = s.active
		if (role === "Both" || role === "All") {
			role = CP
			let v = RULES.view(s, role)
			if (!v.actions || list_actions(v).length === 0) role = AP
		}
		const v = RULES.view(s, role)
		const cands = list_actions(v)
		if (cands.length === 0) break
		let choice
		if (cands.length === 1) {
			choice = cands[0]
		} else {
			choice = agents[role].choose(s, role, cands, sink ? (rec) => { rec.role = role; records[role].push(rec) } : null)
		}
		try {
			s = RULES.action(s, role, choice[0], choice[1])
		} catch (e) {
			try { s = RULES.action(s, role, cands[0][0], cands[0][1]) } catch (e2) { break }
		}
		steps++
	}
	const R = final_reward(s)
	if (sink) {
		for (const role of [CP, AP]) {
			const rew = role === CP ? R : -R
			for (const rec of records[role])
				sink(rec)
			sink({ end: 1, role, z: rew, vp: s.vp, turn: s.turn, n: records[role].length })
		}
	}
	return { R, vp: s.vp, steps, over: s.state === "game_over" }
}

/* ---------- main ---------- */

function parse() {
	const a = process.argv.slice(2)
	const o = { games: 10, model: null, opp: null, league: null, out: null, seed: 1,
		arena: false, temp: 1.0, search: false, opp_search: false }
	for (let i = 0; i < a.length; i++) {
		const k = a[i]
		if (k === "--games") o.games = +a[++i]
		else if (k === "--model") o.model = a[++i]
		else if (k === "--opp") o.opp = a[++i]
		else if (k === "--league") o.league = a[++i]
		else if (k === "--out") o.out = a[++i]
		else if (k === "--seed") o.seed = +a[++i]
		else if (k === "--temp") o.temp = +a[++i]
		else if (k === "--arena") o.arena = true
		else if (k === "--search") o.search = true
	}
	return o
}

function load_model(p) {
	return JSON.parse(fs.readFileSync(p, "utf8"))
}

function make_agent_spec(spec, opt) {
	if (spec === "heuristic") return make_heuristic_agent()
	const m = load_model(spec)
	if (opt && opt.search) return make_search_agent(m, 6, 12)
	return make_nn_agent(m, opt ? opt.temp : 1.0)
}

function main() {
	const o = parse()
	const cur_model = o.model ? load_model(o.model) : null

	if (o.arena) {
		const A = make_agent_spec(o.model, { temp: 0.3, search: o.search })
		const B = make_agent_spec(o.opp, { temp: 0.3 })
		let a_w = 0, b_w = 0, dr = 0, vps = 0
		for (let g = 0; g < o.games; g++) {
			const a_is_cp = g % 2 === 0
			const agents = { [CP]: a_is_cp ? A : B, [AP]: a_is_cp ? B : A }
			let r
			try { r = play_episode(agents, o.seed + g, null) } catch (e) { console.error("crash", e.message); continue }
			const a_r = a_is_cp ? r.R : -r.R
			if (a_r > 0.05) a_w++
			else if (a_r < -0.05) b_w++
			else dr++
			vps += a_is_cp ? r.vp - 10 : 10 - r.vp
		}
		console.log(JSON.stringify({ a: o.model, b: o.opp, games: o.games,
			a_wins: a_w, b_wins: b_w, draws: dr, a_vp_margin: +(vps / o.games).toFixed(2) }))
		return
	}

	// data generation
	const out = fs.createWriteStream ? null : null
	const out_path = path.resolve(__dirname, o.out)
	fs.mkdirSync(path.dirname(out_path), { recursive: true })
	const fd = fs.openSync(out_path, "a")
	const league = []
	if (o.league && fs.existsSync(o.league))
		for (const f of fs.readdirSync(o.league))
			if (f.endsWith(".json")) league.push(path.join(o.league, f))

	let sum_R = 0, ep = 0
	for (let g = 0; g < o.games; g++) {
		// current model always plays; opponent sampled
		const u = Math.random()
		let opp
		if (u < 0.10 || (u < 0.30 && league.length === 0))
			opp = make_heuristic_agent()
		else if (u < 0.30)
			opp = make_nn_agent(load_model(league[(Math.random() * league.length) | 0]), o.temp)
		else
			opp = make_nn_agent(cur_model, o.temp)
		const me = make_nn_agent(cur_model, o.temp)
		const me_is_cp = g % 2 === 0
		const agents = { [CP]: me_is_cp ? me : opp, [AP]: me_is_cp ? opp : me }
		const lines = []
		// record only OUR side's decisions (both sides when mirror self-play? record both if opp is current model)
		const record_both = opp.kind === "nn" && opp.model === cur_model
		try {
			play_episode(agents, o.seed + g, (rec) => {
				if (rec.end) {
					lines.push(JSON.stringify({ end: 1, ep: ep, role: rec.role, z: rec.z, vp: rec.vp, turn: rec.turn, n: rec.n }))
					return
				}
				const mine = (rec.role === CP) === me_is_cp
				if (mine || record_both)
					lines.push(JSON.stringify({ ep: ep, role: rec.role,
						obs: rec.obs.map(x => +(+x).toFixed(3)),
						priv: rec.priv,
						cands: rec.cands.map(c => c.map(x => +(+x).toFixed(3))),
						k: rec.k, lp: +rec.lp.toFixed(5) }))
			})
		} catch (e) {
			console.error("episode crash:", e.message)
			continue
		}
		fs.writeSync(fd, lines.join("\n") + "\n")
		ep++
	}
	fs.closeSync(fd)
	console.log(JSON.stringify({ done: ep }))
}

main()
