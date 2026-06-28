---
description: Fold inbox/ scratch notes into the wiki
---

Process every note in `inbox/` (ignore `.gitkeep`). For each note:

1. **Classify** it into a taxonomy cluster (`CLAUDE.md`). If off-scope, set it aside and
   tell the user — do not ingest.
2. **Fold it in:**
   - If it references an external source, treat it as an `/ingest` source: capture to
     `raw/` first, then compile.
   - If it is a fleeting idea, fold it directly into the relevant `wiki/` page(s) via the
     same compile path as `/ingest` — frontmatter floor, `[[wikilinks]]`, and `[^n]`
     citations wherever it makes a substantive claim.
3. **Remove** the consumed note from `inbox/`.
4. **Log.** Append a `log.md` entry: `YYYY-MM-DD — /process-inbox — <N> notes folded`.
