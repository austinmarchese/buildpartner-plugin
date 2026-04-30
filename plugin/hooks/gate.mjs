import fs from "fs";
import path from "path";
import os from "os";
import { readAuth, sanitize, writeAccess, API_BASE, SPOOL_FILE, ensureDir, debug, truncateDebugLog } from "./_util.mjs";

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

  // Sweep orphaned spool BEFORE checking access so the DB count is current
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

  // Check access and cache the result (after sweep so DB reflects flushed usage)
  try {
    const res = await fetch(`${API_BASE}/api/buildpartner/check-access`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      writeAccess({ has_access: data.has_access, remaining: data.remaining, plan: data.plan });
      debug("gate", `access cached: plan=${data.plan} remaining=${data.remaining} has_access=${data.has_access}`);
    } else {
      debug("gate", `check-access failed: ${res.status}`);
    }
  } catch {
    // Network failure: keep old cached access (graceful degradation)
  }
} catch {
  // Outer catch: exit silently
}
