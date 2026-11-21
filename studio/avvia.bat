@echo off
title Arte da colorare
cd /d "%~dp0"

echo ==========================================
echo    ARTE DA COLORARE
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRORE] Node.js non e' installato.
  echo Scaricalo da https://nodejs.org ^(versione LTS^), installalo e poi rifai doppio clic su questo file.
  start "" https://nodejs.org
  pause
  exit /b 1
)

if not exist ".dev.vars" (
  echo [ATTENZIONE] Manca il file .dev.vars: la versione puzzle funziona, quella con AI no.
  echo Per l'AI crea .dev.vars con:
  echo   GEMINI_API_KEY=la-tua-chiave
  echo   APP_PASSWORD=la-tua-password
  echo.
)

if not exist "node_modules\wrangler" (
  echo Primo avvio: installo i componenti necessari ^(1-2 minuti, solo la prima volta^)...
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo [ERRORE] Installazione non riuscita. Controlla la connessione internet e riprova.
    pause
    exit /b 1
  )
  echo.
)

echo Avvio del server... il browser si aprira' da solo.
echo   Puzzle (senza AI):  http://localhost:8787
echo   Versione con AI:    http://localhost:8787/ai.html
echo.
echo Per chiudere l'app chiudi questa finestra.
echo.

start "" /min cmd /c "timeout /t 8 /nobreak >nul & start http://localhost:8787"

set WRANGLER_SEND_METRICS=false
call npx wrangler dev --ip 127.0.0.1 --port 8787

echo.
echo Il server si e' fermato.
pause
