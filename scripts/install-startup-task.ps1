# Ejecutar EN EL SERVIDOR REMOTO (PowerShell como Administrador)
# Registra la app para que arranque al iniciar Windows
param(
    [Parameter(Mandatory = $true)]
    [string]$AppFolder
)

$ErrorActionPreference = 'Stop'
$exe = Join-Path $AppFolder 'PortalClienchi.Web.exe'
$bat = Join-Path $AppFolder 'start-portal.bat'

if (-not (Test-Path $exe)) {
    Write-Error "No se encontro PortalClienchi.Web.exe en: $AppFolder"
}

$taskName = 'PortalClienchiWeb'
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false }

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$bat`"" -WorkingDirectory $AppFolder
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest -Description 'Portal Clienchi Web en puerto 5180' | Out-Null

Write-Host ''
Write-Host "Tarea '$taskName' creada. Arranca al prender el servidor." -ForegroundColor Green
Write-Host "Probar ahora: Start-ScheduledTask -TaskName '$taskName'"
Write-Host "URL: http://localhost:5180"
