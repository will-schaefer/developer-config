# CLAUDE.md — nxtlvl workbench

This repo builds **nxtlvl**, a personal Claude Code harness. Anchor:
[`docs/intent/personal-harness.md`](docs/intent/personal-harness.md). Decisions (ADRs):
[`docs/decisions/`](docs/decisions/).

## Build method — review harnesses to shape ours (read before working the build)
nxtlvl is shaped in part by **systematically reviewing existing agent harnesses** and deciding,
area by area, what to **adopt / adapt / reject** — primarily the **ecc** plugin (vendored at
`reference/ECC-main/`, kept installed-but-dormant per
[ADR-002](docs/decisions/ADR-002-ecc-dormant-reference-backstop.md)), and **potentially other
harnesses over time**. Reviewing ecc is expected and intended, not a dependency to hide.
Distillations land in [`docs/reference/`](docs/reference/); each decision becomes an ADR. The
main session orchestrates and delegates — **when spawning a subagent during the build, pass this
method along** so it knows we study harnesses to shape ours.
