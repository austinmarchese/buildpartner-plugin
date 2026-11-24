import fs from "fs";
import { spawn, spawnSync } from "child_process";
import { BP_DIR, ensureDir } from "./_util.mjs";
import { claudeCandidates, newestFirst, updateCommand } from "./update-plan.mjs";

const THROTTLE_MS = 60 * 60 * 1000; // 1 hour
const THROTTLE_FILE = `${BP_DIR}/last-update-check`;
// A member who wants to pin their version (e.g. a client-work machine) creates
// this file. While it exists the plugin never updates itself; they update by
// hand with `claude plugin marketplace update buildpartner` then
// `claude plugin update buildpartner@buildpartner`. Delete it to resume.
const PIN_FILE = `${BP_DIR}/no-auto-update`;

try {
  if (fs.existsSync(PIN_FILE)) process.exit(0);

  // Check throttle
  if (fs.existsSync(THROTTLE_FILE)) {
    const stat = fs.statSync(THROTTLE_FILE);
    if (Date.now() - stat.mtimeMs < THROTTLE_MS) {
      process.exit(0);
    }
  }

  // Write timestamp
  ensureDir();
  fs.writeFileSync(THROTTLE_FILE, String(Date.now()), "utf8");

  // Spawn detached background update.
  //
  // update-plan.mjs builds the command. Team and dev plugins are updated only
  // when already installed (grep-gated), never added, so a non-org install
  // stays byte-identical. Our steps are independent: a failing marketplace
  // never skips the plugin update.
  //
  // `claude` is resolved rather than trusted to be on PATH. A Claude Code
  // started from the Claude Desktop app does not get the member's shell PATH,
  // and a Desktop-only Mac keeps its own copy under Application Support.
  // update-plan.mjs lists those places. If none exists, do nothing: the hook
  // must never fail a session.
  const home = process.env.HOME || "";
  let desktopVersions = [];
  const desktopBuilds = {};
  if (process.platform === "darwin") {
    const root = `${home}/Library/Application Support/Claude/claude-code`;
    try {
      desktopVersions = fs.readdirSync(root);
    } catch {
      desktopVersions = [];
    }
    for (const v of newestFirst(desktopVersions)) {
      try {
        desktopBuilds[v] = fs.readdirSync(`${root}/${v}`);
      } catch {
        // No builds known for this version; only its legacy path is tried.
      }
    }
  }
  const cmd = updateCommand(
    claudeCandidates({ home, platform: process.platform, desktopVersions, desktopBuilds }),
  );
  // Test seam: BP_UPDATE_WAIT=1 waits for the child so a test can read its log.
  if (process.env.BP_UPDATE_WAIT === "1") {
    spawnSync("sh", ["-c", cmd], { stdio: "ignore" });
    process.exit(0);
  }
  const child = spawn("sh", ["-c", cmd], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
} catch {
  // never crash
}
