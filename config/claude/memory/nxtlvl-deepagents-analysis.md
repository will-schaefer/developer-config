---
name: nxtlvl-deepagents-analysis
description: Mode-A whole-harness review of LangChain deepagents at docs/reference/deepagents-analysis.md; also the live test bed that validated the harness-review right-size edit.
metadata: 
  node_type: memory
  type: reference
  originSessionId: c62f0268-7674-4277-b71d-cd089f6cad4d
---

Mode-A general review of **deepagents** (LangChain, "the batteries-included agent harness") at
`docs/reference/deepagents-analysis.md`. Reviewed 2026-06-20, ~4.4/5 reference-grade.

SPINE = **compose-don't-fork**: one `create_deep_agent` factory (`graph.py:236`) assembles an ordered
middleware stack + pluggable `BackendProtocol` backends + per-model Provider/Harness profiles over
LangChain `create_agent`/LangGraph, and that *same recipe* builds the main agent, every subagent, and
all three delivery shells (TUI `libs/code` 53k LOC, ACP bridge `libs/acp`, deploy-only `libs/cli`) by
injection, never forking. Robustness is **engineered not asserted** (un-excludable scaffolding raises;
3-stage fail-loud exclusion validation that errors on a no-op exclusion; permissions enforced at 14+
sites; threat-model-as-shipped-code; 2.2:1 test:src). Honest ceiling = thin layer over LangGraph
(correctness partly upstream-PR-pinned) + a god-function/god-module smell (630-line factory, 12.7k
`app.py`). Mineable for nxtlvl: inject-into-one-factory composition, ordered-registry+ABC extension,
fail-loud config validation, enforced permissions. Confirms the [[nxtlvl-reference-domain-map]]
"code-runtime capability-in-Python" note (deepagents' substance is Python, not `.claude/` surfaces).

METHODOLOGY NOTE: this run was ALSO the live test that validated the `harness-review` "right-size the
run" edit — a real main-session Mode-A fan-out (the mechanism Mode-C-in-a-subagent evals can't reach).
Paired edited-vs-snapshot domain agents showed the edit proportions correctly on a mixed-richness
harness (lean on thin periphery — 25% fewer tool calls, same findings; no under-investment on the rich
core). See [[nxtlvl-harness-review]] and the workspace `harness-review-workspace/iteration-3/`.
