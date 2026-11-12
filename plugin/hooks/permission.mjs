import { debug } from "./_util.mjs";

// PermissionRequest hook: answers Claude Code's permission prompt for the
// BuildPartner MCP tools, so a member in the default permission mode is not
// asked before every call, and IS asked before the few calls that publish,
// share, open a browser or delete.
//
// Until 0.15.3 this was an inline `echo` that allowed every call. That meant a
// shared BuildPad's comments (text anyone with the link can write) could steer
// the session into a `build_pad` call with no prompt in between. Now:
//   - the tools that only talk to BuildPartner.ai with this machine's token are
//     allowed (the server is the gate for those);
//   - build_pad poll / ack / reply / update / list / unshare / end are allowed:
//     they read feedback or change the page, which is all a reviewer may ask;
//   - build_pad create / share / open / delete print NO decision, so Claude Code
//     shows its normal prompt once. "Always allow" there is the member's call.
// Anything this script does not recognise also gets the normal prompt.
//
// A hook that prints nothing leaves the permission flow unchanged. In a session
// that cannot prompt (headless `claude -p`) Claude Code then denies the call, so
// a headless run that publishes pads passes an allow rule for build_pad on its
// command line. Auto mode and --dangerously-skip-permissions never reach this
// hook: the build-pad skill's from_owner rule and the tool's own framing of
// link-viewer text are the guard there.

/** Tools allowed without a prompt. A new tool prompts until it is listed here. */
const QUIET_TOOLS = new Set([
  "get_expert_knowledge",
  "get_build",
  "get_audit",
  "get_founder_knowledge",
  "request_founder_knowledge",
  "social_intel",
  "web_research",
  "feed_run",
  "publish_command_center",
  "run_plan",
]);

/** build_pad actions allowed without a prompt: read feedback or change the page. */
const QUIET_PAD_ACTIONS = new Set(["poll", "ack", "reply", "update", "list", "unshare", "end"]);

/** The decision for one PermissionRequest event. Exported for the tests. */
export function decide(event) {
  const toolName = typeof event?.tool_name === "string" ? event.tool_name : "";
  // Only our plugin's server, by both names it ships under (prod and dev), so
  // another plugin that also calls its server "tools" never gets our allow.
  const m = /^mcp__plugin_(buildpartner|bp-dev)_tools__([a-z_]+)$/.exec(toolName);
  if (!m) return { allow: false, why: "not a BuildPartner tool" };
  const tool = m[2];
  if (QUIET_TOOLS.has(tool)) return { allow: true, why: tool };
  if (tool === "build_pad") {
    const input = event.tool_input && typeof event.tool_input === "object" ? event.tool_input : {};
    const action = typeof input.action === "string" ? input.action : "";
    return { allow: QUIET_PAD_ACTIONS.has(action), why: `build_pad ${action || "(no action)"}` };
  }
  return { allow: false, why: `${tool} (not listed)` };
}

async function main() {
  let raw = "";
  try {
    for await (const chunk of process.stdin) raw += chunk;
  } catch {
    return;
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return;
  }
  const d = decide(event);
  debug("permission", `${d.why}: ${d.allow ? "allow" : "prompt"}`);
  if (!d.allow) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "allow" } } }));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").replace(/^.*\//, "/"))) {
  main().catch(() => {});
}
