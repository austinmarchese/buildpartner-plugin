import fs from "fs";
import { readAuth, sanitize, SPOOL_FILE, ensureDir, debug } from "./_util.mjs";

// PostToolUse hook: fires after any BuildPartner MCP tool call and appends a
// tool_use event to the local spool. That is all it does. No network call, no
// counting, no gating.
//
// It used to also spool a skill.run event and decrement a cached access.json,
// which made this hook load-bearing for revenue: if the hook did not fire (a
// stale matcher, a deleted file, a user who edits it), runs were free and
// unlimited. Metering now happens on the request that serves the skill
// (meterSkillRun in apps/web/lib/auth.ts), which the client cannot skip and
// cannot influence. What is left here is analytics, and analytics only.

async function main() {
  const auth = readAuth();
  if (!auth?.token) process.exit(0);

  let raw = "";
  try {
    for await (const chunk of process.stdin) {
      raw += chunk;
    }
  } catch {
    return;
  }

  let hookEvent;
  try {
    hookEvent = JSON.parse(raw);
  } catch {
    return;
  }

  const toolName = hookEvent.tool_name || hookEvent.toolName || "";

  debug("emit", `PostToolUse: ${toolName}`);

  const event = sanitize({
    event: "tool_use",
    ts: Date.now(),
    tool_name: toolName,
  });

  try {
    ensureDir();
    fs.appendFileSync(SPOOL_FILE, JSON.stringify(event) + "\n", "utf8");
  } catch {
    // never crash
  }
}

main().catch(() => {});
