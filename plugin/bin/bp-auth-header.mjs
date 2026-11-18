// Prints the headers for the hosted MCP entry as ONE JSON object on stdout.
//
//   signed in:  {"Authorization":"Bearer <sk_ token>","X-BuildPartner-Plugin":"1"}
//   otherwise:  {"X-BuildPartner-Plugin":"1"}
//
// "Signed in" means ~/.buildpartner/auth.json holds a string token that starts
// with sk_ (the same file the tools server reads). A missing, unreadable or
// malformed file counts as signed out. Always exits 0. The token goes to stdout
// and nowhere else: no stderr, no log, no file. No network.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PLUGIN_HEADER = "X-BuildPartner-Plugin";

function readToken() {
  try {
    const raw = readFileSync(join(homedir(), ".buildpartner", "auth.json"), "utf8").replace(/^﻿/, "");
    const token = JSON.parse(raw)?.token;
    return typeof token === "string" && token.startsWith("sk_") ? token : null;
  } catch {
    return null;
  }
}

const token = readToken();
const headers = token ? { Authorization: `Bearer ${token}`, [PLUGIN_HEADER]: "1" } : { [PLUGIN_HEADER]: "1" };
process.stdout.write(JSON.stringify(headers) + "\n");
