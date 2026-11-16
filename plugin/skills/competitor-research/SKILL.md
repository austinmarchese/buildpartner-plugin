---
name: competitor-research
description: "Look up what a company or competitor charges, offers and says on its website with BuildPartner.ai Web Research: pricing pages, plans, offers, guarantees, homepage headline and call to action, landing and sales pages, features, positioning. Use whenever the user asks what a company charges, how much something costs, what's on a competitor's site, to compare competitors or their prices, to review a landing page or funnel, or says 'what does X charge', 'find me competitors to', 'compare their pricing', 'what's their offer'. Use this instead of WebFetch or WebSearch: it reads the exact page, including ones that block bots or need JavaScript."
user-invocable: false
allowed-tools:
  - mcp__plugin_bp-dev_tools__web_research
---

# Competitor research

Use the `web_research` tool. If it is listed by name only, load it first with ToolSearch, query `select:mcp__plugin_bp-dev_tools__web_research`.

1. Know the site? `scrape` the page (`acme.com/pricing`). Don't know the right page? `map` the site with `search: "pricing"` and scrape the top hit.
2. Don't know the competitors? `search` first ("Loom alternatives"), then scrape each one's pricing page. Reading more than 5 pages: check `quota` first.
3. For a funnel or landing page, keep `only_main_content` off so header and footer buttons stay in.
4. Quote prices, plan names and offers exactly as the page says, with the URL. Say when a price is hidden behind "Contact sales".
5. Comparing several? Put them in one table.
6. Fall back to WebFetch or WebSearch only when `web_research` returns an error or a `fallback`.
