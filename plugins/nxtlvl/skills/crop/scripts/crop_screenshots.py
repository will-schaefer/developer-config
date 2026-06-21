#!/usr/bin/env python3
"""Crop fullscreen macOS screenshots to the embedded photo, optionally tighten to a bbox."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image

DEFAULT_STAGING = Path.home() / "vault" / "Staging"
SCREENSHOT_RE = re.compile(
    r"^(Screen Shot|Screenshot) \d{4}-\d{2}-\d{2} at .+\.(png|jpg|jpeg)$",
    re.IGNORECASE,
)
CROPPED_MARKERS = ("- cropped", "-cropped", " - subject")


def display_resolution() -> tuple[int, int] | None:
    try:
        out = subprocess.check_output(
            ["system_profiler", "SPDisplaysDataType"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None
    for line in out.splitlines():
        if "Resolution:" in line:
            # e.g. "          Resolution: 1440 x 900 (Widescreen ...)"
            parts = line.split("Resolution:", 1)[1].strip().split()
            if len(parts) >= 3 and parts[1].lower() == "x":
                return int(parts[0]), int(parts[2])
    return None


def is_page_white(rgb: tuple[int, int, int]) -> bool:
    r, g, b = rgb
    return r >= 250 and g >= 250 and b >= 250


def is_fullscreen_screenshot(path: Path, display: tuple[int, int] | None) -> bool:
    if not SCREENSHOT_RE.match(path.name):
        return False
    if any(marker in path.name for marker in CROPPED_MARKERS):
        return False
    if display is None:
        return True
    try:
        with Image.open(path) as img:
            return img.size == display
    except OSError:
        return False


def detect_photo_bounds(img: Image.Image) -> tuple[int, int, int, int] | None:
    """Find the embedded photo rectangle inside a browser-style fullscreen screenshot."""
    w, h = img.size
    px = img.load()

    y_start, y_end = 130, min(h - 20, int(h * 0.88))
    x_search_start, x_search_end = int(w * 0.28), int(w * 0.72)
    photo_x1, photo_x2 = int(w * 0.33), int(w * 0.67)

    ptop = None
    for y in range(y_start, y_end):
        band = [px[x, y] for x in range(photo_x1, photo_x2)]
        nonwhite = sum(1 for c in band if not is_page_white(c))
        if nonwhite > len(band) * 0.25:
            ptop = y
            break

    pbottom = None
    for y in range(y_end, y_start, -1):
        band = [px[x, y] for x in range(photo_x1, photo_x2)]
        nonwhite = sum(1 for c in band if not is_page_white(c))
        if nonwhite > len(band) * 0.25:
            pbottom = y
            break

    if ptop is None or pbottom is None or pbottom <= ptop:
        return None

    lefts: list[int] = []
    rights: list[int] = []
    for y in range(ptop, pbottom + 1):
        xs = [
            x
            for x in range(x_search_start, x_search_end)
            if not is_page_white(px[x, y])
        ]
        if len(xs) > w * 0.05:
            lefts.append(xs[0])
            rights.append(xs[-1])

    if not lefts:
        return None

    pleft, pright = min(lefts), max(rights)

    # Trim residual white margins on left/right columns.
    for x in range(pleft, pright):
        col = [px[x, y] for y in range(ptop, pbottom + 1, 3)]
        if sum(is_page_white(c) for c in col) < len(col) * 0.85:
            pleft = x
            break

    for x in range(pright, pleft, -1):
        col = [px[x, y] for y in range(ptop, pbottom + 1, 3)]
        if sum(is_page_white(c) for c in col) < len(col) * 0.85:
            pright = x
            break

    return pleft, ptop, pright, pbottom


def crop_to_bounds(img: Image.Image, bounds: tuple[int, int, int, int]) -> Image.Image:
    left, top, right, bottom = bounds
    return img.crop((left, top, right + 1, bottom + 1))


def tighten_bbox(
    bounds: tuple[int, int, int, int],
    img_size: tuple[int, int],
    margin_pct: float = 0.02,
) -> tuple[int, int, int, int]:
    left, top, right, bottom = bounds
    w, h = img_size
    mx = max(2, int((right - left) * margin_pct))
    my = max(2, int((bottom - top) * margin_pct))
    return (
        max(0, left - mx),
        max(0, top - my),
        min(w - 1, right + mx),
        min(h - 1, bottom + my),
    )


def output_path_for(source: Path, suffix: str = "cropped") -> Path:
    stem = source.stem
    return source.with_name(f"{stem} - {suffix}.png")


def list_candidates(staging: Path, display: tuple[int, int] | None) -> list[Path]:
    return sorted(
        p
        for p in staging.iterdir()
        if p.is_file() and is_fullscreen_screenshot(p, display)
    )


def process_file(
    path: Path,
    *,
    dry_run: bool = False,
    subject_bbox: tuple[int, int, int, int] | None = None,
    margin_pct: float = 0.02,
) -> dict:
    result: dict = {"source": str(path), "status": "skipped"}

    with Image.open(path) as img:
        img = img.convert("RGB")
        bounds = detect_photo_bounds(img)
        if bounds is None:
            result["status"] = "no_photo_detected"
            return result

        cropped = crop_to_bounds(img, bounds)

        if subject_bbox is not None:
            tight = tighten_bbox(subject_bbox, cropped.size, margin_pct=margin_pct)
            cropped = crop_to_bounds(cropped, tight)
            out = output_path_for(path, suffix="subject")
            result["stage"] = "subject"
        else:
            out = output_path_for(path)
            result["stage"] = "photo"

        result["bounds"] = {
            "photo": bounds,
            "output_size": cropped.size,
        }
        if subject_bbox is not None:
            result["bounds"]["subject"] = subject_bbox

        if dry_run:
            result["status"] = "dry_run"
            result["output"] = str(out)
            return result

        cropped.save(out, format="PNG", optimize=True)
        result["status"] = "cropped"
        result["output"] = str(out)

    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--staging-dir",
        type=Path,
        default=DEFAULT_STAGING,
        help=f"Directory to scan (default: {DEFAULT_STAGING})",
    )
    parser.add_argument(
        "--file",
        type=Path,
        help="Process one screenshot instead of scanning staging",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--subject-bbox",
        help="Tighten crop to LEFT,TOP,RIGHT,BOTTOM within the photo crop (post-vision)",
    )
    parser.add_argument(
        "--margin-pct",
        type=float,
        default=0.02,
        help="Padding around subject bbox as fraction of subject size",
    )
    parser.add_argument("--json", action="store_true", help="Emit JSON summary")
    args = parser.parse_args()

    display = display_resolution()
    subject_bbox = None
    if args.subject_bbox:
        try:
            parts = [int(p.strip()) for p in args.subject_bbox.split(",")]
            if len(parts) != 4:
                raise ValueError
            subject_bbox = tuple(parts)  # type: ignore[assignment]
        except ValueError:
            print("Invalid --subject-bbox; expected LEFT,TOP,RIGHT,BOTTOM", file=sys.stderr)
            return 2

    if args.file:
        targets = [args.file]
    else:
        staging = args.staging_dir.expanduser()
        if not staging.is_dir():
            print(f"Staging directory not found: {staging}", file=sys.stderr)
            return 1
        targets = list_candidates(staging, display)

    results = [
        process_file(
            Path(t),
            dry_run=args.dry_run,
            subject_bbox=subject_bbox,
            margin_pct=args.margin_pct,
        )
        for t in targets
    ]

    if args.json:
        print(json.dumps({"display": display, "results": results}, indent=2))
    else:
        if not results:
            print("No fullscreen screenshots found.")
        for r in results:
            print(f"{r['source']}: {r['status']}" + (f" -> {r.get('output')}" if r.get("output") else ""))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())