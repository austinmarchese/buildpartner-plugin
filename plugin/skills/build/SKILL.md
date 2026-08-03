---
name: bp:build
description: "Walk through a BuildPartner build live in your terminal. Loads the build's steps and prompts, fills each prompt with your project's real context, runs it with you one step at a time, and verifies before moving on. Use when the user says 'run a build', 'build of the week', 'this week's build', 'walk me through the build', or names a specific build."
---

# /bp:build

Guide the user through a BuildPartner build end to end, inside their Claude Code session. You are not summarizing the build. You are building it with them: loading each step's prompt, filling it with their real context, running it, and verifying, one step at a time.

## 1. Load the build

`get_build` is paginated: you open a build to get its **orientation** (benefit, summary, `stepCount`, outcome, and the build's `slug`), then pull each **step** on demand. This keeps each payload small and matches the one-step-at-a-time walk below. Do NOT try to load all steps up front.

- Default (no argument): `get_build({ current: true })` for this week's featured build's orientation.
- User named a build ("build 3", "the email one", a slug): call `get_build()` with no args to get the index, match their words to a `slug`, then `get_build({ slug })` for its orientation.

The orientation gives you everything you need for step 2 below (orient them) plus a `slug` and `stepCount`. **Keep the `slug`**: you'll pass it to fetch each step. Pin step fetches to that `slug`, not `current`.

Always load through the MCP tool, never from memory or a hardcoded copy. The content is served live so it stays current and so the user's plan is respected.

If any MCP tool call is blocked with an upgrade/limit message (`"limit_reached"` or `"locked": true`), STOP immediately. Do not invent locked content, do not summarize the build from memory, do not use any fallback. Instead:

1. Read `~/.buildpartner/auth.json` to get the token and the `api_base` (if present, otherwise use `https://buildpartner.ai`).
2. Run: `open "BASE_URL/dashboard?t=TOKEN_HERE&upgrade=true"` (replace BASE_URL with api_base or the default, and TOKEN_HERE with the actual token).
3. Tell the user:

> "You've used all your free skill runs. I've opened your dashboard so you can upgrade and keep going."

Nothing else. No apologies, no alternatives, no partial content.

## 2. Orient them (short)

Lead with the payoff, not a wall of text:

- The `benefit` line first, this is why they'd build it
- Title, category, and `timeLabel`
- The three-line `summary` (what it is / how it impacts you / why now)
- How many steps it has (`stepCount`)

Then confirm the workspace with **AskUserQuestion** (header `Workspace`): options **"This project"** (mark recommended) and **"A different directory"** (they can pick Other to type a path). Do not touch files until they choose.

## 3. Walk the steps, one at a time, confirming each

**This is a hard gate, not a suggestion.** Do exactly one step, then stop. Do NOT read ahead, batch steps, or run several prompts in one turn. Compressing or skipping steps is the single most common way this goes wrong, especially on smaller models. If you are unsure whether to advance, you are not allowed to advance: finish and verify the current step first. Every step must be confirmed by the user before it runs and verified with evidence before the next one starts. No exceptions.

Fetch each step only when you reach it: `get_build({ slug, step: N })`, starting at `step: 1` and walking up to `stepCount`. The response gives you the step's `data` (kicker, title, body, snippet, mode, inputs, fillFrom, verify) plus `hasNext`. You do not have the steps until you fetch them, which is deliberate: it enforces the one-at-a-time gate. To skip, jump, or go back, just fetch that `step` number.

For each step `N` from 1 to `stepCount`, fetch it, then in order:

1. **Announce** the step: its number, `kicker`, and `title`. Explain the `body` in a sentence or two, tied to *their* repo.

2. **Gather context.** If the step has `inputs`:
   - When `fillFrom` is `"repo"`, try to auto-detect the answer first (e.g. find their CLAUDE.md). Only ask if you can't determine it or it's ambiguous.
   - Otherwise ask the `ask` question with **AskUserQuestion**, one question per input. **Generate the options from the user's actual project, not from guesses.** The build gives you only the `ask` and a `default`, never a fixed option list, that is deliberate: the options are yours to derive so they fit *this* repo. Before asking, quickly inspect the project (grep, read the relevant files) and offer concrete candidates that genuinely exist in their system, each with a one-line "why" tied to real code. Put the `default` first if it still fits, mark the best pick recommended, and always leave Other for a custom value. If you cannot ground good options, offer fewer real ones and lean on Other rather than inventing filler.
   - **Single vs multi-select.** Match the question to reality. Set `multiSelect: true` when more than one option can legitimately apply at once, i.e. the answer fills a *list* or the question reads like "which of these…" / "select all that apply" (e.g. picking several topics for a search to cover, several files to touch). Keep the default single-select when exactly one answer fills the slot. If the input itself declares `multi: true`, honor it. When a multi-select answer comes back with several values, join them naturally into the `{key}` slot (comma/newline as the snippet expects).
   - Substitute each answer into the `snippet` wherever `{key}` appears.

3. **Show and confirm.** Show the filled `snippet` and say what running it will do. Then use **AskUserQuestion** (header `Step N`) with options **"Run it"** (mark recommended), **"Tweak first"**, and **"Skip this step"**. Do nothing that reads or changes their project until they choose "Run it". This is a walkthrough, not a takeover, they confirm each step.

4. **Run it** once confirmed:
   - `mode: "command"` → run it in the shell and show the output.
   - `mode: "prompt"` → execute it as your own action against their project (make the edit, run the analysis), adapted to their actual files. Show what changed (the diff, the new file, the result).

5. **Verify against the step's `verify` string, with a blind check.** Do not grade your own work: an agent that just did the work is biased toward declaring it done. Instead, spawn a fresh sub-agent whose only job is to confirm the `verify` criterion against the real project state, having not seen your work. It reports pass or fail with the concrete evidence (the file exists, the rule is present in CLAUDE.md, the number moved). Only advance on a pass. If it fails, fix it and re-check before the next step.

   If you cannot spawn a sub-agent (e.g. no permission, or a harness that doesn't support it), STOP and verify inline instead, but still by inspecting the actual project state and showing the evidence, never by asserting from memory that it worked.

Between steps the user can tweak, skip, or go deeper. Match their pace. If they say "just do it," keep moving but still show what changed and still verify.

## 4. Land the outcome

When the steps are done, run the build's `outcome` as a checklist and confirm each item is actually true in their project. Call out anything not done.

If the build has a `pluginCta`, offer it as the natural next action (e.g. `/bp:improve-system` for a personalized pass).

Close by pointing forward: more builds live in the dashboard under Builds, and a new Build of the Week drops every week. Invite them back for the next one.

## Rules

- Use **AskUserQuestion** for every decision point (workspace, each input, each per-step confirm) so choices render as clean option cards. One question at a time, options limited to the real choices, and let Other cover free-form answers. Never bury a decision in prose the user has to answer by typing.
- Match the select mode to the question: exclusive choices (workspace, Run/Tweak/Skip, one value that fills one slot) use single-select; questions where several answers can apply together use `multiSelect: true`. When unsure, ask whether picking two answers would both make sense, if yes, it's multi-select.
- Options for a question are yours to generate from the real repo, never authored in the build. Ground them in the user's actual code so they're specific and true, not generic placeholders. (Steps, prompts, and verify criteria, by contrast, come only from `get_build`, never fabricate those.)
- Build in their repo, with their context. Generic output is the failure mode.
- One step at a time, always. The per-step gate is un-skippable: confirm before running, blind-verify with evidence before advancing. Batching or skipping is the dominant failure mode.
- Verification is a blind check by a fresh sub-agent, never self-grading. Fall back to inline evidence only if sub-agents aren't available.
- Keep the user driving.
