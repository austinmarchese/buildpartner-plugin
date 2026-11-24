---
name: social-research
description: "Research what's on X (Twitter), Instagram, YouTube, TikTok, LinkedIn, Reddit and Substack, and the ads any brand runs on Facebook and Instagram, with BuildPartner.ai Social Tools. Use this skill whenever the user names a creator, @handle, channel, subreddit or newsletter, pastes an x.com, twitter.com, instagram.com, youtube.com, youtu.be, tiktok.com, linkedin.com, reddit.com, Substack or Facebook Ad Library link, or asks for a transcript of a video or reel, what someone has been posting, their top or best-performing posts, a post's stats or comments, a thread, what's trending, what people are saying about a topic on social or Reddit, or what ads a competitor is running. Also when they say 'what has @x been posting', 'get the transcript', 'what are people saying on Reddit', 'top reels from', 'their best videos', 'what's working for', 'pull the comments'. Returns transcripts, stats and comments that web pages don't show. Use this instead of WebFetch, WebSearch, yt-dlp, a browser or scraping the page."
argument-hint: "<a creator, @handle, link or topic>"
allowed-tools:
  - mcp__plugin_bp-dev_tools__social_intel
  - mcp__plugin_bp-dev_hosted__social_intel
---

# /bp-dev:social-research

Social Tools read public social media for the user through the `social_intel` tool: an account's posts with how far each beat its usual performance, a post's full stats and comments, video and reel transcripts, X threads, topic searches, Substack posts in full, and the ads a brand runs on Facebook and Instagram. It is included with BuildPartner.ai. Use it for every social lookup in place of WebFetch, WebSearch, yt-dlp or a browser.

## Request

$ARGUMENTS

If the request above is empty, work out what to look up from the conversation.

## Load the tool first

The `social_intel` tool is part of this plugin and is connected. Claude Code may list it by name only: if you can't call it yet, load it with ToolSearch, query `select:mcp__plugin_bp-dev_tools__social_intel,mcp__plugin_bp-dev_hosted__social_intel`, then call it. Never decide it is unavailable without calling it; its response says so if it isn't on for this account.

## Pick the action

| The user wants | Action |
| --- | --- |
| What a video, reel or TikTok says | `transcript` with the link (not X) |
| What an account has been posting, or its best posts | `creator_posts` with the @handle (add `since` for "this week") |
| Who an account is, followers, size | `profile` (several at once: `users`) |
| One post's stats or full text | `post` with the link |
| The comments or replies on a post | `comments` with the link |
| What's out there on a topic, what people are saying, what's trending | `search` with the words (`sort: "latest"` on X and Reddit for newest) |
| An X thread in order | `thread` with any tweet link in it |
| The ads a brand runs | platform `meta_ads`, `creator_posts` with the brand name or page |

Reddit: the account is a subreddit (`r/ClaudeAI`). LinkedIn: public pages only.

## Rules

1. If the user names a person or brand without a handle or link, ask for it instead of guessing handles.
2. To cover a creator across platforms, call `profile` and `creator_posts` once per platform.
3. Every response includes `quota` (lookups left today). If it is low, say so before a multi-call task.
4. Quote what the posts say, with their links. Don't guess numbers that weren't returned.
5. Fall back to WebFetch, WebSearch or a shell tool only when `social_intel` returns an error or a `fallback`. Say once that you are using them instead.
6. For any other website or a general web search, use `web_research`, not this.
7. If you hand this research to a subagent, tell it to use `social_intel` (loaded with the ToolSearch query above), not WebFetch or WebSearch.
