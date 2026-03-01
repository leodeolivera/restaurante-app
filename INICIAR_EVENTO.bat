@echo off
title Restaurante - Iniciar Evento
cd /d "%~dp0"

echo ==========================================
echo   INICIANDO SISTEMA DO RESTAURANTE
echo ==========================================
echo.

REM 1) Inicia o JSON Server na porta 3002
start "JSON SERVER (3002)" cmd /k "npx json-server --watch db.json --port 3002 --host 0.0.0.0"

REM 2) Aguarda um pouco pro servidor subir
timeout /t 2 >nul

REM 3) Inicia o Vite (React)
start "APP (VITE)" cmd /k "npm run dev -- --host"

echo.
echo Abrindo o app no navegador...
timeout /t 2 >nul
start http://localhost:5175

echo.
echo Pronto. Pode minimizar as janelas.
pause