// Tests for lib/scrub.js — secret-scrubbing module (C&M Phase 2, Task 2.1).
//
// Acceptance criteria (plan Task 2.1):
//  - Planted secret in INPUT and in OUTPUT are both redacted.
//  - Each named secret shape has a dedicated test.
//  - Ordinary prose is NOT over-redacted.
//  - A forced scrub failure (throwing redactor, non-string field) drops with
//    { dropped: true } — nothing raw passes through.
//  - Bounded runtime: ~5k and oversized (1 MB) inputs complete quickly.
//  - Idempotence: scrubbing already-scrubbed output changes nothing further.
//
// Run: node --test "plugins/nxtlvl/lib/scrub.test.js" from /Users/willschaefer/Developer

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  REDACTED,
  DEFAULT_REDACTORS,
  shannonEntropy,
  namedRedactor,
  entropyRedactor,
  scrubText,
  scrubValue,
  scrubObservation,
  safeScrubObservation,
} = require('./scrub.js');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const GH_TOKEN = 'ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
const OPENAI_KEY = 'sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz12345678';
const AWS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
// A realistic 40-char base64 AWS secret access key
const AWS_SECRET = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
// JWT: header.payload.signature (all base64url)
const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ' +
  '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const GOOGLE_KEY = 'AIzaSyD-9tSrke72I6e0I0CWFeh5eIJEZyWugnE';
const STRIPE_SK = 'sk_live_51ABC123defGHI456jklMNO789pqrSTU012vwxYZ34';
const STRIPE_RK = 'rk_live_ABCDEFGHIJKLMNOPQRSTUVWX';
const STRIPE_PK = 'pk_live_ABCDEFGHIJKLMNOPQRSTUVWX';
const SLACK_TOKEN = 'xoxb-12345678-12345678901-abcdefghijklmnopqrstuvwx';
const HIGH_ENTROPY = 'Z9x8C7v6B5n4M3a2S1d0F1g2H3j4K5l6Q7w8E9r0T1y2';
const ENV_LINE = 'export API_KEY=sup3rSecretValue123';

// ── Core: input and output scrubbing ─────────────────────────────────────────

test('redacts a named token planted in INPUT', () => {
  const obs = { tool: 'Bash', input: `git push with ${GH_TOKEN} now`, output: 'ok' };
  const { dropped, record } = safeScrubObservation(obs);
  assert.equal(dropped, false);
  assert.ok(record.input.includes(REDACTED), 'REDACTED marker present');
  assert.ok(!record.input.includes(GH_TOKEN), 'raw token must not survive in input');
});

test('redacts a named token planted in OUTPUT', () => {
  const obs = { tool: 'Bash', input: 'echo $TOKEN', output: `TOKEN is ${GH_TOKEN}` };
  const { dropped, record } = safeScrubObservation(obs);
  assert.equal(dropped, false);
  assert.ok(record.output.includes(REDACTED), 'REDACTED marker present');
  assert.ok(!record.output.includes(GH_TOKEN), 'raw token must not survive in output');
});

test('redacts secrets in BOTH input and output in one call', () => {
  const obs = {
    tool: 'Bash',
    input: `AUTH=${OPENAI_KEY}`,
    output: `echo ${GH_TOKEN}`,
  };
  const { dropped, record } = safeScrubObservation(obs);
  assert.equal(dropped, false);
  assert.ok(!record.input.includes(OPENAI_KEY), 'key must not survive in input');
  assert.ok(!record.output.includes(GH_TOKEN), 'gh token must not survive in output');
  assert.ok(record.input.includes(REDACTED));
  assert.ok(record.output.includes(REDACTED));
});

// ── Named shapes ──────────────────────────────────────────────────────────────

test('named: GitHub token (ghp_)', () => {
  const out = namedRedactor(`token: ${GH_TOKEN}`);
  assert.ok(!out.includes(GH_TOKEN));
  assert.ok(out.includes(REDACTED));
});

test('named: OpenAI-style key (sk-)', () => {
  const out = namedRedactor(`key: ${OPENAI_KEY}`);
  assert.ok(!out.includes(OPENAI_KEY));
  assert.ok(out.includes(REDACTED));
});

test('named: AWS access key id (AKIA...)', () => {
  const out = namedRedactor(`id: ${AWS_KEY_ID}`);
  assert.ok(!out.includes(AWS_KEY_ID));
  assert.ok(out.includes(REDACTED));
});

test('named: AWS secret access key (40-char base64 pattern)', () => {
  // The AWS secret follows a SECRET= assignment, which the env-assignment rule catches.
  const line = `AWS_SECRET_ACCESS_KEY=${AWS_SECRET}`;
  const out = namedRedactor(line);
  assert.ok(!out.includes(AWS_SECRET), `raw secret must not survive: ${out}`);
  assert.ok(out.includes(REDACTED));
});

test('named: JWT (eyJ... three-segment)', () => {
  const out = namedRedactor(`Authorization: Bearer ${JWT}`);
  assert.ok(!out.includes(JWT));
  assert.ok(out.includes(REDACTED));
});

test('named: Google API key (AIza...)', () => {
  const out = namedRedactor(`key=${GOOGLE_KEY}`);
  assert.ok(!out.includes(GOOGLE_KEY));
  assert.ok(out.includes(REDACTED));
});

test('named: Stripe live secret key (sk_live_)', () => {
  const out = namedRedactor(`STRIPE_KEY=${STRIPE_SK}`);
  assert.ok(!out.includes(STRIPE_SK));
  assert.ok(out.includes(REDACTED));
});

test('named: Stripe restricted key (rk_live_)', () => {
  const out = namedRedactor(STRIPE_RK);
  assert.ok(!out.includes(STRIPE_RK));
  assert.ok(out.includes(REDACTED));
});

test('named: Stripe publishable key (pk_live_)', () => {
  const out = namedRedactor(STRIPE_PK);
  assert.ok(!out.includes(STRIPE_PK));
  assert.ok(out.includes(REDACTED));
});

test('named: Slack bot token (xoxb-)', () => {
  const out = namedRedactor(`token: ${SLACK_TOKEN}`);
  assert.ok(!out.includes(SLACK_TOKEN));
  assert.ok(out.includes(REDACTED));
});

test('named: Bearer header value', () => {
  const tok = 'eyJrawDummyBearerValue1234567890ABCDEF';
  const out = namedRedactor(`Authorization: Bearer ${tok}`);
  assert.ok(!out.includes(tok));
  assert.ok(out.includes(REDACTED));
});

test('named: PEM private key block', () => {
  const pem =
    '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----';
  const out = namedRedactor(pem);
  assert.ok(!out.includes('MIIEowIBAAKCAQEA'));
  assert.ok(out.includes(REDACTED));
});

test('named: .env assignment keeps key name, redacts value', () => {
  const out = namedRedactor(ENV_LINE);
  assert.ok(out.includes('API_KEY='), 'key name preserved');
  assert.ok(out.includes(REDACTED), 'value redacted');
  assert.ok(!out.includes('sup3rSecretValue123'), 'raw value must not survive');
});

test('named: generic 32-char hex token', () => {
  // A 32-hex-char session token or MD5-style key
  const hex32 = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
  const out = namedRedactor(`session=${hex32}`);
  assert.ok(!out.includes(hex32), `raw hex must not survive: ${out}`);
  assert.ok(out.includes(REDACTED));
});

// ── Entropy redactor ──────────────────────────────────────────────────────────

test('entropy: catches a high-entropy secret the named patterns miss', () => {
  const obs = { tool: 'Read', input: 'cat creds', output: `blob=${HIGH_ENTROPY}` };
  const { record } = safeScrubObservation(obs);
  assert.ok(!record.output.includes(HIGH_ENTROPY), 'high-entropy blob must be redacted');
});

test('shannonEntropy: returns 0 for an empty string', () => {
  assert.equal(shannonEntropy(''), 0);
});

test('shannonEntropy: single character has entropy 0', () => {
  assert.equal(shannonEntropy('aaaa'), 0);
});

test('shannonEntropy: random-looking token has high entropy', () => {
  // A 40-char mixed alphanum token should be > 3.5
  assert.ok(shannonEntropy(HIGH_ENTROPY) > 3.5, 'high entropy expected');
});

test('shannonEntropy: ordinary words have low entropy', () => {
  // "hello" and "world" should be well below 3.5
  assert.ok(shannonEntropy('hello') < 3.5);
  assert.ok(shannonEntropy('world') < 3.5);
});

// ── False-positive guards ─────────────────────────────────────────────────────

test('ordinary English prose is NOT over-redacted', () => {
  const prose = 'The quick brown fox jumps over the lazy dog near the river bank today.';
  const obs = { tool: 'Bash', input: prose, output: 'done' };
  const { record } = safeScrubObservation(obs);
  assert.equal(record.input, prose, 'plain English must pass through untouched');
});

test('short identifier-like tokens are NOT redacted', () => {
  const text = 'status=ok code=200 id=abc123 tag=v1.2.3';
  const out = scrubText(text);
  assert.equal(out, text, 'short identifiers must pass through');
});

test('all-alpha words above minLen are NOT redacted by entropy redactor', () => {
  // "authentication" and "authorization" are >20 chars but all-alpha
  const text = 'authentication and authorization are required';
  const out = entropyRedactor(text);
  assert.equal(out, text, 'all-alpha long words must pass through');
});

test('numeric-only timestamps are NOT redacted', () => {
  const text = 'ts=1718800000000';
  const out = scrubText(text);
  assert.equal(out, text, 'numeric timestamps must pass through');
});

test('URL paths are NOT redacted', () => {
  const text = 'GET /api/v1/users/me HTTP/1.1';
  const out = scrubText(text);
  assert.equal(out, text, 'URL paths must pass through');
});

// ── Fail-CLOSED ───────────────────────────────────────────────────────────────

test('FAIL-CLOSED: a throwing redactor drops the observation (no raw passthrough)', () => {
  const boom = () => { throw new Error('redactor exploded'); };
  const obs = { tool: 'Bash', input: `secret ${GH_TOKEN}`, output: 'x' };
  const res = safeScrubObservation(obs, [...DEFAULT_REDACTORS, boom]);
  assert.equal(res.dropped, true, 'must drop on scrub failure');
  assert.equal(res.record, undefined, 'nothing persisted on drop');
  assert.ok(!JSON.stringify(res).includes(GH_TOKEN), 'raw token must not leak via the drop path');
});

test('scrubObservation itself throws on failure (non-object obs)', () => {
  assert.throws(() => scrubObservation('not-an-object'), TypeError);
});

test('FAIL-CLOSED: null obs does not crash — drops gracefully', () => {
  const res = safeScrubObservation(null);
  assert.equal(res.dropped, true);
  assert.equal(res.record, undefined);
});

test('FAIL-CLOSED: a circular-reference field drops the observation, never hangs or leaks', () => {
  // scrubValue recurses into objects; a cyclic reference would recurse until the
  // stack overflows (RangeError). The fail-closed boundary must convert that throw
  // into a drop — never an unbounded hang, never a raw passthrough.
  const cyclic = { command: `export TOKEN=${GH_TOKEN}` };
  cyclic.self = cyclic; // introduce the cycle
  const obs = { tool: 'Bash', input: cyclic, output: null };
  const res = safeScrubObservation(obs);
  assert.equal(res.dropped, true, 'circular reference must drop, not hang');
  assert.equal(res.record, undefined, 'nothing persisted on drop');
  assert.ok(!JSON.stringify(res).includes(GH_TOKEN), 'raw token must not leak via the drop path');
});

test('scrubObservation itself throws on failure (boundary is the safe wrapper)', () => {
  // null obs is a hard failure: the record is not an object at all.
  assert.throws(() => scrubObservation(null), TypeError);
});

// ── Non-secret fields are preserved ──────────────────────────────────────────

test('non-secret fields (tool, ts) are preserved through scrubbing', () => {
  const obs = { tool: 'Bash', input: 'ls', output: 'a b c', ts: 12345 };
  const { dropped, record } = safeScrubObservation(obs);
  assert.equal(dropped, false);
  assert.equal(record.tool, 'Bash');
  assert.equal(record.ts, 12345);
});

test('observations with no input/output fields pass through unchanged', () => {
  const obs = { tool: 'Info', metadata: 'hello', ts: 999 };
  const { dropped, record } = safeScrubObservation(obs);
  assert.equal(dropped, false);
  assert.equal(record.metadata, 'hello');
  assert.equal(record.ts, 999);
});

// ── Idempotence ───────────────────────────────────────────────────────────────

test('idempotence: scrubbing already-scrubbed output is a no-op', () => {
  const obs = { tool: 'Bash', input: `token: ${GH_TOKEN}`, output: 'ok' };
  const { record: first } = safeScrubObservation(obs);
  const { dropped, record: second } = safeScrubObservation(first);
  assert.equal(dropped, false);
  assert.equal(second.input, first.input, 'second scrub must not alter the output');
  assert.equal(second.output, first.output);
});

test('idempotence: REDACTED placeholder is preserved, not re-redacted', () => {
  const alreadyScrubbed = `key: ${REDACTED} and value: ${REDACTED}`;
  const out = scrubText(alreadyScrubbed);
  assert.equal(out, alreadyScrubbed, 'already-redacted text must be a no-op');
});

// ── Bounded runtime ───────────────────────────────────────────────────────────

test('bounded runtime: ~5k input completes quickly (under 500ms)', () => {
  // A realistic 5 KiB scrub payload (the hook's target truncation size).
  const payload = 'x9K2mP7nQ1rV4sL8wZ3bD6jE0uA5tF'.repeat(170); // ~5 KiB
  const obs = { tool: 'Bash', input: payload, output: payload };
  const start = Date.now();
  safeScrubObservation(obs);
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 500, `5k scrub took ${elapsed}ms, expected <500ms`);
});

test('bounded runtime: 1 MB oversized input is capped and completes quickly (under 1000ms)', () => {
  // 1 MiB — well above MAX_INPUT_LEN (64 KiB); must be truncated, not hung.
  const big = 'Ab1C2dE3fG4hI5jK6lM7nO8pQ9rS0tU1v2W3xY4z5A6'.repeat(23000); // ~1 MB
  const obs = { tool: 'Bash', input: big, output: big };
  const start = Date.now();
  const res = safeScrubObservation(obs);
  const elapsed = Date.now() - start;
  assert.equal(res.dropped, false, 'oversized input must not be dropped, just truncated');
  assert.ok(elapsed < 1000, `1 MB scrub took ${elapsed}ms, expected <1000ms`);
  // The record fields must be shorter than the original (truncation applied).
  assert.ok(res.record.input.length < big.length, 'input field was truncated');
});

// ── Structure-aware scrubbing (obs-log integration hazard) ────────────────────
//
// These tests cover the real obs-log record shape where input/output are routinely
// null (tool_start has no output; tool_complete has no input) and where field values
// are objects or arrays, not plain strings.

test('structure-aware: output:null on tool_start record is NOT dropped, input scrubbed', () => {
  // tool_start shape: input may have a secret, output is always null
  const obs = { tool: 'Bash', input: `run ${GH_TOKEN}`, output: null, event: 'tool_start' };
  const res = safeScrubObservation(obs);
  assert.equal(res.dropped, false, 'null output must not trigger a drop');
  assert.equal(res.record.output, null, 'null output field preserved');
  assert.ok(res.record.input.includes(REDACTED), 'secret in input still redacted');
  assert.ok(!res.record.input.includes(GH_TOKEN), 'raw token not present in input');
});

test('structure-aware: input:null on tool_complete record is NOT dropped, output scrubbed', () => {
  // tool_complete shape: output may have a secret, input is always null
  const obs = { tool: 'Bash', input: null, output: `token=${GH_TOKEN}`, event: 'tool_complete' };
  const res = safeScrubObservation(obs);
  assert.equal(res.dropped, false, 'null input must not trigger a drop');
  assert.equal(res.record.input, null, 'null input field preserved');
  assert.ok(res.record.output.includes(REDACTED), 'secret in output still redacted');
  assert.ok(!res.record.output.includes(GH_TOKEN), 'raw token not present in output');
});

test('structure-aware: object input with secret string is deep-scrubbed, structure preserved', () => {
  // A Bash tool input often arrives as { command: "..." } — NOT a plain string.
  const obs = {
    tool: 'Bash',
    input: { command: `export TOKEN=${GH_TOKEN}` },
    output: null,
  };
  const res = safeScrubObservation(obs);
  assert.equal(res.dropped, false, 'object input must not be dropped');
  assert.ok(typeof res.record.input === 'object', 'object structure preserved');
  assert.ok(!res.record.input.command.includes(GH_TOKEN), 'secret inside object field redacted');
  assert.ok(res.record.input.command.includes(REDACTED), 'REDACTED marker present in object field');
});

test('structure-aware: nested object within object — all strings deep-scrubbed', () => {
  const obs = {
    tool: 'Write',
    input: {
      path: '/tmp/creds.json',
      content: { api_key: OPENAI_KEY, note: 'harmless text' },
    },
    output: null,
  };
  const res = safeScrubObservation(obs);
  assert.equal(res.dropped, false, 'nested object must not be dropped');
  assert.ok(!res.record.input.content.api_key.includes(OPENAI_KEY), 'nested secret redacted');
  assert.equal(res.record.input.content.note, 'harmless text', 'harmless nested string preserved');
  assert.equal(res.record.input.path, '/tmp/creds.json', 'short path not redacted');
});

test('structure-aware: array of strings with a secret — all strings scrubbed, structure preserved', () => {
  const obs = {
    tool: 'Bash',
    input: ['echo hello', `export GH=${GH_TOKEN}`, 'ls -la'],
    output: null,
  };
  const res = safeScrubObservation(obs);
  assert.equal(res.dropped, false, 'array input must not be dropped');
  assert.ok(Array.isArray(res.record.input), 'array structure preserved');
  assert.equal(res.record.input[0], 'echo hello', 'harmless array element preserved');
  assert.ok(!res.record.input[1].includes(GH_TOKEN), 'secret in array element redacted');
  assert.ok(res.record.input[1].includes(REDACTED), 'REDACTED marker in array element');
  assert.equal(res.record.input[2], 'ls -la', 'last array element preserved');
});

test('structure-aware: number and boolean fields are left intact, not dropped', () => {
  // Ensures a numeric ts or boolean flag on a scrubbed field doesn't cause a drop.
  // (SCRUBBED_FIELDS are input+output; this tests those fields as non-string primitives.)
  const obs = { tool: 'Bash', input: 'ls', output: 'ok', ts: 1718800000000, ok: true };
  const res = safeScrubObservation(obs);
  assert.equal(res.dropped, false);
  assert.equal(res.record.ts, 1718800000000, 'numeric ts preserved');
  assert.equal(res.record.ok, true, 'boolean field preserved');
});

test('structure-aware: FAIL-CLOSED still holds — throwing redactor on string in object drops the obs', () => {
  // Even inside an object-valued field, a genuinely failing redactor must drop.
  const boom = () => { throw new Error('redactor exploded inside object'); };
  const obs = {
    tool: 'Bash',
    input: { command: `export TOKEN=${GH_TOKEN}` },
    output: null,
  };
  const res = safeScrubObservation(obs, [...DEFAULT_REDACTORS, boom]);
  assert.equal(res.dropped, true, 'throwing redactor inside object field must still drop');
  assert.equal(res.record, undefined, 'nothing persisted on drop');
  assert.ok(!JSON.stringify(res).includes(GH_TOKEN), 'raw token must not leak via the drop path');
});

// ── Documented false positive (intentional, not a bug) ───────────────────────

test('KNOWN FALSE POSITIVE: a 40-hex git SHA is redacted by the bare-40-char-base64 rule', () => {
  // The 40-char base64 pattern (/\b[A-Za-z0-9/+]{40}\b/) is deliberately broad to
  // catch AWS secret access keys. A 40-hex git SHA (which is a strict subset of that
  // alphabet) is also matched and redacted. This is an accepted trade-off: the scrubber
  // is fail-safe (false positives are preferred over leaking a real secret). The only
  // cost is a redacted SHA in a captured observation — not a correctness hazard.
  const gitSha = 'a3f5b2c8d1e4f7a0b3c6d9e2f5a8b1c4d7e0f3a6';
  assert.ok(/^[0-9a-fA-F]{40}$/.test(gitSha), 'fixture is a valid 40-hex git SHA');
  const out = namedRedactor(`commit ${gitSha} looks like this`);
  assert.ok(out.includes(REDACTED), '40-hex SHA is redacted (accepted false positive, not a bug)');
  assert.ok(!out.includes(gitSha), 'raw SHA not present after scrub');
});
