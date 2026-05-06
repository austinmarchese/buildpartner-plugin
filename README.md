# BuildPartner.ai

Your AI build partner for [Claude Code](https://claude.com/claude-code). Expert guidance, coaching, and personalized training, delivered as a Claude Code plugin.

- Website: [buildpartner.ai](https://buildpartner.ai)
- Plugin source: [austinmarchese/buildpartner-plugin](https://github.com/austinmarchese/buildpartner-plugin)
- Marketplace: `austinmarchese/buildpartner-plugin`

## Install

```
claude plugin marketplace add austinmarchese/buildpartner-plugin
claude plugin install buildpartner@buildpartner
```

The first time Claude Code starts after install, BuildPartner creates an account, opens your dashboard, and registers the MCP server.

## Skills

BuildPartner ships three skills, all under the `bp:` namespace.

### `/bp:expert-advice`
Ask any question, get matched to the right expert framework. Covers pricing, content, launch, AI automation, marketing, sales, product strategy, and more. Use it whenever a decision would benefit from a battle-tested framework instead of a generic answer.

### `/bp:improve-system`
Keeps your Claude Code setup sharp. Reviews your sessions, captures learnings, audits for rot, and recaps recent work. Run it weekly to keep your CLAUDE.md, skills, and workflows from drifting.

### `/bp:open-dashboard`
Opens your BuildPartner dashboard in the browser, automatically signed in. Shortcut to your profile, skill usage, quests, and account settings.

## Dashboard

Your [dashboard](https://buildpartner.ai/dashboard) tracks:

- Skill usage and quest progress
- Your AI profile, used to personalize expert advice
- Session activity and recaps
- Account, billing, and subscription

A friendly reminder to run `/bp:improve-system` fires on Mondays and Fridays at session start.

## How it works

The plugin combines four pieces:

| Piece | Role |
|---|---|
| Skills (`plugin/skills/`) | Slash commands that route to the right framework or workflow |
| MCP server (`buildpartner` on npm) | Exposes `get_expert_knowledge` so skills can pull expert frameworks and personal context |
| Hooks (`plugin/hooks/`) | Session-boundary gating, usage flush, plugin auto-update, weekly reminders |
| Web app ([buildpartner.ai](https://buildpartner.ai)) | Dashboard, account, payments, expert knowledge API |

The MCP server is published as the `buildpartner` npm package and started by Claude Code via `npx -y buildpartner@latest serve`.

## Pricing

A free tier covers your first uses of each skill. After that, upgrade from the dashboard to keep going. Billing runs through Stripe. Cancel any time from the dashboard.

## Update

```
claude plugin marketplace update
claude plugin update buildpartner@buildpartner
```

The plugin also checks for updates at session start and end.

## Uninstall

```
claude plugin uninstall buildpartner@buildpartner
```

## Support

- Questions, bugs, feature requests: [github.com/austinmarchese/buildpartner-plugin/issues](https://github.com/austinmarchese/buildpartner-plugin/issues)
- Email: hello@buildpartner.ai

## License

MIT
