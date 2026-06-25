// types — the nxtlvl ↔ Claude Code hook I/O type contract (PLATFORM BOUNDARY).
//
// This is the migration's core value: a single, typed source of truth for the
// shapes that cross the trust boundary between Claude Code and our hooks — the
// JSON payloads hooks read from stdin (`JSON.parse(stdin)`) and the JSON / exit
// codes they write back. These shapes are NOT under our control: they are the
// platform's wire format. Encoding them once, here, means every Phase-2 hook
// consumes the SAME definition via `import type { … } from './types.ts'` and the
// type-checker catches a field typo at the boundary instead of at 3am in a live
// session.
//
// THE BITE this contract exists to prevent (read before editing):
//   PreToolUse `tool_input` is shaped by `tool_name`. A `Skill` invocation puts
//   its target in `tool_input.skill`; a `Task`/Agent invocation puts its target
//   in `tool_input.subagent_type`. These are NOT interchangeable — reading
//   `.skill` off a Task payload (or `.subagent_type` off a Skill payload) is a
//   silent `undefined`. We model `ToolInput` as a discriminated union on
//   `tool_name` so this distinction is STRUCTURAL: narrowing to `'Skill'` brings
//   `.skill` into scope and `.subagent_type` does NOT exist, and vice-versa.
//
// ERASABILITY CONTRACT: this file is consumed under native Node type-stripping
// (no build step) with `erasableSyntaxOnly: true`. Everything here is
// `interface` / `type` alias / string-literal union ONLY — no `enum`, no
// `namespace` with runtime code, no classes, no `const` values. A types-only
// module type-strips to (essentially) nothing; that is correct and intended.
// Consumers MUST use `import type` with the explicit `.ts` extension so the
// import fully erases (zero runtime import).
//
// Ground truth: every field below is read or emitted by a live hook under
// plugins/nxtlvl/hooks/*.js. Do not add speculative fields — type to reality.

// ─── Discriminants ──────────────────────────────────────────────────────────

/**
 * `hook_event_name` — the stdin discriminant. The set of events nxtlvl hooks
 * actually register for (see hooks/hooks.json). Stop/SubagentStop/SessionEnd
 * share the termination shape.
 */
export type HookEventName =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'SessionEnd'
  | 'PreCompact'
  | 'Stop'
  | 'SubagentStop';

/**
 * `tool_name` — the `ToolInput` discriminant. Names we model precisely; any
 * other tool falls through to the permissive `OtherToolInput` member so
 * un-modeled hooks keep working.
 */
export type ToolName = 'Bash' | 'Write' | 'Edit' | 'Skill' | 'Task' | 'Agent';

// ─── Tool input — discriminated union on `tool_name` ────────────────────────
//
// The `tool_input` object PreToolUse/PostToolUse carry. Each variant lists the
// fields the live hooks read (dangerous-bash → `.command`; precompact's
// file-tool scan → `.file_path`/`.path`/`.notebook_path`; capture truncates the
// whole object). Optional `[key: string]: unknown` index signatures keep each
// variant permissive — the platform may add fields we don't model, and reading
// an unknown one yields `unknown`, not a type error.

export interface BashToolInput {
  command: string;
  [key: string]: unknown;
}

export interface WriteToolInput {
  file_path: string;
  content: string;
  [key: string]: unknown;
}

export interface EditToolInput {
  file_path: string;
  old_string?: string;
  new_string?: string;
  replace_all?: boolean;
  [key: string]: unknown;
}

/**
 * Skill invocation. THE BITE (half 1): the target skill lives in `.skill` —
 * NOT `.subagent_type`. See the file header.
 */
export interface SkillToolInput {
  skill: string;
  [key: string]: unknown;
}

/**
 * Task / Agent invocation. THE BITE (half 2): the target agent lives in
 * `.subagent_type` — NOT `.skill`. `prompt`/`description` are the other fields
 * the platform carries.
 */
export interface TaskToolInput {
  subagent_type: string;
  prompt: string;
  description: string;
  [key: string]: unknown;
}

/**
 * Permissive fallback for any tool we don't model precisely. `capture` and
 * `precompact` walk arbitrary tool_input objects (e.g. NotebookEdit's
 * `notebook_path`, Read's `path`), so an un-modeled tool must still type-check.
 */
export interface OtherToolInput {
  [key: string]: unknown;
}

export type ToolInput =
  | BashToolInput
  | WriteToolInput
  | EditToolInput
  | SkillToolInput
  | TaskToolInput
  | OtherToolInput;

// ─── Stdin payloads — discriminated union on `hook_event_name` ──────────────
//
// Common to every event. The C&M/context hooks read `session_id`,
// `transcript_path`, `cwd`; all are best-effort at the source (some run without
// a session_id), but the platform supplies them on the normal path.

export interface CommonHookFields {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: HookEventName;
}

/** PreToolUse — `tool_name` + `tool_input` (dangerous-bash, capture). */
export interface PreToolUseInput extends CommonHookFields {
  hook_event_name: 'PreToolUse';
  tool_name: string;
  tool_input: ToolInput;
}

/**
 * PostToolUse — adds `tool_response`. Its shape varies wildly by tool, so it is
 * intentionally `unknown`: capture truncates it blindly; do not over-constrain.
 */
export interface PostToolUseInput extends CommonHookFields {
  hook_event_name: 'PostToolUse';
  tool_name: string;
  tool_input: ToolInput;
  tool_response: unknown;
}

/** UserPromptSubmit — the submitted `prompt` (session-title also reads `cwd`). */
export interface UserPromptSubmitInput extends CommonHookFields {
  hook_event_name: 'UserPromptSubmit';
  prompt: string;
}

/**
 * SessionStart — `source` tells us why the session began. The string-literal
 * set is the platform's documented set; widened with `(string & {})` so an
 * unseen future source still type-checks rather than narrowing us into a corner.
 */
export interface SessionStartInput extends CommonHookFields {
  hook_event_name: 'SessionStart';
  source: 'startup' | 'resume' | 'clear' | 'compact' | (string & {});
}

/**
 * PreCompact — a real platform INPUT event (it fires), but nxtlvl no longer
 * registers a hook for it: PreCompact has NO output channel that can inject
 * context (see PreCompactOutput note below). The open-files re-surfacing that
 * once lived here moved to the SessionStart `source: 'compact'` path
 * (briefing.js + lib/open-files.js). `trigger` and `custom_instructions` are
 * kept as documentation of the event's shape.
 */
export interface PreCompactInput extends CommonHookFields {
  hook_event_name: 'PreCompact';
  trigger: 'manual' | 'auto' | (string & {});
  custom_instructions: string | null;
}

/**
 * Stop / SubagentStop / SessionEnd — termination events. `reason` is read by
 * close.js; `stop_hook_active` guards against a Stop-hook re-entry loop.
 */
export interface StopInput extends CommonHookFields {
  hook_event_name: 'Stop' | 'SubagentStop' | 'SessionEnd';
  reason: string;
  stop_hook_active?: boolean;
}

/**
 * The full stdin contract. Narrowing on `hook_event_name` brings the
 * event-specific fields into scope (this is what makes `.prompt` available on a
 * UserPromptSubmit but a type error on a PreToolUse).
 */
export type HookInput =
  | PreToolUseInput
  | PostToolUseInput
  | UserPromptSubmitInput
  | SessionStartInput
  | PreCompactInput
  | StopInput;

// ─── Output shapes — what hooks WRITE to stdout (JSON) ──────────────────────
//
// `hookSpecificOutput` is a discriminated union on `hookEventName` (camelCase
// in OUTPUT — note the casing differs from the snake_case `hook_event_name` on
// INPUT; that asymmetry is the platform's, not a typo). Each member lists the
// fields the live hooks emit.

/** PreToolUse decision channel. dangerous-bash blocks via exit 2 (see ExitCode)
 *  rather than this JSON path, but the platform also accepts a JSON decision. */
export interface PreToolUseOutput {
  hookEventName: 'PreToolUse';
  permissionDecision?: 'allow' | 'deny' | 'ask' | 'defer';
  permissionDecisionReason?: string;
  updatedInput?: Record<string, unknown>;
}

/** UserPromptSubmit — session-title.js emits `sessionTitle`; `additionalContext`
 *  is the documented injection channel for this event. Both optional. */
export interface UserPromptSubmitOutput {
  hookEventName: 'UserPromptSubmit';
  additionalContext?: string;
  sessionTitle?: string;
}

/** PostToolUse — context-alert.js injects `additionalContext`. */
export interface PostToolUseOutput {
  hookEventName: 'PostToolUse';
  additionalContext?: string;
}

/** SessionStart — briefing.js injects the floor brief via `additionalContext`. */
export interface SessionStartOutput {
  hookEventName: 'SessionStart';
  additionalContext?: string;
}

// NOTE (RESOLVED 2026-06-25): PreCompact has NO output channel. The suspicion
// flagged here previously was confirmed by reading the installed validator
// (Claude Code 2.1.191): the `hookSpecificOutput` discriminated union has no
// `PreCompact` (or `PostCompact`) branch, so `{ hookEventName: 'PreCompact',
// additionalContext }` always fails output validation with "Invalid input".
// The old precompact.js hook was retired and its open-files extraction moved to
// the SessionStart `source: 'compact'` path. There is therefore no
// PreCompactOutput type — a PreCompact hook cannot emit hookSpecificOutput.

/** Stop / SubagentStop. */
export interface StopOutput {
  hookEventName: 'Stop' | 'SubagentStop';
  additionalContext?: string;
}

export type HookSpecificOutput =
  | PreToolUseOutput
  | UserPromptSubmitOutput
  | PostToolUseOutput
  | SessionStartOutput
  | StopOutput;

/**
 * The top-level object a hook prints to stdout as JSON. Every field is optional:
 * a hook that emits `''` / nothing is a valid no-op. Fields mirror the platform's
 * documented hook-output schema; nxtlvl hooks predominantly use
 * `hookSpecificOutput`.
 */
export interface HookOutput {
  continue?: boolean;
  suppressOutput?: boolean;
  stopReason?: string;
  decision?: 'approve' | 'block';
  reason?: string;
  systemMessage?: string;
  terminalSequence?: string;
  hookSpecificOutput?: HookSpecificOutput;
}

// ─── Exit-code convention (documentation, not runtime) ──────────────────────
//
// Hooks signal blocking via the process exit code as well as / instead of JSON.
// dangerous-bash uses exit 2 to BLOCK (a clean decision; never a crash —
// crashes fail OPEN at exit 0 per ADR-006). This is a TYPE, not a runtime const
// (runtime const values are non-erasable): the numbers are documented here and
// used positionally by hooks.
//   0 = proceed / allow (also the fail-open exit on any error)
//   2 = block (PreToolUse deny — clean decision, reason on stderr)
//   other non-zero = non-blocking error
export type ExitCode = 0 | 2;
