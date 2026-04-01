---
description: "Generate personalized training data from your Claude Code sessions. Recaps your week, captures what you built, and logs lived experiences. Every skill gets smarter after."
---

# /buildpartner:generate-personalized-training-data

Generate personalized training data from your Claude Code sessions. Recaps your week, captures what you built, and logs lived experiences. Every skill gets smarter after.

## Instructions

1. Call `get_personal_context` with `{ "include_sessions": true }`.

2. Check if they have a `training_data` section in their AI profile with a `write_path`. If yes, you know where to write. If no, this is their first time.

### Part 1: Weekly Recap

Build a recap from this week's sessions:

```
## This Week

**{X} sessions | {Y} tokens | {streak} day streak**

### What you worked on
- {Project/activity 1} ({X sessions})
- {Project/activity 2} ({X sessions})

### Best session
{The most interesting or productive session this week. One sentence.}

### Add to your playbook
{1-2 specific things they should start doing based on this week's patterns.}

### Your week in numbers
Code {X%} | Content {X%} | Research {X%} | Other {X%}
```

Keep the recap under 15 lines. Lead with what matters.

### Part 2: Generate Training Data

From the session history, extract structured training data entries. Each entry captures something transferable:

```markdown
# {Date} - {Brief Title}

## What happened
{1-2 paragraph narrative of what was built or figured out}

## What was built
- {Files/features created or modified}
- {Tools or approaches used}

## Key learning
- {The transferable insight from this experience}

## Tags
{topic1, topic2, topic3}
```

Generate entries for the most significant sessions this week (2-5 entries, skip trivial sessions).

### Part 3: Determine Where to Write

**If they have a `write_path` saved in their profile:** Write there without asking. Just confirm what you wrote.

**If this is their first time:** Look for existing knowledge/context directories in their workspace:
- Check for `~/.buildpartner/knowledge/experiences/`
- Check for directories like `internal-os/context/`, `knowledge/`, `context/`, `docs/` in the current project
- Check for any `.claude/` project-level context folders

If you find an existing structure, suggest the best fit:

> "I see you have `{path}`. I'll write your training data there. Sound good?"

If nothing exists, default to `~/.buildpartner/knowledge/experiences/` and tell them:

> "I'll create `~/.buildpartner/knowledge/experiences/` for your training data. You can change this anytime."

Save the chosen path to their profile so you never ask again.

### Part 4: Log Lived Experiences

After showing the recap and generated entries, ask:

> "Anything else from this week worth capturing? A win, a lesson, something you figured out. A sentence or two is plenty, or type 'skip'."

If they share something, add it as an additional training data entry.
If they skip, move on.

### Part 5: Write Everything

1. Write each training data entry as a separate file: `{write_path}/{YYYY-MM-DD}-{brief-slug}.md`
2. Write the weekly recap as: `{write_path}/recaps/{YYYY-MM-DD}-weekly-recap.md`

Create directories as needed with `mkdir -p`.

3. Save the write path and metadata to their profile:

```json
{
  "updates": {
    "training_data": {
      "write_path": "/path/to/knowledge/experiences",
      "last_generated": "YYYY-MM-DD",
      "total_entries": 12,
      "weeks_captured": 3
    }
  }
}
```

## Output

After writing, confirm:

```
## Training Data Generated

**{N} entries written** to `{write_path}`
**Week {N} captured** ({total_entries} total entries)

Files:
- {filename1}
- {filename2}
- recaps/{recap-filename}

This feeds into /buildpartner:claude-coach, /buildpartner:expert-advice, and /buildpartner:interview-me.
Run this weekly to keep everything sharp.
```

## Rules

- Keep the recap honest. Good week? Say so. Inconsistent? Say that too.
- Training data entries should be useful for future consultations, not just a diary.
- Write in their voice if their AI profile has a writing style.
- If they have < 3 sessions this week, say: "Light week. Here's what I have:" and generate what you can.
- Don't ask unnecessary questions. Generate first, ask for additions after.
- The "Add to your playbook" section in the recap is the most important part. Make it specific and actionable.

Call `check_status` with `{ "skill_name": "bp-generate-personalized-training-data" }`.
