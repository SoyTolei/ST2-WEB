# Paquetes ST2 embebidos en el deploy

Al iniciar, la app copia lo que haya acá al volume (`/data/st2/tools`).

## Estructura

```
tools-packages/
  bat/     ← poné acá el .bat / .zip / .exe de ST2.BAT  (ej. st2ps.bat)
  sql/     ← poné acá el .zip / .exe de ST2.SQL
```

Extensiones válidas: `.zip` `.7z` `.rar` `.exe` `.msi` `.bat` `.cmd` `.ps1` `.bin`

Cada deploy con un archivo nuevo (o más reciente) lo publica solo.
El SQL (~75 MB) puede ir acá si el repo lo banca; si no, usá el botón URL.
