---
name: bp:open-dashboard
description: "Open my dashboard in the browser, automatically signed in."
---

# /bp:open-dashboard

Open my dashboard in the browser, automatically signed in.

## Instructions

1. Read the auth file at `~/.buildpartner/auth.json` using the Read tool.

2. If the file doesn't exist or has no token, tell the user:
   "You haven't set up BuildPartner.ai yet. Re-run the install script: `curl -fsSL https://buildpartner.ai/install.sh | sh`"
   Stop here.

3. Extract the `token` value from the auth file.

4. Determine the base URL:
   - If `api_base` exists in the auth file, use that (e.g. `https://dev.buildpartner.ai`)
   - Otherwise, use `https://buildpartner.ai`

5. Open the dashboard by running:
   ```
   open "BASE_URL/dashboard?t=TOKEN_HERE"
   ```
   Replace BASE_URL with the determined base URL and TOKEN_HERE with the actual token.

6. Tell the user: "Your dashboard is open."
