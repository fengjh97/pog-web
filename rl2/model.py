"""PoG hierarchical recurrent policy — torch side.

Arms:
  A: MLP encoder only (no GRU, no belief)
  B: + GRU
  C: + GRU + belief auxiliary head
Critic is privileged (sees opponent hand) and feedforward (full state ~ Markov).
Weights round-trip to JSON for the JS rollout workers.
"""
import json
import torch
import torch.nn as nn

OBS_DIM = 603      # 537 state features + 65 own-hand one-hot + 1 role flag
PRIV_DIM = 65      # opponent hand one-hot (faction-local card numbers 1..65)
CAND_DIM = 20
ENC_H = 256
REP_H = 128
POL_H = 64


class Policy(nn.Module):
    def __init__(self, use_gru: bool, use_belief: bool):
        super().__init__()
        self.use_gru = use_gru
        self.use_belief = use_belief
        self.enc1 = nn.Linear(OBS_DIM, ENC_H)
        self.enc2 = nn.Linear(ENC_H, REP_H)
        if use_gru:
            self.gru = nn.GRUCell(REP_H, REP_H)
        self.pol1 = nn.Linear(REP_H + CAND_DIM, POL_H)
        self.pol2 = nn.Linear(POL_H, 1)
        if use_belief:
            self.belief = nn.Linear(REP_H, PRIV_DIM)

    def encode(self, obs):                      # obs [T, OBS_DIM]
        return torch.relu(self.enc2(torch.relu(self.enc1(obs))))

    def unroll(self, obs, h0=None):             # sequential over T
        x = self.encode(obs)
        if not self.use_gru:
            return x
        hs = []
        h = torch.zeros(1, REP_H) if h0 is None else h0
        for t in range(x.shape[0]):
            h = self.gru(x[t:t+1], h)
            hs.append(h)
        return torch.cat(hs, 0)

    def logits(self, h, cands, mask):           # h [T,R], cands [T,K,C], mask [T,K]
        T, K, _ = cands.shape
        hx = h.unsqueeze(1).expand(T, K, REP_H)
        z = torch.relu(self.pol1(torch.cat([hx, cands], -1)))
        lg = self.pol2(z).squeeze(-1)
        return lg.masked_fill(~mask, -1e9)


class Critic(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(OBS_DIM + PRIV_DIM, ENC_H), nn.ReLU(),
            nn.Linear(ENC_H, REP_H), nn.ReLU(),
            nn.Linear(REP_H, 1),
        )

    def forward(self, obs, priv):
        return self.net(torch.cat([obs, priv], -1)).squeeze(-1)


def export_policy(policy: Policy, path: str, meta=None):
    def m(t):
        return [[round(float(v), 6) for v in row] for row in t.tolist()] if t.dim() == 2 \
            else [round(float(v), 6) for v in t.tolist()]
    out = {
        "use_gru": policy.use_gru,
        "enc1_w": m(policy.enc1.weight), "enc1_b": m(policy.enc1.bias),
        "enc2_w": m(policy.enc2.weight), "enc2_b": m(policy.enc2.bias),
        "pol1_w": m(policy.pol1.weight), "pol1_b": m(policy.pol1.bias),
        "pol2_w": m(policy.pol2.weight), "pol2_b": m(policy.pol2.bias),
        "meta": meta or {},
    }
    if policy.use_gru:
        # torch GRUCell: weight_ih [3R, R] rows = reset|update|new
        out["gru_wih"] = m(policy.gru.weight_ih)
        out["gru_whh"] = m(policy.gru.weight_hh)
        out["gru_bih"] = m(policy.gru.bias_ih)
        out["gru_bhh"] = m(policy.gru.bias_hh)
    with open(path, "w") as fh:
        json.dump(out, fh)
