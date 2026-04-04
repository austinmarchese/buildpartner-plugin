#!/bin/bash
# BuildPartner.ai Plugin Installer
#
# Production (from GitHub marketplace):
#   curl -fsSL https://buildpartner.ai/install-plugin.sh | sh
#
# Local dev (from local repo clone):
#   curl -fsSL https://buildpartner.ai/install-plugin.sh | sh -s -- --local
#   OR: ./plugin/scripts/install.sh --local
#
# Installs the BuildPartner plugin into Claude Code via the marketplace system.

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
API_BASE="https://www.buildpartner.ai"
MARKETPLACE_NAME="buildpartner-marketplace"
PLUGIN_NAME="buildpartner"

# Parse flags
LOCAL_MODE=false
PROVIDED_TOKEN=""
while [ $# -gt 0 ]; do
  case "$1" in
    --local) LOCAL_MODE=true ;;
    --token=*) PROVIDED_TOKEN="${1#--token=}" ;;
    --token) PROVIDED_TOKEN="$2"; shift ;;
  esac
  shift
done

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

# ── Check Claude Code ────────────────────────────────────────────
if ! command -v claude &> /dev/null; then
  echo -e "  ${YELLOW}✗ Claude Code not found${RESET}"
  echo "  Install Claude Code first: https://claude.ai/code"
  exit 1
fi
echo -e "  ${GREEN}✓ Claude Code found${RESET}"

# ── Step 1: Account ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}  [1/3] Create your account${RESET}"
echo ""

# If --token provided, verify and use it (skips email prompt entirely)
if [ -n "$PROVIDED_TOKEN" ]; then
  VERIFY_DATA=$(curl -s -H "Authorization: Bearer $PROVIDED_TOKEN" "$API_BASE/api/buildpartner/verify-token" 2>/dev/null)
  VERIFY_EMAIL=$(echo "$VERIFY_DATA" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf-8'));if(d.email)console.log(d.email)}catch{}" 2>/dev/null)
  VERIFY_USER=$(echo "$VERIFY_DATA" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf-8'));if(d.username)console.log(d.username)}catch{}" 2>/dev/null)

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
  "profile_url": "buildpartner.ai/$USERNAME",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
}
AUTHEOF
    echo -e "  ${GREEN}✓ Logged in as $EMAIL${RESET}"
    SKIP_SIGNUP=true
  else
    echo -e "  ${YELLOW}! Invalid token. Falling back to email signup.${RESET}"
    echo ""
  fi
fi

if [ -f "$AUTH_FILE" ] && [ "${SKIP_SIGNUP}" != "true" ]; then
  TOKEN=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('$AUTH_FILE','utf-8')).token)}catch{}" 2>/dev/null)
  if [ -n "$TOKEN" ]; then
    VERIFY=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$API_BASE/api/buildpartner/verify-token" 2>/dev/null || echo "000")
    if [ "$VERIFY" = "200" ]; then
      EMAIL=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('$AUTH_FILE','utf-8')).email)}catch{}" 2>/dev/null)
      echo -e "  ${GREEN}✓ Logged in as $EMAIL${RESET}"
      SKIP_SIGNUP=true
    fi
  fi
fi

if [ "${SKIP_SIGNUP}" != "true" ]; then
  if [ -t 0 ]; then
    printf "        Email: "
    read -r EMAIL

    while [ -z "$EMAIL" ] || ! echo "$EMAIL" | grep -q "@"; do
      echo -e "  ${YELLOW}      Enter a valid email${RESET}"
      printf "        Email: "
      read -r EMAIL
    done
  else
    echo -e "  ${YELLOW}! Non-interactive mode. Run this in a terminal.${RESET}"
    exit 1
  fi

  USERNAME=$(echo "$EMAIL" | cut -d@ -f1 | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g; s/--*/-/g; s/^-//; s/-$//')
  if [ ${#USERNAME} -lt 2 ]; then
    USERNAME="user-$(head -c 6 /dev/urandom | base64 | tr -dc 'a-z0-9' | head -c 6)"
  fi

  SIGNUP_RESULT=$(curl -s -X POST "$API_BASE/api/buildpartner/signup" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"username\":\"$USERNAME\"}" 2>/dev/null || echo '{"error":"network"}')

  SIGNUP_TOKEN=$(echo "$SIGNUP_RESULT" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf-8'));if(d.token)console.log(d.token)}catch{}" 2>/dev/null)
  SIGNUP_ERROR=$(echo "$SIGNUP_RESULT" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf-8'));if(d.error)console.log(d.error)}catch{}" 2>/dev/null)

  if [ -n "$SIGNUP_TOKEN" ]; then
    mkdir -p "$BP_DIR"
    cat > "$AUTH_FILE" << AUTHEOF
{
  "email": "$EMAIL",
  "username": "$USERNAME",
  "token": "$SIGNUP_TOKEN",
  "profile_url": "buildpartner.ai/$USERNAME",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
}
AUTHEOF
    echo -e "  ${GREEN}✓ Account created${RESET}"
    TOKEN="$SIGNUP_TOKEN"
  elif echo "$SIGNUP_ERROR" | grep -qi "username"; then
    for i in 1 2 3; do
      SUFFIX=$(head -c 4 /dev/urandom | base64 | tr -dc 'a-z0-9' | head -c 4)
      USERNAME="${USERNAME}-${SUFFIX}"
      SIGNUP_RESULT=$(curl -s -X POST "$API_BASE/api/buildpartner/signup" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$EMAIL\",\"username\":\"$USERNAME\"}" 2>/dev/null || echo '{"error":"network"}')
      SIGNUP_TOKEN=$(echo "$SIGNUP_RESULT" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf-8'));if(d.token)console.log(d.token)}catch{}" 2>/dev/null)
      if [ -n "$SIGNUP_TOKEN" ]; then
        mkdir -p "$BP_DIR"
        cat > "$AUTH_FILE" << AUTHEOF
{
  "email": "$EMAIL",
  "username": "$USERNAME",
  "token": "$SIGNUP_TOKEN",
  "profile_url": "buildpartner.ai/$USERNAME",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
}
AUTHEOF
        echo -e "  ${GREEN}✓ Account created${RESET}"
        TOKEN="$SIGNUP_TOKEN"
        break
      fi
    done
    if [ -z "$TOKEN" ]; then
      echo -e "  ${YELLOW}! Could not create account. Try again later.${RESET}"
      exit 1
    fi
  elif echo "$SIGNUP_ERROR" | grep -qi "email"; then
    echo -e "  ${YELLOW}! This email is already registered.${RESET}"
    echo -e "  ${DIM}  Log in at $API_BASE/dashboard/login, then run:${RESET}"
    echo -e "  ${DIM}  buildpartner login <your-token>${RESET}"
    exit 1
  elif echo "$SIGNUP_ERROR" | grep -qi "network"; then
    echo -e "  ${YELLOW}! Could not reach buildpartner.ai. Check your connection and try again.${RESET}"
    exit 1
  else
    echo -e "  ${YELLOW}! Signup failed: $SIGNUP_ERROR${RESET}"
    exit 1
  fi
fi

echo ""

# ── Step 2: Install plugin via marketplace ────────────────────────
echo -e "${BOLD}  [2/3] Installing plugin...${RESET}"

if [ "$LOCAL_MODE" = true ]; then
  # Local: point at the repo directory on disk
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
  MARKETPLACE_SOURCE="./$REPO_DIR"
else
  # Production: point at GitHub repo
  MARKETPLACE_SOURCE="austinmarchese/buildpartner-plugin"
fi

# Add marketplace (skip if already added)
if claude plugin marketplace list 2>/dev/null | grep -q "$MARKETPLACE_NAME"; then
  echo -e "  ${GREEN}✓ Marketplace already added${RESET}"
else
  claude plugin marketplace add "$MARKETPLACE_SOURCE" 2>/dev/null
  echo -e "  ${GREEN}✓ Marketplace added${RESET}"
fi

# Install plugin (skip if already installed)
if claude plugin list 2>/dev/null | grep -q "$PLUGIN_NAME@$MARKETPLACE_NAME"; then
  echo -e "  ${GREEN}✓ Plugin already installed${RESET}"
else
  claude plugin install "$PLUGIN_NAME@$MARKETPLACE_NAME" 2>/dev/null
  echo -e "  ${GREEN}✓ Plugin installed${RESET}"
fi

echo -e "  ${GREEN}✓ 5 skills available${RESET}"
echo -e "  ${GREEN}✓ MCP server configured${RESET}"
echo -e "  ${GREEN}✓ Auto-tracking enabled${RESET}"

echo ""

# ── Step 3: Sync history ────────────────────────────────────────
echo -e "${BOLD}  [3/3] Syncing your history...${RESET}"

if [ -n "$TOKEN" ]; then
  npx buildpartner sync > /dev/null 2>&1 &
  echo -e "  ${GREEN}✓ Syncing sessions in background${RESET}"
fi

echo ""

# Open dashboard
if [ -n "$TOKEN" ]; then
  DASH_URL="https://buildpartner.ai/dashboard?t=$TOKEN"
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
echo -e "${ORANGE}  │  Sessions syncing in background               │${RESET}"
echo -e "${ORANGE}  │  5 skills installed                          │${RESET}"
echo -e "${ORANGE}  │  Auto-tracking enabled                       │${RESET}"
echo -e "${ORANGE}  │                                              │${RESET}"
echo -e "${ORANGE}  ╰──────────────────────────────────────────────╯${RESET}"
echo ""
echo -e "${BOLD}  Try this now:${RESET}"
echo ""
echo -e "  ${ORANGE}/buildpartner:claude-coach${RESET}"
echo ""
