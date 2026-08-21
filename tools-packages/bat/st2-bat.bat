<# :
@echo off
setlocal EnableExtensions
cd /d "%~dp0"
start "Soluciones Tecnologicas Bejerman" powershell.exe -NoProfile -ExecutionPolicy Bypass -NoLogo -Command "$script:ST2Self='%~f0'; Invoke-Expression ([System.IO.File]::ReadAllText('%~f0'))"
exit /b 0
#>
<#
.SYNOPSIS
  Soluciones Tecnologicas Bejerman - herramienta TEC (PowerShell)

.NOTES
  Compatible con Windows PowerShell 5.1.
  Fuente de verdad: ST2.ps1. Entregable embebido: ST2.bat.
  Version: ver $script:ST2Version
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

#region Elevacion y consola
function Test-IsAdministrator {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Request-Elevation {
  if (Test-IsAdministrator) { return }
  $target = $null
  if ($script:ST2Self -and (Test-Path -LiteralPath $script:ST2Self)) { $target = $script:ST2Self }
  elseif ($PSCommandPath) { $target = $PSCommandPath }
  elseif ($MyInvocation.MyCommand.Path) { $target = $MyInvocation.MyCommand.Path }
  if (-not $target) {
    Write-Host 'No se pudo re-lanzar como administrador. Ejecute este archivo como admin.'
    Read-Host 'ENTER'
    exit 1
  }
  $escaped = $target.Replace("'", "''")
  $cmd = "`$script:ST2Self='$escaped'; Invoke-Expression ([System.IO.File]::ReadAllText('$escaped'))"
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'powershell.exe'
  $psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -NoLogo -Command $cmd"
  $psi.Verb = 'runas'
  try { [Diagnostics.Process]::Start($psi) | Out-Null } catch {
    Write-Host 'Elevacion cancelada o fallida.'
    Read-Host 'ENTER'
    exit 1
  }
  exit 0
}

function Initialize-Console {
  try {
    $host.UI.RawUI.WindowTitle = ("Soluciones Tecnologicas Bejerman - PowerShell v{0}" -f $script:ST2Version)
    $host.UI.RawUI.BackgroundColor = 'Black'
    $host.UI.RawUI.ForegroundColor = 'White'
    Clear-Host

    # Ancho para el logo ASCII completo (~112 cols). Buffer un poco mas ancho.
    $buf = $host.UI.RawUI.BufferSize
    $win = $host.UI.RawUI.WindowSize
    $wantW = 118
    $wantH = 32

    if ($buf.Width -lt $wantW) {
      $buf.Width = $wantW
      $host.UI.RawUI.BufferSize = $buf
      $buf = $host.UI.RawUI.BufferSize
    }
    if ($buf.Height -lt 200) {
      $buf.Height = 1000
      try { $host.UI.RawUI.BufferSize = $buf } catch { }
      $buf = $host.UI.RawUI.BufferSize
    }

    $win.Width = [Math]::Min($wantW, $buf.Width)
    $win.Height = [Math]::Min($wantH, $buf.Height)
    $host.UI.RawUI.WindowSize = $win
  } catch {
    # Consola embebida / restringida: ignorar
  }
}
#endregion

#region Datos compartidos
$script:ST2Version = '2026.08.11m'
$script:MenuPad = '  '
$script:RutaSB = $null
$script:TerminalUser = "Terminal: $env:USERNAME"
$script:LogPath = $null
$script:LogDir = $null
$script:ReportPath = $null
$script:ReportPathStable = $null
$script:LastRegAsmDetail = ''
$script:StepOk = 0
$script:StepObs = 0
$script:StepErr = 0
$script:SessionActions = New-Object System.Collections.Generic.List[object]
# Nombres sospechosos / renombrados (se evalua sobre el nombre SIN extension)
# Ej: SB_old.dll, copia_gral.exe, archivo.bak, file__2.dll, tool_ok.exe
$script:RenameTokens = @(
  'old', 'vieja', 'viejo', 'backup', 'bak', 'copia', 'copy',
  'temp', 'tmp', 'renombrado', 'renombrada', 'renombrad', 'funcionaok', 'original', 'antes'
)
# "nuevo/nueva" solo con _ o - (evita "formato nuevo de bancón", etc.)
$script:RenameTokensStrict = @('nuevo', 'nueva')
# Falsos positivos conocidos (no son renombrados)
$script:RenameIgnoreRx = '(?i)banco\s*de\s*c[oó]rdoba|banc[oó]n|formato\s+nuevo\s+de\s+banc'

$script:CompatExes = @(
  'ActAutoWeb.exe'
  'ActivPayRoll.exe'
  'ActivSistema.exe'
  'GRALSQL.EXE'
  'ASCIIBBsql.exe'
  'EnvioPdfsMail.exe'
  'FactElec.exe'
  'SBADmrdo.EXE'
  'SBHLVINC.exe'
  'SBImporEO.exe'
  'SBUPDATE.exe'
  'TCACTIND.exe'
  'ToolbRDO.exe'
  'WSBAuto.exe'
  'ZipSB.exe'
  'Crystal6\SBRptRdoEXE6.exe'
  'CrystalXI\SBRptRdoEXE.exe'
  'CrystalXIMP\SBRptRdoEXEMP.exe'
)

$script:FirewallPrograms = @(
  @{ Name = 'ActAutoWeb.exe'; Rel = 'ActAutoWeb.exe' }
  @{ Name = 'ActivPayRoll.exe'; Rel = 'ActivPayRoll.exe' }
  @{ Name = 'ActivSistema.exe'; Rel = 'ActivSistema.exe' }
  @{ Name = 'GRALSQL.EXE'; Rel = 'GRALSQL.EXE' }
  @{ Name = 'ASCIIBBsql.exe'; Rel = 'ASCIIBBsql.exe' }
  @{ Name = 'EnvioPdfsMail.exe'; Rel = 'EnvioPdfsMail.exe' }
  @{ Name = 'FactElec.exe'; Rel = 'FactElec.exe' }
  @{ Name = 'GenAstosL.exe'; Rel = 'GenAstosL.exe' }
  @{ Name = 'instdrv.exe'; Rel = 'instdrv.exe' }
  @{ Name = 'openssl.exe'; Rel = 'openssl.exe' }
  @{ Name = 'regini.exe'; Rel = 'regini.exe' }
  @{ Name = 'RG3940.exe'; Rel = 'RG3940.exe' }
  @{ Name = 'Sbadmrdo.exe'; Rel = 'Sbadmrdo.exe' }
  @{ Name = 'SBHLVINC.exe'; Rel = 'SBHLVINC.exe' }
  @{ Name = 'SBImporEO.exe'; Rel = 'SBImporEO.exe' }
  @{ Name = 'SBUPDATE.exe'; Rel = 'SBUPDATE.exe' }
  @{ Name = 'TCACTIND.exe'; Rel = 'TCACTIND.exe' }
  @{ Name = 'ToolbRDO.exe'; Rel = 'ToolbRDO.exe' }
  @{ Name = 'WFRIMPCV.EXE'; Rel = 'WFRIMPCV.EXE' }
  @{ Name = 'WSBAuto.exe'; Rel = 'WSBAuto.exe' }
  @{ Name = 'ZipSB.exe'; Rel = 'ZipSB.exe' }
  @{ Name = 'SBRptRdoEXE6.exe'; Rel = 'Crystal6\SBRptRdoEXE6.exe' }
  @{ Name = 'SBRptRdoEXE.exe'; Rel = 'CrystalXI\SBRptRdoEXE.exe' }
  @{ Name = 'SBRptRdoEXEMP.exe'; Rel = 'CrystalXIMP\SBRptRdoEXEMP.exe' }
  @{ Name = 'ConexEFWEBws.exe'; Rel = 'Eflexweb\ConexEFWEBws.exe' }
  @{ Name = 'conexImpEFWws.exe'; Rel = 'Eflexweb\conexImpEFWws.exe' }
  @{ Name = 'ConexINBOX.exe'; Rel = 'Eflexweb\ConexINBOX.exe' }
  @{ Name = 'eFlexMPCobros.exe'; Rel = 'Eflexweb\eFlexMPCobros.exe' }
  @{ Name = 'EnvioMails.exe'; Rel = 'Eflexweb\EnvioMails.exe' }
  @{ Name = 'EW_Autorizaciones.exe'; Rel = 'Eflexweb\EW_Autorizaciones.exe' }
  @{ Name = 'MACTAUT.exe'; Rel = 'Eflexweb\MACTAUT.exe' }
  @{ Name = 'QueryMails.exe'; Rel = 'Eflexweb\QueryMails.exe' }
  @{ Name = 'VerazInformeCredito.exe'; Rel = 'Eflexweb\VerazInformeCredito.exe' }
  @{ Name = 'WebBrowser.exe'; Rel = 'Eflexweb\WebBrowser.exe' }
)

$script:CompatRemoveExes = @(
  'ActAutoWeb.exe'
  'ActivPayRoll.exe'
  'ActivSistema.exe'
  'GRALSQL.EXE'
  'ASCIIBBsql.exe'
  'EnvioPdfsMail.exe'
  'FactElec.exe'
  'GenAstosL.exe'
  'instdrv.exe'
  'openssl.exe'
  'regini.exe'
  'RG3940.exe'
  'Sbadmrdo.exe'
  'SBHLVINC.exe'
  'SBImporEO.exe'
  'SBUPDATE.exe'
  'TCACTIND.exe'
  'ToolbRDO.exe'
  'WFRIMPCV.EXE'
  'WSBAuto.exe'
  'ZipSB.exe'
  'Crystal6\SBRptRdoEXE6.exe'
  'CrystalXI\SBRptRdoEXE.exe'
  'CrystalXIMP\SBRptRdoEXEMP.exe'
  'Eflexweb\ConexEFWEBws.exe'
  'Eflexweb\conexImpEFWws.exe'
  'Eflexweb\ConexINBOX.exe'
  'Eflexweb\eFlexMPCobros.exe'
  'Eflexweb\EnvioMails.exe'
  'Eflexweb\EW_Autorizaciones.exe'
  'Eflexweb\MACTAUT.exe'
  'Eflexweb\QueryMails.exe'
  'Eflexweb\VerazInformeCredito.exe'
  'Eflexweb\WebBrowser.exe'
)

$script:BejermanProcesses = @(
  'Sbadmrdo.EXE'
  'SBRptRdoEXE.EXE'
  'SBRptRdoEXE6.EXE'
  'SBRptRdoEXEMP.EXE'
  'ToolbRDO.EXE'
  'WSBAuto.exe'
  'ActAutoWeb.exe'
  'cgadmsql.exe'
  'contsql.exe'
  'FactElec.exe'
  'sjsql.exe'
  'sjadmsql.exe'
  'ActivSistema.exe'
  'Sbhlvinc.exe'
  'MSACCESS.exe'
  'servicecenterapp.exe'
  'EstuOne.exe'
)

$script:CrystalProcesses = @(
  'SBRptRdoEXE.EXE'
  'SBRptRdoEXE6.EXE'
  'SBRptRdoEXEMP.EXE'
)

$script:SysWowComponents = @(
  'MSVBVM60.DLL'
  'EpsonFPHostControlX.ocx'
  'HasarArgentina.ocx'
  'msflxgrd.ocx'
  'SBHK.dll'
)

$script:TlbPrincipal = @(
  @{ Dll = 'BlueMoon.SambaClientInterface.dll'; Tlb = 'BlueMoon.SambaClientInterface.tlb' }
  @{ Dll = 'BlueMoon.OnvioClientInterface.dll'; Tlb = 'BlueMoon.OnvioClientInterface.tlb' }
  @{ Dll = 'SB.NET.sistemas.database.dll'; Tlb = 'SB.NET.sistemas.database.tlb' }
  @{ Dll = 'SB.NET.sistemas.onvio.dms.onpremise.dll'; Tlb = 'SB.NET.sistemas.onvio.dms.onpremise.tlb' }
  @{ Dll = 'SB.NET.sistemas.afip.dll'; Tlb = 'SB.NET.sistemas.afip.tlb' }
  @{ Dll = 'SB.NET.eflex.informecredito.dll'; Tlb = 'SB.NET.eflex.informecredito.tlb' }
  @{ Dll = 'SB.NET.eflexpublicacionMP.dll'; Tlb = 'SB.NET.eflexpublicacionMP.tlb' }
  @{ Dll = 'SB.NET.WEB.Queries.dll'; Tlb = 'SB.NET.WEB.Queries.tlb' }
)

$script:TlbComplementarias = @(
  @{ Dll = 'bluemoon.coreservices.web.models.dll'; Tlb = 'bluemoon.coreservices.web.models.tlb' }
)

$script:RegionalSettings = @{
  sCurrency        = '$'
  sDate            = '/'
  sGrouping        = '3;0'
  sMonGrouping     = '0123456789'
  sNativeDigits    = '0123456789'
  sNegativeSign    = '-'
  sPositiveSign    = ''
  sTime            = ':'
  iCalendarType    = '1'
  iCurrDigits      = '2'
  iDigits          = '2'
  NumShape         = '1'
  iFirstDayOfWeek  = '6'
  iFirstWeekOfYear = '0'
  iLZero           = '1'
  iNegNumber       = '1'
  iTimePrefix      = '0'
  Locale           = '00002C0A'
  LocaleName       = 'es-AR'
  s1159            = 'a.m.'
  s2359            = 'p.m.'
  sCountry         = 'Argentina'
  sDecimal         = ','
  sLanguage        = 'ESS'
  sList            = ';'
  sLongDate        = "dddd, dd 'de' MMMM 'de' yyyy"
  sMonDecimalSep   = ','
  sMonThousandSep  = '.'
  sShortDate       = 'dd/MM/yyyy'
  sThousand        = '.'
  sTimeFormat      = 'HH:mm:ss tt'
  sShortTime       = 'HH:mm tt'
  sYearMonth       = "MMMM 'de' yyyy"
  iCountry         = '54'
  iCurrency        = '2'
  iDate            = '1'
  iMeasure         = '0'
  iNegCurr         = '9'
  iPaperSize       = '9'
  iTime            = '1'
  iTLZero          = '1'
}
#endregion

#region Log y feedback
function Initialize-ST2Log {
  $script:LogDir = Join-Path $env:TEMP 'ST2'
  if (-not (Test-Path -LiteralPath $script:LogDir)) {
    $null = New-Item -ItemType Directory -Path $script:LogDir -Force
  }
  $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
  $script:LogPath = Join-Path $script:LogDir ("ST2_{0}.log" -f $stamp)
  $script:ReportPath = Join-Path $script:LogDir ("ST2_informe_{0}.txt" -f $stamp)
  $script:ReportPathStable = Join-Path $script:LogDir 'ST2_informe_sesion.txt'
  $global:ST2ReportPath = $script:ReportPath
  $script:SessionActions = New-Object System.Collections.Generic.List[object]
  Write-ST2Log ("=== ST2 v{0} session start user={1} computer={2} admin={3} ===" -f $script:ST2Version, $env:USERNAME, $env:COMPUTERNAME, (Test-IsAdministrator))
  $null = Update-SessionReportFile
}

function Write-ST2Log {
  param(
    [Parameter(Mandatory)][string]$Message,
    [ValidateSet('INFO', 'OK', 'OBS', 'ERROR', 'WARN')]
    [string]$Level = 'INFO'
  )
  if (-not $script:LogPath) { return }
  $line = '{0:yyyy-MM-dd HH:mm:ss} [{1}] {2}' -f (Get-Date), $Level, $Message
  try {
    Add-Content -LiteralPath $script:LogPath -Value $line -Encoding UTF8 -ErrorAction Stop
  } catch {
    # No abortar por fallo de log
  }
}

function Get-FriendlyResultText {
  param([string]$Result = '')
  if (-not $Result) { return 'Sin resultado registrado.' }
  $ok = 0; $obs = 0; $err = 0
  if ($Result -match 'OK=(\d+)') { $ok = [int]$Matches[1] }
  if ($Result -match 'OBS=(\d+)') { $obs = [int]$Matches[1] }
  if ($Result -match 'ERROR=(\d+)') { $err = [int]$Matches[1] }
  if ($err -gt 0) {
    return ('Finalizo con errores ({0} OK, {1} observaciones, {2} errores).' -f $ok, $obs, $err)
  }
  if ($obs -gt 0) {
    return ('Finalizo con observaciones ({0} OK, {1} observaciones).' -f $ok, $obs)
  }
  if ($ok -gt 0) {
    return ('Finalizo correctamente ({0} pasos OK).' -f $ok)
  }
  return $Result
}

function Get-FriendlyCountsText {
  param($Counts = $null)
  if ($null -eq $Counts) { return @() }
  $map = @{
    ok              = 'Correctos'
    fail            = 'Con fallo'
    error           = 'Con fallo'
    missing         = 'No encontrados'
    omitidas        = 'Omitidos'
    omitidas_no_COM = 'Omitidos (no registrables)'
    omitidas_nombre = 'Omitidos (nombre sospechoso)'
    exe_ok          = 'Ejecutables OK'
    exe_fail        = 'Ejecutables con fallo'
    nocom           = 'No registrables'
    skip            = 'Omitidos'
    eliminadas      = 'Impresoras eliminadas'
    analizados      = 'Analizados'
    coincidencias   = 'Coincidencias'
    scanned         = 'Archivos analizados'
    faltantes       = 'Faltan en local'
    updates_nuevo   = 'Updates mas nuevo (local viejo)'
    local_nuevo     = 'Local mas nuevo (informativo)'
    relevantes      = 'Diferencias relevantes'
    destinos        = 'Destinos LOCAL unicos'
  }
  $lines = New-Object System.Collections.Generic.List[string]
  try {
    if ($Counts -is [hashtable] -or $Counts -is [System.Collections.IDictionary]) {
      if ($Counts.Count -eq 0) { return @() }
      foreach ($k in ($Counts.Keys | Sort-Object)) {
        $ks = [string]$k
        $label = if ($map.ContainsKey($ks)) { $map[$ks] } else { $ks }
        $lines.Add(('  - {0}: {1}' -f $label, $Counts[$k]))
      }
    }
  } catch { }
  return @($lines)
}

function Build-SessionReportText {
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine('============================================================')
  [void]$sb.AppendLine(('  INFORME DE SESION ST2  v{0}' -f $script:ST2Version))
  [void]$sb.AppendLine('============================================================')
  [void]$sb.AppendLine(('Fecha:   {0:dd/MM/yyyy HH:mm:ss}' -f (Get-Date)))
  [void]$sb.AppendLine(('Usuario: {0}' -f $env:USERNAME))
  [void]$sb.AppendLine(('Equipo:  {0}' -f $env:COMPUTERNAME))
  [void]$sb.AppendLine(('RutaSB:  {0}' -f $script:RutaSB))
  [void]$sb.AppendLine('')
  [void]$sb.AppendLine('Este informe se actualiza al terminar cada operacion.')
  [void]$sb.AppendLine('============================================================')
  [void]$sb.AppendLine('')

  $actionCount = 0
  try {
    if ($null -ne $script:SessionActions) { $actionCount = [int]$script:SessionActions.Count }
  } catch { $actionCount = 0 }

  if ($actionCount -eq 0) {
    [void]$sb.AppendLine('Todavia no se ejecuto ninguna operacion en esta sesion.')
    [void]$sb.AppendLine('')
    return $sb.ToString()
  }

  $n = 0
  foreach ($a in $script:SessionActions) {
    $n++
    [void]$sb.AppendLine('------------------------------------------------------------')
    [void]$sb.AppendLine(('{0}. {1}' -f $n, [string]$a.Title))
    [void]$sb.AppendLine(('   Hora:      {0:HH:mm:ss}' -f $a.Time))
    if ($a.Description) {
      [void]$sb.AppendLine(('   Que hizo:  {0}' -f [string]$a.Description))
    }
    [void]$sb.AppendLine(('   Resultado: {0}' -f (Get-FriendlyResultText -Result ([string]$a.Result))))
    $countLines = @(Get-FriendlyCountsText -Counts $a.Counts)
    if ($countLines.Count -gt 0) {
      [void]$sb.AppendLine('   Detalle:')
      foreach ($cl in $countLines) { [void]$sb.AppendLine(('   {0}' -f ([string]$cl).TrimStart())) }
    }
    $skips = @()
    try { if ($null -ne $a.SkipList) { foreach ($s in $a.SkipList) { $skips += [string]$s } } } catch { }
    if ($skips.Count -gt 0) {
      [void]$sb.AppendLine(('   Omitidos ({0}):' -f $skips.Count))
      $max = [Math]::Min(40, $skips.Count)
      for ($i = 0; $i -lt $max; $i++) {
        [void]$sb.AppendLine(('     - {0}' -f $skips[$i]))
      }
      if ($skips.Count -gt 40) {
        [void]$sb.AppendLine(('     ... y {0} mas' -f ($skips.Count - 40)))
      }
    }
    $fails = @()
    try { if ($null -ne $a.FailList) { foreach ($f in $a.FailList) { $fails += [string]$f } } } catch { }
    if ($fails.Count -gt 0) {
      [void]$sb.AppendLine(('   Problemas ({0}):' -f $fails.Count))
      $maxF = [Math]::Min(40, $fails.Count)
      for ($i = 0; $i -lt $maxF; $i++) {
        [void]$sb.AppendLine(('     - {0}' -f $fails[$i]))
      }
      if ($fails.Count -gt 40) {
        [void]$sb.AppendLine(('     ... y {0} mas' -f ($fails.Count - 40)))
      }
    }
    [void]$sb.AppendLine('')
  }
  [void]$sb.AppendLine('============================================================')
  [void]$sb.AppendLine('Fin del informe.')
  return $sb.ToString()
}

function Update-SessionReportFile {
  $path = $script:ReportPath
  if (-not $path) { $path = $global:ST2ReportPath }
  if (-not $path) { return $false }

  # Copia estable (siempre el mismo nombre) + la version con timestamp
  $stable = $null
  if ($script:LogDir) {
    $stable = Join-Path $script:LogDir 'ST2_informe_sesion.txt'
  }

  try {
    $text = [string](Build-SessionReportText)
    if ([string]::IsNullOrEmpty($text)) {
      $text = 'Informe vacio (sin contenido generado).'
    }
    $dir = Split-Path -Parent $path
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
      $null = New-Item -ItemType Directory -Path $dir -Force
    }
    $utf8 = New-Object System.Text.UTF8Encoding $true
    [System.IO.File]::WriteAllText($path, $text, $utf8)
    if ($stable) {
      [System.IO.File]::WriteAllText($stable, $text, $utf8)
      $script:ReportPathStable = $stable
    }
    try {
      $len = (Get-Item -LiteralPath $path -ErrorAction Stop).Length
      Write-ST2Log ("Informe TXT actualizado ({0} bytes): {1}" -f $len, $path) 'INFO'
    } catch { }
    return $true
  } catch {
    $msg = $_.Exception.Message
    try { Write-ST2Log ("Informe TXT ERROR al guardar: {0}" -f $msg) 'ERROR' } catch { }
    try {
      Write-Host ("    [OBS] No se pudo guardar el informe TXT: {0}" -f $msg) -ForegroundColor Yellow
    } catch { }
    return $false
  }
}

function Add-SessionAction {
  param(
    [Parameter(Mandatory)][string]$Title,
    [string]$Description = '',
    [string]$Result = '',
    $Counts = @{},
    [string[]]$FailList = @(),
    [string[]]$SkipList = @()
  )
  if ($null -eq $Counts) { $Counts = @{} }
  if (-not $script:SessionActions) {
    $script:SessionActions = New-Object System.Collections.Generic.List[object]
  }
  $script:SessionActions.Add([pscustomobject]@{
      Time        = Get-Date
      Title       = $Title
      Description = $Description
      Result      = $Result
      Counts      = $Counts
      FailList    = @($FailList)
      SkipList    = @($SkipList)
    })
  $null = Update-SessionReportFile
}

function Test-IsSuspiciousName {
  param([Parameter(Mandatory)][string]$Name)
  if ([string]::IsNullOrWhiteSpace($Name)) { return $false }
  $n = $Name
  if ($n -match $script:RenameIgnoreRx) { return $false }

  if ($n -match '__|_$' ) { return $true }

  $stem = [System.IO.Path]::GetFileNameWithoutExtension($n)
  if ([string]::IsNullOrWhiteSpace($stem)) { $stem = $n }

  foreach ($tok in $script:RenameTokens) {
    if ($n -match ('(?i)(^|[_\-\s\.\[\(]){0}([_\-\s\.\]\)]|$)' -f [regex]::Escape($tok))) {
      return $true
    }
  }
  foreach ($tok in $script:RenameTokensStrict) {
    if ($n -match ('(?i)(^|[_\-\.]){0}([_\-\.]|$)' -f [regex]::Escape($tok))) {
      return $true
    }
  }

  if ($stem -match '(?i)(^|[_\-])ok([_\-]|$)') { return $true }
  if ($stem -match '(?i)\(\d+\)$') { return $true }
  if ($stem -match '(?i)\s-\s*copy$') { return $true }

  return $false
}

function Get-SuspiciousReason {
  param([Parameter(Mandatory)][string]$Name)
  $n = $Name
  if ($n -match $script:RenameIgnoreRx) { return '' }
  if ($n -match '__') { return 'doble guion bajo (__)' }
  if ($n -match '_$') { return 'termina en _' }
  $stem = [System.IO.Path]::GetFileNameWithoutExtension($n)
  if ([string]::IsNullOrWhiteSpace($stem)) { $stem = $n }
  foreach ($tok in $script:RenameTokens) {
    if ($n -match ('(?i)(^|[_\-\s\.\[\(]){0}([_\-\s\.\]\)]|$)' -f [regex]::Escape($tok))) {
      return ('contiene "{0}"' -f $tok)
    }
  }
  foreach ($tok in $script:RenameTokensStrict) {
    if ($n -match ('(?i)(^|[_\-\.]){0}([_\-\.]|$)' -f [regex]::Escape($tok))) {
      return ('contiene "{0}"' -f $tok)
    }
  }
  if ($stem -match '(?i)(^|[_\-])ok([_\-]|$)') { return 'contiene "ok"' }
  if ($stem -match '(?i)\(\d+\)$') { return 'sufijo (n)' }
  if ($stem -match '(?i)\s-\s*copy$') { return 'sufijo - Copy' }
  return 'patron sospechoso'
}

function Get-RegSvrClass {
  param([int]$Code)
  # 0 = registrado OK
  # cualquier otro = no registrable / esperado (BAT viejo lo ignoraba en silencio)
  # code 3/4/5 tipicos: OleInit, LoadLibrary, sin DllRegisterServer
  if ($Code -eq 0) { return 'OK' }
  return 'NOCOM'
}

function Write-SimpleProgress {
  param(
    [int]$Current,
    [int]$Total,
    [string]$Label = ''
  )
  if ($Total -le 0) { return }
  $name = if ($Label.Length -gt 40) { $Label.Substring(0, 37) + '...' } else { $Label }
  $line = '    [{0}/{1}] {2}' -f $Current, $Total, $name
  # Rellenar hasta el ancho de consola para borrar restos del archivo anterior (mismo renglón con `r)
  $width = 79
  try {
    if ($Host.UI.RawUI.WindowSize.Width -gt 10) {
      $width = $Host.UI.RawUI.WindowSize.Width - 1
    }
  } catch { }
  if ($line.Length -gt $width) { $line = $line.Substring(0, $width) }
  Write-Host ("`r{0}" -f $line.PadRight($width)) -NoNewline
  if ($Current -ge $Total) { Write-Host '' }
}

function Reset-StepCounters {
  $script:StepOk = 0
  $script:StepObs = 0
  $script:StepErr = 0
}

function Complete-Step {
  param(
    [ValidateSet('OK', 'OBS', 'ERROR')]
    [string]$Status = 'OK',
    [string]$Message = '',
    [string]$Detail = ''
  )
  switch ($Status) {
    'OK' {
      $script:StepOk++
      $msg = if ($Message) { $Message } else { 'Paso completado.' }
      Write-Status -Status OK -Message $msg
      Write-ST2Log ("{0} {1}" -f $msg, $Detail).Trim() 'OK'
    }
    'OBS' {
      $script:StepObs++
      $msg = if ($Message) { $Message } else { 'Paso completado con observaciones.' }
      Write-Status -Status OBS -Message $msg
      if ($Detail) { Write-Host ("          {0}" -f $Detail) -ForegroundColor DarkYellow }
      Write-ST2Log ("{0} | {1}" -f $msg, $Detail).Trim() 'OBS'
    }
    'ERROR' {
      $script:StepErr++
      $msg = if ($Message) { $Message } else { 'Paso con errores.' }
      Write-Status -Status ERROR -Message $msg
      if ($Detail) { Write-Host ("            {0}" -f $Detail) -ForegroundColor DarkRed }
      Write-ST2Log ("{0} | {1}" -f $msg, $Detail).Trim() 'ERROR'
    }
  }
  Write-Host ''
}

function Show-RoutineSummary {
  param(
    [string]$Title = 'Resumen',
    [string]$Description = '',
    [hashtable]$Counts = @{},
    [string[]]$FailList = @(),
    [string[]]$SkipList = @()
  )
  # Sin contadores en pantalla; se guardan para el menu de resumen/log
  Write-ST2Log ('SUMMARY {0} OK={1} OBS={2} ERR={3}' -f $Title, $script:StepOk, $script:StepObs, $script:StepErr)
  $result = 'OK={0} OBS={1} ERROR={2}' -f $script:StepOk, $script:StepObs, $script:StepErr
  Add-SessionAction -Title $Title -Description $Description -Result $result -Counts $Counts -FailList $FailList -SkipList $SkipList
  Write-Host ''
  Write-Host '  >> Procesos de la sesion actualizados.' -ForegroundColor Cyan
  Write-Host '     Ver detalle: menu principal > 4 (informe de sesion).' -ForegroundColor DarkGray
  $showPath = $script:ReportPathStable
  if (-not $showPath) { $showPath = $script:ReportPath }
  if ($showPath) {
    Write-Host ('     Archivo: {0}' -f $showPath) -ForegroundColor DarkGray
  }
}

function Confirm-Action {
  param(
    [Parameter(Mandatory)][string]$Title,
    [string[]]$Warnings = @()
  )
  Write-Host ''
  Write-Host $Title -ForegroundColor Yellow
  foreach ($w in $Warnings) {
    Write-Host ("  - {0}" -f $w) -ForegroundColor Yellow
  }
  Write-Host ''
  $opt = Read-Host 'Continuar? s/n'
  $ok = ($opt -and $opt.Trim().ToLowerInvariant() -eq 's')
  Write-ST2Log ("CONFIRM '{0}' => {1}" -f $Title, $(if ($ok) { 'SI' } else { 'NO' })) 'WARN'
  return $ok
}

function Ask-YesNo {
  param([string]$Question)
  Write-Host ''
  Write-Host $Question -ForegroundColor Yellow
  $opt = Read-Host 'Opcion s/n'
  return ($opt -and $opt.Trim().ToLowerInvariant() -eq 's')
}

function Invoke-RegisterFiles {
  param(
    [Parameter(Mandatory)][System.IO.FileInfo[]]$Files,
    [string]$Context = 'registro'
  )
  $ok = 0
  $nocom = 0
  $err = 0
  $skip = 0
  $failList = New-Object System.Collections.Generic.List[string]
  $skipList = New-Object System.Collections.Generic.List[string]
  $total = $Files.Count
  $i = 0
  foreach ($f in $Files) {
    $i++
    Write-SimpleProgress -Current $i -Total $total -Label $f.Name
    if (Test-IsSuspiciousName -Name $f.Name) {
      $skip++
      $skipList.Add($f.Name)
      Write-ST2Log ("{0} skip renombrada/sospechosa: {1}" -f $Context, $f.Name) 'OBS'
      continue
    }
    $code = Invoke-RegSvr32 -TargetPath $f.FullName
    $cls = Get-RegSvrClass -Code $code
    switch ($cls) {
      'OK' { $ok++ }
      'NOCOM' {
        $nocom++
        Write-ST2Log ("{0} no-COM (esperado, no se registra): {1} code={2}" -f $Context, $f.Name, $code) 'INFO'
      }
      default {
        $err++
        $failList.Add(('{0} (code={1})' -f $f.Name, $code))
        Write-ST2Log ("{0} error: {1} code={2}" -f $Context, $f.Name, $code) 'ERROR'
      }
    }
  }
  return [pscustomobject]@{
    Ok       = $ok
    NoCom    = $nocom
    Err      = $err
    Skip     = $skip
    FailList = @($failList)
    SkipList = @($skipList)
    Total    = $total
  }
}
#endregion

#region UI helpers
function Get-ConsoleWidth {
  try {
    $w = [int]$Host.UI.RawUI.WindowSize.Width
    if ($w -ge 40) { return $w }
  } catch { }
  return 80
}

function Get-CenteredLine {
  param(
    [Parameter(Mandatory)][string]$Text,
    [int]$Width = 0
  )
  if ($Width -le 0) { $Width = Get-ConsoleWidth }
  if ($Text.Length -ge $Width) {
    return $Text.Substring(0, [Math]::Max(1, $Width - 1))
  }
  $pad = [int][Math]::Floor(($Width - $Text.Length) / 2)
  return ((' ' * $pad) + $Text)
}

function Write-HostFit {
  param(
    [string]$Text = '',
    [ConsoleColor]$ForegroundColor = 'Gray'
  )
  $w = Get-ConsoleWidth
  if ($null -eq $Text) { $Text = '' }
  if ($Text.Length -ge $w) {
    $Text = $Text.Substring(0, [Math]::Max(1, $w - 1))
  }
  Write-Host $Text -ForegroundColor $ForegroundColor
}

function Write-RoutineHeader {
  param(
    [Parameter(Mandatory)][string]$Title
  )
  Write-Host '===============================================' -ForegroundColor DarkCyan
  Write-Host ('  >>  {0}' -f $Title) -ForegroundColor Cyan
  Write-Host '===============================================' -ForegroundColor DarkCyan
  Write-Host ''
}

function Write-RoutineFooter {
  param([Parameter(Mandatory)][string]$Title)
  Write-Host '===============================================' -ForegroundColor DarkCyan
  Write-Host ('   {0}' -f $Title) -ForegroundColor White
  Write-Host '===============================================' -ForegroundColor DarkCyan
}

function Fit-ConsoleToContent {
  # Recorta la ventana justo debajo del ultimo texto (sin hueco vacio enorme).
  param([int]$ExtraLines = 2, [int]$MinHeight = 16, [int]$MaxHeight = 42)
  try {
    $ui = $Host.UI.RawUI
    $y = [int]$ui.CursorPosition.Y
    $need = [Math]::Max($MinHeight, $y + $ExtraLines)
    $need = [Math]::Min($need, $MaxHeight)

    $buf = $ui.BufferSize
    if ($buf.Height -lt $need) {
      $buf.Height = [Math]::Max($need, 200)
      $ui.BufferSize = $buf
      $buf = $ui.BufferSize
    }

    $win = $ui.WindowSize
    $newH = [Math]::Min($need, $buf.Height)
    if ($win.Height -ne $newH) {
      $win.Height = $newH
      $ui.WindowSize = $win
    }
  } catch { }
}

function Expand-ConsoleForWork {
  # Pantallas de trabajo (listados largos): ventana mas alta + scroll.
  param([int]$Height = 40)
  try {
    $ui = $Host.UI.RawUI
    $buf = $ui.BufferSize
    if ($buf.Height -lt 500) {
      $buf.Height = 1000
      try { $ui.BufferSize = $buf } catch { }
      $buf = $ui.BufferSize
    }
    $win = $ui.WindowSize
    $win.Height = [Math]::Min($Height, $buf.Height)
    $w = Get-ConsoleWidth
    if ($w -lt 80) { $win.Width = [Math]::Min(90, $buf.Width) }
    $ui.WindowSize = $win
  } catch { }
}

function Write-BannerAscii {
  # Logo original completo (BEJERMAN + THOMSON REUTERS), centrado
  $w = Get-ConsoleWidth
  $rule = ('=' * [Math]::Max(20, $w - 1))
  $ver = ('ST2 PowerShell  v{0}' -f $script:ST2Version)

  Write-Host $rule -ForegroundColor DarkCyan
  Write-Host (Get-CenteredLine -Text $ver -Width $w) -ForegroundColor Gray
  Write-Host ''

  $art = @(
    '                ####          ##                                ####'
    '               ##    ##  ### ####  ###  #### ##   ###    ###    ## ##  ###   ##  ###  #### #### ##   ###   ####'
    '               ###   ## ##    ##  ## ## ## ## ##    ##  ##      ## ## ## ##  ## ## ## #### ## ## ##    ##  ## ##'
    '                ###  ## ###   ##  ## ## ## ## ##  ####  ###     ####  ## ##  ## ## ## ##   ## ## ##  ####  ## ##'
    '                 ### ##  ###  ##  ##### ## ## ## ## ##   ###    ## ## #####  ## ##### ##   ## ## ## ## ##  ## ##'
    '                  ## ##   ##  ##  ##    ## ## ## ## ##    ##    ## ## ##     ## ##    ##   ## ## ## ## ##  ## ##'
    '               ####  ## ###    ##  #### ## ## ##  ## ## ###     ####   ####  ##  #### ##   ## ## ##  ## ## ## ##'
    '                                                                           ###'
    ''
    '          ###### ##  ##  ######  ##    ## #####  ######  ##    ##    #####  #####  ##  ## ###### ##### #####  #####'
    '            ##   ##  ##  ##  ##  ###  ### ##     ##  ##  ###   ##    ##  #  ##     ##  ##   ##   ##    ##  #  ##'
    '            ##   ######  ##  ##  ## ## ## #####  ##  ##  ## #  ##    #####  ####   ##  ##   ##   ####  ####   #####'
    '            ##   ##  ##  ##  ##  ##    ##    ##  ##  ##  ##  # ##    ## ##  ##     ##  ##   ##   ##    ## ##     ##'
    '            ##   ##  ##  ######  ##    ## #####  ######  ##   ###    ##  ## #####  ######   ##   ##### ##  ## #####'
  )
  $artMax = 0
  foreach ($a in $art) { if ($a.Length -gt $artMax) { $artMax = $a.Length } }

  # Asegurar ancho suficiente para que no se corte el logo
  try {
    $ui = $Host.UI.RawUI
    $need = [Math]::Max($artMax + 2, 118)
    $buf = $ui.BufferSize
    if ($buf.Width -lt $need) {
      $buf.Width = $need
      $ui.BufferSize = $buf
      $buf = $ui.BufferSize
    }
    $win = $ui.WindowSize
    if ($win.Width -lt [Math]::Min($need, $buf.Width)) {
      $win.Width = [Math]::Min($need, $buf.Width)
      $ui.WindowSize = $win
    }
    $w = Get-ConsoleWidth
  } catch { }

  $left = [Math]::Max(0, [int][Math]::Floor(($w - $artMax) / 2))
  $pad = (' ' * $left)
  Write-Host ''
  foreach ($a in $art) {
    if ([string]::IsNullOrEmpty($a)) { Write-Host ''; continue }
    Write-Host ($pad + $a) -ForegroundColor DarkYellow
  }
  Write-Host ''
  Write-Host $rule -ForegroundColor DarkCyan
}

function Write-MenuBox {
  param(
    [string]$Title,
    [string[]]$Items
  )
  try {
    $Host.UI.RawUI.CursorPosition = @{ X = 0; Y = 0 }
  } catch { }
  Clear-Host

  $width = [Math]::Max(60, (Get-ConsoleWidth) - 1)
  $full = ('=' * $width)

  # Armar bloque de contenido y centrarlo ENTERO (mismo margen = no queda torcido)
  $rows = New-Object System.Collections.Generic.List[object]
  [void]$rows.Add([pscustomobject]@{ Kind = 'title'; Text = ('>>  {0}' -f $Title) })
  [void]$rows.Add([pscustomobject]@{ Kind = 'blank'; Text = '' })
  [void]$rows.Add([pscustomobject]@{ Kind = 'brand'; Text = 'Soluciones Tecnologicas' })
  [void]$rows.Add([pscustomobject]@{ Kind = 'meta'; Text = ('{0}  |  v{1}' -f $script:TerminalUser, $script:ST2Version) })
  [void]$rows.Add([pscustomobject]@{ Kind = 'blank'; Text = '' })
  [void]$rows.Add([pscustomobject]@{ Kind = 'soft'; Text = '' })
  [void]$rows.Add([pscustomobject]@{ Kind = 'blank'; Text = '' })

  foreach ($item in $Items) {
    $t = $item.Trim()
    if ($t -match '^(\d+(?:\.\d+)?)\s*-\s*(.+)$') {
      [void]$rows.Add([pscustomobject]@{ Kind = 'opt'; Num = $Matches[1]; Label = $Matches[2]; Text = ('[ {0} ]  {1}' -f $Matches[1], $Matches[2]) })
    } else {
      [void]$rows.Add([pscustomobject]@{ Kind = 'text'; Text = $t })
    }
    [void]$rows.Add([pscustomobject]@{ Kind = 'blank'; Text = '' })
  }

  [void]$rows.Add([pscustomobject]@{ Kind = 'soft'; Text = '' })

  $blockW = 24
  foreach ($r in $rows) {
    if ($r.Kind -eq 'blank' -or $r.Kind -eq 'soft') { continue }
    if ($r.Text.Length -gt $blockW) { $blockW = $r.Text.Length }
  }
  $blockW = [Math]::Min($blockW, $width - 4)
  $left = [Math]::Max(2, [int][Math]::Floor(($width - $blockW) / 2))
  $pad = (' ' * $left)
  $script:MenuPad = $pad
  $soft = ($pad + ('-' * $blockW))

  Write-Host $full -ForegroundColor DarkCyan
  Write-Host ''
  foreach ($r in $rows) {
    switch ($r.Kind) {
      'blank' { Write-Host ''; break }
      'soft'  { Write-Host $soft -ForegroundColor DarkCyan; break }
      'title' {
        Write-Host ($pad + $r.Text) -ForegroundColor Cyan
        break
      }
      'brand' {
        # Amarillo solo en la marca (no en todos los numeros)
        Write-Host ($pad + $r.Text) -ForegroundColor Yellow
        break
      }
      'meta' {
        Write-Host ($pad + $r.Text) -ForegroundColor DarkGray
        break
      }
      'hint' {
        Write-Host ($pad + $r.Text) -ForegroundColor DarkGray
        break
      }
      'opt' {
        Write-Host $pad -NoNewline
        Write-Host ('[ {0} ]  ' -f $r.Num) -ForegroundColor Cyan -NoNewline
        Write-Host $r.Label -ForegroundColor White
        break
      }
      default {
        Write-Host ($pad + $r.Text) -ForegroundColor White
      }
    }
  }
  Write-Host ''
  Write-Host $full -ForegroundColor DarkCyan
}

function Read-MenuOption {
  param([string]$Prompt = 'Opcion')
  $pad = if ($script:MenuPad) { $script:MenuPad } else { '  ' }
  Write-Host $pad -NoNewline
  $raw = Read-Host $Prompt
  if ($null -eq $raw) { return '' }
  return (($raw -replace '\s', '') -replace ',', '.')
}

function Ask-ExitOrContinue {
  Write-Host ''
  $opt = Read-Host 'Salir? s/n'
  if ($opt -and $opt.Trim().ToLowerInvariant() -eq 's') {
    Write-ST2Log 'Session end (user exit)'
    exit 0
  }
}

function Write-Status {
  param(
    [ValidateSet('OK', 'OBS', 'ERROR', 'INFO')]
    [string]$Status,
    [string]$Message
  )
  switch ($Status) {
    'OK' {
      Write-Host '  [OK] ' -ForegroundColor Green -NoNewline
      Write-Host $Message -ForegroundColor Green
    }
    'OBS' {
      Write-Host '  [OBS] ' -ForegroundColor Yellow -NoNewline
      Write-Host $Message -ForegroundColor Yellow
    }
    'ERROR' {
      Write-Host '  [ERROR] ' -ForegroundColor Red -NoNewline
      Write-Host $Message -ForegroundColor Red
    }
    default {
      Write-Host '  [INFO] ' -ForegroundColor Cyan -NoNewline
      Write-Host $Message -ForegroundColor Gray
    }
  }
}

function Get-SysRegDir {
  if (Test-Path -LiteralPath 'C:\Windows\SysWOW64') {
    return 'C:\Windows\SysWOW64'
  }
  return 'C:\Windows\System32'
}

function Get-RegAsmPath {
  $candidates = @(
    'C:\WINDOWS\Microsoft.NET\Framework\v4.0.30319\RegAsm.exe'
    'C:\WINDOWS\Microsoft.NET\Framework64\v4.0.30319\RegAsm.exe'
  )
  foreach ($p in $candidates) {
    if (Test-Path -LiteralPath $p) { return $p }
  }
  return $null
}

function Get-EflexWebDir {
  $candidates = @(
    (Join-Path $script:RutaSB 'EflexWeb')
    (Join-Path $script:RutaSB 'Eflexweb')
    'C:\Program Files (x86)\SistemasBejermanSQL\EflexWeb'
    'C:\Program Files (x86)\SistemasBejermanSQL\Eflexweb'
  )
  foreach ($c in $candidates) {
    if ($c -and (Test-Path -LiteralPath $c)) { return $c }
  }
  return $null
}

function Get-AssemblyLoadHint {
  param([Parameter(Mandatory)][string]$DllPath)
  # Intenta cargar la DLL para detectar dependencias faltantes (mensaje util)
  try {
    $bytes = [System.IO.File]::ReadAllBytes($DllPath)
    [void][System.Reflection.Assembly]::ReflectionOnlyLoad($bytes)
    return $null
  } catch {
    $m = $_.Exception.Message
    if ($_.Exception.InnerException) { $m = ($m + ' | ' + $_.Exception.InnerException.Message) }
    if ($m.Length -gt 240) { $m = $m.Substring(0, 240) }
    return $m
  }
}

function Invoke-RegAsm {
  param(
    [Parameter(Mandatory)][string]$DllPath,
    [Parameter(Mandatory)][string]$TlbName,
    [string]$RegAsmPath = $null
  )
  # Devuelve: 0=OK, otro=fallo. Detalle en $script:LastRegAsmDetail
  $script:LastRegAsmDetail = ''
  if (-not $RegAsmPath) { $RegAsmPath = Get-RegAsmPath }
  if (-not $RegAsmPath) {
    $script:LastRegAsmDetail = 'RegAsm.exe no encontrado'
    return 1
  }
  if (-not (Test-Path -LiteralPath $DllPath)) {
    $script:LastRegAsmDetail = 'DLL no existe'
    return 2
  }

  $workDir = Split-Path -Parent $DllPath
  $leaf = Split-Path $DllPath -Leaf

  # Probar x86 y, si falla por imagen/bitness, x64
  $regAsmList = New-Object System.Collections.Generic.List[string]
  [void]$regAsmList.Add($RegAsmPath)
  $alt = if ($RegAsmPath -match 'Framework64') {
    'C:\WINDOWS\Microsoft.NET\Framework\v4.0.30319\RegAsm.exe'
  } else {
    'C:\WINDOWS\Microsoft.NET\Framework64\v4.0.30319\RegAsm.exe'
  }
  if ((Test-Path -LiteralPath $alt) -and ($alt -ne $RegAsmPath)) { [void]$regAsmList.Add($alt) }

  $lastText = ''
  $lastCode = 1

  foreach ($ra in $regAsmList) {
    try {
      $psi = New-Object System.Diagnostics.ProcessStartInfo
      $psi.FileName = $ra
      $psi.Arguments = ('"{0}" /tlb:{1} /codebase /nologo' -f $DllPath, $TlbName)
      $psi.WorkingDirectory = $workDir
      $psi.UseShellExecute = $false
      $psi.RedirectStandardOutput = $true
      $psi.RedirectStandardError = $true
      $psi.CreateNoWindow = $true
      try {
        $psi.StandardOutputEncoding = [System.Text.Encoding]::Default
        $psi.StandardErrorEncoding = [System.Text.Encoding]::Default
      } catch { }

      $proc = New-Object System.Diagnostics.Process
      $proc.StartInfo = $psi
      [void]$proc.Start()
      $stdout = $proc.StandardOutput.ReadToEnd()
      $stderr = $proc.StandardError.ReadToEnd()
      $proc.WaitForExit()
      $code = [int]$proc.ExitCode
      $text = (@($stdout, $stderr) | Where-Object { $_ -and $_.ToString().Trim() }) -join ' '
      $text = ($text -replace '\s+', ' ').Trim()
      $lastText = $text
      $lastCode = $code

      $okMsg = $text -match '(?i)Types registered successfully|tipos registrados|registered successfully'
      # Warning RA0000 de /codebase sin firma: no es fallo
      $hasError = $text -match '(?i)\berror\s+RA\d+'
      $warnOnly = ($text -match '(?i)warning\s+RA0000') -and -not $hasError

      if ($code -eq 0 -or $okMsg -or $warnOnly) {
        Write-ST2Log ("RegAsm OK: {0} -> {1} via {2}" -f $leaf, $TlbName, $ra) $(if ($warnOnly) { 'WARN' } else { 'OK' })
        $script:LastRegAsmDetail = 'OK'
        return 0
      }

      # No exporta TLB / sin tipos COM: omitir (no es error de campo)
      if ($text -match '(?i)(error\s+RA0000).{0,80}(export|type library|biblioteca de tipos|no se pued|does not contain|no contiene|no public types)') {
        $script:LastRegAsmDetail = 'OMITIDO: sin tipos COM para TLB'
        Write-ST2Log ("RegAsm omitido (no COM/TLB): {0}" -f $leaf) 'INFO'
        return 10
      }

      # Si el error es de formato/bitness, probar el otro RegAsm
      if ($text -match '(?i)BadImageFormatException|incorrect format|formato incorrecto|32-bit|64-bit') {
        Write-ST2Log ("RegAsm bitness fail con {0}: {1}" -f $ra, $text) 'INFO'
        continue
      }

      break
    } catch {
      $lastText = $_.Exception.Message
      $lastCode = 1
      Write-ST2Log ("RegAsm exception con {0}: {1}" -f $ra, $lastText) 'ERROR'
    }
  }

  # Limpiar warnings RA0000 del detalle (no aportan en campo)
  $clean = $lastText
  if ($clean) {
    $clean = [regex]::Replace($clean, '(?i)RegAsm\s*:\s*warning\s+RA0000\s*:[^R]*(?=RegAsm\s*:|$)', '')
    $clean = ($clean -replace '\s+', ' ').Trim()
  }
  if ($clean -match '(?i)(error\s+RA0000).{0,80}(export|type library|biblioteca de tipos|no se pued|does not contain|no contiene)') {
    $script:LastRegAsmDetail = 'OMITIDO: sin tipos COM para TLB'
    Write-ST2Log ("RegAsm omitido (no COM/TLB): {0}" -f $leaf) 'INFO'
    return 10
  }

  $hint = Get-AssemblyLoadHint -DllPath $DllPath
  $detail = if ($clean) { $clean } else { ('exit={0} (sin mensaje de RegAsm)' -f $lastCode) }
  if ($hint) { $detail = ($detail + ' | Carga: ' + $hint) }
  if ($detail.Length -gt 220) { $detail = $detail.Substring(0, 220) + '...' }
  $script:LastRegAsmDetail = $detail
  Write-ST2Log ("RegAsm fail: {0} tlb={1} code={2} :: {3}" -f $leaf, $TlbName, $lastCode, $detail) 'ERROR'
  return $lastCode
}

# Bejerman es 32-bit: siempre SysWOW64\regsvr32 en Windows x64
function Get-RegSvr32Path {
  $wow = 'C:\Windows\SysWOW64\regsvr32.exe'
  if (Test-Path -LiteralPath $wow) { return $wow }
  return 'C:\Windows\System32\regsvr32.exe'
}

function Invoke-RegSvr32 {
  param(
    [Parameter(Mandatory)][string]$TargetPath
  )
  if (-not (Test-Path -LiteralPath $TargetPath)) { return 4 }
  $regsvr = Get-RegSvr32Path
  # Invocacion directa: Start-Process distorsionaba exit codes (code=3 sistematico)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $regsvr /s $TargetPath | Out-Null
    if ($null -eq $LASTEXITCODE) { return 0 }
    return [int]$LASTEXITCODE
  } catch {
    return 1
  } finally {
    $ErrorActionPreference = $prev
  }
}

function Invoke-SilentProcess {
  param(
    [Parameter(Mandatory)][string]$FilePath,
    [string[]]$ArgumentList = @(),
    [string]$WorkingDirectory = $null
  )
  $psi = @{
    FilePath    = $FilePath
    Wait        = $true
    PassThru    = $true
    WindowStyle = 'Hidden'
  }
  if ($ArgumentList.Count -gt 0) { $psi['ArgumentList'] = $ArgumentList }
  if ($WorkingDirectory) { $psi['WorkingDirectory'] = $WorkingDirectory }
  try {
    $p = Start-Process @psi
    if ($null -eq $p.ExitCode) { return 0 }
    return $p.ExitCode
  } catch {
    return 1
  }
}

# icacls/netsh: invocacion directa (Start-Process falla con rutas con espacios)
function Invoke-IcaclsGrant {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$Identity
  )
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & icacls.exe $Path /grant "${Identity}:(OI)(CI)F" /T 2>&1 | Out-Null
    if ($null -eq $LASTEXITCODE) { return 0 }
    return [int]$LASTEXITCODE
  } catch {
    return 1
  } finally {
    $ErrorActionPreference = $prev
  }
}

function Grant-RegistryTreeEveryone {
  param(
    [Parameter(Mandatory)][Microsoft.Win32.RegistryKey]$Key,
    [Parameter(Mandatory)][System.Security.Principal.SecurityIdentifier]$Sid
  )
  $ok = 0
  $fail = 0
  try {
    $acl = $Key.GetAccessControl()
    $rule = New-Object System.Security.AccessControl.RegistryAccessRule(
      $Sid,
      [System.Security.AccessControl.RegistryRights]::FullControl,
      [System.Security.AccessControl.InheritanceFlags]::ContainerInherit,
      [System.Security.AccessControl.PropagationFlags]::None,
      [System.Security.AccessControl.AccessControlType]::Allow
    )
    $acl.SetAccessRule($rule)
    $Key.SetAccessControl($acl)
    $ok++
  } catch {
    $fail++
  }

  $names = @()
  try { $names = @($Key.GetSubKeyNames()) } catch { $names = @() }
  foreach ($name in $names) {
    $sub = $null
    try {
      $sub = $Key.OpenSubKey($name, $true)
      if ($null -eq $sub) { continue }
      $r = Grant-RegistryTreeEveryone -Key $sub -Sid $Sid
      $ok += $r.Ok
      $fail += $r.Fail
    } catch {
      $fail++
    } finally {
      if ($sub) { try { $sub.Close() } catch { } }
    }
  }
  return @{ Ok = $ok; Fail = $fail }
}

function Grant-BejermanRegistryEveryone {
  # Un solo SID (S-1-1-0 = Everyone/Todos). Sin Get-Acl (rompe en WOW6432Node y spamea la consola).
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'SilentlyContinue'
  $sid = New-Object System.Security.Principal.SecurityIdentifier('S-1-1-0')
  $subKeys = @(
    'SOFTWARE\WOW6432Node\Sistemas Bejerman'
    'SOFTWARE\Sistemas Bejerman'
  )
  $anyKey = $false
  $totalOk = 0
  $totalFail = 0

  try {
    foreach ($sub in $subKeys) {
      $key = $null
      try {
        $key = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey($sub, $true)
      } catch {
        $key = $null
      }
      if ($null -eq $key) {
        Write-ST2Log ("Reg ACL skip (ausente o sin acceso): HKLM\{0}" -f $sub) 'INFO'
        continue
      }
      $anyKey = $true
      try {
        $r = Grant-RegistryTreeEveryone -Key $key -Sid $sid
        $totalOk += [int]$r.Ok
        $totalFail += [int]$r.Fail
        Write-ST2Log ("Reg ACL HKLM\{0}: ok={1} fail={2}" -f $sub, $r.Ok, $r.Fail) $(if ($r.Ok -gt 0) { 'OK' } else { 'OBS' })
      } catch {
        Write-ST2Log ("Reg ACL exception HKLM\{0}: {1}" -f $sub, $_.Exception.Message) 'OBS'
      } finally {
        try { $key.Close() } catch { }
      }
    }
  } finally {
    $ErrorActionPreference = $prev
  }

  if (-not $anyKey) { return 2 }
  if ($totalOk -gt 0) { return 0 }
  return 1
}

function Invoke-NetshFirewall {
  param(
    [Parameter(Mandatory)][ValidateSet('delete', 'add')][string]$Action,
    [Parameter(Mandatory)][string]$RuleName,
    [string]$ProgramPath = ''
  )
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    if ($Action -eq 'delete') {
      & netsh.exe advfirewall firewall delete rule "name=$RuleName" 2>&1 | Out-Null
    } else {
      & netsh.exe advfirewall firewall add rule "name=$RuleName" dir=in action=allow "program=$ProgramPath" enable=yes 2>&1 | Out-Null
    }
    if ($null -eq $LASTEXITCODE) { return 0 }
    return [int]$LASTEXITCODE
  } catch {
    return 1
  } finally {
    $ErrorActionPreference = $prev
  }
}
#endregion

#region Deteccion de rutas
function Normalize-BejermanPath {
  param([string]$PathValue)
  if ([string]::IsNullOrWhiteSpace($PathValue)) { return $null }
  $p = $PathValue.Trim().Trim('"').TrimEnd('\')
  if ([string]::IsNullOrWhiteSpace($p)) { return $null }
  if (Test-Path -LiteralPath $p -PathType Leaf -ErrorAction SilentlyContinue) {
    $p = Split-Path $p -Parent
  }
  $leaf = Split-Path $p -Leaf
  if ($leaf -match '^(?i)dll$') {
    $p = Split-Path $p -Parent
  }
  if (Test-Path -LiteralPath $p -PathType Container -ErrorAction SilentlyContinue) {
    return $p
  }
  return $null
}

function Get-BejermanRegValue {
  param(
    [Parameter(Mandatory)][string]$PreferredName,
    [string[]]$NameHints = @()
  )
  $keys = @(
    'HKLM:\SOFTWARE\WOW6432Node\Sistemas Bejerman'
    'HKLM:\SOFTWARE\Sistemas Bejerman'
  )
  foreach ($key in $keys) {
    if (-not (Test-Path -LiteralPath $key)) {
      Write-ST2Log ("Reg key ausente: {0}" -f $key) 'OBS'
      continue
    }
    try {
      $item = Get-ItemProperty -LiteralPath $key -ErrorAction Stop
      Write-ST2Log ("Reg key leida: {0}" -f $key)

      if ($null -ne $item.$PreferredName -and -not [string]::IsNullOrWhiteSpace([string]$item.$PreferredName)) {
        Write-ST2Log ("Propiedad exacta '{0}' en {1}" -f $PreferredName, $key)
        return [string]$item.$PreferredName
      }

      $exact = $item.PSObject.Properties |
        Where-Object { $_.MemberType -eq 'NoteProperty' -and $_.Name -ieq $PreferredName } |
        Select-Object -First 1
      if ($exact -and -not [string]::IsNullOrWhiteSpace([string]$exact.Value)) {
        Write-ST2Log ("Propiedad case-insensitive '{0}' en {1}" -f $exact.Name, $key)
        return [string]$exact.Value
      }

      foreach ($hint in $NameHints) {
        $fuzzy = $item.PSObject.Properties |
          Where-Object { $_.MemberType -eq 'NoteProperty' -and $_.Name -match $hint } |
          Select-Object -First 1
        if ($fuzzy -and -not [string]::IsNullOrWhiteSpace([string]$fuzzy.Value)) {
          Write-ST2Log ("Propiedad por hint '{0}' => '{1}' en {2}" -f $hint, $fuzzy.Name, $key)
          return [string]$fuzzy.Value
        }
      }
    } catch {
      Write-ST2Log ("Error leyendo {0}: {1}" -f $key, $_.Exception.Message) 'OBS'
    }
  }
  return $null
}

function Get-RutaSB {
  $fromReg = Get-BejermanRegValue -PreferredName 'Ruta a las DLL' -NameHints @(
    '(?i)ruta.*dll'
    '(?i)dll.*ruta'
    '(?i)ruta.*sistema'
    '(?i)ruta.*instalacion'
  )
  $candidates = New-Object System.Collections.Generic.List[string]
  if ($fromReg) { $candidates.Add($fromReg) }
  foreach ($fb in @(
      'C:\Program Files (x86)\SistemasBejermanSQL'
      'C:\Program Files\SistemasBejermanSQL'
      'C:\SistemasBejermanSQL'
      'D:\Program Files (x86)\SistemasBejermanSQL'
      'D:\SistemasBejermanSQL'
    )) {
    $candidates.Add($fb)
  }

  foreach ($c in $candidates) {
    $n = Normalize-BejermanPath -PathValue $c
    if ($n) {
      Write-ST2Log ("RutaSB OK: {0}" -f $n)
      return $n
    }
    Write-ST2Log ("RutaSB candidata invalida: {0}" -f $c) 'OBS'
  }
  return $null
}

function Get-RutaUpdates {
  # Siempre desde HKLM\...\Sistemas Bejerman -> "Ruta Instalador" (apunta a UPDATES)
  $fromReg = Get-BejermanRegValue -PreferredName 'Ruta Instalador' -NameHints @(
    '(?i)^ruta\s*instalador$'
    '(?i)ruta.*instal'
    '(?i)instalador'
  )
  if (-not $fromReg) { return $null }
  $p = $fromReg.Trim().Trim('"').TrimEnd('\')
  # Si el valor apunta al padre, entrar a UPDATES
  if ((Split-Path $p -Leaf) -notmatch '^(?i)updates$' -and (Test-Path -LiteralPath (Join-Path $p 'UPDATES'))) {
    $p = Join-Path $p 'UPDATES'
  }
  if (Test-Path -LiteralPath $p) { return $p }
  return $null
}
#endregion

#region Home / Menus
function Show-Home {
  Clear-Host
  Write-BannerAscii
  Write-Host ''
  $w = Get-ConsoleWidth
  Write-HostFit -Text (Get-CenteredLine -Text ("Bienvenido, {0}!" -f $env:USERNAME) -Width $w) -ForegroundColor Yellow
  Write-Host ''
  $adminTxt = if (Test-IsAdministrator) { 'SI' } else { 'NO' }
  Write-HostFit -Text (Get-CenteredLine -Text ("Admin: {0}" -f $adminTxt) -Width $w) -ForegroundColor DarkGray
  Write-Host ''
  Write-HostFit -Text (Get-CenteredLine -Text 'Ruta del sistema:' -Width $w) -ForegroundColor Gray
  if ($script:RutaSB) {
    Write-HostFit -Text (Get-CenteredLine -Text $script:RutaSB -Width $w) -ForegroundColor Green
  } else {
    Write-HostFit -Text (Get-CenteredLine -Text '(no detectada)' -Width $w) -ForegroundColor Yellow
  }
  Write-Host ''
  $sep = ('-' * [Math]::Min(56, [Math]::Max(20, $w - 10)))
  Write-HostFit -Text (Get-CenteredLine -Text $sep -Width $w) -ForegroundColor DarkGray
  Write-HostFit -Text (Get-CenteredLine -Text 'Para continuar, presione ENTER...' -Width $w) -ForegroundColor Gray
  Write-HostFit -Text (Get-CenteredLine -Text $sep -Width $w) -ForegroundColor DarkGray
  Fit-ConsoleToContent -ExtraLines 3 -MinHeight 20
  [void](Read-Host)
}

function Show-MainMenu {
  while ($true) {
    Write-MenuBox -Title 'MENU PRINCIPAL' -Items @(
      '1 - Verificar planilla tecnica'
      '2 - Registracion y Desregistracion'
      '3 - Herramientas TEC'
      '4 - Ver resumen / informe de sesion'
    )
    $menu = Read-MenuOption
    switch ($menu) {
      '1' { Invoke-PlanillaTecnica }
      '2' { Show-RegistracionMenu }
      '3' { Show-HerramientasMenu }
      '4' { Show-SessionLogReport; Ask-ExitOrContinue }
      default { continue }
    }
  }
}

function Show-RegistracionMenu {
  while ($true) {
    Write-MenuBox -Title 'MENU REGISTRACION Y DESREGISTRACION' -Items @(
      '1 - Registrar DLLs'
      '2 - Registrar Crystal Reports'
      '3 - Registrar QR en Rojo'
      '4 - Registrar TLB (SJ y FLEX)'
      '5 - Registrar DCUBE'
      '6 - Menu Principal'
    )
    $menu = Read-MenuOption
    switch ($menu) {
      '1' { Invoke-RegistrarDlls; Ask-ExitOrContinue }
      '2' { Invoke-RegistrarCrystal; Ask-ExitOrContinue }
      '3' { Invoke-RegistrarQrEnRojo; Ask-ExitOrContinue }
      '4' { Invoke-RegistrarTlb; Ask-ExitOrContinue }
      '5' { Invoke-RegistrarDcube; Ask-ExitOrContinue }
      '6' { return }
      default { continue }
    }
  }
}

function Show-HerramientasMenu {
  while ($true) {
    Write-MenuBox -Title 'MENU HERRAMIENTAS TEC' -Items @(
      '1 - Finalizar procesos del sistema'
      '1.5 - Finalizar procesos (sesion actual)'
      '2 - Desactivar DEP'
      '3 - Comparar fechas entre UPDATES & Local'
      '4 - Buscar archivos renombrados'
      '5 - Quitar compatibilidad a ejecutables'
      '6 - Lentitud Talonarios de RDP'
      '7 - Lentitud al Emitir/Imprimir en RDP'
      '8 - Menu Principal'
    )
    $menu = Read-MenuOption
    switch ($menu) {
      '1' { Invoke-CerrarBejerman -Scope System; Ask-ExitOrContinue }
      '1.5' { Invoke-CerrarBejerman -Scope Session; Ask-ExitOrContinue }
      '2' { Invoke-SetDep -Mode AlwaysOff; Ask-ExitOrContinue }
      '3' { Invoke-CompararUpdatesFechas; Ask-ExitOrContinue }
      '4' { Invoke-BuscarRenombrados; Ask-ExitOrContinue }
      '5' { Invoke-QuitarCompatibilidad; Ask-ExitOrContinue }
      '6' { Invoke-FixLentitudTalonariosRdp; Ask-ExitOrContinue }
      '7' { Invoke-FixLentitudImpresionTerminalServer; Ask-ExitOrContinue }
      '8' { return }
      default { continue }
    }
  }
}

function Show-SessionLogReport {
  Clear-Host
  Expand-ConsoleForWork
  $ok = Update-SessionReportFile
  $text = Build-SessionReportText
  foreach ($line in ($text -split '\r?\n')) {
    if ($line -match '^={3,}|^-{3,}') {
      Write-Host $line -ForegroundColor DarkCyan
    } elseif ($line -match '^\d+\. ') {
      Write-Host $line -ForegroundColor White
    } elseif ($line -match 'Problemas|errores') {
      Write-Host $line -ForegroundColor Red
    } elseif ($line -match 'Omitidos|observaciones') {
      Write-Host $line -ForegroundColor Yellow
    } elseif ($line -match 'Finalizo correctamente') {
      Write-Host $line -ForegroundColor Green
    } else {
      Write-Host $line
    }
  }
  Write-Host ''
  $showPath = $script:ReportPathStable
  if (-not $showPath) { $showPath = $script:ReportPath }
  if ($showPath -and (Test-Path -LiteralPath $showPath)) {
    $len = (Get-Item -LiteralPath $showPath).Length
    Write-Host ('Informe TXT: {0}  ({1} bytes)' -f $showPath, $len) -ForegroundColor Cyan
    if (-not $ok -or $len -lt 20) {
      Write-Host 'AVISO: el archivo parece vacio o no se pudo actualizar.' -ForegroundColor Yellow
    }
  } else {
    Write-Host 'No se encontro el archivo de informe TXT.' -ForegroundColor Yellow
  }
  Write-Host ''
  if ($showPath -and (Test-Path -LiteralPath $showPath)) {
    if (Ask-YesNo 'Abrir el informe TXT con el Bloc de notas?') {
      Start-Process -FilePath 'notepad.exe' -ArgumentList $showPath
    }
  } elseif ($script:LogDir -and (Test-Path -LiteralPath $script:LogDir)) {
    if (Ask-YesNo 'Abrir carpeta de informes ST2 en el Explorador?') {
      Start-Process -FilePath 'explorer.exe' -ArgumentList $script:LogDir
    }
  }
}
#endregion

#region Planilla tecnica
function Invoke-PlanillaTecnica {
  Clear-Host
  Expand-ConsoleForWork
  Write-RoutineHeader -Title 'VERIFICAR PLANILLA TECNICA'

  if (-not (Confirm-Action -Title 'La planilla tecnica va a aplicar estos cambios:' -Warnings @(
      'Permisos completos sobre la carpeta del sistema y registro Sistemas Bejerman (Todos / Everyone)'
      'Ajuste de Control de cuentas de usuario'
      'Compatibilidad para ejecutar como administrador los ejecutables del sistema'
      'Ajuste de conectividad para programas del sistema'
      'Configuracion Regional Argentina (es-AR)'
      'Configuracion de ODBC'
    ))) {
    Write-Host ''
    Write-Host 'Planilla cancelada por el usuario.' -ForegroundColor Yellow
    Write-ST2Log 'Planilla tecnica cancelada'
    Ask-ExitOrContinue
    return
  }

  Reset-StepCounters
  Write-Host ''

  # 1/5
  Write-Host '[1/5] Aplicando configuracion base del entorno...'
  $c1 = Invoke-IcaclsGrant -Path $script:RutaSB -Identity 'Todos'
  $c2 = Invoke-IcaclsGrant -Path $script:RutaSB -Identity 'Everyone'
  $cReg = Grant-BejermanRegistryEveryone
  $null = & reg.exe ADD 'HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' /v EnableLUA /t REG_DWORD /d 0 /f 2>$null
  $regOk = ($LASTEXITCODE -eq 0)
  if ($c1 -ne 0) { Write-ST2Log ("icacls Todos fail code={0}" -f $c1) 'ERROR' }
  if ($c2 -ne 0) { Write-ST2Log ("icacls Everyone fail code={0}" -f $c2) 'ERROR' }
  if ($cReg -eq 1) { Write-ST2Log 'Reg ACL Sistemas Bejerman: no se pudo aplicar (se continua).' 'OBS' }
  elseif ($cReg -eq 2) { Write-ST2Log 'Reg ACL: no hay clave Sistemas Bejerman en HKLM' 'INFO' }
  if (-not $regOk) { Write-ST2Log 'EnableLUA reg fail' 'ERROR' }
  # Carpeta: alcanza con Todos o Everyone. Registro: suave (OBS si falla; no tumba el paso).
  $aclOk = ($c1 -eq 0 -or $c2 -eq 0)
  $regAclOk = ($cReg -eq 0)
  $regAclSkip = ($cReg -eq 2)
  $realBaseErr = 0
  if (-not $aclOk) { $realBaseErr++ }
  if (-not $regOk) { $realBaseErr++ }
  if ($realBaseErr -gt 0) {
    Complete-Step -Status ERROR -Message 'Configuracion base con fallos.' -Detail ("carpeta_ok={0} regedit_ok={1} uac_ok={2}" -f $aclOk, $regAclOk, $regOk)
  } elseif ($cReg -eq 1) {
    Complete-Step -Status OBS -Message 'Configuracion base aplicada (registro Bejerman parcial o no aplicable).' -Detail ("carpeta_ok={0} regedit_ok={1} uac_ok={2}" -f $aclOk, $regAclOk, $regOk)
  } else {
    Complete-Step -Status OK -Message 'Configuracion base aplicada.' -Detail ("carpeta_ok={0} regedit_ok={1} uac_ok={2}" -f $aclOk, ($(if ($regAclSkip) { 'n/a' } else { $regAclOk })), $regOk)
  }

  # 2/5
  Write-Host '[2/5] Ajustando compatibilidad de ejecutables...'
  $compatOk = 0
  $compatErr = 0
  $compatMissing = 0
  $layerKey = 'HKLM:\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers'
  if (-not (Test-Path -LiteralPath $layerKey)) {
    $null = New-Item -Path $layerKey -Force
  }
  foreach ($rel in $script:CompatExes) {
    $full = Join-Path $script:RutaSB $rel
    if (-not (Test-Path -LiteralPath $full)) {
      $compatMissing++
      Write-ST2Log ("Compat missing file: {0}" -f $full) 'OBS'
    }
    try {
      Set-ItemProperty -LiteralPath $layerKey -Name $full -Value 'RUNASADMIN' -Type String -Force -ErrorAction Stop
      $compatOk++
    } catch {
      $compatErr++
      Write-ST2Log ("Compat set fail: {0} :: {1}" -f $full, $_.Exception.Message) 'ERROR'
    }
  }
  if ($compatErr -gt 0) {
    Complete-Step -Status ERROR -Message 'Compatibilidad con errores de escritura.' -Detail ("ok={0} err={1}" -f $compatOk, $compatErr)
  } else {
    Complete-Step -Status OK -Message 'Compatibilidad de ejecutables aplicada.'
  }

  # 3/5
  Write-Host '[3/5] Actualizando reglas generales de conectividad...'
  $fwAddOk = 0
  $fwAddErr = 0
  $fwSkip = 0
  foreach ($rule in $script:FirewallPrograms) {
    $null = Invoke-NetshFirewall -Action delete -RuleName $rule.Name
  }
  foreach ($rule in $script:FirewallPrograms) {
    $prog = Join-Path $script:RutaSB $rule.Rel
    if (-not (Test-Path -LiteralPath $prog)) {
      $fwSkip++
      Write-ST2Log ("Firewall skip (no existe): {0}" -f $prog) 'OBS'
      continue
    }
    $code = Invoke-NetshFirewall -Action add -RuleName $rule.Name -ProgramPath $prog
    if ($code -eq 0) {
      $fwAddOk++
    } else {
      $fwAddErr++
      Write-ST2Log ("Firewall add fail: {0} code={1} prog={2}" -f $rule.Name, $code, $prog) 'ERROR'
    }
  }
  if ($fwAddErr -gt 0) {
    Complete-Step -Status ERROR -Message 'Firewall con fallos al agregar reglas.' -Detail ("ok={0} err={1}" -f $fwAddOk, $fwAddErr)
  } else {
    Complete-Step -Status OK -Message 'Reglas de firewall actualizadas.'
  }

  # 4/5
  Write-Host '[4/5] Configurando parametros regionales...'
  $regOkCount = 0
  $regErrCount = 0
  $intl = 'HKCU:\Control Panel\International'
  foreach ($kv in $script:RegionalSettings.GetEnumerator()) {
    try {
      Set-ItemProperty -LiteralPath $intl -Name $kv.Key -Value $kv.Value -Type String -Force -ErrorAction Stop
      $regOkCount++
    } catch {
      $regErrCount++
    }
  }
  if ($regErrCount -gt 0) {
    Complete-Step -Status OBS -Message 'Regionales parciales.' -Detail ("ok={0} err={1}" -f $regOkCount, $regErrCount)
  } else {
    Complete-Step -Status OK -Message 'Parametros regionales es-AR aplicados.' -Detail ("keys={0}" -f $regOkCount)
  }

  # 5/5
  Write-Host '[5/5] Abriendo administradores ODBC...'
  $odbcOpened = 0
  if (Test-Path 'C:\WINDOWS\SysWOW64\odbcad32.exe') {
    Start-Process -FilePath 'C:\WINDOWS\SysWOW64\odbcad32.exe' -ErrorAction SilentlyContinue
    $odbcOpened++
  }
  if (Test-Path 'C:\Windows\System32\odbcad32.exe') {
    Start-Process -FilePath 'C:\Windows\System32\odbcad32.exe' -ErrorAction SilentlyContinue
    $odbcOpened++
  }
  if ($odbcOpened -eq 0) {
    Complete-Step -Status OBS -Message 'No se encontro odbcad32.exe.'
  } else {
    Complete-Step -Status OK -Message 'Administradores ODBC abiertos.' -Detail ("count={0}" -f $odbcOpened)
  }

  Show-RoutineSummary -Title 'Planilla tecnica' `
    -Description 'Aplica permisos de carpeta y registro Sistemas Bejerman (Todos/Everyone), desactiva UAC, AppCompat, firewall, regionales y abre ODBC. No toca DEP.'
  Ask-ExitOrContinue
}
#endregion

#region Registracion
function Invoke-RegistrarDlls {
  Clear-Host
  Expand-ConsoleForWork
  Write-RoutineHeader -Title 'REGISTRAR DLLS Y CONTROLES'
  Reset-StepCounters
  Write-ST2Log ("Using regsvr32: {0}" -f (Get-RegSvr32Path))

  $allFail = New-Object System.Collections.Generic.List[string]
  $allSkip = New-Object System.Collections.Generic.List[string]
  $totOk = 0; $totNoCom = 0; $totErr = 0; $totSkip = 0

  Push-Location $script:RutaSB
  try {
    Write-Host '[1/3] Registrando DLLs en la carpeta de instalacion...' -ForegroundColor White
    $dlls = @(Get-ChildItem -LiteralPath $script:RutaSB -Filter '*.dll' -File -ErrorAction SilentlyContinue)
    if ($dlls.Count -eq 0) {
      Complete-Step -Status OBS -Message 'No se encontraron DLLs en la carpeta de instalacion.'
    } else {
      $r = Invoke-RegisterFiles -Files $dlls -Context 'DLL'
      $totOk += $r.Ok; $totNoCom += $r.NoCom; $totErr += $r.Err; $totSkip += $r.Skip
      foreach ($x in $r.FailList) { $allFail.Add($x) }
      foreach ($x in $r.SkipList) { $allSkip.Add($x) }
      if ($r.Err -gt 0) {
        Complete-Step -Status ERROR -Message 'DLLs: hubo errores de registro.' -Detail ("ok={0} error={1}" -f $r.Ok, $r.Err)
      } else {
        Complete-Step -Status OK -Message 'DLLs registradas.'
      }
    }

    Write-Host '[2/3] Registrando controles OCX en la carpeta de instalacion...' -ForegroundColor White
    $ocxs = @(Get-ChildItem -LiteralPath $script:RutaSB -Filter '*.ocx' -File -ErrorAction SilentlyContinue)
    if ($ocxs.Count -eq 0) {
      Complete-Step -Status OBS -Message 'No se encontraron OCX en la carpeta de instalacion.'
    } else {
      $r = Invoke-RegisterFiles -Files $ocxs -Context 'OCX'
      $totOk += $r.Ok; $totNoCom += $r.NoCom; $totErr += $r.Err; $totSkip += $r.Skip
      foreach ($x in $r.FailList) { $allFail.Add($x) }
      foreach ($x in $r.SkipList) { $allSkip.Add($x) }
      if ($r.Err -gt 0) {
        Complete-Step -Status ERROR -Message 'OCX: hubo errores de registro.' -Detail ("ok={0} error={1}" -f $r.Ok, $r.Err)
      } else {
        Complete-Step -Status OK -Message 'OCX registrados.'
      }
    }

    Write-Host '[3/3] Registrando componentes base del sistema (solo DLL/OCX)...' -ForegroundColor White
    $sysDir = Get-SysRegDir
    $sysFiles = @()
    foreach ($name in $script:SysWowComponents) {
      $path = Join-Path $sysDir $name
      if (Test-Path -LiteralPath $path) {
        $sysFiles += Get-Item -LiteralPath $path
      } else {
        Write-ST2Log ("sys component missing: {0}" -f $path) 'INFO'
      }
    }
    if ($sysFiles.Count -eq 0) {
      Complete-Step -Status OBS -Message 'No se encontraron componentes de sistema a registrar.'
    } else {
      $r = Invoke-RegisterFiles -Files $sysFiles -Context 'SYS'
      $totOk += $r.Ok; $totNoCom += $r.NoCom; $totErr += $r.Err; $totSkip += $r.Skip
      foreach ($x in $r.FailList) { $allFail.Add($x) }
      if ($r.Err -gt 0) {
        Complete-Step -Status ERROR -Message 'Componentes de sistema con fallos.' -Detail ("ok={0} error={1}" -f $r.Ok, $r.Err)
      } else {
        Complete-Step -Status OK -Message 'Componentes de sistema registrados.'
      }
    }
  } finally {
    Pop-Location
  }

  Write-RoutineFooter -Title 'REGISTRO DE DLLS Y OCX COMPLETADO'
  $counts = @{ ok = $totOk; error = $totErr }
  if ($totNoCom -gt 0) { $counts['omitidas_no_COM'] = $totNoCom }
  if ($totSkip -gt 0) { $counts['omitidas_nombre'] = $totSkip }
  Show-RoutineSummary -Title 'Registro DLLs/OCX' `
    -Description 'Registra DLL/OCX COM (SysWOW64). Las no-COM (Zip, OpenSSL, .NET, etc.) se omiten y no son error.' `
    -Counts $counts -FailList @($allFail) -SkipList @($allSkip)
}

function Invoke-RegistrarQrEnRojo {
  Clear-Host
  Expand-ConsoleForWork
  Write-RoutineHeader -Title 'REGISTRAR QR EN ROJO'
  Reset-StepCounters

  Write-Host '[1/3] Verificando prerequisitos...' -ForegroundColor White
  $eflex = Get-EflexWebDir
  $qrDll = $null
  if ($eflex) {
    foreach ($name in @('SB.Net.Sistemas.AFIP.dll', 'SB.NET.sistemas.afip.dll')) {
      $cand = Join-Path $eflex $name
      if (Test-Path -LiteralPath $cand) { $qrDll = $cand; break }
    }
  }
  $regAsm = Get-RegAsmPath

  if (-not $qrDll) {
    Complete-Step -Status ERROR -Message 'DLL AFIP no encontrada en EflexWeb.'
    Show-RoutineSummary -Title 'QR en Rojo'
    return
  }
  if (-not $regAsm) {
    Complete-Step -Status ERROR -Message 'RegAsm no disponible.'
    Show-RoutineSummary -Title 'QR en Rojo'
    return
  }
  Complete-Step -Status OK -Message 'Prerequisitos OK.' -Detail $qrDll

  Write-Host '[2/3] Registrando componente principal...' -ForegroundColor White
  $code = Invoke-RegAsm -DllPath $qrDll -TlbName 'SB.Net.Sistemas.AFIP.tlb' -RegAsmPath $regAsm
  if ($code -ne 0 -and $code -ne 10) {
    Complete-Step -Status ERROR -Message 'No se pudo registrar el componente AFIP.' -Detail ("exit={0}" -f $code)
  } elseif ($code -eq 10) {
    Complete-Step -Status OBS -Message 'AFIP omitido (sin tipos COM para TLB).'
  } else {
    Complete-Step -Status OK -Message 'Componente AFIP registrado.'
  }

  Write-Host '[3/3] Finalizando registro...' -ForegroundColor White
  if ($code -eq 0) {
    Complete-Step -Status OK -Message 'Registro QR finalizado.'
  } elseif ($code -eq 10) {
    Complete-Step -Status OBS -Message 'Registro QR finalizado (componente omitido).'
  } else {
    Complete-Step -Status OBS -Message 'Registro QR finalizado con errores en el componente principal.'
  }

  Write-RoutineFooter -Title 'REGISTRO DE QR EN ROJO COMPLETADO'
  Show-RoutineSummary -Title 'QR en Rojo' `
    -Description 'RegAsm /codebase de SB.Net.Sistemas.AFIP.dll (QR en Rojo).'
}

function Invoke-RegistrarCrystal {
  Clear-Host
  Expand-ConsoleForWork
  Write-RoutineHeader -Title 'REGISTRAR CRYSTAL REPORTS'
  Reset-StepCounters
  Write-ST2Log ("Crystal using regsvr32: {0}" -f (Get-RegSvr32Path))

  Write-Host 'Cerrando procesos de Crystal Reports...' -ForegroundColor DarkGray
  foreach ($proc in $script:CrystalProcesses) {
    $null = Invoke-SilentProcess -FilePath 'taskkill.exe' -ArgumentList @('/IM', $proc, '/F')
  }
  Write-Host 'Procesos cerrados. Iniciando registro...' -ForegroundColor DarkGray
  Write-Host ''

  Write-Host '[1/4] Registrando ejecutables principales...' -ForegroundColor White
  $crystalExes = @(
    (Join-Path $script:RutaSB 'Crystal6\SBRptRdoEXE6.exe')
    (Join-Path $script:RutaSB 'CrystalXI\SBRptRdoEXE.exe')
    (Join-Path $script:RutaSB 'CrystalXIMP\SBRptRdoEXEMP.exe')
  )
  $exeOk = 0
  $exeErr = 0
  $exeMissing = 0
  foreach ($exe in $crystalExes) {
    if (-not (Test-Path -LiteralPath $exe)) {
      $exeMissing++
      Write-ST2Log ("Crystal exe missing: {0}" -f $exe) 'OBS'
      continue
    }
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
      & $exe /regserver | Out-Null
      $code = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
    } catch {
      $code = 1
    } finally {
      $ErrorActionPreference = $prev
    }
    if ($code -eq 0) {
      $exeOk++
      Write-ST2Log ("Crystal /regserver OK: {0}" -f (Split-Path $exe -Leaf)) 'OK'
    } else {
      $exeErr++
      Write-ST2Log ("Crystal /regserver fail: {0} code={1}" -f (Split-Path $exe -Leaf), $code) 'OBS'
    }
  }
  if ($exeErr -gt 0 -or $exeMissing -gt 0) {
    Complete-Step -Status OBS -Message 'Ejecutables Crystal con observaciones.' -Detail ("ok={0} fail={1} missing={2}" -f $exeOk, $exeErr, $exeMissing)
  } else {
    Complete-Step -Status OK -Message 'Ejecutables Crystal registrados.' -Detail ("count={0}" -f $exeOk)
  }

  $crystalDirs = @(
    @{ Label = '[2/4] Registrando librerias Crystal 6...'; Dir = (Join-Path $script:RutaSB 'Crystal6'); Name = 'Crystal 6' }
    @{ Label = '[3/4] Registrando librerias Crystal XI...'; Dir = (Join-Path $script:RutaSB 'CrystalXI'); Name = 'Crystal XI' }
    @{ Label = '[4/4] Registrando librerias Crystal XIMP...'; Dir = (Join-Path $script:RutaSB 'CrystalXIMP'); Name = 'Crystal XIMP' }
  )
  $allFail = New-Object System.Collections.Generic.List[string]
  $allSkip = New-Object System.Collections.Generic.List[string]
  $totOk = 0; $totNoCom = 0; $totErr = 0; $totSkip = 0

  foreach ($c in $crystalDirs) {
    Write-Host $c.Label -ForegroundColor White
    if (-not (Test-Path -LiteralPath $c.Dir)) {
      Complete-Step -Status OBS -Message ("Carpeta {0} no encontrada." -f $c.Name)
      continue
    }
    $files = @(Get-ChildItem -LiteralPath $c.Dir -Filter '*.dll' -File -ErrorAction SilentlyContinue)
    if ($files.Count -eq 0) {
      Complete-Step -Status OBS -Message ("{0}: no habia DLL para registrar." -f $c.Name)
      continue
    }
    $r = Invoke-RegisterFiles -Files $files -Context $c.Name
    $totOk += $r.Ok; $totNoCom += $r.NoCom; $totErr += $r.Err; $totSkip += $r.Skip
    foreach ($x in $r.FailList) { $allFail.Add(("[{0}] {1}" -f $c.Name, $x)) }
    foreach ($x in $r.SkipList) { $allSkip.Add(("[{0}] {1}" -f $c.Name, $x)) }
    if ($r.Err -gt 0) {
      Complete-Step -Status ERROR -Message ("{0}: con errores de registro." -f $c.Name)
    } else {
      Complete-Step -Status OK -Message ("{0}: librerias procesadas." -f $c.Name)
    }
  }

  Write-Host 'Registrando librerias del sistema...' -ForegroundColor White
  $sysDir = Get-SysRegDir
  $sysFiles = @()
  foreach ($dll in @('MSVBVM60.DLL', 'msvbvm50.dll')) {
    $path = Join-Path $sysDir $dll
    if (Test-Path -LiteralPath $path) { $sysFiles += Get-Item -LiteralPath $path }
  }
  if ($sysFiles.Count -gt 0) {
    $r = Invoke-RegisterFiles -Files $sysFiles -Context 'Crystal-SYS'
    $totOk += $r.Ok; $totNoCom += $r.NoCom; $totErr += $r.Err
    foreach ($x in $r.FailList) { $allFail.Add($x) }
    if ($r.Err -gt 0) {
      Complete-Step -Status ERROR -Message ('Librerias de sistema en {0} con fallos.' -f (Split-Path $sysDir -Leaf))
    } else {
      Complete-Step -Status OK -Message ('Librerias de sistema en {0}.' -f (Split-Path $sysDir -Leaf))
    }
  } else {
    Complete-Step -Status OBS -Message 'No se encontraron MSVBVM en sistema.'
  }

  Write-RoutineFooter -Title 'REGISTRO DE CRYSTAL REPORTS COMPLETADO'
  $counts = @{ ok = $totOk; error = $totErr; exe_ok = $exeOk; exe_fail = $exeErr }
  if ($totNoCom -gt 0) { $counts['omitidas_no_COM'] = $totNoCom }
  if ($totSkip -gt 0) { $counts['omitidas_nombre'] = $totSkip }
  Show-RoutineSummary -Title 'Crystal Reports' `
    -Description 'Registra ejecutables Crystal y DLLs Crystal6/XI/XIMP. Las no-COM no son error.' `
    -Counts $counts -FailList @($allFail) -SkipList @($allSkip)
}

function Invoke-RegistrarTlb {
  Clear-Host
  Expand-ConsoleForWork
  Write-RoutineHeader -Title 'REGISTRAR TLB (SJ Y FLEX)'
  Reset-StepCounters

  Write-Host '[1/4] Verificando prerequisitos...' -ForegroundColor White
  $regAsm = Get-RegAsmPath
  $eflex = Get-EflexWebDir
  if (-not $regAsm) {
    Complete-Step -Status ERROR -Message 'RegAsm no disponible.'
    Show-RoutineSummary -Title 'TLB'
    return
  }
  if (-not $eflex) {
    Complete-Step -Status ERROR -Message 'Carpeta EflexWeb no encontrada.'
    Show-RoutineSummary -Title 'TLB'
    return
  }
  Complete-Step -Status OK -Message 'Prerequisitos OK.' -Detail $eflex

  Write-Host '[2/4] Posicionando utilidades de registro...' -ForegroundColor White
  Complete-Step -Status OK -Message 'RegAsm listo.' -Detail $regAsm

  Write-Host '[3/4] Registrando TLB (principal)...' -ForegroundColor White
  $ok = 0
  $err = 0
  $missing = 0
  $skip = 0
  $failList = New-Object System.Collections.Generic.List[string]
  $skipList = New-Object System.Collections.Generic.List[string]
  foreach ($item in $script:TlbPrincipal) {
    $dllPath = Join-Path $eflex $item.Dll
    if (-not (Test-Path -LiteralPath $dllPath)) {
      $found = Get-ChildItem -LiteralPath $eflex -Filter $item.Dll -File -ErrorAction SilentlyContinue | Select-Object -First 1
      if (-not $found) {
        $missing++
        Write-ST2Log ("TLB missing: {0}" -f $item.Dll) 'INFO'
        continue
      }
      $dllPath = $found.FullName
    }
    $code = Invoke-RegAsm -DllPath $dllPath -TlbName $item.Tlb -RegAsmPath $regAsm
    if ($code -eq 0) {
      $ok++
    } elseif ($code -eq 10 -or ($script:LastRegAsmDetail -match '(?i)^OMITIDO')) {
      $skip++
      $skipList.Add(('{0} ({1})' -f $item.Dll, $script:LastRegAsmDetail))
    } else {
      $err++
      $why = if ($script:LastRegAsmDetail) { $script:LastRegAsmDetail } else { ('exit={0}' -f $code) }
      $failList.Add(('{0} :: {1}' -f $item.Dll, $why))
    }
  }
  if ($err -gt 0) {
    Complete-Step -Status ERROR -Message 'TLB principales con errores.' -Detail ("ok={0} fail={1} omitidas={2} missing={3}" -f $ok, $err, $skip, $missing)
  } elseif ($missing -gt 0 -and $ok -eq 0 -and $skip -eq 0) {
    Complete-Step -Status OBS -Message 'No se encontraron DLL principales para registrar.'
  } elseif ($skip -gt 0 -and $err -eq 0) {
    Complete-Step -Status OK -Message 'TLB principales OK (algunas omitidas sin COM).' -Detail ("ok={0} omitidas={1}" -f $ok, $skip)
  } else {
    Complete-Step -Status OK -Message 'TLB principales registradas.'
  }

  Write-Host '[4/4] Registrando TLB (complementarias)...' -ForegroundColor White
  $ok2 = 0
  $err2 = 0
  $missing2 = 0
  $skip2 = 0
  foreach ($item in $script:TlbComplementarias) {
    $dllPath = Join-Path $eflex $item.Dll
    if (-not (Test-Path -LiteralPath $dllPath)) {
      $found = Get-ChildItem -LiteralPath $eflex -Filter $item.Dll -File -ErrorAction SilentlyContinue | Select-Object -First 1
      if (-not $found) {
        $missing2++
        Write-ST2Log ("TLB complementaria missing: {0}" -f $item.Dll) 'INFO'
        continue
      }
      $dllPath = $found.FullName
    }
    $code = Invoke-RegAsm -DllPath $dllPath -TlbName $item.Tlb -RegAsmPath $regAsm
    if ($code -eq 0) {
      $ok2++
    } elseif ($code -eq 10 -or ($script:LastRegAsmDetail -match '(?i)^OMITIDO')) {
      $skip2++
      $skipList.Add(('{0} ({1})' -f $item.Dll, $script:LastRegAsmDetail))
    } else {
      $err2++
      $why = if ($script:LastRegAsmDetail) { $script:LastRegAsmDetail } else { ('exit={0}' -f $code) }
      $failList.Add(('{0} :: {1}' -f $item.Dll, $why))
    }
  }
  if ($err2 -gt 0) {
    Complete-Step -Status ERROR -Message 'TLB complementarias con errores.' -Detail ("ok={0} fail={1} omitidas={2} missing={3}" -f $ok2, $err2, $skip2, $missing2)
  } elseif ($missing2 -gt 0 -and $ok2 -eq 0 -and $skip2 -eq 0) {
    Complete-Step -Status OBS -Message 'No se encontraron DLL complementarias para registrar.'
  } elseif ($skip2 -gt 0 -and $err2 -eq 0) {
    Complete-Step -Status OK -Message 'TLB complementarias OK (algunas omitidas sin COM).' -Detail ("ok={0} omitidas={1}" -f $ok2, $skip2)
  } else {
    Complete-Step -Status OK -Message 'TLB complementarias registradas.'
  }

  Write-RoutineFooter -Title 'REGISTRO DE TLBS COMPLETADO'
  $counts = @{ ok = ($ok + $ok2); fail = ($err + $err2); missing = ($missing + $missing2) }
  if (($skip + $skip2) -gt 0) { $counts['omitidas_no_COM'] = ($skip + $skip2) }
  Show-RoutineSummary -Title 'TLB' `
    -Description 'RegAsm /codebase de ensamblados EflexWeb (SJ y FLEX). Sin tipos COM se omite (no es error).' `
    -Counts $counts -FailList @($failList) -SkipList @($skipList)
}

function Invoke-RegistrarDcube {
  Clear-Host
  Expand-ConsoleForWork
  Write-RoutineHeader -Title 'REGISTRAR DCUBE'
  Reset-StepCounters

  Write-Host '[1/2] Verificando carpeta de sistema...' -ForegroundColor White
  $sysDir = Get-SysRegDir
  Complete-Step -Status OK -Message ('Usando {0}.' -f $sysDir)

  Write-Host '[2/2] Registrando componente DCUBE...' -ForegroundColor White
  $ocx = Join-Path $sysDir 'dcube.ocx'
  if (-not (Test-Path -LiteralPath $ocx)) {
    Complete-Step -Status ERROR -Message 'dcube.ocx no encontrado.' -Detail $ocx
  } else {
    $code = Invoke-RegSvr32 -TargetPath $ocx
    if ($code -ne 0) {
      Complete-Step -Status ERROR -Message 'Fallo al registrar dcube.ocx.' -Detail ("exit={0}" -f $code)
    } else {
      Complete-Step -Status OK -Message 'dcube.ocx registrado.'
    }
  }

  Write-RoutineFooter -Title 'REGISTRO DE DCUBE COMPLETADO'
  Show-RoutineSummary -Title 'DCUBE'
}
#endregion

#region Herramientas
function Invoke-CerrarBejerman {
  param(
    [ValidateSet('System', 'Session')]
    [string]$Scope = 'System'
  )
  Clear-Host
  Expand-ConsoleForWork
  $titulo = if ($Scope -eq 'System') {
    'FINALIZAR PROCESOS DEL SISTEMA'
  } else {
    'FINALIZAR PROCESOS (SESION ACTUAL)'
  }
  Write-Host '===============================================' -ForegroundColor DarkCyan
  Write-Host ("  >>  {0}" -f $titulo) -ForegroundColor Cyan
  Write-Host '===============================================' -ForegroundColor DarkCyan
  Write-Host ''
  Reset-StepCounters

  Write-Host '[1/1] Ejecutando cierre de procesos Bejerman...'
  $names = @(
    $script:BejermanProcesses |
      ForEach-Object { [System.IO.Path]::GetFileNameWithoutExtension($_) } |
      Select-Object -Unique
  )

  $targets = @()
  try {
    $targets = @(Get-Process -Name $names -ErrorAction SilentlyContinue)
  } catch {
    $targets = @()
  }

  if ($Scope -eq 'Session') {
    $sid = $null
    try { $sid = (Get-Process -Id $PID -ErrorAction Stop).SessionId } catch { }
    if ($null -ne $sid) {
      $targets = @($targets | Where-Object { $_.SessionId -eq $sid })
    }
  }

  $killed = 0
  $killedNames = @()
  if ($targets.Count -gt 0) {
    $killedNames = @($targets | Select-Object -ExpandProperty ProcessName -Unique | Sort-Object)
    # Una sola pasada: rapido (sin taskkill por cada EXE)
    $targets | Stop-Process -Force -ErrorAction SilentlyContinue
    $killed = $targets.Count
    Write-ST2Log ("Kill {0} count={1} names={2}" -f $Scope, $killed, ($killedNames -join ',')) 'OK'
  }

  if ($killed -eq 0) {
    Complete-Step -Status OBS -Message 'No habia procesos Bejerman en ejecucion.'
  } else {
    Complete-Step -Status OK -Message ('Procesos finalizados: {0}.' -f $killed) -Detail ($killedNames -join ', ')
  }

  Write-Host '===============================================' -ForegroundColor DarkCyan
  Write-Host '   CIERRE DE PROCESOS COMPLETADO'
  Write-Host '===============================================' -ForegroundColor DarkCyan
  Show-RoutineSummary -Title ('Kill {0}' -f $Scope) `
    -Description $(if ($Scope -eq 'System') { 'Cierra procesos Bejerman de toda la PC (sin confirmacion).' } else { 'Cierra procesos Bejerman de la sesion actual.' }) `
    -Counts @{ finalizados = $killed }
}

function Invoke-SetDep {
  param(
    [ValidateSet('OptIn', 'AlwaysOff')]
    [string]$Mode
  )
  Clear-Host
  Expand-ConsoleForWork
  $label = if ($Mode -eq 'OptIn') { 'ACTIVAR DEP (OptIn)' } else { 'DESACTIVAR DEP (AlwaysOff)' }
  if (-not (Confirm-Action -Title ("ATENCION: {0}" -f $label) -Warnings @(
      'Modifica la configuracion de arranque (bcdedit)'
      'Puede requerir reinicio para aplicar del todo'
    ))) {
    Write-Host ''
    Write-Host 'Operacion cancelada.' -ForegroundColor Yellow
    return
  }

  Reset-StepCounters
  $code = Invoke-SilentProcess -FilePath 'bcdedit.exe' -ArgumentList @('/set', '{current}', 'nx', $Mode)
  if ($code -ne 0) {
    Complete-Step -Status ERROR -Message 'bcdedit fallo.' -Detail ("mode={0} exit={1}" -f $Mode, $code)
  } else {
    Complete-Step -Status OK -Message ("DEP configurado: {0}." -f $Mode)
  }
  Show-RoutineSummary -Title 'DEP'
}

function Invoke-QuitarCompatibilidad {
  Clear-Host
  Expand-ConsoleForWork
  Write-RoutineHeader -Title 'QUITAR COMPATIBILIDAD A EJECUTABLES'
  Reset-StepCounters

  Write-Host '[1/2] Revisando entradas AppCompat (RUNASADMIN)...' -ForegroundColor White
  $layerKey = 'HKLM:\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers'
  $total = @($script:CompatRemoveExes).Count
  $removed = 0
  $i = 0
  foreach ($rel in $script:CompatRemoveExes) {
    $i++
    $full = Join-Path $script:RutaSB $rel
    Write-SimpleProgress -Current $i -Total $total -Label (Split-Path $rel -Leaf)
    try {
      if (Get-ItemProperty -LiteralPath $layerKey -Name $full -ErrorAction SilentlyContinue) {
        Remove-ItemProperty -LiteralPath $layerKey -Name $full -Force -ErrorAction SilentlyContinue
        $removed++
        Write-ST2Log ("Compat removed: {0}" -f $full) 'OK'
      }
    } catch { }
  }
  if ($total -gt 0) { Write-Host '' }
  Complete-Step -Status OK -Message 'Revision de entradas finalizada.' -Detail ("revisadas={0} eliminadas={1}" -f $total, $removed)

  Write-Host '[2/2] Confirmando resultado...' -ForegroundColor White
  if ($removed -eq 0) {
    Complete-Step -Status OK -Message 'No habia compatibilidad RUNASADMIN en las entradas conocidas.'
  } else {
    Complete-Step -Status OK -Message 'Compatibilidad RUNASADMIN eliminada.' -Detail ("removed={0}" -f $removed)
  }

  Write-RoutineFooter -Title 'QUITAR COMPATIBILIDAD COMPLETADO'
  Show-RoutineSummary -Title 'Quitar compatibilidad' `
    -Description 'Quita flags RUNASADMIN de ejecutables Bejerman conocidos en AppCompat Layers.' `
    -Counts @{ revisadas = $total; eliminadas = $removed }
}

function Get-UpdatesPackageFolders {
  # Dentro de UPDATES: {dirDLL} {dirAPPSQL} {dirLOCALSQL} -> instalacion local
  #                    {winsys} -> C:\Windows\SysWOW64
  param([Parameter(Mandatory)][string]$UpdatesRoot)

  $specs = @(
    @{ Nombre = 'dirDLL';      Braced = '{dirDLL}';      DestKind = 'Local' }
    @{ Nombre = 'dirAPPSQL';   Braced = '{dirAPPSQL}';   DestKind = 'Local' }
    @{ Nombre = 'dirLOCALSQL'; Braced = '{dirLOCALSQL}'; DestKind = 'Local' }
    @{ Nombre = 'winsys';      Braced = '{winsys}';      DestKind = 'WinSys' }
  )

  $dirs = @()
  try {
    $dirs = @(Get-ChildItem -LiteralPath $UpdatesRoot -Directory -Force -ErrorAction SilentlyContinue)
  } catch { }

  $found = @()
  foreach ($spec in $specs) {
    $srcDir = $null
    foreach ($d in $dirs) {
      $n = [string]$d.Name
      if ($n -ieq $spec.Braced -or $n -ieq $spec.Nombre) {
        $srcDir = $d
        break
      }
    }
    if ($null -eq $srcDir) { continue }
    $found += [pscustomobject]@{
      Nombre   = [string]$spec.Nombre
      Origen   = [string]$srcDir.FullName
      DestKind = [string]$spec.DestKind
    }
  }
  return $found
}

function Resolve-UpdatesLocalTarget {
  # Un solo destino por archivo de UPDATES. NO busca copias repetidas en local.
  param(
    [Parameter(Mandatory)][string]$DestKind,
    [Parameter(Mandatory)][string]$RelativePath,
    [Parameter(Mandatory)][string]$RutaSB
  )
  $rel = $RelativePath.TrimStart('\')
  if ($DestKind -eq 'WinSys') {
    # Segun campo: {winsys} siempre vs C:\Windows\SysWOW64
    return (Join-Path (Join-Path $env:WINDIR 'SysWOW64') $rel)
  }
  return (Join-Path $RutaSB $rel)
}

function Invoke-CompararUpdatesFechas {
  Clear-Host
  Expand-ConsoleForWork
  Write-RoutineHeader -Title 'COMPARAR UPDATES VS LOCAL'
  Reset-StepCounters

  Write-Host '[1/3] Resolviendo UPDATES y LOCAL...' -ForegroundColor White
  $rutaUpdates = Get-RutaUpdates
  if (-not $rutaUpdates) {
    Complete-Step -Status ERROR -Message 'No se pudo leer "Ruta Instalador" del registro (UPDATES).'
    Show-RoutineSummary -Title 'Comparar UPDATES'
    return
  }
  $baseUpdates = $rutaUpdates.Trim().Trim('"').TrimEnd('\')
  if (-not (Test-Path -LiteralPath $baseUpdates)) {
    Complete-Step -Status ERROR -Message 'Ruta UPDATES invalida o inaccesible.' -Detail $baseUpdates
    Show-RoutineSummary -Title 'Comparar UPDATES'
    return
  }

  $baseLocal = $script:RutaSB
  if ([string]::IsNullOrWhiteSpace($baseLocal) -or -not (Test-Path -LiteralPath $baseLocal)) {
    Complete-Step -Status ERROR -Message 'Ruta LOCAL invalida.'
    Show-RoutineSummary -Title 'Comparar UPDATES'
    return
  }

  Write-Host ("  UPDATES: {0}" -f $baseUpdates) -ForegroundColor DarkGray
  Write-Host ("  LOCAL:   {0}" -f $baseLocal) -ForegroundColor DarkGray
  Complete-Step -Status OK -Message 'Rutas UPDATES y LOCAL resueltas.'

  Write-Host '[2/3] Comparando {dir*} y {winsys}...' -ForegroundColor White
  $packages = @()
  try {
    $packages = @(Get-UpdatesPackageFolders -UpdatesRoot $baseUpdates)
  } catch {
    Complete-Step -Status ERROR -Message 'Error al enumerar carpetas de UPDATES.' -Detail $_.Exception.Message
    Show-RoutineSummary -Title 'Comparar UPDATES'
    return
  }

  if ($packages.Count -eq 0) {
    # Diagnostico: listar lo que hay en UPDATES para campo
    $seen = @()
    try {
      $seen = @(Get-ChildItem -LiteralPath $baseUpdates -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
    } catch { }
    Write-Host ('  Carpetas vistas en UPDATES: {0}' -f $(if ($seen.Count) { $seen -join ', ' } else { '(ninguna)' })) -ForegroundColor Yellow
    Complete-Step -Status OBS -Message 'No se encontraron {dirDLL}/{dirAPPSQL}/{dirLOCALSQL}/{winsys} en UPDATES.'
    Show-RoutineSummary -Title 'Comparar UPDATES' -Description 'Sin carpetas de paquete esperadas en UPDATES.'
    return
  }
  Write-Host ('  Carpetas halladas: {0}' -f (($packages | ForEach-Object { '{' + $_.Nombre + '}' }) -join ', ')) -ForegroundColor DarkGray
  Write-Host ''

  # Clave = ruta destino (1 archivo UPDATES -> 1 destino; dedupe si se repite en varios dir*)
  $byDest = @{}
  $filesScanned = 0

  foreach ($pkg in $packages) {
    Get-ChildItem -LiteralPath $pkg.Origen -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
      $filesScanned++
      $rel = $_.FullName.Substring($pkg.Origen.Length).TrimStart('\')
      $dst = Resolve-UpdatesLocalTarget -DestKind $pkg.DestKind -RelativePath $rel -RutaSB $baseLocal
      $key = $dst.ToLowerInvariant()

      $uTime = $_.LastWriteTime
      if ($byDest.ContainsKey($key)) {
        $prev = $byDest[$key]
        if ($uTime -gt $prev.FechaUpdatesRaw) {
          $prev.FechaUpdatesRaw = $uTime
          $prev.Carpeta = $pkg.Nombre
          $prev.Archivo = $rel
          $prev.OrigenUpdates = $_.FullName
        }
      } else {
        $byDest[$key] = [pscustomobject]@{
          Carpeta         = $pkg.Nombre
          Archivo         = $rel
          Destino         = $dst
          DestKind        = $pkg.DestKind
          OrigenUpdates   = $_.FullName
          FechaUpdatesRaw = $uTime
        }
      }
    }
  }

  $relevantes = New-Object System.Collections.Generic.List[object]
  $localNuevos = New-Object System.Collections.Generic.List[object]

  foreach ($key in ($byDest.Keys | Sort-Object)) {
    $row = $byDest[$key]
    $dst = $row.Destino
    $u = $row.FechaUpdatesRaw
    $labelArch = if ($row.DestKind -eq 'WinSys') {
      ('{0} => C:\Windows\SysWOW64\{0}' -f $row.Archivo)
    } else {
      $row.Archivo
    }

    if (-not (Test-Path -LiteralPath $dst)) {
      [void]$relevantes.Add([pscustomobject]@{
          Tipo         = 'No existe en local'
          Carpeta      = $row.Carpeta
          Archivo      = $labelArch
          FechaUpdates = $u.ToString('yyyy-MM-dd HH:mm:ss')
          FechaLocal   = '(no existe)'
          Destino      = $dst
        })
      continue
    }

    $l = (Get-Item -LiteralPath $dst).LastWriteTime
    if ($u -gt $l) {
      [void]$relevantes.Add([pscustomobject]@{
          Tipo         = 'Updates mas nuevo'
          Carpeta      = $row.Carpeta
          Archivo      = $labelArch
          FechaUpdates = $u.ToString('yyyy-MM-dd HH:mm:ss')
          FechaLocal   = $l.ToString('yyyy-MM-dd HH:mm:ss')
          Destino      = $dst
        })
    } elseif ($l -gt $u) {
      [void]$localNuevos.Add([pscustomobject]@{
          Tipo         = 'Local mas nuevo'
          Carpeta      = $row.Carpeta
          Archivo      = $labelArch
          FechaUpdates = $u.ToString('yyyy-MM-dd HH:mm:ss')
          FechaLocal   = $l.ToString('yyyy-MM-dd HH:mm:ss')
          Destino      = $dst
        })
    }
  }

  $faltantes = @($relevantes | Where-Object Tipo -eq 'No existe en local').Count
  $updNuevo = @($relevantes | Where-Object Tipo -eq 'Updates mas nuevo').Count
  $destinos = $byDest.Count
  Write-ST2Log ("Compare scanned={0} destinos={1} relevantes={2} local_nuevo={3}" -f $filesScanned, $destinos, $relevantes.Count, $localNuevos.Count)

  $failList = New-Object System.Collections.Generic.List[string]
  $skipList = New-Object System.Collections.Generic.List[string]
  Write-Host '[3/3] Resumen...'
  if ($filesScanned -eq 0) {
    Complete-Step -Status OBS -Message 'No se encontraron archivos dentro de las carpetas de paquete.'
  } elseif ($relevantes.Count -eq 0) {
    Complete-Step -Status OK -Message 'Sin diferencias relevantes (UPDATES vs LOCAL).' -Detail ("archivos_updates={0} destinos={1} local_mas_nuevo={2}" -f $filesScanned, $destinos, $localNuevos.Count)
    if ($localNuevos.Count -gt 0) {
      Write-Host ("  Nota: {0} con local mas nuevo (informativo)." -f $localNuevos.Count) -ForegroundColor DarkGray
      Write-Host ''
    }
  } else {
    Complete-Step -Status OBS -Message 'Diferencias UPDATES vs LOCAL.' -Detail ("relevantes={0} faltantes={1} updates_nuevo={2} destinos={3}" -f $relevantes.Count, $faltantes, $updNuevo, $destinos)

    Write-Host '  Muestra (primeras 15):' -ForegroundColor DarkGray
    $ordered = @($relevantes | Sort-Object Carpeta, Archivo)
    foreach ($d in @($ordered | Select-Object -First 15)) {
      Write-Host ('     - [{0}] {1}' -f $d.Carpeta, $d.Archivo) -ForegroundColor DarkYellow
      Write-Host ('         {0} | U:{1}  L:{2}' -f $d.Tipo, $d.FechaUpdates, $d.FechaLocal) -ForegroundColor DarkGray
    }
    if ($ordered.Count -gt 15) {
      Write-Host ('     ... y {0} mas (detalle en informe de sesion)' -f ($ordered.Count - 15)) -ForegroundColor DarkGray
    }
    if ($localNuevos.Count -gt 0) {
      Write-Host ("  Tambien: {0} con local mas nuevo (informativo)." -f $localNuevos.Count) -ForegroundColor DarkGray
    }
    Write-Host ''

    foreach ($d in $ordered) {
      $line = ('[{0}] {1} | {2} | U:{3} L:{4}' -f $d.Carpeta, $d.Archivo, $d.Tipo, $d.FechaUpdates, $d.FechaLocal)
      [void]$failList.Add($line)
      Write-ST2Log $line 'OBS'
    }
  }

  if ($localNuevos.Count -gt 0) {
    [void]$skipList.Add(('Total local mas nuevo: {0} (muestra)' -f $localNuevos.Count))
    foreach ($d in @($localNuevos | Sort-Object Carpeta, Archivo | Select-Object -First 10)) {
      [void]$skipList.Add(('[{0}] {1} | U:{2} L:{3}' -f $d.Carpeta, $d.Archivo, $d.FechaUpdates, $d.FechaLocal))
    }
    if ($localNuevos.Count -gt 10) {
      [void]$skipList.Add(('... y {0} mas' -f ($localNuevos.Count - 10)))
    }
  }

  Write-RoutineFooter -Title 'COMPARACION UPDATES COMPLETADA'
  Show-RoutineSummary -Title 'Comparar UPDATES' `
    -Description 'Ruta Instalador (UPDATES) vs Ruta a las DLL (LOCAL): {dirDLL}/{dirAPPSQL}/{dirLOCALSQL} y {winsys}->SysWOW64.' `
    -Counts @{
      scanned       = $filesScanned
      destinos      = $destinos
      relevantes    = $relevantes.Count
      faltantes     = $faltantes
      updates_nuevo = $updNuevo
      local_nuevo   = $localNuevos.Count
    } `
    -FailList @($failList) `
    -SkipList @($skipList)
}

function Invoke-BuscarRenombrados {
  Clear-Host
  Expand-ConsoleForWork
  Write-RoutineHeader -Title 'BUSCAR ARCHIVOS/CARPETAS RENOMBRADAS'
  Reset-StepCounters

  Write-Host '[1/2] Analizando nombres en carpeta local...' -ForegroundColor White
  $base = $script:RutaSB
  if ([string]::IsNullOrWhiteSpace($base) -or -not (Test-Path -LiteralPath $base)) {
    Complete-Step -Status ERROR -Message 'Ruta local invalida o no disponible.'
    Show-RoutineSummary -Title 'Renombrados'
    return
  }

  $base = (Resolve-Path -LiteralPath $base).Path
  Write-Host ("  Ruta: {0}" -f $base) -ForegroundColor DarkGray
  Write-Host ''

  $hits = New-Object System.Collections.Generic.List[object]
  $scanned = 0
  $errorsAccess = 0

  $items = @()
  try {
    $items = @(Get-ChildItem -LiteralPath $base -Recurse -Force -ErrorAction SilentlyContinue)
  } catch {
    $errorsAccess++
  }

  $total = $items.Count
  $i = 0
  foreach ($item in $items) {
    $i++
    $scanned++
    if (($i % 200) -eq 0 -or $i -eq $total) {
      Write-SimpleProgress -Current $i -Total $total -Label 'analizando...'
    }
    $full = $item.FullName
    if ($full -match '(?i)\\rtaccess(\\|$)') { continue }
    $n = $item.Name
    if (-not (Test-IsSuspiciousName -Name $n)) { continue }

    $tipo = if ($item.PSIsContainer) { 'CARPETA' } else { 'ARCHIVO' }
    $rel = $full.Substring($base.Length).TrimStart('\')
    $hits.Add([pscustomobject]@{
        Tipo   = $tipo
        Nombre = $n
        Ruta   = $rel
        Motivo = (Get-SuspiciousReason -Name $n)
      })
  }
  if ($total -gt 0) { Write-Host '' }

  Write-Host '[2/2] Armando resultado...' -ForegroundColor White
  $failList = New-Object System.Collections.Generic.List[string]

  if ($hits.Count -eq 0) {
    Complete-Step -Status OK -Message 'Sin nombres sospechosos.' -Detail ("analizados={0}" -f $scanned)
  } else {
    $arch = @($hits | Where-Object Tipo -eq 'ARCHIVO').Count
    $carp = @($hits | Where-Object Tipo -eq 'CARPETA').Count
    Complete-Step -Status OBS -Message 'Se detectaron nombres sospechosos.' -Detail ("total={0} arch={1} carp={2} analizados={3}" -f $hits.Count, $arch, $carp, $scanned)

    Write-Host '  Detalle:' -ForegroundColor DarkGray
    $ordered = @($hits | Sort-Object Tipo, Ruta)
    $showMax = 40
    $show = @($ordered | Select-Object -First $showMax)
    foreach ($h in $show) {
      Write-Host ('     - [{0}] {1}' -f $h.Tipo, $h.Ruta) -ForegroundColor DarkYellow
      Write-Host ('         motivo: {0}' -f $h.Motivo) -ForegroundColor DarkGray
    }
    if ($ordered.Count -gt $showMax) {
      Write-Host ('     ... y {0} mas (detalle en informe de sesion)' -f ($ordered.Count - $showMax)) -ForegroundColor DarkGray
    }
    Write-Host ''

    foreach ($h in $ordered) {
      $line = ('[{0}] {1} ({2})' -f $h.Tipo, $h.Ruta, $h.Motivo)
      $failList.Add($line)
      Write-ST2Log $line 'OBS'
    }
  }

  Write-RoutineFooter -Title 'BUSQUEDA DE RENOMBRADOS COMPLETADA'
  Show-RoutineSummary -Title 'Renombrados' `
    -Description 'Busca archivos/carpetas con nombres sospechosos (old, bak, copia, backup, temp, __, etc.) en la instalacion local.' `
    -Counts @{ analizados = $scanned; coincidencias = $hits.Count } `
    -FailList @($failList)
}

function Get-TargetUserRegistryRoot {
  # Con elevacion, HKCU es el admin: apuntar al usuario de la sesion activa
  $candidates = New-Object System.Collections.Generic.List[string]

  try {
    $explorers = Get-CimInstance Win32_Process -Filter "Name='explorer.exe'" -ErrorAction SilentlyContinue
    foreach ($p in @($explorers)) {
      $owner = Invoke-CimMethod -InputObject $p -MethodName GetOwner -ErrorAction SilentlyContinue
      if ($owner -and $owner.User) {
        $account = if ($owner.Domain) { '{0}\{1}' -f $owner.Domain, $owner.User } else { $owner.User }
        $candidates.Add($account)
      }
    }
  } catch { }

  try {
    $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
    if ($cs -and $cs.UserName) { $candidates.Add([string]$cs.UserName) }
  } catch { }

  $candidates.Add(('{0}\{1}' -f $env:USERDOMAIN, $env:USERNAME))

  foreach ($account in ($candidates | Select-Object -Unique)) {
    try {
      $sid = ([System.Security.Principal.NTAccount]$account).Translate([System.Security.Principal.SecurityIdentifier]).Value
      $root = "Registry::HKEY_USERS\$sid"
      if (Test-Path -LiteralPath $root) {
        return [pscustomobject]@{ Root = $root; Account = $account; Sid = $sid }
      }
    } catch { }
  }

  return [pscustomobject]@{ Root = 'HKCU:'; Account = ('{0}\{1}' -f $env:USERDOMAIN, $env:USERNAME); Sid = 'HKCU' }
}

function Invoke-FixLentitudTalonariosRdp {
  Clear-Host
  Expand-ConsoleForWork
  Write-RoutineHeader -Title 'LENTITUD TALONARIOS DE RDP'
  $target = Get-TargetUserRegistryRoot
  Write-Host ("Usuario objetivo: {0}" -f $target.Account) -ForegroundColor Cyan
  Write-Host 'Se va a configurar:' -ForegroundColor DarkGray
  Write-Host '  Software\Sistemas Bejerman' -ForegroundColor DarkGray
  Write-Host '  Leer Impresoras = 1' -ForegroundColor DarkGray
  Write-Host ''

  if (-not (Ask-YesNo 'Aplicar este cambio?')) {
    Write-Host 'Operacion cancelada.' -ForegroundColor Yellow
    return
  }

  Reset-StepCounters
  Write-Host '[1/1] Aplicando valor en registro...' -ForegroundColor White
  $key = Join-Path $target.Root 'Software\Sistemas Bejerman'
  try {
    if (-not (Test-Path -LiteralPath $key)) {
      $null = New-Item -Path $key -Force
    }
    Set-ItemProperty -LiteralPath $key -Name 'Leer Impresoras' -Value '1' -Type String -Force
    $check = (Get-ItemProperty -LiteralPath $key -Name 'Leer Impresoras' -ErrorAction Stop).'Leer Impresoras'
    if ($check -eq '1') {
      Complete-Step -Status OK -Message 'Valor Leer Impresoras configurado.' -Detail ("user={0}" -f $target.Account)
    } else {
      Complete-Step -Status ERROR -Message 'No se pudo verificar el valor escrito.'
    }
  } catch {
    Complete-Step -Status ERROR -Message 'No se pudo escribir en el registro.' -Detail $_.Exception.Message
  }

  Write-RoutineFooter -Title 'LENTITUD TALONARIOS RDP COMPLETADO'
  Show-RoutineSummary -Title 'Lentitud Talonarios RDP' `
    -Description ('Setea Leer Impresoras=1 para {0}.' -f $target.Account)
}

function Invoke-FixLentitudImpresionTerminalServer {
  Clear-Host
  Expand-ConsoleForWork
  Write-RoutineHeader -Title 'LENTITUD AL EMITIR/IMPRIMIR EN RDP'
  $target = Get-TargetUserRegistryRoot
  Write-Host ("Usuario objetivo: {0}" -f $target.Account) -ForegroundColor Cyan
  Write-Host 'Se van a eliminar las impresoras mapeadas en:' -ForegroundColor DarkGray
  Write-Host '  Software\Microsoft\Windows NT\CurrentVersion\Devices' -ForegroundColor DarkGray
  Write-Host ''

  if (-not (Ask-YesNo 'Eliminar esas entradas de impresoras?')) {
    Write-Host 'Operacion cancelada.' -ForegroundColor Yellow
    return
  }

  Reset-StepCounters
  Write-Host '[1/1] Limpiando Devices...' -ForegroundColor White
  $key = Join-Path $target.Root 'Software\Microsoft\Windows NT\CurrentVersion\Devices'
  $removed = 0
  $failList = New-Object System.Collections.Generic.List[string]

  if (-not (Test-Path -LiteralPath $key)) {
    Complete-Step -Status OBS -Message 'La clave Devices no existe (nada para limpiar).'
    Write-RoutineFooter -Title 'LENTITUD EMITIR/IMPRIMIR RDP COMPLETADO'
    Show-RoutineSummary -Title 'Lentitud al Emitir/Imprimir en RDP' `
      -Description ('Limpia Devices para {0}.' -f $target.Account)
    return
  }

  try {
    $props = Get-ItemProperty -LiteralPath $key -ErrorAction Stop
    $names = @($props.PSObject.Properties |
        Where-Object { $_.MemberType -eq 'NoteProperty' -and $_.Name -notmatch '^PS' } |
        Select-Object -ExpandProperty Name)

    foreach ($name in $names) {
      try {
        Remove-ItemProperty -LiteralPath $key -Name $name -Force -ErrorAction Stop
        $removed++
        Write-ST2Log ("Devices removed [{0}]: {1}" -f $target.Account, $name) 'OK'
      } catch {
        $failList.Add($name)
        Write-ST2Log ("Devices remove fail: {0} :: {1}" -f $name, $_.Exception.Message) 'ERROR'
      }
    }

    if ($failList.Count -gt 0) {
      Complete-Step -Status OBS -Message 'Limpieza parcial de impresoras.' -Detail ("eliminadas={0} fallos={1}" -f $removed, $failList.Count)
    } elseif ($removed -eq 0) {
      Complete-Step -Status OK -Message 'No habia impresoras listadas en Devices.'
    } else {
      Complete-Step -Status OK -Message 'Impresoras eliminadas de Devices.' -Detail ("eliminadas={0} user={1}" -f $removed, $target.Account)
    }
  } catch {
    Complete-Step -Status ERROR -Message 'No se pudo leer/limpiar Devices.' -Detail $_.Exception.Message
  }

  Write-Host ''
  Write-Host '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!' -ForegroundColor Yellow
  Write-Host '  IMPORTANTE' -ForegroundColor Yellow
  Write-Host '  Luego de ejecutar el proceso, hay que cerrar' -ForegroundColor Yellow
  Write-Host '  la sesion de Windows y volver a iniciarla.' -ForegroundColor Yellow
  Write-Host '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!' -ForegroundColor Yellow
  Write-Host ''

  Write-RoutineFooter -Title 'LENTITUD EMITIR/IMPRIMIR RDP COMPLETADO'
  Show-RoutineSummary -Title 'Lentitud al Emitir/Imprimir en RDP' `
    -Description ('Elimina Devices para {0}. Luego cerrar sesion de Windows y volver a iniciarla.' -f $target.Account) `
    -Counts @{ eliminadas = $removed } `
    -FailList @($failList)
}
#endregion

#region Main
function Start-ST2 {
  Request-Elevation
  Initialize-Console
  Initialize-ST2Log

  $script:RutaSB = Get-RutaSB
  if (-not $script:RutaSB) {
    Write-Host ''
    Write-Host 'No se pudo obtener la ruta de instalacion.'
    Write-Host 'Se busco en:'
    Write-Host '  HKLM\SOFTWARE\WOW6432Node\Sistemas Bejerman'
    Write-Host '  HKLM\SOFTWARE\Sistemas Bejerman'
    Write-Host '  y rutas tipicas de Program Files.'
    Write-Host 'Revise la propiedad "Ruta a las DLL" (u equivalente).'
    Write-Host ''
    Write-ST2Log 'RutaSB no resuelta' 'ERROR'
    Read-Host 'Presione ENTER para salir'
    exit 1
  }

  Write-ST2Log ("RutaSB={0}" -f $script:RutaSB)
  Show-Home
  Show-MainMenu
}

Start-ST2
#endregion
