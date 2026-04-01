---
description: "Build your profile so every skill knows who you are. Gets smarter each time you run it, asking deeper questions based on what it already knows."
---

# /buildpartner:interview-me

Build your profile so every skill knows who you are. Gets smarter each time you run it, asking deeper questions based on what it already knows.

## Instructions

1. Call `get_personal_context` with `{ "include_sessions": true }`.

2. Determine their **interview depth** based on what profile data already exists:

### Depth 1: First time (no profile or very sparse)

Quick, punchy. 6-8 questions max. Get the essentials so everything can start personalizing.

Questions (pick the best ones based on what session data already tells you):
- "What are you building right now, and why does it matter to you?"
- "Solo or team?"
- "Where do you want to be in a year?"
- "What's the biggest thing slowing you down?"
- "When Claude responds, concise or detailed?"
- "If something in your code is wrong, call it out directly or be diplomatic?"
- "What do you wish Claude did differently?"

Skip anything you can already answer from their session data. If you can see they code in TypeScript with Next.js, don't ask "what's your tech stack?"

Tone: Fast, conversational, not a survey. React to what they say.

### Depth 2: Has basic profile, gaps to fill

They've done this before but there are thin areas. Acknowledge what you know, then go deeper on what's missing.

Start with: "Good to see you again. Here's what I know about you so far: {1-2 sentence summary}. Let me fill in some gaps."

Target questions at the weakest sections of their profile:
- **If personality is thin**: "What got you into building? What's the origin story?" / "What's the hardest thing you've been through that changed how you work?"
- **If vision is thin**: "Where do you want to be in 5 years? Not the pitch, the real answer." / "If you could mass-produce one skill in yourself, what would it be?"
- **If work_patterns is thin**: "Walk me through how you start a typical work session." / "When do you do your best work?"
- **If preferences are thin**: "When you're stuck, do you want me to suggest solutions or ask questions?" / "How do you feel about me making changes proactively vs. asking first?"

6-8 targeted questions. Don't re-ask things they've already answered well.

### Depth 3: Solid profile, time to go deep

They have a well-filled profile. Now ask the questions that unlock real personalization.

Start with: "Your profile is solid. Let me ask some harder questions to make this even more useful."

Pick from:
- "Walk me through your career. Not the resume version. The real version."
- "What's the thing you've built that you're most proud of?"
- "What's the biggest risk you've taken?"
- "Who influenced you the most and why?"
- "How do you make decisions? Gut feel, data, or advice from people you trust?"
- "What are you really good at that most people don't know?"
- "What do you struggle with that you don't usually admit?"
- "What does your life look like in 3 years if everything goes well?"
- "What's the thing you keep putting off that you know matters?"

Go where the conversation goes. If something is interesting, follow up. Don't stick rigidly to the list.

### Depth 4: Deep profile, find the edges

They've done multiple rounds. Now find the nuance, contradictions, and updates.

Start with: "You've shared a lot. Let me check in on a few things and dig into some edges."

- Check for stale data: "Last time you said {X}. Still true?"
- Find contradictions: "You said you want {X} but your sessions show {Y}. What's going on there?"
- Explore new territory: "What's changed since we last talked?" / "What are you excited about right now that you weren't before?"
- Push on growth: "What did you learn this month that surprised you?" / "What habit are you trying to build or break?"

5-8 questions. This level is more like a check-in than an interview.

## Rules

- Ask ONE question at a time. Wait for the answer.
- Read the room. Short answers = keep it tighter. Long answers = follow up and go deeper.
- Don't be robotic. React to what they say. Be a person, not a form.
- If the user says "done" or wants to stop, save immediately with what you have.
- Never re-ask questions they've already answered well in a previous round.
- Always tell them what depth they're at: "This is round {N} for you."

## Saving

After the interview, save EVERYTHING in ONE single `save_profile` call. Merge new data with existing data. Do not overwrite fields that haven't changed.

```json
{
  "updates": {
    "writing_style": { "tone": "...", "verbosity": "...", "approach": "...", "technical_level": "..." },
    "preferences": { "response_style": "...", "code_style": "...", "decision_making": "...", "feedback_style": "..." },
    "tech_identity": { "role": "...", "primary_languages": ["..."], "frameworks": ["..."], "current_project": "..." },
    "work_patterns": { "session_style": "...", "planning_style": "...", "career_path": "...", "proudest_work": "..." },
    "personality": { "builder_type": "...", "learning_style": "...", "pain_points": ["..."], "goals": ["..."], "origin": "...", "values": "...", "strengths": "...", "struggles": "...", "decision_style": "...", "influences": "..." },
    "vision": { "five_year": "...", "biggest_bottleneck": "...", "origin_story": "...", "superpower_wish": "..." },
    "interview_meta": { "rounds_completed": 1, "last_round": "YYYY-MM-DD", "depth_reached": 1, "sections_covered": ["writing_style", "preferences", "tech_identity"] }
  },
  "signals": ["Key insights from this round"]
}
```

The `interview_meta` section is critical. It tracks how many rounds they've done so the next run knows where to pick up.

## After Saving

Show a brief summary of what was added or updated, then:

- If Depth 1: "Your profile is live. Every BuildPartner.ai skill now personalizes to you. Run `/buildpartner:interview-me` again anytime to go deeper."
- If Depth 2-3: "Profile updated. {N new things learned}. There's more to explore next time."
- If Depth 4: "Profile refreshed. Everything's up to date."

Call `check_status` with `{ "skill_name": "bp-interview-me" }`.
