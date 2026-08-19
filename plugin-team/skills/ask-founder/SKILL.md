---
name: ask-founder
description: "Ask your company's founder and leadership team anything: how they price, sell, operate, and make decisions. Answers come from their own knowledge base across the business's verticals."
---

# /bp-dev-team:ask-founder

Ask your company's founder and leadership team anything. Answers come from their own playbooks, frameworks, and training material, organized by the business's verticals.

## If a tool call is blocked

If any MCP tool call is blocked with an upgrade/limit/403 message, STOP immediately. Do not answer from your own knowledge. Tell the user the message from the blocked tool result (it explains what happened, usually that this account is not on a team plan), and suggest they contact their team lead.

## If a tool result comes back as a stub or truncated

If a tool result is replaced by a placeholder like "[Full result archived (N chars)...]" or otherwise arrives stubbed or truncated, that is the user's own local tooling intercepting the result, not a BuildPartner.ai failure. Do NOT try to recover the real content by reading session transcripts, cache directories, or any other file on disk, and never read credential files like `~/.buildpartner/auth.json` to re-fetch the data directly. Do not call the API directly either. Instead:

1. Retry the exact same call once.
2. If the category fetch is still stubbed, fetch the needed frameworks individually with the `topic` param, one slug per call, which returns smaller results.
3. If a single-topic result is also stubbed, tell the user plainly that a local optimization tool intercepted the result and that they can exempt BuildPartner.ai's tools from it, then answer using the topic titles and descriptions you already have plus your own expertise, clearly labeled as NOT from leadership.

## Instructions

1. Take the user's question.

2. Call `get_founder_knowledge` with no parameters. This returns `{ expert: { topics, verticals } }`, where `verticals` is the org's own list of verticals, each with a framework count (e.g. `[{ "name": "content", "frameworks": 4 }, { "name": "sales", "frameworks": 0 }]`). This list is per-company. Never assume or hardcode vertical names; always read them from this response.

3. Classify the question into the 1-2 best-matching verticals from that response.

4. Call `get_founder_knowledge` again with the `category` param set to the matched vertical name(s), comma-separated for two (e.g. `{ "category": "content,sales" }`, using whatever names came back in step 2). This returns the full frameworks for that vertical.

5. If a matched vertical has zero frameworks (count was 0 in step 2, or the category call comes back empty):
   - Tell the user plainly that their leadership team has not added knowledge for that vertical yet.
   - Suggest they flag it to their team lead.
   - Then answer with general expertise instead, clearly labeled as NOT from leadership.

6. Answer the user's question as a consultant, not a parrot, grounded in the leadership team's actual frameworks:
   - Apply their material to the user's specific situation
   - Quote or reference the founder's own framing where it helps
   - End with one concrete next step the user can take right now
