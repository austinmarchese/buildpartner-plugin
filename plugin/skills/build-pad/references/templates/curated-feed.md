# Template: Curated Feed

Use this template when the user wants their own feed of the creators they follow: "build my curated feed", "update my Curated Feed", "change who's on my Curated Feed". It is the member's own version of buildpartner.ai/feed: one scrolling column of the newest posts from the creators they pick on X, YouTube and Instagram, each drawn the way its platform draws it.
Start from [curated-feed.html](curated-feed.html): copy it into the pad folder as `index.html`, fill the five `{{...}}` and the JSON block `#feed-data`, and delete nothing else. The page draws every post from that JSON, so never write post HTML by hand.
Keep the three meta tags at the top in every version: `buildpad-template` (the top bar labels the pad "Curated Feed template"), `buildpad-annotation` off (a click opens the original post instead of starting a comment), and `buildpad-chat` collapsed (the comment panel starts closed).

## First run: pick the creators

1. Ask who they want on their feed, as handles or links, grouped by platform (X, YouTube, Instagram). If they want a starting point, offer the creators on buildpartner.ai/feed. Never guess a handle.
2. Keep the list short enough to read every day: 5 to 20 accounts. Each account is one lookup per update.

## Every run: pull and fill

1. For each account, call `social_intel` with `action: "creator_posts"`, its `platform`, the handle as `target`, and `media: true` so the answer keeps each post's pictures and the account's picture (`avatar`). Before a long list, say how many lookups it will use; on the free plan each one spends credits, and when `quota` says few are left, tell the user before going on.
2. Drop replies and retweets. Keep each account's 10 newest posts.
3. Merge every account's posts, newest first, and write them into `#feed-data` as a JSON array. One object per post, with only the fields you have:

| Field | From |
| --- | --- |
| `platform` | `x`, `youtube` or `instagram` |
| `url` | the post's link |
| `name`, `handle` | the account's display name and handle (no @) |
| `avatar` | the response's `avatar` (the account's picture) |
| `postedAt` | the post's date (ISO) |
| `text` | the post's text, an Instagram caption, or a YouTube video's title. Keep line breaks; cut at about 280 characters with an ellipsis |
| `views`, `likes`, `comments` | the post's numbers |
| `reposts` | X: reposts plus quotes |
| `outlier` | the post's outlier score (the page tags 2 and above as "Nx their usual") |
| `media` | X: the post's `media` as returned (up to 4 stills, each `{ type, url }`) |
| `card` | X: the post's `card` (link preview) as returned |
| `quote` | X: the post's `quote` (the post it quotes) as returned |
| `thumbnail`, `duration` | YouTube: the thumbnail image and the length in seconds |
| `image`, `isVideo` | Instagram: the post's `thumbnail` (or first slide), and `true` for a reel |

Pictures are optional: a post without one still reads cleanly, and an account without a picture shows its initial. Never invent a picture URL. Only `https://` links are drawn.
4. Escape `<` as `<` inside the JSON so the block cannot close itself early.

## The five placeholders

- `{{NAME}}`: the user's first name ("Austin's Curated Feed"). Ask once if you don't know it.
- `{{LEAD}}`: one plain line on what the feed is, in their words if they gave any. Default: "The creators I follow on X, YouTube and Instagram, in one place."
- `{{UPDATED}}`: today's date, as "November 24".
- `{{UPDATE_PROMPT}}` and `{{CHANGE_PROMPT}}` go inside the two `<template>` tags. They are what the page's **Update feed** and **Edit creators** buttons copy, so each must work pasted into a fresh Claude Code session with no other context. Write them with this skill's own slash command (the one you are running as, for example `/bp-dev:build-pad`), and name every account so the new session knows the list:
  - Update: `<command> Update my Curated Feed. Using BuildPartner.ai, pull the newest posts from X: @a, @b; YouTube: @c; Instagram: @d. Publish them as a new version of my Curated Feed pad with the Curated Feed template.`
  - Change: `<command> Change who's on my Curated Feed. It follows X: @a, @b; YouTube: @c; Instagram: @d. Ask me who to add or remove, then pull the newest posts with BuildPartner.ai and publish a new version of my Curated Feed pad with the Curated Feed template.`
  Leave out a platform with no accounts. When the list changes, rewrite both prompts.

## Publishing

- **First run:** `create`, titled "<Name>'s Curated Feed". Give the user the link, and tell them the two buttons at the top copy the prompts that update the feed or change who is on it.
- **Later runs:** find their pad with `list` (the one titled "<Name>'s Curated Feed") and `update` it with summary "Pulled the newest posts" or "Changed who's on the feed". Never create a second feed pad. If none is left (pads are deleted 14 days after their last activity), `create` a new one.
- A feed is for reading, not reviewing: don't start the feedback loop (`watch` / `poll`) unless the user asks for changes to the page.

## Updating every day

If they want it to update by itself, offer to set the Update prompt up as a Local Routine in the Claude desktop app that runs every morning. An update every day also keeps the pad from being deleted.

## What the user can still change

The template is where the page starts, not a limit. When they ask for a change ("add LinkedIn", "only show posts from this week"), make it in their copy, keep the brand and the three meta tags, and keep the posts in `#feed-data`.
