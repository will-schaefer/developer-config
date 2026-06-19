# agent-skills vs superpowers — Comparative Domain Map

> Distilled 2026-06-19 from a two-phase parallel-subagent scan of two installed Claude Code
> plugins: **agent-skills** v1.0.0 (`~/.claude/plugins/cache/addy-agent-skills/agent-skills/a5f0b176381e/`,
> 24 skills) and **superpowers** v6.0.3
> (`~/.claude/plugins/cache/claude-plugins-official/superpowers/6.0.3/`, 14 skills). Every
> skill's `SKILL.md` (+ support files) was read in full; the 5 closest overlapping workflows
> got head-to-head deep reads. **Purpose:** a reusable adopt/adapt/reject backlog for the
> nxtlvl build, so harness-component decisions cite a comparison instead of re-running the scan.
> Companion to the **ecc** distillations ([ecc-main-map.md](ecc-main-map.md),
> [ecc-agent-vs-skill-scoping.md](ecc-agent-vs-skill-scoping.md)) — ecc is the third reference
> harness to triangulate against for any build decision.

---

## 1. The headline thesis

**agent-skills is a horizontal SDLC library. superpowers is a vertical agent-orchestration spine.**

- **agent-skills** — one broad, well-structured skill per **engineering discipline** (API design,
  security, performance, observability, frontend, CI/CD, docs, migration…). Breadth across
  *what you build*. Skills are *domain-named*.
- **superpowers** — narrow, hard-enforced skills for **how an agent drives multi-step work**
  (dispatching subagents, worktree isolation, branch-finishing, plan execution, skill-authoring).
  Depth on *how the agent operates*. Skills are *verb/process-named*.

They are **more complementary than competitive.** Of 38 skills, only ~9 workflows truly overlap —
the universal disciplines both *had* to solve. Those 9 are the only places "which is better" is a
meaningful question; everywhere else, the answer is "adopt both, they cover different planes."

**Recurring quality pattern across the overlaps:** *agent-skills wins on completeness/content depth;
superpowers wins on enforcement and battle-testing.* agent-skills knows more; superpowers makes the
agent actually do it (skills authored TDD-style, ship `CREATION-LOG`s of adversarial testing, cite
measured outcomes). So the default nxtlvl move on a contested workflow is **"agent-skills brain +
superpowers enforcement spine."**

---

## 2. Full inventory by domain

| Domain | agent-skills | superpowers | Overlap? |
|---|---|---|---|
| Ideation / front-door | `idea-refine`, `interview-me` | `brainstorming` | ✅ |
| Spec / requirements | `spec-driven-development`, `interview-me` | (folded into `brainstorming`) | partial |
| Planning | `planning-and-task-breakdown` | `writing-plans` | ✅ |
| Plan execution | `incremental-implementation` | `subagent-driven-development`, `executing-plans` | ✅ |
| Testing / TDD | `test-driven-development`, `browser-testing-with-devtools` | `test-driven-development` | ✅ |
| Debugging | `debugging-and-error-recovery` | `systematic-debugging` | ✅ |
| Code review | `code-review-and-quality` | `requesting-code-review`, `receiving-code-review` | ✅ |
| Verification | `doubt-driven-development` | `verification-before-completion` | ✅ |
| Git / versioning | `git-workflow-and-versioning` | `using-git-worktrees`, `finishing-a-development-branch` | ✅ |
| Meta / router | `using-agent-skills` | `using-superpowers` | ✅ |
| Skill authoring | — | `writing-skills` | superpowers-only |
| Parallel-agent dispatch | — | `dispatching-parallel-agents` | superpowers-only |
| API design | `api-and-interface-design` | — | agent-skills-only |
| Frontend UI | `frontend-ui-engineering` | — | agent-skills-only |
| Security | `security-and-hardening` | — | agent-skills-only |
| Performance | `performance-optimization` | — | agent-skills-only |
| Observability | `observability-and-instrumentation` | — | agent-skills-only |
| CI/CD | `ci-cd-and-automation` | — | agent-skills-only |
| Shipping / release | `shipping-and-launch` | — | agent-skills-only |
| Refactoring | `code-simplification` | — | agent-skills-only |
| Context / token mgmt | `context-engineering` | — | agent-skills-only |
| Deprecation / migration | `deprecation-and-migration` | — | agent-skills-only |
| Docs / ADRs | `documentation-and-adrs` | — | agent-skills-only |
| Doc-grounding | `source-driven-development` | — | agent-skills-only |

---

## 3. Overlap zone — quality verdicts (9 shared workflows)

Verdicts 1–5 are from head-to-head deep reads; 6–9 are judged complementary from full profiles.

| # | Workflow | Higher quality | Verdict rationale | nxtlvl recommendation |
|---|---|---|---|---|
| 1 | **Testing / TDD** | **agent-skills** (4/7 dims) | More complete & agent-native: test sizing, pyramid, browser verification, untrusted-data boundary, no-rerun token rule. superpowers wins raw enforcement + real-incident anti-patterns. | Base on agent-skills; graft superpowers' "Iron Law" + delete-and-restart + the `testing-anti-patterns.md` file + progressive disclosure. |
| 2 | **Debugging** | **superpowers** (slim) | Hard "Iron Law" + 3-fix architectural circuit-breaker + *measured* impact (95% vs 40% first-fix) + runnable `find-polluter.sh`. agent-skills is the more complete single-file reference. | Base on superpowers; graft agent-skills' "untrusted error output" section + non-reproducible-bug decision tree + inline `git bisect`. |
| 3 | **Planning** | **tie (lean superpowers)** | agent-skills owns sizing rubric + dependency graph + parallelization; superpowers owns zero-context exact-handoff + plan self-review + reviewer subagent. | Base on superpowers (matches subagent-executed model); graft agent-skills' XS–XL sizing table, dependency/parallelization taxonomy, rationalizations table. |
| 4 | **Ideation / front-door** | **agent-skills** (5/8 dims) | Deeper *thinking apparatus*: confidence-numbered guess-attached interview, want-vs-should-want, framework library, anti-sycophancy. superpowers has the hard gate, committed spec, novel interactive visual server. | Anchor on agent-skills' reasoning machinery (nxtlvl is already building its own front-door); graft superpowers' `<HARD-GATE>`, committed dated spec + terminal hand-off, optional just-in-time visual (re-express via nxtlvl visualize widget). |
| 5 | **Meta / router** | **superpowers** (5/8 dims) | Wins enforcement (1%-rule, Red-Flags table) + self-trigger/recursion design (`<SUBAGENT-STOP>`, precedence ladder, cross-platform portability). agent-skills has the better routing map + conduct rules. | Base on superpowers; graft agent-skills' task→skill **routing table** (keep it data-driven, not hardcoded names) + conduct block. **Self-trigger confirmed unsolved by description alone → wire entry via the floor brief, not frontmatter.** |
| 6 | **Code review** | **complementary** | agent-skills = the 5-axis review *standard/content*; superpowers = the review *mechanism* (subagent reviewer template + anti-sycophantic response discipline in `receiving-code-review`). | Take both. agent-skills rubric as content (already vendored as `nxtlvl:review`); superpowers requesting/receiving as the mechanism. |
| 7 | **Verification** | **complementary** | Different layers: agent-skills `doubt-driven-development` = in-flight adversarial fresh-context review (+ cross-model escalation); superpowers `verification-before-completion` = run-the-command-before-claiming completion gate. | Adopt both — distinct layers (decision-time vs completion-time). |
| 8 | **Git / branch** | **complementary (superpowers owns mechanics)** | superpowers has hard-won worktree/branch-finishing plumbing; agent-skills has commit hygiene + change-summary discipline. | superpowers for worktree/finish mechanics, agent-skills for commit philosophy. ⚠️ Both partly conflict with the epitaxy "never amend/rebase/force" workflow — adapt. |
| 9 | **Plan execution** | **superpowers** (for orchestration) | `subagent-driven-development` is the crown jewel — file-handoffs, compaction-survivable ledger, measured failure modes. agent-skills `incremental-implementation` is solo vertical-slicing. | Adopt superpowers `subagent-driven-development` as the spine; graft agent-skills' slicing strategies + no-rerun-on-unchanged-code rule. |

---

## 4. Unique skills (no counterpart in the other plugin)

**Only in agent-skills (13 — the SDLC breadth):**
`api-and-interface-design` · `frontend-ui-engineering` · `security-and-hardening` (SSRF + OWASP-LLM-Top-10 — standout) · `performance-optimization` · `observability-and-instrumentation` · `ci-cd-and-automation` · `shipping-and-launch` · `code-simplification` · `context-engineering` · `deprecation-and-migration` · `documentation-and-adrs` · `source-driven-development` (doc-grounded anti-hallucination) · `browser-testing-with-devtools`

**Only in superpowers (5 — the orchestration spine):**
`subagent-driven-development` (★ most battle-tested artifact in either plugin) · `dispatching-parallel-agents` · `using-git-worktrees` · `finishing-a-development-branch` · `writing-skills` (most evidence-driven skill — empirical SDO/description findings)

---

## 5. Craftsmanship & house-style differences

| Aspect | agent-skills | superpowers |
|---|---|---|
| Authoring discipline | Uniform template every skill: Common Rationalizations table + Red Flags + Verification checklist | TDD-for-skills (baseline-failure → minimal skill → close loopholes); `CREATION-LOG`s document adversarial pressure-tests |
| Structure | Mostly single self-contained `SKILL.md`; inline ASCII flowcharts/tables | Thin `SKILL.md` + **progressive disclosure** to support files; graphviz flowcharts; runnable scripts |
| Evidence | Illustrative/synthetic examples | Dated real sessions + **measured** outcomes; real human-correction quotes |
| Portability | Single-platform (assumes one harness) | Cross-runtime: 6 per-platform tool-mapping refs (Claude Code/Codex/Copilot/Gemini/Pi/antigravity) |
| Shared idioms | Three-tier "Always / Ask-first / Never" boundary system recurs (security + spec) | Context-hygiene thesis ("never inherit session context — construct exactly what's needed") recurs |

**Quality defects to fix on adoption (agent-skills):** 6 skills cite `references/*.md` files that **do
not exist** in the cache — dangling "See Also" links in `code-review-and-quality`,
`frontend-ui-engineering`, `performance-optimization`, `security-and-hardening`, `shipping-and-launch`,
`test-driven-development`. `idea-refine` hardcodes a `/mnt/skills/user/...` path that won't resolve in
a plugin-cache install. superpowers skills are more self-contained (support files actually ship).

**superpowers caveat:** its main flowcharts are raw graphviz `dot` blocks that don't render in-context
(it ships `render-graphs.js` to convert offline); agent-skills' rendered ASCII flowcharts are more
immediately scannable.

---

## 6. Adopt / adapt / reject backlog for nxtlvl

- **Adopt wholesale from superpowers** (no agent-skills equivalent; this *is* the harness-operation
  layer nxtlvl is building): `subagent-driven-development`, `dispatching-parallel-agents`,
  `using-git-worktrees`, `finishing-a-development-branch`, `writing-skills`.
- **Adopt wholesale from agent-skills** (no superpowers equivalent): the SDLC discipline skills —
  especially `security-and-hardening`, `observability-and-instrumentation`, `source-driven-development`,
  `api-and-interface-design`. (`code-review-and-quality` already vendored as `nxtlvl:review`.)
- **Merge on the 5 contested overlaps** per §3 — generally *agent-skills content + superpowers
  enforcement/structure*. Each merge is an **ADR-worthy boundary decision** (architectural +
  expensive to reverse).
- **Reject / be wary:** agent-skills' dangling `references/` links (fix-on-adopt); git skills' commit
  cadence where it collides with the epitaxy automation.

---

## 7. Method note

This scan used a scout → fan-out → synthesize pattern: 5 parallel scanner subagents profiled all 38
skills to a uniform schema, then 5 parallel comparator subagents deep-read the closest overlapping
pairs and rendered per-dimension verdicts. The pattern is reusable for any future harness review and
fits the nxtlvl build method (review harnesses → distillations land in `docs/reference/` → decisions
become ADRs). The standing rule going forward: **triangulate harness-build decisions across all three
reference harnesses — superpowers, agent-skills, and ecc.**
