"""PPO update from JSONL trajectories (terminal reward, privileged critic, belief aux)."""
import json
import torch
import torch.nn.functional as Fn
from model import Policy, Critic, OBS_DIM, PRIV_DIM, CAND_DIM

CLIP = 0.2
ENT_COEF = 0.01
VF_COEF = 0.5
BELIEF_COEF = 0.5
EPOCHS = 2
MAX_GRAD = 0.5


def load_episodes(paths):
    eps = {}
    for p in paths:
        with open(p) as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    o = json.loads(line)
                except json.JSONDecodeError:
                    continue
                key = (p, o["ep"], o["role"])
                e = eps.setdefault(key, {"steps": [], "z": None})
                if o.get("end"):
                    e["z"] = o["z"]
                else:
                    e["steps"].append(o)
    out = []
    for e in eps.values():
        if e["z"] is None or not e["steps"]:
            continue
        out.append(e)
    return out


def pad_cands(cands):
    K = max(len(c) for c in cands)
    T = len(cands)
    t_c = torch.zeros(T, K, CAND_DIM)
    t_m = torch.zeros(T, K, dtype=torch.bool)
    for t, cs in enumerate(cands):
        for k, c in enumerate(cs):
            t_c[t, k] = torch.tensor(c)
            t_m[t, k] = True
    return t_c, t_m


def update(policy: Policy, critic: Critic, opt, episodes, device="cpu"):
    stats = {"pi": 0.0, "vf": 0.0, "ent": 0.0, "bel": 0.0, "kl": 0.0, "n": 0}
    # pre-tensorize
    packed = []
    for e in episodes:
        obs = torch.tensor([s["obs"] for s in e["steps"]], dtype=torch.float32)
        if obs.shape[1] != OBS_DIM:
            continue
        priv = torch.tensor([s["priv"] for s in e["steps"]], dtype=torch.float32)
        cands, mask = pad_cands([s["cands"] for s in e["steps"]])
        k = torch.tensor([s["k"] for s in e["steps"]], dtype=torch.long)
        lp_old = torch.tensor([s["lp"] for s in e["steps"]], dtype=torch.float32)
        z = torch.full((obs.shape[0],), float(e["z"]))
        packed.append((obs, priv, cands, mask, k, lp_old, z))
    if not packed:
        return stats

    for _ in range(EPOCHS):
        order = torch.randperm(len(packed)).tolist()
        for i in order:
            obs, priv, cands, mask, k, lp_old, z = packed[i]
            h = policy.unroll(obs)
            logits = policy.logits(h, cands, mask)
            logp_all = torch.log_softmax(logits, -1)
            lp = logp_all.gather(1, k.unsqueeze(1)).squeeze(1)
            with torch.no_grad():
                v_detached = critic(obs, priv)
                adv = z - v_detached
                if adv.numel() > 1:
                    adv = (adv - adv.mean()) / (adv.std() + 1e-6)
            ratio = torch.exp(lp - lp_old)
            pg = -torch.min(ratio * adv, torch.clamp(ratio, 1 - CLIP, 1 + CLIP) * adv).mean()
            ent = -(logp_all.exp() * logp_all).masked_fill(~mask, 0).sum(-1).mean()
            v = critic(obs, priv)
            vf = Fn.mse_loss(v, z)
            loss = pg + VF_COEF * vf - ENT_COEF * ent
            bel = torch.tensor(0.0)
            if policy.use_belief:
                bel = Fn.binary_cross_entropy_with_logits(policy.belief(h), priv)
                loss = loss + BELIEF_COEF * bel
            opt.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(
                list(policy.parameters()) + list(critic.parameters()), MAX_GRAD)
            opt.step()
            with torch.no_grad():
                stats["pi"] += pg.item(); stats["vf"] += vf.item()
                stats["ent"] += ent.item(); stats["bel"] += float(bel)
                stats["kl"] += (lp_old - lp).mean().item()
                stats["n"] += 1
    for kk in ("pi", "vf", "ent", "bel", "kl"):
        stats[kk] = round(stats[kk] / max(1, stats["n"]), 4)
    return stats


def belief_eval(policy: Policy, episodes, max_eps=40):
    """held-out opponent-hand prediction quality (BCE + top-7 hit rate)"""
    if not policy.use_belief:
        return None
    tot_bce, tot_hit, n = 0.0, 0.0, 0
    with torch.no_grad():
        for e in episodes[:max_eps]:
            obs = torch.tensor([s["obs"] for s in e["steps"]], dtype=torch.float32)
            if obs.shape[1] != OBS_DIM:
                continue
            priv = torch.tensor([s["priv"] for s in e["steps"]], dtype=torch.float32)
            h = policy.unroll(obs)
            logit = policy.belief(h)
            tot_bce += Fn.binary_cross_entropy_with_logits(logit, priv).item()
            # top-7 predicted cards vs true hand, final step
            top = torch.topk(logit[-1], 7).indices
            true = priv[-1]
            tot_hit += true[top].sum().item() / max(1.0, true.sum().item())
            n += 1
    return {"bce": round(tot_bce / max(1, n), 4), "top7_recall": round(tot_hit / max(1, n), 3)}
