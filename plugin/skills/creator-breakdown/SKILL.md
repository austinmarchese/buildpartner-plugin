---
name: creator-breakdown
description: "Break down what's working for a creator, brand or competitor on Instagram, YouTube, X, TikTok, LinkedIn or Substack with BuildPartner.ai Social Tools: their latest and top-performing posts, outliers, posting cadence, hooks and formats. Use whenever the user names an @handle or account and asks what they've been posting, their best or most viewed posts, top reels or videos, what's working for them, why they're growing, or wants to model, study or reverse-engineer their content. Use this instead of WebFetch, WebSearch or a browser on their profile page."
user-invocable: false
allowed-tools:
  - mcp__plugin_buildpartner_tools__social_intel
  - mcp__plugin_buildpartner_hosted__social_intel
---

# Creator breakdown

Use the `social_intel` tool. If it is listed by name only, load it first with ToolSearch, query `select:mcp__plugin_buildpartner_tools__social_intel,mcp__plugin_buildpartner_hosted__social_intel`.

1. No handle or link given? Ask for it. Don't guess handles.
2. `profile` for size, then `creator_posts` for their newest posts (add `since` for "this week" or "this month"). Each post has an outlier score: how many times it beat the account's usual (median) performance. Lead with the outliers.
3. For the top 2 or 3 outliers that are videos, get the `transcript` to show the hook and structure.
4. More than one platform? Do steps 2 and 3 once per platform.
5. YouTube: `format: "shorts"` or `"videos"` when the user wants one kind.
6. Quote posts with their links and real numbers. Check `quota` before going past about 10 calls.
