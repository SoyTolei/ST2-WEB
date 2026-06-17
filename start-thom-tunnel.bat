@echo off
setlocal EnableExtensions
title ST2 - Tunel THOM (Railway)
cd /d "%~dp0"

echo.
echo  ST2 - Tunel THOM para embeber en Railway
echo  Carpeta: %CD%
echo.
echo  NO abras el archivo .ps1 con doble clic (se abre en Bloc de notas).
echo  Usa SIEMPRE este archivo .bat
echo.

where cloudflared >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Falta cloudflared.
    echo  Instalalo con: winget install Cloudflare.cloudflared
    echo  Luego cierra esta ventana, abri una nueva y volve a ejecutar este .bat
    echo.
    pause
    exit /b 1
)

set "PORT=5180"
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    if not exist "%~dp0publish-win64\start-portal.bat" (
        echo  [ERROR] No hay servidor en puerto %PORT%.
        echo  Ejecuta primero: scripts\publish.ps1
        echo.
        pause
        exit /b 1
    )
    echo  Iniciando ST2 local en puerto %PORT%...
    start "ST2 Local" "%~dp0publish-win64\start-portal.bat"
    timeout /t 5 /nobreak >nul
)

echo.
echo  Tunel activo - deja esta ventana ABIERTA con VPN activa
echo.
echo  En Railway - Variables - agrega:
echo    THOM_PROXY_BASE_URL = la URL https de abajo (sin /css-tap)
echo.
echo  Ctrl+C para detener el tunel.
echo.

cloudflared tunnel --url http://127.0.0.1:%PORT%
echo.
pause
