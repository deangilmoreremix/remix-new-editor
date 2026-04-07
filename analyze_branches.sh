#!/bin/bash
echo "=== BRANCH ANALYSIS ==="

echo "Local branch status:"
git status --porcelain | wc -l
echo " files changed locally"

echo -e "\nSession A branch commits:"
git log --oneline origin/session/agent_1a7de5b8-7c83-4c6a-a075-6a6f33d63dbb --not develop | head -10

echo -e "\nFiles changed in Session A:"
git diff --name-only develop..origin/session/agent_1a7de5b8-7c83-4c6a-a075-6a6f33d63dbb | wc -l
echo " files modified"

echo -e "\nTop changed files in Session A:"
git diff --name-only develop..origin/session/agent_1a7de5b8-7c83-4c6a-a075-6a6f33d63dbb | head -20

echo -e "\nPotential conflicts with local work:"
git diff --name-only HEAD..origin/session/agent_1a7de5b8-7c83-4c6a-a075-6a6f33d63dbb | head -10

echo -e "\nChecking Session B repository access..."
if git ls-remote https://github.com/deangilmoreremix/Open-Higgsfield-AI.git &>/dev/null; then
    echo "✅ Session B repository is accessible"
    git ls-remote --heads https://github.com/deangilmoreremix/Open-Higgsfield-AI.git | grep agent_74cf1586
else
    echo "❌ Session B repository is not accessible"
fi
