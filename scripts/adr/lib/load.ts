/**
 * ADR loader — the single file-I/O seam between docs/decisions/ on disk and the pure
 * parse/graph/audit cores. Every verb loads through here (graph now, audit next), so the
 * frontmatter rules live in exactly one place (lib/parse.ts).
 *
 * Kept deliberately thin: read the directory, parse each ADR head, project into a typed
 * AdrNode. No graph/audit logic — those import AdrNode and stay pure & unit-testable.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter, numberFromFilename } from './parse.ts';

export type BuildState = 'shipped' | 'in-progress' | 'deferred' | 'planned';

export interface AdrNode {
  id: string;            // ADR-NNN (frontmatter id, else derived from the filename)
  num: number;           // sequence number parsed from the filename
  slug: string;          // filename, e.g. ADR-009-objective-invoked-audit-gate.md
  title: string;
  status: string;        // Accepted | Superseded | Unknown | ...
  date: string;
  supersededBy: string | null;
  amends: string[];
  build: BuildState;
  body: string;          // raw markdown with the frontmatter block stripped
}

/** Every `ADR-NNN` id inside a frontmatter value like `[ADR-007, ADR-008]` or `ADR-035`. */
function idsIn(value: string | undefined): string[] {
  if (!value) return [];
  return [...value.matchAll(/ADR-(\d{3})/g)].map((m) => `ADR-${m[1]}`);
}

/** Classify build maturity from the optional `implementation:` field — surfaces "not yet built". */
function buildState(fields: Record<string, string>): BuildState {
  const impl = (fields.implementation ?? '').toLowerCase();
  if (!impl) return 'shipped';
  if (/in[-\s]?progress/.test(impl)) return 'in-progress';
  if (/defer/.test(impl)) return 'deferred';
  if (/forthcoming|not yet|no code|design-time/.test(impl)) return 'planned';
  return 'shipped';
}

/** Strip the leading `---`…`---` block so consumers render just the document body. */
export function stripFrontmatter(raw: string): string {
  const m = /^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(raw);
  return m ? raw.slice(m[0].length).trim() : raw.trim();
}

/** Project one ADR file (filename + raw text) into a typed node. Pure — testable. */
export function toNode(slug: string, raw: string): AdrNode {
  const f = parseFrontmatter(raw).fields;
  const num = numberFromFilename(slug) ?? 0;
  const id = f.id?.trim() || `ADR-${String(num).padStart(3, '0')}`;
  return {
    id,
    num,
    slug,
    title: f.title ?? '(untitled)',
    status: f.status ?? 'Unknown',
    date: f.date ?? '',
    supersededBy: idsIn(f['superseded-by'])[0] ?? null,
    amends: idsIn(f.amends),
    build: buildState(f),
    body: stripFrontmatter(raw),
  };
}

/** Read every ADR-NNN-*.md under `dir`, sorted by filename, as typed nodes. */
export function loadAdrNodes(dir: string): AdrNode[] {
  return readdirSync(dir)
    .filter((file) => numberFromFilename(file) !== null)
    .sort()
    .map((file) => toNode(file, readFileSync(join(dir, file), 'utf8')));
}
