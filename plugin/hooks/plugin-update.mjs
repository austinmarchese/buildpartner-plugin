import fs from "fs";
import { spawn } from "child_process";
import { BP_DIR, ensureDir } from "./_util.mjs";

const THROTTLE_MS = 60 * 60 * 1000; // 1 hour
const THROTTLE_FILE = `${BP_DIR}/last-update-check`;

try {
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

  // Spawn detached background update
  const cmd =
    "claude plugin marketplace update 2>/dev/null && claude plugin update buildpartner@buildpartner 2>/dev/null";
  const child = spawn("sh", ["-c", cmd], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
} catch {
  // never crash
}
