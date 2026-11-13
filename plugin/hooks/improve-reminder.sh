#!/bin/sh
# Improve System reminder, shown at most once per day and not after the member ran the skill.
# POSIX sh, no node, no network. Always exits 0 and never writes to stderr.
#
#   start  SessionStart: on weekday 1 (Mon) or 5 (Fri), print the reminder unless the marker says
#          today is already taken. The marker is written before printing, so a failed write means
#          no reminder (never a repeat nag).
#   ran    UserPromptSubmit and PostToolUse (Skill): read the hook JSON on stdin; if it is the
#          improve-system skill, record today so the reminder stays quiet.
#
# Marker: $HOME/.buildpartner/improve-reminder-day, one line YYYY-MM-DD.
# Test seams: BP_TODAY (YYYY-MM-DD) and BP_WEEKDAY (1-7) override the clock.

exec 2>/dev/null

mode="${1:-}"
case "$mode" in
  start | ran) ;;
  *) exit 0 ;;
esac

[ -n "${HOME:-}" ] || exit 0
today="${BP_TODAY:-$(date +%Y-%m-%d)}"
[ -n "$today" ] || exit 0

dir="$HOME/.buildpartner"
marker="$dir/improve-reminder-day"

mark_today() {
  mkdir -p "$dir" && printf '%s\n' "$today" > "$marker"
}

if [ "$mode" = "ran" ]; then
  input=$(cat)
  case "$input" in
    */*:improve-system* | *\"skill\"*improve-system\"*) mark_today ;;
  esac
  exit 0
fi

weekday="${BP_WEEKDAY:-$(date +%u)}"
case "$weekday" in
  1 | 5) ;;
  *) exit 0 ;;
esac

last=""
[ -f "$marker" ] && read -r last < "$marker"
[ "$last" = "$today" ] && exit 0

if mark_today; then
  printf '%s' '{"systemMessage":"IMPROVE SYSTEM REMINDER: Run /buildpartner:improve-system to review your sessions and keep your setup sharp."}'
fi
exit 0
