---
name: bp:offload
description: "Explicitly route the next chunk of mechanical work to BuildPartner Workers (a cheaper model via OpenRouter). Use when the user says 'offload this', 'use the worker for this', or wants to save Claude tokens on boilerplate. For automatic background routing, see the BuildPartner Workers section in your ~/.claude/CLAUDE.md (no action needed)."
---

# /bp:offload

Explicit handoff to BuildPartner Workers. Most of the time you do not need to invoke this directly. The BuildPartner Workers rule in your `~/.claude/CLAUDE.md` auto-routes eligible work to the `bp-worker` subagent. Use this skill when the user asks for an explicit offload or wants to test the path.

## When to use

Yes (offload-eligible):
- Single or multi-file mechanical edits (renames, format conversions)
- Boilerplate or scaffold generation
- Document or code summarization
- Test stubs for known functions
- Grep results + plain-English explanation
- Simple, self-contained transformations

No (stays on Claude):
- Architecture, design decisions
- Debugging unknown failures
- Multi-step reasoning across the codebase
- Anything ambiguous or requiring judgment

## Steps

1. Confirm the task is offload-eligible. If not, tell the user and continue normally.
2. Gather any context the worker will need (relevant file contents, target names, format) and inline it into a single self-contained instruction.
3. Spawn the `bp-worker` subagent with the inlined task. The subagent calls `bp_delegate`; BuildPartner routes to whichever cheap model fits the task. You may optionally pass a `complexity` hint ("trivial", "medium", or "hard") for telemetry, but you do not pick the model.
4. Apply the worker's output (Edit/Write) if it is a code change. Surface a brief summary and the credit savings (`Saved ~X Claude tokens by routing to <model>` -- the actual chosen model is in the response's `model` field).

## If a tool call is blocked

If `bp_delegate` returns `out_of_credits: true`, stop and follow the action in the response: open the dashboard so the user can upgrade. Do not attempt the task yourself.
