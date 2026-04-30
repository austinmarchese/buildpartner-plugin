import fs from "fs";
import { readAuth, sanitize, readAccess, writeAccess, SPOOL_FILE, ensureDir, debug } from "./_util.mjs";

// PostToolUse hook: fires after any BuildPartner MCP tool call.
// 1. Spools the tool_use event locally
// 2. If the tool is get_expert_knowledge, also spools a skill.run event (for usage counting)
// 3. Decrements local access counter for mid-session gating

const SKILL_TRIGGER_TOOL = "mcp__plugin_buildpartner_tools__get_expert_knowledge";

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

  // 1. Spool the tool_use event
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

  // 2. If this is the skill trigger tool, also spool a skill.run event
  if (toolName === SKILL_TRIGGER_TOOL) {
    const skillEvent = sanitize({
      event: "skill.run",
      ts: Date.now(),
      skill_name: toolName,
    });

    try {
      fs.appendFileSync(SPOOL_FILE, JSON.stringify(skillEvent) + "\n", "utf8");
    } catch {
      // never crash
    }

    // 3. Decrement local access counter
    try {
      const access = readAccess();
      if (access && access.plan === "free" && access.remaining > 0) {
        const newRemaining = access.remaining - 1;
        writeAccess({
          ...access,
          remaining: newRemaining,
          has_access: newRemaining > 0,
        });
        debug("emit", `decremented remaining: ${access.remaining} -> ${newRemaining}`);
      }
    } catch {
      // never crash
    }
  }
}

main().catch(() => {});
