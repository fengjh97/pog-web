"use strict"

/* 光荣之路 · 移动端指挥坞
 * 地区快速切换 / 手牌抽屉 / 日志抽屉 / 中文卡面渲染。
 * 只增强 UI，不触碰引擎与规则逻辑；桌面端（>800px）指挥坞由 CSS 隐藏。
 */

;(function () {

var MOBILE_MQ = window.matchMedia("(max-width: 800px)")

/* 地区锚点：地图坐标系 2550×1650（layout.js 同系） */
var REGIONS = [
	{ key: "west",    zh: "西线",   en: "WEST",    x: 460,  y: 660 },
	{ key: "east",    zh: "东线",   en: "EAST",    x: 1350, y: 420 },
	{ key: "italy",   zh: "意大利", en: "ITALY",   x: 880,  y: 1180 },
	{ key: "balkans", zh: "巴尔干", en: "BALKANS", x: 1330, y: 1030 },
	{ key: "neareast",zh: "近东",   en: "NEAR E.", x: 2050, y: 1250 },
]

var MAP_W = 2550

function $(sel) { return document.querySelector(sel) }

/* ---------- 指挥坞 DOM ---------- */

function build_dock() {
	var dock = document.createElement("div")
	dock.id = "hq_dock"

	var regions = document.createElement("div")
	regions.className = "hq_regions"
	REGIONS.forEach(function (r) {
		var b = document.createElement("button")
		b.type = "button"
		b.innerHTML = r.zh + "<small>" + r.en + "</small>"
		b.addEventListener("click", function () { jump_to_region(r) })
		regions.appendChild(b)
	})
	var fit = document.createElement("button")
	fit.type = "button"
	fit.innerHTML = "全图<small>MAP</small>"
	fit.addEventListener("click", function () {
		close_sheets()
		if (typeof toggle_zoom === "function")
			toggle_zoom()
	})
	regions.appendChild(fit)
	dock.appendChild(regions)

	var sep = document.createElement("div")
	sep.className = "hq_sep"
	dock.appendChild(sep)

	var hand = document.createElement("button")
	hand.type = "button"
	hand.id = "hq_hand_btn"
	hand.innerHTML = "手牌<small>CARDS</small><span class=\"badge\" hidden>0</span>"
	hand.addEventListener("click", function () {
		document.body.classList.remove("hq-log-open")
		hide_aside()
		document.body.classList.toggle("hq-hand-open")
	})
	dock.appendChild(hand)

	var log = document.createElement("button")
	log.type = "button"
	log.innerHTML = "战报<small>LOG</small>"
	log.addEventListener("click", function () {
		document.body.classList.remove("hq-hand-open")
		var aside = $("aside")
		if (document.body.classList.contains("hq-log-open")) {
			document.body.classList.remove("hq-log-open")
			aside.hidden = true
		} else {
			document.body.classList.add("hq-log-open")
			aside.hidden = false
			var logdiv = document.getElementById("log")
			if (logdiv)
				logdiv.scrollTop = logdiv.scrollHeight
		}
	})
	dock.appendChild(log)

	document.body.appendChild(dock)
}

function hide_aside() {
	if (MOBILE_MQ.matches) {
		var aside = $("aside")
		if (aside && document.body.classList.contains("hq-log-open") === false)
			aside.hidden = true
	}
}

function close_sheets() {
	document.body.classList.remove("hq-hand-open")
	if (document.body.classList.contains("hq-log-open")) {
		document.body.classList.remove("hq-log-open")
		var aside = $("aside")
		if (aside) aside.hidden = true
	}
}

/* ---------- 地区跳转 ---------- */

function current_scale(main) {
	// 客户端有两套缩放：e_inner 的 transform 缩放 与 mapwrap 的 map-fit 缩放
	var s = 1
	var el = main.querySelector("[data-scale]")
	while (el) {
		s *= Number(el.dataset.scale) || 1
		el = el.querySelector("[data-scale]")
	}
	return s
}

function jump_to_region(r) {
	close_sheets()
	var main = $("main")
	if (!main)
		return
	var scale = current_scale(main)
	// 若当前是全图缩放（比例太小），先恢复 1:1 再定位
	if (scale < 0.55 && typeof toggle_zoom === "function") {
		var guard = 0
		while (scale < 0.98 && guard++ < 3) {
			toggle_zoom()
			scale = current_scale(main)
		}
	}
	main.scrollTo({
		left: Math.max(0, r.x * scale - main.clientWidth / 2),
		top: Math.max(0, r.y * scale - main.clientHeight / 2),
		behavior: "smooth",
	})
}

/* ---------- 中文卡面 ---------- */

function esc(s) {
	return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function card_art_url(c) {
	// 与 images.css 的映射一致: card_ap_1 → cards.2x/card_ap_01.avif
	var faction = c <= 65 ? "ap" : "cp"
	var num = c <= 65 ? c : c - 65
	return "cards.2x/card_" + faction + "_" + (num < 10 ? "0" + num : num) + ".avif"
}

function zhface_html(c) {
	var card = (typeof cards !== "undefined") ? cards[c] : null
	if (!card)
		return ""
	var fx = (window.CARD_FX_ZH && window.CARD_FX_ZH[c]) || ""
	var name_zh = card.name
	var name_en = card.name_en || ""
	var bot = "SR " + card.sr
	if (card.ws)
		bot += " · 战争状态 +" + card.ws
	var cc_html = card.cc ? "<span class=\"cc\">战斗牌</span>" : ""
	var rm_html = card.remove ? "<span class=\"rm\">打出后移除</span>" : ""
	return "<div class=\"zh_top\">" +
			"<div class=\"zh_ops\"><span>" + card.ops + "</span></div>" +
			"<div class=\"zh_name\"><b>" + esc(name_zh) + "</b><i>" + esc(name_en) + "</i></div>" +
		"</div>" +
		"<div class=\"zh_art\" style=\"background-image:url('" + card_art_url(c) + "')\"></div>" +
		"<div class=\"zh_fx\">" + esc(fx) + "</div>" +
		"<div class=\"zh_bot\">" + bot + " " + cc_html + rm_html + "</div>"
}

function inject_zhfaces() {
	if (typeof cards === "undefined")
		return
	for (var c = 1; c < cards.length; ++c) {
		var el = cards[c] && cards[c].element
		if (!el || el.querySelector(".zhface"))
			continue
		var face = document.createElement("div")
		face.className = "zhface"
		face.innerHTML = zhface_html(c)
		el.appendChild(face)
	}
}

/* 弹出的卡牌操作菜单顶部注入中文效果 */
var last_tapped_card = 0

document.addEventListener("click", function (evt) {
	var el = evt.target
	while (el && el !== document.body) {
		if (el.card) {
			last_tapped_card = el.card
			queueMicrotask(update_popup_fx)
			setTimeout(update_popup_fx, 0)
			break
		}
		el = el.parentNode
	}
}, true)

function update_popup_fx() {
	if (!MOBILE_MQ.matches)
		return
	var popup = document.getElementById("card_popup")
	if (!popup || popup.hidden || !last_tapped_card)
		return
	var panel = popup.querySelector(".zh_popfx")
	if (!panel) {
		panel = document.createElement("div")
		panel.className = "zh_popfx"
		var title = popup.querySelector(".title")
		if (title && title.nextSibling)
			popup.insertBefore(panel, title.nextSibling)
		else
			popup.appendChild(panel)
	}
	var card = (typeof cards !== "undefined") ? cards[last_tapped_card] : null
	var fx = (window.CARD_FX_ZH && window.CARD_FX_ZH[last_tapped_card]) || ""
	if (card)
		panel.innerHTML = "<b>[" + card.ops + "/" + card.sr + "] " + esc(card.name) + (card.remove ? " *" : "") + "</b>" + esc(fx)
}

/* ---------- 手牌徽章 / 待出牌脉冲 ---------- */

function refresh_dock() {
	var btn = document.getElementById("hq_hand_btn")
	if (!btn)
		return
	var badge = btn.querySelector(".badge")
	var n = 0
	var cards_el = document.getElementById("cards")
	if (cards_el)
		n = cards_el.children.length
	badge.textContent = n
	badge.hidden = n === 0
	// 轮到打牌时脉冲提醒
	var pulse = false
	try {
		if (typeof view !== "undefined" && view && view.actions &&
				(view.actions.card || view.actions.play_event || view.actions.play_ops))
			pulse = true
	} catch (e) {}
	btn.classList.toggle("pulse", pulse)

	inject_zhfaces()
}

/* ---------- 启动 ---------- */

window.addEventListener("load", function () {
	// 手机端：把手牌面板移出地图的 transform 容器，否则 fixed 定位会被
	// 祖先的 transform 劫持（fixed 相对 transformed ancestor 定位）
	if (MOBILE_MQ.matches) {
		var pl = document.querySelector(".panel-list")
		if (pl)
			document.body.appendChild(pl)
	}
	build_dock()
	inject_zhfaces()
	setInterval(refresh_dock, 800)
	// 首次进入手机版且地图未缩放时，默认展示全图便于纵览
	if (MOBILE_MQ.matches) {
		setTimeout(function () {
			var main = $("main")
			if (main && current_scale(main) >= 0.98 && main.scrollLeft === 0 && typeof toggle_zoom === "function")
				toggle_zoom()
		}, 400)
	}
})

})()
