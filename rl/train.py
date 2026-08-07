#!/usr/bin/env python3
"""Value-network trainer (pure numpy, small MLP).

Usage: train.py --data data/gen0.jsonl [data/gen1.jsonl ...] --out models/v1.json
Target: z = final game result for CP (0 / 0.5 / 1). BCE loss on sigmoid output.
"""
import argparse, json, sys
import numpy as np


def load_data(paths):
    X, Z, val = [], [], []
    for p in paths:
        rows = []
        with open(p) as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                o = json.loads(line)
                rows.append((o["f"], o["z"]))
        cut = int(len(rows) * 0.9)
        for i, (f, z) in enumerate(rows):
            X.append(f)
            Z.append(z)
            val.append(i >= cut)
    X = np.asarray(X, dtype=np.float32)
    Z = np.asarray(Z, dtype=np.float32)
    val = np.asarray(val, dtype=bool)
    return X, Z, val


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", nargs="+", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--hidden", type=int, nargs="+", default=[256, 64])
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--batch", type=int, default=512)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--wd", type=float, default=1e-4)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    rng = np.random.default_rng(args.seed)
    # per-file tail split: positions of one game are contiguous within a file,
    # so file tails as validation avoid same-game train/val leakage
    X, Z, val_mask = load_data(args.data)
    n = len(X)
    print(f"samples: {n}, features: {X.shape[1]}, mean z: {Z.mean():.3f}, val: {val_mask.sum()}")

    mean = X.mean(0)
    std = X.std(0)
    std[std < 1e-6] = 1.0
    Xn = (X - mean) / std

    Xtr, Ztr = Xn[~val_mask], Z[~val_mask]
    Xva, Zva = Xn[val_mask], Z[val_mask]

    sizes = [X.shape[1]] + args.hidden + [1]
    Ws = [rng.normal(0, np.sqrt(2.0 / sizes[i]), (sizes[i + 1], sizes[i])).astype(np.float32)
          for i in range(len(sizes) - 1)]
    bs = [np.zeros(sizes[i + 1], dtype=np.float32) for i in range(len(sizes) - 1)]

    # Adam state
    mW = [np.zeros_like(w) for w in Ws]; vW = [np.zeros_like(w) for w in Ws]
    mb = [np.zeros_like(b) for b in bs]; vb = [np.zeros_like(b) for b in bs]
    b1, b2, eps = 0.9, 0.999, 1e-8
    t = 0

    def forward(x):
        acts = [x]
        h = x
        for i in range(len(Ws) - 1):
            h = np.maximum(h @ Ws[i].T + bs[i], 0)
            acts.append(h)
        logit = h @ Ws[-1].T + bs[-1]
        acts.append(logit)
        return acts

    def bce(logit, z):
        p = 1 / (1 + np.exp(-logit))
        p = np.clip(p, 1e-7, 1 - 1e-7)
        return -(z * np.log(p) + (1 - z) * np.log(1 - p)).mean(), p

    best_val = 1e9
    best = None
    patience, bad = 8, 0
    steps_per_epoch = max(1, len(Xtr) // args.batch)
    for epoch in range(args.epochs):
        perm = rng.permutation(len(Xtr))
        tot = 0.0
        for s in range(steps_per_epoch):
            bi = perm[s * args.batch:(s + 1) * args.batch]
            x, z = Xtr[bi], Ztr[bi]
            acts = forward(x)
            logit = acts[-1][:, 0]
            loss, p = bce(logit, z)
            tot += loss
            # backward
            g = ((p - z) / len(x)).astype(np.float32)[:, None]  # dL/dlogit
            grads_W, grads_b = [None] * len(Ws), [None] * len(bs)
            delta = g
            for i in range(len(Ws) - 1, -1, -1):
                a_in = acts[i]
                grads_W[i] = delta.T @ a_in
                grads_b[i] = delta.sum(0)
                if i > 0:
                    delta = (delta @ Ws[i]) * (acts[i] > 0)
            t += 1
            lr_t = args.lr * np.sqrt(1 - b2 ** t) / (1 - b1 ** t)
            for i in range(len(Ws)):
                grads_W[i] += args.wd * Ws[i]
                mW[i] = b1 * mW[i] + (1 - b1) * grads_W[i]
                vW[i] = b2 * vW[i] + (1 - b2) * grads_W[i] ** 2
                Ws[i] -= lr_t * mW[i] / (np.sqrt(vW[i]) + eps)
                mb[i] = b1 * mb[i] + (1 - b1) * grads_b[i]
                vb[i] = b2 * vb[i] + (1 - b2) * grads_b[i] ** 2
                bs[i] -= lr_t * mb[i] / (np.sqrt(vb[i]) + eps)
        val_loss, val_p = bce(forward(Xva)[-1][:, 0], Zva)
        acc = ((val_p > 0.5) == (Zva > 0.5))[Zva != 0.5].mean() if (Zva != 0.5).any() else float("nan")
        print(f"epoch {epoch+1}: train {tot/steps_per_epoch:.4f} val {val_loss:.4f} acc {acc:.3f}")
        if val_loss < best_val - 1e-4:
            best_val = val_loss
            best = ([w.copy() for w in Ws], [b.copy() for b in bs])
            bad = 0
        else:
            bad += 1
            if bad >= patience:
                print("early stop")
                break

    Ws, bs = best
    model = {
        "mean": mean.tolist(),
        "std": std.tolist(),
        "layers": [{"W": Ws[i].tolist(), "b": bs[i].tolist()} for i in range(len(Ws))],
        "meta": {"samples": n, "val_loss": float(best_val)},
    }
    import os
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w") as fh:
        json.dump(model, fh)
    print(f"saved {args.out} (val_loss {best_val:.4f})")


if __name__ == "__main__":
    main()
