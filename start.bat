@echo off
title Undernite Server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js wurde nicht gefunden.
  echo  Bitte einmalig installieren: https://nodejs.org  ^(LTS-Version^)
  echo  oder in einem Terminal:  winget install OpenJS.NodeJS.LTS
  echo.
  pause
  exit /b 1
)
if not exist "node_modules\ws" (
  echo  Erster Start: installiere Abhaengigkeiten ...
  call npm install --omit=dev
  if errorlevel 1 (
    echo  npm install ist fehlgeschlagen - Internetverbindung pruefen.
    pause
    exit /b 1
  )
)
node server.js
pause
