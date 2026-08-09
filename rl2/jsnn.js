"use strict"

/* JS-side policy inference matching model.py exactly.
 * GRUCell math (torch): r = σ(Wir x + bir + Whr h + bhr)
 *                       z = σ(Wiz x + biz + Whz h + bhz)
 *                       n = tanh(Win x + bin + r * (Whn h + bhn))
 *                       h' = (1 - z) * n + z * h
 * weight_ih rows ordered [r; z; n].
 */

function matvec(W, x, b) {
	const out = new Float64Array(W.length)
	for (let i = 0; i < W.length; i++) {
		let acc = b ? b[i] : 0
		const row = W[i]
		for (let j = 0; j < row.length; j++)
			acc += row[j] * x[j]
		out[i] = acc
	}
	return out
}

function relu_(v) {
	for (let i = 0; i < v.length; i++)
		if (v[i] < 0) v[i] = 0
	return v
}

function sigmoid(x) { return 1 / (1 + Math.exp(-x)) }

function encode(M, obs) {
	return relu_(matvec(M.enc2_w, relu_(matvec(M.enc1_w, obs, M.enc1_b)), M.enc2_b))
}

function gru_step(M, x, h) {
	const R = h.length
	const gi = matvec(M.gru_wih, x, M.gru_bih)
	const gh = matvec(M.gru_whh, h, M.gru_bhh)
	const out = new Float64Array(R)
	for (let i = 0; i < R; i++) {
		const r = sigmoid(gi[i] + gh[i])
		const z = sigmoid(gi[R + i] + gh[R + i])
		const n = Math.tanh(gi[2 * R + i] + r * gh[2 * R + i])
		out[i] = (1 - z) * n + z * h[i]
	}
	return out
}

/* step: encode obs, advance hidden (if GRU), score candidates.
 * returns { h: newHidden, logits: [K] } */
function policy_step(M, obs, h, cands) {
	const x = encode(M, obs)
	const rep = M.use_gru ? gru_step(M, x, h) : x
	const R = rep.length
	const logits = new Array(cands.length)
	const joint = new Float64Array(R + cands[0].length)
	joint.set(rep, 0)
	for (let k = 0; k < cands.length; k++) {
		joint.set(cands[k], R)
		const z = relu_(matvec(M.pol1_w, joint, M.pol1_b))
		logits[k] = matvec(M.pol2_w, z, M.pol2_b)[0]
	}
	return { h: rep, logits }
}

function softmax_sample(logits, temp, rng) {
	let mx = -Infinity
	for (const v of logits) if (v > mx) mx = v
	const p = logits.map(v => Math.exp((v - mx) / temp))
	let s = 0
	for (const v of p) s += v
	let u = (rng ? rng() : Math.random()) * s
	for (let i = 0; i < p.length; i++) {
		u -= p[i]
		if (u <= 0) return { idx: i, logp: Math.log(p[i] / s) }
	}
	return { idx: p.length - 1, logp: Math.log(p[p.length - 1] / s) }
}

function new_hidden() { return new Float64Array(128) }

const api = { policy_step, softmax_sample, new_hidden, encode, gru_step }

if (typeof module !== "undefined")
	module.exports = api
else
	window.pog_rl2 = api
