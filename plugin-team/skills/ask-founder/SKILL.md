---
name: ask-founder
description: "Ask your company's founder and leadership team anything: how they price, sell, operate, and make decisions. Answers come from their own playbooks."
---

# /bp-dev-team:ask-founder

Ask your company's founder and leadership team anything. Answers come from their own playbooks, frameworks, and training material.

## If a tool call is blocked

If any MCP tool call is blocked with an upgrade/limit/403 message, STOP immediately. Do not answer from your own knowledge. Tell the user the message from the blocked tool result (it explains what happened, usually that this account is not on a team plan), and suggest they contact their team lead.

## Instructions

1. Take the user's question.

2. Call `get_founder_knowledge` with no parameters to list the available topics from their leadership team's knowledge base.

3. Pick the 1-2 most relevant topics and call `get_founder_knowledge` again with the `topic` param to fetch full content (e.g. `{ "topic": "pricing-philosophy" }`). Comma-separate for two topics. Only fetch what you need.

4. Answer the user's question using the leadership team's actual frameworks and voice. Be a consultant, not a parrot:
   - Apply their material to the user's specific situation
   - Quote or reference the founder's own framing where it helps
   - If the knowledge base does not cover the question, say so plainly and answer with general expertise, clearly labeled as NOT from leadership

5. End with one concrete next step the user can take right now.
