// Pure planning for the hourly plugin auto-update. No I/O: plugin-update.mjs
// reads the disk and passes what it found in, this file only builds strings.

const VERSION = /^\d+(\.\d+)*$/;

const quote = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;

function compareVersionsDesc(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pb[i] || 0) - (pa[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// Dotted numeric version names only, newest first.
export function newestFirst(names) {
  return names.filter((n) => VERSION.test(n)).sort(compareVersionsDesc);
}

// Where to look for `claude` after PATH, in order. The Claude Desktop app keeps
// its own copy under Application Support (macOS only), at
// <version>/<build>/claude.app/Contents/MacOS/claude, and older ones at <version>/claude.
export function claudeCandidates({ home, platform, desktopVersions, desktopBuilds }) {
  const list = [];
  const h = home ? String(home) : "";
  if (platform === "win32") {
    if (h) list.push(`${h}/.local/bin/claude.exe`, `${h}/.local/bin/claude`);
  } else {
    if (h) list.push(`${h}/.local/bin/claude`);
    list.push("/opt/homebrew/bin/claude", "/usr/local/bin/claude");
  }
  if (platform === "darwin" && h) {
    const root = `${h}/Library/Application Support/Claude/claude-code`;
    for (const v of newestFirst(desktopVersions || [])) {
      const builds = ((desktopBuilds || {})[v] || []).filter((b) => !b.startsWith(".")).sort();
      for (const b of builds) list.push(`${root}/${v}/${b}/claude.app/Contents/MacOS/claude`);
      list.push(`${root}/${v}/claude`);
    }
  }
  return [...new Set(list)];
}

// The sh text the hook runs. Every step is independent (`;`), so one failing
// marketplace or plugin never skips the next. It never runs a nameless
// `plugin marketplace update`, `plugin install` or `marketplace add`.
export function updateCommand(candidates) {
  const quoted = candidates.map(quote).join(" ");
  const resolve =
    'c=$(command -v claude 2>/dev/null); ' +
    `[ -n "$c" ] || for p in ${quoted}; do [ -x "$p" ] && { c="$p"; break; }; done; ` +
    '[ -n "$c" ] || exit 0;';
  const has = (id) => `"$c" plugin list 2>/dev/null | grep -q '${id}'`;
  const steps = [
    '"$c" plugin marketplace update buildpartner 2>/dev/null;',
    '"$c" plugin update buildpartner@buildpartner 2>/dev/null;',
    `if ${has("buildpartner-team@buildpartner")}; then "$c" plugin update buildpartner-team@buildpartner 2>/dev/null; fi;`,
    `if ${has("bp-dev@bp-dev")} || ${has("bp-dev-team@bp-dev")}; then "$c" plugin marketplace update bp-dev 2>/dev/null; ` +
      `if ${has("bp-dev@bp-dev")}; then "$c" plugin update bp-dev@bp-dev 2>/dev/null; fi; ` +
      `if ${has("bp-dev-team@bp-dev")}; then "$c" plugin update bp-dev-team@bp-dev 2>/dev/null; fi; fi;`,
  ];
  return `${resolve} ${steps.join(" ")}`;
}
