"use strict"

/* Browser/Node adapter for the deployable RL2 B-full policy.
 *
 * The policy receives the same role-redacted view as a normal player.  It
 * reconstructs the public 537-feature state, adds only the acting side's
 * 65-card hand vector and faction bit, then scores legal action candidates
 * with the recurrent pointer policy used during training.
 */

;(function (root, factory) {
	if (typeof module !== "undefined")
		module.exports = factory(require("../data.js"), require("../features.js"), require("./jsnn.js"))
	else
		root.pog_bfull = factory(data, root.pog_features, root.pog_rl2)
})(typeof window !== "undefined" ? window : globalThis, function (data, features, network) {

var AP_ROLE = "Allied Powers"
var CP_ROLE = "Central Powers"
var MAX_CANDIDATES = 16
var TEMPERATURE = 0.3

function action_key(choice) {
	return choice.action + ":" + (choice.args === undefined ? "" : choice.args)
}

function visible_count(value) {
	return Array.isArray(value) ? value.length : Number(value || 0)
}

function observable_state(view, role) {
	var cp_hand = role === CP_ROLE ? view.hand : new Array(visible_count(view.cp.hand))
	var ap_hand = role === AP_ROLE ? view.hand : new Array(visible_count(view.ap.hand))
	return Object.assign({}, view, {
		cp: Object.assign({}, view.cp, {
			hand: cp_hand,
			deck: new Array(visible_count(view.cp.deck)),
		}),
		ap: Object.assign({}, view.ap, {
			hand: ap_hand,
			deck: new Array(visible_count(view.ap.deck)),
		}),
	})
}

function hand_onehot(view) {
	var result = new Array(65).fill(0)
	for (var i = 0; i < (view.hand || []).length; ++i) {
		var card = view.hand[i]
		var index = (card > 65 ? card - 65 : card) - 1
		if (index >= 0 && index < result.length)
			result[index] = 1
	}
	return result
}

function build_observation(view, role) {
	var result = features.extract(observable_state(view, role))
	result.push.apply(result, hand_onehot(view))
	result.push(role === CP_ROLE ? 1 : 0)
	return result
}

var VERB_GROUPS = [
	"play_event", "play_ops", "play_sr", "play_rps", "card", "space",
	"piece", "attack", "confirm", "next", "pass", "other",
]

function verb_group(action) {
	if (VERB_GROUPS.includes(action))
		return action
	if (action === "attack" || action === "flank")
		return "attack"
	if (/^confirm|^accept/.test(action))
		return "confirm"
	if (action === "next" || action === "done")
		return "next"
	if (/^pass$|^skip$|^stop$|^no_attack$|^end_|^reject$/.test(action))
		return "pass"
	return "other"
}

function control_bit(view, space) {
	return (view.control[space >> 5] >>> (space & 31)) & 1
}

function candidate_features(view, choice) {
	var result = new Array(20).fill(0)
	var group = VERB_GROUPS.indexOf(verb_group(choice.action))
	result[group >= 0 ? group : 11] = 1

	var action = choice.action
	var args = choice.args
	if ((action === "card" || action.startsWith("play_")) && typeof args === "number" && data.cards[args]) {
		var card = data.cards[args]
		result[12] = card.ops / 5
		result[13] = card.sr / 5
		result[14] = (card.ws || 0) / 2
		result[15] = card.remove ? 1 : 0
		result[16] = card.cc ? 1 : 0
	} else if ((action === "space" || action === "attack") && typeof args === "number" && data.spaces[args]) {
		result[17] = (data.spaces[args].vp || 0) / 3
		result[18] = control_bit(view, args)
	} else if (typeof args === "number" && data.pieces[args] &&
			(action === "piece" || action === "eliminate" || action === "retreat" || action === "use")) {
		result[19] = data.pieces[args].cf / 5
	}

	return result
}

function hash_text(text) {
	var hash = 2166136261
	for (var index = 0; index < text.length; ++index) {
		hash ^= text.charCodeAt(index)
		hash = Math.imul(hash, 16777619)
	}
	return hash >>> 0
}

function make_rng(seed) {
	var state = seed || 1
	return function () {
		state = Math.imul(state ^ (state >>> 15), 1 | state)
		state ^= state + Math.imul(state ^ (state >>> 7), 61 | state)
		return ((state ^ (state >>> 14)) >>> 0) / 4294967296
	}
}

function shuffle_with_rng(items, rng) {
	for (var index = items.length - 1; index > 0; --index) {
		var other = Math.floor(rng() * (index + 1))
		var item = items[index]
		items[index] = items[other]
		items[other] = item
	}
}

function pieces_in_space(view, space, role) {
	var faction = role === CP_ROLE ? "cp" : "ap"
	var count = 0
	for (var piece = 1; piece < view.location.length; ++piece)
		if (view.location[piece] === space && data.pieces[piece] && data.pieces[piece].faction === faction)
			count++
	return count
}

function unsafe_stacking(view, role, choice) {
	if (choice.action !== "space" || typeof choice.args !== "number")
		return false
	var prompt = view.prompt || ""
	var moving = 0
	if (/move/i.test(prompt))
		moving = view.move && view.move.pieces ? view.move.pieces.length : 0
	else if (/retreat/i.test(prompt))
		moving = view.attack && view.attack.retreating_pieces ? view.attack.retreating_pieces.length : 0
	else if (/advance/i.test(prompt))
		moving = view.attack && view.attack.advancing_pieces ? view.attack.advancing_pieces.length : 0
	return moving > 0 && pieces_in_space(view, choice.args, role) + moving > 3
}

function normalize_memory(memory) {
	var h = memory && Array.isArray(memory.h) && memory.h.length === 128 ? memory.h : Array.from(network.new_hidden())
	return {
		h: h,
		history: memory && Array.isArray(memory.history) ? memory.history.slice(-32) : [],
		avoid: memory && typeof memory.avoid === "string" ? memory.avoid : null,
		recovery: !!(memory && memory.recovery),
		retry: Number(memory && memory.retry || 0),
	}
}

function remember(memory, choice) {
	memory.history.push(action_key(choice))
	if (memory.history.length > 32)
		memory.history.shift()
}

function undo_decision(memory) {
	memory.avoid = memory.history.pop() || null
	memory.h = Array.from(network.new_hidden())
	memory.retry++
	return { choice: [ "undo", undefined ], memory: memory }
}

function fallback_choice(actions) {
	var priority = [
		"reset_phase", "attack", "confirm_mutiny_attack", "next", "retreat",
		"piece", "space", "card", "done", "end_action", "end_rp", "pass", "skip",
	]
	for (var i = 0; i < priority.length; ++i) {
		var found = actions.find(function (candidate) { return candidate.action === priority[i] })
		if (found)
			return found
	}
	return actions[0]
}

function choose(options) {
	var model = options.model
	var role = options.role
	var view = options.view
	var memory = normalize_memory(options.memory)
	var actions = options.candidates.map(function (candidate) {
		return { action: candidate[0], args: candidate[1] }
	})
	var can_undo = !!(view.actions && view.actions.undo)

	if (actions.length === 0)
		return can_undo ? undo_decision(memory) : null

	var reset = actions.find(function (choice) { return choice.action === "reset_phase" })
	if (reset && /correct rule violations/i.test(view.prompt || "")) {
		memory.recovery = true
		memory.h = Array.from(network.new_hidden())
		memory.retry++
		remember(memory, reset)
		return { choice: [ reset.action, reset.args ], memory: memory }
	}

	if (memory.recovery) {
		var violations = view.violations || []
		var single_op = actions.find(function (choice) { return choice.action === "single_op" })
		if (single_op && violations.length === 0) {
			remember(memory, single_op)
			return { choice: [ single_op.action, single_op.args ], memory: memory }
		}
		var skip = actions.find(function (choice) { return choice.action === "skip" })
		if (skip && violations.length === 0 && /activate spaces/i.test(view.prompt || "")) {
			memory.recovery = false
			remember(memory, skip)
			return { choice: [ skip.action, skip.args ], memory: memory }
		}
		if (violations.length === 0 && !single_op)
			memory.recovery = false
	}

	if (memory.avoid) {
		var alternatives = actions.filter(function (choice) { return action_key(choice) !== memory.avoid })
		if (alternatives.length > 0) {
			actions = alternatives
			memory.avoid = null
		} else if (can_undo) {
			memory.avoid = null
			return undo_decision(memory)
		}
	}

	var safe_actions = actions.filter(function (choice) { return !unsafe_stacking(view, role, choice) })
	if (safe_actions.length > 0)
		actions = safe_actions
	else if (can_undo)
		return undo_decision(memory)

	if (actions.length === 1) {
		remember(memory, actions[0])
		return { choice: [ actions[0].action, actions[0].args ], memory: memory }
	}

	var seed = hash_text(String(options.game_id || "local") + "|" + role + "|" + view.turn + "|" + view.log.length + "|" + view.prompt + "|" + memory.retry)
	var rng = make_rng(seed)
	if (actions.length > MAX_CANDIDATES) {
		actions = actions.slice()
		shuffle_with_rng(actions, rng)
		actions.length = MAX_CANDIDATES
	}

	var choice = null
	if (model) {
		try {
			var observation = build_observation(view, role)
			var candidates = actions.map(function (candidate) { return candidate_features(view, candidate) })
			var step = network.policy_step(model, observation, Float64Array.from(memory.h), candidates)
			memory.h = Array.from(step.h)
			choice = actions[network.softmax_sample(step.logits, TEMPERATURE, rng).idx]
		} catch (error) {
			console.error("B-full inference failed; using the legal-action fallback.", error)
		}
	}
	if (!choice)
		choice = fallback_choice(actions)

	remember(memory, choice)
	return { choice: [ choice.action, choice.args ], memory: memory }
}

function delay(choice, view) {
	var action = choice[0]
	var prompt = view.prompt || ""
	if (action.startsWith("play_"))
		return 1100
	if ((action === "space" || action === "piece") && /move|advance|retreat|redeployment/i.test(prompt))
		return 1500
	if (action === "piece" && /loss|eliminate|reduce/i.test(prompt))
		return 550
	if (action === "attack" || action === "confirm_mutiny_attack")
		return 850
	if (action === "next" || action === "end_action" || action === "end_rp")
		return 600
	return 320
}

return {
	name: "B-full 强化学习 AI",
	choose: choose,
	delay: delay,
	build_observation: build_observation,
	candidate_features: candidate_features,
	new_memory: function () { return normalize_memory(null) },
}

})
