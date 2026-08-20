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
| **ADMIN** | Panel de control de accesos y módulos por usuario |

## Requisitos

- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- (Opcional) Docker, para el mismo build que producción

## Configuración local

```powershell
cd src/PortalClienchi.Web
copy appsettings.local.json.example appsettings.local.json
```

Editá `appsettings.local.json` con tus credenciales. Ese archivo está en `.gitignore` y no debe subirse.

En producción, las credenciales y claves van por variables de entorno del host (ver el `.example` como guía de claves).

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

Datos en producción: SQLite y archivos bajo el directorio configurado en `ST2_DATA_DIR` (por defecto `/data/st2`).

## Deploy

Producción actual: **Railway** (Docker + volumen persistente, auto-deploy desde `main`).

```powershell
dotnet publish src/PortalClienchi.Web/PortalClienchi.Web.csproj -c Release -o publish
```

Healthcheck: `GET /api/live`

## Roadmap

Ver [ROADMAP.md](./ROADMAP.md).
