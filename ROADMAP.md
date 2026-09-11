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

## Nota — aviso de actualización (sin modal)

**Decisión:** se eliminó el cartel modal del centro. Solo queda la **barra naranja fija arriba** + **noti de escritorio** si la pestaña está en segundo plano.

Flujo para usuarios activos durante un deploy:
1. El cliente consulta `/api/version` ~cada 45s (+ heartbeat de sesión).
2. Si el HTML cargado es más viejo que el build vivo (con anti flip-flop de réplicas), aparece la barra.
3. Pueden seguir trabajando; “Recargar ahora” cuando les quede cómodo.
4. Si la pestaña está oculta y tienen permisos de notificación, llega un aviso del SO una vez por build.

Se mantiene la lógica de “newest / stuck / soft” para no spamear si una réplica vieja contesta mal.  
Teams / webhooks siguen en roadmap (otro canal, no reemplazo de esto).

## Hecho recientemente (referencia)

- Cookie de sesión firmada (HMAC) — ya no alcanza inventar el email en la cookie
- Panel ADMIN como pestaña dedicada (sin acceso oculto en Acerca de)
- Contraseña de super-admin por variable de entorno
- Alertas de blanqueo más frecuentes sin refrescar
- Aprobación de usuarios nuevos antes de entrar a la app
