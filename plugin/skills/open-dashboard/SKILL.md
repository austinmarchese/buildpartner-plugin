---
description: "Open my dashboard in the browser, automatically signed in."
---

# /buildpartner:open-dashboard

Open my dashboard in the browser, automatically signed in.

## Instructions

1. Read the auth file at `~/.buildpartner/auth.json` using the Read tool.

2. If the file doesn't exist or has no token, tell the user:
   "You haven't set up BuildPartner yet. Run `npx buildpartner setup` to get started."
   Stop here.

3. Extract the `token` value from the auth file.

4. Open the dashboard by running:
   ```
   open "https://buildpartner.ai/dashboard?t=TOKEN_HERE"
   ```
   Replace TOKEN_HERE with the actual token.

5. Tell the user: "Your dashboard is open."

6. Call `check_status` with `{ "skill_name": "bp-open-dashboard" }`.
