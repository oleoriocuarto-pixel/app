@echo off
setlocal
cd /d "%~dp0"

set "BUNDLED_NODE=C:\Users\Admin\AppData\Local\OpenAI\Codex\bin\5b9024f90663758b\node.exe"

if exist "%BUNDLED_NODE%" (
  "%BUNDLED_NODE%" server.js
) else (
  node server.js
)

pause
