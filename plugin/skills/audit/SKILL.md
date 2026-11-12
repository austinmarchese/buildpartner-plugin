---
name: audit
description: "Run my AI Audit: first a map of my setup and how to clean it up, then the work I do by hand that Claude could take off my plate. Also continues an audit that stopped, runs it again, or checks my setup on its own (`setup`)."
---

# /buildpartner:audit

Run my AI Audit. Two stages: my setup first, then my work. The same command continues an audit that stopped and runs it again later. `/buildpartner:audit setup` runs stage 1 on its own.

## Instructions

1. See which run this is.
   - The argument is `setup`, or I asked to check my setup again: this is a setup check. Skip to step 2 and ask nothing.
   - Otherwise check for a run that stopped. Read `~/.buildpartner/audit/progress.md` if it exists. If it shows an audit that started in the last 7 days and did not finish, ask once: "Your last audit stopped partway. Carry on from there, or start again?" Otherwise don't ask anything.

2. Call `get_audit`. Pass `{ "stage": "setup" }` for a setup check. Pass `{ "resume": true }` only when I chose to carry on in step 1. It returns `mode`, `stages` and `file`. Always load the audit through this tool, never from memory: it changes, and on a re-run it knows what I dismissed.

3. Read the whole file at `file` with the Read tool and follow it exactly, from its first line to its last. That file is the audit. Don't summarize it to me and don't skip its checkpoints.

4. Before the first step of the file, tell me in one line what is about to happen:
   - `mode` "first": "Stage 1 of 2 is your setup. Stage 2 is your work. I ask before I save anything."
   - `mode` "continue": "Picking up where your audit stopped."
   - `mode` "rerun": "Running your audit again. I'll check which fixes you've set up and look for what's new."
   - `mode` "setup": "Checking your setup. No email is read. I ask before I save anything."

## If something goes wrong

- `get_audit` returns an `error`: tell me the error in its own words. If it isn't about my account or my plan, add: "You can also copy the full prompt from your audit page." Then stop. Never run an audit from memory.
- A blocked call with an upgrade or limit message: tell me the `message` and stop.
- The tool `get_audit` doesn't exist: my plugin is out of date. Tell me to update BuildPartner.ai, or to copy the full prompt from my audit page.
