#!/usr/bin/env node
/**
 * nxtlvl dangerous-bash gate  —  PreToolUse matcher: Bash
 *
 * The harness's FIRST blocking gate. It inspects `tool_input.command` and
 * blocks (exit 2) a small, high-confidence set of catastrophic, irreversible
 * shell commands. It is deliberately CONSERVATIVE: a daily-driver gate earns
 * its keep by almost never firing on legitimate work, so the block set is
 * narrow and targeted (root-ish destruction, not "anything scary").
 *
 * Governed by ADR-006 (docs/decisions/ADR-006-hook-fail-open-gated-blocking.md):
 *   - ERRORS FAIL OPEN, ABSOLUTELY. Any unexpected failure (bad/empty stdin,
 *     parse error, unknown shape) -> exit 0, block nothing. A block is only ever
 *     a decision this gate reached CLEANLY; never the byproduct of a crash.
 *   - exit 2 = block (a clean decision); stderr carries the reason + override.
 *   - exit 0 = allow. A WARN is exit 0 with a stderr nudge (non-blocking).
 *   - Ships an env kill switch:  NXTLVL_DANGEROUS_BASH=off  disables it entirely.
 *
 * Node (not bash+jq) is the deliberate parse strategy: JSON.parse handles
 * quoted / escaped / multiline command strings robustly, it reuses the
 * context-alert.js `node` hook precedent, and it has no jq dependency that
 * could be absent and silently neuter the gate.
 *
 * BLOCK set (catastrophic, irreversible, high-confidence):
 *   - recursive force-remove of a root-ish path (rm -rf /, ~, $HOME, /*, --no-preserve-root)
 *   - force-push to a protected branch (git push --force/-f or +ref -> main/master)
 *   - piping a network download into a shell (curl|wget ... | sh, bash <(curl ...))
 *   - writing to a raw block device (dd of=/dev/sdX, > /dev/disk…) or mkfs
 *   - recursive chmod 777 on a broad/system path
 *   - the classic fork bomb
 *
 * WARN set (destructive-but-common -> allowed, stderr nudge only):
 *   - git reset --hard
 *   - git clean -f… (with -d/-x)
 *
 * Tunable via env:
 *   NXTLVL_DANGEROUS_BASH   set to off/0/false/no/disabled to disable entirely
 */

'use strict';

const MAX_STDIN = 4 * 1024 * 1024; // bound the stdin read
const MAX_CMD_ECHO = 400; // truncate the command echoed back in messages

function isDisabled(env) {
  const v = String(env.NXTLVL_DANGEROUS_BASH || '').trim().toLowerCase();
  return ['0', 'false', 'no', 'off', 'disabled'].includes(v);
}

/** Strip one layer of surrounding single/double quotes from a token. */
function unquote(t) {
  return t.replace(/^['"]/, '').replace(/['"]$/, '');
}

// Paths whose recursive-force deletion is (almost) never intentional.
const ROOTISH = new Set([
  '/', '/*', '/.', '~', '~/', '~/*', '~/.',
  '$HOME', '$HOME/', '$HOME/*', '${HOME}', '${HOME}/', '${HOME}/*'
]);

// Broad/system paths where a recursive chmod 777 is catastrophic.
const BROAD = new Set([
  '/', '/*', '~', '~/', '~/*', '$HOME', '$HOME/', '$HOME/*', '${HOME}', '${HOME}/', '${HOME}/*',
  '/etc', '/usr', '/var', '/bin', '/sbin', '/lib', '/opt', '/System', '/Library'
]);

/** Split a command into rough segments at shell separators, for per-invocation flag/target checks. */
function tokensAfter(args) {
  return args.trim().split(/\s+/).filter(Boolean).map(unquote);
}

function detectRmRoot(cmd) {
  const re = /\brm\b([^\n;|&]*)/g; // each `rm` and its args up to a separator
  let m;
  while ((m = re.exec(cmd)) !== null) {
    const args = m[1];
    const recursive = /(^|\s)-[a-zA-Z]*[rR]/.test(args) || /\s--recursive\b/.test(args);
    const force = /(^|\s)-[a-zA-Z]*f/.test(args) || /\s--force\b/.test(args);
    if (!(recursive && force)) continue;
    if (/--no-preserve-root\b/.test(args)) {
      return 'rm with --no-preserve-root (forced deletion of the filesystem root)';
    }
    if (tokensAfter(args).some(t => ROOTISH.has(t))) {
      return 'recursive force-remove of a root-ish path (e.g. rm -rf /)';
    }
  }
  return null;
}

function detectForcePush(cmd) {
  if (!/\bgit\s+push\b/.test(cmd)) return null;
  if (!/(^|[\s:+/])(?:main|master)\b/.test(cmd)) return null; // only protected branches
  // --force (but NOT --force-with-lease, which is the safe variant) or a bare -f flag
  const forceFlag = /(^|\s)--force(\s|$)/.test(cmd) || /(^|\s)-f(\s|$)/.test(cmd);
  // a '+'-prefixed refspec targeting main/master, e.g. `+main`, `+refs/heads/main`, `+HEAD:main`
  const forceRefspec = /(^|\s)\+\S*(?:main|master)\b/.test(cmd);
  if (forceFlag || forceRefspec) {
    return 'force-push to a protected branch (main/master)';
  }
  return null;
}

function detectNetworkPipeShell(cmd) {
  if (/\b(?:curl|wget|fetch)\b[^\n]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|dash|ksh|fish)\b/.test(cmd)) {
    return 'piping a network download straight into a shell (curl/wget … | sh)';
  }
  if (/\b(?:sh|bash|zsh|dash|ksh)\b\s+(?:-\S+\s+)*<\(\s*(?:curl|wget)\b/.test(cmd)) {
    return 'executing a network download via process substitution (bash <(curl …))';
  }
  if (/\b(?:sh|bash|zsh|eval)\b[^\n]*\$\(\s*(?:curl|wget)\b/.test(cmd)) {
    return 'executing a network download via command substitution (sh -c "$(curl …)")';
  }
  return null;
}

function detectDeviceWrite(cmd) {
  const dev = '(?:disk|rdisk|sd[a-z]|nvme\\d|hd[a-z]|mmcblk\\d|vd[a-z]|loop\\d)';
  if (new RegExp(`\\bdd\\b[^\\n]*\\bof=\\/dev\\/${dev}`).test(cmd)) {
    return 'dd writing directly to a block device (of=/dev/…)';
  }
  if (/\bmkfs(?:\.[a-z0-9]+)?\b/.test(cmd)) {
    return 'formatting a filesystem (mkfs)';
  }
  if (new RegExp(`(^|\\s)>\\|?\\s*\\/dev\\/${dev}`).test(cmd)) {
    return 'redirecting output onto a block device (> /dev/…)';
  }
  return null;
}

function detectChmod777(cmd) {
  const re = /\bchmod\b([^\n;|&]*)/g;
  let m;
  while ((m = re.exec(cmd)) !== null) {
    const args = m[1];
    const recursive = /(^|\s)-[a-zA-Z]*R/.test(args) || /\s--recursive\b/.test(args);
    const mode777 = /(^|\s)0?777(\s|$)/.test(args) || /(^|\s)a=rwx(\s|$)/.test(args);
    if (!(recursive && mode777)) continue;
    if (tokensAfter(args).some(t => BROAD.has(t))) {
      return 'recursive chmod 777 on a broad/system path';
    }
  }
  return null;
}

function detectForkBomb(cmd) {
  // classic `:(){ :|:& };:` and named-function variants `b(){ b|b& };b`
  if (/(?:\w+|:)\s*\(\s*\)\s*\{\s*(?:\w+|:)\s*\|\s*(?:\w+|:)\s*&\s*\}\s*;/.test(cmd)) {
    return 'fork bomb';
  }
  return null;
}

const BLOCK_DETECTORS = [
  detectRmRoot,
  detectForcePush,
  detectNetworkPipeShell,
  detectDeviceWrite,
  detectChmod777,
  detectForkBomb
];

function firstBlock(cmd) {
  for (const detect of BLOCK_DETECTORS) {
    const reason = detect(cmd);
    if (reason) return reason;
  }
  return null;
}

function firstWarn(cmd) {
  if (/\bgit\s+reset\b[^\n;|&]*--hard\b/.test(cmd)) {
    return 'git reset --hard discards all uncommitted changes';
  }
  if (/\bgit\s+clean\b[^\n;|&]*-[a-zA-Z]*f/.test(cmd)) {
    return 'git clean -f… deletes untracked files (and with -x, git-ignored files too)';
  }
  return null;
}

function echoCmd(cmd) {
  const oneLine = cmd.replace(/\s+/g, ' ').trim();
  return oneLine.length > MAX_CMD_ECHO ? `${oneLine.slice(0, MAX_CMD_ECHO)}…` : oneLine;
}

function blockMessage(cmd, reason) {
  return (
    'nxtlvl · dangerous-bash — BLOCKED a catastrophic command.\n\n' +
    `  reason:  ${reason}\n` +
    `  command: ${echoCmd(cmd)}\n\n` +
    'This is almost always a mistake. If it is genuinely intended, disable the gate\n' +
    'and retry: set  NXTLVL_DANGEROUS_BASH=off  in your environment\n' +
    '(settings.json "env", or export it in the launching shell).\n'
  );
}

function warnMessage(reason) {
  return `nxtlvl · dangerous-bash — WARNING: ${reason}. Allowed; double-check the target before running.\n`;
}

/**
 * Pure decision core (testable). Returns { code, message }.
 *   code 0 = allow (message may be a non-blocking warn nudge, or '')
 *   code 2 = block (message is the reason + override)
 * Any unexpected error -> { code: 0 } (fail-open).
 *
 * @param {string} rawInput - PreToolUse event JSON on stdin
 * @param {object} env
 */
function decide(rawInput, env = process.env) {
  try {
    if (isDisabled(env)) return { code: 0, message: '' };

    const input = rawInput && rawInput.trim() ? JSON.parse(rawInput) : {};
    const ti = input && input.tool_input;
    const cmd = ti && typeof ti.command === 'string' ? ti.command : '';
    if (!cmd.trim()) return { code: 0, message: '' };

    const block = firstBlock(cmd);
    if (block) return { code: 2, message: blockMessage(cmd, block) };

    const warn = firstWarn(cmd);
    if (warn) return { code: 0, message: warnMessage(warn) };

    return { code: 0, message: '' };
  } catch {
    return { code: 0, message: '' }; // fail-open: an error must never block a session
  }
}

if (require.main === module) {
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (data.length < MAX_STDIN) data += chunk.substring(0, MAX_STDIN - data.length);
  });
  const finish = () => {
    let result = { code: 0, message: '' };
    try {
      result = decide(data);
    } catch {
      result = { code: 0, message: '' }; // belt-and-suspenders fail-open
    }
    if (result.message) process.stderr.write(result.message);
    process.exit(result.code === 2 ? 2 : 0);
  };
  process.stdin.on('end', finish);
  process.stdin.on('error', finish); // unreadable stdin -> fail open
}

module.exports = {
  decide,
  firstBlock,
  firstWarn,
  detectRmRoot,
  detectForcePush,
  detectNetworkPipeShell,
  detectDeviceWrite,
  detectChmod777,
  detectForkBomb,
  isDisabled
};
