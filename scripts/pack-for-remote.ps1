# Empaqueta publish-win64 en un ZIP para copiar al servidor remoto
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'publish-win64'
$zip = Join-Path $root 'PortalClienchi-web-deploy.zip'

if (-not (Test-Path (Join-Path $source 'PortalClienchi.Web.exe'))) {
    Write-Host 'Falta publish-win64. Ejecuta primero: .\publish.ps1 -Mode standalone' -ForegroundColor Yellow
    exit 1
}

if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $source '*') -DestinationPath $zip -CompressionLevel Optimal

Write-Host ''
Write-Host "ZIP listo: $zip" -ForegroundColor Green
Write-Host 'Copialo al servidor remoto (RDP, carpeta compartida, etc.) y descomprimilo.'
