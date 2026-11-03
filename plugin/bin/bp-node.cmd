@echo off
rem bp-node.cmd: the Windows twin of bp-node, for the tools server only.
rem
rem .mcp.json starts the tools server as "${CLAUDE_PLUGIN_ROOT}/bin/bp-node"
rem with no "sh" in front. On a Mac or Linux box that runs bp-node through its
rem #!/bin/sh line. On Windows, Claude Code finds this file instead (it looks
rem for bp-node plus each PATHEXT extension) and runs it through cmd.exe.
rem Windows has no sh on PATH unless Git's usr\bin was added to it, so
rem "command": "sh" left every Windows member with a tools server that failed
rem to connect (first seen Nov 3 2026, on a Windows dev install).
rem
rem Windows does not need bp-node's Node search: apps get PATH from the
rem registry however they are started, and the installer puts Node there
rem (winget). Hooks still go through "sh bp-node", because Claude Code runs
rem hook commands in Git Bash, which has sh.
rem
rem Usage (same as bp-node):  bp-node --npx <npx args...>  or  bp-node <script.mjs> [args...]

setlocal
set "BP_NPX=npx"
where npx >nul 2>nul || if exist "%ProgramFiles%\nodejs\npx.cmd" set "BP_NPX=%ProgramFiles%\nodejs\npx.cmd"
set "BP_NODE=node"
where node >nul 2>nul || if exist "%ProgramFiles%\nodejs\node.exe" set "BP_NODE=%ProgramFiles%\nodejs\node.exe"

if /i not "%~1"=="--npx" (
  "%BP_NODE%" %*
  exit /b
)

rem Drop the leading --npx and pass the rest to npx unchanged.
for /f "tokens=1,* delims= " %%a in ("%*") do set "BP_ARGS=%%b"
call "%BP_NPX%" %BP_ARGS%
exit /b
