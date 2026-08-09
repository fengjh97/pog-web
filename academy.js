"use strict"

/* 光荣之路 · 新手军校
 * 一个独立的、确定性教学战役。它不改动 rules.js，也不会向真实对局发送动作；
 * 结课后才启动一局由原规则引擎裁判的历史战役。
 */

;(function () {

var PROGRESS_KEY = "pog_academy_progress_v2"
var COMPLETE_KEY = "pog_academy_complete_v2"
var COACH_KEY = "pog_campaign_coach_v1"

var LESSONS = [
	{
		id: 1,
		title: "先知道怎么赢",
		short: "胜利目标",
		summary: "认出关键城市、VP 与一回合的基本循环。",
		reward: "侦察勋章",
		steps: [
			{
				target: "brussels",
				title: "找到这场教学战的目标",
				do: "点击地图上带金色旗帜的【布鲁塞尔】。",
				why: "《光荣之路》不是把所有敌军消灭才算赢。你要争夺关键城市、事件和国家，由 VP（战分）决定整场战争的胜负。",
				done: "目标已锁定：攻克布鲁塞尔。",
				effect: "objective",
			},
			{
				target: "flow",
				title: "记住一个行动的四步循环",
				do: "点击下方【一个行动怎么走】卡片。",
				why: "绝大多数时候你只需重复：选牌 → 选用途 → 在地图执行 → 结算。不要试图一次看懂整张地图。",
				done: "你已经知道每次只处理一个小行动。",
				effect: "flow",
			},
		],
	},
	{
		id: 2,
		title: "学会用一张牌",
		short: "卡牌用途",
		summary: "亲手把“八月炮火”作为事件打出。",
		reward: "作战计划章",
		steps: [
			{
				target: "guns_card",
				title: "选择本次行动的卡牌",
				do: "点击手牌中的【八月炮火】。",
				why: "每个行动轮从一张牌开始。卡牌左上角数字是 OPS；卡面正文是历史事件。发光的牌才是当前合法选择。",
				done: "已选中“八月炮火”。",
				effect: "select_card",
			},
			{
				target: "event_order",
				title: "决定这张牌怎么用",
				do: "在四种用途中点击【事件】。",
				why: "事件执行卡面历史效果；OPS 用来移动/进攻；SR 长距离调兵；RP 留到回合末补充。这里要摧毁列日要塞，所以用事件。",
				done: "用途正确：这张牌将作为事件结算。",
				effect: "choose_event",
			},
			{
				target: "resolve_event",
				title: "让历史事件改变地图",
				do: "点击【执行八月炮火】。",
				why: "事件不是抽象加分，它会直接改变地图、国家、部队或后续可用规则。现在列日要塞将被摧毁。",
				done: "列日要塞被摧毁，通往比利时的道路打开了。",
				effect: "resolve_event",
			},
		],
	},
	{
		id: 3,
		title: "把部队移到前线",
		short: "激活与移动",
		summary: "激活科布伦茨，把集团军推进列日。",
		reward: "机动勋章",
		steps: [
			{
				target: "koblenz",
				title: "先选部队所在的地区",
				do: "点击有德军集团军的【科布伦茨】。",
				why: "你不是直接拖棋子。先用 OPS 激活一个地区，再告诉系统这里的部队要移动还是进攻。",
				done: "科布伦茨已激活。",
				effect: "select_koblenz",
			},
			{
				target: "move_order",
				title: "给激活地区下命令",
				do: "点击【移动】命令。",
				why: "同一个地区不能在同一行动里既移动又进攻。移动用于占位和接敌；进攻用于打相邻敌军。",
				done: "已下达移动命令。",
				effect: "choose_move",
			},
			{
				target: "liege",
				title: "选择合法目的地",
				do: "点击金色脉冲的【列日】。",
				why: "集团军通常可移动 3 格。进入敌方控制地区会停下；每个地区最多堆叠 3 个单位。教学战只开放一个合法目的地。",
				done: "德军集团军抵达列日，下一步可以进攻布鲁塞尔。",
				effect: "move_liege",
			},
		],
	},
	{
		id: 4,
		title: "打一场必胜进攻",
		short: "战斗与推进",
		summary: "选择攻击者和目标，掷骰并推进占领。",
		reward: "布鲁塞尔战役勋章",
		steps: [
			{
				target: "liege",
				title: "选择参加进攻的部队",
				do: "点击列日的两个德军集团军。",
				why: "进攻先选攻击者。可以从多个相邻地区共同攻击，但本课只用一个堆叠。数字 5 是合计战斗力。",
				done: "攻击部队已选定：战斗力 5。",
				effect: "select_attackers",
			},
			{
				target: "attack_order",
				title: "把激活改为进攻命令",
				do: "点击【进攻】命令。",
				why: "移动和进攻使用同一套 OPS 激活逻辑。你已经选好攻击者，现在声明这次激活用于战斗。",
				done: "进攻命令已下达。",
				effect: "choose_attack",
			},
			{
				target: "brussels",
				title: "选择相邻的敌方目标",
				do: "点击红色脉冲的【布鲁塞尔】。",
				why: "系统会比较双方战斗力并查火力表。这里是 5 对 2，优势在你；真实对局还要考虑堑壕、地形和战斗牌。",
				done: "战斗已建立：德军 5 对比利时军 2。",
				effect: "target_brussels",
			},
			{
				target: "roll",
				title: "掷骰并读取战斗结果",
				do: "点击【掷战斗骰】。",
				why: "骰点不是直接等于伤害。系统会结合战斗力、火力表和修正自动算出损失，你只需按提示分配步损。教学战保证胜利。",
				done: "掷出 6！守军遭到 2 步损并被消灭。",
				effect: "roll_combat",
			},
			{
				target: "advance",
				title: "胜利后别忘了推进占领",
				do: "点击【推进并占领布鲁塞尔】。",
				why: "消灭或迫退守军后，攻击方通常可以推进。占领目标城市才会改变控制权和战分。",
				done: "布鲁塞尔已占领。教学战胜利！",
				effect: "advance_victory",
			},
		],
	},
]

var runtime = {
	screen: "home",
	lesson: 1,
	step: 0,
	completed: [ false, false, false, false ],
	chapterComplete: false,
	objectiveSeen: false,
	cardSelected: false,
	eventChosen: false,
	fortDestroyed: false,
	selectedSpace: "",
	order: "",
	unitsAt: "koblenz",
	targeted: false,
	roll: 0,
	enemyDefeated: false,
	victory: false,
}

var root = null
var feedbackTimer = null

function load_progress() {
	try {
		var saved = JSON.parse(window.localStorage.getItem(PROGRESS_KEY))
		if (saved && Array.isArray(saved.completed)) {
			runtime.completed = LESSONS.map(function (_, i) { return Boolean(saved.completed[i]) })
			runtime.lesson = Math.max(1, Math.min(4, Number(saved.lesson) || 1))
			runtime.step = Math.max(0, Number(saved.step) || 0)
		}
	} catch (error) {}
}

function save_progress() {
	try {
		window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({
			completed: runtime.completed,
			lesson: runtime.lesson,
			step: runtime.step,
		}))
		if (runtime.completed.every(Boolean))
			window.localStorage.setItem(COMPLETE_KEY, "1")
	} catch (error) {}
}

function lesson_markup(lesson) {
	return "<button type=\"button\" class=\"academy-lesson\" data-academy-lesson=\"" + lesson.id + "\">" +
		"<span class=\"academy-lesson-number\">" + lesson.id + "</span>" +
		"<span><b>" + lesson.short + "</b><small>" + lesson.summary + "</small></span>" +
		"<i aria-hidden=\"true\">✓</i>" +
	"</button>"
}

function build() {
	root = document.createElement("div")
	root.id = "pog_academy"
	root.hidden = true
	root.setAttribute("role", "dialog")
	root.setAttribute("aria-modal", "true")
	root.setAttribute("aria-labelledby", "academy_title")
	root.innerHTML =
		"<div class=\"academy-shell\">" +
			"<div class=\"academy-header\" role=\"banner\"><div class=\"academy-brand\"><span>✦</span><div><small>PATHS OF GLORY ACADEMY</small><b id=\"academy_title\">光荣之路 · 新手军校</b></div></div>" +
			"<div class=\"academy-xp\"><span>军校经验</span><b id=\"academy_xp\">0 / 400</b><i><u id=\"academy_xp_bar\"></u></i></div>" +
			"<button type=\"button\" id=\"academy_close\" aria-label=\"关闭军校\">×</button></div>" +
			"<div class=\"academy-layout\">" +
				"<nav id=\"academy_lessons\" class=\"academy-lessons\">" + LESSONS.map(lesson_markup).join("") + "</nav>" +
				"<div class=\"academy-main\" role=\"main\">" +
					"<section id=\"academy_home\" class=\"academy-home\">" +
						"<div class=\"academy-home-copy\"><small>四节课 · 一场胜利</small><h1>不要先背规则。<br>先亲手赢一次。</h1><p>你将指挥德军沿科布伦茨—列日—布鲁塞尔推进。每一步只开放一个正确目标，学会后立刻得到反馈。</p>" +
						"<div class=\"academy-promise\"><span>约 8 分钟</span><span>13 次亲手操作</span><span>结课开启真实战役</span></div>" +
						"<button type=\"button\" id=\"academy_start\">开始第一课</button><button type=\"button\" id=\"academy_reset\">重新开始课程</button></div>" +
						"<div class=\"academy-home-map\"><div class=\"academy-home-route\"><span>科布伦茨</span><i>→</i><span>列日</span><i>→</i><strong>布鲁塞尔</strong></div><div class=\"academy-medal\"><i aria-hidden=\"true\">✦</i><b>你的第一个小目标</b><span>攻克布鲁塞尔</span></div></div>" +
					"</section>" +
					"<section id=\"academy_field\" class=\"academy-field\" hidden>" +
						"<div class=\"academy-stage\">" +
							"<div class=\"academy-stage-head\"><span id=\"academy_chapter\">第 1 课</span><b id=\"academy_stage_title\"></b><small id=\"academy_step_count\"></small></div>" +
							"<div id=\"academy_board\" class=\"academy-board\">" +
								"<div class=\"academy-front-label\">1914 · 西线训练战场</div><div class=\"academy-path path-one\"></div><div class=\"academy-path path-two\"></div>" +
								"<button type=\"button\" class=\"academy-city friendly\" data-academy-target=\"koblenz\" data-city=\"koblenz\"><small>德国</small><b>科布伦茨</b><span>KOBLENZ</span></button>" +
								"<button type=\"button\" class=\"academy-city contested\" data-academy-target=\"liege\" data-city=\"liege\"><small>比利时</small><b>列日</b><span>LIEGE</span><i id=\"academy_fort\">要塞 1</i></button>" +
								"<button type=\"button\" class=\"academy-city enemy\" data-academy-target=\"brussels\" data-city=\"brussels\"><small>目标 · 1 VP</small><b>布鲁塞尔</b><span>BRUSSELS</span><i class=\"academy-objective-flag\">⚑</i></button>" +
								"<div id=\"academy_armies\" class=\"academy-armies at-koblenz\"><span>GE 1</span><span>GE 2</span><b>战力 5</b></div>" +
								"<div id=\"academy_enemy\" class=\"academy-enemy-unit\"><span>BE</span><b>战力 2</b></div>" +
								"<div id=\"academy_dice\" class=\"academy-dice\" hidden><small>战斗骰</small><b>–</b></div>" +
							"</div>" +
							"<button type=\"button\" id=\"academy_flow_card\" class=\"academy-flow-card\" data-academy-target=\"flow\"><span>一个行动怎么走</span><b>① 选牌 → ② 选用途 → ③ 地图执行 → ④ 结算</b></button>" +
							"<div id=\"academy_hand\" class=\"academy-training-hand\" hidden><small>训练手牌</small><button type=\"button\" id=\"academy_guns_card\" data-academy-target=\"guns_card\"><i>3</i><b>八月炮火</b><span>摧毁列日要塞，打开通往比利时的道路。</span><em>SR 4 · 战争状态 +2</em></button></div>" +
							"<div id=\"academy_orders\" class=\"academy-orders\" hidden><button type=\"button\" data-academy-target=\"event_order\"><b>事件</b><span>执行卡面历史效果</span></button><button type=\"button\" data-academy-target=\"move_order\"><b>移动</b><span>将部队推进到相邻地区</span></button><button type=\"button\" data-academy-target=\"attack_order\"><b>进攻</b><span>攻击相邻敌军</span></button></div>" +
							"<div id=\"academy_resolve_zone\" class=\"academy-resolve-zone\"><button type=\"button\" data-academy-target=\"resolve_event\">执行八月炮火</button><button type=\"button\" data-academy-target=\"roll\">掷战斗骰</button><button type=\"button\" data-academy-target=\"advance\">推进并占领布鲁塞尔</button></div>" +
						"</div>" +
						"<section class=\"academy-brief\"><div class=\"academy-brief-progress\"><span id=\"academy_microdots\"></span><b id=\"academy_reward\"></b></div><small>现在只做一件事</small><h2 id=\"academy_task\"></h2><p id=\"academy_do\"></p><div class=\"academy-why\"><b>为什么？</b><p id=\"academy_why\"></p></div><button type=\"button\" id=\"academy_hint\">帮我指出要点哪里</button><div id=\"academy_feedback\" class=\"academy-feedback\" aria-live=\"polite\"></div><div id=\"academy_complete\" class=\"academy-complete\" hidden></div></section>" +
					"</section>" +
				"</div>" +
			"</div>" +
		"</div>"
	document.body.appendChild(root)

	root.addEventListener("click", on_click)
	root.querySelector("#academy_close").addEventListener("click", close)
	root.querySelector("#academy_start").addEventListener("click", start_next_lesson)
	root.querySelector("#academy_reset").addEventListener("click", reset_course)
	root.querySelector("#academy_hint").addEventListener("click", point_to_target)
	document.addEventListener("keydown", function (event) {
		if (event.key === "Escape" && root && !root.hidden) close()
	})
	load_progress()
	render_home()
}

function current_lesson() {
	return LESSONS[runtime.lesson - 1]
}

function current_step() {
	return current_lesson().steps[runtime.step]
}

function progress_points() {
	var completed = runtime.completed.filter(Boolean).length * 100
	if (!runtime.completed[runtime.lesson - 1] && runtime.screen === "field")
		completed += Math.round(100 * runtime.step / current_lesson().steps.length)
	return Math.min(400, completed)
}

function next_incomplete() {
	var index = runtime.completed.indexOf(false)
	return index < 0 ? 4 : index + 1
}

function configure_for_lesson(number) {
	runtime.objectiveSeen = number > 1
	runtime.cardSelected = false
	runtime.eventChosen = false
	runtime.fortDestroyed = number > 2
	runtime.selectedSpace = ""
	runtime.order = ""
	runtime.unitsAt = number > 3 ? "liege" : "koblenz"
	runtime.targeted = false
	runtime.roll = 0
	runtime.enemyDefeated = false
	runtime.victory = false
}

function restore_effects(number, step) {
	configure_for_lesson(number)
	var steps = LESSONS[number - 1].steps
	for (var i = 0; i < Math.min(step, steps.length); ++i)
		apply_effect(steps[i].effect, true)
}

function render_home() {
	if (!root) return
	runtime.screen = "home"
	root.dataset.screen = "home"
	root.querySelector("#academy_home").hidden = false
	root.querySelector("#academy_field").hidden = true
	var next = next_incomplete()
	var all_done = runtime.completed.every(Boolean)
	var can_resume = !all_done && runtime.lesson === next && runtime.step > 0
	root.querySelector("#academy_start").textContent = all_done ? "重打第四课" : (can_resume ? "继续第 " + next + " 课 · 操作 " + (runtime.step + 1) : "开始第 " + next + " 课")
	root.querySelector("#academy_reset").hidden = !runtime.completed.some(Boolean) && runtime.step === 0
	update_nav()
	update_xp()
}

function update_nav() {
	var unlocked = next_incomplete()
	for (var button of root.querySelectorAll("[data-academy-lesson]")) {
		var number = Number(button.dataset.academyLesson)
		button.classList.toggle("completed", runtime.completed[number - 1])
		button.classList.toggle("current", runtime.screen === "field" && number === runtime.lesson)
		button.disabled = number > unlocked && !runtime.completed[number - 1]
	}
}

function update_xp() {
	var points = progress_points()
	root.querySelector("#academy_xp").textContent = points + " / 400"
	root.querySelector("#academy_xp_bar").style.width = points / 4 + "%"
}

function start_next_lesson() {
	var next = next_incomplete()
	if (runtime.lesson === next && runtime.step > 0 && runtime.step < LESSONS[next - 1].steps.length) {
		runtime.screen = "field"
		runtime.chapterComplete = false
		restore_effects(next, runtime.step)
		root.dataset.screen = "field"
		root.querySelector("#academy_home").hidden = true
		root.querySelector("#academy_field").hidden = false
		render_field()
	} else {
		start_lesson(next)
	}
}

function start_lesson(number, replay) {
	var unlocked = next_incomplete()
	if (!replay && number > unlocked && !runtime.completed[number - 1]) return
	runtime.screen = "field"
	runtime.lesson = number
	runtime.step = 0
	runtime.chapterComplete = false
	configure_for_lesson(number)
	root.dataset.screen = "field"
	root.querySelector("#academy_home").hidden = true
	root.querySelector("#academy_field").hidden = false
	save_progress()
	render_field()
}

function render_field() {
	var lesson = current_lesson()
	var step = lesson.steps[Math.min(runtime.step, lesson.steps.length - 1)]
	root.dataset.lesson = runtime.lesson
	root.querySelector("#academy_chapter").textContent = "第 " + runtime.lesson + " 课"
	root.querySelector("#academy_stage_title").textContent = lesson.title
	root.querySelector("#academy_step_count").textContent = "操作 " + Math.min(runtime.step + 1, lesson.steps.length) + " / " + lesson.steps.length
	root.querySelector("#academy_reward").textContent = "奖励 · " + lesson.reward

	var dots = ""
	for (var i = 0; i < lesson.steps.length; ++i)
		dots += "<i class=\"" + (i < runtime.step ? "done" : (i === runtime.step ? "current" : "")) + "\"></i>"
	root.querySelector("#academy_microdots").innerHTML = dots

	root.querySelector("#academy_task").textContent = step.title
	root.querySelector("#academy_do").textContent = step.do
	root.querySelector("#academy_why").textContent = step.why
	root.querySelector("#academy_complete").hidden = true
	root.querySelector("#academy_hint").hidden = false

	var flow = root.querySelector("#academy_flow_card")
	var hand = root.querySelector("#academy_hand")
	var orders = root.querySelector("#academy_orders")
	flow.hidden = runtime.lesson !== 1
	hand.hidden = runtime.lesson !== 2
	orders.hidden = runtime.lesson < 2
	for (var button of orders.querySelectorAll("button")) button.hidden = true
	if (runtime.lesson === 2) orders.querySelector("[data-academy-target=event_order]").hidden = false
	if (runtime.lesson === 3) orders.querySelector("[data-academy-target=move_order]").hidden = false
	if (runtime.lesson === 4) orders.querySelector("[data-academy-target=attack_order]").hidden = false

	for (var action of root.querySelectorAll("#academy_resolve_zone button")) action.hidden = true
	if (step.target === "resolve_event") root.querySelector("[data-academy-target=resolve_event]").hidden = false
	if (step.target === "roll") root.querySelector("[data-academy-target=roll]").hidden = false
	if (step.target === "advance") root.querySelector("[data-academy-target=advance]").hidden = false

	for (var target of root.querySelectorAll("[data-academy-target]"))
		target.classList.toggle("academy-target", target.dataset.academyTarget === step.target)

	render_scenario()
	update_nav()
	update_xp()
}

function render_scenario() {
	var board = root.querySelector("#academy_board")
	board.classList.toggle("objective-seen", runtime.objectiveSeen)
	board.classList.toggle("fort-destroyed", runtime.fortDestroyed)
	board.classList.toggle("enemy-defeated", runtime.enemyDefeated)
	board.classList.toggle("victory", runtime.victory)
	board.dataset.selected = runtime.selectedSpace
	board.dataset.order = runtime.order
	root.querySelector("#academy_armies").className = "academy-armies at-" + runtime.unitsAt
	root.querySelector("#academy_guns_card").classList.toggle("selected", runtime.cardSelected)
	root.querySelector("[data-academy-target=event_order]").classList.toggle("selected", runtime.eventChosen)
	root.querySelector("[data-academy-target=move_order]").classList.toggle("selected", runtime.order === "move")
	root.querySelector("[data-academy-target=attack_order]").classList.toggle("selected", runtime.order === "attack")
	var dice = root.querySelector("#academy_dice")
	dice.hidden = runtime.roll === 0
	dice.querySelector("b").textContent = runtime.roll || "–"
}

function on_click(event) {
	var lesson_button = event.target.closest("[data-academy-lesson]")
	if (lesson_button) {
		start_lesson(Number(lesson_button.dataset.academyLesson), true)
		return
	}
	var target = event.target.closest("[data-academy-target]")
	if (!target || runtime.screen !== "field" || runtime.chapterComplete) return
	handle_target(target.dataset.academyTarget)
}

function handle_target(key) {
	var step = current_step()
	if (key !== step.target) {
		show_feedback("先完成右侧的小目标：" + step.do, false)
		root.classList.remove("academy-shake")
		void root.offsetWidth
		root.classList.add("academy-shake")
		return
	}
	apply_effect(step.effect, false)
	show_feedback("✓ " + step.done, true)
	render_scenario()
	setTimeout(function () {
		++runtime.step
		if (runtime.step >= current_lesson().steps.length)
			finish_lesson()
		else {
			save_progress()
			render_field()
			focus_current_target()
		}
	}, 620)
}

function focus_current_target() {
	if (!window.matchMedia || !window.matchMedia("(max-width: 800px)").matches) return
	var target = root.querySelector("[data-academy-target=\"" + current_step().target + "\"]")
	if (!target) return
	setTimeout(function () {
		var rect = target.getBoundingClientRect()
		if (rect.top < 116 || rect.bottom > window.innerHeight - 12) {
			try { target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" }) } catch (error) {}
		}
	}, 70)
}

function apply_effect(effect, silent) {
	switch (effect) {
	case "objective": runtime.objectiveSeen = true; break
	case "flow": break
	case "select_card": runtime.cardSelected = true; break
	case "choose_event": runtime.eventChosen = true; break
	case "resolve_event": runtime.fortDestroyed = true; break
	case "select_koblenz": runtime.selectedSpace = "koblenz"; break
	case "choose_move": runtime.order = "move"; break
	case "move_liege": runtime.unitsAt = "liege"; runtime.selectedSpace = ""; runtime.order = ""; break
	case "select_attackers": runtime.selectedSpace = "liege"; break
	case "choose_attack": runtime.order = "attack"; break
	case "target_brussels": runtime.targeted = true; break
	case "roll_combat": runtime.roll = 6; runtime.enemyDefeated = true; break
	case "advance_victory": runtime.unitsAt = "brussels"; runtime.victory = true; break
	}
}

function finish_lesson() {
	runtime.completed[runtime.lesson - 1] = true
	runtime.chapterComplete = true
	runtime.step = current_lesson().steps.length
	save_progress()
	update_nav()
	update_xp()
	var box = root.querySelector("#academy_complete")
	root.querySelector("#academy_hint").hidden = true
	box.hidden = false
	if (runtime.lesson < 4) {
		box.innerHTML = "<span class=\"academy-reward-icon\">✦</span><small>第 " + runtime.lesson + " 课完成</small><h2>获得“" + current_lesson().reward + "”</h2><p>你已经学会：" + current_lesson().summary + "</p><button type=\"button\" id=\"academy_next\">进入第 " + (runtime.lesson + 1) + " 课</button>"
		box.querySelector("#academy_next").addEventListener("click", function () { start_lesson(runtime.lesson + 1) })
	} else {
		box.innerHTML = "<span class=\"academy-reward-icon victory\">★</span><small>教学战役胜利</small><h2>你已攻克布鲁塞尔</h2><p>现在你会看目标、打牌、移动、进攻和推进。下一局会使用完整规则，但“新手陪玩”会继续每次只告诉你当前一步。</p><ul><li>4 节课程完成</li><li>13 次亲手操作</li><li>400 / 400 军校经验</li></ul><button type=\"button\" id=\"academy_real_game\">开启我的第一局</button><button type=\"button\" id=\"academy_stay\">稍后再开，回到当前游戏</button>"
		box.querySelector("#academy_real_game").addEventListener("click", start_real_game)
		box.querySelector("#academy_stay").addEventListener("click", close)
	}
	if (window.matchMedia && window.matchMedia("(max-width: 800px)").matches)
		setTimeout(function () { try { box.scrollIntoView({ block: "center", behavior: "smooth" }) } catch (error) {} }, 80)
}

function show_feedback(message, good) {
	var box = root.querySelector("#academy_feedback")
	box.textContent = message
	box.className = "academy-feedback " + (good ? "good" : "bad")
	clearTimeout(feedbackTimer)
	feedbackTimer = setTimeout(function () { box.className = "academy-feedback" }, 1900)
}

function point_to_target() {
	var target = root.querySelector("[data-academy-target=\"" + current_step().target + "\"]")
	if (!target) return
	target.classList.remove("academy-point")
	void target.offsetWidth
	target.classList.add("academy-point")
	try { target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" }) } catch (error) {}
	show_feedback("金色脉冲的位置就是下一步。", true)
}

function reset_course() {
	if (!window.confirm("要清空军校进度并从第一课重新开始吗？")) return
	runtime.completed = [ false, false, false, false ]
	runtime.lesson = 1
	runtime.step = 0
	runtime.chapterComplete = false
	try {
		window.localStorage.removeItem(PROGRESS_KEY)
		window.localStorage.removeItem(COMPLETE_KEY)
	} catch (error) {}
	start_lesson(1)
}

function start_real_game() {
	var has_save = false
	try { has_save = Boolean(window.localStorage.getItem("pog_local_save")) } catch (error) {}
	if (has_save && !window.confirm("开启第一局会覆盖当前单机存档。确定开始吗？")) return
	try {
		window.localStorage.setItem(COMPLETE_KEY, "1")
		window.localStorage.setItem(COACH_KEY, "1")
	} catch (error) {}
	var query = new URLSearchParams()
	query.set("game", "local")
	query.set("new", "1")
	query.set("scenario", "Historical")
	query.set("role", "Central Powers")
	query.set("ai", "bfull")
	query.set("coach", "1")
	query.set("seed", "191408")
	window.location.href = "play.html?" + query.toString()
}

function open() {
	if (!root) return
	if (window.POG_UI && typeof window.POG_UI.close === "function") window.POG_UI.close()
	var old = document.getElementById("hq_tutorial")
	if (old) old.hidden = true
	render_home()
	root.hidden = false
	document.body.classList.add("pog-academy-open")
}

function close() {
	if (!root) return
	root.hidden = true
	document.body.classList.remove("pog-academy-open")
	save_progress()
}

window.POG_ACADEMY = {
	open: open,
	close: close,
	startRealGame: start_real_game,
}

window.addEventListener("load", build)

})()
