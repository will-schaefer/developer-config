// scrub — secret-scrubbing module for the C&M write path (Phase 2, Task 2.1).
//
// Productionized from cm-phase0-workspace/scrub.js (Spike 0.4). Spec §4.2 / §7-c.
//
// Scrubs BOTH the `input` and `output` fields of a tool-call observation before
// any persistence. Two redaction passes:
//
//   1. Named-format regexes — known secret shapes (tokens, keys, assignments, PEM).
//   2. Entropy redactor — high-entropy random-looking blobs the named patterns miss.
//
// Fail-CLOSED contract (§7-c): if any scrub step throws or cannot complete, the
// observation is DROPPED — it is never persisted raw. The boundary function
// (`safeScrubObservation`) swallows the throw and returns { dropped: true, reason }.
// The hook MUST call this function and MUST drop on `dropped: true`.
//
// Bounded runtime: the capture hook truncates observations to ~5k chars before
// calling us. We additionally enforce MAX_INPUT_LEN on each scrubbed field to guard
// against adversarial or malformed inputs that bypass the hook's truncation.
//
// Order-independence and idempotence: named patterns match fixed shapes and the
// entropy redactor skips already-short tokens; scrubbing '[REDACTED]' (11 chars)
// changes nothing further.

'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────

const REDACTED = '[REDACTED]';

// Hard cap per scrubbed field. A pathological >1MB string cannot hang the regex
// engine or entropy pass. The hook truncates to ~5k; this is a belt-and-suspenders
// guard so a malformed or hand-crafted obs cannot exhaust CPU.
const MAX_INPUT_LEN = 64 * 1024; // 64 KiB per field

// Entropy thresholds for the entropy redactor:
//   minLen    — tokens shorter than this are almost certainly words or identifiers,
//               not secrets; skip them to avoid destroying legitimate short values.
//   minEntropy — Shannon entropy (bits/char) above which a long token is flagged.
//                3.5 bits/char empirically excludes English prose words (≤3.0) and
//                catches random hex / base64 blobs (≥3.8). If raised to 4.0, some
//                dense but legitimate values could be wrongly kept; if lowered to 3.0,
//                ordinary words are redacted — 3.5 is the conservative midpoint.
const ENTROPY_MIN_LEN = 20;
const ENTROPY_MIN_BITS = 3.5;

// ── Named-format redactors ────────────────────────────────────────────────────
//
// Order-independent: named patterns are applied BEFORE the entropy pass, and the
// entropy pass skips already-replaced '[REDACTED]' tokens (too short after replacement).

const NAMED_PATTERNS = [
  // GitHub personal / OAuth / server / refresh / user / fine-grained tokens
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,

  // OpenAI-style and generic "sk-" API keys (OpenAI, Anthropic, etc.)
  /\bsk-[A-Za-z0-9]{20,}\b/g,

  // AWS access key id (always AKIA + 16 uppercase alphanum)
  /\bAKIA[0-9A-Z]{16}\b/g,

  // Slack tokens (bot, app, personal, refresh, socket)
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,

  // Bearer authorization header values
  /\b[Bb]earer\s+[A-Za-z0-9._~+/\-]{12,}=*/g,

  // PEM private key blocks (e.g. RSA, EC, PKCS#8, GCP service account)
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,

  // JWT (three base64url-encoded segments separated by dots, first starts with eyJ)
  // The three segments must each be ≥4 chars (header/payload/signature minimums).
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g,

  // Google API key (AIza prefix + 35 URL-safe chars)
  /\bAIza[A-Za-z0-9_\-]{35}\b/g,

  // Stripe live secret key / restricted key / publishable key
  /\b(?:sk|rk|pk)_live_[A-Za-z0-9]{20,}\b/g,

  // AWS secret access key: 40-char base64 block after a keyword-named env var.
  // The env-assignment rule below also catches SECRET-named assignments; this
  // pattern is a dedicated shape to cover bare secret-access-key literals that
  // appear without an assignment (e.g. copy-pasted in a comment or echo output).
  /\b[A-Za-z0-9/+]{40}\b(?=[^A-Za-z0-9/+]|$)/g,

  // Generic hex tokens: 32+ consecutive hex characters (e.g. MD5/SHA hashes used
  // as secrets, session tokens, API keys in hex encoding). Stops before 40 chars to
  // avoid colliding with the AWS rule above. Allow exactly 32–39 here; ≥40 is AWS.
  // Note: This intentionally has a conservative lower bound (32) to skip short IDs.
  /\b[0-9a-fA-F]{32,39}\b/g,
];

// .env-style assignment: keep the key name, redact the VALUE.
// Matches:  API_KEY=hunter2  STRIPE_SECRET: "abc"  DATABASE_PASSWORD='xyz'
const ENV_ASSIGNMENT =
  /\b([A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD|CREDENTIAL|PRIVATE)[A-Za-z0-9_]*)(\s*[:=]\s*)(['"]?)([^\s'"]+)\3/gi;

/**
 * Apply all named-format patterns to `text`. Returns the scrubbed string.
 * @param {string} text
 * @returns {string}
 */
function namedRedactor(text) {
  // env-assignment first so the value is gone before the generic patterns scan
  let out = text.replace(ENV_ASSIGNMENT, (_m, key, sep) => `${key}${sep}${REDACTED}`);
  for (const re of NAMED_PATTERNS) out = out.replace(re, REDACTED);
  return out;
}

// ── Shannon entropy ────────────────────────────────────────────────────────────

/**
 * Shannon entropy of string `s` in bits per character.
 * Returns 0 for an empty string.
 * @param {string} s
 * @returns {number}
 */
function shannonEntropy(s) {
  if (!s.length) return 0;
  const freq = Object.create(null);
  for (const ch of s) freq[ch] = (freq[ch] || 0) + 1;
  let h = 0;
  for (const ch in freq) {
    const p = freq[ch] / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

// Tokenisation splitter: match runs of non-whitespace, non-punctuation chars.
// This intentionally excludes common punctuation so URL paths, JSON keys, and
// natural language words are treated as individual tokens, not a single blob.
const TOKEN_SPLIT = /([^\s'"=:,;()\[\]{}<>]+)/g;

/**
 * Entropy-based redactor: replace tokens that look like high-entropy secrets.
 * Skips short tokens and tokens that don't mix letters + digits (which would
 * incorrectly flag e.g. all-digit timestamps or all-alpha prose words).
 * @param {string} text
 * @param {{ minLen?: number, minEntropy?: number }} [opts]
 * @returns {string}
 */
function entropyRedactor(
  text,
  { minLen = ENTROPY_MIN_LEN, minEntropy = ENTROPY_MIN_BITS } = {},
) {
  return text.replace(TOKEN_SPLIT, (tok) => {
    if (tok.length < minLen) return tok;
    const hasLetter = /[A-Za-z]/.test(tok);
    const hasDigit = /[0-9]/.test(tok);
    // A "tokenish" string looks like a secret: mixes letters+digits, or is a
    // long pure-hex blob. Pure-alpha tokens above minLen are left alone because
    // they are more likely base64-alphabet prose or known keywords than secrets.
    const looksTokenish =
      (hasLetter && hasDigit) || /^[0-9a-fA-F]{32,}$/.test(tok);
    if (!looksTokenish) return tok;
    if (shannonEntropy(tok) < minEntropy) return tok;
    return REDACTED;
  });
}

// ── Pipeline ───────────────────────────────────────────────────────────────────

/** Default redactor pipeline: named shapes first, then entropy sweep. */
const DEFAULT_REDACTORS = [namedRedactor, entropyRedactor];

// Fields on an observation that must be scrubbed. Both input AND output are in
// scope: a secret that leaks via echo/cat in tool output is as dangerous as one
// passed as a tool argument.
const SCRUBBED_FIELDS = ['input', 'output'];

/**
 * Run every redactor over `text` in order.
 * Throws TypeError if `text` is not a string — this is deliberate so the safe
 * wrapper can catch it and enforce fail-CLOSED.
 * @param {string} text
 * @param {Function[]} [redactors]
 * @returns {string}
 */
function scrubText(text, redactors = DEFAULT_REDACTORS) {
  if (typeof text !== 'string') {
    throw new TypeError(`scrubText expects a string, got ${typeof text}`);
  }
  // Enforce the runtime bound before the regex/entropy passes.
  const bounded = text.length > MAX_INPUT_LEN ? text.slice(0, MAX_INPUT_LEN) : text;
  let out = bounded;
  for (const r of redactors) out = r(out);
  return out;
}

/**
 * Recursively scrub all string values within a value, preserving structure.
 *
 * Field-value contract (per-field, applied before the whole-obs fail-closed boundary):
 *   - null / undefined → returned as-is (no secret present, no scrub, no drop).
 *   - string           → scrubText; a throw here propagates and triggers a DROP.
 *   - object / array   → deep-clone with every nested string scrubbed; a throw on
 *                        any individual string propagates and triggers a DROP.
 *   - number / boolean → returned as-is (cannot contain a secret).
 *
 * @param {*} value
 * @param {Function[]} redactors
 * @returns {*}
 */
function scrubValue(value, redactors) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return scrubText(value, redactors);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, redactors));
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = scrubValue(value[k], redactors);
    return out;
  }
  // Any other type (symbol, function, etc.) — leave untouched.
  return value;
}

/**
 * Scrub the `input` and `output` fields of an observation object.
 * Returns a SHALLOW COPY with those fields replaced by their scrubbed equivalents.
 * THROWS on any failure — the caller (`safeScrubObservation`) decides fail policy.
 *
 * Field handling (see `scrubValue` for per-type contract):
 *   - A field absent from the record is skipped entirely.
 *   - A null / undefined field is left null/undefined — it carries no secret and must
 *     NOT trigger a drop; this handles the common obs-log shape where `output` is null
 *     on a tool_start event and `input` is null on a tool_complete event.
 *   - A string field is scrubbed via `scrubText`; a throw propagates → DROP.
 *   - An object / array field (e.g. `{ command: "export TOKEN=ghp_..." }`) is deep-
 *     scrubbed with all nested strings cleaned; structure is preserved.
 *   - A number or boolean field is left as-is; it cannot hold a secret.
 *
 * @param {object} obs
 * @param {Function[]} [redactors]
 * @returns {object}
 */
function scrubObservation(obs, redactors = DEFAULT_REDACTORS) {
  if (obs === null || typeof obs !== 'object') {
    throw new TypeError(`scrubObservation expects an object, got ${obs === null ? 'null' : typeof obs}`);
  }
  const record = { ...obs };
  for (const field of SCRUBBED_FIELDS) {
    if (field in record) record[field] = scrubValue(record[field], redactors);
  }
  return record;
}

/**
 * Fail-CLOSED boundary — the ONLY function the capture hook should call.
 *
 * On success:  { dropped: false, record: <scrubbed observation> }
 * On ANY error: { dropped: true, reason: <string> }
 *
 * The raw observation is NEVER returned when `dropped` is true. The caller
 * (the capture hook) MUST drop the observation on `dropped: true`.
 *
 * @param {object} obs
 * @param {Function[]} [redactors]
 * @returns {{ dropped: false, record: object } | { dropped: true, reason: string }}
 */
function safeScrubObservation(obs, redactors = DEFAULT_REDACTORS) {
  try {
    return { dropped: false, record: scrubObservation(obs, redactors) };
  } catch (err) {
    return {
      dropped: true,
      reason: err && err.message ? err.message : 'scrub failed',
    };
  }
}

// ── Exports ────────────────────────────────────────────────────────────────────

module.exports = {
  // Constants
  REDACTED,
  DEFAULT_REDACTORS,
  // Exported for testing and downstream composition
  shannonEntropy,
  namedRedactor,
  entropyRedactor,
  scrubText,
  scrubValue,
  scrubObservation,
  // The hook-facing boundary
  safeScrubObservation,
};
