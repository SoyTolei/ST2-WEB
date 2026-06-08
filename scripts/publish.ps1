# Publica PortalClienchi.Web para despliegue
param(
    [ValidateSet('framework', 'standalone')]
    [string]$Mode = 'standalone'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$project = Join-Path $root 'src\PortalClienchi.Web\PortalClienchi.Web.csproj'

if ($Mode -eq 'standalone') {
    $out = Join-Path $root 'publish-win64'
    dotnet publish $project -c Release -r win-x64 --self-contained true -o $out
    $exe = Join-Path $out 'PortalClienchi.Web.exe'
} else {
    $out = Join-Path $root 'publish'
    dotnet publish $project -c Release -o $out
    $exe = 'dotnet PortalClienchi.Web.dll'
}

$runCmd = if ($Mode -eq 'standalone') { 'PortalClienchi.Web.exe' } else { 'dotnet PortalClienchi.Web.dll' }

$bat = Join-Path $out 'start-portal.bat'
@(
    '@echo off',
    'setlocal',
    'cd /d "%~dp0"',
    '',
    'set ASPNETCORE_ENVIRONMENT=Production',
    'set ASPNETCORE_URLS=http://0.0.0.0:5180',
    '',
    'echo PortalClienchi Web',
    'echo Local:  http://localhost:5180',
    'echo Red LAN: http://TU-IP:5180',
    'echo.',
    'echo Credenciales portal: appsettings.local.json (esta carpeta)',
    'echo Oportunidades SQLite: %%LOCALAPPDATA%%\ST2\oportunidades.db',
    'echo Ctrl+C para detener.',
    'echo.',
    '',
    $runCmd
) | Set-Content -Path $bat -Encoding ASCII

Write-Host ""
Write-Host "Listo: $out" -ForegroundColor Green
Write-Host "Ejecutar: $bat"
