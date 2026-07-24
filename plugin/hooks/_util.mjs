import fs from "fs";
import path from "path";
import os from "os";

export const BP_DIR = path.join(os.homedir(), ".buildpartner");
export const AUTH_FILE = path.join(BP_DIR, "auth.json");
export const ACCESS_FILE = path.join(BP_DIR, "access.json");
export const SPOOL_FILE = path.join(BP_DIR, "spool.ndjson");
function getApiBase() {
  if (process.env.BP_API_BASE) return process.env.BP_API_BASE;
  try {
    const auth = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8").replace(/^\uFEFF/, ""));
    if (auth.api_base) return auth.api_base;
  } catch {}
  return "https://www.buildpartner.ai";
}
export const API_BASE = getApiBase();

export function ensureDir() {
  fs.mkdirSync(BP_DIR, { recursive: true });
}

export function readAuth() {
  try {
    return JSON.parse(fs.readFileSync(AUTH_FILE, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

export function readAccess() {
  try {
    return JSON.parse(fs.readFileSync(ACCESS_FILE, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

export function writeAccess(access) {
  ensureDir();
  fs.writeFileSync(ACCESS_FILE, JSON.stringify(access), "utf8");
}

const DEBUG_LOG = path.join(BP_DIR, "debug.log");
const MAX_LOG_SIZE = 256 * 1024; // 256KB cap

/** Append a timestamped line to ~/.buildpartner/debug.log. Truncated by gate.mjs on SessionStart. */
export function debug(hook, msg) {
  try {
    ensureDir();
    const ts = new Date().toISOString().slice(11, 23);
    fs.appendFileSync(DEBUG_LOG, `[${ts}] ${hook}: ${msg}\n`, "utf8");
  } catch {
    // never crash
  }
}

/** Truncate debug.log if it exceeds 256KB. Call once per session (from gate.mjs). */
export function truncateDebugLog() {
  try {
    const stat = fs.statSync(DEBUG_LOG);
    if (stat.size > MAX_LOG_SIZE) {
      const content = fs.readFileSync(DEBUG_LOG, "utf8");
      fs.writeFileSync(DEBUG_LOG, content.slice(content.length / 2), "utf8");
    }
  } catch {
    // file doesn't exist yet, that's fine
  }
}

export function sanitize(event) {
  const out = {};
  if (event.event !== undefined) out.event = event.event;
  if (event.ts !== undefined) out.ts = event.ts;
  if (event.tool_name !== undefined) out.tool_name = event.tool_name;
  if (event.skill_name !== undefined) out.skill_name = event.skill_name;
  if (event.subagent_type !== undefined) out.subagent_type = event.subagent_type;
  if (event.exit_code !== undefined) out.exit_code = event.exit_code;
  if (event.error_class !== undefined) out.error_class = event.error_class;
  if (typeof event.prompt_length === "number") out.prompt_length = event.prompt_length;
  return out;
}
