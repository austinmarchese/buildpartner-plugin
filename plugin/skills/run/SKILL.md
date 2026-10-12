---
name: run
description: "Runs your BuildPartner.ai system: whatever is due today (self-improving system, Command Center refresh), in order, with no questions. Set it up once as a Local Routine and never run anything by hand again."
allowed-tools:
  - Skill
  - Read
  - Read(~/.buildpartner/auth.json)
  - Bash(open:*)
  - mcp__plugin_bp-dev_tools__run_plan
---

# /bp-dev:run

The one routine. A Local Routine runs this every day; the server says what today's run does. This skill is orchestration only: it asks for the plan, runs each job's own skill in the order given, reports each one, and prints one summary. It knows nothing about what a job does. Never add a job's behaviour here; it belongs in that job's skill.

## Steps

1. **Ask for the plan.** Call `run_plan({ action: "start" })`. Act on the result:
   - `needs_setup` is true: sharing isn't on for this account. Read `~/.buildpartner/auth.json`, take its `token`, add it to `setup_url` as `t=TOKEN_HERE` (joined with `&` when the address already has a `?`, otherwise `?`), open that address in the default browser (`open "ADDRESS"` on macOS), and say: "Sharing with BuildPartner.ai isn't on yet, so nothing ran. I've opened the page where you turn it on." Stop.
   - `error`, or there is no `run_plan` tool in this session: tell the user in one line. When the tool is missing, tell them to restart Claude so the BuildPartner.ai plugin finishes updating. Stop.
   - Otherwise `jobs` is the list for today, in the order to run. It may be empty.

2. **Say what this run will do**, in one line, before running anything: "Today: {job labels, in order}" or "Nothing is due today." No question, no pause. Never ask the user anything in this skill: it usually runs with nobody watching.

3. **Run each job, in the order given, one at a time.** For each entry, invoke exactly its `command` (the Skill tool, with the `routine` argument the command carries). Wait for it to finish before the next one; the next job may depend on what this one changed. Take one line from its output as the summary: the number of suggestions and fixes for the self-improving system, the number of skills for the Command Center. If a job fails, note the error in one line and go on to the next.

4. **Report each job** as soon as it finishes: `run_plan({ action: "finish", job: "<id>", summary: "<one line>" })`. Once per job. A failed job is reported too, with the error as its summary.

5. **Print one summary**, short:

```
## Your system ran

- {Job label}: {summary}
- {Job label}: {summary}

See it here: {the dashboard link a job printed, or nothing}
```

When nothing was due: "Nothing was due today. Your routine is set: {each job and when it next runs, from the plan when it says, otherwise leave this out}."

## Rules

- One `start`, one `finish` per job. Never run a job the plan did not list, and never change the order.
- Never ask a question. What a job needs from the user, that job's skill turns into a suggestion on their dashboard.
- Never print or send the token.
