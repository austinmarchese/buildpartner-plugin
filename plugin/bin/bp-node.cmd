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
rem npx must be called by its full path. npx.cmd finds npx-cli.js through
rem %~dp0, and `call "npx"` (a bare name in quotes) makes %~dp0 the current
rem folder, so npx died with "Cannot find module ...\node_modules\npm\bin\
rem npx-cli.js" from whatever project Claude was opened in (Nov 3 2026).
set "BP_NPX="
rem npx.exe covers Volta, whose shims are .exe files.
for /f "delims=" %%p in ('where $PATH:npx.cmd 2^>nul') do if not defined BP_NPX set "BP_NPX=%%p"
if not defined BP_NPX for /f "delims=" %%p in ('where $PATH:npx.exe 2^>nul') do if not defined BP_NPX set "BP_NPX=%%p"
if not defined BP_NPX if exist "%ProgramFiles%\nodejs\npx.cmd" set "BP_NPX=%ProgramFiles%\nodejs\npx.cmd"
rem $PATH: makes where skip the current folder, so a project never shadows them.
set "BP_NODE="
for /f "delims=" %%p in ('where $PATH:node.exe 2^>nul') do if not defined BP_NODE set "BP_NODE=%%p"
if not defined BP_NODE if exist "%ProgramFiles%\nodejs\node.exe" set "BP_NODE=%ProgramFiles%\nodejs\node.exe"
if not defined BP_NODE set "BP_NODE=node"

if /i not "%~1"=="--npx" (
  "%BP_NODE%" %*
  exit /b
)

if not defined BP_NPX (
  echo BuildPartner: npx was not found. Install Node.js LTS from https://nodejs.org, then restart Claude. 1>&2
  exit /b 1
)

rem Drop the leading --npx and pass the rest to npx unchanged.
for /f "tokens=1,* delims= " %%a in ("%*") do set "BP_ARGS=%%b"
call "%BP_NPX%" %BP_ARGS%
exit /b
