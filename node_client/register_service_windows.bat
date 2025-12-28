@echo off
REM Register PassiveBackuperClient as a Windows service using nssm
REM Prerequisite: Download and install nssm (https://nssm.cc/download)

set NODE_PATH=%~dp0\..\node.exe
set SCRIPT_PATH=%~dp0send_files.js
set SERVICE_NAME=PassiveBackuperClient

REM Adjust NODE_PATH if node.exe is not in the parent directory

nssm install %SERVICE_NAME% "%NODE_PATH%" "%SCRIPT_PATH%"

echo Service %SERVICE_NAME% registered. Start it from Windows Services panel or with:
echo nssm start %SERVICE_NAME%
