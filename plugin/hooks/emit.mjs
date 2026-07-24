import fs from "fs";
import { readAuth, sanitize, readAccess, writeAccess, SPOOL_FILE, ensureDir, debug } from "./_util.mjs";

// PostToolUse hook: fires after any BuildPartner MCP tool call.
// 1. Spools the tool_use event locally
// 2. If the tool is get_expert_knowledge, also spools a skill.run event (for usage counting)
// 3. Decrements local access counter for mid-session gating

// Tools that count as a skill run (one shared free-tier meter). Each maps to
// the skill name recorded for the usage event.
const SKILL_TOOLS = {
  "mcp__plugin_buildpartner_tools__get_expert_knowledge": "bp:expert-advice",
  "mcp__plugin_buildpartner_tools__get_build": "bp:build",
};

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

  // 2. If this is a skill-counting tool, also spool a skill.run event
  const skillName = SKILL_TOOLS[toolName];
  if (skillName) {
    const skillEvent = sanitize({
      event: "skill.run",
      ts: Date.now(),
      skill_name: skillName,
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
