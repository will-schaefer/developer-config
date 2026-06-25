// Tests for lib/open-files.js — transcript open-files extraction.
//
// Ported verbatim (semantics-preserving) from the retired precompact.test.js;
// the logic now lives in lib/open-files.js and feeds the SessionStart briefing
// on the post-compaction path.
//
// Run with: node --test "plugins/nxtlvl/lib/open-files.test.js"

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { extractOpenFiles } = require('./open-files.js');

/**
 * Build a fake JSONL transcript string.
 * Each call in `toolCalls` is: { name, filePath, sidechain? }.
 */
function fakeTranscript(toolCalls = []) {
  const lines = [];
  for (const tc of toolCalls) {
    const inputKey = tc.name === 'NotebookEdit' ? 'notebook_path' : 'file_path';
    const item = {
      type: 'tool_use',
      name: tc.name,
      input: { [inputKey]: tc.filePath },
    };
    const msg = {
      type: 'assistant',
      isSidechain: tc.sidechain === true ? true : undefined,
      message: { content: [item], usage: { input_tokens: 100 } },
    };
    lines.push(JSON.stringify(msg));
  }
  return lines.join('\n');
}

test('de-duplicates and returns most-recent-first', () => {
  const tx = fakeTranscript([
    { name: 'Read',  filePath: '/a.js' },
    { name: 'Read',  filePath: '/b.js' },
    { name: 'Edit',  filePath: '/a.js' }, // /a.js re-touched — must move to most-recent
    { name: 'Write', filePath: '/c.js' },
  ]);
  const files = extractOpenFiles(tx);
  assert.deepEqual(files, ['/c.js', '/a.js', '/b.js'],
    'full ordered list: /c.js most-recent, /a.js (re-touched) second, /b.js oldest');
  assert.equal(files.length, 3, 'no duplicate /a.js');
});

test('re-touched-in-the-middle file moves to most-recent position', () => {
  const tx = fakeTranscript([
    { name: 'Read', filePath: '/x.js' },
    { name: 'Read', filePath: '/y.js' },
    { name: 'Read', filePath: '/z.js' },
    { name: 'Edit', filePath: '/x.js' }, // re-touch — x was earliest, now most-recent
  ]);
  const files = extractOpenFiles(tx);
  assert.deepEqual(files, ['/x.js', '/z.js', '/y.js'],
    're-touched /x.js is at index 0 (most-recent); /y.js is last (oldest)');
});

test('sidechain tool_use blocks are ignored', () => {
  const tx = fakeTranscript([
    { name: 'Read', filePath: '/main.js', sidechain: false },
    { name: 'Read', filePath: '/side.js', sidechain: true },  // must be ignored
  ]);
  const files = extractOpenFiles(tx);
  assert.ok(files.includes('/main.js'), 'main-thread file present');
  assert.ok(!files.includes('/side.js'), 'sidechain file absent');
});

test('capped at 8 entries', () => {
  const calls = [];
  for (let i = 0; i < 12; i++) calls.push({ name: 'Read', filePath: `/file${i}.js` });
  const tx = fakeTranscript(calls);
  const files = extractOpenFiles(tx);
  assert.equal(files.length, 8, 'capped at 8');
});

test('NotebookEdit uses notebook_path key', () => {
  const lines = [JSON.stringify({
    type: 'assistant',
    isSidechain: undefined,
    message: {
      content: [{ type: 'tool_use', name: 'NotebookEdit', input: { notebook_path: '/nb.ipynb' } }],
      usage: { input_tokens: 50 },
    },
  })];
  const files = extractOpenFiles(lines.join('\n'));
  assert.ok(files.includes('/nb.ipynb'), 'NotebookEdit notebook_path extracted');
});

test('bare path input key is extracted', () => {
  const lines = [JSON.stringify({
    type: 'assistant',
    isSidechain: undefined,
    message: {
      content: [{ type: 'tool_use', name: 'Read', input: { path: '/some.js' } }],
      usage: { input_tokens: 50 },
    },
  })];
  const files = extractOpenFiles(lines.join('\n'));
  assert.ok(files.includes('/some.js'), 'bare path key extracted');
});

test('MultiEdit uses file_path key', () => {
  const tx = fakeTranscript([{ name: 'MultiEdit', filePath: '/multi.js' }]);
  const files = extractOpenFiles(tx);
  assert.ok(files.includes('/multi.js'), 'MultiEdit file_path extracted');
});

test('dropFirst skips a potentially-truncated first line', () => {
  const tx = fakeTranscript([
    { name: 'Read', filePath: '/first.js' },
    { name: 'Read', filePath: '/second.js' },
  ]);
  const files = extractOpenFiles(tx, /* dropFirst */ true);
  assert.ok(!files.includes('/first.js'), 'first (possibly-truncated) line dropped');
  assert.ok(files.includes('/second.js'), 'subsequent lines retained');
});

test('empty transcript yields empty array', () => {
  assert.deepEqual(extractOpenFiles(''), []);
});

test('non-string input yields empty array (fail-safe)', () => {
  assert.deepEqual(extractOpenFiles(null), []);
  assert.deepEqual(extractOpenFiles(undefined), []);
});

test('malformed JSON lines are skipped, not thrown', () => {
  const tx = ['{not json', JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: '/ok.js' } }] },
  })].join('\n');
  const files = extractOpenFiles(tx);
  assert.deepEqual(files, ['/ok.js']);
});
