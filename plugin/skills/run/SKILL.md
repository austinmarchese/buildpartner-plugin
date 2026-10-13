---
name: run
description: "Runs your BuildPartner.ai feeds: whatever is due today (self-improving system, Command Center), in order, with no questions. Set it up once as a Local Routine. Run it by hand with 'all' for every feed that is on, or a feed's name for that one."
argument-hint: "[all | feed name]"
allowed-tools:
  - Skill
  - Read
  - Read(~/.buildpartner/auth.json)
  - Bash(open:*)
  - mcp__plugin_bp-dev_tools__run_plan
---

# /bp-dev:run

The one routine. A Local Routine runs this every day; the server says what today's run does. Run by hand with an argument, it runs what the user asked for instead: `all` is every feed that is on, a feed's name is that one feed, whatever their schedules. This skill is orchestration only: it asks for the plan, runs each job's own skill in the order given, reports each one, and prints one summary. It knows nothing about what a job does. Never add a job's behaviour here; it belongs in that job's skill.

## Steps

1. **Ask for the plan.** With no argument, call `run_plan({ action: "start" })`. With an argument, pass it exactly as the user typed it: `run_plan({ action: "start", only: "<the argument>" })`. Never decide yourself which feed an argument means; the server does. Act on the result:
   - `needs_setup` is true: sharing isn't on for this account. Read `~/.buildpartner/auth.json`, take its `token`, add it to `setup_url` as `t=TOKEN_HERE` (joined with `&` when the address already has a `?`, otherwise `?`), open that address in the default browser (`open "ADDRESS"` on macOS), and say: "Sharing with BuildPartner.ai isn't on yet, so nothing ran. I've opened the page where you turn it on." Stop.
   - `error`, or there is no `run_plan` tool in this session: tell the user in one line. When the tool is missing, tell them to restart Claude so the BuildPartner.ai plugin finishes updating. Stop.
   - Otherwise `jobs` is the list to run, in order. It may be empty. `asked` says what the server understood: `due` (the routine's own run), `first` (the first run, from the setup prompt), `all`, `job` (one feed), `routine_created` (the setup prompt reporting that the routine now exists; nothing runs) or `unknown`. `note`, when there is one, is why nothing will run for what was asked. `open_url`, when it is there, is the page to open at the end (step 6): the server sends it only when a person asked for this run, never for the routine's own. `feeds` is every feed that is on, each with `next_due_at` and `run_now` (the command that runs it by hand); `run_all` is the command that runs them all.

2. **Say what this run will do**, in one line, before running anything: "Today: {job labels, in order}" for the routine's own run, "Running all your feeds: {labels}" for `all`, "Running: {label}" for one feed, "Your first run: {labels}" for `first`, or "Nothing is due today." If there is a `note`, say it in one line and go to step 5. When `asked` is `routine_created`, the `note` is the whole answer: print it and stop, with no "To run" lines. No question, no pause. Never ask the user anything in this skill: it usually runs with nobody watching.

3. **Run each job, in the order given, one at a time.** For each entry, invoke exactly its `command` (the Skill tool, with the `routine` argument the command carries). Wait for it to finish before the next one; the next job may depend on what this one changed. Take one line from its output as the summary: the number of suggestions and fixes for the self-improving system, the number of skills for the Command Center. If a job fails, note the error in one line and go on to the next.

4. **Report each job** as soon as it finishes: `run_plan({ action: "finish", job: "<id>", summary: "<one line>" })`. Once per job. A failed job is reported too, with the error as its summary.

5. **Print one summary**, short:

```
## Your system ran

- {Job label}: {summary}
- {Job label}: {summary}

See it here: {the dashboard link a job printed, or nothing}
```

When nothing ran, print this instead, from `feeds` and `run_all`. Leave out a line the plan gave nothing for, and never write a command the plan did not give:

```
Nothing was due today. Your routine is set.

- {Feed label}: next {the day from next_due_at}

To run one now: {that feed's run_now}
To run them all: {run_all}
```

When a `note` is why nothing ran, print the note first, then the same two "To run" lines.

6. **Open the page, when the plan gave one.** Only when the plan has an `open_url` and at least one job ran. Read `~/.buildpartner/auth.json`, take its `token`, and add it to `open_url` as `t=TOKEN_HERE` (joined with `&` when the address already has a `?`, otherwise `?`, and always before any `#` part). Open that address in the default browser (`open "ADDRESS"` on macOS). Then replace the "See it here" line of the summary with these two, using `open_url` exactly as the plan gave it, without the token:

```
Opened it in your browser.
To go there directly: {open_url}
```

   One page per run, never one per job. With no `open_url` (the routine's own run), open nothing and keep the "See it here" line.

## Rules

- One `start`, one `finish` per job. Never run a job the plan did not list, and never change the order. An argument changes what the plan lists, never what you run beyond it.
- Never ask a question. What a job needs from the user, that job's skill turns into a suggestion on their dashboard.
- Never print or send the token. The address you open carries it; the address you print never does.
