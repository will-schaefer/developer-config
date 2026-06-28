---
id: ADR-030
title: "Context7 testifies: primary sources, version-pinned — the inverse-companion to ADR-029"
status: Accepted
date: 2026-06-21
implementation: build plan forthcoming; capability not yet shipped
---

# ADR-030: Context7 testifies — primary sources, version-pinned

## Context

nxtlvl is adding a self-contained Context7 MCP docs-grounding capability: the plugin's second
`.mcp.json` server entry, a read-only `context7-scout` agent, a contract doc
(`references/context7-grounding.md`), and an nxtlvl-owned entry point (direct spawn + optional
`/context7` command). The harness today grounds all library/API reasoning in the model's training
cutoff — a gap this session surfaced concretely (an authoritative-sounding hook-event list was
stale; Context7 corrected it).

The load-bearing question is **trust posture**. [ADR-029](ADR-029-deepwiki-orientation-not-evidence.md)
ruled DeepWiki a **secondary source** (auto-generated prose, can be stale or hallucinated) and
assigned it "leads, not evidence; zero citations reach artifacts." Context7 serves **official
library docs** — it is **primary-derived**, so that posture must invert: its output *may* be cited.
But Context7 is a third-party snapshot that can lag latest or mis-rank snippets, so the trust must
be disciplined. ADR-029 itself anticipated this generalization: "secondary sources orient, primary
sources testify… generalizes to any future third-party knowledge source."

This is a trust boundary — architectural (shapes how every doc-grounded claim is produced and
cited) and expensive to reverse (a citation pattern propagates across every future task that
consumes the scout) — hence an ADR.

Governed by the decision rule ([ADR-010](ADR-010-global-decision-rule.md)). Source of truth:
[`docs/spec/nxtlvl-context7-docs-grounding.md`](../spec/nxtlvl-context7-docs-grounding.md).

## Decision

**A primary source may testify — but cite the source it delivered, version-pinned, not the courier
that delivered it.**

Concretely:

1. **Context7 produces evidence, not just leads** — the inverse of ADR-029. The `context7-scout`
   brief is citable; its claims may reach artifacts and downstream reasoning.

2. **Courier-vs-witness citation discipline.** Every claim the scout returns is stamped
   `CITE — /org/project@version + doc URL`. The citation is to the **official doc URL** at a
   **resolved library version**, never to "Context7" itself. Context7 is the courier; the official
   doc is the witness. For correctness-critical or version-sensitive facts the doc URL is named as
   the authority.

3. **Read-only by withheld tools** — the `context7-scout` holds *only* the two
   `mcp__plugin_nxtlvl_context7__*` tools (no Read/Write/Edit/Bash/Glob/Grep). A fabricated or
   mis-attributed citation is made **structurally impossible**: the scout cannot write the tree.
   Reuses [ADR-026](ADR-026-ideation-domain-orchestrator-skill-isolated-agents.md)'s isolated-agent
   pattern (the same mechanism as `deepwiki-scout` and `context-scout`).

4. **Graceful degradation, never a hard dependency.** Unreachable server or unknown library → the
   scout emits a one-line "unavailable" with a "model knowledge may be stale" caveat and returns.
   Context7 is never a blocker. Per [ADR-027](ADR-027-router-endorses-only-established-items.md),
   wiring into un-owned consumer skills (`source-driven-development`, `claude-api`,
   `agent-development`) is **deferred** until those are vendored.

5. **Bounded spend.** 1 `resolve-library-id` + ≤3 `query-docs` per grounding session.

Realized as: a `context7` entry in `plugins/nxtlvl/.mcp.json`, the `context7-scout` agent,
`plugins/nxtlvl/references/context7-grounding.md` (the trust contract), and an nxtlvl-owned entry
point. Build is deferred to a forthcoming plan.

## Alternatives Considered

### Treat Context7 as leads-only (same posture as DeepWiki)
- Pros: simpler uniform policy; no citation machinery needed.
- Cons: needlessly discards citable official-doc evidence. The staleness/mis-ranking risk is
  handled by URL+version attribution and the "confidence/caveats" section of the brief, not by
  excluding the source entirely.
- Rejected: the whole point of reaching out to Context7 is to ground claims in primary docs.
  Excluding citation defeats the purpose.

### Cite "Context7" as the source
- Pros: simpler attribution; one token instead of a URL.
- Cons: Context7 is the courier, not the witness. Citing it hides which primary doc and version
  actually grounds the claim, and the citation becomes meaningless if Context7 disappears or
  changes its indexing.
- Rejected: the citation must name the primary doc URL + version — the witness, not the courier.

### Give the scout normal tools; trust prompt discipline
- Pros: simpler; one fewer constraint.
- Cons: makes a fabricated or mis-attributed citation a prompt-adherence matter rather than a
  structural impossibility. Withheld tools cost nothing and remove the failure mode entirely.
- Rejected: same reasoning as ADR-029 for `deepwiki-scout`. Read-only-by-withheld-tools is the
  durable guarantee.

### Make Context7 a required dependency
- Pros: uniform pipeline; no degradation branch.
- Cons: turns a free, no-auth service into a brittle hard dependency. Any network issue or
  rate-limit exhaustion would block the caller.
- Rejected: must degrade silently, never block — mirrors ADR-029's degradation requirement.

### Don't adopt Context7
- Pros: zero new surface; no trust question to manage.
- Cons: leaves the harness grounding in the model's training cutoff for all library/API facts.
  This session empirically hit this failure. DeepWiki already orients on other repos; Context7 is
  the natural sibling for official library docs.
- Rejected: the capability gap is real and this session validated the fix.

## Consequences

- **Completes ADR-029's doctrine into a matched pair.** Secondary sources orient
  (DeepWiki → leads); primary sources testify with attribution (Context7 → cited evidence). The
  doctrine is now a two-pole trust tier, not a one-off ruling.

- **A reusable trust-tier framework** now governs three knowledge sources, each enforced
  structurally by withheld tools: DeepWiki = orient (leads only), Context7 = testify-with-URL+version,
  C&M store = self-observed/learned. New third-party knowledge sources inherit the framework.

- **The plugin gains its second `.mcp.json` server** — a new dependency surface (remote HTTPS,
  no-auth free tier). It is non-load-bearing: if the service vanishes, the scout degrades to a
  one-line caveat and the caller falls back to model knowledge.

- **The cite-the-URL+version rule is testable by dogfood:** 100% of scout claims carry a
  `CITE — URL @ version`; zero uncited assertions in any brief. This is a binary, automatable
  check consistent with the objective-gate discipline of [ADR-009](ADR-009-objective-invoked-audit-gate.md).

- Cross-links: [ADR-029](ADR-029-deepwiki-orientation-not-evidence.md) (inverse companion),
  [ADR-026](ADR-026-ideation-domain-orchestrator-skill-isolated-agents.md) (isolated-agent pattern
  reused), [ADR-027](ADR-027-router-endorses-only-established-items.md) (consumer-wiring deferral),
  [ADR-010](ADR-010-global-decision-rule.md) (decision rule).
