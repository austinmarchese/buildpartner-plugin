---
name: bp:eco
description: "Switch this Claude Code setup to eco mode: budget models through BuildPartner.ai, so you can keep working when you hit your Claude usage limit. Use when the user says 'eco mode', 'switch to eco', 'keep going cheap', or mentions ANYTHING about Claude usage limits: 'I hit my limit', 'I'm about to hit my limit', 'approaching my limit', 'usage warning', 'almost out of usage', 'limit resets at', 'rate limited', or they paste a Claude Code limit warning. Also proactively SUGGEST this skill (do not run it unasked) whenever the user complains about running out of Claude usage or asks how to keep working past their limit."
---

# /bp:eco

Arm eco mode. The user's next Claude Code session runs on BuildPartner.ai budget models instead of their Claude subscription. Their Claude login is untouched and their conversation carries over.

## Steps

1. Read `~/.buildpartner/auth.json`. If missing or no `token`, tell the user to re-run the install script (`curl -fsSL https://buildpartner.ai/install.sh | sh`) and STOP.

2. Determine the base URL: `api_base` from auth.json if present, otherwise `https://www.buildpartner.ai`.

3. Back up settings before touching them:
   ```
   cp ~/.claude/settings.json ~/.buildpartner/settings-backup.json 2>/dev/null || true
   ```

4. Read `~/.claude/settings.json` (treat a missing file as `{}`). Merge EXACTLY these five keys into its `env` object, replacing TOKEN and BASE_URL with the real values. Preserve every other key in the file. Create the `env` object if absent. Write the file.

   ```json
   {
     "ANTHROPIC_BASE_URL": "BASE_URL/api/eco",
     "ANTHROPIC_AUTH_TOKEN": "TOKEN",
     "ANTHROPIC_DEFAULT_OPUS_MODEL": "bp-eco",
     "ANTHROPIC_DEFAULT_SONNET_MODEL": "bp-eco",
     "ANTHROPIC_DEFAULT_HAIKU_MODEL": "bp-eco-fast"
   }
   ```

   NEVER touch any other key. NEVER touch `apiKeyHelper`, `ANTHROPIC_API_KEY`, or any credentials file.

5. Validate the result: run `jq -e '.env.ANTHROPIC_BASE_URL' ~/.claude/settings.json`. If jq errors (invalid JSON), restore the backup (`cp ~/.buildpartner/settings-backup.json ~/.claude/settings.json`), tell the user something went wrong and nothing was changed, and STOP.

6. Tell the user exactly this:

   > 🌱 Eco mode is armed. To activate it:
   > 1. Type `/exit`
   > 2. Run `claude -c`
   >
   > You'll land back in this exact conversation, running on budget models. Your Claude subscription and login are untouched. When your Claude limit resets, run `/bp:claude` to switch back.
