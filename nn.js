"use strict"

/* Tiny MLP forward pass for the value network (shared node/browser).
 * Model JSON: {mean:[], std:[], layers:[{W:[[...]], b:[...]}, ...]}
 * Hidden layers use ReLU; output is a single logit -> sigmoid = P(CP wins).
 */

function nn_forward(model, feats) {
	var x = new Array(feats.length)
	for (var i = 0; i < feats.length; ++i)
		x[i] = (feats[i] - model.mean[i]) / model.std[i]
	for (var L = 0; L < model.layers.length; ++L) {
		var W = model.layers[L].W, b = model.layers[L].b
		var out = new Array(b.length)
		for (var j = 0; j < b.length; ++j) {
			var acc = b[j]
			var Wj = W[j]
			for (var k = 0; k < x.length; ++k)
				acc += Wj[k] * x[k]
			out[j] = (L < model.layers.length - 1) ? (acc > 0 ? acc : 0) : acc
		}
		x = out
	}
	return 1 / (1 + Math.exp(-x[0]))
}

if (typeof module !== "undefined")
	module.exports = { nn_forward: nn_forward }
else
	window.nn_forward = nn_forward
