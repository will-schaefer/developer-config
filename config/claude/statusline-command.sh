#!/bin/sh
# Claude Code status line
# Input: JSON via stdin
#
# Layout:  <dir> (<branch>) «<session>» <model> ctx:<occ>K (<used>%) 5h:<n>% 7d:<n>%
# Context is colored by the *absolute* occupancy band (not the misleading
# percentage of a 1M window): green < 150K, amber 150–200K, red >= 200K or
# when exceeds_200k_tokens is set — matching the real quality-degradation band.

input=$(cat)

cwd=$(echo "$input"          | jq -r '.cwd // .workspace.current_dir // empty')
model=$(echo "$input"        | jq -r '.model.display_name // empty')
session_name=$(echo "$input" | jq -r '.session_name // empty')
occ=$(echo "$input"          | jq -r '.context_window.total_input_tokens // 0')
used_pct=$(echo "$input"     | jq -r '.context_window.used_percentage // empty')
exceeds=$(echo "$input"      | jq -r '.exceeds_200k_tokens // false')
five_h=$(echo "$input"       | jq -r '.rate_limits.five_hour.used_percentage // empty')
seven_d=$(echo "$input"      | jq -r '.rate_limits.seven_day.used_percentage // empty')

# Directory: basename of cwd
if [ -n "$cwd" ]; then
  dir=$(basename "$cwd")
else
  dir=$(basename "$(pwd)")
fi

# Git branch (skip optional locks, suppress errors)
branch=$(git -C "${cwd:-$(pwd)}" --no-optional-locks symbolic-ref --short HEAD 2>/dev/null)

# Colors — build with a real ESC byte so the final emit is a plain %s
# (dynamic content is concatenated literally, never re-interpreted by printf)
ESC=$(printf '\033')
RESET="${ESC}[0m"
DIM="${ESC}[2m"
CYAN="${ESC}[2;36m"
YELLOW="${ESC}[2;33m"
MAGENTA="${ESC}[2;35m"
AMBER="${ESC}[33m"
RED="${ESC}[1;31m"

# dir · branch · session · model
out="${CYAN}${dir}${RESET}"
[ -n "$branch" ]       && out="${out} ${YELLOW}(${branch})${RESET}"
[ -n "$session_name" ] && out="${out} ${MAGENTA}«${session_name}»${RESET}"
[ -n "$model" ]        && out="${out} ${DIM}${model}${RESET}"

# Context occupancy, colored by the 150–200K degradation band
if [ "$occ" -gt 0 ] 2>/dev/null; then
  occ_k=$((occ / 1000))
  if [ "$exceeds" = "true" ] || [ "$occ" -ge 200000 ]; then
    ctx_color="$RED"
  elif [ "$occ" -ge 150000 ]; then
    ctx_color="$AMBER"
  else
    ctx_color="$DIM"
  fi
  if [ -n "$used_pct" ]; then
    pct=$(printf '%.0f' "$used_pct")
    out="${out} ${ctx_color}ctx:${occ_k}K (${pct}%)${RESET}"
  else
    out="${out} ${ctx_color}ctx:${occ_k}K${RESET}"
  fi
fi

# Rate limits (Pro/Max: present after the first API response)
limits=""
[ -n "$five_h" ]  && limits="5h:$(printf '%.0f' "$five_h")%"
[ -n "$seven_d" ] && limits="${limits:+$limits }7d:$(printf '%.0f' "$seven_d")%"
[ -n "$limits" ]  && out="${out} ${DIM}${limits}${RESET}"

printf '%s\n' "$out"
