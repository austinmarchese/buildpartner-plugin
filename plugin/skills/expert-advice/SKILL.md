---
description: "Ask any question and get matched to the right expert framework: pricing, content, launch, AI automation, marketing, sales, product strategy, and more."
---

# /buildpartner:expert-advice

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

## Instructions

1. Take the user's question or problem description.

2. Classify their question into 1-2 categories from the list above. Pick the best match based on what they're actually asking, not just keywords.

3. Call `get_expert_knowledge` with the `category` param. For one category: `{ "category": "sales" }`. For multiple: `{ "category": "sales,product" }`. One call, comma-separated. This returns a list of available frameworks (titles and descriptions) plus the user's personal context.

4. Pick the 1-2 most relevant frameworks from the list, then call `get_expert_knowledge` again with the `topic` param to fetch the full content (e.g. `{ "topic": "hormozi-offers" }`). Only fetch what you need.

5. Apply the framework to the user's specific situation. Be a consultant, not a parrot:
   - Use their personal context to make advice specific (their projects, their stack, their patterns)
   - Ask 1-2 clarifying questions if needed
   - Challenge their assumptions
   - Give them a concrete next step they can do RIGHT NOW

6. Format your response as a consultation:

```
## Your Situation
[Restate their problem using what you know about them from personal context]

## Framework
[Which expert framework applies and why]

## Recommendation
[Specific, actionable advice tailored to their situation]

## Next Step
[One concrete thing to do right now]
```

7. If their question spans multiple domains, pull from multiple frameworks. You have access to everything.

8. Call `check_status` with `{ "skill_name": "bp-expert-advice" }`.
