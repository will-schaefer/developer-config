---
description: Crop fullscreen staging screenshots to the embedded photo, then tighten around the main subject. Invokes the crop skill on the main thread.
argument-hint: "[filename, 'latest', or empty for all pending]"
---

# /crop

Thin entry to the **`crop`** skill. Runs on the **main thread** — vision is required for the
subject-tighten pass, so this does not delegate to a subagent.

## What it does

1. **Invoke `crop`** (Skill tool) with `$ARGUMENTS` as scope hints.
2. **Pass 1** — run `crop_screenshots.py` against `~/vault/Staging` (or one file / latest).
3. **Pass 2** — read each `*- cropped.png`, estimate a subject bbox that fully contains the babe,
   and re-run the script with `--subject-bbox` when tightening helps.
4. **Report** outputs written and anything skipped.

## When to use

- Fresh Cmd+Shift+3 captures landed in Staging and you want just the photo / subject.
- Re-tightening an existing crop after adjusting what "fully visible" means.

Not for: region captures (Cmd+Shift+4) unless a specific `--file` is named, or non-screenshot images.

$ARGUMENTS