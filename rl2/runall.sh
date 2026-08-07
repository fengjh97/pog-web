#!/bin/zsh
# Sequential ablation training: equal wall-clock budget per arm.
set -e
cd "$(dirname "$0")"
PY=~/.claude/venvs/rl/bin/python
M=${1:-75}
echo "=== ARM A (no GRU, no belief) ==="
$PY loop.py --arm A --minutes $M --tag a
echo "=== ARM B (GRU) ==="
$PY loop.py --arm B --minutes $M --tag b
echo "=== ARM C (GRU + belief) ==="
$PY loop.py --arm C --minutes $M --tag c
echo "ALL ARMS DONE"
