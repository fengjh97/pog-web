"use strict"

/* Feature extraction for the Paths of Glory value network.
 * Shared between the node training pipeline and the browser AI.
 * All features are roughly [-1, 1] scaled. Perspective: positive = good for CP.
 */

;(function (data) {

if (!data)
	data = require("./data.js")

var PIECE_NATIONS = ["ge","ah","tu","bu","fr","br","ru","it","be","sb","mn","ro","gr","us","sn","ana"]
var CP_NATIONS = { ge:1, ah:1, tu:1, bu:1 }
var SPACE_NATIONS = ["fr","be","ge","ah","ru","it","sb","bu","ro","tu","gr","br","mn","al","pe","ar","eg"]

var VP_SPACES = []
for (var i = 1; i < data.spaces.length; ++i)
	if (data.spaces[i].vp > 0)
		VP_SPACES.push(i)

var N_SPACES = data.spaces.length

function get_control_bit(s, space) {
	return (s.control[space >> 5] >>> (space & 31)) & 1
}

function map_pairs_sum(m) {
	// RTT "map" = flat [key, val, key, val, ...]
	var sum = 0
	if (m)
		for (var i = 1; i < m.length; i += 2)
			sum += m[i]
	return sum
}

var COMMITMENTS = ["mobilization", "limited", "total"]

function extract(s) {
	var f = []

	/* global scalars */
	f.push((s.turn || 0) / 20)
	f.push((s.vp - 10) / 10)
	f.push((s.us_entry || 0) / 4)
	f.push((s.russian_capitulation || 0) / 4)
	f.push(((s.cp && s.cp.ws) || 0) / 20)
	f.push(((s.ap && s.ap.ws) || 0) / 20)
	for (var ci = 0; ci < COMMITMENTS.length; ++ci) {
		f.push(s.cp && s.cp.commitment === COMMITMENTS[ci] ? 1 : 0)
		f.push(s.ap && s.ap.commitment === COMMITMENTS[ci] ? 1 : 0)
	}
	f.push(((s.cp && s.cp.hand) ? s.cp.hand.length : 0) / 7)
	f.push(((s.ap && s.ap.hand) ? s.ap.hand.length : 0) / 7)
	f.push(((s.cp && s.cp.deck) ? s.cp.deck.length : 0) / 30)
	f.push(((s.ap && s.ap.deck) ? s.ap.deck.length : 0) / 30)

	/* war entry */
	var war = s.war || {}
	f.push(war.it ? 1 : 0)
	f.push(war.tu ? 1 : 0)
	f.push(war.bu ? 1 : 0)
	f.push(war.us ? 1 : 0)
	f.push(war.ro ? 1 : 0)
	f.push(war.gr ? 1 : 0)

	/* replacement pools */
	var rp = s.rp || {}
	f.push(((rp.ge||0) + (rp.ah||0) + (rp.tu||0) + (rp.bu||0)) / 15)
	f.push(((rp.fr||0) + (rp.br||0) + (rp.ru||0) + (rp.it||0) + (rp.us||0) + (rp.allied||0)) / 15)

	/* trenches */
	f.push(map_pairs_sum(s.cp && s.cp.trenches) / 15)
	f.push(map_pairs_sum(s.ap && s.ap.trenches) / 15)

	/* forts */
	var forts = s.forts || {}
	f.push(((forts.destroyed && forts.destroyed.length) || 0) / 10)
	f.push(((forts.besieged && forts.besieged.length) || 0) / 6)

	/* per-nation material: army count, corps count, reduced count, total cf */
	var reduced_set = {}
	if (s.reduced)
		for (var r = 0; r < s.reduced.length; ++r)
			reduced_set[s.reduced[r]] = 1
	var nat_army = {}, nat_corps = {}, nat_red = {}, nat_cf = {}
	var space_cf_cp = new Array(0), per_space_nation_cf = {}
	for (var ni = 0; ni < SPACE_NATIONS.length; ++ni)
		per_space_nation_cf[SPACE_NATIONS[ni]] = 0

	for (var p = 1; p < data.pieces.length; ++p) {
		var loc = s.location[p]
		if (!(loc > 0 && loc < N_SPACES))
			continue
		var pc = data.pieces[p]
		var nn = pc.nation
		var is_red = reduced_set[p] === 1
		var cf = is_red ? pc.rcf : pc.cf
		if (pc.type === "army")
			nat_army[nn] = (nat_army[nn] || 0) + 1
		else
			nat_corps[nn] = (nat_corps[nn] || 0) + 1
		if (is_red)
			nat_red[nn] = (nat_red[nn] || 0) + 1
		nat_cf[nn] = (nat_cf[nn] || 0) + cf
		/* front pressure: signed cf by nation of the space the piece stands in */
		var sp_nat = data.spaces[loc].nation
		if (per_space_nation_cf[sp_nat] !== undefined)
			per_space_nation_cf[sp_nat] += (pc.faction === "cp") ? cf : -cf
	}
	for (var pi = 0; pi < PIECE_NATIONS.length; ++pi) {
		var n2 = PIECE_NATIONS[pi]
		f.push((nat_army[n2] || 0) / 6)
		f.push((nat_corps[n2] || 0) / 10)
		f.push((nat_red[n2] || 0) / 8)
		f.push((nat_cf[n2] || 0) / 30)
	}

	/* front pressure per space-nation (signed, + = CP strength dominates there) */
	for (var si = 0; si < SPACE_NATIONS.length; ++si)
		f.push(per_space_nation_cf[SPACE_NATIONS[si]] / 25)

	/* out of supply */
	var oos_cp = 0, oos_ap = 0
	if (s.oos_pieces)
		for (var oi = 0; oi < s.oos_pieces.length; ++oi) {
			var opc = data.pieces[s.oos_pieces[oi]]
			if (opc) {
				if (opc.faction === "cp") oos_cp++
				else oos_ap++
			}
		}
	f.push(oos_cp / 8)
	f.push(oos_ap / 8)

	/* control of each VP space (1 = CP controls) */
	for (var vi = 0; vi < VP_SPACES.length; ++vi)
		f.push(get_control_bit(s, VP_SPACES[vi]))

	/* per-space signed combat factor (+ = CP), spatial resolution for tactics */
	var space_cf = new Array(N_SPACES)
	for (var sc = 0; sc < N_SPACES; ++sc)
		space_cf[sc] = 0
	for (var p2 = 1; p2 < data.pieces.length; ++p2) {
		var loc2 = s.location[p2]
		if (loc2 > 0 && loc2 < N_SPACES) {
			var pc2 = data.pieces[p2]
			var cf2 = reduced_set[p2] === 1 ? pc2.rcf : pc2.cf
			space_cf[loc2] += pc2.faction === "cp" ? cf2 : -cf2
		}
	}
	for (var sc2 = 1; sc2 < N_SPACES; ++sc2)
		f.push(space_cf[sc2] / 12)

	return f
}

var N_FEATURES = extract((function () {
	// build a minimal dummy state to size the vector
	var control = new Array((N_SPACES >> 5) + 1)
	for (var i = 0; i < control.length; ++i) control[i] = 0
	return {
		turn: 1, vp: 10, us_entry: 0, russian_capitulation: 0,
		cp: { ws: 0, commitment: "mobilization", hand: [], deck: [], trenches: [] },
		ap: { ws: 0, commitment: "mobilization", hand: [], deck: [], trenches: [] },
		war: {}, rp: {}, forts: {}, reduced: [], location: [], oos_pieces: [],
		control: control,
	}
})()).length

if (typeof module !== "undefined")
	module.exports = { extract: extract, N_FEATURES: N_FEATURES, VP_SPACES: VP_SPACES }
else
	window.pog_features = { extract: extract, N_FEATURES: N_FEATURES }

})(typeof module === "undefined" ? data : null)
