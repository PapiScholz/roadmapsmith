@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "ACTION=%~1"
if not defined ACTION set "ACTION=explain"
call :resolve_node
if defined ROADMAPSMITH_NODE_RESOLVED goto run_launcher
echo RoadmapSmith VS Code task runtime error
echo.
echo VS Code tasks are installed, but the Node runtime needed to start RoadmapSmith could not be resolved.
echo RoadmapSmith itself may still be installed and the CLI may still be available.
echo Missing piece: the Node runtime used to start .vscode\roadmapsmith-launcher.js
echo Recovery: install Node.js or set ROADMAPSMITH_NODE to a working node executable path, then rerun RoadmapSmith: Status.
if /I "%ACTION%"=="status" exit /b 0
if /I "%ACTION%"=="explain" exit /b 0
exit /b 1

:run_launcher
"%ROADMAPSMITH_NODE_RESOLVED%" "%SCRIPT_DIR%roadmapsmith-launcher.js" %*
exit /b %ERRORLEVEL%

:resolve_node
set "ROADMAPSMITH_NODE_RESOLVED="
if defined ROADMAPSMITH_NODE if exist "%ROADMAPSMITH_NODE%" set "ROADMAPSMITH_NODE_RESOLVED=%ROADMAPSMITH_NODE%"
if defined ROADMAPSMITH_NODE if not defined ROADMAPSMITH_NODE_RESOLVED call :resolve_command "%ROADMAPSMITH_NODE%"
if defined ROADMAPSMITH_NODE_RESOLVED exit /b 0
for /f "delims=" %%I in ('where node 2^>nul') do (
  set "ROADMAPSMITH_NODE_RESOLVED=%%~fI"
  goto :node_resolved
)
if not defined ROADMAPSMITH_NODE_RESOLVED if defined ProgramFiles if exist "%ProgramFiles%\nodejs\node.exe" set "ROADMAPSMITH_NODE_RESOLVED=%ProgramFiles%\nodejs\node.exe"
if not defined ROADMAPSMITH_NODE_RESOLVED if defined ProgramFiles(x86) if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "ROADMAPSMITH_NODE_RESOLVED=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined ROADMAPSMITH_NODE_RESOLVED if defined LocalAppData if exist "%LocalAppData%\Programs\nodejs\node.exe" set "ROADMAPSMITH_NODE_RESOLVED=%LocalAppData%\Programs\nodejs\node.exe"
if not defined ROADMAPSMITH_NODE_RESOLVED if defined LocalAppData if exist "%LocalAppData%\Volta\bin\node.exe" set "ROADMAPSMITH_NODE_RESOLVED=%LocalAppData%\Volta\bin\node.exe"
:node_resolved
exit /b 0

:resolve_command
for /f "delims=" %%I in ('where %~1 2^>nul') do (
  set "ROADMAPSMITH_NODE_RESOLVED=%%~fI"
  goto :eof
)
exit /b 0
