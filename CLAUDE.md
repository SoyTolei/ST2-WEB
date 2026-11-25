# ST2 WEB

Suite interna ST2 (PortalClienchi.Web). Responder siempre en español.

## Deploy

Al terminar trabajo usable:

1. Commit de cambios relevantes (sin bin/obj ni secretos).
2. Push a origin de la rama actual (normalmente main), sin preguntar.
3. No force push salvo pedido explícito.
4. Mensajes de commit en español, cortos, enfocados en el por qué.
5. Si falta identidad git, usar `GIT_AUTHOR_*` / `GIT_COMMITTER_*` con el autor de commits recientes; no cambiar `git config`.

## Stack

- ASP.NET + wwwroot (JS/CSS vanilla)
- Datos en `ST2_DATA_DIR` / SQLite
- JS/CSS sin `?v=` a mano: el servidor versiona por deploy (import map en `St2IndexHtml`). Un `?v=` manual en un import carga el módulo dos veces; hay un test que lo frena. Las imágenes sí llevan `?v=` manual.

## Notas de producto

- Planillas: transferencia, referral I+D, oportunidad, PDF, blanqueo, borrado de bases, Chile/Legal según permisos.
- Easter eggs / cumpleaños en Planillas: ver `.cursor/rules/planillas-easter-cumple.mdc` si tocás ese flujo.
