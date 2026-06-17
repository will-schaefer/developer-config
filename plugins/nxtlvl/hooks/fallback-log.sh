#!/usr/bin/env bash
# nxtlvl fallback-log hook  —  PreToolUse matcher: Skill|Task
#
# FAIL-OPEN IS ABSOLUTE. This hook must NEVER block or alter a session.
# Every path exits 0 and emits no decision output. Any internal error is swallowed.
#
# M0 scope (this milestone): fail-open skeleton + the stdin SPIKE capture.
#   SPIKE on  -> dump the raw PreToolUse stdin to spike-stdin.json (Task 5),
#                so the exact field carrying the invoked name can be identified.
#                Triggered by EITHER `NXTLVL_SPIKE=1` in the env OR the presence of
#                the sentinel file ~/.claude/nxtlvl/.spike-on (ergonomic: toggle the
#                spike inside a live session with `touch`/`rm`, no relaunch needed).
#   normal    -> NO-OP. The ecc-detection append is intentionally deferred to
#                M6/M7 (Task 12/13), AFTER the spike confirms the stdin field.
#                Writing append logic now would mean guessing the field.
#
# Do NOT add the ecc append here until the spike passes (spec platform-facts row is GATED).

# No `set -e`/`set -u`: a non-zero step must not abort the hook.
NXTLVL_DIR="${HOME}/.claude/nxtlvl"
SPIKE_SENTINEL="${NXTLVL_DIR}/.spike-on"

# Consume stdin once (the PreToolUse event JSON). Never fail if it is empty.
input="$(cat 2>/dev/null)" || input=""

if [ "${NXTLVL_SPIKE:-}" = "1" ] || [ -f "${SPIKE_SENTINEL}" ]; then
  # SPIKE: capture the raw payload for field discovery (Task 5). Best-effort only.
  mkdir -p "${NXTLVL_DIR}" 2>/dev/null
  printf '%s' "${input}" > "${NXTLVL_DIR}/spike-stdin.json" 2>/dev/null
fi

# Normal path: no-op until Task 12 thickens this with the spike-confirmed field.

exit 0
