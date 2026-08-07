"use strict"

/* Self-play data generation / match runner.
 *
 * Usage:
 *   node selfplay.js --games 40 --cp heuristic --ap heuristic --eps 0.15 \
 *       --sample 0.08 --out data/gen0.jsonl --seed 1000
 *   node selfplay.js --games 50 --cp nn:models/v1.json --ap heuristic --match
 *
 * Output (data mode): JSONL lines {f:[...], z: 0|0.5|1}  (z = CP result)
 * Output (match mode): summary line with win counts.
 */

const fs = require("fs")
const path = require("path")
const ROOT = path.join(__dirname, "..")
const RULES = require(path.join(ROOT, "rules.js"))
const { extract } = require(path.join(ROOT, "features.js"))
const { make_player, list_actions, AP, CP } = require("./players.js")

function parse_args() {
	const a = process.argv.slice(2)
	const opt = { games: 10, cp: "heuristic", ap: "heuristic", eps: 0, sample: 0.08,
		out: null, seed: 1, match: false, scenario: "Historical", max_steps: 15000, quiet: false }
	for (let i = 0; i < a.length; ++i) {
		const k = a[i]
		if (k === "--games") opt.games = +a[++i]
		else if (k === "--cp") opt.cp = a[++i]
		else if (k === "--ap") opt.ap = a[++i]
		else if (k === "--eps") opt.eps = +a[++i]
		else if (k === "--sample") opt.sample = +a[++i]
		else if (k === "--out") opt.out = a[++i]
		else if (k === "--seed") opt.seed = +a[++i]
		else if (k === "--match") opt.match = true
		else if (k === "--quiet") opt.quiet = true
		else if (k === "--max-steps") opt.max_steps = +a[++i]
	}
	return opt
}

function load_player(spec, eps) {
	if (spec.startsWith("nn:")) {
		const model = JSON.parse(fs.readFileSync(path.resolve(__dirname, spec.slice(3)), "utf8"))
		return make_player("nn", { model, eps })
	}
	return make_player(spec, { eps })
}

function game_result(s) {
	// engine result if finished; otherwise adjudicate by VP track
	if (s.state === "game_over") {
		if (s.result === CP) return 1
		if (s.result === AP) return 0
		return 0.5
	}
	if (s.vp > 10) return 1
	if (s.vp < 10) return 0
	return 0.5
}

function play_game(opt, players, seed, out_stream) {
	let s = RULES.setup(seed, opt.scenario, {})
	let steps = 0
	const positions = []
	while (s.state !== "game_over" && steps < opt.max_steps) {
		let role = s.active
		if (role === "Both" || role === "All") {
			// pick whichever role actually has actions (CP first arbitrary but stable)
			role = CP
			let v = RULES.view(s, role)
			if (!v.actions || list_actions(v).length === 0)
				role = AP
		}
		const v = RULES.view(s, role)
		const cands = list_actions(v)
		if (cands.length === 0)
			break
		const choice = players[role](RULES, s, role, cands)
		try {
			s = RULES.action(s, role, choice[0], choice[1])
		} catch (err) {
			// illegal action (shouldn't happen) - fall back to first candidate
			s = RULES.action(s, role, cands[0][0], cands[0][1])
		}
		steps++
		if (out_stream && Math.random() < opt.sample)
			positions.push(extract(s))
	}
	const z = game_result(s)
	if (out_stream)
		for (const f of positions)
			out_stream.write(JSON.stringify({ f, z }) + "\n")
	return { z, steps, turn: s.turn, vp: s.vp, finished: s.state === "game_over" }
}

function main() {
	const opt = parse_args()
	const players = {
		[CP]: load_player(opt.cp, opt.eps),
		[AP]: load_player(opt.ap, opt.eps),
	}
	let out_stream = null
	if (opt.out) {
		const out_path = path.resolve(__dirname, opt.out)
		fs.mkdirSync(path.dirname(out_path), { recursive: true })
		// synchronous appender: the game loop never yields to the event loop,
		// so async stream writes would sit in memory until process exit
		out_stream = { write: (line) => fs.appendFileSync(out_path, line), end: () => {} }
	}
	let cp_w = 0, ap_w = 0, draw = 0, unfinished = 0, total_steps = 0
	const t0 = Date.now()
	for (let g = 0; g < opt.games; ++g) {
		const r = play_game(opt, players, opt.seed + g, out_stream)
		total_steps += r.steps
		if (!r.finished) unfinished++
		if (r.z === 1) cp_w++
		else if (r.z === 0) ap_w++
		else draw++
		if (!opt.quiet)
			console.error(`game ${g + 1}/${opt.games} z=${r.z} steps=${r.steps} turn=${r.turn} vp=${r.vp}${r.finished ? "" : " (adjudicated)"}`)
	}
	const dt = (Date.now() - t0) / 1000
	console.log(JSON.stringify({
		cp: opt.cp, ap: opt.ap, games: opt.games, cp_wins: cp_w, ap_wins: ap_w, draws: draw,
		unfinished, secs: +dt.toFixed(1), steps_per_game: Math.round(total_steps / opt.games),
	}))
	if (out_stream)
		out_stream.end()
}

main()
