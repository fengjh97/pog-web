"use strict"

/* Local single-player backend for the RTT client.
 *
 * Replaces window.WebSocket with an in-browser implementation that runs
 * rules.js directly and speaks the same JSON message protocol as the RTT
 * server. Supports play vs a built-in AI or hotseat (both sides).
 */

;(function () {

var SAVE_KEY = "pog_local_save"
var NOTE_KEY = "pog_local_note"

var AP = "Allied Powers"
var CP = "Central Powers"

var RULES = null
var DATA = null

var game = null        // current rules state
var snaps = []         // in-memory snapshot states for the replay panel
var save_meta = null   // {ai_role, ai_kind, scenario, options, hotseat, seed}
var ai_memory = null   // persisted B-full GRU/recovery state

/* ---------- CommonJS-in-browser loader (same trick as RTT replay.js) ---------- */

var module_cache = {}

function normalize_path(p) {
	return p.replace(/^\.\//, "")
}

async function load_module(path) {
	path = normalize_path(path)
	if (module_cache[path])
		return module_cache[path]
	var res = await fetch(path)
	if (!res.ok)
		throw new Error("fetch failed: " + path)
	var source = await res.text()
	var mod = { exports: {} }
	Function("module", "exports", "require", source)(mod, mod.exports, function (p) {
		var m = module_cache[normalize_path(p)]
		if (!m)
			throw new Error("module not preloaded: " + p)
		return m
	})
	module_cache[path] = mod.exports
	return mod.exports
}

async function load_rules() {
	DATA = await load_module("data.js")
	await load_module("lz4.js")
	RULES = await load_module("rules.js")
}

/* ---------- persistence ---------- */

function save_game() {
	try {
		window.localStorage.setItem(SAVE_KEY, JSON.stringify({
			version: 2,
			meta: save_meta,
			state: game,
			ai_memory: ai_memory,
		}))
	} catch (err) {
		console.error("SAVE FAILED", err)
	}
}

function load_save() {
	try {
		var text = window.localStorage.getItem(SAVE_KEY)
		if (!text)
			return null
		var obj = JSON.parse(text)
		if (obj && (obj.version === 1 || obj.version === 2) && obj.state)
			return obj
	} catch (err) {
		console.error("LOAD FAILED", err)
	}
	return null
}

function clone_state(s) {
	return JSON.parse(JSON.stringify(s))
}

/* ---------- the fake websocket ---------- */

function LocalSocket(url) {
	var self = this
	self.readyState = 0
	self.onopen = null
	self.onclose = null
	self.onmessage = null

	var q = new URLSearchParams(url.split("?")[1] || "")
	self.role = q.get("role") || AP

	setTimeout(function () { self._init() }, 0)
}

LocalSocket.prototype._push = function (cmd, arg, extra) {
	var self = this
	var data = JSON.stringify(extra !== undefined ? [ cmd, arg, extra ] : [ cmd, arg ])
	if (self.onmessage)
		self.onmessage({ data: data })
}

LocalSocket.prototype._push_state = function () {
	var self = this
	var v = RULES.view(game, self.role)
	v.log_start = 0
	v.log = game.log
	self._push("state", v, 1)
	self._push("presence", present_roles())
	if (game.state === "game_over" || game.state === "finished")
		self._push("finished", null)
}

function present_roles() {
	// both roles always "present" in a local game
	return [ AP, CP ]
}

LocalSocket.prototype._init = async function () {
	var self = this
	try {
		await load_rules()
	} catch (err) {
		console.error(err)
		return
	}

	var page = new URLSearchParams(window.location.search)
	var saved = load_save()

	if (page.get("new") === "1" || !saved) {
		var scenario = page.get("scenario") || "Historical"
		if (!RULES.scenarios.includes(scenario))
			scenario = RULES.scenarios[0]
		var seed = parseInt(page.get("seed")) || ((Math.random() * 0x7fffffff) | 0)
		var hotseat = page.get("hotseat") === "1"
		var requested_ai = page.get("ai")
		if (requested_ai !== "bfull" && requested_ai !== "nn" && requested_ai !== "heuristic")
			requested_ai = "bfull"
		save_meta = {
			scenario: scenario,
			options: {},
			hotseat: hotseat,
			ai_role: hotseat ? null : (self.role === AP ? CP : AP),
			ai_kind: requested_ai,
			seed: seed,
		}
		ai_memory = null
		game = RULES.setup(seed, scenario, {})
		snaps = []
		save_game()
		// strip new=1 so a refresh doesn't restart the game
		page.delete("new")
		page.delete("seed")
		window.history.replaceState(null, "", window.location.pathname + "?" + page.toString())
	} else {
		save_meta = saved.meta
		game = saved.state
		ai_memory = saved.ai_memory || null
		snaps = []
	}

	self.readyState = 1
	active_socket = self
	if (self.onopen)
		self.onopen({})

	var ai_name = save_meta.ai_kind === "bfull" ? "B-full 强化学习 AI" : "AI 将军"
	var players = [
		{ role: AP, name: save_meta.hotseat ? "热座" : (save_meta.ai_role === AP ? ai_name : "你") },
		{ role: CP, name: save_meta.hotseat ? "热座" : (save_meta.ai_role === CP ? ai_name : "你") },
	]
	self._push("players", [ self.role, players, save_meta.scenario, save_meta.options, null ])
	self._push("note", window.localStorage.getItem(NOTE_KEY) || "")
	self._push_state()
	self._push("snapsize", snaps.length)

	self._maybe_hotseat_switch()
	schedule_ai(self)
}

LocalSocket.prototype.send = function (text) {
	var self = this
	var msg = JSON.parse(text)
	var cmd = msg[0]
	var arg = msg[1]
	try {
		switch (cmd) {
		case "action":
			self._on_action(arg[0], arg[1])
			break
		case "query":
			self._push("reply", [ arg[0], RULES.query(game, self.role, arg[0], arg[1]) ])
			break
		case "querysnap":
			{
				let s = snaps[arg[0] - 1]
				if (s)
					self._push("reply", [ arg[1], RULES.query(s, self.role, arg[1], arg[2]) ])
			}
			break
		case "getsnap":
			{
				let s = snaps[arg - 1]
				if (s) {
					let v = RULES.view(s, self.role)
					v.actions = null
					v.log = s.log.length
					self._push("snap", [ arg, s.active, v ])
				} else {
					self._push("nosnap", arg)
				}
			}
			break
		case "resign":
			game = RULES.resign(game, self.role)
			after_change(self)
			break
		case "putnote":
			window.localStorage.setItem(NOTE_KEY, arg)
			break
		case "getchat":
			break
		}
	} catch (err) {
		console.error(err)
		self._push("error", String(err))
	}
}

LocalSocket.prototype.close = function () {
	this.readyState = 3
}

LocalSocket.prototype._on_action = function (verb, noun) {
	var self = this
	var prev_active = game.active
	if (verb === "undo")
		ai_memory = null
	game = RULES.action(game, self.role, verb, noun)
	maybe_snapshot(prev_active)
	after_change(self)
}

function maybe_snapshot(prev_active) {
	if (game.active !== prev_active) {
		if (typeof RULES.dont_snap === "function" && RULES.dont_snap(game))
			return false
		snaps.push(clone_state(game))
		return true
	}
	return false
}

function after_change(sock) {
	save_game()
	sock._push_state()
	sock._push("snapsize", snaps.length)
	sock._maybe_hotseat_switch()
	schedule_ai(sock)
}

/* ---------- hotseat: hand the seat to whichever side must act ---------- */

LocalSocket.prototype._maybe_hotseat_switch = function () {
	var self = this
	if (!save_meta || !save_meta.hotseat)
		return
	if (game.state === "game_over")
		return
	var active = game.active
	if (active === self.role || active === "Both" || active === "All")
		return
	if (active === AP || active === CP) {
		self.role = active
		var players = [
			{ role: AP, name: "热座" },
			{ role: CP, name: "热座" },
		]
		self._push("pie", [ self.role, players ])
		self._push_state()
	}
}

/* ---------- AI ---------- */

var ai_timer = null
var AI_PACE = 1.45 // Give players time to follow the computer's card and map choices.
var ai_next_delay = 700
var nn_model = null      // legacy value network, loaded on demand
var nn_load_failed = false
var bfull_model = null   // recurrent RL2 policy, loaded on demand
var bfull_load_failed = false

function maybe_load_model() {
	if (!save_meta)
		return
	if (save_meta.ai_kind === "bfull" && !bfull_model && !bfull_load_failed) {
		fetch("rl2/models/bf_cur.json").then(function (r) {
			if (!r.ok) throw new Error("no B-full model")
			return r.json()
		}).then(function (m) {
			bfull_model = m
			console.log("B-full RL2 model loaded:", m.meta)
		}).catch(function (err) {
			console.error("B-full model unavailable, falling back to heuristic:", err)
			bfull_load_failed = true
		})
	} else if (save_meta.ai_kind === "nn" && !nn_model && !nn_load_failed) {
		fetch("model.json").then(function (r) {
			if (!r.ok) throw new Error("no model")
			return r.json()
		}).then(function (m) {
			nn_model = m
			console.log("Legacy value model loaded:", m.meta)
		}).catch(function (err) {
			console.error("Legacy value model unavailable, falling back to heuristic:", err)
			nn_load_failed = true
		})
	}
}

function model_is_loading() {
	if (save_meta.ai_kind === "bfull")
		return !bfull_model && !bfull_load_failed
	if (save_meta.ai_kind === "nn")
		return !nn_model && !nn_load_failed
	return false
}

/* value of a state for the AI: NN if available, else hand-crafted heuristic */
function eval_state_dispatch(s) {
	if (nn_model && save_meta.ai_kind === "nn" &&
			typeof window.nn_forward === "function" && window.pog_features) {
		if (s.state === "game_over") {
			if (s.result === CP) return 1e6
			if (s.result === AP) return -1e6
			return 0
		}
		// blend: value net decides strategy, heuristic breaks near-ties (tactics)
		return 1000 * window.nn_forward(nn_model, window.pog_features.extract(s)) +
			10 * Math.tanh(eval_state(s) / 300)
	}
	return eval_state(s)
}

function role_is_active(role) {
	return game.active === role || game.active === "Both" || game.active === "All"
}

function schedule_ai(sock) {
	if (!save_meta || save_meta.hotseat || !save_meta.ai_role)
		return
	maybe_load_model()
	if (game.state === "game_over")
		return
	if (!role_is_active(save_meta.ai_role))
		return
	if (ai_timer)
		return
	ai_timer = setTimeout(function () {
		ai_timer = null
		ai_step(sock)
	}, ai_next_delay)
	ai_next_delay = 460
}

function ai_step(sock) {
	var role = save_meta.ai_role
	if (game.state === "game_over" || !role_is_active(role))
		return

	// wait for the selected model to finish loading
	if (model_is_loading()) {
		ai_timer = setTimeout(function () { ai_timer = null; ai_step(sock) }, 200)
		return
	}

	var prev_active = game.active
	var v = RULES.view(game, role)
	var candidates = list_actions(v)
	if (candidates.length === 0) {
		console.error("AI stuck: no actions available", game.state)
		return
	}

	var previous_memory = ai_memory
	var choice = (candidates.length === 1 && save_meta.ai_kind !== "bfull") ? candidates[0] : ai_choose(candidates, role, v)
	ai_next_delay = action_delay(choice, v)
	try {
		game = RULES.action(game, role, choice[0], choice[1])
	} catch (error) {
		ai_memory = previous_memory
		throw error
	}
	maybe_snapshot(prev_active)
	after_change(sock)
}

function list_actions(v) {
	var out = []
	if (!v.actions)
		return out
	for (var verb in v.actions) {
		// meta/bookkeeping actions the AI must never take
		if (verb === "undo" || verb === "resign" ||
			verb === "propose_rollback" || verb === "flag_supply_warnings")
			continue
		var val = v.actions[verb]
		if (val === 0 || val === false || val === null || val === undefined)
			continue
		if (Array.isArray(val)) {
			for (var i = 0; i < val.length; ++i)
				out.push([ verb, val[i] ])
		} else if (val === 1 || val === true) {
			out.push([ verb, undefined ])
		} else {
			out.push([ verb, val ])
		}
	}
	return out
}

function ai_choose(candidates, role, v) {
	// special case: always accept rollback proposals in a solo game
	if (v.prompt && /rollback/i.test(v.prompt)) {
		for (var i = 0; i < candidates.length; ++i)
			if (candidates[i][0] === "accept")
				return candidates[i]
	}

	if (save_meta.ai_kind === "bfull" && bfull_model && window.pog_bfull) {
		var decision = window.pog_bfull.choose({
			game_id: save_meta.seed || "local",
			role: role,
			view: v,
			candidates: candidates,
			model: bfull_model,
			memory: ai_memory,
		})
		if (decision) {
			ai_memory = decision.memory
			return decision.choice
		}
	}

	return heuristic_choose(candidates, role)
}

function heuristic_choose(candidates, role) {

	// cap the number of scored candidates to bound think time
	var pool = candidates
	var MAX_POOL = 36
	if (pool.length > MAX_POOL) {
		pool = candidates.slice(0)
		shuffle(pool)
		pool.length = MAX_POOL
	}

	var in_combat = !!game.attack
	var sign = (role === CP) ? 1 : -1
	var best = null
	var best_score = -Infinity
	for (var i = 0; i < pool.length; ++i) {
		var s = clone_state(game)
		// re-seed so the AI cannot foresee its dice rolls
		s.seed = (Math.random() * 0x7fffffff) | 0
		var score
		try {
			s = RULES.action(s, role, pool[i][0], pool[i][1])
			// resolve combat consequences before judging: declaring an attack
			// is only a commitment - dice and losses come in later actions
			if (in_combat || s.attack)
				s = resolve_combat(s)
			score = sign * eval_state_dispatch(s) + Math.random() * 0.25
		} catch (err) {
			score = -Infinity
		}
		if (score > best_score) {
			best_score = score
			best = pool[i]
		}
	}
	return best || candidates[0]
}

function action_delay(choice, v) {
	var delay
	if (save_meta.ai_kind === "bfull" && window.pog_bfull)
		delay = window.pog_bfull.delay(choice, v)
	var action = choice[0]
	var prompt = v.prompt || ""
	if (delay === undefined && action.indexOf("play_") === 0)
		delay = 900
	if (delay === undefined && (action === "space" || action === "piece") && /move|advance|retreat|redeployment/i.test(prompt))
		delay = 1400
	if (delay === undefined && (action === "space" || action === "piece"))
		delay = 650
	if (delay === undefined && (action === "attack" || action === "flank"))
		delay = 800
	if (delay === undefined)
		delay = 360
	return Math.round(delay * AI_PACE)
}

function resolve_combat(s) {
	for (var depth = 0; depth < 14 && s.state !== "game_over" && s.attack; ++depth) {
		var r = s.active
		if (r === "Both" || r === "All") r = CP
		var v = RULES.view(s, r)
		var c = list_actions(v)
		if (!c.length) {
			r = (r === CP) ? AP : CP
			v = RULES.view(s, r)
			c = list_actions(v)
			if (!c.length) break
		}
		var pick = c[0]
		if (c.length > 1) {
			var inner = c
			if (inner.length > 5) {
				inner = c.slice()
				shuffle(inner)
				inner.length = 5
			}
			var rsign = (r === CP) ? 1 : -1
			var bs = -Infinity
			for (var k = 0; k < inner.length; ++k) {
				var s2 = clone_state(s)
				try {
					s2 = RULES.action(s2, r, inner[k][0], inner[k][1])
					var sc = rsign * eval_state(s2)
					if (sc > bs) { bs = sc; pick = inner[k] }
				} catch (e) {}
			}
		}
		try {
			s = RULES.action(s, r, pick[0], pick[1])
		} catch (e) {
			break
		}
	}
	return s
}

function shuffle(a) {
	for (var i = a.length - 1; i > 0; --i) {
		var j = (Math.random() * (i + 1)) | 0
		var t = a[i]; a[i] = a[j]; a[j] = t
	}
}

/* Evaluate a state from the Central Powers' perspective (higher = better for CP). */
function eval_state(s) {
	if (s.state === "game_over") {
		if (s.result === CP) return 1e6
		if (s.result === AP) return -1e6
		return 0
	}

	var score = 0

	// VP track is the core signal (CP wins high, AP wins low)
	score += 100 * s.vp

	// material: sum combat factors of on-map units
	var pieces = DATA.pieces
	var nspaces = DATA.spaces.length
	var reduced = s.reduced || []
	var cp_str = 0, ap_str = 0
	for (var p = 1; p < pieces.length; ++p) {
		var loc = s.location[p]
		if (loc > 0 && loc < nspaces) {
			var pc = pieces[p]
			var is_reduced = reduced.includes(p)
			var cf = is_reduced ? pc.rcf : pc.cf
			if (pc.faction === "cp") cp_str += cf
			else ap_str += cf
		}
	}
	score += 2 * (cp_str - ap_str)

	// war status advantage
	if (s.cp && s.ap)
		score += 3 * ((s.cp.ws || 0) - (s.ap.ws || 0))

	// track pressure
	score += 8 * (s.russian_capitulation || 0)
	score -= 6 * (s.us_entry || 0)

	// out-of-supply pieces are bad for their owner
	var oos = s.oos_pieces || []
	for (var k = 0; k < oos.length; ++k) {
		var op = pieces[oos[k]]
		if (op) {
			if (op.faction === "cp") score -= 12
			else score += 12
		}
	}

	// replacement point reserves (small)
	if (s.rp) {
		score += 1.5 * ((s.rp.ge || 0) + (s.rp.ah || 0) + (s.rp.tu || 0) + (s.rp.bu || 0))
		score -= 1.5 * ((s.rp.fr || 0) + (s.rp.br || 0) + (s.rp.ru || 0) + (s.rp.it || 0) + (s.rp.us || 0) + (s.rp.allied || 0))
	}

	return score
}

/* ---------- 参谋接口：为玩家一侧计算建议着法 ---------- */

var active_socket = null

window.pog_suggest = function () {
	if (!RULES || !game || !active_socket)
		return null
	var role = active_socket.role
	if (game.state === "game_over")
		return { over: true }
	if (!(game.active === role || game.active === "Both" || game.active === "All"))
		return { waiting: true }
	var v = RULES.view(game, role)
	var cands = list_actions(v)
	if (cands.length === 0)
		return { waiting: true }
	var pick = cands.length === 1 ? cands[0] : heuristic_choose(cands, role)
	return {
		verb: pick[0],
		noun: pick[1],
		n_options: cands.length,
		prompt: v.prompt,
		actions: v.actions ? Object.keys(v.actions) : [],
	}
}

window.pog_player_role = function () {
	return active_socket ? active_socket.role : null
}

/* ---------- install ---------- */

// Only hijack WebSocket on pages served without a real game server.
window.WebSocket = LocalSocket

/* ---------- self-test: drive the player side through the real UI action path ---------- */

if (new URLSearchParams(window.location.search).get("autotest") === "1") {
	setInterval(function () {
		try {
			if (typeof view === "undefined" || !view || !view.actions)
				return
			var picks = []
			for (var verb in view.actions) {
				if (verb === "undo" || verb === "resign" ||
					verb === "propose_rollback" || verb === "flag_supply_warnings")
					continue
				var val = view.actions[verb]
				if (val === 0 || val === false || val === null || val === undefined)
					continue
				if (Array.isArray(val))
					for (var i = 0; i < val.length; ++i) picks.push([ verb, val[i] ])
				else
					picks.push([ verb, undefined ])
			}
			if (picks.length && typeof send_action === "function") {
				var p = picks[(Math.random() * picks.length) | 0]
				console.log("AUTOTEST", p[0], p[1])
				send_action(p[0], p[1])
			}
		} catch (e) {
			console.error("AUTOTEST ERROR", e)
		}
	}, 300)
}

})()
