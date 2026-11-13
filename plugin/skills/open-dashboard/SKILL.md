---
name: open-dashboard
description: "Open my dashboard in the browser, automatically signed in."
---

# /buildpartner:open-dashboard

Open my dashboard in the browser, automatically signed in.

## Instructions

1. Read the auth file at `~/.buildpartner/auth.json` using the Read tool.

2. If the file doesn't exist or has no token, tell the user:
   "This machine isn't connected to a BuildPartner.ai account. If you already have one, reconnect here: https://buildpartner.ai/dashboard/login?connect=1 (verify your email and it gives you the command to paste). If you're new, run: `curl -fsSL https://buildpartner.ai/install.sh | bash`"
   Stop here.

3. Extract the `token` value from the auth file.

4. Determine the base URL:
   - If `api_base` exists in the auth file, use that (e.g. `https://dev.buildpartner.ai`)
   - Otherwise, use `https://buildpartner.ai`

5. Pick the page. With no argument it is `/dashboard`. An argument that starts with `/dashboard` (the BuildPartner.ai bar passes one when it could not open a page itself, e.g. `/dashboard?upgrade=true`) is the page to open; ignore any other argument and use `/dashboard`.

6. Open the page, signed in, by running the system's opener on `BASE_URL` + the page + `?t=TOKEN_HERE` (`&t=TOKEN_HERE` when the page already has a `?`):
   - macOS: `open "URL"`
   - Linux: `xdg-open "URL"`
   - Windows: `rundll32 url.dll,FileProtocolHandler "URL"` (keeps a link with `&` whole)

   Replace BASE_URL with the determined base URL and TOKEN_HERE with the actual token. Never show the token in your reply.

7. Tell the user: "Your dashboard is open." If the opener fails, give them the page without the token (`BASE_URL` + the page) to open themselves.
