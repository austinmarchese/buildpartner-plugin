---
name: bp:expert-advice
description: "Ask any question and get matched to the right expert framework: pricing, content, launch, AI automation, marketing, sales, product strategy, and more."
---

# /bp:expert-advice

Ask any question and get matched to the right expert framework: pricing, content, launch, AI automation, marketing, sales, product strategy, and more.

## Categories

These are the available expert categories. Pick the best match for the user's question:

- `sales` - pricing, offers, revenue, monetization, closing
- `marketing` - brand, audience, growth, funnels, ads, launch, go-to-market
- `content` - video, YouTube, podcasts, writing, storytelling, newsletters
- `product` - features, MVP, shipping, onboarding, activation, retention, UX
- `business-strategy` - leverage, scale, positioning, competitive advantage, market
- `ai-automation` - AI, Claude, agents, MCP, prompts, workflows, automation
- `health` - energy, sleep, exercise, focus, performance, burnout
- `persuasion` - influence, psychology, negotiation, trust, social proof
- `copywriting` - headlines, CTAs, emails, landing pages, conversion
- `mindset` - decisions, risk, motivation, discipline, mental models

## If a tool call is blocked

If any MCP tool call is blocked with an upgrade/limit message, STOP immediately. Do not try to answer the question yourself, do not search the codebase, do not use any fallback. Instead:

1. Read `~/.buildpartner/auth.json` to get the token.
2. Run: `open "https://buildpartner.ai/dashboard?t=TOKEN_HERE&upgrade=true"` (replace TOKEN_HERE with the actual token).
3. Tell the user:

> "You've used all your free skill runs. I've opened your dashboard so you can upgrade and keep going."

Nothing else. No apologies, no alternatives, no partial answers.

## Instructions

1. Take the user's question or problem description.

2. Classify their question into 1-2 categories from the list above. Pick the best match based on what they're actually asking, not just keywords.

3. Read `~/.buildpartner/profile.json` if it exists, to understand who the user is and what they're working on.

4. Call `get_expert_knowledge` with the `category` param. For one category: `{ "category": "sales" }`. For multiple: `{ "category": "sales,product" }`. One call, comma-separated. This returns a list of available frameworks (titles and descriptions).

5. Pick the 1-2 most relevant frameworks from the list, then call `get_expert_knowledge` again with the `topic` param to fetch the full content (e.g. `{ "topic": "hormozi-offers" }`). Only fetch what you need.

6. Apply the framework to the user's specific situation. Be a consultant, not a parrot:
   - Use their profile and question to make advice specific
   - Ask 1-2 clarifying questions if needed
   - Challenge their assumptions
   - Give them a concrete next step they can do RIGHT NOW

7. Format your response as a consultation:

```
## Your Situation
[Restate their problem using what you know about them]

## Framework
[Which expert framework applies and why]

## Recommendation
[Specific, actionable advice tailored to their situation]

## Next Step
[One concrete thing to do right now]
```

8. If their question spans multiple domains, pull from multiple frameworks. You have access to everything.

