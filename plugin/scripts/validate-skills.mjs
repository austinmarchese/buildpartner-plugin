#!/usr/bin/env node
/**
 * Validate all SKILL.md files in the plugin.
 * Checks: frontmatter exists, description field present, no duplicate names.
 * Run: node plugin/scripts/validate-skills.mjs
 */

import { readdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, "..", "skills");
let errors = 0;
const names = new Set();

for (const dir of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const skillFile = join(SKILLS_DIR, dir.name, "SKILL.md");
  let content;
  try {
    content = readFileSync(skillFile, "utf-8");
  } catch {
    console.error(`FAIL: ${dir.name}/SKILL.md not found`);
    errors++;
    continue;
  }

  // Check frontmatter
  if (!content.startsWith("---")) {
    console.error(`FAIL: ${dir.name}/SKILL.md missing frontmatter`);
    errors++;
    continue;
  }

  const fmEnd = content.indexOf("---", 3);
  if (fmEnd === -1) {
    console.error(`FAIL: ${dir.name}/SKILL.md unclosed frontmatter`);
    errors++;
    continue;
  }

  const frontmatter = content.slice(3, fmEnd);

  // Check description
  if (!frontmatter.includes("description:")) {
    console.error(`FAIL: ${dir.name}/SKILL.md missing description in frontmatter`);
    errors++;
  }

  // Check for duplicate directory names
  if (names.has(dir.name)) {
    console.error(`FAIL: duplicate skill directory name: ${dir.name}`);
    errors++;
  }
  names.add(dir.name);

  console.log(`OK: ${dir.name}`);
}

if (errors > 0) {
  console.error(`\n${errors} error(s) found`);
  process.exit(1);
} else {
  console.log(`\n${names.size} skills validated`);
}
