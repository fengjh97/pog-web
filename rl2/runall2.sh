#!/bin/zsh
# Full-campaign (20-turn) follow-up: warm-started from Level-3 checkpoints.
set -e
cd "$(dirname "$0")"
PY=~/.claude/venvs/rl/bin/python
M=${1:-150}
echo "=== B-full (GRU, warm from b) ==="
$PY loop.py --arm B --minutes $M --tag bf --max-turn 20 --games-per-iter 48 --init models/b_train.pt
echo "=== C-full (GRU+belief, warm from c) ==="
$PY loop.py --arm C --minutes $M --tag cf --max-turn 20 --games-per-iter 48 --init models/c_train.pt
echo "=== C-sg (belief stop-gradient, warm from c) ==="
$PY loop.py --arm Csg --minutes $M --tag csg --max-turn 20 --games-per-iter 48 --init models/c_train.pt
echo "ALL FULL-CAMPAIGN ARMS DONE"
