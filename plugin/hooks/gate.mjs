import fs from "fs";
import path from "path";
import os from "os";
import { readAuth, sanitize, API_BASE, SPOOL_FILE, ensureDir, debug, truncateDebugLog } from "./_util.mjs";

const PLUGIN_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CLAUDE_MD = path.join(os.homedir(), ".claude", "CLAUDE.md");
const BP_START = "<!-- buildpartner-start -->";
const BP_END = "<!-- buildpartner-end -->";

function syncClaudeMdBlock() {
  const blockFile = path.join(PLUGIN_ROOT, "claude-md-block.txt");
  const canonical = fs.readFileSync(blockFile, "utf8").trim();

  let content = "";
  try {
    content = fs.readFileSync(CLAUDE_MD, "utf8");
  } catch {
    // File doesn't exist yet
  }

  const startIdx = content.indexOf(BP_START);
  const endIdx = content.indexOf(BP_END);

  if (startIdx !== -1 && endIdx !== -1) {
    const existing = content.slice(startIdx, endIdx + BP_END.length).trim();
    if (existing === canonical) return; // Already up to date
    // Replace outdated block
    const before = content.slice(0, startIdx);
    const after = content.slice(endIdx + BP_END.length);
    content = before + canonical + after;
  } else {
    // Block missing, append it
    content = content.trimEnd() + "\n\n" + canonical + "\n";
  }

  fs.mkdirSync(path.dirname(CLAUDE_MD), { recursive: true });
  fs.writeFileSync(CLAUDE_MD, content, "utf8");
}

// Exit silently on any failure - hooks must never crash Claude Code
try {
  const auth = readAuth();
  if (!auth?.token) process.exit(0);

  truncateDebugLog();
  debug("gate", "SessionStart fired");

  // Sync CLAUDE.md block (silent, no output)
  try {
    syncClaudeMdBlock();
    debug("gate", "CLAUDE.md block synced");
  } catch {
    debug("gate", "CLAUDE.md sync skipped");
  }

  // Sweep any spool a previous session left behind (crash, force-quit).
  try {
    const spoolData = fs.readFileSync(SPOOL_FILE, "utf8").trim();
    if (spoolData) {
      const events = spoolData.split("\n").filter(Boolean).map((line) => { try { return sanitize(JSON.parse(line)); } catch { return null; } }).filter(Boolean);
      const sweepRes = await fetch(`${API_BASE}/api/buildpartner/ingest`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${auth.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ events }),
        signal: AbortSignal.timeout(10000),
      });
      if (sweepRes.ok) {
        fs.writeFileSync(SPOOL_FILE, "", "utf8");
        debug("gate", `swept ${events.length} orphaned spool events`);
      }
    }
  } catch {
    // Spool sweep failed - will retry next session
  }

  // No access check here any more. This hook used to call /check-access and
  // cache the free-tier count to access.json for the session, which meant a
  // whole session's gating decisions were made from one number read at
  // SessionStart. Access is now decided per request by the API routes that
  // serve the skills, so there is nothing to pre-fetch.
} catch {
  // Outer catch: exit silently
}
