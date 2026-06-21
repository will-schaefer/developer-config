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

# Preflight: a missing CLI must be the first, clearest error — otherwise it only
# surfaces later as a confusing failure mid-script (e.g. a "command not found"
# from the `add` step instead of "Claude Code isn't installed").
if ! command -v claude >/dev/null 2>&1; then
  echo "error: 'claude' CLI not found on PATH. Install Claude Code first." >&2
  exit 1
fi

# Run a `claude` subcommand, capturing combined output into a caller-named
# variable. On non-zero exit, surface the CLI's own output and abort — so a
# failed *check* (CLI error, auth required, renamed subcommand) is never silently
# misread as "not configured / not installed". The caller stays out of a pipe on
# purpose: a pipe's left side runs in a subshell, where `exit` would not stop the
# script and the failure would be laundered into the "not found" branch.
claude_capture() {
  local __var="$1"; shift
  local __out __rc
  if __out="$(claude "$@" 2>&1)"; then __rc=0; else __rc=$?; fi
  if [ "$__rc" -ne 0 ]; then
    echo "error: 'claude $*' failed (exit $__rc):" >&2
    echo "$__out" >&2
    exit 1
  fi
  printf -v "$__var" '%s' "$__out"
}

# Match an entry by its *complete* name at end-of-line, so a longer name that
# merely contains ours (e.g. a "-staging" or "-v2" variant) is not a false hit.
entry_present() { printf '%s\n' "$1" | grep -qE "(^|[[:space:]])${2}[[:space:]]*\$"; }

# Add the local marketplace from the working copy, so in-repo edits are picked up.
claude_capture marketplaces plugin marketplace list
if entry_present "$marketplaces" "$MARKETPLACE"; then
  echo "Marketplace '$MARKETPLACE' already configured."
else
  claude plugin marketplace add ./ --scope project
fi

# Install the plugin (set -e aborts on hard failure; this is not in an if-cond).
claude_capture plugins plugin list
if entry_present "$plugins" "$PLUGIN"; then
  echo "Plugin '$PLUGIN' already installed."
else
  claude plugin install "$PLUGIN" --scope project
fi

# Verify the end state rather than assuming it: re-query and assert the plugin is
# actually present — a silent no-op install would otherwise still print "Done".
claude_capture installed plugin list
if ! entry_present "$installed" "$PLUGIN"; then
  echo "error: '$PLUGIN' is not present after install. CLI output:" >&2
  echo "$installed" >&2
  exit 1
fi

# Enabled-state is the weakest signal to parse, so warn (don't fail) if it looks
# disabled: pull the Status line(s) within this plugin's block (entries are
# blank-line separated) and check for "enabled" (which "disabled" never contains).
status="$(printf '%s\n' "$installed" | awk -v p="$PLUGIN" '
  $0 ~ (p "[[:space:]]*$") { inblock = 1; next }
  /^[[:space:]]*$/         { inblock = 0 }
  inblock && /Status:/     { print }
')"
if ! printf '%s' "$status" | grep -q "enabled"; then
  echo "warning: '$PLUGIN' is installed but does not appear enabled." >&2
  echo "         Enable it with: claude plugin enable '$PLUGIN'" >&2
fi

echo
echo "Done. nxtlvl plugin installed (project scope)."
echo "Plugin components load at the START of a session — start a new Claude Code"
echo "session for the skills (documentation-and-adrs, review) and hooks to register."
