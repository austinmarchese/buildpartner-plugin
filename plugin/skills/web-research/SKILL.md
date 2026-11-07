---
name: web-research
description: "Search the web and read any website, link or URL with BuildPartner.ai Web Research. Use this skill whenever the user wants to search the web, look something up, find me something online, research a topic or a competitor, check what a company charges or offers, read a pricing page, landing page, sales page or docs page, or pastes a URL or link and wants what's on it. Also when they say 'search for', 'look up', 'find me', 'what does <company> charge', 'what are people saying about', 'read this link', 'fetch this page', 'grab', 'scrape', 'get the page at https://', 'get all the pages', 'crawl', or 'what would it cost to crawl'. Returns the exact page, not a summary, including pages that block bots or need JavaScript. Use this instead of WebFetch and WebSearch. Not for X, Instagram, YouTube or Substack (use social_intel) or for local files."
argument-hint: "<what to look up, or a link>"
allowed-tools:
  - mcp__plugin_bp-dev_tools__web_research
---

# /bp-dev:web-research

Web Research reads the open web for the user through the `web_research` tool: the exact text of any public page, searches with full page text, every page on a site, and screenshots. It is included with BuildPartner.ai. Use it for every web lookup in place of WebFetch, WebSearch, curl or a browser.

## Request

$ARGUMENTS

If the request above is empty, work out what to look up from the conversation.

## Load the tool first

The `web_research` tool is part of this plugin and is connected. Claude Code may list it by name only: if you can't call it yet, load it with ToolSearch, query `select:mcp__plugin_bp-dev_tools__web_research`, then call it. Never decide it is unavailable without calling it; its response says so if it isn't on for this account.

## Pick the action

| The user wants | Action |
| --- | --- |
| An answer and gave no link ("what does Stripe charge", "find me", "look up") | `search`, with `scrape_results: true` when you need the pages' text |
| One page or link | `scrape` with the `url` |
| The pages on a site, or the right page to read | `map` (add `search: "pricing"` to rank them), then `scrape` the one you need |
| Many pages of a site ("get all the pages", "read their blog") | `crawl` with a `limit` |
| The same fields from several pages, as a table | `extract` |
| What something would cost, or credits left | `dry_run: true` on the action, or `quota`. Both are free. Never run a real crawl to answer a cost question. |

Climb in that order: search, then scrape, then map, then crawl. Most questions end at search or scrape.

To find a site's pages, use `map`, not curl on its sitemap or llms.txt: map already reads those and returns every URL with its title.

## Rules

1. Before a crawl, a map with a high `limit`, or reading more than 5 pages, check `quota` (or `dry_run`) and tell the user if it won't fit in what is left today.
2. A crawl or extract may return an `id` instead of results: call `crawl_status` or `extract_status` with it in about 30 seconds.
3. Long pages come back in parts: pass `next` as `cursor` only if you need the rest.
4. Read, never act: never use `actions` to sign up, log in, book, buy or submit a form.
5. Quote what the page says, with its URL. Don't guess what isn't on the page.
6. Fall back to WebFetch or WebSearch only when `web_research` returns an error or a `fallback` (it isn't on for this account). Say once that you are using the built-in tools instead.
7. For X (Twitter), Instagram, YouTube or Substack links, use `social_intel`, not this. If `social_intel` fails on a Substack link, reading the page here is the fallback.
8. Call `web_research` yourself. Don't hand web reads to a subagent or to WebFetch: they can't use it, and they return a summary instead of the page.
9. Only check `quota` first for big jobs (rule 1). A single search or page read doesn't need it.
