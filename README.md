# ST2 WEB

Suite web interna **ST2**: planillas, blanqueo de accesos, generador de PDFs, Portal Cliente, THOM y AI Platform.

> Nombre técnico del proyecto en código: `PortalClienchi.Web` / `PortalClienchi.Core` (legado). El producto visible es **ST2**.

## Qué incluye

| Módulo | Descripción |
|--------|-------------|
| **Sistema de Planillas** | Transferencia entre mesas, Referral I+D, Oportunidad de venta |
| **Blanqueo** | Solicitudes ONVIO / On Balance / Portal Cliente, confirmación y alertas |
| **PDF Portal** | Generación de PDFs A4 con branding TR |
| **Portal Cliente** | Búsqueda de instructivos, vista previa y acceso al portal |
| **THOM** | Open Arena / CSS-TAP en ventana integrada |
| **AI Platform** | Acceso a la plataforma de IA corporativa |
| **ADMIN** | Panel de accesos (aprobación de usuarios y módulos) — ruta `/tolei` |

## Requisitos

- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- (Opcional) Docker, para el mismo build que producción

## Configuración local

```powershell
cd src/PortalClienchi.Web
copy appsettings.local.json.example appsettings.local.json
```

Editá `appsettings.local.json` con tus credenciales. Ese archivo **no se sube a Git**.

También podés usar variables de entorno (Railway / Docker), por ejemplo:

- `ST2_SUPER_ADMIN_PASSWORD` — clave extra del super-admin al entrar
- `ST2_ACCESS_ADMIN_USER` / `ST2_ACCESS_ADMIN_PASSWORD` — panel ADMIN
- Credenciales de portales e IA según `appsettings.local.json.example`

## Ejecutar

```powershell
dotnet run --project src/PortalClienchi.Web/PortalClienchi.Web.csproj
```

Abrí la URL que indique la consola (por defecto suele ser `http://localhost:5180`).

Si cambiás `appsettings.local.json`, reiniciá el servidor.

## Estructura

```
ST2-WEB/
├── Dockerfile
├── railway.toml
├── PortalClienchiWEB.sln
├── ROADMAP.md
└── src/
    ├── PortalClienchi.Core/     ← lógica compartida (portal, utilidades)
    └── PortalClienchi.Web/      ← API ASP.NET + frontend (wwwroot)
```

Datos en producción: SQLite y archivos bajo `ST2_DATA_DIR` (por defecto `/data/st2`).

## Deploy

Producción actual: **Railway** (Docker + volume en `/data/st2`, auto-deploy desde `main`).

```powershell
dotnet publish src/PortalClienchi.Web/PortalClienchi.Web.csproj -c Release -o publish
```

Healthcheck: `GET /api/live`

## Notas de seguridad

- No commits de `appsettings.local.json` ni secretos reales
- El panel ADMIN y la clave de super-admin van por variables de entorno
- Antes de hacer el repo público, rotá cualquier clave que haya estado en chats o en configs locales

## Roadmap

Ver [ROADMAP.md](./ROADMAP.md).
