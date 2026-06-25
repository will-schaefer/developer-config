/**
 * Unit tests for the ADR graph core — the pure edge-derivation and the lean JSON model.
 *   Run: node --test scripts/adr/lib/graph.test.ts   (Node >= 24.12, native type-stripping)
 *
 * buildEdges encodes the relationship rules the viewer and (later) the audit lean on —
 * structural-wins, reference dedup, self-link drop, unknown-target drop — so it gets the
 * same fixture-driven, two-sided coverage as the dangerous-bash gate's decide() core.
 * Driven by hand-built AdrNode fixtures, never file I/O (that seam is lib/load.ts).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { AdrNode } from './load.ts';
import { buildEdges, toJsonModel, type Edge } from './graph.ts';

/** Minimal AdrNode factory — defaults the fields buildEdges/toJsonModel don't read. */
function node(partial: Partial<AdrNode> & { id: string; num: number }): AdrNode {
  return {
    slug: `${partial.id}-x.md`,
    title: partial.id,
    status: 'Accepted',
    date: '2026-01-01',
    supersededBy: null,
    amends: [],
    build: 'shipped',
    body: '',
    ...partial,
  };
}

const has = (edges: Edge[], from: string, to: string, type: Edge['type']) =>
  edges.some((e) => e.from === from && e.to === to && e.type === type);

// ---------------------------------------------------------------------------
// Structural edges — supersedes/amends declared in frontmatter.
// ---------------------------------------------------------------------------
test('buildEdges: supersededBy yields a successor->predecessor supersedes edge', () => {
  // ADR-005 is superseded by ADR-010 → the edge points from the successor.
  const edges = buildEdges([node({ id: 'ADR-005', num: 5, supersededBy: 'ADR-010' }), node({ id: 'ADR-010', num: 10 })]);
  assert.ok(has(edges, 'ADR-010', 'ADR-005', 'supersedes'));
  assert.equal(edges.length, 1);
});

test('buildEdges: amends yields an amender->target amends edge', () => {
  const edges = buildEdges([node({ id: 'ADR-035', num: 35, amends: ['ADR-034'] }), node({ id: 'ADR-034', num: 34 })]);
  assert.ok(has(edges, 'ADR-035', 'ADR-034', 'amends'));
  assert.equal(edges.length, 1);
});

// ---------------------------------------------------------------------------
// Reference edges — body cross-links, with the dedup/self/unknown guards.
// ---------------------------------------------------------------------------
test('buildEdges: a body cross-link to another ADR becomes a references edge', () => {
  const edges = buildEdges([
    node({ id: 'ADR-009', num: 9, body: 'see [ADR-001](ADR-001-x.md) for context' }),
    node({ id: 'ADR-001', num: 1 }),
  ]);
  assert.ok(has(edges, 'ADR-009', 'ADR-001', 'references'));
});

test('buildEdges: a self-reference in the body is ignored', () => {
  const edges = buildEdges([node({ id: 'ADR-009', num: 9, body: 'ADR-009 refers to itself ADR-009' })]);
  assert.equal(edges.length, 0);
});

test('buildEdges: a reference duplicating a structural edge (either direction) is dropped', () => {
  // ADR-010 supersedes ADR-005 structurally; ADR-005's body also mentions ADR-010.
  // The reference edge must NOT be added on top of the structural one.
  const edges = buildEdges([
    node({ id: 'ADR-005', num: 5, supersededBy: 'ADR-010', body: 'replaced by ADR-010' }),
    node({ id: 'ADR-010', num: 10 }),
  ]);
  assert.equal(edges.length, 1);
  assert.ok(has(edges, 'ADR-010', 'ADR-005', 'supersedes'));
  assert.ok(!has(edges, 'ADR-005', 'ADR-010', 'references'));
});

test('buildEdges: a reference to an unknown ADR id is dropped', () => {
  const edges = buildEdges([node({ id: 'ADR-009', num: 9, body: 'mentions ADR-999 which does not exist' })]);
  assert.equal(edges.length, 0);
});

// ---------------------------------------------------------------------------
// toJsonModel — the lean (body-free) projection for the --json render.
// ---------------------------------------------------------------------------
test('toJsonModel: strips bodies from nodes and preserves edges verbatim', () => {
  const nodes = [
    node({ id: 'ADR-001', num: 1, body: 'a long body that must not reach stdout' }),
    node({ id: 'ADR-002', num: 2, body: 'another body', amends: ['ADR-001'] }),
  ];
  const edges = buildEdges(nodes);
  const model = toJsonModel(nodes, edges);
  assert.equal(model.edges, edges, 'edges passed through by reference');
  for (const n of model.nodes) {
    assert.ok(!('body' in n), 'lean nodes must not carry the body');
  }
  // Metadata the viewer/in-session render needs is retained.
  assert.equal(model.nodes[0].id, 'ADR-001');
  assert.deepEqual(model.nodes[1].amends, ['ADR-001']);
});
