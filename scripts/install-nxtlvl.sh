#!/usr/bin/env bash
# Install the nxtlvl plugin from this repo's local marketplace into Claude Code.
#
# Idempotent and portable: safe to re-run, and reproduces the install on any
# machine or fresh container. The per-machine `.claude/settings.json` that the
# CLI writes (absolute marketplace path) is gitignored — this script is the
# shared, version-controlled source of truth instead.
#
# Cloud environment: drop this line into the environment's setup script so every
# new container has nxtlvl preinstalled:
#   bash scripts/install-nxtlvl.sh
set -euo pipefail

# Repo root = parent of this script's directory (portable; no absolute paths).
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

MARKETPLACE="nxtlvl-dev"
PLUGIN="nxtlvl@${MARKETPLACE}"

# Add the local marketplace from the working copy, so in-repo edits are picked up.
if claude plugin marketplace list 2>/dev/null | grep -q "$MARKETPLACE"; then
  echo "Marketplace '$MARKETPLACE' already configured."
else
  claude plugin marketplace add ./ --scope project
fi

# Install + enable the plugin.
if claude plugin list 2>/dev/null | grep -q "$PLUGIN"; then
  echo "Plugin '$PLUGIN' already installed."
else
  claude plugin install "$PLUGIN" --scope project
fi

echo
echo "Done. nxtlvl plugin installed (project scope)."
echo "Plugin components load at the START of a session — start a new Claude Code"
echo "session for the skills (documentation-and-adrs, review) and hooks to register."
