"""Training orchestrator: rollout workers -> PPO update -> league -> probe.

Usage:
  python loop.py --arm C --minutes 90 --tag c
Arms: A (no GRU/no belief)  B (GRU)  C (GRU+belief)
"""
import argparse, glob, json, os, subprocess, time
import torch
from model import Policy, Critic, export_policy
import ppo

HERE = os.path.dirname(os.path.abspath(__file__))
NODE = "node"

GAMES_PER_ITER = 96  # overridden by --games-per-iter
WORKERS = 6
LEAGUE_EVERY = 8
PROBE_EVERY = 8
PROBE_GAMES = 24


def run_workers(model_json, league_dir, iter_no, tag, games_per_iter, max_turn):
    per = games_per_iter // WORKERS
    procs, files = [], []
    for w in range(WORKERS):
        out = f"/tmp/rl2-{tag}-{w}.jsonl"
        if os.path.exists(out):
            os.remove(out)
        files.append(out)
        procs.append(subprocess.Popen(
            [NODE, os.path.join(HERE, "rollout.js"),
             "--games", str(per), "--model", model_json,
             "--league", league_dir, "--out", out,
             "--max-turn", str(max_turn),
             "--seed", str(iter_no * 100000 + w * 1000)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for p in procs:
        p.wait()
    return files


def probe(model_json, tag, max_turn=3, search=False):
    cmd = [NODE, os.path.join(HERE, "rollout.js"), "--arena",
           "--games", str(PROBE_GAMES), "--model", model_json,
           "--opp", "heuristic", "--max-turn", str(max_turn),
           "--seed", str(int(time.time()) % 100000)]
    if search:
        cmd.append("--search")
    try:
        out = subprocess.check_output(cmd, timeout=1200).decode().strip().splitlines()[-1]
        return json.loads(out)
    except Exception as e:
        return {"error": str(e)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--arm", choices=["A", "B", "C", "Csg"], required=True)
    ap.add_argument("--minutes", type=float, default=90)
    ap.add_argument("--tag", required=True)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--max-turn", type=int, default=3)
    ap.add_argument("--games-per-iter", type=int, default=96)
    ap.add_argument("--init", default=None, help="warm-start .pt checkpoint")
    args = ap.parse_args()

    torch.manual_seed(7)
    torch.set_num_threads(6)
    use_gru = args.arm in ("B", "C", "Csg")
    use_belief = args.arm in ("C", "Csg")
    policy = Policy(use_gru, use_belief, belief_sg=args.arm == "Csg")
    critic = Critic()
    opt = torch.optim.Adam(list(policy.parameters()) + list(critic.parameters()), lr=args.lr)
    if args.init:
        ck = torch.load(args.init, weights_only=True)
        policy.load_state_dict(ck["policy"], strict=False)
        critic.load_state_dict(ck["critic"])
        print(f"warm-started from {args.init} (iter {ck.get('iter')})")

    mdir = os.path.join(HERE, "models")
    league = os.path.join(HERE, "league_" + args.tag)
    os.makedirs(mdir, exist_ok=True)
    os.makedirs(league, exist_ok=True)
    cur = os.path.join(mdir, f"{args.tag}_cur.json")
    export_policy(policy, cur, {"arm": args.arm, "iter": 0})

    logf = open(os.path.join(HERE, f"train_{args.tag}.log"), "a")
    def log(msg):
        line = f"[{time.strftime('%H:%M:%S')}] {msg}"
        print(line, flush=True)
        logf.write(line + "\n"); logf.flush()

    t0 = time.time()
    it = 0
    mean_R = []
    while (time.time() - t0) / 60 < args.minutes:
        it += 1
        files = run_workers(cur, league, it, args.tag, args.games_per_iter, args.max_turn)
        eps = ppo.load_episodes(files)
        # track mean self-play reward of recorded sides (should hover near 0 in mirror play)
        zs = [e["z"] for e in eps]
        stats = ppo.update(policy, critic, opt, eps)
        bel = ppo.belief_eval(policy, eps) if use_belief else None
        export_policy(policy, cur, {"arm": args.arm, "iter": it})
        mean_R.append(sum(zs) / max(1, len(zs)))
        log(f"iter {it} eps={len(eps)} steps~{sum(len(e['steps']) for e in eps)} "
            f"pi={stats['pi']} vf={stats['vf']} ent={stats['ent']} kl={stats['kl']} "
            f"bel={stats['bel']}" + (f" belief={bel}" if bel else ""))
        if it % LEAGUE_EVERY == 0:
            ck = os.path.join(league, f"{args.tag}_it{it}.json")
            export_policy(policy, ck, {"arm": args.arm, "iter": it})
            torch.save({"policy": policy.state_dict(), "critic": critic.state_dict(),
                        "opt": opt.state_dict(), "iter": it},
                       os.path.join(mdir, f"{args.tag}_train.pt"))
        if it % PROBE_EVERY == 0:
            pr = probe(cur, args.tag, args.max_turn)
            log(f"PROBE iter {it} vs heuristic: {pr}")
    torch.save({"policy": policy.state_dict(), "critic": critic.state_dict(),
                "opt": opt.state_dict(), "iter": it},
               os.path.join(mdir, f"{args.tag}_train.pt"))
    log(f"DONE arm={args.arm} iters={it} wall={(time.time()-t0)/60:.1f}min")


if __name__ == "__main__":
    main()
