# PortalClienchiWEB

Versión web de **ST2**, basada en la lógica de [PortalClienchi](../PortalClienchi) (escritorio). El proyecto original **no se modifica**; este repo referencia `PortalClienchi.Core` como biblioteca compartida.

## Estado actual (MVP)

- Buscador del **Portal Cliente** en vivo (misma API que la app de escritorio)
- Filtros por tipo y año
- Vista previa HTML del instructivo
- Copiar link / abrir en portal / abrir adjuntos

Próximos módulos: Planillas, THOM, AI Platform.

## Requisitos

- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0) (o runtime ASP.NET Core 9)

## Configuración

1. Copiá el ejemplo de credenciales:

```powershell
cd "C:\PARA LOGMEIN\XXXXXXXX\TEST EXES\PortalClienchiWEB\src\PortalClienchi.Web"
copy appsettings.local.json.example appsettings.local.json
```

2. Editá `appsettings.local.json` con tu usuario y contraseña del portal.

> Las credenciales quedan **solo en el servidor**. No se envían al navegador.
>
> ST2 Web usa la misma ruta que el escritorio: `%LOCALAPPDATA%\ST2\appsettings.local.json`.  
> Si la app de escritorio ya funciona, podés reutilizar ese archivo sin duplicar credenciales.

## Ejecutar

```powershell
cd "C:\PARA LOGMEIN\XXXXXXXX\TEST EXES\PortalClienchiWEB"
dotnet run --project src\PortalClienchi.Web\PortalClienchi.Web.csproj
```

Abrí [http://localhost:5180](http://localhost:5180).

**Importante:** si creaste o editaste `appsettings.local.json`, **reiniciá el servidor** (Ctrl+C y volvé a ejecutar `dotnet run`).

## Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---------|----------------|-----------|
| «Error al buscar» / login 400 | Credenciales vacías o servidor viejo | Reiniciar `dotnet run` después de configurar `appsettings.local.json` |
| «Faltan credenciales» | No hay Email/Password | Copiá el `.example` o usá el archivo de `%LOCALAPPDATA%\ST2\` |
| THOM/AI no cargan en iframe | El sitio bloquea embeds | Usá «Abrir en navegador» (igual puede pasar en algunos entornos web) |

## Estructura

```
PortalClienchiWEB/
├── PortalClienchiWEB.sln
└── src/
    └── PortalClienchi.Web/          ← API + frontend estático
        ├── Program.cs
        ├── appsettings.json
        └── wwwroot/                 ← UI del buscador
```

## Dependencia del proyecto original

`PortalClienchi.Web` referencia:

`../PortalClienchi/src/PortalClienchi.Core/PortalClienchi.Core.csproj`

No hace falta copiar archivos: la lógica de búsqueda, API del portal e utilidades HTML se reutilizan sin tocar el repo de escritorio.

## Publicar

```powershell
dotnet publish src\PortalClienchi.Web\PortalClienchi.Web.csproj -c Release -o publish
```

Incluí `appsettings.local.json` en el servidor de destino (o variables de entorno equivalentes).
