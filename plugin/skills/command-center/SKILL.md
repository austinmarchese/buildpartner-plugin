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
- **Send only the layout in step 8.** No file contents, no wiki pages, no session text.
- **One tool call.** `publish_command_center` is called once per run and never retried. Never send the layout any other way.
- **Never guess.** A schedule the user did not give, a goal number the knowledge base does not hold, or a line about the business it does not hold, stays empty.
- Say "BuildPartner.ai", in plain words.

## Instructions

1. **Check this machine is connected.** Read `~/.buildpartner/auth.json`. If the file doesn't exist or has no token, tell the user:
   "This machine isn't connected to a BuildPartner.ai account. If you already have one, reconnect here: https://buildpartner.ai/dashboard/login?connect=1 (verify your email and it gives you the command to paste). If you're new, run: `curl -fsSL https://buildpartner.ai/install.sh | bash`"
   Stop here.

   Otherwise keep the `token` and the base URL for steps 9 and 10: `api_base` from the file if it has one (e.g. `https://dev.buildpartner.ai`), otherwise `https://buildpartner.ai`.

   If you have no `publish_command_center` tool, tell the user to restart Claude so the BuildPartner.ai plugin finishes updating, then run this again. Stop here.

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
   - Neither: ask the user one question with two options. **"Group my skills"**: you sort them into a few plain groups by what they do, such as Marketing, Sales, Operations and Leadership. **"Leave them ungrouped"**: no departments at all.

5. **Describe each skill.** For every skill from step 2, work out:
   - **id**: what the user types after the slash to run it. That is the `name` in its frontmatter, or the folder name when it has none.
   - **label**: a short plain name, 2 to 5 words ("sync-external-data" becomes "Daily data sync").
   - **description**: one plain sentence saying what the user gets when it runs. Take it from the skill's own description. Leave out trigger phrases and anything written for Claude ("Use when...").
   - **department**: the id of the one department it belongs to. Use the department the skill names or reads from, otherwise the best fit for what it does. `null` when none fits or there are no departments. The page lists those under "Other".
   - **command**: the exact text the user pastes into Claude to run it. Usually `/<id>`. When they always run it with the same extra words, add them after a space (`/sync-external-data SEND 1`). It must be `/<id>` alone, or `/<id>` followed by a space and the rest. Anything else is replaced by `/<id>`.
   - **input**: only when the skill needs one piece of text from the user on each run (a name, a link, a question). Give the text box a short label, such as "Who is the call with?". `null` when the skill takes nothing, or only fixed words like SEND.

6. **Read the routines, then ask one question to confirm.** Local Routines live in the Claude desktop app, and they can be read from this computer:
   - `~/.claude/scheduled-tasks/<id>/SKILL.md` holds each routine's prompt (its `name` and `description` frontmatter, then the command it runs).
   - The app's store, `~/Library/Application Support/Claude/claude-code-sessions/*/*/scheduled-tasks.json` on macOS (`%APPDATA%\Claude\claude-code-sessions\*\*\scheduled-tasks.json` on Windows), holds each routine's `id`, `displayName`, `cronExpression`, `enabled` and `cwd`. A routine with no `cronExpression` is "Manual only": it runs on demand.

   Read both. Keep the routines whose `cwd` is this project. Match each to a skill by the `/command` in its prompt: that skill's `schedule` comes from the cron (`0 8 * * *` is daily at 08:00; `0 9 * * 1` is weekly, Monday, 09:00; a day-of-month is monthly), and its `command` is the exact command line the prompt runs, with its arguments. A routine that matches no skill becomes its own entry (step 2). A disabled routine counts as on demand. If neither place can be read, fall back to what is written down: the schedules in the last layout, a schedules file in the project, a skill that says when it runs.

   Then ask once, in plain text, only to confirm. Show the skills by department with the schedules you found, and ask what is wrong, so "looks right" is a full answer:

   > "Here is what will show in your Command Center: [skills by department, with each routine's schedule]. I read the routines from your Claude desktop app. Anything wrong or missing? Say 'looks right' to go on."

   Never ask the user to list what the store already says. On an update, show what changed since the last layout.

   Take the answer as given and ask nothing more. If it corrects a schedule, a label, a department or a command, apply it. Never invent a schedule the store or the user did not give.

7. **Read the company goals and the business profile.** If the knowledge base has company goals (a goals page in `wiki/`, or wherever this project keeps them), list each one with its target and deadline. For a goal's current number, use the newest number saved in the knowledge base for that goal, such as the history their goal update keeps. Only read: do not pull fresh numbers from connections and do not estimate. A goal with no saved number gets `value: null`. When no company goals are written down, `goals` is an empty list. Do not ask about goals.

   Then read who the business serves, from wherever the knowledge base says it (a company, customer or messaging page in `wiki/`, or wherever this project keeps it). Take these six things, each in the user's own words, cut down to one line:
   - **offer**: what they sell.
   - **audience**: who they serve.
   - **niche**: their niche or industry, in a few words.
   - **website**: the company's own site.
   - **handles**: the company's or the user's own accounts on X, Instagram and YouTube. Leave out every other platform.
   - **watching**: up to 5 competitors or creators they follow, each as a name or an @handle.

   Only read. A line the knowledge base does not hold stays empty (`""`, or `[]` for the two lists). Do not work one out from the skills, the company name or anything else, and do not ask about it. Ask the experts on their Command Center answers from these lines, so a guess here becomes wrong advice there.

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
         "schedule": { "label": "Daily 8:00 AM", "cadence": "daily", "time": "08:00", "weekday": null }
       },
       {
         "id": "sales-overview",
         "label": "Sales overview",
         "description": "A one-page brief before a conversation.",
         "department": "sales",
         "command": "/sales-overview",
         "input": { "label": "Who is the call with?" },
         "schedule": null
       },
       {
         "id": "company-goal-update",
         "label": "Company goal update",
         "description": "Where each company goal stands and whether it is on track.",
         "department": "leadership",
         "command": "/company-goal-update SEND",
         "input": null,
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
     }
   }
   ```

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

10. **Open it and say what was published.** Open this address in the user's default browser, replacing BASE_URL and TOKEN_HERE with the values from step 1:
    ```
    BASE_URL/dashboard/executive?part=command-center&t=TOKEN_HERE
    ```
    Then tell the user what was published, using the numbers in the result:

    > "Your Command Center is open: {skills} skills in {departments} departments, {how many have a schedule} on a routine, {goals} company goals."

    Say "ungrouped" in place of the departments when there are none. Then add only the lines that apply:
    - On an update: "New since last time: ..." (`added`) and "No longer listed: ..." (`removed`). Skip both on a first publish.
    - "Not shown, because they run inside another skill: ..." for the skills left out in step 2.
    - Anything left out for a limit in step 8.
    - When any business profile line is empty: "Not in your knowledge base yet, so left blank: ...", naming them in plain words (what you sell, who you serve, your niche, your website, your social handles, who you watch), then "Add them to your knowledge base and run this again. Ask the experts on your Command Center uses them to answer about your business."

    End with: "The exact copy of what was sent is in `.buildpartner/command-center.json`. Run `/bp-dev:command-center` again whenever you add a skill or change a routine."

## If the tool result comes back as a stub or truncated

If the `publish_command_center` result is replaced by a placeholder like "[Full result archived (N chars)...]" or otherwise arrives stubbed or truncated, that is the user's own local tooling intercepting the result, not a BuildPartner.ai failure. Only a successful publish is long enough to be intercepted, so the layout was most likely published. Do NOT call the tool again, do NOT try to recover the result by reading session transcripts, cache directories or any other file on disk, and never use the token in `~/.buildpartner/auth.json` to call the server yourself. Instead:

1. Open the Command Center as in step 10, so the user can see what is there.
2. Tell the user plainly that a local optimization tool intercepted the result, so you can't confirm the numbers, and that they can exempt BuildPartner.ai's tools from it (for token-optimizer: `TOKEN_OPTIMIZER_ARCHIVE_EXEMPT_TOOLS="mcp__plugin_b*"` in their settings env).
