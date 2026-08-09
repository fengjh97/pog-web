"use strict"

/* Presentation-only war-room enhancements. Game truth still comes from
 * rules.js/view.actions; this module reads the rendered DOM and adds polish. */

;(function () {

var last_turn_label = "战役进行中"

function $(selector) {
	return document.querySelector(selector)
}

function count_enabled_actions() {
	var badge = $("#hq_action_btn .badge")
	if (badge && !badge.hidden)
		return Number(badge.textContent) || 0
	return Array.from(document.querySelectorAll("#actions button")).filter(function (button) { return !button.hidden }).length
}

function count_hand() {
	var badge = $("#hq_hand_btn .badge")
	if (badge && !badge.hidden)
		return Number(badge.textContent) || 0
	return document.querySelectorAll("#cards .card").length
}

function prompt_text() {
	var prompt = $("#prompt")
	return prompt ? prompt.textContent.trim() : ""
}

function turn_label() {
	try {
		if (typeof view !== "undefined" && Number.isFinite(view.turn))
			last_turn_label = "第 " + view.turn + " 回合"
	} catch (error) {}
	var text = prompt_text()
	var match = text.match(/第\s*(\d+)\s*回合/) || text.match(/Turn\s*(\d+)/i)
	if (match)
		last_turn_label = "第 " + match[1] + " 回合"
	return last_turn_label
}

function side_label() {
	if (document.body.classList.contains("Allied_Powers")) return "协约国司令部"
	if (document.body.classList.contains("Central_Powers")) return "同盟国司令部"
	return "总司令部"
}

function meter(label, value_id) {
	var item = document.createElement("span")
	item.className = "wr-meter"
	item.innerHTML = "<small>" + label + "</small><b id=\"" + value_id + "\">—</b>"
	return item
}

function build_hud() {
	var brand = $("#hq_brand")
	if (!brand || $("#warroom_hud")) return
	var hud = document.createElement("div")
	hud.id = "warroom_hud"
	hud.setAttribute("aria-label", "战役仪表")
	hud.appendChild(meter("CAMPAIGN", "wr_turn"))
	hud.appendChild(meter("COMMAND", "wr_side"))
	hud.appendChild(meter("READINESS", "wr_readiness"))
	brand.insertAdjacentElement("afterend", hud)
}

function sync_hud() {
	var turn = $("#wr_turn")
	var side = $("#wr_side")
	var readiness = $("#wr_readiness")
	if (!turn || !side || !readiness) return
	var actions = count_enabled_actions()
	turn.textContent = turn_label()
	side.textContent = side_label()
	readiness.textContent = "手牌 " + count_hand() + " · 命令 " + actions
}

function bind_card_tilt() {
	document.addEventListener("pointermove", function (event) {
		if (event.pointerType === "touch") return
		var card = event.target.closest && event.target.closest("#hq_card_host .card.enabled")
		if (!card) return
		var rect = card.getBoundingClientRect()
		var x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
		var y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
		card.style.setProperty("--wr-card-rx", ((0.5 - y) * 9).toFixed(2) + "deg")
		card.style.setProperty("--wr-card-ry", ((x - 0.5) * 11).toFixed(2) + "deg")
		card.classList.add("wr-card-hover")
	})

	document.addEventListener("pointerout", function (event) {
		var card = event.target.closest && event.target.closest("#hq_card_host .card")
		if (!card || (event.relatedTarget && card.contains(event.relatedTarget))) return
		card.classList.remove("wr-card-hover")
		card.style.removeProperty("--wr-card-rx")
		card.style.removeProperty("--wr-card-ry")
	})
}

function bind_tactile_controls() {
	document.addEventListener("pointerdown", function (event) {
		var piece = event.target.closest && event.target.closest(".unit")
		if (piece) piece.classList.add("wr-piece-pressed")
	})

	function release_pieces() {
		for (var piece of document.querySelectorAll(".unit.wr-piece-pressed"))
			piece.classList.remove("wr-piece-pressed")
	}

	document.addEventListener("pointerup", release_pieces)
	document.addEventListener("pointercancel", release_pieces)

	document.addEventListener("click", function (event) {
		var button = event.target.closest && event.target.closest("#actions button:not(:disabled), #hq_quick_action")
		if (!button) return
		button.classList.remove("wr-command-issued")
		void button.offsetWidth
		button.classList.add("wr-command-issued")
		window.setTimeout(function () { button.classList.remove("wr-command-issued") }, 360)
	})
}

function observe_status() {
	var observer = new MutationObserver(function () {
		window.requestAnimationFrame(sync_hud)
	})
	for (var target of [$("#prompt"), $("#actions"), $("#cards")])
		if (target) observer.observe(target, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled", "class"] })
	observer.observe(document.body, { attributes: true, attributeFilter: ["class"] })
}

window.addEventListener("load", function () {
	build_hud()
	sync_hud()
	bind_card_tilt()
	bind_tactile_controls()
	observe_status()
})

})()
