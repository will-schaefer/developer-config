# Memory Index

One line per memory — detail lives in the topic file. Grouped for fast orientation.

## User & working style
- [User: builder domain](user-builder-domain.md) — multi-language app dev (Next/Python/Rust) + agentic engineering & agent-building.
- [User: Max subscription](user-max-subscription.md) — on Claude Max; per-token cost tracking is irrelevant — drop cost machinery by default.
- [User: 1M context, degrades ~150–200K](user-1m-context-degradation.md) — runs a 1M-window model but quality degrades ~150–200K; that band is the practical ceiling, not the cap.
- [TypeScript over JavaScript](typescript-over-javascript-default.md) — standing default: TS over JS (no new JS); polyglot Py/Rust when best; nxtlvl runs native type-stripping (ADR-034).
- [Prefers visual diagrams](prefers-visual-diagrams.md) — "seeing it always helps" — default to rendering diagrams/visuals for anything structural.
- [Grill branch-by-branch](grill-branch-by-branch.md) — wants exhaustive multi-pass, one-question-at-a-time design interrogation.
- [Terse confirms = momentum](terse-confirms-momentum.md) — one-word locks; acknowledge in one line and advance.

## How I should work (doctrine & feedback)
- [Compose on native, quality-first](compose-on-native-quality-first.md) — decision lens = "what gives higher quality"; prefer composition over rebuilding.
- [Quality over simplicity](harness-lab-quality-over-simplicity.md) — agent quality is top priority; heavier machinery OK if it raises quality; don't YAGNI the gate down.
- [Hooks inform, don't force](harness-hooks-inform-not-force.md) — hooks surface signals, never interrupt/steer mid-task; behavior-shaping lives in workflow rules.
- [Distill reusable → doc + memory](distill-reusable-to-doc-plus-memory.md) — log reusable findings as a docs/reference/ doc + a memory pointer; default destination, don't re-ask.
- [Analyze ALL harnesses before deciding](analyze-all-harnesses-build-decisions.md) — for any harness-build decision, review all reference harnesses via harness-review first; agent-skills isn't a default.
- [Decision-recording conventions](decision-recording-conventions.md) — formalized as the global decision rule (~/.claude/rules/decisions.md); ADRs in docs/decisions/, YAML frontmatter, curated.
- [ADRs advisory, not canonical](adrs-advisory-not-canonical.md) — on nxtlvl, reference ADRs but don't treat them as binding; record overrides.
- [Meta-skill discoverability](meta-skill-discoverability-in-plumbing.md) — router/meta-skills don't fire via description; wire entry into the floor brief, not frontmatter.
- [Component-scoping doctrine](ecc-component-scoping-doctrine.md) — when to build agent vs skill vs command vs hook vs rule; full guide at docs/reference/ecc-agent-vs-skill-scoping.md.
- [ADR numbering collision hazard](adr-numbering-collision-hazard.md) — doc-keeper numbers ADRs by globbing the working tree; verify vs committed/remote tree to avoid dups.

## Claude Code platform facts
- [TS migration: verbatim+import.meta vs typeless](ts-migration-verbatim-importmeta-typeless-conflict.md) — nodenext+typeless classifies ESM .ts as CJS → verbatimModuleSyntax (TS1295/1287) + import.meta (TS1470) fail tsc though Node runs it; use module=preserve/bundler mid-migration, nodenext+type:module at the final gate.
- [Context-hook facts](cc-context-hook-facts.md) — live context = transcript usage sum (no context_window in PostToolUse); /compact not programmatically triggerable; PreCompact CANNOT inject context (no output-union branch, v2.1.191) — use SessionStart source:compact.
- [UserPromptSubmit sessionTitle](cc-userpromptsubmit-sessiontitle.md) — sessionTitle isn't SessionStart-only; UserPromptSubmit can set it too (per-prompt); emit under hookSpecificOutput.
- [Hook env propagation](cc-hook-env-propagation.md) — inline `VAR=x claude` may not reach the process; settings `env` field reaches hooks AND hot-reloads; secrets stripped.
- [CLAUDE.md layering](cc-claudemd-layering-facts.md) — global always-on; @import inlines vs plain path = on-demand; project loads last & wins; arbitrary ~/.claude files not auto-loaded.
- [Sandbox blocks localhost](cc-sandbox-localhost-blocked.md) — sandbox net allowlist blocks loopback too; curl to 127.0.0.1 = HTTP 000 until sandbox off.
- [Sandbox blocks keychain auth](cc-sandbox-blocks-keychain-auth.md) — sandbox blocks macOS keychain → git push / gh "auth failed" are FALSE signals; re-run sandbox-off before re-authing.
- [Workflow args not array](cc-workflow-args-not-array.md) — Workflow tool `args` may not arrive as a native array; generate the list in-script or guard with Array.isArray/JSON.parse.

## Environment & repo
- [~/.claude config repo](claude-config-repo.md) — Developer repo is the SOURCE for global CC config (config/claude/*); ~/.claude/* symlink in; PR→main, remote will-schaefer/developer-config.
- [Developer repo git workflow](developer-repo-git-workflow.md) — solo, commit directly to main, don't branch for routine work, don't push unless asked; the 'epitaxy' parallel-committer was retired 2026-06-25 (was a transient session behavior, not a daemon).
- [Disable ecc active hooks in dev](disable-ecc-active-hooks-dev.md) — ecc dormant via enabledPlugins."ecc@ecc":false (flip to re-enable); ECC_GATEGUARD=off was ineffective.
- [nxtlvl install/promotion](nxtlvl-install-promotion.md) — installed nxtlvl is a SHA-pinned cache snapshot, not a live repo read; committed work needs a manual /plugin promote; repo HEAD runs ahead.

## nxtlvl — project & subsystem status
- [nxtlvl harness (anchor)](nxtlvl-harness.md) — the personal CC agent-harness plugin; intent doc docs/intent/personal-harness.md, ADRs docs/decisions/; reactive vendoring; hook stdin field shapes.
- [Agent runtime primer](agent-runtime-primer.md) — runtime anatomy + native-vs-DIY ledger (docs/reference/agent-runtime-primer.md); nxtlvl's substance lives ABOVE the loop, so composing keeps it.
- [C&M subsystem status](nxtlvl-context-memory-subsystem.md) — C&M domain PROMOTED & LIVE (2026-06-22): installed snapshot==repo HEAD, all 6 hooks firing, Checkpoints A–D verified, fallback 0/137.
- [Context-alert hook](nxtlvl-context-alert-hook.md) — two-stage hook (200K FYI + 325K notify-only backstop, never stops) MERGED via PR #1; next = Checkpoint A install-observe; Hook 2 (PreCompact) is Phase 2.
- [dangerous-bash gate](nxtlvl-dangerous-bash-gate.md) — first blocking gate BUILT & LIVE (Node, exit-2, kill switch); 53-case test; raw-string match → still trips on commands that describe dangerous ops.
- [harness-lab status](nxtlvl-harness-lab-status.md) — incubation tier BUILT (T1–T13, 63 tests, gate doubt-reviewed); NOT a plugin — dogfood as project skills (.claude/skills→../cells); manual dogfood remains.
- [Ideation domain status](nxtlvl-ideation-domain-status.md) — front door (idea→approved direction), WIDE-SPECTRUM not software-only; executor=main-thread skill; pass-1 agents/commands BUILT, refined skills + router pending.
- [Context7 grounding status](nxtlvl-context7-grounding-status.md) — Context7 docs-grounding BUILT (T1–T4) + merged to main, promote-gated; ADR-030 (Context7 testifies: CITE doc URL@version); T5 manual smoke pending.
- [harness-review DeepWiki accelerator](nxtlvl-harness-review-deepwiki.md) — /harness-review command + DeepWiki Phase-2 orientation accelerator (ADR-029: leads-not-evidence, public-GitHub-only); dogfood promote-gated.

## Reference: ECC
- [ECC component map](ecc-component-map.md) — full 589-item map of reference/ECC-main at docs/reference/ecc-main-map.md; mine it instead of re-scanning.
- [ECC knowledge graph](ecc-knowledge-graph.md) — interactive understand-anything graph of ECC-main (1944 nodes) at reference/ECC-main/.understand-anything/; view via /understand-dashboard.

## Harness reviews — reference/ corpus (mine, don't re-scan)
- [reference/ repo map (breadth)](nxtlvl-reference-repo-map.md) — orientation map of all 13 vendored harnesses (docs/reference/reference-repo-map.md): identity/lang/size tables + A/B/C capsules; pick deep-review targets.
- [reference/ domain map (capability)](nxtlvl-reference-domain-map.md) — capability companion (docs/reference/reference-domain-map.md): 13 domains × 13 harnesses matrix + mining shortlist; HEADLINE = Trellis is the standout.
- [Harness adopt/adapt backlog](nxtlvl-harness-adopt-backlog.md) — the live cross-harness ADOPT/ADAPT ledger (docs/plan/nxtlvl-harness-adopt-backlog.md); stable IDs, status lifecycle; every /harness-review appends here.
- [agent-skills vs superpowers](agent-skills-vs-superpowers-domain-map.md) — agent-skills (horizontal SDLC lib) vs superpowers (vertical orchestration spine); domain map + 2 per-skill distillations; 9 overlap verdicts.
- [hooks-mastery distillation](nxtlvl-hooks-mastery-distillation.md) — disler/hooks-mastery: "hooks force" rhetoric vs one-gate+fail-open corroborates inform-don't-force; top adopt = read-only-by-withheld-tools.
- [agentic-os distillation](nxtlvl-agentic-os-distillation.md) — agent-dev:agentic-os: per-project-scaffold vs nxtlvl portable-plugin; top adopt = Memory Scope per-agent read-contract; mostly reject.
- [claude-code-templates distillation](nxtlvl-cct-distillation.md) — davila7/cct: a distribution CATALOG not a peer; top adopt = 5-axis validator → pre-git-mv promotion gate (likely ADR).
- [toolkit distillation](nxtlvl-toolkit-distillation.md) — rohitg00/awesome-claude-code-toolkit: rules/+contexts/ lens, mostly REJECT; spine = activation is the dividing line; confirms nxtlvl by contrast.
- [deepagents Mode-A](nxtlvl-deepagents-analysis.md) — LangChain deepagents (~4.4/5, reference-grade): spine = compose-don't-fork (one create_deep_agent factory); ceiling = thin-layer-over-LangGraph.
- [hive Mode-A](nxtlvl-hive-analysis.md) — aden-hive/hive (~3.5–3.8): two-tier graph-of-agents + curated-.md memory; capped by trusted-by-default security; first DeepWiki-accelerator dogfood (leads stale).
- [CodeWhale Mode-A + Mode-B](nxtlvl-codewhale-analysis.md) — Hmbown/CodeWhale (Rust, ~3.6): reference-grade engine on mid-migration drift (needs CI drift-checker) + no-lying-state must be uniform.
- [Trellis distillation](nxtlvl-trellis-distillation.md) — mindfold-ai/Trellis: real dogfooded spec-driven framework; spine = single-source the contract / multi-source delivery (both in one repo); TREL-01..15.
- [Scripts-review sweep (all 13)](nxtlvl-scripts-review-sweep.md) — DOMAIN=scripts audit of all 13 harnesses; script-craft INVERTS whole-harness reputation; ADOPT = CodeWhale execpolicy arity-dict for dangerous-bash-gate.
- [ruflo distillation](nxtlvl-ruflo-distillation.md) — ruvnet/ruflo: functional maximalist whose shipped code collapses onto nxtlvl's LOCKED positions; memory has a degraded mode that LIES; harvest = hygiene only.
- [ruflo discovery review](nxtlvl-ruflo-discovery-review.md) — ruflo discovery/ideation (≈3/5): NO ideation domain, encoded ~5× no router/source-of-truth; lesson = capability only as good as routing between copies.
- [ruflo hooks review](nxtlvl-ruflo-hooks-review.md) — ruflo hooks (≈2.5/5): registration drift (6 reg files/4 dialects); MINE = layered fail-open + injection-safe jq|tr|xargs-0; fail-CLOSED executor is the cap.
- [ruflo-adr distillation](nxtlvl-ruflo-adr-distillation.md) — ruflo-adr plugin: SPLIT-BRAIN (surface claims AgentDB, code writes elsewhere); ADOPT verify.mjs DFS cycle-detector + two-tier exit for §5 ADR-integrity audit.
- [ruflo plugins map](nxtlvl-ruflo-plugins-map.md) — structural map of ruflo's 35 marketplace plugins (docs/reference/ruflo-plugins-map.md): 3 disagreeing counts, 24 wrappers + 9 substantive; low mining value.
- [SuperClaude planning review](nxtlvl-superclaude-planning-review.md) — SuperClaude v4.3 planning (≈2/5): commands don't delegate, modes+core are DEAD TEXT; high-water = RULES.md tiered priority/conflict hierarchy.
- [SuperClaude discovery review](nxtlvl-superclaude-discovery-review.md) — SuperClaude brainstorm+deep-research (≈2/5): depth lives in DEAD files, loaded files are STALE truncations; same encoded-N×-routed-0× shape.
