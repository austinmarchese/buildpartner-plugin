---
name: ask-founder
description: "Ask your company's founder and leadership team anything: how they price, sell, operate, and make decisions. Answers come from their own knowledge base across the business's verticals."
---

# /buildpartner-team:ask-founder

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

4. Call `get_founder_knowledge` again with the `category` param set to the matched vertical name(s), comma-separated for two (e.g. `{ "category": "content,sales" }`, using whatever names came back in step 2). This returns the frameworks for that vertical. If the response has `content_omitted: true`, the vertical is large and full content was withheld: pick the 1 to 3 most relevant frameworks from their titles/descriptions and fetch them with the `topic` param, comma-separated (e.g. `{ "topic": "pricing-tiers,discount-policy" }`). Otherwise the full content is already present in the response.

5. If a matched vertical has zero frameworks (count was 0 in step 2, or the category call comes back empty):
   - Tell the user plainly that their leadership team has not added knowledge for that vertical yet.
   - Answer with general expertise instead, clearly labeled as NOT from leadership.
   - Then OFFER to flag the topic to leadership. Show the user the exact one-line topic phrase you intend to send (a short phrase describing the gap, not their full question) and ask them to confirm or edit it. Call `request_founder_knowledge` with `{ topic, vertical }` ONLY after they explicitly confirm the phrase. Never auto-submit, and never send the user's full question, an artifact they pasted, or anything beyond the short confirmed phrase. If they decline or don't respond affirmatively, drop it and move on.

6. Answer the user's question as a consultant, not a parrot, grounded in the leadership team's actual frameworks:
   - Apply their material to the user's specific situation
   - Quote or reference the founder's own framing where it helps
   - End with one concrete next step the user can take right now

7. If the user provides a draft or artifact to review (an email, a message, a content idea, a title, a thumbnail description or image, a newsletter), treat it as a review request: classify which vertical(s) the artifact belongs to, fetch the relevant frameworks the same way as for a question, then critique the draft point by point against the leadership team's actual standards, naming which framework each point comes from. Finish with a concrete rewrite or the specific change to make. Critique and suggested rewrites keep the author's own voice and only apply the leadership team's standards; never rewrite the person into the founder's voice or style. Exception: if the artifact is content published as the founder (ghostwritten posts, founder-bylined content), then and only then match the founder's voice, using any voice framework the knowledge base provides. If no framework covers the artifact type or the matched vertical has zero frameworks, say so plainly, label any remaining feedback as general expertise (not leadership doctrine), and OFFER to flag the gap to leadership the same way as step 5: show the user the exact short topic phrase first, and call `request_founder_knowledge` only after they confirm it.
