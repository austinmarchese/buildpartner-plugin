#!/bin/bash
# BuildPartner.ai Plugin Installer
#
# Production (from GitHub marketplace):
#   curl -fsSL https://buildpartner.ai/install.sh | bash
#
# Local dev (from local repo clone):
#   curl -fsSL https://buildpartner.ai/install.sh | bash -s -- --local
#   OR: ./plugin/scripts/install.sh --local
#
# Installs the BuildPartner plugin into Claude Code via the marketplace system.

# Wrap the whole script in a { } block so `curl ... | sh` reads the entire file
# off the pipe BEFORE executing any of it. Without this, a child process that
# reads stdin (the nested Claude Code installer, `claude plugin ...`) consumes
# the not-yet-parsed rest of the piped script and execution dies mid-run.
# Draining the pipe up front makes that impossible. Matching } at EOF.
{

set -e

# Colors
ORANGE='\033[38;2;228;112;37m'
GREEN='\033[32m'
YELLOW='\033[33m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

BP_DIR="$HOME/.buildpartner"
AUTH_FILE="$BP_DIR/auth.json"
API_BASE="${BP_API_BASE:-https://www.buildpartner.ai}"
MARKETPLACE_NAME="buildpartner"
PLUGIN_NAME="buildpartner"

# Parse flags
LOCAL_MODE=false
PROVIDED_TOKEN=""
DEBUG=false
FORCE_TEAM=false
ORG_SLUG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --local) LOCAL_MODE=true ;;
    --debug) DEBUG=true ;;
    --team) FORCE_TEAM=true ;;
    --api=*) API_BASE="${1#--api=}" ;;
    --api) API_BASE="$2"; shift ;;
    --token=*) PROVIDED_TOKEN="${1#--token=}" ;;
    --token) PROVIDED_TOKEN="$2"; shift ;;
  esac
  shift
done

debug() {
  if [ "$DEBUG" = true ]; then
    echo -e "  ${DIM}[debug] $1${RESET}"
  fi
}

API_DOMAIN=$(echo "$API_BASE" | sed 's|https\?://||; s|/$||')

# Include api_base in auth.json when not production
if echo "$API_BASE" | grep -q "www\.buildpartner\.ai"; then
  AUTH_API_LINE=""
else
  AUTH_API_LINE="\"api_base\": \"$API_BASE\","
fi
debug "API_BASE=$API_BASE"
debug "API_DOMAIN=$API_DOMAIN"
debug "LOCAL_MODE=$LOCAL_MODE"
debug "TOKEN=${PROVIDED_TOKEN:+set (${#PROVIDED_TOKEN} chars)}"

echo ""
echo -e "${ORANGE}  ╭─────────────────────────────────────────╮${RESET}"
echo -e "${ORANGE}  │  BuildPartner.ai - Your AI Build Partner │${RESET}"
echo -e "${ORANGE}  ╰─────────────────────────────────────────╯${RESET}"
echo ""

if [ "$LOCAL_MODE" = true ]; then
  echo -e "  ${DIM}Mode: local dev${RESET}"
else
  echo -e "  ${DIM}Mode: production${RESET}"
fi
echo ""

# ── Check Claude Code (installing it if missing) ──────────────────
# Anthropic's native installer puts the binary in ~/.local/bin, which macOS zsh
# does NOT have on PATH by default. It prints the fix but never applies it, so
# we add it for this run and persist it to the user's shell rc. Skipping that
# would mean the install succeeds here and their next terminal says
# "claude: command not found" on the very last step.
LOCAL_BIN="$HOME/.local/bin"

path_has_local_bin() {
  case ":$PATH:" in
    *":$LOCAL_BIN:"*) return 0 ;;
    *) return 1 ;;
  esac
}

use_local_bin() {
  path_has_local_bin || { PATH="$LOCAL_BIN:$PATH"; export PATH; }
}

# Append the PATH export to the rc of the user's login shell, once. Guarded by a
# marker so re-running the installer never duplicates the line, and skipped
# entirely if they already reference .local/bin themselves.
persist_local_bin() {
  rc=""
  case "$(basename "${SHELL:-}")" in
    zsh) rc="$HOME/.zshrc" ;;
    bash) if [ -f "$HOME/.bash_profile" ]; then rc="$HOME/.bash_profile"; else rc="$HOME/.bashrc"; fi ;;
  esac
  [ -n "$rc" ] || return 0
  if [ -f "$rc" ] && grep -q "buildpartner-path\|\.local/bin" "$rc" 2>/dev/null; then
    return 0
  fi
  {
    echo ""
    echo "# buildpartner-path (added by the BuildPartner.ai installer)"
    echo 'export PATH="$HOME/.local/bin:$PATH"'
  } >> "$rc" 2>/dev/null || return 0
  echo -e "  ${GREEN}✓ Added ~/.local/bin to PATH in $(basename "$rc")${RESET}"
}

use_local_bin

if ! command -v claude >/dev/null 2>&1; then
  echo -e "  ${DIM}Claude Code not found. Installing it for you (from Anthropic)...${RESET}"
  # Download first, then run from a file. Piping Anthropic's installer straight
  # into `bash` would give it OUR stdin, and `bash < /dev/null` would starve it
  # of the script itself. A temp file sidesteps both.
  CC_INSTALLER="$(mktemp)"
  if curl -fsSL https://claude.ai/install.sh -o "$CC_INSTALLER" 2>/dev/null &&
     bash "$CC_INSTALLER" </dev/null; then
    use_local_bin
    persist_local_bin
  fi
  rm -f "$CC_INSTALLER"
fi

if ! command -v claude >/dev/null 2>&1; then
  echo -e "  ${YELLOW}✗ Claude Code could not be installed automatically${RESET}"
  echo ""
  echo "  Install it manually, then re-run this command:"
  echo -e "    ${ORANGE}curl -fsSL https://claude.ai/install.sh | bash${RESET}"
  echo ""
  echo -e "  ${DIM}Docs: https://claude.ai/code${RESET}"
  exit 1
fi
echo -e "  ${GREEN}✓ Claude Code found${RESET}"

# ── Check Claude Code version ────────────────────────────────────
# The plugin is served as a zip from a hosted catalog (no Git needed, see Step
# 2). Claude Code reads zip ("archive") plugins from 2.1.224 on. Older copies
# update themselves with `claude update`; if that fails we fall back to the Git
# catalog below rather than stopping.
CC_MIN_VERSION="2.1.224"

# True when version $1 >= $2. Plain numeric sort, so it works with BSD sort on
# older macOS that has no `sort -V`.
version_ge() {
  [ "$(printf '%s\n%s\n' "$1" "$2" | sort -t. -k1,1n -k2,2n -k3,3n | head -1)" = "$2" ]
}

claude_version() { claude --version 2>/dev/null | awk '{print $1}'; }

CC_VERSION="$(claude_version)"
CC_SUPPORTS_ZIP=true
if [ -n "$CC_VERSION" ] && ! version_ge "$CC_VERSION" "$CC_MIN_VERSION"; then
  echo -e "  ${DIM}Updating Claude Code (${CC_VERSION} is older than BuildPartner needs)...${RESET}"
  claude update </dev/null >/dev/null 2>&1 || true
  CC_VERSION="$(claude_version)"
  if [ -n "$CC_VERSION" ] && ! version_ge "$CC_VERSION" "$CC_MIN_VERSION"; then
    CC_SUPPORTS_ZIP=false
  fi
fi
debug "claude version=$CC_VERSION supports_zip=$CC_SUPPORTS_ZIP"

# ── Check Node.js (installing it if missing) ─────────────────────
# Node runs the plugin's tools server (`npx buildpartner serve`) and its hooks,
# and this script uses it to read server replies. Members who never installed
# it used to hit "node: command not found" right after typing their email.
# Instead of sending them to nodejs.org, download the official Node LTS
# (checksum-verified, no admin password) into ~/.local/share/buildpartner/node.
# Not under ~/.buildpartner: uninstall.sh backs that folder up and deletes it,
# and this is 130 MB that uninstall.sh itself still needs node for.
#
# PATH placement matters. When the member has no Node at all, ours goes at the
# END of PATH, so a Node they install later (brew, nvm) wins and we never shadow
# a developer's toolchain. When their Node is too old, ours must go FIRST, or
# the hooks and the tools server keep running on the old one.
NODE_MIN_MAJOR=18
NODE_LINE="latest-v24.x"
BP_NODE_DIR="$HOME/.local/share/buildpartner/node"

node_ok() {
  command -v node >/dev/null 2>&1 || return 1
  major="$(node -v 2>/dev/null | sed 's/^v//; s/\..*//')"
  [ -n "$major" ] && [ "$major" -ge "$NODE_MIN_MAJOR" ] 2>/dev/null
}

install_private_node() {
  case "$(uname -s)" in Darwin) os=darwin ;; Linux) os=linux ;; *) return 1 ;; esac
  case "$(uname -m)" in arm64|aarch64) arch=arm64 ;; x86_64|amd64) arch=x64 ;; *) return 1 ;; esac
  base="https://nodejs.org/dist/$NODE_LINE"
  sums="$(curl -fsSL "$base/SHASUMS256.txt" 2>/dev/null)" || return 1
  line="$(printf '%s\n' "$sums" | grep " node-v[0-9.]*-$os-$arch\.tar\.gz\$" | head -1)"
  [ -n "$line" ] || return 1
  want="${line%% *}"
  file="${line##* }"
  tmp="$(mktemp -d)"
  if ! curl -fsSL "$base/$file" -o "$tmp/$file"; then rm -rf "$tmp"; return 1; fi
  if command -v shasum >/dev/null 2>&1; then
    got="$(shasum -a 256 "$tmp/$file" | cut -d' ' -f1)"
  else
    got="$(sha256sum "$tmp/$file" | cut -d' ' -f1)"
  fi
  if [ "$got" != "$want" ]; then debug "node checksum mismatch"; rm -rf "$tmp"; return 1; fi
  if ! tar -xzf "$tmp/$file" -C "$tmp"; then rm -rf "$tmp"; return 1; fi
  mkdir -p "$(dirname "$BP_NODE_DIR")"
  rm -rf "$BP_NODE_DIR"
  mv "$tmp/${file%.tar.gz}" "$BP_NODE_DIR"
  rm -rf "$tmp"
  return 0
}

# Persist the Node PATH entry in the login shell rc, once (marker-guarded).
# $1 = "append" (no Node before) or "prepend" (old Node must be shadowed).
persist_node_path() {
  rc=""
  case "$(basename "${SHELL:-}")" in
    zsh) rc="$HOME/.zshrc" ;;
    bash) if [ -f "$HOME/.bash_profile" ]; then rc="$HOME/.bash_profile"; else rc="$HOME/.bashrc"; fi ;;
  esac
  [ -n "$rc" ] || return 0
  if [ -f "$rc" ] && grep -q "buildpartner-node" "$rc" 2>/dev/null; then
    return 0
  fi
  {
    echo ""
    echo "# buildpartner-node (added by the BuildPartner.ai installer)"
    if [ "$1" = "prepend" ]; then
      echo 'export PATH="$HOME/.local/share/buildpartner/node/bin:$PATH"'
    else
      echo 'export PATH="$PATH:$HOME/.local/share/buildpartner/node/bin"'
    fi
  } >> "$rc" 2>/dev/null || return 0
  echo -e "  ${GREEN}✓ Added Node.js to PATH in $(basename "$rc")${RESET}"
}

# A Node we installed on an earlier run is on PATH only via the rc file, which
# a `curl | bash` shell has not read. Pick it up so a re-run doesn't download
# it again.
if ! node_ok && [ -x "$BP_NODE_DIR/bin/node" ]; then
  PATH="$BP_NODE_DIR/bin:$PATH"; export PATH
fi

if node_ok; then
  echo -e "  ${GREEN}✓ Node.js $(node -v) found${RESET}"
else
  NODE_PLACEMENT=append
  if command -v node >/dev/null 2>&1; then
    NODE_PLACEMENT=prepend
    echo -e "  ${DIM}Node.js $(node -v 2>/dev/null) is too old. Installing a current version for BuildPartner (about 30 seconds)...${RESET}"
  else
    echo -e "  ${DIM}Node.js not found. Installing it for you (about 30 seconds)...${RESET}"
  fi
  if install_private_node; then
    PATH="$BP_NODE_DIR/bin:$PATH"; export PATH
    persist_node_path "$NODE_PLACEMENT"
  fi
  if ! node_ok; then
    echo -e "  ${YELLOW}✗ Node.js could not be installed automatically${RESET}"
    echo ""
    echo "  Install the LTS version from nodejs.org, then re-run this command:"
    echo -e "    ${ORANGE}https://nodejs.org${RESET}"
    echo ""
    exit 1
  fi
  echo -e "  ${GREEN}✓ Node.js $(node -v) installed${RESET}"
fi

# Git is only a fallback now (old Claude Code, or the hosted catalog is down).
# On a Mac without Apple's developer tools, /usr/bin/git is a placeholder that
# pops an install dialog when run, so check for the tools before touching it.
git_works() {
  if [ "$(uname -s)" = "Darwin" ] && ! xcode-select -p >/dev/null 2>&1; then
    return 1
  fi
  git --version >/dev/null 2>&1
}

# ── Step 1: Account ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}  [1/3] Log in or create your account${RESET}"
echo ""

# If --token provided, verify and use it (skips email prompt entirely)
if [ -n "$PROVIDED_TOKEN" ]; then
  VERIFY_DATA=$(curl -s -H "Authorization: Bearer $PROVIDED_TOKEN" "$API_BASE/api/buildpartner/verify-token" 2>/dev/null)
  VERIFY_EMAIL=$(echo "$VERIFY_DATA" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf-8'));if(d.email)console.log(d.email)}catch{}" 2>/dev/null)
  VERIFY_USER=$(echo "$VERIFY_DATA" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf-8'));if(d.username)console.log(d.username)}catch{}" 2>/dev/null)
  ORG_SLUG=$(echo "$VERIFY_DATA" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf-8'));if(d.org)console.log(d.org)}catch{}" 2>/dev/null)

  if [ -n "$VERIFY_EMAIL" ]; then
    TOKEN="$PROVIDED_TOKEN"
    EMAIL="$VERIFY_EMAIL"
    USERNAME="$VERIFY_USER"
    mkdir -p "$BP_DIR"
    cat > "$AUTH_FILE" << AUTHEOF
{
  "email": "$EMAIL",
  "username": "$USERNAME",
  "token": "$TOKEN",
  $AUTH_API_LINE
  "profile_url": "$API_DOMAIN/$USERNAME",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
}
AUTHEOF
    # The token is a one-year credential: this user only.
    chmod 700 "$BP_DIR" 2>/dev/null || true
    chmod 600 "$AUTH_FILE" 2>/dev/null || true
    echo -e "  ${GREEN}✓ Logged in as $EMAIL${RESET}"
    SKIP_SIGNUP=true
  else
    echo -e "  ${YELLOW}! Invalid token. Falling back to email login.${RESET}"
    echo ""
  fi
fi

if [ -f "$AUTH_FILE" ] && [ "${SKIP_SIGNUP}" != "true" ]; then
  TOKEN=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('$AUTH_FILE','utf-8')).token)}catch{}" 2>/dev/null)
  if [ -n "$TOKEN" ]; then
    VERIFY_BODY=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$API_BASE/api/buildpartner/verify-token" 2>/dev/null || echo "000")
    VERIFY=$(echo "$VERIFY_BODY" | tail -1)
    if [ "$VERIFY" = "200" ]; then
      ORG_SLUG=$(echo "$VERIFY_BODY" | sed '$d' | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf-8'));if(d.org)console.log(d.org)}catch{}" 2>/dev/null)
      EMAIL=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('$AUTH_FILE','utf-8')).email)}catch{}" 2>/dev/null)
      echo -e "  ${GREEN}✓ Logged in as $EMAIL${RESET}"
      SKIP_SIGNUP=true
    fi
  fi
fi

if [ "${SKIP_SIGNUP}" != "true" ]; then
  # Under `curl | bash` stdin is the script itself, so prompt on the
  # controlling terminal instead. Only give up when there is no terminal
  # at all (CI, cron, a redirected shell).
  if ( : < /dev/tty ) 2>/dev/null; then
    printf "        Email: "
    read -r EMAIL < /dev/tty

    while [ -z "$EMAIL" ] || ! echo "$EMAIL" | grep -q "@"; do
      echo -e "  ${YELLOW}      Enter a valid email${RESET}"
      printf "        Email: "
      read -r EMAIL < /dev/tty
    done
  else
    echo -e "  ${YELLOW}! No terminal to prompt on. Run this in a terminal, or pass --token.${RESET}"
    exit 1
  fi

  EMAIL=$(echo "$EMAIL" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')

  # Email-only login: the server emails a confirm link and we wait for the
  # click. Same path for new and existing emails; a new account is created
  # only when the link is confirmed, so nobody can claim an inbox they don't
  # own. The token is written to auth.json and never printed.
  START_BODY=$(BP_EMAIL="$EMAIL" node -e 'console.log(JSON.stringify({email:process.env.BP_EMAIL,source:"installer"}))')
  START_RESULT=$(curl -s -X POST "$API_BASE/api/buildpartner/login/start" \
    -H "Content-Type: application/json" \
    -d "$START_BODY" 2>/dev/null || echo '{"error":"network"}')

  LOGIN_ID=$(echo "$START_RESULT" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf-8'));if(d.login_id)console.log(d.login_id)}catch{}" 2>/dev/null)
  LOGIN_CODE=$(echo "$START_RESULT" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf-8'));if(d.code)console.log(d.code)}catch{}" 2>/dev/null)
  START_ERROR=$(echo "$START_RESULT" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf-8'));if(d.error)console.log(d.error)}catch{}" 2>/dev/null)

  if [ -z "$LOGIN_ID" ]; then
    if [ "$START_ERROR" = "network" ] || [ -z "$START_ERROR" ]; then
      echo -e "  ${YELLOW}! Could not reach ${API_DOMAIN}. Check your connection and try again.${RESET}"
    else
      echo -e "  ${YELLOW}! $START_ERROR${RESET}"
    fi
    exit 1
  fi

  echo ""
  echo -e "  ${ORANGE}Check your inbox:${RESET} we sent a login link to $EMAIL"
  echo -e "  ${DIM}Click \"Yes, log me in\" (your phone works too). Code: $LOGIN_CODE${RESET}"
  echo -e "  ${DIM}Waiting for you to click...${RESET}"

  POLL_BODY=$(BP_LOGIN_ID="$LOGIN_ID" node -e 'console.log(JSON.stringify({login_id:process.env.BP_LOGIN_ID}))')
  # 15 minute link, polled every 3 seconds.
  for i in $(seq 1 300); do
    sleep 3
    POLL_RESULT=$(curl -s -X POST "$API_BASE/api/buildpartner/login/poll" \
      -H "Content-Type: application/json" \
      -d "$POLL_BODY" 2>/dev/null || echo "")
    POLL_STATUS=$(echo "$POLL_RESULT" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf-8'));if(d.status)console.log(d.status)}catch{}" 2>/dev/null)
    if [ "$POLL_STATUS" = "approved" ]; then
      TOKEN=$(echo "$POLL_RESULT" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf-8'));if(d.token)console.log(d.token)}catch{}" 2>/dev/null)
      USERNAME=$(echo "$POLL_RESULT" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf-8'));if(d.username)console.log(d.username)}catch{}" 2>/dev/null)
      break
    fi
    if [ "$POLL_STATUS" = "expired" ]; then
      break
    fi
  done

  if [ -z "$TOKEN" ]; then
    echo -e "  ${YELLOW}! The login link expired. Re-run this command for a new one.${RESET}"
    exit 1
  fi

  mkdir -p "$BP_DIR"
  cat > "$AUTH_FILE" << AUTHEOF
{
  "email": "$EMAIL",
  "username": "$USERNAME",
  "token": "$TOKEN",
  $AUTH_API_LINE
  "profile_url": "$API_DOMAIN/$USERNAME",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
}
AUTHEOF
  # The token is a one-year credential: this user only.
  chmod 700 "$BP_DIR" 2>/dev/null || true
  chmod 600 "$AUTH_FILE" 2>/dev/null || true
  echo -e "  ${GREEN}✓ Logged in as $EMAIL${RESET}"

  # A freshly signed-up account is only an org member if the admin
  # pre-assigned it, but check anyway so pre-assigned accounts work first try.
  # Guarded with || echo "" so a network failure here degrades to "no org
  # detected" instead of tripping set -e and aborting the whole install.
  VERIFY_DATA=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/api/buildpartner/verify-token" 2>/dev/null || echo "")
  ORG_SLUG=$(echo "$VERIFY_DATA" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf-8'));if(d.org)console.log(d.org)}catch{}" 2>/dev/null)
fi

echo ""

# ── Step 2: Install plugin via marketplace ────────────────────────
echo -e "${BOLD}  [2/3] Installing plugin...${RESET}"

# The catalog is a marketplace.json served over plain HTTPS whose plugins are
# zips, so Claude Code needs no Git to install or update them. The deploy
# scripts build both (scripts/build-plugin-archives.sh). The GitHub repo stays
# as the fallback, used only when Git actually works on this machine.
PLUGIN_REPO="austinmarchese/buildpartner-plugin"
GIT_FALLBACK_SOURCE=""
if [ "$LOCAL_MODE" = true ]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
  MARKETPLACE_SOURCE="./$REPO_DIR"
elif echo "$API_BASE" | grep -q "dev\."; then
  MARKETPLACE_SOURCE="https://raw.githubusercontent.com/$PLUGIN_REPO/dev/hosted/marketplace.json"
  GIT_FALLBACK_SOURCE="$PLUGIN_REPO#dev"
  # deploy-dev-plugin.sh brands the dev plugin as bp-dev (name + marketplace),
  # so install it under that id. Prod stays buildpartner@buildpartner below.
  MARKETPLACE_NAME="bp-dev"
  PLUGIN_NAME="bp-dev"
else
  MARKETPLACE_SOURCE="https://raw.githubusercontent.com/$PLUGIN_REPO/main/hosted/marketplace.json"
  GIT_FALLBACK_SOURCE="$PLUGIN_REPO"
fi
# Testing hook: point the installer at another hosted catalog.
if [ -n "${BP_MARKETPLACE_URL:-}" ]; then
  MARKETPLACE_SOURCE="$BP_MARKETPLACE_URL"
fi

if [ "$CC_SUPPORTS_ZIP" = false ] && [ -n "$GIT_FALLBACK_SOURCE" ]; then
  MARKETPLACE_SOURCE="$GIT_FALLBACK_SOURCE"
fi

TEAM_PLUGIN_NAME="${PLUGIN_NAME}-team"

debug "MARKETPLACE_SOURCE=$MARKETPLACE_SOURCE"
debug "MARKETPLACE_NAME=$MARKETPLACE_NAME"
debug "PLUGIN_NAME=$PLUGIN_NAME"
debug "TEAM_PLUGIN_NAME=$TEAM_PLUGIN_NAME"

# Current state
debug "claude version: $(claude --version 2>&1 || echo 'not found')"
debug "existing marketplaces: $(claude plugin marketplace list 2>&1 || echo 'none')"
debug "existing plugins: $(claude plugin list 2>&1 || echo 'none')"

# Add marketplace (remove and re-add to ensure correct branch)
# Try both possible names (old installs used 'buildpartner-marketplace')
if claude plugin marketplace list 2>/dev/null | grep -q "buildpartner-marketplace"; then
  debug "removing existing marketplace 'buildpartner-marketplace'..."
  claude plugin marketplace remove "buildpartner-marketplace" </dev/null 2>/dev/null || true
elif claude plugin marketplace list 2>/dev/null | grep -q "$MARKETPLACE_NAME"; then
  debug "removing existing marketplace '$MARKETPLACE_NAME'..."
  claude plugin marketplace remove "$MARKETPLACE_NAME" </dev/null 2>/dev/null || true
fi

debug "adding marketplace: $MARKETPLACE_SOURCE"
if claude plugin marketplace add "$MARKETPLACE_SOURCE" </dev/null; then
  echo -e "  ${GREEN}✓ Marketplace added${RESET}"
elif [ -n "$GIT_FALLBACK_SOURCE" ] && [ "$MARKETPLACE_SOURCE" != "$GIT_FALLBACK_SOURCE" ] && git_works &&
     claude plugin marketplace add "$GIT_FALLBACK_SOURCE" </dev/null; then
  debug "hosted catalog failed, added the Git catalog instead"
  echo -e "  ${GREEN}✓ Marketplace added${RESET}"
else
  echo -e "  ${YELLOW}✗ Failed to add marketplace${RESET}"
  echo ""
  if [ "$CC_SUPPORTS_ZIP" = false ]; then
    echo "  Your Claude Code is too old for BuildPartner. Update it, then re-run this command:"
    echo -e "    ${ORANGE}claude update${RESET}"
  else
    echo "  Check your internet connection and re-run this command."
    echo -e "  ${DIM}Still stuck? Email hello@buildpartner.ai${RESET}"
  fi
  echo ""
  exit 1
fi

debug "marketplaces after add: $(claude plugin marketplace list 2>&1 || echo 'none')"

# Install plugin (remove and reinstall to ensure latest version)
if claude plugin list 2>/dev/null | grep -q "$PLUGIN_NAME@$MARKETPLACE_NAME"; then
  debug "removing existing plugin '$PLUGIN_NAME@$MARKETPLACE_NAME'..."
  claude plugin uninstall "$PLUGIN_NAME@$MARKETPLACE_NAME" </dev/null 2>/dev/null || true
fi

debug "installing plugin: $PLUGIN_NAME@$MARKETPLACE_NAME"
if claude plugin install "$PLUGIN_NAME@$MARKETPLACE_NAME" </dev/null; then
  echo -e "  ${GREEN}✓ Plugin installed${RESET}"
else
  echo -e "  ${YELLOW}✗ Failed to install plugin${RESET}"
  exit 1
fi

TEAM_INSTALLED=false
if [ -n "$ORG_SLUG" ] || [ "$FORCE_TEAM" = true ]; then
  debug "installing team plugin: $TEAM_PLUGIN_NAME@$MARKETPLACE_NAME"
  if claude plugin list 2>/dev/null | grep -q "$TEAM_PLUGIN_NAME@$MARKETPLACE_NAME"; then
    claude plugin uninstall "$TEAM_PLUGIN_NAME@$MARKETPLACE_NAME" </dev/null 2>/dev/null || true
  fi
  if claude plugin install "$TEAM_PLUGIN_NAME@$MARKETPLACE_NAME" </dev/null; then
    echo -e "  ${GREEN}✓ Team plugin installed${RESET}"
    TEAM_INSTALLED=true
  else
    echo -e "  ${YELLOW}! Team plugin install failed (rerun the install command to retry)${RESET}"
  fi
fi

if [ "$TEAM_INSTALLED" = true ]; then
  echo -e "  ${GREEN}✓ 5 skills available${RESET}"
else
  echo -e "  ${GREEN}✓ 4 skills available${RESET}"
fi
echo -e "  ${GREEN}✓ MCP server configured${RESET}"

# Record the completed install server-side so the dashboard's "Install the
# plugin" onboarding step ticks immediately. Best-effort: an install must
# never fail over telemetry, so errors are swallowed.
if [ -n "$TOKEN" ]; then
  curl -s -X POST "$API_BASE/api/buildpartner/ingest" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"events":[{"event":"install.completed"}]}' >/dev/null 2>&1 || true
fi

# ── Inject CLAUDE.md instructions ──────────────────────────────
CLAUDE_MD="$HOME/.claude/CLAUDE.md"
BP_START="<!-- buildpartner-start -->"
BP_END="<!-- buildpartner-end -->"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BLOCK_FILE="$SCRIPT_DIR/../claude-md-block.txt"

if [ -f "$BLOCK_FILE" ]; then
  BP_BLOCK=$(cat "$BLOCK_FILE")

  if [ -f "$CLAUDE_MD" ] && grep -q "$BP_START" "$CLAUDE_MD"; then
    sed -i.bak "/$BP_START/,/$BP_END/d" "$CLAUDE_MD" && rm -f "$CLAUDE_MD.bak"
  fi
  mkdir -p "$(dirname "$CLAUDE_MD")"
  echo "" >> "$CLAUDE_MD"
  echo "$BP_BLOCK" >> "$CLAUDE_MD"
  echo -e "  ${GREEN}✓ Claude Code integration configured${RESET}"
fi

echo ""

# Open dashboard
if [ -n "$TOKEN" ]; then
  DASH_URL="${API_BASE}/dashboard?t=$TOKEN&installed=true"
  if command -v open &> /dev/null; then
    open "$DASH_URL" 2>/dev/null && echo -e "  ${GREEN}✓ Opening your dashboard...${RESET}" || true
  elif command -v xdg-open &> /dev/null; then
    xdg-open "$DASH_URL" 2>/dev/null && echo -e "  ${GREEN}✓ Opening your dashboard...${RESET}" || true
  elif command -v start &> /dev/null; then
    start "" "$DASH_URL" 2>/dev/null && echo -e "  ${GREEN}✓ Opening your dashboard...${RESET}" || true
  fi
  echo ""
fi

# Summary
echo -e "${ORANGE}  ╭──────────────────────────────────────────────╮${RESET}"
echo -e "${ORANGE}  │                                              │${RESET}"
echo -e "${ORANGE}  │  You're all set.                             │${RESET}"
echo -e "${ORANGE}  │                                              │${RESET}"
if [ "$TEAM_INSTALLED" = true ]; then
  echo -e "${ORANGE}  │  5 skills installed                          │${RESET}"
else
  echo -e "${ORANGE}  │  4 skills installed                          │${RESET}"
fi
echo -e "${ORANGE}  │                                              │${RESET}"
echo -e "${ORANGE}  ╰──────────────────────────────────────────────╯${RESET}"
echo ""
echo -e "${BOLD}  Next step:${RESET} Start a new Claude Code session and try:"
echo ""
echo -e "  ${ORANGE}/bp-dev:build${RESET}"
echo ""
echo -e "  ${DIM}If you're already in Claude Code, restart the session first.${RESET}"
echo ""

} # end pipe-drain wrapper (see matching { near top)
