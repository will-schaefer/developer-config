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
effort=$(echo "$input"       | jq -r '.effort.level // empty')
out_style=$(echo "$input"    | jq -r '.output_style.name // empty')
session_name=$(echo "$input" | jq -r '.session_name // empty')
occ=$(echo "$input"          | jq -r '.context_window.total_input_tokens // 0')
used_pct=$(echo "$input"     | jq -r '.context_window.used_percentage // empty')
exceeds=$(echo "$input"      | jq -r '.exceeds_200k_tokens // false')
five_h=$(echo "$input"       | jq -r '.rate_limits.five_hour.used_percentage // empty')
seven_d=$(echo "$input"      | jq -r '.rate_limits.seven_day.used_percentage // empty')
five_reset=$(echo "$input"   | jq -r '.rate_limits.five_hour.resets_at // empty')
seven_reset=$(echo "$input"  | jq -r '.rate_limits.seven_day.resets_at // empty')

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
# Two band palettes (green=healthy / amber=watch / red=danger). ctx is the
# quality-degradation signal, so when it leaves the healthy band it fills its
# BACKGROUND (a highlighted block) to dominate the normal-weight usage segments.
CTX_GREEN="${ESC}[1;32m"     # healthy — bold green text, no background
CTX_AMBER="${ESC}[1;30;43m"  # watch  — bold black on amber background
CTX_RED="${ESC}[1;97;41m"    # danger — bold bright-white on red background
USE_GREEN="${ESC}[32m"
USE_AMBER="${ESC}[33m"
USE_RED="${ESC}[31m"

# dir · branch · session · model
# The session-title hook auto-names sessions "<dir> · <branch>", which the
# dir/branch segments already show — so only render «session» when it has been
# manually renamed to something other than that auto title (avoids duplication).
out="${CYAN}${dir}${RESET}"
[ -n "$branch" ] && out="${out} ${YELLOW}(${branch})${RESET}"
if [ -n "$branch" ]; then auto_title="${dir} · ${branch}"; else auto_title="${dir}"; fi
[ -n "$session_name" ] && [ "$session_name" != "$auto_title" ] \
  && out="${out} ${MAGENTA}«${session_name}»${RESET}"
[ -n "$model" ] && out="${out} ${DIM}${model}${RESET}"
# Session config (muted, subordinate to ctx): effort always; output style only
# when it's been switched away from default.
[ -n "$effort" ]    && out="${out} ${DIM}eff:${effort}${RESET}"
[ -n "$out_style" ] && [ "$out_style" != "default" ] && out="${out} ${DIM}style:${out_style}${RESET}"

# Context occupancy, colored by the 150–200K degradation band
if [ "$occ" -gt 0 ] 2>/dev/null; then
  occ_k=$((occ / 1000))
  # Healthy = colored text only; watch/danger = background block with padding.
  if [ "$exceeds" = "true" ] || [ "$occ" -ge 200000 ]; then
    ctx_color="$CTX_RED"; ctx_pad=" "
  elif [ "$occ" -ge 150000 ]; then
    ctx_color="$CTX_AMBER"; ctx_pad=" "
  else
    ctx_color="$CTX_GREEN"; ctx_pad=""
  fi
  if [ -n "$used_pct" ]; then
    pct=$(printf '%.0f' "$used_pct")
    out="${out} ${ctx_color}${ctx_pad}ctx:${occ_k}K (${pct}%)${ctx_pad}${RESET}"
  else
    out="${out} ${ctx_color}${ctx_pad}ctx:${occ_k}K${ctx_pad}${RESET}"
  fi
fi

# Color a usage percentage by band: green < 50, amber 50–80, red >= 80
pct_color() {
  p=$(printf '%.0f' "$1")
  if   [ "$p" -ge 80 ]; then printf '%s' "$USE_RED"
  elif [ "$p" -ge 50 ]; then printf '%s' "$USE_AMBER"
  else                       printf '%s' "$USE_GREEN"
  fi
}

# Compact "time until" from a future unix-epoch reset: 2d3h / 4h12m / 45m / now
fmt_until() {
  s=$(( $1 - $(date +%s) ))
  [ "$s" -le 0 ] && { printf 'now'; return; }
  d=$((s / 86400)); s=$((s % 86400)); h=$((s / 3600)); m=$(((s % 3600) / 60))
  if   [ "$d" -gt 0 ]; then printf '%dd%dh' "$d" "$h"
  elif [ "$h" -gt 0 ]; then printf '%dh%dm' "$h" "$m"
  else                      printf '%dm' "$m"
  fi
}

# Rate limits (Pro/Max: present after the first API response), each with its
# reset countdown in parens — "5h:8% (4h12m)" = window at 8%, resets to 0 in 4h12m.
limits=""
if [ -n "$five_h" ]; then
  seg="5h:$(printf '%.0f' "$five_h")%"
  [ -n "$five_reset" ] && [ "$five_reset" -gt 0 ] 2>/dev/null && seg="$seg ($(fmt_until "$five_reset"))"
  limits="$(pct_color "$five_h")${seg}${RESET}"
fi
if [ -n "$seven_d" ]; then
  seg="7d:$(printf '%.0f' "$seven_d")%"
  [ -n "$seven_reset" ] && [ "$seven_reset" -gt 0 ] 2>/dev/null && seg="$seg ($(fmt_until "$seven_reset"))"
  limits="${limits:+$limits }$(pct_color "$seven_d")${seg}${RESET}"
fi
[ -n "$limits" ]  && out="${out} ${limits}"

printf '%s\n' "$out"
