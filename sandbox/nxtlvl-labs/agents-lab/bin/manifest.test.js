'use strict';
/**
 * Unit tests for the shared manifest contract (bin/lib/manifest.js).
 * Run: node --test bin/manifest.test.js   (or `npm test` for the whole bin/ glob).
 *
 * Lives at bin/ top-level (not bin/lib/) so it matches the `bin/*.test.js` glob that
 * `npm test` uses — the runner takes an explicit glob, not a directory arg.
 *
 * Coverage is two-sided per the dangerous-bash-gate discipline: every required-field /
 * bad-value error must fire on a malformed manifest AND a clean manifest must produce none.
 * The total contract is asserted explicitly — malformed YAML must NOT throw.
 */

const { test } = require('node:test');
const assert = require('node:assert');

const m = require('./lib/manifest.js');

// A known-good manifest object. Clone + override to build each negative case.
function validManifest() {
  return {
    name: 'example-skill',
    type: 'skill',
    stage: 'develop',
    intent: 'A one-paragraph statement of purpose for this capability.',
    intake: { task: 'the task that required it', failed: 'the existing thing that fell short' },
    graduation_criteria: [{ id: 'behavioral', bar: 'all behavioral eval cases pass' }],
    deps: [],
    target: 'plugins/nxtlvl/skills/example-skill',
  };
}

function codes(result) {
  return result.errors.map((e) => e.code);
}

// --- the happy path -------------------------------------------------------

test('valid manifest -> no errors, no warnings', () => {
  const r = m.validate(validManifest());
  assert.deepStrictEqual(r.errors, [], `unexpected errors: ${JSON.stringify(r.errors)}`);
  assert.deepStrictEqual(r.warnings, []);
});

// --- required fields, one per case ----------------------------------------

test('missing name -> E_NAME', () => {
  const x = validManifest(); delete x.name;
  assert.ok(codes(m.validate(x)).includes('E_NAME'));
});

test('empty name -> E_NAME', () => {
  const x = validManifest(); x.name = '   ';
  assert.ok(codes(m.validate(x)).includes('E_NAME'));
});

test('missing type -> E_TYPE_MISSING', () => {
  const x = validManifest(); delete x.type;
  assert.ok(codes(m.validate(x)).includes('E_TYPE_MISSING'));
});

test('unknown type -> E_TYPE', () => {
  const x = validManifest(); x.type = 'widget';
  assert.ok(codes(m.validate(x)).includes('E_TYPE'));
});

test('missing stage -> E_STAGE_MISSING', () => {
  const x = validManifest(); delete x.stage;
  assert.ok(codes(m.validate(x)).includes('E_STAGE_MISSING'));
});

test('unknown stage -> E_STAGE', () => {
  const x = validManifest(); x.stage = 'shipping';
  assert.ok(codes(m.validate(x)).includes('E_STAGE'));
});

test('missing intent -> E_INTENT', () => {
  const x = validManifest(); delete x.intent;
  assert.ok(codes(m.validate(x)).includes('E_INTENT'));
});

test('missing intake -> E_INTAKE_MISSING', () => {
  const x = validManifest(); delete x.intake;
  assert.ok(codes(m.validate(x)).includes('E_INTAKE_MISSING'));
});

test('intake present but incomplete -> E_INTAKE_INCOMPLETE', () => {
  const x = validManifest(); x.intake = { task: '', failed: '' };
  assert.ok(codes(m.validate(x)).includes('E_INTAKE_INCOMPLETE'));
});

test('intake wrong shape -> E_INTAKE_SHAPE', () => {
  const x = validManifest(); x.intake = 'just a string';
  assert.ok(codes(m.validate(x)).includes('E_INTAKE_SHAPE'));
});

test('missing graduation_criteria -> E_CRITERIA_MISSING', () => {
  const x = validManifest(); delete x.graduation_criteria;
  assert.ok(codes(m.validate(x)).includes('E_CRITERIA_MISSING'));
});

test('empty graduation_criteria -> E_CRITERIA_EMPTY', () => {
  const x = validManifest(); x.graduation_criteria = [];
  assert.ok(codes(m.validate(x)).includes('E_CRITERIA_EMPTY'));
});

test('criterion missing id/bar -> E_CRITERIA_ITEM', () => {
  const x = validManifest(); x.graduation_criteria = [{ id: 'x' }];
  assert.ok(codes(m.validate(x)).includes('E_CRITERIA_ITEM'));
});

test('missing target -> E_TARGET', () => {
  const x = validManifest(); delete x.target;
  assert.ok(codes(m.validate(x)).includes('E_TARGET'));
});

test('target outside plugins/nxtlvl -> E_TARGET_PATH', () => {
  const x = validManifest(); x.target = 'somewhere/else/example';
  assert.ok(codes(m.validate(x)).includes('E_TARGET_PATH'));
});

test('deps not a list -> E_DEPS', () => {
  const x = validManifest(); x.deps = 'nope';
  assert.ok(codes(m.validate(x)).includes('E_DEPS'));
});

// --- warnings (taste, never blocking) -------------------------------------

test('target subdir mismatching type -> warning, not error', () => {
  const x = validManifest(); x.type = 'agent'; // target still under skills/
  const r = m.validate(x);
  assert.deepStrictEqual(r.errors, [], 'mismatch must not be an error');
  assert.strictEqual(r.warnings.length, 1);
  assert.match(r.warnings[0], /not under plugins\/nxtlvl\/agents\//);
});

// --- totality: malformed input must NEVER throw ----------------------------

test('malformed YAML does not throw; parse returns error, manifest null', () => {
  let result;
  assert.doesNotThrow(() => { result = m.parse('name: [unclosed\n  bad: :'); });
  assert.strictEqual(result.manifest, null);
  assert.ok(typeof result.error === 'string' && result.error.length > 0);
});

test('validateText on malformed YAML -> E_PARSE, no crash', () => {
  let r;
  assert.doesNotThrow(() => { r = m.validateText(': : not yaml ['); });
  assert.ok(codes(r).includes('E_PARSE'));
  assert.strictEqual(r.manifest, null);
});

test('validate(null) -> E_NOT_MAPPING (no crash)', () => {
  assert.ok(codes(m.validate(null)).includes('E_NOT_MAPPING'));
});

test('validate(array) -> E_NOT_MAPPING', () => {
  assert.ok(codes(m.validate([1, 2, 3])).includes('E_NOT_MAPPING'));
});

test('empty document parses to null -> E_NOT_MAPPING via validateText', () => {
  const r = m.validateText('');
  assert.ok(codes(r).includes('E_NOT_MAPPING'));
});

// --- round-trip: a valid YAML document validates cleanly -------------------

test('valid YAML text round-trips through validateText with no errors', () => {
  const yamlText = [
    'name: example-skill',
    'type: skill',
    'stage: develop',
    'intent: A one-paragraph statement of purpose.',
    'intake:',
    '  task: the task that required it',
    '  failed: the existing thing that fell short',
    'graduation_criteria:',
    '  - id: behavioral',
    '    bar: all behavioral eval cases pass',
    'deps: []',
    'target: plugins/nxtlvl/skills/example-skill',
    '',
  ].join('\n');
  const r = m.validateText(yamlText);
  assert.deepStrictEqual(r.errors, [], `unexpected: ${JSON.stringify(r.errors)}`);
});

// --- the author-owed helper (consumed by the T6 scaffold test) -------------

test('a fresh scaffold (intake incomplete + criteria empty) is onlyAuthorOwed', () => {
  const x = validManifest();
  x.intake = { task: '', failed: '' };
  x.graduation_criteria = [];
  const r = m.validate(x);
  assert.ok(m.onlyAuthorOwed(r.errors), `errors were: ${JSON.stringify(codes(r))}`);
});

test('a structurally-broken manifest is NOT onlyAuthorOwed', () => {
  const x = validManifest();
  x.type = 'widget'; // a real error, not author-owed
  x.graduation_criteria = [];
  const r = m.validate(x);
  assert.strictEqual(m.onlyAuthorOwed(r.errors), false);
});
