// SessionStart hook: sign a fresh install in from its install code.
//
// The install command on buildpartner.ai can carry a one-time code:
//   claude plugin install <plugin> --marketplace <catalog> --config install_code=<code>
// Claude Code hands that option to every hook as CLAUDE_PLUGIN_OPTION_INSTALL_CODE
// (userConfig in .claude-plugin/plugin.json). On the first session start this
// trades the code for the login at POST /api/buildpartner/login/poll, the same
// route the email login uses, which hands the login out exactly once.
//
// Does nothing when no code was given. When this machine already has a login (an
// existing member who ran the /mods setup prompt) the code is still used up, so
// /mods/setup sees the plugin connected and moves on instead of waiting until the
// prompt expires; the login already on this machine stays as it is. Never crashes
// Claude Code.

import fs from "fs";
import path from "path";
import { AUTH_FILE, BP_DIR, ensureDir, readAuth, debug } from "./_util.mjs";

const PROD_BASE = "https://www.buildpartner.ai";

/** Which server this copy of the plugin belongs to: bp-dev talks to dev. */
function apiBase() {
  if (process.env.BP_API_BASE) return process.env.BP_API_BASE;
  try {
    const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
    const manifest = JSON.parse(fs.readFileSync(path.join(root, ".claude-plugin", "plugin.json"), "utf8"));
    if (manifest.name === "bp-dev") return "https://dev.buildpartner.ai";
  } catch {}
  return PROD_BASE;
}

try {
  const code = (process.env.CLAUDE_PLUGIN_OPTION_INSTALL_CODE || "").trim();
  if (!code) process.exit(0);
  const hasLogin = !!readAuth()?.token;
  if (!/^[a-f0-9]{64}$/.test(code)) {
    debug("install-code", "install code has the wrong shape, skipped");
    process.exit(0);
  }

  const base = apiBase();
  const res = await fetch(`${base}/api/buildpartner/login/poll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login_id: code }),
    signal: AbortSignal.timeout(6000),
  });
  const data = await res.json().catch(() => ({}));
  if (data.status !== "approved" || !data.token) {
    debug("install-code", `install code not accepted (${data.status || res.status})`);
    process.exit(0);
  }
  // Already signed in here: the code is used up (the setup page goes on), the login stays.
  if (hasLogin) {
    debug("install-code", "already signed in on this machine; install code used up, login kept");
    process.exit(0);
  }

  ensureDir();
  const auth = {
    email: data.email,
    username: data.username,
    token: data.token,
    profile_url: data.profile_url,
    created_at: new Date().toISOString(),
    // Same rule as `buildpartner login`: only non-prod persists its server.
    ...(base === PROD_BASE ? {} : { api_base: base }),
  };
  fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2) + "\n", { mode: 0o600 });
  debug("install-code", `signed in as ${data.email}`);

  // Same event install.sh sends, so the dashboard's install step ticks.
  await fetch(`${base}/api/buildpartner/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.token}` },
    body: JSON.stringify({ events: [{ event: "install.completed" }] }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => {});
} catch (err) {
  try { debug("install-code", `error: ${err?.message || err}`); } catch {}
}
process.exit(0);
