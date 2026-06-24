#!/usr/bin/env node
'use strict';
/**
 * new-cell.js — scaffold a capability cell from a --type.
 *
 *   node bin/new-cell.js <name> --type=skill|agent|command|hook
 *
 * Creates cells/<name>/ with:
 *   - manifest.yaml   stage: develop, intake placeholder (empty), graduation_criteria: []
 *                     (AUTHOR-OWED — declared eval-first, BEFORE building)
 *   - evals/          the cell's own eval cases (travel with it on graduation)
 *   - run.md          how to exercise / dogfood this cell
 *   - a type-correct capability stub (SKILL.md | <name>.md | hooks.json + <name>.js)
 *
 * Refuses to clobber an existing cell. Validates name + type. This is plain tooling, not the
 * graduation gate — a usage error exits 1 (the deliberate exit-2 block belongs to graduate.js).
 *
 * Split for testability:
 *   planFiles(name, type) -> { relPath: content }   pure; throws on bad name/type
 *   createCell(name, type, cellsDir) -> { dir, files }   writes; refuses clobber
 */

const fs = require('fs');
const path = require('path');
const m = require('./lib/manifest.js');

const LAB_ROOT = path.join(__dirname, '..');
const CELLS_DIR = path.join(LAB_ROOT, 'cells');

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

function assertValidName(name) {
  if (typeof name !== 'string' || !NAME_RE.test(name)) {
    throw new Error(
      `invalid cell name ${JSON.stringify(name)} — use kebab-case (lowercase letters, digits, hyphens; must start alphanumeric)`
    );
  }
}

function assertValidType(type) {
  if (!m.TYPES.includes(type)) {
    throw new Error(`invalid --type ${JSON.stringify(type)} — expected one of ${m.TYPES.join('|')}`);
  }
}

function manifestYaml(name, type) {
  const dir = m.TYPE_DIR[type];
  return [
    `name: ${name}`,
    `type: ${type}`,
    'stage: develop',
    'intent: >',
    `  TODO (author-owed): one-paragraph statement of what this ${type} does and why it should exist.`,
    'intake:                  # ADR-008 membership — AUTHOR-OWED: fill both before graduating',
    '  task: ""               #   the task that required this capability',
    '  failed: ""             #   the existing thing that fell short',
    'graduation_criteria: []  # AUTHOR-OWED, eval-FIRST: declare the bar BEFORE building, e.g.',
    '  # - id: trigger-accuracy',
    '  #   bar: ">= 0.9 on the declared trigger set"',
    '  # - id: behavioral',
    '  #   bar: "all behavioral eval cases pass"',
    'deps: []',
    `target: plugins/nxtlvl/${dir}/${name}`,
    '',
  ].join('\n');
}

function runMd(name, type) {
  return [
    `# Running \`${name}\` (${type})`,
    '',
    'How to exercise and dogfood this cell.',
    '',
    '## Exercise',
    '',
    '1. Declare `graduation_criteria` in `manifest.yaml` **eval-first** (before building).',
    '2. Add eval cases under `evals/`.',
    `3. Run the evals: \`npm run eval -- ${name}\``,
    `4. Run the gate:  \`npm run graduate -- ${name}\``,
    '',
    '## Dogfood',
    '',
    'Install the lab as a plugin in a scratch profile (see `docs/plugin-manifest-reference.md`),',
    `then invoke this ${type} on a real task and record what happened here.`,
    '',
  ].join('\n');
}

function capabilityStub(name, type) {
  switch (type) {
    case 'skill':
      return {
        'SKILL.md': [
          '---',
          `name: ${name}`,
          'description: TODO (author-owed) — when to use this skill. Write a sharp triggering description.',
          '---',
          '',
          `# ${name}`,
          '',
          'TODO: skill body.',
          '',
        ].join('\n'),
      };
    case 'agent':
      return {
        [`${name}.md`]: [
          '---',
          `name: ${name}`,
          'description: TODO (author-owed) — when to invoke this agent, with example triggers.',
          'tools: Read, Grep, Glob',
          '---',
          '',
          `TODO: ${name} agent system prompt.`,
          '',
        ].join('\n'),
      };
    case 'command':
      return {
        [`${name}.md`]: [
          '---',
          'description: TODO (author-owed) — what this command does.',
          '---',
          '',
          `# /${name}`,
          '',
          'TODO: command body. Reference arguments with `$ARGUMENTS` / `$1`.',
          '',
        ].join('\n'),
      };
    case 'hook':
      return {
        'hooks.json': [
          '{',
          '  "hooks": {',
          '    "PreToolUse": [',
          '      {',
          '        "matcher": "*",',
          '        "hooks": [',
          '          {',
          '            "type": "command",',
          `            "command": "node \${CLAUDE_PLUGIN_ROOT}/${name}.js"`,
          '          }',
          '        ]',
          '      }',
          '    ]',
          '  }',
          '}',
          '',
        ].join('\n'),
        [`${name}.js`]: [
          '#!/usr/bin/env node',
          "'use strict';",
          `// ${name} — hook stub. Fails OPEN (house doctrine): on any error, do nothing and exit 0.`,
          '// A deliberate block is a clean exit 2; a crash must NEVER masquerade as a block.',
          'let raw = "";',
          'process.stdin.on("data", (c) => { raw += c; });',
          'process.stdin.on("end", () => {',
          '  try {',
          '    const event = raw ? JSON.parse(raw) : {};',
          '    // TODO: inspect event.tool_input and decide. Default: allow.',
          '    void event;',
          '    process.exit(0);',
          '  } catch (_e) {',
          '    process.exit(0); // fail open',
          '  }',
          '});',
          '',
        ].join('\n'),
      };
    default:
      throw new Error(`no stub for type ${type}`);
  }
}

/** Pure: returns a map of relative-path -> content for a new cell. Throws on bad name/type. */
function planFiles(name, type) {
  assertValidName(name);
  assertValidType(type);
  return {
    'manifest.yaml': manifestYaml(name, type),
    'run.md': runMd(name, type),
    'evals/.gitkeep': '',
    ...capabilityStub(name, type),
  };
}

/** Writes a new cell under cellsDir. Refuses to clobber an existing cell. */
function createCell(name, type, cellsDir) {
  const files = planFiles(name, type);
  const cellDir = path.join(cellsDir, name);
  if (fs.existsSync(cellDir)) {
    throw new Error(`cell already exists: ${path.relative(LAB_ROOT, cellDir)} — refusing to overwrite`);
  }
  for (const [rel, content] of Object.entries(files)) {
    const dest = path.join(cellDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
  }
  return { dir: cellDir, files: Object.keys(files) };
}

function parseArgs(argv) {
  const args = { name: null, type: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--type=')) {
      args.type = a.slice('--type='.length);
    } else if (a === '--type') {
      args.type = argv[++i];
    } else if (!a.startsWith('-') && args.name === null) {
      args.name = a;
    }
  }
  return args;
}

function main(argv) {
  const { name, type } = parseArgs(argv);
  if (!name || !type) {
    process.stderr.write('usage: node bin/new-cell.js <name> --type=skill|agent|command|hook\n');
    process.exit(1);
  }
  try {
    const { dir, files } = createCell(name, type, CELLS_DIR);
    const rel = path.relative(LAB_ROOT, dir);
    process.stdout.write(`scaffolded ${type} cell at ${rel}/\n`);
    files.forEach((f) => process.stdout.write(`  + ${rel}/${f}\n`));
    process.stdout.write('\nnext: fill manifest.yaml intake + declare graduation_criteria (eval-first), then `npm run ledger`.\n');
    process.exit(0);
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { planFiles, createCell, parseArgs, CELLS_DIR };
