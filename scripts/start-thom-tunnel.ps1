# Expone ST2 local (con VPN) por túnel HTTPS para embeber THOM en Railway.
# Requiere: cloudflared (https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)
param(
    [int]$Port = 5180
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$bat = Join-Path $root 'publish-win64\start-portal.bat'

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host 'Instalá cloudflared y volvé a ejecutar este script.' -ForegroundColor Yellow
    Write-Host '  winget install Cloudflare.cloudflared'
    exit 1
}

$listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
    if (-not (Test-Path $bat)) {
        Write-Host "No hay servidor en :$Port. Ejecutá primero: .\scripts\publish.ps1" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Iniciando ST2 local en puerto $Port..."
    Start-Process cmd.exe -ArgumentList "/c start `"ST2`" `"$bat`""
    Start-Sleep -Seconds 5
}

Write-Host ''
Write-Host 'Túnel THOM (dejá esta ventana abierta con VPN activa)' -ForegroundColor Cyan
Write-Host ''
Write-Host 'En Railway → Variables → agregá:' -ForegroundColor Green
Write-Host '  THOM_PROXY_BASE_URL = (la URL https que aparece abajo, sin /css-tap al final)'
Write-Host ''
Write-Host 'Luego redeploy o reiniciá el servicio en Railway.'
Write-Host ''

& cloudflared tunnel --url "http://127.0.0.1:$Port"
