"use strict"

const rules = require("../rules.js")
const agent = require("../rl2/browser-agent.js")
const model = require("../rl2/models/bf_cur.json")

const game_count = Number(process.argv[2] || 3)
const scenario = process.argv[3] || "Historical"
const max_steps = Number(process.env.MAX_STEPS || 30000)

function list_actions(view) {
	let result = []
	for (let [ action, value ] of Object.entries(view.actions || {})) {
		if (action === "undo" || action === "resign" || action === "propose_rollback" || action === "flag_supply_warnings")
			continue
		if (!value)
			continue
		if (Array.isArray(value))
			for (let args of value)
				result.push([ action, args ])
		else
			result.push([ action, undefined ])
	}
	return result
}

function is_valid_action(actions, choice) {
	if (!choice || !actions || !actions[choice[0]])
		return false
	let value = actions[choice[0]]
	if (Array.isArray(value))
		return value.includes(choice[1])
	return choice[1] === undefined && (value === 1 || value === true || typeof value === "string")
}

function active_role(active, step) {
	if (Array.isArray(active))
		return active[0]
	if (active === "Both" || active === "All")
		return rules.roles[step % rules.roles.length]
	return active
}

for (let seed = 1; seed <= game_count; ++seed) {
	let state = rules.setup(seed, scenario, {})
	let step = 0
	let memory = {}

	while (state.active && state.active !== "None") {
		let role = active_role(state.active, step)
		let view = rules.view(state, role, false)
		let decision = agent.choose({
			game_id: seed,
			role,
			view,
			candidates: list_actions(view),
			model,
			memory: memory[role],
		})

		if (!decision || !is_valid_action(view.actions, decision.choice)) {
			console.error("INVALID BROWSER BOT ACTION", {
				seed, step, role, state: state.state, prompt: view.prompt,
				actions: view.actions, decision,
			})
			process.exit(1)
		}

		memory[role] = decision.memory
		state = rules.action(state, role, decision.choice[0], decision.choice[1])
		if (typeof rules.assert_state === "function")
			rules.assert_state(state)

		if (++step > max_steps) {
			console.error("BROWSER BOT STEP LIMIT", { seed, step, turn: state.turn, state: state.state })
			process.exit(1)
		}
	}

	console.log(JSON.stringify({ seed, scenario, steps: step, turn: state.turn, result: state.result }))
}
