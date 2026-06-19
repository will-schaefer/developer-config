---
name: cc-userpromptsubmit-sessiontitle
description: CC platform fact — UserPromptSubmit hooks CAN set sessionTitle (not SessionStart-only); per-prompt titling tracks branch changes.
metadata: 
  node_type: memory
  type: reference
  originSessionId: 620c1f23-bc55-4f6e-8488-88e3ff33ff66
---

`sessionTitle` is **not** SessionStart-only. A `UserPromptSubmit` hook can also set
the session title (docs: code.claude.com/docs/en/hooks#userpromptsubmit-decision-control
lists `sessionTitle` alongside `decision`/`reason`/`additionalContext`/`suppressOriginalPrompt`,
"name sessions automatically based on the prompt content"). Because it fires **per
prompt**, it re-titles mid-session — so `<folder> · <branch>` tracks branch switches,
which the SessionStart version couldn't.

Output shape (CONFIRMED against the official JSON example): emit `sessionTitle` under
`hookSpecificOutput` with `hookEventName: "UserPromptSubmit"` — same wrapper as
`additionalContext`. In the docs example `decision`/`reason` sit at the TOP level while
`additionalContext`/`sessionTitle` are nested inside `hookSpecificOutput`. Omit `decision`
so the prompt proceeds. nxtlvl's hook emits exactly this shape and is correct as-is.

Tradeoff of per-prompt titling: it re-sets the title every prompt, so a manual `/rename` is
overwritten on the next prompt — and the UserPromptSubmit input exposes no `session_title`
field to guard against it (unlike SessionStart), so there is no clean no-clobber check.

Caution — WebFetch is unreliable for fine-grained table facts on this page: it claimed
sessionTitle was SessionStart-only TWICE (once a summary, once even a "verbatim" extraction
that silently dropped the `sessionTitle` and `suppressOriginalPrompt` rows). Root cause: the
decision-control *overview* table lists only `decision`/`reason` as UserPromptSubmit "key
fields", and sessionTitle is *also* documented in the SessionStart section with a different
blurb — so a skimming model concludes "SessionStart-only". The per-event "UserPromptSubmit
decision control" section is authoritative and DOES list `sessionTitle` ("name sessions
automatically based on the prompt content") + `suppressOriginalPrompt`. **Trust the actual
rendered page (the user's paste) over any WebFetch output — even when you asked for verbatim.**
nxtlvl's hook lives at `plugins/nxtlvl/hooks/session-title.js`, wired under `UserPromptSubmit`
in `hooks.json`. Related: [[cc-context-hook-facts]], [[nxtlvl-hooks-mastery-distillation]].
