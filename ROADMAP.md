# Roadmap — ST2 WEB

Ideas y pendientes sin fecha fija. Lo marcado como **después** no se implementa hasta que lo pidamos.

## Después

- [ ] **Migración de hosting (Railway → Fly.io u otro)**  
  Evaluado: viable, poco cambio de código (Docker + volume `/data/st2`).  
  Motivo para esperar: Railway funciona; migrar es opcional (costo/colas/control), no urgente.

## Ideas abiertas

- [ ] Unificar login ST2 + sesión del panel ADMIN (menos pasos para el super-admin)
- [ ] Badge de pendientes ADMIN actualizado en background
- [ ] Rol “admin” para más de un correo (hoy: super-admin hardcodeado)
- [ ] Auditoría de aprobaciones / rechazos de acceso

## Hecho recientemente (referencia)

- Panel ADMIN como pestaña (`/tolei`), sin easter egg en Acerca de
- Contraseña de super-admin por `ST2_SUPER_ADMIN_PASSWORD`
- Alertas de blanqueo más frecuentes sin refrescar
- Aprobación de usuarios nuevos antes de entrar a la app
