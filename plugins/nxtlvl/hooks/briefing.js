#!/usr/bin/env node
/**
 * nxtlvl briefing hook  —  SessionStart
 *
 * At every session start, injects a short "where you left off" briefing on
 * top of what Claude Code already auto-loads (CLAUDE.md + MEMORY.md). The
 * briefing has three blocks:
 *
 *   1. git line   — current branch + uncommitted-changes flag (or folder fallback
 *                   if off-git / detached HEAD).
 *   2. bookmark   — the newest saved note for the current piece of work, including
 *                   its date. A staleness flag is appended when the observation log
 *                   has activity newer than the note (§4.4 crash-safety).
 *   3. instincts  — quality-gated instincts from recall(), named by trigger/id with
 *                   a one-line action gist each. When the ceiling truncates some,
 *                   the missed names are called out explicitly.
 *
 * Injection channel (proven by Phase-0 Spike 0.2):
 *   emit JSON { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } }
 *
 * FAIL-OPEN IS ABSOLUTE: every path that could throw is wrapped in the outer
 * try/catch whose catch returns '' — a true no-op. The session is NEVER blocked.
 *
 * Kill switch: NXTLVL_CM_BRIEFING=off/0/false/no/disabled → silent no-op.
 * Skip guards:
 *   NXTLVL_CM_OBSERVER set (truthy, non-off) → skip (never brief the observer).
 *   isSidechain=true in the event payload   → skip.
 */

'use strict';

const { execFileSync } = require('node:child_process');

const recallLib      = require('../lib/recall.js');
const bookmarksLib   = require('../lib/bookmarks.js');
const obsLogLib      = require('../lib/obs-log.js');
const projIdentLib   = require('../lib/project-identity.js');

// --- Constants ----------------------------------------------------------------

/** Max bytes to read from stdin. */
const MAX_STDIN = 4 * 1024 * 1024;

/** Values that disable the hook. */
const OFF_VALUES = ['0', 'false', 'no', 'off', 'disabled'];

// --- Helpers ------------------------------------------------------------------

/** True when an env value reads as an explicit off/disable switch. */
function isOffLike(raw) {
  return OFF_VALUES.includes(String(raw || '').trim().toLowerCase());
}

function isBriefingDisabled(env) {
  return isOffLike(env.NXTLVL_CM_BRIEFING);
}

function isObserverRun(env) {
  const v = env.NXTLVL_CM_OBSERVER;
  return !!(v && !isOffLike(v));
}

/**
 * Build the git line for the current working directory.
 * Returns a human-readable string: branch name + uncommitted-changes flag.
 * Never throws — all errors produce a graceful fallback.
 * @param {string} cwd
 * @returns {string}
 */
function defaultGitLine(cwd) {
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    if (!branch || branch === 'HEAD') {
      // Detached HEAD — fall back to folder name.
      const parts = cwd.replace(/\\/g, '/').split('/');
      const folder = parts[parts.length - 1] || cwd;
      return `Detached HEAD (folder: ${folder})`;
    }

    // Count uncommitted changes (staged + unstaged + untracked).
    let changes = 0;
    try {
      const status = execFileSync('git', ['status', '--porcelain'], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      changes = status.split('\n').filter(l => l.trim()).length;
    } catch {
      // If status fails, we still have a branch — omit the count.
      return `Branch \`${branch}\``;
    }

    const changeStr = changes === 0 ? 'clean' : `${changes} uncommitted change${changes === 1 ? '' : 's'}`;
    return `Branch \`${branch}\` · ${changeStr}`;
  } catch {
    // Off-git or git not available — fall back to folder name.
    try {
      const parts = cwd.replace(/\\/g, '/').split('/');
      return `Folder: ${parts[parts.length - 1] || cwd}`;
    } catch {
      return 'Folder: (unknown)';
    }
  }
}

/**
 * Render the bookmark block.
 * @param {string} projectId
 * @param {string} groupKey
 * @param {object} bookmarks - the bookmarks module (or injectable dep)
 * @param {object} obsLog - the obs-log module (or injectable dep)
 * @param {object} opts - passed through to obsLog.readAll for store injection
 * @returns {string}
 */
function renderBookmarkBlock(projectId, groupKey, bookmarks, obsLog, opts) {
  const newest = bookmarks.readNewest(projectId, groupKey);

  // Compute newest obs ts for staleness check.
  const all = obsLog.readAll(projectId, opts);
  const newestObsTs = all.length ? all[all.length - 1].ts : null;
  const stale = bookmarks.isStale(projectId, groupKey, newestObsTs);

  if (!newest) {
    const noNote = 'No saved bookmark for this branch yet.';
    return stale
      ? `${noNote}\n  (Observation log has activity — bookmark may be missing.)`
      : noNote;
  }

  // Format the date from newest.ts (ISO string).
  let dateStr = '';
  try {
    const d = new Date(newest.ts);
    dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    dateStr = newest.ts || '';
  }

  let block = `[${dateStr}] ${newest.note}`;
  if (stale) {
    block += '\n  ⚠ Observation log has newer activity — this note may be incomplete.';
  }
  return block;
}

/**
 * Render the instincts block from recall() output.
 * @param {{ injected: object[], truncatedNames: string[], total: number }} recallResult
 * @returns {string}
 */
function renderInstinctsBlock(recallResult) {
  const { injected, truncatedNames } = recallResult;

  if (injected.length === 0 && truncatedNames.length === 0) {
    return 'No instincts loaded (none qualified).';
  }

  const lines = [];
  for (const inst of injected) {
    const label = inst.trigger ? `${inst.trigger} (${inst.id})` : inst.id;
    // Compact the action to one line: take the first non-empty line.
    const actionLines = (inst.action || '').split('\n').map(l => l.trim()).filter(Boolean);
    const gist = actionLines[0] || '(no action text)';
    lines.push(`• ${label}: ${gist}`);
  }

  if (truncatedNames.length > 0) {
    const nameList = truncatedNames.map(n => `\`${n}\``).join(', ');
    lines.push(
      `${truncatedNames.length} strong instinct${truncatedNames.length === 1 ? '' : 's'} NOT loaded: ${nameList} → /evolve to consolidate.`,
    );
  }

  return lines.join('\n');
}

// --- Core --------------------------------------------------------------------

/**
 * @param {string} rawInput - SessionStart event JSON from stdin
 * @param {object} env      - process.env (or test substitute)
 * @param {object} deps     - injectable dependencies (for testing)
 * @returns {string} JSON hook output to emit, or '' for a no-op
 */
function run(rawInput, env = process.env, deps = {}) {
  try {
    // Kill switch
    if (isBriefingDisabled(env)) return '';

    // Observer self-watch guard
    if (isObserverRun(env)) return '';

    // Parse event
    const input = rawInput && rawInput.trim() ? JSON.parse(rawInput) : {};

    // Sidechain guard
    if (input.isSidechain === true) return '';

    const cwd = input.cwd || process.cwd();

    // Resolve injectable deps (default to real modules).
    const gitLine      = deps.gitLine      || defaultGitLine;
    const recall       = deps.recall       || recallLib.recall;
    const bookmarks    = deps.bookmarks    || bookmarksLib;
    const obsLog       = deps.obsLog       || obsLogLib;
    const projectId_fn = deps.projectIdentity || projIdentLib.projectIdentity;

    // Build store opts — thread env so obs-log reads from the injected store.
    const storeOpts = { env };

    // Resolve project identity.
    const identity = projectId_fn(cwd);
    const projectId = identity.key;

    // Group key (branch or folder fallback) — use the bookmarks helper.
    const groupKey = bookmarks.groupKeyFor(cwd);

    // --- Block 1: git line ---
    const gitLineStr = gitLine(cwd);

    // --- Block 2: bookmark ---
    const bookmarkStr = renderBookmarkBlock(projectId, groupKey, bookmarks, obsLog, storeOpts);

    // --- Block 3: instincts ---
    const recallResult = recall({ projectId }, env);
    const instinctsStr = renderInstinctsBlock(recallResult);

    // --- Assemble ---
    const additionalContext = [
      '## nxtlvl — where you left off',
      '',
      '**Git:** ' + gitLineStr,
      '',
      '**Last bookmark:**',
      bookmarkStr,
      '',
      '**Instincts loaded:**',
      instinctsStr,
    ].join('\n');

    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext,
      },
    });
  } catch {
    return ''; // fail-open: never block the session
  }
}

// --- stdin entrypoint --------------------------------------------------------

if (require.main === module) {
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (data.length < MAX_STDIN) data += chunk.substring(0, MAX_STDIN - data.length);
  });
  process.stdin.on('end', () => {
    const out = run(data);
    if (out) process.stdout.write(out);
    process.exit(0);
  });
}

// --- Exports (for testing) ---------------------------------------------------

module.exports = {
  run,
  isOffLike,
  isBriefingDisabled,
  isObserverRun,
  defaultGitLine,
  renderBookmarkBlock,
  renderInstinctsBlock,
};
