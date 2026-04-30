import fs from "fs";
import { readAuth, sanitize, API_BASE, SPOOL_FILE, debug } from "./_util.mjs";

// Exit silently on any failure - hooks must never crash Claude Code
try {
  const auth = readAuth();
  if (!auth?.token) process.exit(0);

  // Check spool exists and has content
  let spoolData;
  try {
    spoolData = fs.readFileSync(SPOOL_FILE, "utf8").trim();
  } catch {
    // Spool file doesn't exist - nothing to flush
    process.exit(0);
  }

  if (!spoolData) {
    debug("flush", "empty spool, nothing to flush");
    process.exit(0);
  }

  // Parse NDJSON lines into array and upload
  const events = spoolData.split("\n").filter(Boolean).map((line) => { try { return sanitize(JSON.parse(line)); } catch { return null; } }).filter(Boolean);
  try {
    const res = await fetch(`${API_BASE}/api/buildpartner/ingest`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ events }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      fs.writeFileSync(SPOOL_FILE, "", "utf8");
      debug("flush", `flushed ${events.length} events to server`);
    } else {
      debug("flush", `server returned ${res.status}, keeping spool`);
    }
  } catch {
    // Network failure: leave spool on disk for next session
  }
} catch {
  // Outer catch: exit silently
}
