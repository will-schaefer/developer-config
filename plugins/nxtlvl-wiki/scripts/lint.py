#!/usr/bin/env python3
"""Deterministic wiki linter — the scriptable core of `/lint`.

Implements the checks `CLAUDE.md` / `.claude/commands/lint.md` describe as
"deterministic" so they run as code instead of the model reading every page
into context. This is both cheaper (the ingest gate stops paying an
LLM-read-the-whole-wiki tax on each run) and more reliable (a regex never
skims past a broken link).

Checks:
  1. Wikilink resolution  — every [[target]] points at an existing page/raw note.
                            Unresolved links are reported as leads (NOT a failure:
                            links to not-yet-written pages are how the wiki names
                            what to ingest next — per CLAUDE.md).
  2. Orphans              — content pages no other page links to (WARN).
  3. Citation reconcile   — sources: frontmatter == the union of raw-targeting
                            footnotes, both directions (HARD: non-zero exit).
  4. Frontmatter floor    — every page carries the full floor (HARD).

Modes:
  lint.py                       full-wiki audit
  lint.py --changed <gitref>    only report per-page checks (floor, reconcile,
                                link-resolution) for pages changed since <gitref>;
                                the link graph + orphan analysis still use the
                                whole wiki, but only changed pages are flagged.
                                This is what the /ingest gate uses.

Exit code is non-zero iff a HARD check fails on an in-scope page — so it can be
used as a commit gate. Research-lead links and orphans never fail the gate.

NOT covered here (left to the LLM `/lint`, which calls this and adds judgment):
  stale-SHA heuristics, content-gap ranking, uncited-claim / contradiction prose
  checks. Repo-manifest health stays in scripts/check_repo_manifest.py.
"""
import os, re, sys, json, subprocess, glob

REPO = os.getcwd()  # the wiki checkout; commands run from its root
FLOOR = ["title", "type", "tags", "sources", "related", "created", "updated"]

def read(p):
    try:
        return open(p, encoding="utf-8").read()
    except Exception:
        return ""

def frontmatter(text):
    m = re.match(r"^---\n(.*?)\n---", text, re.S)
    if not m:
        return None
    fm, cur = {}, None
    for line in m.group(1).splitlines():
        if re.match(r"^[A-Za-z0-9_]+:", line):
            k, _, v = line.partition(":")
            fm[k.strip()] = v.strip(); cur = k.strip()
        elif re.match(r"^\s*-\s", line) and cur:
            fm[cur] = (fm.get(cur) or "") + " " + line.strip()
    return fm

def page_type(text):
    return ((frontmatter(text) or {}).get("type") or "").strip()

def wikilinks(text):
    """All [[target]] slugs/paths in body (alias + anchor stripped)."""
    out = []
    for m in re.finditer(r"\[\[([^\]]+)\]\]", text):
        t = m.group(1).split("|", 1)[0].split("#", 1)[0].strip()
        if t:
            out.append(t)
    return out

def raw_targets_in_footnotes(text):
    """Union of raw/ notes referenced by any [^n]: footnote DEFINITION.

    Footnote definitions wrap across multiple lines — the raw/ link often sits
    on a continuation line, not the `[^n]:` line — so accumulate each definition
    body until the next definition / heading / blank-then-heading, then scan it.
    (Definitions citing only repo permalinks `owner/repo@SHA/...` contribute no
    raw/ target, which is correct: permalinks live only in footnotes, never in
    sources:.)
    """
    targets = set()
    bodies, cur = [], None
    for line in text.splitlines():
        if re.match(r"^\[\^[^\]]+\]:", line):          # start of a definition
            if cur is not None:
                bodies.append(cur)
            cur = line
        elif cur is not None:
            if re.match(r"^#{1,6}\s", line):            # a heading ends the block
                bodies.append(cur); cur = None
            else:
                cur += "\n" + line                      # continuation (incl. blanks)
    if cur is not None:
        bodies.append(cur)
    for b in bodies:
        for r in re.findall(r"raw/[\w\-/]+", b):
            targets.add(re.sub(r"\.md$", "", r.rstrip(".")))
    return targets

def sources_frontmatter(text):
    m = re.match(r"^---\n(.*?)\n---", text, re.S)
    if not m:
        return set()
    sm = re.search(r"^sources:(.*?)(?=^\w[\w-]*:|\Z)", m.group(1), re.S | re.M)
    seg = sm.group(1) if sm else ""
    return set(re.sub(r"\.md$", "", r.rstrip(".")) for r in re.findall(r"raw/[\w\-/]+", seg))

def file_exists(relnoext):
    """A 'raw/x/y' or 'wiki/x/y' target (no extension) exists as a .md file?"""
    return os.path.exists(os.path.join(REPO, relnoext + ".md"))

def changed_since(ref):
    """Pages touched since <ref>: committed-diff + staged + untracked, under wiki/ & raw/.
    Untracked matters because an ingest's new pages aren't staged when the gate runs."""
    try:
        def git(*a):
            return subprocess.run(["git", "-C", REPO, *a], capture_output=True, text=True).stdout
        diff = git("diff", "--name-only", ref, "--", "wiki/", "raw/")
        staged = git("diff", "--cached", "--name-only", "--", "wiki/", "raw/")
        untracked = git("ls-files", "--others", "--exclude-standard", "--", "wiki/", "raw/")
        files = set(f for f in (diff + staged + untracked).split("\n") if f.strip())
        return files
    except Exception as e:
        print(f"  (could not compute changed set from '{ref}': {e}); auditing whole wiki", file=sys.stderr)
        return None

def main():
    ref = None
    if "--changed" in sys.argv:
        i = sys.argv.index("--changed")
        ref = sys.argv[i + 1] if i + 1 < len(sys.argv) else "HEAD"

    wiki = sorted(glob.glob(os.path.join(REPO, "wiki", "**", "*.md"), recursive=True))
    # slug -> set(relpaths)  (basename without .md; collisions across clusters allowed)
    slugs = {}
    for p in wiki:
        slugs.setdefault(os.path.splitext(os.path.basename(p))[0], set()).add(p)

    changed = changed_since(ref) if ref else None
    def in_scope(relpath):
        return changed is None or relpath in changed

    # full link graph (for orphan detection + resolution), cheap regex pass
    inbound = {os.path.relpath(p, REPO): 0 for p in wiki}
    unresolved = []   # (page, target)
    for p in wiki:
        rel = os.path.relpath(p, REPO)
        txt = read(p)
        for t in wikilinks(txt):
            # resolve: raw/ or wiki/ path target, else bare slug
            ok = False
            if t.startswith(("raw/", "wiki/")):
                ok = file_exists(t)
                if ok and t.startswith("wiki/"):
                    inbound[t if t.endswith(".md") else t + ".md"] = inbound.get(t + ".md", 0) + 1
            else:
                hit = slugs.get(t)
                ok = bool(hit)
                if ok:
                    for hp in hit:
                        hr = os.path.relpath(hp, REPO)
                        if hr != rel:
                            inbound[hr] = inbound.get(hr, 0) + 1
            if not ok and in_scope(rel):
                unresolved.append((rel, t))

    floor_fail, recon_fail, orphans = [], [], []
    for p in wiki:
        rel = os.path.relpath(p, REPO)
        if not in_scope(rel):
            continue
        txt = read(p)
        fm = frontmatter(txt)
        typ = page_type(txt)
        # floor (HARD) — every page
        if fm is None:
            floor_fail.append(f"{rel}: no frontmatter")
        else:
            miss = [k for k in FLOOR if k not in fm]
            if miss:
                floor_fail.append(f"{rel}: missing {miss}")
        # citation reconcile (HARD) — content pages only (moc/index are link hubs)
        if typ and typ not in ("moc",):
            ft, sf = raw_targets_in_footnotes(txt), sources_frontmatter(txt)
            if ft != sf:
                recon_fail.append(f"{rel}: footnotes={sorted(ft)} vs sources={sorted(sf)}")
        # orphan (WARN) — content page nobody links to
        if typ and typ not in ("moc",) and inbound.get(rel, 0) == 0:
            orphans.append(rel)

    scope = f"changed vs {ref}" if changed is not None else "full wiki"
    print(f"== wiki lint ({scope}; {len(wiki)} pages indexed) ==")
    print(f"1. unresolved wikilinks (leads/typos, WARN): {len(unresolved)}")
    for pg, t in unresolved[:40]:
        print(f"     {pg} -> [[{t}]]")
    print(f"2. orphan content pages (WARN): {len(orphans)}")
    for o in orphans[:40]:
        print(f"     {o}")
    print(f"3. citation reconciliation (HARD): {len(recon_fail)} mismatch")
    for r in recon_fail:
        print(f"     {r}")
    print(f"4. frontmatter floor (HARD): {len(floor_fail)} violation")
    for r in floor_fail:
        print(f"     {r}")

    hard = len(recon_fail) + len(floor_fail)
    print(f"== {'FAIL' if hard else 'PASS'} (hard failures: {hard}) ==")
    sys.exit(1 if hard else 0)

if __name__ == "__main__":
    main()
