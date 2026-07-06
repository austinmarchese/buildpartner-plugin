---
name: bp:claude
description: "Switch back from eco mode to the user's Claude subscription. Use when the user says 'back to Claude', 'switch back', 'turn off eco', or their Claude limit has reset."
---

# /bp:claude

Disarm eco mode. The user's next Claude Code session runs on their normal Claude subscription again.

## Steps

1. Read `~/.claude/settings.json`. If it has no `env.ANTHROPIC_BASE_URL` containing `/api/eco`, tell the user "You're already on your Claude subscription." and STOP.

2. Back up first:
   ```
   cp ~/.claude/settings.json ~/.buildpartner/settings-backup.json
   ```

3. Edit `~/.claude/settings.json`: remove EXACTLY these five keys from the `env` object, leaving every other key (in `env` and elsewhere) untouched. If `env` becomes empty, remove the `env` key itself.

   `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_DEFAULT_OPUS_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`

4. Validate: run `jq . ~/.claude/settings.json > /dev/null`. If jq errors, restore the backup (`cp ~/.buildpartner/settings-backup.json ~/.claude/settings.json`), tell the user nothing was changed, and STOP.

5. Tell the user exactly this:

   > ☀️ Back to Claude. To activate it:
   > 1. Type `/exit`
   > 2. Run `claude -c`
   >
   > You'll land back in this conversation on your Claude subscription. No login needed, your existing Claude sign-in still works.
