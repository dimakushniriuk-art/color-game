@echo off
rem Avvia il pannello admin in locale: http://localhost:5180
cd /d "%~dp0"
where npm >nul 2>nul || (echo Node.js non trovato: installalo da https://nodejs.org e riprova. & pause & exit /b 1)
if not exist node_modules (echo Installo le dipendenze, la prima volta ci vuole un minuto... & call npm install)
echo.
echo Admin in avvio su http://localhost:5180  - lascia aperta questa finestra.
call npx vite --port 5180 --strictPort
pause
