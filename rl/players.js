"use strict"

/* Policies for self-play and matches (node-side). */

const path = require("path")
const ROOT = path.join(__dirname, "..")
const data = require(path.join(ROOT, "data.js"))
const { extract } = require(path.join(ROOT, "features.js"))
const { nn_forward } = require(path.join(ROOT, "nn.js"))

const AP = "Allied Powers"
const CP = "Central Powers"

function list_actions(v) {
	const out = []
	if (!v.actions)
		return out
	for (const verb in v.actions) {
		if (verb === "undo" || verb === "resign" ||
			verb === "propose_rollback" || verb === "flag_supply_warnings")
			continue
		const val = v.actions[verb]
		if (val === 0 || val === false || val === null || val === undefined)
			continue
		if (Array.isArray(val))
			for (const x of val) out.push([verb, x])
		else if (val === 1 || val === true)
			out.push([verb, undefined])
		else
			out.push([verb, val])
	}
	return out
}

/* heuristic eval, CP-positive (port of the browser bot) */
function heuristic_eval(s) {
	if (s.state === "game_over") {
		if (s.result === CP) return 1e6
		if (s.result === AP) return -1e6
		return 0
	}
	let score = 100 * s.vp
	const reduced = new Set(s.reduced || [])
	let cp_str = 0, ap_str = 0
	const nspaces = data.spaces.length
	for (let p = 1; p < data.pieces.length; ++p) {
		const loc = s.location[p]
		if (loc > 0 && loc < nspaces) {
			const pc = data.pieces[p]
			const cf = reduced.has(p) ? pc.rcf : pc.cf
			if (pc.faction === "cp") cp_str += cf
			else ap_str += cf
		}
	}
	score += 2 * (cp_str - ap_str)
	if (s.cp && s.ap)
		score += 3 * ((s.cp.ws || 0) - (s.ap.ws || 0))
	score += 8 * (s.russian_capitulation || 0)
	score -= 6 * (s.us_entry || 0)
	for (const q of (s.oos_pieces || [])) {
		const pc = data.pieces[q]
		if (pc) score += pc.faction === "cp" ? -12 : 12
	}
	if (s.rp) {
		score += 1.5 * ((s.rp.ge||0) + (s.rp.ah||0) + (s.rp.tu||0) + (s.rp.bu||0))
		score -= 1.5 * ((s.rp.fr||0) + (s.rp.br||0) + (s.rp.ru||0) + (s.rp.it||0) + (s.rp.us||0) + (s.rp.allied||0))
	}
	return score
}

function nn_eval(model) {
	return function (s) {
		if (s.state === "game_over") {
			if (s.result === CP) return 1e6
			if (s.result === AP) return -1e6
			return 0.5
		}
		return nn_forward(model, extract(s))
	}
}

/* make_player(kind, opts) -> chooser(RULES, state, role, candidates) -> [verb, noun] */
function make_player(kind, opts = {}) {
	const eps = opts.eps || 0
	const max_pool = opts.max_pool || 16

	let evalfn = null
	if (kind === "heuristic")
		evalfn = heuristic_eval
	else if (kind === "nn")
		evalfn = nn_eval(opts.model)
	else if (kind !== "random")
		throw new Error("unknown player kind: " + kind)

	return function choose(RULES, state, role, candidates) {
		if (candidates.length === 1)
			return candidates[0]
		if (kind === "random" || Math.random() < eps)
			return candidates[(Math.random() * candidates.length) | 0]

		let pool = candidates
		if (pool.length > max_pool) {
			pool = candidates.slice()
			for (let i = pool.length - 1; i > 0; --i) {
				const j = (Math.random() * (i + 1)) | 0
				;[pool[i], pool[j]] = [pool[j], pool[i]]
			}
			pool.length = max_pool
		}

		const sign = role === CP ? 1 : -1
		let best = null, best_score = -Infinity
		for (const cand of pool) {
			let s = JSON.parse(JSON.stringify(state))
			s.seed = (Math.random() * 0x7fffffff) | 0
			let score
			try {
				s = RULES.action(s, role, cand[0], cand[1])
				score = sign * evalfn(s) + Math.random() * 1e-4
			} catch (err) {
				score = -Infinity
			}
			if (score > best_score) {
				best_score = score
				best = cand
			}
		}
		return best || candidates[0]
	}
}

module.exports = { make_player, list_actions, heuristic_eval, AP, CP }
