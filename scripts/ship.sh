#!/usr/bin/env bash
# npm run ship [-- --fast]: ship a clean, up-to-date main. Railway deploys every push to main.
# Runs the type check and the unit tests first unless --fast. Never force-pushes.
set -euo pipefail

branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branch" != "main" ]; then
  echo "ship: switch to main first (you are on $branch)." >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "ship: commit or stash your changes first." >&2
  exit 1
fi

git pull --ff-only origin main

if [ "${1:-}" != "--fast" ]; then
  npx tsc --noEmit
  npx vitest run
fi

git push origin main
echo "ship: main pushed. Railway deploys it; the checks run on main in GitHub Actions."
