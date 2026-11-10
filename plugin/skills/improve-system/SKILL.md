---
name: improve-system
description: "Keep your system sharp. Improves your skills and CLAUDE.md from how you actually work, reviews your setup, captures learnings, audits for rot, recaps your sessions. Run it regularly to keep improving."
allowed-tools:
  - Read
  - Glob
  - Grep
  - Read(~/.claude/**)
  - Write(.buildpartner/**)
  - Edit(.buildpartner/**)
  - Write(.claude/skills/**)
  - Edit(.claude/skills/**)
  - Write(CLAUDE.md)
  - Edit(CLAUDE.md)
  - Write(**/*.md)
  - Edit(**/*.md)
  - Bash(git log:*)
  - Bash(git rev-parse:*)
  - Bash(mkdir:*)
  - Bash(mv:*)
---

# /bp-dev:improve-system

Keep your system sharp. One skill, six modes. Detect the right mode from conversation context, or ask.

## Modes

| Mode | Trigger | What it does |
|------|---------|-------------|
| **Improve** | Bare invocation in a project that has skills of its own, "improve my system", "run my self-improving system", "run the loop". The argument `routine` (started by a routine with nobody watching) or `apply`. | Reads how you have worked here since the last run, makes the small fixes on its own, and asks you about each bigger improvement to your skills and CLAUDE.md before making it. |
| **Apply suggestions** | The argument starts with "Apply these Self-Improving System suggestions" (the BuildPartner.ai bar's Apply button). | Makes each listed change in this project, showing each edit before writing it. |
| **Setup Review** | Default for new users, "review my setup", "how's my setup". | Full audit of your Claude Code environment with prioritized action items. |
| **Experience Capture** | "capture this", "log this", user describes a win/lesson. | Quick structured entry written to knowledge folder. |
| **Session Review** | "recap my week", "what did I do", bare invocation for returning users. | Weekly recap from session history and git log. |
| **Audit** | "audit", "health check", "what's stale". | Check for stale rules, unused servers, dead skills, contradictions. |

Improve comes first: a bare invocation in a project that has skills of its own runs it. The Setup Review and Session Review defaults apply everywhere else.

If unclear, ask:

> "What are we working on? I can:
> 1. **Improve your system** (fix the small things, suggest the bigger ones from how you have been working)
> 2. **Review your setup** (CLAUDE.md, MCP servers, skills, hooks, project structure)
> 3. **Capture an experience** (a win, lesson, or story)
> 4. **Recap your sessions** (weekly review from session history)
> 5. **Audit your system** (find stale or conflicting content)
>
> Or describe what you're thinking and I'll figure it out."

## Data Sources

Everything the skill reads comes from local files, and every mode stays on this computer. No mode calls BuildPartner.ai or sends anything anywhere.

- **Session history**: Read JSONL session files from `~/.claude/projects/*/`. Extract: projects worked on, tools used, skills invoked, timestamps, summaries, duration.
- **Setup files**: `~/.claude/CLAUDE.md`, project-level CLAUDE.md, `~/.claude/settings.json`, MCP server configs (`~/.claude/mcp_servers.json`).
- **Git history**: `git log --oneline --since="2 weeks ago"` for what was actually committed.
- **Knowledge folder**: `./knowledge/` (if exists).

## Rules

These rules are for the review modes. An Improve run follows the rules in Mode 5, and where the two differ, Mode 5 wins.

- Only recommend BuildPartner skills (commands starting with `/bp-dev:`).
- Every finding must be backed by data from their sessions or files. Don't suggest generic improvements.
- "Fix" actions should be specific enough to copy-paste or act on immediately.
- If a fix is something you can do right now (edit CLAUDE.md, create a skill), offer to do it.
- Always include "What's Working Well" so it doesn't feel like a list of failures.
- Don't force learnings from single instances. Only flag a pattern if it recurs.
- Don't auto-run changes without approval. Show what you'll change and ask first.
- Never mention raw session counts or token totals. Use streak, relative terms ("your recent sessions"), or project names instead.
- Contradictions aren't always bad. Document when each approach applies rather than picking a winner.

## Instructions

### Step 0: Determine Mode

Check in this order and take the first that fits:

1. **The argument starts with "Apply these Self-Improving System suggestions"**: run **Apply suggestions** (Mode 6).
2. **The argument is `routine` or `apply`**: run **Improve** (Mode 5) with that argument.
3. **Explicit trigger**: run the matching mode from the table above.
4. **Bare invocation, and this project has skills of its own** (at least one folder holding a `SKILL.md` in `.claude/skills/` at the top of this project): run **Improve** (Mode 5).
5. **Otherwise**, read local session files from `~/.claude/projects/*/` to understand usage level:
   - **< 5 local sessions (or no session data)**: Run **Onboarding** (within Setup Review).
   - **5+ sessions, bare invocation**: Run **Session Review**.

---

### Mode 1: Setup Review

The core coaching mode. Full audit of their Claude Code environment.

#### Onboarding (< 5 sessions or no data)

When someone is new, don't punt them. Teach them what Claude Code can do, understand their goals, and set them up right.

**Step 1: Welcome**

> "Welcome! Looks like you're just getting started. Let me walk you through what's possible and help you set things up right from the start."

**Step 2: Understand their goal**

Ask ONE question:

> "What are you mainly using Claude Code for? Building an app, automating workflows, writing content, learning to code, something else?"

Wait for their answer. This shapes everything that follows.

**Step 3: Project structure check**

Read the folder structure, CLAUDE.md, README, and key files. Based on their stated goal + what the project contains:

If the project is new or minimal, suggest structure based on project type:
- `knowledge/` folder with relevant subfolders
- `.claude/skills/` with 1-2 starter skills matching their goal
- `projects/` folder if they'll manage multiple workstreams

If the project already has structure, acknowledge what's there and suggest gaps.

Offer to set up whatever they want right now.

**Step 4: Claude Code walkthrough**

Based on their goal, walk them through the capabilities that matter most. Keep it practical, not a feature dump.

For everyone:
- **CLAUDE.md** - The most important file. Tells Claude your preferences, tech stack, rules. Without it, Claude starts from zero every session. Check if they have one, offer to create it.
- **Plan mode** - Before big tasks, ask Claude to plan first. Catches mistakes before they happen.
- **Tools** - Briefly explain Read, Edit, Grep, Bash and when to use each.

Based on their goal:
- **Building apps**: Mention parallel sessions, agents/subagents, structuring complex tasks.
- **Automating workflows**: Mention hooks, custom skills, MCP servers.
- **Content creation**: Mention research, drafting, iteration workflows.
- **Learning**: Mention asking Claude to explain as it goes, using Plan mode for understanding.

Keep each section to 2-3 sentences max.

**Step 5: How BuildPartner.ai helps**

> "BuildPartner.ai helps you get better at Claude Code over time. Here's what you have:"
>
> - `/bp-dev:improve-system` (this) - Reviews your setup, captures learnings, recaps your sessions. The more you use Claude Code, the more specific my advice gets.
> - `/bp-dev:expert-advice` - Ask any question and get matched to proven frameworks from top experts. Pricing, content, launch, product strategy.

**Step 6: Quick config check**

Even without session data, check their config files:
- Do they have a CLAUDE.md? If not, offer to create one based on their stated goal.
- What MCP servers are configured?
- Any hooks set up?

If you can fix something right now, offer to do it. End with a clear next action, not a menu.

Skip to **End of Skill** after onboarding.

---

#### Standard Setup Review (5+ sessions)

**Step 1: Check for previous reviews**

If this is a return visit, mention:

> "Last time I suggested: {previous recommendations}. Want me to check how you're doing on those, or start fresh?"

For first review, ask:

> "Want a quick review or a deep dive?"
> - **Quick**: I'll check your setup, recent sessions, and give you 3 things to fix this week.
> - **Deep**: I'll read every config file, audit your full environment, and give you a prioritized action plan.

**Step 2: Quick Review**

Analyze from local session files:

- **Usage patterns**: What tools do they lean on vs. underuse? Are sessions getting shorter or longer?
- **Skill usage**: Which BuildPartner skills have they tried? What haven't they touched?
- **Workflow signals**: Do they use Plan mode? Agents? Hooks? Parallel sessions?
- **Recent prompts**: What are they asking Claude to do? Any repeated patterns that could be automated?
- **Project fit**: Does the project have structure that helps Claude understand context?

Output exactly 3 action items, ranked by impact:

```
## Setup Review

**Activity**: {current streak, main focus}

### What's Working Well
- {1-2 things they're doing well}

### What to Improve
1. {Most impactful action item with specific steps}
2. {Second action item}
3. {Third action item}

### Quick Win
{One thing they can do in the next 5 minutes}
```

**Step 3: Deep Dive**

Read and audit every layer. For each layer, read the relevant files and cross-reference with session history.

**Layer 1: CLAUDE.md**

Read `~/.claude/CLAUDE.md` (global) and any project-level CLAUDE.md.

Check:
- Are there rules? If empty or missing, that's a high-priority finding.
- Do the rules match what they actually do? (Compare rules to session patterns)
- Are rules too generic? ("Write clean code" is useless)
- Are rules too long? (Best CLAUDE.md files are under 30 lines)
- Missing rules they need based on their tech stack and patterns

Analyze the gap between what they do and what their CLAUDE.md says:
- Missing rules from session patterns (e.g., writes TypeScript but no TS conventions)
- Rules to remove (generic advice, tools they don't use, duplicates)
- Rules to sharpen (vague rules that should be specific)

**Layer 2: MCP Servers**

Read `~/.claude/mcp_servers.json` (or equivalent config).

Check:
- What MCP servers are configured?
- Are they using database tools manually when an MCP server could handle it?
- MCP servers configured but never used?
- Missing MCP servers based on their workflow

**Layer 3: Skills**

Read all skills in `~/.claude/skills/`.

Check:
- How many custom skills do they have (non-BuildPartner)?
- Which BuildPartner skills have they used vs not used?
- Are there custom skills that are stale or broken?
- Could they benefit from creating skills for repeated workflows?

**Layer 4: Hooks**

Check `~/.claude/settings.json` and project-level settings for hooks.

Check:
- Are any hooks configured?
- Could they benefit from pre/post hooks?

**Layer 5: Project Structure and Knowledge**

Classify the project type:
- **Code/app** (package.json, src/, build configs)
- **Content/creative** (drafts, scripts, assets, writing)
- **Knowledge/operations** (docs, processes, playbooks, reports)

Based on project type, check for:
- `.claude/skills/` folder (repeated workflows should become skills)
- `knowledge/` or equivalent context folder
- Project-specific skills vs. generic skills
- Finished work organization (archive/done patterns)

**Layer 6: Workflow Patterns**

From session history, identify:
- Plan mode usage
- Parallel sessions
- Agents/subagents
- Session length patterns (short = tactical, long = could benefit from planning)
- Commit frequency
- Repeated prompts that could become a skill or hook

**Deep Dive Output Format:**

```
## Deep Dive Results

**Environment Score**: {X}/10
Based on recent sessions across {Y} projects.

### Critical (fix now)
1. {Finding}: {what's wrong and why it matters}
   Fix: {exact action to take}

### High Impact (do this week)
1. {Finding}: {what's wrong and why it matters}
   Fix: {exact action to take}

### Nice to Have (when you have time)
1. {Finding}
   Fix: {action}

### CLAUDE.md
**Current**: {line count} lines, {rule count} rules

Add:
1. `{exact rule text}` - You did {X} in {Y} of your recent sessions.

Remove:
1. `{quoted existing rule}` - {reason}

Sharpen:
1. Before: `{existing rule}` -> After: `{improved rule}`

### What's Working Well
- {Positive finding}
- {Positive finding}
```

Keep the total list to 10 items max. Prioritize ruthlessly. Keep CLAUDE.md under 30 lines if fixing.

**Step 4: Follow-up on previous recommendations**

If return visit and user wants to check progress:
- Compare current state against each previous recommendation
- Mark each as: done, partially done, or not started
- For items not started, re-evaluate: still relevant? Reprioritize if needed.
- Drop recommendations that no longer apply.

**Step 5: Apply on approval**

> "Want me to fix any of these now? I can update your CLAUDE.md, create missing skills, or configure MCP servers."

Work through fixes one by one, confirming each before applying.

---

### Mode 2: Experience Capture

Quick capture. No recap needed.

#### Step 1: Extract the experience

From what the user said, extract:

```markdown
# {Date} - {Brief Title}

## What happened
{1-2 paragraphs based on what they described}

## Key learning
- {The transferable insight}

## Why it matters
{One sentence on why this is worth remembering}

## Tags
{topic1, topic2, topic3}
```

#### Step 2: Write

Write to `./knowledge/experiences/{YYYY-MM-DD}-{brief-slug}.md`. Create directory if needed with `mkdir -p`.

#### Step 3: Confirm

```
## Captured

**{title}** saved to `{filename}`
```

---

### Mode 3: Session Review

Weekly recap from session history and git log.

#### Step 1: Read local session history

Read JSONL session files from `~/.claude/projects/*/`. Focus on the last 7 days. Also run `git log --oneline --since="7 days ago"` for commit context.

Extract:
- Projects worked on (group by project name)
- Activity types (coding, content, research, other)
- Tools and skills used
- Session durations and timestamps
- Summaries

#### Step 2: Weekly Recap

```
## This Week

**{streak} day streak | Focus: {main project/activity}**

### What you worked on
- {Project/activity 1}
- {Project/activity 2}

### Best session
{The most interesting or productive session this week. One sentence.}

### Add to your playbook
{1-2 specific things they should start doing based on this week's patterns.}
```

Keep the recap under 15 lines. If < 3 sessions this week: "Light week. Here's what I have:" and generate what you can.

#### Step 3: Capture additional experiences

After showing the recap, ask:

> "Anything else from this week worth capturing? A win, a lesson, something you figured out. A sentence or two is plenty, or type 'skip'."

If they share something, capture it as an experience entry. If they skip, move on.

#### Step 4: Write recap

Write the weekly recap to `./knowledge/experiences/recaps/{YYYY-MM-DD}-weekly-recap.md`. Create directories as needed with `mkdir -p`.

---

### Mode 4: Audit

Quick health check for rot.

#### Step 1: Read setup files

Read all setup files from the Data Sources section above.

#### Step 2: Run checks

- **Stale CLAUDE.md rules**: Rules about tools/patterns not seen in recent sessions
- **Unused MCP servers**: Configured but never called in session history
- **Dead custom skills**: Skills in `~/.claude/skills/` that reference missing files or broken patterns
- **Contradictions**: Rules that conflict with each other or with actual behavior
- **Orphaned knowledge**: Files in knowledge directories that nothing references

#### Step 3: Report

```
## System Audit

**Health**: {Good / Needs attention / Needs cleanup}

### Issues Found
1. {Issue} - {what's wrong and what to do}
2. {Issue} - {what's wrong and what to do}

### Clean
- {Things that checked out fine}
```

Keep to 10 items max. If everything is clean, say so and suggest Setup Review mode instead.

#### Step 4: Fix on approval

> "Want me to fix any of these?"

Apply only what they approve. Never auto-delete without explicit approval.

---

### Mode 5: Improve

The user's self-improving system, run on this computer. One run reads how they have worked in this project since the last run, makes the small fixes on its own, and asks about each bigger improvement before making it. Nothing is sent anywhere.

- **By hand** (bare, or "improve my system"): ask about each suggestion as you go (Step 6).
- **`routine`**: a routine started it and nobody is watching. Never ask a question. Make the small fixes, keep each suggestion in `state.json` as waiting, list them in the summary, and stop.
- **`apply`**: read nothing new. Offer only the suggestions already waiting in `state.json` (Step 6), then save and summarize.

#### Local files

The run keeps its notes in `.buildpartner/` at the top of this project. Create the folder when it is missing. They stay on this computer.

| File | What it holds |
|---|---|
| `state.json` | When the system last ran here, the patterns it is still counting, the suggestions waiting for an answer, and the ones the user turned down. |
| `retired/` | Skills the user approved retiring, moved here so they can be put back. |

`state.json` looks like this:

```json
{
  "last_run_at": "2026-11-10T14:05:00Z",
  "watching": [
    { "type": "new_skill", "target": "call-follow-up", "note": "Writes a follow-up email by hand after each client call, from the call notes.", "dates": ["2026-10-30", "2026-11-06"] }
  ],
  "waiting": [
    {
      "type": "skill_fix",
      "target": "weekly-report",
      "title": "Make weekly-report use the last 7 days without asking",
      "why": "You gave it the same date range by hand each of the last 4 times you ran it.",
      "plan": "In .claude/skills/weekly-report/SKILL.md, step 2: use the last 7 days as the date range and only ask when the user gives a different one.",
      "since": "2026-11-10"
    }
  ],
  "declined": [{ "type": "instruction", "target": "date-format", "title": "Always write dates as YYYY-MM-DD" }]
}
```

A file from an older version may have `last_loop_at` instead of `last_run_at`, and `suggestions` instead of `waiting`: read them the same way and write the new names.

#### Step 1: Where the change lands

Before the first edit, check whether this session is in a git worktree: `git rev-parse --git-dir` and `git rev-parse --git-common-dir` give different paths in a worktree. In a worktree, say so in one line: "This session is on branch {branch} in a worktree. The changes land on that branch and are not live in your main checkout until it is merged." Then work here anyway, never in another checkout.

#### Step 2: Read what happened since the last run

Skip this step with `apply`. Read `last_run_at` from `state.json`. When there is no file this is the first run here: look back 14 days. Then read, in this order:

1. **This project's Claude conversations since then.** The JSONL files changed since `last_run_at` in the folder under `~/.claude/projects/` named after this project's path. Look for what the user asked for, what they corrected, what they told Claude more than once, and which skills ran. Search for those instead of reading whole files, skip tool output, and skip this session.
2. **This project's own skills**: each folder in `.claude/skills/` at the top of this project that holds a `SKILL.md`. Not skills from plugins, and not skills in the user's home folder.
3. **This project's `CLAUDE.md`.**
4. **Its knowledge base**, when it has one (`wiki/`, or `knowledge/`), starting with the pages that changed since the last run.

#### Step 3: Make the small fixes

Skip this step with `apply`. Small fixes happen without asking. There are exactly three kinds, all inside the project's knowledge base (`wiki/`, or `knowledge/`):

| Kind | What you fix |
|---|---|
| Broken links | A link or reference that points at a page that was moved or renamed, when exactly one page is plainly the right target. Repoint it. |
| Duplicates | Two pages or entries that say the same thing. Merge them into one, keep everything either one had, and repoint links to the one that stays. |
| Stale pages | A page that a newer source in this project has plainly overtaken (a number, a status, a date). Update it from that source. |

- Never edit a skill, `CLAUDE.md`, a settings file, or anything in `raw/` as a small fix. Originals are never changed.
- A small fix moves, merges or updates. It never throws information away.
- If the right fix is not plain, do not make it. Two sources that disagree are a `contradiction` suggestion, not a small fix.
- A project with no knowledge base has no small fixes.

#### Step 4: Find the bigger improvements

Skip this step with `apply`. For every pattern you saw since the last run, add the days it came up to its entry in `watching`, or start one. A pattern is judged on all of its days in the last 30, so something that happens once a week still adds up. Drop a `watching` entry that has not come up in 30 days.

A pattern becomes a suggestion when it meets the bar for its type:

| Type | What it is | The bar |
|---|---|---|
| `new_skill` | A task the user keeps doing by hand that could be a skill. | The same task by hand on at least 3 days. |
| `skill_fix` | A change to one of this project's skills that the user keeps correcting. | The same correction at least 2 times. |
| `instruction` | A line for this project's `CLAUDE.md`, for something they keep telling Claude. | Told at least 3 times. |
| `retire` | One of this project's skills that is not being used. | Created more than 30 days ago, not run in any conversation in the last 30 days, and nothing else in the project refers to it. Search the last 30 days for its name before suggesting it. |
| `question` | Something only the user can answer, that is holding an improvement back. | The answer changes what you would do next, and there are 2 to 4 possible answers. |
| `contradiction` | Two things in their system that disagree. | You can name both places, and there are 2 to 4 ways to settle it. |

Drop a suggestion when it has no evidence in this project's conversations or files, when it matches an entry in `declined` (the same `type` and `target`, or plainly the same idea), when it is already in `waiting`, or when it would change a skill that came with a plugin. Only this project's own skills are theirs to change.

#### Step 5: Rank them

Put the new suggestions after the ones already in `waiting`, then order the new ones by impact: how often it came up, how recently, how much hand work it saves, and how small and easy to undo the change is. Offer at most 5 in one run. The rest stay in `watching` for a later run.

For each one, write a `title` that starts with a verb (on a `question`, the question itself), a one-line `why` with the evidence (counts and days), and a `plan`: the exact change, with enough detail to make it later without finding the evidence again. Name a new skill after what it does, in kebab-case, never after a person or a company, never starting with `bp-` or `buildpartner`.

#### Step 6: Ask about each one

With `routine`, skip this step: add every suggestion to `waiting` and go to Step 7.

Otherwise take them one at a time. Show the title and the why in one or two plain sentences, then ask with AskUserQuestion:

- **Most types**: "Make this change" (recommended), "Not now", "Don't suggest this again".
- **`question` and `contradiction`**: one option per answer (2 to 4), plus "Not now".

On a yes, make the change inside this project, showing the edit before you write it:

- `new_skill`: create `.claude/skills/<name>/SKILL.md` with a `name` and a one-line `description` in its frontmatter. Never overwrite a skill that is already there.
- `skill_fix`: edit that one skill as planned, nothing wider.
- `instruction`: add the line to this project's `CLAUDE.md`.
- `retire`: move the skill's folder from `.claude/skills/` to `.buildpartner/retired/`. Never delete it. When a folder of the same name is under `.agents/skills/`, move it to `.buildpartner/retired/agents/` in the same step.
- `question`, `contradiction`: do what the picked answer means for the plan.

"Not now" keeps it in `waiting` for the next run. "Don't suggest this again" moves it to `declined`. A change you cannot make safely or cannot make sense of: say which and why, and keep it in `waiting`. Never guess at a change the user did not read.

#### Step 7: Save and summarize

Save `state.json`: `last_run_at` (the time this run started, unchanged with `apply`), `watching`, `waiting` (what is still unanswered), `declined`. Then print, leaving out any empty line:

```
## Your system ran

**Fixed on its own**: {n} small fixes ({for example: 3 broken links, 1 duplicate})
**Changed**: {n}
- {title}
**Waiting for your answer**: {n}. Run /bp-dev:improve-system to go through them.
```

- When nothing was fixed or suggested: "Nothing needed changing this run."
- When a skill was built, changed or retired: add "Run `/reload-skills` so Claude picks it up." and, in a worktree, "These landed on branch {branch}; merge it to make them live."
- Say "suggestions" to the user, never "cards".

#### Improve rules

- Only change files inside this project. Small fixes touch the knowledge base only, never `raw/`, a skill or `CLAUDE.md`.
- A skill, `CLAUDE.md` or a new skill changes only after the user said yes to that suggestion in this run.
- No evidence, no suggestion. Suggesting nothing is better than suggesting a guess.
- With `routine`, never ask a question.
- Nothing is sent anywhere.

---

### Mode 6: Apply suggestions

The BuildPartner.ai bar's Apply button fills the prompt with "Apply these Self-Improving System suggestions, and show me each edit before you write it:" followed by one line per suggestion: the target, its kind, the change, and what the user said that prompted it. The user already said yes in the bar.

1. **Where the change lands**: Step 1 of Mode 5.
2. **For each line, in order**: show the edit, then make it, inside this project only, the same way as Mode 5 Step 6 (a rule goes in `CLAUDE.md`, a skill update edits that one skill, a new skill is created and never overwrites one that exists). If the user stops one, skip it.
3. **A line you cannot make safely or cannot make sense of**: say which and why in one line, and change nothing for it.
4. **Summary**: one line per change made, then "Run `/reload-skills` so Claude picks it up." when a skill was built or changed.

Read no conversations and look for nothing new: only the listed changes.

---
