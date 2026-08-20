# Roadmap — ST2 WEB

Ideas y pendientes sin fecha fija. Lo marcado como **después** no se implementa hasta que lo pidamos.

## Después

- [ ] **Migración de hosting (Railway → Fly.io u otro)**  
  Evaluado: viable, poco cambio de código (Docker + volumen de datos).  
  Motivo para esperar: Railway funciona; migrar es opcional (costo/colas/control), no urgente.

## Ideas abiertas

- [ ] Unificar login ST2 + sesión del panel ADMIN (menos pasos)
- [ ] Badge de pendientes ADMIN actualizado en background
- [ ] Rol “admin” para más de un correo
- [ ] Auditoría de aprobaciones / rechazos de acceso
- [ ] Sesión firmada (cookie de identidad con firma HMAC)

## Hecho recientemente (referencia)

- Panel ADMIN como pestaña dedicada (sin acceso oculto en Acerca de)
- Contraseña de super-admin por variable de entorno
- Alertas de blanqueo más frecuentes sin refrescar
- Aprobación de usuarios nuevos antes de entrar a la app
