#!/usr/bin/env node
'use strict';

// nxtlvl UserPromptSubmit hook — keep each session titled "<folder> · <branch>".
//
// Emits hookSpecificOutput.sessionTitle (same effect as /rename) on every prompt,
// so the title tracks the current branch even when it changes mid-session. Falls
// back to the folder name alone when the cwd is not a git repo or HEAD is detached.
// Kill switch: NXTLVL_SESSION_TITLE=off.
//
// Must never disrupt prompt submission: it never sets `decision`, so the prompt
// always proceeds; every failure path degrades silently to a best-effort title
// (or no output) and exits 0.

const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function gitBranch(cwd) {
  try {
    const out = execFileSync(
      'git',
      ['-C', cwd, 'symbolic-ref', '--quiet', '--short', 'HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return out.trim() || null;
  } catch {
    return null; // not a git repo, or detached HEAD
  }
}

function main() {
  if (process.env.NXTLVL_SESSION_TITLE === 'off') return;

  let cwd = process.cwd();
  try {
    const input = JSON.parse(readStdin() || '{}');
    if (input && typeof input.cwd === 'string' && input.cwd) cwd = input.cwd;
  } catch {
    // malformed/absent stdin — fall back to the hook's own cwd
  }

  const folder = path.basename(cwd) || cwd;
  const branch = gitBranch(cwd);
  const title = branch ? `${folder} · ${branch}` : folder;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        sessionTitle: title,
      },
    }),
  );
}

try {
  main();
} catch {
  // never let a title failure surface to the session
}
