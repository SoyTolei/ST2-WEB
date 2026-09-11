# Roadmap — ST2 WEB

Ideas y pendientes sin fecha fija. Lo marcado como **después** no se implementa hasta que lo pidamos.

## Después

- [ ] **Migración de hosting (Railway → Fly.io u otro)**  
  Evaluado: viable, poco cambio de código (Docker + volumen de datos).  
  Motivo para esperar: Railway funciona; migrar es opcional (costo/colas/control), no urgente.

- [ ] **Notificaciones ST2 → flujos de Microsoft Teams**  
  Idea: el backend hace `POST` a un webhook de Power Automate / Workflows y el flujo publica en un canal (Adaptive Card con link a ST2).  
  Arranque sugerido: solo blanqueo (o digest de pendientes), con dedupe para no spamear.  
  No depende de tener la pestaña abierta ni de permisos del navegador.  
  Contras: secreto del webhook, elegir canal/frecuencia, no reemplaza 1:1 la noti desktop de la web.  
  Niveles: (A) webhook + texto fijo → (B) payload + card → (C) Graph/DMs. Preferir B chico cuando lo pidamos.

## Ideas abiertas

- [ ] Unificar login ST2 + sesión del panel ADMIN (menos pasos)
- [ ] Badge de pendientes ADMIN actualizado en background
- [ ] Rol “admin” para más de un correo
- [ ] Auditoría de aprobaciones / rechazos de acceso

## Nota — aviso “hay versión nueva” (Yohana / Franco)

Causa probable (no es por usuario en el server): dejan la pestaña abierta muchas horas mientras hay deploys seguidos. El cliente comparaba HTML viejo vs `/api/version` y **cada SHA nuevo reabría el modal**, aunque ya hubieran tocado “Actualizar luego”.  
Mitigación en cliente: tras el primer aviso / posponer / recargar fallida, solo barra hasta que el HTML alcance el build vivo (sin re-modal ni noti desktop por cada deploy).

## Hecho recientemente (referencia)

- Cookie de sesión firmada (HMAC) — ya no alcanza inventar el email en la cookie
- Panel ADMIN como pestaña dedicada (sin acceso oculto en Acerca de)
- Contraseña de super-admin por variable de entorno
- Alertas de blanqueo más frecuentes sin refrescar
- Aprobación de usuarios nuevos antes de entrar a la app
