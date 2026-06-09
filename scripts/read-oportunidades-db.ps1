# Lee la base SQLite de oportunidades (local o ruta custom).
# Uso: .\scripts\read-oportunidades-db.ps1
#      .\scripts\read-oportunidades-db.ps1 -Path "C:\ruta\oportunidades.db"

param(
    [string]$Path = (Join-Path $env:LOCALAPPDATA "ST2\oportunidades.db")
)

if (-not (Test-Path $Path)) {
    Write-Host "No existe: $Path" -ForegroundColor Red
    Write-Host ""
    Write-Host "Rutas habituales:"
    Write-Host "  Local (dotnet run):  %LOCALAPPDATA%\ST2\oportunidades.db"
    Write-Host "  Railway (servidor):  /data/st2/oportunidades.db  (no esta en tu PC)"
    exit 1
}

Write-Host "Base: $Path" -ForegroundColor Cyan
Write-Host "Tamano: $((Get-Item $Path).Length) bytes"
Write-Host ""

python -c "import sqlite3; p=r'$($Path -replace '\\','\\')'; c=sqlite3.connect(p); cur=c.cursor(); cur.execute('SELECT COUNT(*) FROM oportunidades'); print('Total filas:', cur.fetchone()[0]); print(''); cur.execute('SELECT id, fecha, substr(descripcion,1,40), usuario, confirmada FROM oportunidades ORDER BY id'); rows=cur.fetchall(); print('(tabla vacia)' if not rows else ''); [print(f'{r[0]:>4}  {r[1]:<12}  {r[3]:<35}  {r[4]:<4}  {r[2]}') for r in rows]"
