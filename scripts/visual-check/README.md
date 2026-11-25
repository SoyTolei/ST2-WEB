# Prueba visual de ST2

Herramientas para cambiar CSS/JS sin romper nada. Requieren la app corriendo en local
(`dotnet run --project src/PortalClienchi.Web/PortalClienchi.Web.csproj`) y Playwright para
Python (`pip install playwright`); usan el Edge instalado.

| Script | Para qué |
|---|---|
| `visual_check.py capture <dir>` / `compare <a> <b> [diffs] [--threshold N]` | Capturas de cada pantalla en claro y oscuro, y comparación píxel a píxel. `--threshold 3` para cambios de color sutiles. |
| `computed_snapshot.py <out.json> [light\|dark]` / `--diff a.json b.json` | Estilo computado de **todos** los elementos (incluidos ocultos y `::before/::after`). Más fuerte que las capturas para refactors que no deberían cambiar nada. |
| `important_cleanup.py <wwwroot> [--apply] [--target x.css]` | Saca los `!important` que se puede probar que no hacen falta. Después, verificar con `computed_snapshot.py --diff`. |

Flujo: foto antes → cambio → foto después → diff = 0.
