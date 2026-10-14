---
name: command-center
description: "See your whole system on one page: every skill by department, what runs on a routine, and where your company goals stand. Reads this project's skills and publishes them to your Command Center on BuildPartner.ai. Use when the user says 'set up my Command Center', 'update my Command Center', or 'refresh my Command Center'. Part of the Executive AI Program."
---

# /bp-dev:command-center

See your whole system on one page: every skill by department, what runs on a routine, and where your company goals stand.

You read this project, write ONE file, make ONE tool call (`publish_command_center`) and open the page. Each run replaces the last one, so the user runs it again whenever a skill or a routine changes.

## Rules

- **Any project with at least one skill works.** There is no other test. Do not check for a Company Brain, a `CLAUDE.md` or any folder before starting.
- **Change nothing the user owns.** Never edit `CLAUDE.md`, a skill, a wiki page or any other file of theirs, and never create folders for them. The only file you write is `.buildpartner/command-center.json`.
- **Send only the layout in step 8.** No file contents, no wiki pages, no session text. With the `activity` argument the layout also carries the activity summary of step 7b: counts, times and a few one-line titles in your own words. Never what was said in a session.
- **One tool call.** `publish_command_center` is called once per run and never retried. Never send the layout any other way.
- **Never guess.** A schedule the user did not give, a goal number the knowledge base does not hold, or a line about the business it does not hold, stays empty.
- Say "BuildPartner.ai", in plain words.

## Instructions

1. **Check this machine is connected.** Read `~/.buildpartner/auth.json`. If the file doesn't exist or has no token, tell the user:
   "This machine isn't connected to a BuildPartner.ai account. If you already have one, reconnect here: https://buildpartner.ai/dashboard/login?connect=1 (verify your email and it gives you the command to paste). If you're new, run: `curl -fsSL https://buildpartner.ai/install.sh | bash`"
   Stop here.

   Otherwise keep the `token` and the base URL for steps 9 and 10: `api_base` from the file if it has one (e.g. `https://dev.buildpartner.ai`), otherwise `https://buildpartner.ai`.

   If you have no `publish_command_center` tool, tell the user to restart Claude so the BuildPartner.ai plugin finishes updating, then run this again. Stop here.

1b. **Say what this will do**, in two lines, before reading anything: "I'll read this project's skills, your routines and your goals and update your Command Center." Never ask the user anything in this skill: a run by hand publishes the same way a routine run does.

2. **Find this project's skills.** Each folder in `.claude/skills/` at the top of this project that holds a `SKILL.md` is one skill. Read its frontmatter (`name`, `description`, `argument-hint`) and enough of the body to know what it does and what it needs. Count only this project's skills: not skills from plugins, and not skills in the user's home folder.

   Then read the user's Local Routines (step 6 says where). A routine whose working folder is this project and whose command is not one of this project's skills is still part of how this business runs, so it goes on the page too: one entry per routine, `id` the routine's id, `label` from its display name, `description` from what its prompt does, `command` the first `/command` line of its prompt (or the prompt's first line, cut to one sentence, when it has no slash command), and `schedule` from its cron. Routines whose working folder is another project are left out.

   Leave out:
   - folders whose name starts with `_` or `.`
   - any skill that describes itself as an internal module of another skill, or says not to run it directly (for example "INTERNAL INGEST MODULE, do not invoke directly; run /sync-external-data"). The user never runs those by hand.
   - any skill with `user-invocable: false` in its frontmatter. It has no command to copy.

   If no skills are left, tell the user: "This project has no skills yet, so there is nothing to put in a Command Center. Create your first skill here, then run `/bp-dev:command-center` again." Stop here.

3. **Start from the last layout, if there is one.** If `.buildpartner/command-center.json` already exists in this project, this run is an update. Read it and reuse:
   - the same `id` for every department and goal that is still there. Their history is kept under that id, so a new id starts it over.
   - the label and description of every skill that has not changed, so the page does not reword itself on each run.
   - each skill's schedule, as the starting answer for step 6.
   - the wording of every business profile line the knowledge base has not changed.

4. **Work out the departments.** Use the first of these that applies:
   - `wiki/departments/` exists and has departments in it: each folder there (or each page, when a department is a single page) is one department. Its id is the folder or page name, and its label is that name in plain words ("marketing" becomes "Marketing"). Include every one, even a department with no skills yet.
   - The last layout has departments: keep those.
   - Neither: group them yourself, without asking. Sort the skills into a few plain departments by what they do (such as Marketing, Sales, Operations and Leadership, or the names this business plainly uses). Use as few as fit, at most 8, each with a stable id. A skill that fits none stays `null`.

5. **Describe each skill.** For every skill from step 2, work out:
   - **id**: what the user types after the slash to run it. That is the `name` in its frontmatter, or the folder name when it has none.
   - **label**: a short plain name, 2 to 5 words ("sync-external-data" becomes "Daily data sync").
   - **description**: one plain sentence saying what the user gets when it runs. Take it from the skill's own description. Leave out trigger phrases and anything written for Claude ("Use when...").
   - **department**: the id of the one department it belongs to. Use the department the skill names or reads from, otherwise the best fit for what it does. `null` when none fits or there are no departments. The page lists those under "Other".
   - **command**: the exact text the user pastes into Claude to run it. Usually `/<id>`. When they always run it with the same extra words, add them after a space (`/sync-external-data SEND 1`). It must be `/<id>` alone, or `/<id>` followed by a space and the rest. Anything else is replaced by `/<id>`.
   - **minutes_saved**: about how many minutes one run saves the user, compared with doing the same thing by hand. A whole number from 1 to 600. Work it out from what the skill does: a drafted reply is about 5, a one-page brief from a few sources about 20 to 30, a weekly report about 40. Keep the number from the last layout when the skill has not changed, so it does not move between runs. `null` when you cannot tell. The user can correct it on the page, and their number wins.
   - **input**: whenever one piece of text from the user changes what a run produces: a name, a company, a link, a topic, a date range, a question. That covers a skill that needs it and a skill that works without it but does a better job with it (it has an `argument-hint`, reads `$ARGUMENTS`, or opens by asking the user for one thing). Give the text box a short label that asks for exactly that, such as "Who is the call with?" or "What topic?". The page leaves the box empty and copies the plain command when nothing is typed, so an optional input never gets in the way. `null` only when the skill takes nothing from the user, takes only fixed words like SEND, or needs more than one piece of text. A skill that runs on a schedule keeps its fixed command and still gets the box when the rule above fits.

6. **Read the routines.** Local Routines live in the Claude desktop app, and they can be read from this computer:
   - `~/.claude/scheduled-tasks/<id>/SKILL.md` holds each routine's prompt (its `name` and `description` frontmatter, then the command it runs).
   - The app's store, `~/Library/Application Support/Claude/claude-code-sessions/*/*/scheduled-tasks.json` on macOS (`%APPDATA%\Claude\claude-code-sessions\*\*\scheduled-tasks.json` on Windows), holds each routine's `id`, `displayName`, `cronExpression`, `enabled` and `cwd`. A routine with no `cronExpression` is "Manual only": it runs on demand.

   Read both. Keep the routines whose `cwd` is this project. Match each to a skill by the `/command` in its prompt: that skill's `schedule` comes from the cron (`0 8 * * *` is daily at 08:00; `0 9 * * 1` is weekly, Monday, 09:00; a day-of-month is monthly), and its `command` is the exact command line the prompt runs, with its arguments. A routine that matches no skill becomes its own entry (step 2). A disabled routine counts as on demand. If neither place can be read, fall back to what is written down: the schedules in the last layout, a schedules file in the project, a skill that says when it runs.

   Then go straight to step 7, with no question, whether or not the `routine` argument is there. Keep every label, department, command and schedule from the last layout where the skill is still there. Never invent a schedule the store did not give. The user sees the result on their Command Center, and step 10 tells them what changed.

7. **Read the company goals and the business profile.** If the knowledge base has company goals (a goals page in `wiki/`, or wherever this project keeps them), list each one with its target and deadline. For a goal's current number, use the newest number saved in the knowledge base for that goal, such as the history their goal update keeps. Only read: do not pull fresh numbers from connections and do not estimate. A goal with no saved number gets `value: null`. When no company goals are written down, `goals` is an empty list. Do not ask about goals.

   Then read who the business serves, from wherever the knowledge base says it (a company, customer or messaging page in `wiki/`, or wherever this project keeps it). Take these six things, each in the user's own words, cut down to one line:
   - **offer**: what they sell.
   - **audience**: who they serve.
   - **niche**: their niche or industry, in a few words.
   - **website**: the company's own site.
   - **handles**: the company's or the user's own accounts on X, Instagram and YouTube. Leave out every other platform.
   - **watching**: up to 5 competitors or creators they follow, each as a name or an @handle.

   Only read. A line the knowledge base does not hold stays empty (`""`, or `[]` for the two lists). Do not work one out from the skills, the company name or anything else, and do not ask about it. Ask the experts on their Command Center answers from these lines, so a guess here becomes wrong advice there.

7b. **Read what happened, only with the `activity` argument.** Without that argument, skip this step and send no `activity`: the user has not said yes to it. BuildPartner.ai hands the argument out only after they turn it on, so never add it yourself and never ask about it.

   Read this project's Claude sessions from the last 30 days. Claude Code keeps one file per session for this folder, in `~/.claude/projects/` under a folder named after this project's full path (every `/` and `.` turned into `-`). Each line is one message with its time. Read enough of each session to answer the five questions below and nothing more, and work all of it out on this computer. What you send is counts, times and a few one-line titles in your own words. Never send, quote or paste what was said in a session, a file's contents, a secret, an email address, a phone number or a link.

   - **skills**: for every skill in the layout, when it last ran and how many times it ran in the last 7 and the last 30 days. A run is the skill being called: its slash command typed, Claude invoking it, or a routine starting it. `last_run_at` is that moment as an ISO time with its timezone offset, or `null` when it did not run in the 30 days. Leave a skill out entirely when you cannot tell whether it ran, for example when its sessions are kept somewhere you cannot read. Do not guess: a skill listed with no run shows as unused, and a scheduled one shows as missed.
   - **days**: for each of the last 30 days that had a session, how many sessions belonged to each department. A session belongs to the department of the skill it ran, or the one its work was plainly about. One that fits no department counts under `other`. Dates are this computer's local dates.
   - **open**: up to 10 sessions from the last 14 days that were left unfinished. The work stopped part way (a list half done, a draft never sent, a question from Claude the user never answered) and no later session finished it. A session that simply ended is not unfinished. For each one: `id` is the session's own id (its file name without the ending), `title` is what it was about in a few plain words, `department` as above or `null`, `left_at` is the time of its last message, and `stopped` is one line on where it stopped ("Stopped after drafting email 2 of 5").
   - **wins**: up to 3 things that got finished in the last 7 days, the ones the user would most want to remember. A `title` in a few plain words, its `department` or `null`, and the `date` it was finished.
   - **health**: four checks on this project's setup, each with `ok` true or false and a one-line `note` that carries a count where there is one:
     - `structure`: skills, knowledge and outputs each have their own place.
     - `skills`: every skill has a name and a clear one-line description, and can be run.
     - `memory`: Claude has standing instructions for this project, and they are not empty.
     - `cleanup`: `ok` is false when skills have gone unused for 30 days, or instructions repeat or contradict each other. The note says how many.

   **No names in what you write.** Every `title`, `stopped` and `note` is written without the name of a person or a company, the user's own company included. Say "a client", "a partner" or "a lead" instead. Skill names are fine.

   Nothing here is a question for the user. What you cannot read stays out.

8. **Write the layout** to `.buildpartner/command-center.json` inside this project, creating the `.buildpartner` folder if it is not there. This file is the exact copy of what gets sent. Use exactly this shape and nothing else:

   ```json
   {
     "schema": 1,
     "timezone": "America/Chicago",
     "company": "Harbor Physio",
     "departments": [
       { "id": "operations", "label": "Operations" },
       { "id": "sales", "label": "Sales" },
       { "id": "leadership", "label": "Leadership" }
     ],
     "skills": [
       {
         "id": "sync-external-data",
         "label": "Daily data sync",
         "description": "Pulls in what's new from your connected tools.",
         "department": "operations",
         "command": "/sync-external-data SEND 1",
         "input": null,
         "minutes_saved": 15,
         "schedule": { "label": "Daily 8:00 AM", "cadence": "daily", "time": "08:00", "weekday": null }
       },
       {
         "id": "sales-overview",
         "label": "Sales overview",
         "description": "A one-page brief before a conversation.",
         "department": "sales",
         "command": "/sales-overview",
         "input": { "label": "Who is the call with?" },
         "minutes_saved": 30,
         "schedule": null
       },
       {
         "id": "company-goal-update",
         "label": "Company goal update",
         "description": "Where each company goal stands and whether it is on track.",
         "department": "leadership",
         "command": "/company-goal-update SEND",
         "input": null,
         "minutes_saved": 40,
         "schedule": { "label": "Weekly, Monday 8:00 AM", "cadence": "weekly", "time": "08:00", "weekday": 1 }
       }
     ],
     "goals": [
       { "id": "monthly-revenue", "label": "$50K in monthly revenue", "target": 50000, "unit": "$", "deadline": "2026-12-31", "value": 31200 }
     ],
     "profile": {
       "offer": "Physiotherapy for sports injuries, as single visits or a six-visit plan.",
       "audience": "Active adults 30 to 55 near the harbor, mostly runners.",
       "niche": "Sports physiotherapy clinic",
       "website": "harborphysio.com",
       "handles": [{ "platform": "instagram", "handle": "harborphysio" }],
       "watching": ["Bayside Sports Rehab", "@therunningphysio"]
     },
     "activity": {
       "skills": [
         { "id": "sync-external-data", "last_run_at": "2026-10-13T08:02:00-05:00", "runs_7d": 7, "runs_30d": 29 },
         { "id": "sales-overview", "last_run_at": "2026-10-12T14:10:00-05:00", "runs_7d": 4, "runs_30d": 11 },
         { "id": "company-goal-update", "last_run_at": null, "runs_7d": 0, "runs_30d": 0 }
       ],
       "days": [
         { "date": "2026-10-12", "counts": { "sales": 2, "operations": 1 } },
         { "date": "2026-10-13", "counts": { "operations": 1, "other": 1 } }
       ],
       "open": [
         { "id": "7c1d2f0a-4b1e-4c57-9a56-0e1f2a3b4c5d", "title": "Follow-up emails for a new client", "department": "sales", "left_at": "2026-10-12T16:10:00-05:00", "stopped": "Stopped after drafting email 2 of 5" }
       ],
       "wins": [
         { "title": "A brief now goes out before every sales call", "department": "sales", "date": "2026-10-12" }
       ],
       "health": [
         { "key": "structure", "ok": true, "note": "Skills, knowledge and outputs each have their own place" },
         { "key": "skills", "ok": true, "note": "All 3 have a clear description" },
         { "key": "memory", "ok": true, "note": "Claude has standing instructions for this project" },
         { "key": "cleanup", "ok": false, "note": "1 skill not used in 30 days" }
       ]
     }
   }
   ```

   - `activity` is there only with the `activity` argument (step 7b). Without the argument, leave the key out of the file altogether. `skills[].id` is a skill id from this file. `counts` keys are department ids from this file, or `other`. At most 31 `days`, 10 `open`, 3 `wins`, and the four `health` keys once each. `title` up to 120 characters, `stopped` and `note` up to 160.
   - `minutes_saved` on a skill: a whole number from 1 to 600, or `null`.

   - `schema` is always `1`.
   - `timezone`: this computer's timezone as an IANA name. Schedule times are in it. Read it from the system. Don't guess it from where the company is.
   - `company`: the company's name as the knowledge base gives it, up to 80 characters. `""` when you can't tell. They can set it on the page.
   - Every `id` (departments, skills, goals): 1 to 64 characters, only letters, numbers, `-`, `_`, `.` and `:`, starting with a letter or a number, and never twice in the same list. A department folder called "Client Success" becomes `client-success`.
   - `departments`: at most 12. `label` up to 60 characters. `[]` when ungrouped.
   - `skills`: at most 200. `label` up to 80 characters, `description` up to 200, `command` up to 200, `input.label` up to 80. `department` is the `id` of a department in this file, or `null`.
   - `schedule`: `null`, or all four fields. `cadence` is one of `hourly`, `daily`, `weekdays` (Monday to Friday), `weekly`, `monthly`. `time` is `"HH:MM"` on a 24 hour clock, or `null`. `weekday` is `0` (Sunday) to `6` (Saturday) for `weekly`, and `null` for every other cadence. `label` is what the user reads, up to 80 characters: "Hourly", "Daily 8:00 AM", "Weekdays 7:30 AM", "Weekly, Monday 8:00 AM", "Monthly". A routine that fits none of the five (every two weeks, three days a week) takes the closest one, with the real timing in the label.
   - `goals`: at most 20. `label` is the goal as the user wrote it, up to 120 characters. `target` and `value` are plain numbers (`50000`, not "$50K"), or `null`. `unit` is `"$"` for money, a short word such as `"hours"` when the number needs one, or `""` for a plain count, up to 12 characters. `deadline` is `"YYYY-MM-DD"` or `null`.
   - `profile`: `offer`, `audience` and `website` up to 200 characters, `niche` up to 80. `handles`: at most 6. `platform` is one of `x`, `instagram`, `youtube`, and `handle` is the name without the `@`, up to 64 characters. `watching`: at most 5, each up to 80 characters. When the knowledge base holds none of the six, `profile` is `null`.
   - Every text value is one line. Text over a limit is cut, and anything outside this shape is dropped, so stay inside it. If the project has more skills, departments or goals than fit, keep the first ones up to the limit and tell the user in step 10 which were left out.

9. **Publish it.** Call `publish_command_center` once, with `layout` set to exactly what you wrote to the file. Then act on the result:

   - **`needs_setup` is true.** Sharing isn't on for this account yet. Take `setup_url` from the result and add the token to it as `t=TOKEN_HERE`: joined with `&` when the address already has a `?`, otherwise with `?`, and always before any `#` part. For example `https://buildpartner.ai/dashboard/activity?next=command-center#sharing` becomes `https://buildpartner.ai/dashboard/activity?next=command-center&t=TOKEN_HERE#sharing`. Open that address in the user's default browser, then tell the user:
     "Sharing with BuildPartner.ai isn't on yet, so nothing was sent. I've opened the page where you turn it on. Once it's on, run `/bp-dev:command-center` again. Your layout is saved, so it will be quick."
     Stop here. Do not call the tool again in this run.
   - **The result says the Command Center is part of the Executive AI Program** (`limit_reached` with that `message`). Tell the user the `message`, add the program link when the result gives one, and stop here. Nothing was sent. This is not a plan limit: do not open the dashboard and do not suggest an upgrade.
   - **Any other `error`.** Tell the user the message, and that their layout is saved in `.buildpartner/command-center.json`, so running this again will publish it. Stop here.
   - **`ok` is true.** Go to step 10.

10. **Open it and say what was published.** With the `routine` argument, do not open the browser: print the one line and the address.

    Normally: Open this address in the user's default browser, replacing BASE_URL and TOKEN_HERE with the values from step 1:
    ```
    BASE_URL/dashboard/executive?part=command-center&t=TOKEN_HERE
    ```
    Then tell the user what was published, using the numbers in the result:

    > "Your Command Center is open: {skills} skills in {departments} departments, {how many have a schedule} on a routine, {goals} company goals."

    Say "ungrouped" in place of the departments when there are none. Then add only the lines that apply:
    - With the `activity` argument, when the result's `activity` is true: "Your activity summary went with it: the last run of each skill, what you left unfinished and the time your skills saved are on the page." When it is false: "Your activity summary was not kept, because it is turned off in your Command Center settings."
    - On an update: "New since last time: ..." (`added`) and "No longer listed: ..." (`removed`). Skip both on a first publish.
    - "Not shown, because they run inside another skill: ..." for the skills left out in step 2.
    - "I grouped your skills into {N} departments: {their labels}." when this run made the departments itself (no last layout and no `wiki/departments/`). Then: "To group them differently, tell me how and run this again."
    - Anything left out for a limit in step 8.
    - When any business profile line is empty: "Not in your knowledge base yet, so left blank: ...", naming them in plain words (what you sell, who you serve, your niche, your website, your social handles, who you watch), then "Add them to your knowledge base and run this again. Ask the experts on your Command Center uses them to answer about your business."

    End with: "The exact copy of what was sent is in `.buildpartner/command-center.json`. Run `/bp-dev:command-center` again whenever you add a skill or change a routine."

## If the tool result comes back as a stub or truncated

If the `publish_command_center` result is replaced by a placeholder like "[Full result archived (N chars)...]" or otherwise arrives stubbed or truncated, that is the user's own local tooling intercepting the result, not a BuildPartner.ai failure. Only a successful publish is long enough to be intercepted, so the layout was most likely published. Do NOT call the tool again, do NOT try to recover the result by reading session transcripts, cache directories or any other file on disk, and never use the token in `~/.buildpartner/auth.json` to call the server yourself. Instead:

1. Open the Command Center as in step 10, so the user can see what is there.
2. Tell the user plainly that a local optimization tool intercepted the result, so you can't confirm the numbers, and that they can exempt BuildPartner.ai's tools from it (for token-optimizer: `TOKEN_OPTIMIZER_ARCHIVE_EXEMPT_TOOLS="mcp__plugin_b*"` in their settings env).
