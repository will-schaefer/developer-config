---
name: crop
description: >
  Crop fullscreen macOS screenshots (Cmd+Shift+3) in vault Staging to the embedded
  photo, then tighten around the main subject (the babe) when vision shows extra
  background can be removed without clipping her. Scans ~/vault/Staging for
  "Screen Shot …" / "Screenshot …" files at display resolution, strips browser
  chrome and margins, and writes "- cropped.png" / "- subject.png" siblings.
  Use when the user runs /crop, asks to crop staging screenshots, isolate the
  photo from a fullscreen capture, or tighten a screenshot around the subject.
---

# Crop staging screenshots

Turn fullscreen captures in **Staging** into clean subject-focused images.

**Staging directory:** `~/vault/Staging` (override only if the user names another path).

**Script:** `${CLAUDE_PLUGIN_ROOT}/skills/crop/scripts/crop_screenshots.py` — run it; don't reimplement the pixel pass inline.

## What counts as a candidate

- Filename matches macOS fullscreen capture: `Screen Shot YYYY-MM-DD at ….png` or `Screenshot …`
- Dimensions match the primary display (script reads this via `system_profiler`)
- Not already processed: skip names containing `- cropped`, `-cropped`, or `- subject`

Cmd+Shift+4 region captures are **out of scope** unless the user passes `--file` explicitly.

## Two-pass workflow

### Pass 1 — strip UI, keep full photo (script)

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/crop/scripts/crop_screenshots.py" --json
```

Add `--file <path>` for one screenshot. Add `--dry-run` to preview without writing.

The script detects the embedded photo inside browser chrome (tabs, address bar, dock, page margins) and writes `<original stem> - cropped.png` next to the source.

If `no_photo_detected`, read the image yourself — it may be a non-browser screenshot or an unusual layout. Report and skip unless the user wants manual bounds.

### Pass 2 — tighten on the subject (vision + script)

For each `*- cropped.png` from pass 1 (or when the user only wants a tighter frame):

1. **Read** the cropped image.
2. Identify the **main subject** — the woman / women who are the focal point ("the babe"). If multiple people share the frame equally, include all of them.
3. Estimate a bounding box in **pixel coordinates relative to the cropped image** `(left, top, right, bottom)` that fully contains every visible part of the subject: head, hair, limbs, feet, hands, accessories. Err on **including** margin rather than clipping.
4. Tighter is fine — crop out hammock edges, sand, sky, trees, inflatables — **as long as the subject stays 100% in frame**.
5. Apply the tighten:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/crop/scripts/crop_screenshots.py" \
  --file "<path/to/original screenshot.png>" \
  --subject-bbox LEFT,TOP,RIGHT,BOTTOM \
  --json
```

`--subject-bbox` coordinates are relative to the **photo crop** (the `*- cropped.png` canvas), not the original fullscreen image. The script re-runs photo detection, crops, then tightens inside that result.

Output: `<original stem> - subject.png`.

If pass 1 already frames the subject tightly with nothing meaningful to remove, **skip pass 2** and say so.

## `/crop` default behavior

When invoked with no arguments:

1. Run pass 1 on all staging candidates.
2. Run pass 2 on each new `*- cropped.png` where tightening clearly helps.
3. Summarize: sources processed, outputs written, any skips.

When `$ARGUMENTS` names a file or "latest", scope to that file only. "Latest" = most recently modified fullscreen screenshot in staging.

## Output conventions

| File | Meaning |
|------|---------|
| `… - cropped.png` | Photo only — browser UI and page margins removed |
| `… - subject.png` | Tightened around the main subject |

Never overwrite the original screenshot.

## Verification

After each write:

- Read the output and confirm no browser chrome, dock, or menu bar remains.
- Confirm the subject is fully visible — no clipped head, feet, or limbs.
- If clipped, widen the bbox and re-run `--subject-bbox`.

## Failure modes

| Situation | Action |
|-----------|--------|
| No candidates in staging | Report; ask if screenshots land elsewhere |
| `no_photo_detected` | Inspect manually; may not be a browser-embedded photo |
| Subject bbox uncertain | Prefer a looser box; never clip to "look tighter" |
| PIL missing | `pip3 install pillow` (or `python3 -m pip install --user pillow`) then retry |