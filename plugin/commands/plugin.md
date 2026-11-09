---
description: "BuildPartner.ai: go through your Self-Improving System suggestions"
argument-hint: "[suggestions]"
---

Show me my BuildPartner.ai Self-Improving System suggestions and go through them with me.

1. Read `~/.claude/buildpartner-self-improving/suggestions.md`, which the BuildPartner.ai bar writes when I open my suggestions. Say nothing before the first suggestion. If the file is missing or lists none, tell me in one sentence that nothing is waiting and that new suggestions show up in the bar, and stop.
2. Take the suggestions one at a time. For each, show what would change and why in one or two plain sentences, then ask me with AskUserQuestion: Apply, Not now, or Dismiss.
3. On Apply, make the change through /bp-dev:improve-system, and show me the edit before you write it. On Dismiss, change nothing.
4. Record every Apply and Dismiss with the BuildPartner.ai `resolve_suggestion` tool, using the suggestion's id. Not now needs no call.

For anything else (turning the bar on or off, hiding it, the dashboard, your coach), tell me to use the ▼ on the BuildPartner.ai bar above the prompt.
