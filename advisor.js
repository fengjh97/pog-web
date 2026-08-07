"use strict"

/* 光荣之路 · 参谋部
 * 1) 用中文解读当前阶段：现在要做什么、规则要点
 * 2) 调用 AI 评估引擎为玩家计算建议着法，可一键照做
 * 纯 UI 层：读取全局 view / cards / data，执行走子只通过 send_action。
 */

;(function () {

var MOBILE_MQ = window.matchMedia("(max-width: 800px)")

/* ---------- 阶段解读词典（按原始英文 prompt / 可用动作匹配） ---------- */

var HINTS = [
	{
		test: function (p, a) { return /Mandated offensive|No mandated offensive|French Mutiny \(instead/.test(p) },
		title: "回合开始 · 强制攻势",
		text: "每回合开始双方掷骰决定「强制攻势」目标国。本回合内你必须用该国部队发起至少一次进攻，否则回合结束时扣 1 VP。记住目标，点「下一步」继续。",
	},
	{
		test: function (p, a) { return a.play_ops !== undefined || a.play_event !== undefined },
		title: "行动轮 · 打一张牌",
		text: "每回合你有 6 个行动，每个行动打一张手牌，四种用法选一：①事件（执行卡上效果，带*的打完移除）②行动点 OPS（激活空间移动/进攻，最常用）③战略调动 SR（远距离调兵）④补充点 RP（存起来重建部队）。点卡牌后在弹窗里选用法。前期缺兵时 OPS 优先；强力事件（如战争加入国）值得打事件。",
	},
	{
		test: function (p, a) { return /Activate spaces/.test(p) },
		title: "激活空间",
		text: "花 OPS 点选要行动的空间：激活后选「移动」或「进攻」。激活含集团军的空间花 1 点（每个超过1个集团军的+1），只有军的空间花 1 点。OPS 用不完可提前结束。",
	},
	{
		test: function (p, a) { return /^Move units|^Move .* from|spaces activated for movement/.test(p) },
		title: "移动",
		text: "点选已激活空间的部队，再点目的地逐格移动。集团军走 3 格、军走 4 格（俄军 3）。每个空间最多叠 3 个部队。进入敌方控制空间会翻转控制权但必须停下。",
	},
	{
		test: function (p, a) { return /Choose units and a space to attack/.test(p) },
		title: "宣布进攻",
		text: "点选进攻部队（可多个相邻空间夹击同一目标），再点目标空间。比较双方战力（CF）定赔率查表掷骰，损失看火力表。带堑壕/要塞的目标很硬——尽量凑高赔率或多路夹击。",
	},
	{
		test: function (p, a) { return /^Attack s\d+ with/.test(p) },
		title: "确认进攻",
		text: "这里显示本次进攻的兵力对比。确认后掷骰结算：双方按各自火力表承受步损，损失大的一方可能被迫撤退。不划算就点撤销重选。",
	},
	{
		test: function (p, a) { return /combat cards/.test(p) && !/discard/.test(p) },
		title: "战斗牌",
		text: "标红 CC 的手牌可以在战斗时打出增强效果（如 +1 骰子修正、取消堑壕）。用了就弃掉，不用可以留。没有合适的就点「跳过」。",
	},
	{
		test: function (p, a) { return /flank attack/.test(p) },
		title: "侧翼攻击",
		text: "从两个以上不同空间进攻时可尝试侧翼：掷骰成功则防守方先受损、还可能无法全额还击；失败则你按不利结算。提示里有成功所需点数，稳妥起见低成功率别赌。",
	},
	{
		test: function (p, a) { return /Take losses/.test(p) },
		title: "承受损失",
		text: "点部队吃步损：满编集团军翻面成减员，再受损就换成军（去预备箱可重建）。军再受损即被消灭。优先让集团军翻面吃损，别轻易让部队全灭。",
	},
	{
		test: function (p, a) { return /Retreat|retreat/.test(p) && a.retreat !== undefined || /^Retreat/.test(p) },
		title: "撤退",
		text: "战败方按要求撤退相应格数，不能进敌控/满员空间；无路可退的部队被消灭。可以选择额外吃 1 步损来取消撤退（阵地关键时值得）。",
	},
	{
		test: function (p, a) { return /You may advance/.test(p) },
		title: "胜利推进",
		text: "进攻获胜且守军撤退/被歼后，可以把参战部队推进占领目标空间（夺 VP 空间、切补给的好机会）。不想推进就点「停止」。",
	},
	{
		test: function (p, a) { return /Strategic Redeployment/.test(p) },
		title: "战略调动 (SR)",
		text: "用 SR 点把部队沿己方控制且连通的空间做远距离转移（军 1 点/集团军 4 点）。前线告急时用来抽调预备队。点数用完或不想调了就结束。",
	},
	{
		test: function (p, a) { return /Replacement|Landwehr/.test(p) || a.end_rp !== undefined },
		title: "补充阶段 (RP)",
		text: "回合末用攒下的各国 RP：把减员部队翻回满编（1点）或从预备箱重建被歼的集团军（先回场再翻面）。RP 分国籍，德国的点只能补德军。",
	},
	{
		test: function (p, a) { return /Reinforcements/.test(p) },
		title: "放置增援",
		text: "把新到的部队放上地图：一般放在本国的补给源/指定城市。放不下的可以晚点再上。",
	},
	{
		test: function (p, a) { return /entrench|Entrench/.test(p) },
		title: "构筑堑壕",
		text: "留在原地的集团军可尝试挖堑壕（掷骰）：1级堑壕让进攻方损失表降档，2级更硬。西线相持的核心——法比边境挖起来。",
	},
	{
		test: function (p, a) { return /supply|Attrition|OOS/.test(p) },
		title: "补给与消耗",
		text: "部队必须能沿己方控制空间连回补给源（德奥回本土、协约回伦敦/彼得格勒等）。断补给的部队消耗阶段会被移除——进攻时也要小心自己的退路被切。",
	},
	{
		test: function (p, a) { return /discard combat cards/.test(p) },
		title: "弃置战斗牌",
		text: "抽新牌前可以把用不上的战斗牌弃掉换抽牌空间。留下确实打算用的即可。",
	},
	{
		test: function (p, a) { return /besieged forts|siege/.test(p) },
		title: "围城要塞",
		text: "绕过的敌方要塞需要留部队围困，围城阶段掷骰尝试攻破。要塞不破会威胁你的补给线。",
	},
	{
		test: function (p, a) { return /Waiting for/.test(p) },
		title: "等待对手",
		text: "AI 正在行动。你可以打开战报看它做了什么，或查看战分总览评估局势。",
	},
	{
		test: function (p, a) { return /game over|wins|Draw/.test(p) },
		title: "对局结束",
		text: "看看战分总览复盘。VP > 10 同盟国胜，< 10 协约国胜。",
	},
]

var DEFAULT_HINT = {
	title: "当前阶段",
	text: "按提示条操作：地图上高亮的空间/部队可以点，上方按钮是可用动作。拿不准就点「参谋建议」让我算一步。",
}

/* ---------- 动作描述 ---------- */

var VERB_ZH = {
	card: "点选卡牌", play_event: "作为【事件】打出", play_ops: "用作【行动点 OPS】",
	play_sr: "用作【战略调动】", play_rps: "用作【补充点】",
	space: "点选空间", piece: "点选单位", attack: "发起进攻",
	next: "下一步", done: "完成", pass: "放弃", skip: "跳过",
	eliminate: "消灭该单位", retreat: "撤退", entrench: "构筑堑壕",
	flank: "尝试侧翼攻击", use: "使用", accept: "接受", reject: "拒绝",
	single_op: "自动行动", select_all: "全选", stop: "停止", no_attack: "不进攻",
	end_action: "结束本行动", end_rp: "结束补充阶段", end_sr: "结束调动",
	activate_move: "激活以移动", activate_attack: "激活以进攻",
	confirm_end_sr: "确认结束调动", confirm_end_rp: "确认结束补充",
	confirm_pass_attack: "确认放弃进攻", confirm_mutiny_attack: "确认进攻",
	confirm_odd_entrench: "确认构筑", reset_phase: "重置阶段",
}

function describe_noun(verb, noun) {
	if (noun === undefined || noun === null)
		return ""
	try {
		if (verb === "card" || verb.indexOf("play_") === 0) {
			var c = cards[noun]
			return "「" + c.name + "」(" + c.ops + " OPS)"
		}
		if (verb === "space" || verb === "attack") {
			var s = data.spaces[noun]
			return s ? s.name : "#" + noun
		}
		if (verb === "piece" || verb === "eliminate" || verb === "retreat") {
			var pc = data.pieces[noun]
			return pc ? pc.name : "#" + noun
		}
	} catch (e) {}
	return String(noun)
}

function describe_suggestion(sug) {
	var v = VERB_ZH[sug.verb] || sug.verb
	var n = describe_noun(sug.verb, sug.noun)
	var text = v + (n ? "：" + n : "")
	if (sug.verb === "card")
		text += " —— 点它之后弹窗里选用法"
	return text
}

/* ---------- UI ---------- */

var panel = null
var last_prompt = ""
var pending_sug = null

function build_panel() {
	panel = document.createElement("div")
	panel.id = "hq_advisor"
	panel.innerHTML =
		"<div class=\"adv_head\">" +
			"<span class=\"adv_star\">✦</span> 参谋部" +
			"<button class=\"adv_x\" type=\"button\">✕</button>" +
		"</div>" +
		"<div class=\"adv_body\">" +
			"<div class=\"adv_hint\"><b></b><p></p></div>" +
			"<div class=\"adv_sug\">" +
				"<button class=\"adv_ask\" type=\"button\">🎖 参谋建议</button>" +
				"<div class=\"adv_result\" hidden>" +
					"<div class=\"adv_result_text\"></div>" +
					"<button class=\"adv_do\" type=\"button\">照建议执行</button>" +
				"</div>" +
			"</div>" +
		"</div>"
	document.body.appendChild(panel)

	panel.querySelector(".adv_x").addEventListener("click", function () {
		document.body.classList.remove("hq-advisor-open")
	})
	panel.querySelector(".adv_ask").addEventListener("click", compute_suggestion)
	panel.querySelector(".adv_do").addEventListener("click", function () {
		if (pending_sug && typeof send_action === "function") {
			send_action(pending_sug.verb, pending_sug.noun)
			hide_result()
		}
	})

	// 桌面端：常驻切换钮
	if (!MOBILE_MQ.matches) {
		var toggle = document.createElement("button")
		toggle.id = "hq_advisor_toggle"
		toggle.type = "button"
		toggle.textContent = "✦ 参谋"
		toggle.addEventListener("click", function () {
			document.body.classList.toggle("hq-advisor-open")
		})
		document.body.appendChild(toggle)
	}
}

function add_dock_button() {
	var dock = document.getElementById("hq_dock")
	if (!dock)
		return
	var hand = document.getElementById("hq_hand_btn")
	var b = document.createElement("button")
	b.type = "button"
	b.id = "hq_advisor_btn"
	b.innerHTML = "参谋<small>STAFF</small>"
	b.addEventListener("click", function () {
		document.body.classList.remove("hq-hand-open")
		document.body.classList.toggle("hq-advisor-open")
	})
	dock.insertBefore(b, hand)
}

function hide_result() {
	pending_sug = null
	if (panel)
		panel.querySelector(".adv_result").hidden = true
}

function compute_suggestion() {
	var ask = panel.querySelector(".adv_ask")
	ask.disabled = true
	ask.textContent = "推演中…"
	setTimeout(function () {
		var sug = null
		try {
			sug = window.pog_suggest ? window.pog_suggest() : null
		} catch (e) {
			console.error(e)
		}
		ask.disabled = false
		ask.textContent = "🎖 参谋建议"
		var box = panel.querySelector(".adv_result")
		var txt = panel.querySelector(".adv_result_text")
		box.hidden = false
		if (!sug || sug.waiting) {
			txt.textContent = "现在轮到对方行动，稍候。"
			panel.querySelector(".adv_do").hidden = true
			pending_sug = null
		} else if (sug.over) {
			txt.textContent = "对局已结束。"
			panel.querySelector(".adv_do").hidden = true
			pending_sug = null
		} else {
			txt.textContent = "建议：" + describe_suggestion(sug) +
				(sug.n_options > 1 ? "（从 " + sug.n_options + " 个合法选项中推演选出）" : "（当前唯一选项）")
			panel.querySelector(".adv_do").hidden = false
			pending_sug = sug
		}
	}, 30)
}

function refresh_hint() {
	if (!panel || typeof view === "undefined" || !view)
		return
	var p = String(view.prompt || "")
	if (p === last_prompt)
		return
	last_prompt = p
	hide_result()
	var a = view.actions || {}
	var hint = DEFAULT_HINT
	for (var i = 0; i < HINTS.length; ++i) {
		try {
			if (HINTS[i].test(p, a)) { hint = HINTS[i]; break }
		} catch (e) {}
	}
	panel.querySelector(".adv_hint b").textContent = hint.title
	panel.querySelector(".adv_hint p").textContent = hint.text
}

window.addEventListener("load", function () {
	build_panel()
	// 手机 dock 由 mobile.js 建，稍等一拍再挂按钮
	setTimeout(add_dock_button, 100)
	setInterval(refresh_hint, 700)
	// 桌面默认展开参谋面板；手机默认收起
	if (!MOBILE_MQ.matches)
		document.body.classList.add("hq-advisor-open")
})

})()
