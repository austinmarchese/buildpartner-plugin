---
name: bp:status
description: "Show whether this setup is in eco mode or Claude mode, and how many BuildPartner.ai eco credits are left. Use when the user asks 'what mode am I in', 'how many credits do I have left', or 'bp status'."
---

# /bp:status

Report the current mode and eco credit balance.

## Steps

1. Check mode: read `~/.claude/settings.json`. Eco mode is ON if `env.ANTHROPIC_BASE_URL` exists and contains `/api/eco`, otherwise OFF. Note: a mode change only takes effect after a restart, so mention that the current session reflects the mode at launch.

2. Read the token and optional `api_base` from `~/.buildpartner/auth.json` (default base URL `https://www.buildpartner.ai`), then fetch credits:
   ```
   curl -sS "BASE_URL/api/buildpartner/delegate-usage" -H "Authorization: Bearer TOKEN"
   ```

3. Report conversationally, for example:

   > You're in 🌱 eco mode (budget models through BuildPartner.ai). You have 14.2M of 20M eco credits left this month. Run /bp:claude to switch back to your Claude subscription.

4. If credits used is above 80% of the cap, add: "You're close to your eco cap for this period. See details or upgrade with /bp:open-dashboard."

5. If auth.json is missing, tell the user to re-run the install script (`curl -fsSL https://buildpartner.ai/install.sh | sh`).
