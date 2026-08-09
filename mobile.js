"use strict"

/* 光荣之路 · 现代指挥界面
 * 棋盘始终留在主画面；手牌、行动、战况与战报由底部指挥栏呼出。
 * 这里只移动和解释现有 DOM，所有合法动作仍由 rules.js / view.actions 决定。
 */

;(function () {

var MOBILE_MQ = window.matchMedia("(max-width: 800px)")
var TUTORIAL_KEY = "pog_academy_complete_v3"
var MAP_FIT_KEY = "pog_map_fit_default_v1"
var SHEET_NAMES = [ "map", "hand", "actions", "data", "log" ]
var active_sheet = null
var tutorial_step = 0

var REGIONS = [
	{ key: "west", zh: "西线", en: "WESTERN FRONT", x: 460, y: 660 },
	{ key: "east", zh: "东线", en: "EASTERN FRONT", x: 1350, y: 420 },
	{ key: "italy", zh: "意大利", en: "ITALIAN FRONT", x: 880, y: 1180 },
	{ key: "balkans", zh: "巴尔干", en: "BALKANS", x: 1330, y: 1030 },
	{ key: "neareast", zh: "近东", en: "NEAR EAST", x: 2050, y: 1250 },
]

var ACTION_HELP = {
	"下一步": "确认当前说明，进入下一阶段",
	"完成": "完成当前选择并交给规则结算",
	"撤销": "撤回本阶段尚未确认的选择",
	"自动行动": "让系统完成当前唯一或标准操作",
	"全选": "选择当前所有合法单位",
	"使用": "使用已选中的效果或资源",
	"消灭": "让选中的单位承受最后一步损失",
	"撤退": "按提示把部队撤到合法区域",
	"构筑堑壕": "尝试在当前位置建立防御工事",
	"侧翼攻击": "以多路进攻尝试取得先手优势",
	"进攻": "确认兵力与目标并开始战斗",
	"停止": "停止继续选择或推进",
	"不进攻": "保留当前部署，不发动战斗",
	"接受": "接受对方的提议",
	"拒绝": "拒绝对方的提议",
	"结束行动": "结束这张牌带来的本次行动",
	"结束补充阶段": "结束本回合的补充操作",
	"重置阶段": "清空本阶段选择并重新开始",
	"放弃": "放弃剩余可选操作",
	"跳过": "本次不使用可选效果",
	"审核提议": "查看并处理回滚提议",
}

var PROMPT_FRAGMENTS = {
	" You must play \"Guns of August\"!": " 你必须打出“八月炮火”！",
}

var TUTORIAL_STEPS = [
	{
		title: "欢迎来到《光荣之路》",
		body: "这是一场以卡牌驱动的大战略游戏。你不需要先背完规则：每一步只看底部“当前指令”，再选择发光的卡牌、地区或部队。这个教程会带你认识新的操作界面。",
	},
	{
		title: "第一步：先读当前指令",
		body: "这里永远告诉你现在要做什么。等待电脑时会显示“等待对手”；轮到你时，会提示打牌、移动、进攻、撤退或承受损失。",
		target: "#hq_turn_bar",
	},
	{
		title: "第二步：从手牌开始行动",
		body: "每个行动轮通常从打一张牌开始。点“手牌”即可呼出卡牌，不必再把整张地图向下拖。红点是你的手牌数量，按钮发光表示当前需要选牌。",
		target: "#hq_hand_btn",
	},
	{
		title: "一张牌有四种主要用法",
		body: "点一张亮起的牌，再选择：事件＝执行卡面效果；OPS＝激活地区移动或进攻；SR＝远距离调兵；RP＝储存补充点重建部队。新手多数时候先用 OPS，强力历史事件再作为事件打出。",
		target: "#cards",
		sheet: "hand",
	},
	{
		title: "第三步：行动面板会解释规则",
		body: "“行动”面板集中显示所有确认按钮、当前阶段解释和参谋建议。每个按钮下面都有一句用途说明，不再只看到难懂的英文术语。",
		target: "#hq_action_btn",
	},
	{
		title: "第四步：在地图上完成选择",
		body: "关闭抽屉后，地图仍停在原处。金色或脉冲高亮的地区、部队就是合法目标。先点部队/地区，再按当前指令选择目的地或确认战斗。",
		target: "main",
	},
	{
		title: "第五步：用战况面板读懂数据",
		body: "“战况”里集中显示双方手牌、牌库、强制攻势与规则警告，并附有 VP、WS、MO、OPS、SR、RP 的中文解释。增援表和战分总览也从这里进入。",
		target: "#hq_data_btn",
	},
	{
		title: "第六步：战报负责复盘",
		body: "电脑移动太快或没看清骰子结果时，打开“战报”。它只在自己的抽屉里滚动，不会把地图和手牌一起带走。",
		target: "#hq_log_btn",
	},
	{
		title: "准备好了",
		body: "记住最短流程：读指令 → 打开手牌/行动 → 回到地图点高亮目标 → 用战况和战报确认结果。任何时候都可以点右下角“教程”重新查看。",
	},
]

function $(selector) {
	return document.querySelector(selector)
}

function esc(text) {
	return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function dock_button(id, icon, label, english, sheet) {
	var button = document.createElement("button")
	button.type = "button"
	button.id = id
	button.className = "hq-dock-button"
	button.dataset.sheet = sheet || ""
	button.setAttribute("aria-expanded", "false")
	button.innerHTML =
		"<span class=\"hq-dock-icon\" aria-hidden=\"true\">" + icon + "</span>" +
		"<span class=\"hq-dock-label\">" + label + "</span>" +
		"<small>" + english + "</small>"
	if (sheet)
		button.addEventListener("click", function () { toggle_sheet(sheet) })
	return button
}

function sheet_markup(name, title, subtitle, body) {
	return "<section class=\"hq-sheet\" id=\"hq_sheet_" + name + "\" aria-hidden=\"true\" hidden>" +
		"<div class=\"hq-sheet-head\"><div><small>FIELD COMMAND</small><h2>" + title + "</h2><p>" + subtitle + "</p></div>" +
		"<button class=\"hq-sheet-close\" type=\"button\" aria-label=\"关闭\">×</button></div>" +
		"<div class=\"hq-sheet-body\">" + (body || "") + "</div></section>"
}

function build_shell() {
	document.body.classList.add("pog-modern-ui")

	var brand = document.createElement("div")
	brand.id = "hq_brand"
	brand.innerHTML = "<b>光荣之路</b><small>PATHS OF GLORY</small>"
	$("header").prepend(brand)

	var root = document.createElement("div")
	root.id = "hq_root"
	root.innerHTML =
		"<button id=\"hq_backdrop\" type=\"button\" aria-label=\"关闭面板\" hidden></button>" +
		"<div id=\"hq_turn_bar\"><span class=\"hq-turn-sigil\">✦</span><div class=\"hq-turn-copy\"><small>当前指令</small><div id=\"hq_prompt_host\"></div></div><button id=\"hq_quick_action\" type=\"button\">查看行动</button><div id=\"hq_status_host\"></div></div>" +
		sheet_markup("map", "战区导航", "快速返回全图，或直接前往主要战区。", "<div id=\"hq_region_grid\" class=\"hq-region-grid\"></div>") +
		sheet_markup("hand", "作战手牌", "点选发光的卡牌，再选择事件、OPS、SR 或 RP。", "<div id=\"hq_card_tabs\" class=\"hq-tabs\"></div><div id=\"hq_card_host\"></div>") +
		sheet_markup("actions", "当前行动", "先读阶段解释，再执行下方可用按钮。", "<div id=\"hq_advisor_host\"></div><div id=\"hq_action_empty\" class=\"hq-empty\">当前没有需要你确认的按钮。请回到地图，点选发光的卡牌、地区或部队。</div><div id=\"hq_action_host\"></div>") +
		sheet_markup("data", "战况与数据", "把关键数字翻译成可以直接用于决策的信息。", "<div id=\"hq_data_tabs\" class=\"hq-tabs\"></div><div id=\"hq_data_host\"></div>") +
		sheet_markup("log", "战场战报", "查看电脑行动、掷骰、损失和历史事件。", "<div id=\"hq_log_host\"></div>") +
		"<nav id=\"hq_dock\" aria-label=\"游戏面板\"></nav>" +
		"<div id=\"hq_tutorial\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"hq_tutorial_title\" hidden>" +
			"<div id=\"hq_tutorial_spotlight\" hidden></div>" +
			"<article id=\"hq_tutorial_card\"><div class=\"hq-tutorial-progress\"><span id=\"hq_tutorial_count\"></span><button id=\"hq_tutorial_skip\" type=\"button\">跳过教程</button></div><small>BEGINNER'S BRIEFING</small><h2 id=\"hq_tutorial_title\"></h2><p id=\"hq_tutorial_body\"></p><div class=\"hq-tutorial-buttons\"><button id=\"hq_tutorial_prev\" type=\"button\">上一步</button><button id=\"hq_tutorial_next\" type=\"button\">下一步</button></div></article>" +
		"</div>"
	document.body.appendChild(root)

	var dock = $("#hq_dock")
	dock.appendChild(dock_button("hq_map_btn", "⌖", "战场", "MAP", "map"))
	var hand = dock_button("hq_hand_btn", "▤", "手牌", "CARDS", "hand")
	hand.insertAdjacentHTML("beforeend", "<span class=\"badge\" hidden>0</span>")
	dock.appendChild(hand)
	var actions = dock_button("hq_action_btn", "✦", "行动", "ACTION", "actions")
	actions.insertAdjacentHTML("beforeend", "<span class=\"badge\" hidden>0</span>")
	dock.appendChild(actions)
	dock.appendChild(dock_button("hq_data_btn", "◫", "战况", "STATUS", "data"))
	dock.appendChild(dock_button("hq_log_btn", "≡", "战报", "LOG", "log"))
	var help = dock_button("hq_help_btn", "?", "军校", "LEARN", "")
	help.addEventListener("click", begin_tutorial)
	dock.appendChild(help)

	for (var name of SHEET_NAMES) {
		var close = $("#hq_sheet_" + name + " .hq-sheet-close")
		close.addEventListener("click", close_sheets)
	}
	$("#hq_backdrop").addEventListener("click", close_sheets)
	$("#hq_quick_action").addEventListener("click", function () { open_sheet("actions") })

	move_game_surfaces()
	build_map_navigation()
	build_card_tabs()
	build_data_tabs()
	bind_tutorial()
	bind_keyboard()
	observe_live_ui()
	label_toolbar()

	window.POG_UI = {
		open: open_sheet,
		close: close_sheets,
		tutorial: begin_tutorial,
	}
}

function move_game_surfaces() {
	var prompt = $("#prompt")
	var actions = $("#actions")
	var panels = $(".panel-list")
	var roles = $("#roles")
	var turn_info = $("#turn_info")
	var log = $("#log")
	var status = $("#status")

	if (prompt) $("#hq_prompt_host").appendChild(prompt)
	if (actions) $("#hq_action_host").appendChild(actions)
	if (panels) $("#hq_card_host").appendChild(panels)
	if (log) $("#hq_log_host").appendChild(log)
	if (status) $("#hq_status_host").appendChild(status)

	var overview = document.createElement("div")
	overview.id = "hq_data_overview"
	overview.className = "hq-data-page"
	overview.dataset.page = "overview"
	overview.innerHTML = "<div class=\"hq-data-heading\"><b>双方态势</b><span>牌库、手牌与当前回合</span></div>"
	if (roles) overview.appendChild(roles)
	if (turn_info) overview.appendChild(turn_info)
	$("#hq_data_host").appendChild(overview)

	var aside = $("aside")
	if (aside) aside.hidden = true

	if (actions) {
		actions.addEventListener("click", function (event) {
			if (event.target.closest("button"))
				setTimeout(close_sheets, 90)
		})
	}
	document.addEventListener("click", function (event) {
		if (event.target.closest("#card_popup [data-action], #activation_popup [data-action]"))
			setTimeout(close_sheets, 90)
	}, true)
}

function build_map_navigation() {
	var grid = $("#hq_region_grid")
	var fit = document.createElement("button")
	fit.type = "button"
	fit.className = "hq-region hq-region-all"
	fit.innerHTML = "<b>全图</b><span>OVERVIEW</span><small>查看整个欧洲战场</small>"
	fit.addEventListener("click", fit_map)
	grid.appendChild(fit)

	REGIONS.forEach(function (region) {
		var button = document.createElement("button")
		button.type = "button"
		button.className = "hq-region"
		button.innerHTML = "<b>" + region.zh + "</b><span>" + region.en + "</span><small>定位到该战区</small>"
		button.addEventListener("click", function () { jump_to_region(region) })
		grid.appendChild(button)
	})
}

function build_card_tabs() {
	var tabs = [
		{ key: "hand", label: "手牌", target: $("#cards") && $("#cards").closest(".panel") },
		{ key: "combat", label: "战斗牌", target: $("#cc-list") },
		{ key: "active", label: "生效中", target: $("#active_card_zone") },
	]
	var tabbar = $("#hq_card_tabs")
	tabs.forEach(function (tab) {
		if (!tab.target) return
		tab.target.dataset.hqCardPage = tab.key
		var button = document.createElement("button")
		button.type = "button"
		button.dataset.tab = tab.key
		button.innerHTML = tab.label + " <span>0</span>"
		button.addEventListener("click", function () { set_card_tab(tab.key) })
		tabbar.appendChild(button)
	})
	set_card_tab("hand")
}

function build_data_tabs() {
	var host = $("#hq_data_host")
	var glossary = document.createElement("div")
	glossary.className = "hq-data-page"
	glossary.dataset.page = "glossary"
	glossary.hidden = true
	glossary.innerHTML =
		"<div class=\"hq-glossary\">" +
		"<article><b>VP · 战分</b><p>胜负核心指标。通常低于 10 对协约国有利，高于 10 对同盟国有利。</p></article>" +
		"<article><b>WS · 战争状态</b><p>推动有限战争与总体战，决定后期卡牌和增援何时解锁。</p></article>" +
		"<article><b>MO · 强制攻势</b><p>本回合必须由指定国家至少进攻一次，否则结算时受到 1 VP 惩罚。</p></article>" +
		"<article><b>OPS · 行动点</b><p>激活地区进行移动或进攻，是最常使用的卡牌资源。</p></article>" +
		"<article><b>SR · 战略调动</b><p>让部队沿己方交通线长距离转移，用于快速补强战线。</p></article>" +
		"<article><b>RP · 补充点</b><p>按国家储存，用于翻回减员单位或重建已经被消灭的部队。</p></article>" +
		"</div>"
	host.appendChild(glossary)

	var reinforcement = document.createElement("div")
	reinforcement.className = "hq-data-page"
	reinforcement.dataset.page = "reinforcements"
	reinforcement.hidden = true
	reinforcement.innerHTML = "<div class=\"hq-data-heading\"><b>增援时刻表</b><span>可在表内拖动查看各回合到达单位</span></div>"
	var reinforcement_wrap = $("#reinforcements_wrap")
	if (reinforcement_wrap) reinforcement.appendChild(reinforcement_wrap)
	host.appendChild(reinforcement)

	var tools = document.createElement("div")
	tools.className = "hq-data-page"
	tools.dataset.page = "tools"
	tools.hidden = true
	tools.innerHTML =
		"<div class=\"hq-tool-grid\">" +
		"<button type=\"button\" data-tool=\"score\"><b>战分总览</b><span>查看 VP 构成与胜负趋势</span></button>" +
		"<button type=\"button\" data-tool=\"supply\"><b>标记补给风险</b><span>在地图上显示可能断补给的地区</span></button>" +
		"<button type=\"button\" data-tool=\"pieces\"><b>切换棋子显示</b><span>在棋子、标记和纯地图间切换</span></button>" +
		"<a href=\"info/pac.html\" target=\"_blank\"><b>玩家辅助图表</b><span>打开完整表格与参考资料</span></a>" +
		"</div>"
	host.appendChild(tools)
	tools.querySelector("[data-tool=score]").addEventListener("click", function () { if (typeof show_score_summary === "function") show_score_summary() })
	tools.querySelector("[data-tool=supply]").addEventListener("click", function () { if (typeof flag_supply_warnings === "function") flag_supply_warnings() })
	tools.querySelector("[data-tool=pieces]").addEventListener("click", function () { if (typeof toggle_counters === "function") toggle_counters() })

	var tabs = [ ["overview", "战况"], ["glossary", "术语"], ["reinforcements", "增援"], ["tools", "工具"] ]
	var tabbar = $("#hq_data_tabs")
	tabs.forEach(function (tab) {
		var button = document.createElement("button")
		button.type = "button"
		button.dataset.tab = tab[0]
		button.textContent = tab[1]
		button.addEventListener("click", function () { set_data_tab(tab[0]) })
		tabbar.appendChild(button)
	})
	set_data_tab("overview")
}

function set_card_tab(name) {
	for (var panel of document.querySelectorAll("[data-hq-card-page]"))
		panel.hidden = panel.dataset.hqCardPage !== name
	for (var button of document.querySelectorAll("#hq_card_tabs button"))
		button.classList.toggle("selected", button.dataset.tab === name)
}

function set_data_tab(name) {
	for (var page of document.querySelectorAll("#hq_data_host .hq-data-page"))
		page.hidden = page.dataset.page !== name
	for (var button of document.querySelectorAll("#hq_data_tabs button"))
		button.classList.toggle("selected", button.dataset.tab === name)
}

function open_sheet(name) {
	if (SHEET_NAMES.indexOf(name) < 0) return
	for (var sheet_name of SHEET_NAMES) {
		var sheet = $("#hq_sheet_" + sheet_name)
		var button = $("#hq_" + (sheet_name === "actions" ? "action" : sheet_name) + "_btn")
		var selected = sheet_name === name
		sheet.hidden = !selected
		sheet.setAttribute("aria-hidden", String(!selected))
		if (button) {
			button.classList.toggle("selected", selected)
			button.setAttribute("aria-expanded", String(selected))
		}
	}
	active_sheet = name
	document.body.classList.add("hq-sheet-open")
	$("#hq_backdrop").hidden = false
	if (name === "log") {
		var log = $("#log")
		if (log) log.scrollTop = log.scrollHeight
	}
}

function close_sheets() {
	for (var sheet_name of SHEET_NAMES) {
		var sheet = $("#hq_sheet_" + sheet_name)
		if (sheet) {
			sheet.hidden = true
			sheet.setAttribute("aria-hidden", "true")
		}
	}
	for (var button of document.querySelectorAll("#hq_dock [data-sheet]")) {
		button.classList.remove("selected")
		button.setAttribute("aria-expanded", "false")
	}
	active_sheet = null
	document.body.classList.remove("hq-sheet-open")
	var backdrop = $("#hq_backdrop")
	if (backdrop) backdrop.hidden = true
}

function toggle_sheet(name) {
	if (active_sheet === name) close_sheets()
	else open_sheet(name)
}

function current_scale(main) {
	var scale = 1
	var element = main.querySelector("[data-scale]")
	while (element) {
		scale *= Number(element.dataset.scale) || 1
		element = element.querySelector("[data-scale]")
	}
	return scale
}

function fit_map() {
	close_sheets()
	var main = $("main")
	if (!main || typeof toggle_zoom !== "function") return
	if (current_scale(main) >= 0.9)
		toggle_zoom()
	else {
		main.scrollTo({ left: 0, top: 0, behavior: "smooth" })
	}
}

function jump_to_region(region) {
	close_sheets()
	var main = $("main")
	if (!main) return
	var scale = current_scale(main)
	if (scale < 0.55 && typeof toggle_zoom === "function") {
		var guard = 0
		while (scale < 0.9 && guard++ < 3) {
			toggle_zoom()
			scale = current_scale(main)
		}
	}
	main.scrollTo({
		left: Math.max(0, region.x * scale - main.clientWidth / 2),
		top: Math.max(0, region.y * scale - main.clientHeight / 2),
		behavior: "smooth",
	})
}

function card_art_url(card_number) {
	var faction = card_number <= 65 ? "ap" : "cp"
	var number = card_number <= 65 ? card_number : card_number - 65
	return "cards.2x/card_" + faction + "_" + (number < 10 ? "0" + number : number) + ".avif"
}

function zhface_html(card_number) {
	var card = typeof cards !== "undefined" ? cards[card_number] : null
	if (!card) return ""
	var effect = (window.CARD_FX_ZH && window.CARD_FX_ZH[card_number]) || ""
	var english_name = card.name_en || ""
	var bottom = "SR " + card.sr
	if (card.ws) bottom += " · 战争状态 +" + card.ws
	return "<div class=\"zh_top\"><div class=\"zh_ops\"><span>" + card.ops + "</span></div><div class=\"zh_name\"><b>" + esc(card.name) + "</b><i>" + esc(english_name) + "</i></div></div>" +
		"<div class=\"zh_art\" style=\"background-image:url('" + card_art_url(card_number) + "')\"></div>" +
		"<div class=\"zh_fx\">" + esc(effect) + "</div>" +
		"<div class=\"zh_bot\">" + bottom + (card.cc ? " <span class=\"cc\">战斗牌</span>" : "") + (card.remove ? " <span class=\"rm\">打出后移除</span>" : "") + "</div>"
}

function inject_zhfaces() {
	if (typeof cards === "undefined") return
	for (var card_number = 1; card_number < cards.length; ++card_number) {
		var element = cards[card_number] && cards[card_number].element
		if (!element || element.querySelector(".zhface")) continue
		var face = document.createElement("div")
		face.className = "zhface"
		face.innerHTML = zhface_html(card_number)
		element.appendChild(face)
	}
}

function refresh_card_counts() {
	var hand_count = $("#cards") ? $("#cards").children.length : 0
	var hand_badge = $("#hq_hand_btn .badge")
	if (hand_badge) {
		hand_badge.textContent = hand_count
		hand_badge.hidden = hand_count === 0
	}
	var counts = {
		hand: hand_count,
		combat: ($("#combat_cards") ? $("#combat_cards").children.length : 0) + ($("#unused_combat_cards") ? $("#unused_combat_cards").children.length : 0),
		active: $("#active_cards") ? $("#active_cards").children.length : 0,
	}
	for (var button of document.querySelectorAll("#hq_card_tabs button")) {
		var count = counts[button.dataset.tab] || 0
		var span = button.querySelector("span")
		if (span) span.textContent = count
	}
	var needs_card = false
	try {
		needs_card = Boolean(view && view.actions && (view.actions.card || view.actions.play_event || view.actions.play_ops || view.actions.play_sr || view.actions.play_rps))
	} catch (error) {}
	$("#hq_hand_btn").classList.toggle("pulse", needs_card)
}

function refresh_actions() {
	var actions = $("#actions")
	if (!actions) return
	var visible = Array.from(actions.querySelectorAll("button")).filter(function (button) { return !button.hidden })
	visible.forEach(function (button) {
		var label = button.textContent.trim()
		button.dataset.help = ACTION_HELP[label] || "执行当前阶段允许的“" + label + "”操作"
	})
	var badge = $("#hq_action_btn .badge")
	badge.textContent = visible.length
	badge.hidden = visible.length === 0
	$("#hq_action_btn").classList.toggle("pulse", visible.length > 0)
	$("#hq_action_empty").hidden = visible.length > 0
	var quick = $("#hq_quick_action")
	quick.textContent = visible.length === 1 ? visible[0].textContent.trim() : (visible.length > 1 ? "查看 " + visible.length + " 个行动" : "查看行动")
	quick.classList.toggle("ready", visible.length > 0)
}

function refresh_prompt_copy() {
	var prompt = $("#prompt")
	if (!prompt) return
	var copy = prompt.textContent
	for (var english in PROMPT_FRAGMENTS)
		copy = copy.split(english).join(PROMPT_FRAGMENTS[english])
	if (copy !== prompt.textContent) prompt.textContent = copy
}

function observe_live_ui() {
	var observer = new MutationObserver(function () {
		refresh_prompt_copy()
		refresh_card_counts()
		refresh_actions()
		inject_zhfaces()
	})
	for (var selector of [ "#actions", "#cards", "#combat_cards", "#unused_combat_cards", "#active_cards", "#prompt" ]) {
		var element = $(selector)
		if (element)
			observer.observe(element, { childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: [ "hidden", "disabled", "class" ] })
	}
	refresh_card_counts()
	refresh_actions()
	inject_zhfaces()
	refresh_prompt_copy()
	setInterval(function () {
		refresh_prompt_copy()
		refresh_card_counts()
		refresh_actions()
		inject_zhfaces()
	}, 1000)
}

function label_toolbar() {
	var labels = [ "设置与规则", "棋子样式", "战况资料", "补给工具" ]
	var summaries = document.querySelectorAll("#toolbar details > summary")
	for (var i = 0; i < summaries.length; ++i) summaries[i].title = labels[i] || "工具"
	var piece_button = $("#piece_button")
	if (piece_button) piece_button.title = "切换棋子与标记显示"
}

function bind_keyboard() {
	document.addEventListener("keydown", function (event) {
		if (event.key === "Escape") {
			if (!$("#hq_tutorial").hidden) finish_tutorial(false)
			else close_sheets()
			return
		}
		if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return
		var shortcuts = { "1": "map", "2": "hand", "3": "actions", "4": "data", "5": "log" }
		if (shortcuts[event.key]) open_sheet(shortcuts[event.key])
		if (event.key === "?") begin_tutorial()
	})
}

function bind_tutorial() {
	$("#hq_tutorial_prev").addEventListener("click", function () {
		if (tutorial_step > 0) {
			--tutorial_step
			render_tutorial_step()
		}
	})
	$("#hq_tutorial_next").addEventListener("click", function () {
		if (tutorial_step >= TUTORIAL_STEPS.length - 1) finish_tutorial(true)
		else {
			++tutorial_step
			render_tutorial_step()
		}
	})
	$("#hq_tutorial_skip").addEventListener("click", function () { finish_tutorial(true) })
	window.addEventListener("resize", position_tutorial)
}

function begin_tutorial() {
	if (window.POG_ACADEMY && typeof window.POG_ACADEMY.open === "function") {
		window.POG_ACADEMY.open()
		return
	}
	tutorial_step = 0
	$("#hq_tutorial").hidden = false
	document.body.classList.add("hq-tutorial-open")
	render_tutorial_step()
}

function render_tutorial_step() {
	var step = TUTORIAL_STEPS[tutorial_step]
	if (step.sheet) open_sheet(step.sheet)
	else close_sheets()
	$("#hq_tutorial_count").textContent = (tutorial_step + 1) + " / " + TUTORIAL_STEPS.length
	$("#hq_tutorial_title").textContent = step.title
	$("#hq_tutorial_body").textContent = step.body
	$("#hq_tutorial_prev").disabled = tutorial_step === 0
	$("#hq_tutorial_next").textContent = tutorial_step === TUTORIAL_STEPS.length - 1 ? "开始游戏" : "下一步"
	setTimeout(position_tutorial, 60)
}

function position_tutorial() {
	var tutorial = $("#hq_tutorial")
	if (!tutorial || tutorial.hidden) return
	var step = TUTORIAL_STEPS[tutorial_step]
	var spotlight = $("#hq_tutorial_spotlight")
	var card = $("#hq_tutorial_card")
	var target = step.target ? $(step.target) : null
	if (target && step.target === "#cards") target = $("#cards .card") || target
	if (!target || !target.isConnected) {
		spotlight.hidden = true
		tutorial.classList.add("no-target")
		card.classList.remove("place-top")
		return
	}
	var rect = target.getBoundingClientRect()
	var padding = step.target === "main" ? 8 : 10
	spotlight.hidden = false
	spotlight.style.left = Math.max(8, rect.left - padding) + "px"
	spotlight.style.top = Math.max(8, rect.top - padding) + "px"
	spotlight.style.width = Math.max(44, Math.min(window.innerWidth - 16, rect.width + padding * 2)) + "px"
	spotlight.style.height = Math.max(44, Math.min(window.innerHeight - 16, rect.height + padding * 2)) + "px"
	tutorial.classList.remove("no-target")
	card.classList.toggle("place-top", rect.top + rect.height / 2 > window.innerHeight / 2)
}

function finish_tutorial(remember) {
	$("#hq_tutorial").hidden = true
	document.body.classList.remove("hq-tutorial-open")
	if (remember) {
		try { window.localStorage.setItem(TUTORIAL_KEY, "1") } catch (error) {}
	}
	close_sheets()
}

function maybe_start_tutorial() {
	var forced = new URLSearchParams(window.location.search).get("tutorial") === "1"
	var complete = false
	try { complete = window.localStorage.getItem(TUTORIAL_KEY) === "1" } catch (error) {}
	if (forced || !complete) setTimeout(begin_tutorial, 900)
}

function maybe_fit_map() {
	var already_fit = false
	try { already_fit = window.localStorage.getItem(MAP_FIT_KEY) === "1" } catch (error) {}
	if (already_fit) return
	setTimeout(function () {
		var main = $("main")
		if (main && current_scale(main) >= 0.9 && typeof toggle_zoom === "function") {
			toggle_zoom()
			try { window.localStorage.setItem(MAP_FIT_KEY, "1") } catch (error) {}
		}
	}, 500)
}

window.addEventListener("load", function () {
	build_shell()
	maybe_fit_map()
	maybe_start_tutorial()
})

})()
