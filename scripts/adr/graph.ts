/**
 * `adr graph` — dependency map of nxtlvl's own ADRs (docs/decisions/).
 *
 *   node scripts/adr/graph.ts              # --json (default): lean model → stdout, render in-session
 *   node scripts/adr/graph.ts --html       # opt-in: write the interactive viewer to docs/decisions/graph.html
 *   node scripts/adr/graph.ts --html --open # also print the file:// URL
 *
 * Default honors decision B (no repo artifact); --html is the opt-in standalone viewer.
 * Thin by design — the model and renderer live in lib/graph.ts, loading in lib/load.ts, so
 * this file only loads, dispatches, and (for --html) writes. No build step — native Node
 * type-stripping (ADR-034). The ESM main-guard means importing this module has no effect.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadAdrNodes } from './lib/load.ts';
import { buildEdges, toJsonModel, renderHtml, type EdgeType } from './lib/graph.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DECISIONS_DIR = resolve(HERE, '../../docs/decisions');
const OUT = join(DECISIONS_DIR, 'graph.html');

function main(argv: string[]): void {
  const nodes = loadAdrNodes(DECISIONS_DIR);
  const edges = buildEdges(nodes);

  if (!argv.includes('--html')) {
    // decision B: lean, body-free model to stdout for in-session render — no repo artifact.
    process.stdout.write(JSON.stringify(toJsonModel(nodes, edges), null, 2) + '\n');
    return;
  }

  writeFileSync(OUT, renderHtml(nodes, edges), 'utf8');
  const byType = (t: EdgeType) => edges.filter((e) => e.type === t).length;
  // Diagnostics go to stderr so stdout stays reserved for the --json contract.
  process.stderr.write(`adr graph --html → ${OUT}\n`);
  process.stderr.write(
    `  ${nodes.length} ADRs · ${edges.length} edges ` +
      `(supersedes ${byType('supersedes')}, amends ${byType('amends')}, references ${byType('references')})\n`,
  );
  if (argv.includes('--open')) process.stderr.write(`  ${pathToFileURL(OUT).href}\n`);
}

// Run only when executed directly (node scripts/adr/graph.ts …), never on import.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
