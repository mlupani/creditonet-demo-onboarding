# Flujo de trabajo: YouTrack + GitHub

Este archivo define cómo trabajar sobre tickets de YouTrack en este repo. Aplica a cualquier harness (Claude Code, Codex, OpenCode).

## Contexto del proyecto

- Proyecto YouTrack: `creditonet` (instancia https://miguel.youtrack.cloud)
- Este repo corresponde únicamente a ese proyecto — no actuar sobre
  issues de otros proyectos en la misma instancia salvo que se indique
  explícitamente.

## Tablero YouTrack — columnas

- **Backlog**: specs en borrador. Solo el humano las crea/edita.
- **Por hacer**: spec o tarea lista para tomar.
- **En progreso**: se está implementando.
- **Hecho**: PR abierto, esperando revisión humana.
- **Mergeado**: el humano revisó y mergeó el PR. La mueve el humano,
  nunca el harness.
- **En producción**: deploy real confirmado. La mueve el humano, nunca
  el harness.

## Al tomar un ticket de "Por hacer"

Decidir caso a caso si el trabajo amerita plan formal — no hay un
checklist fijo de tamaño. Pregunta guía: ¿tiene pasos independientes que
valga la pena trackear o revisar por separado, o es una unidad que se
resuelve de punta a punta sin beneficio real de partirla?

 **Sin plan formal**: comentar en el issue un resumen de una línea de
  lo que se va a hacer, implementar directo (con TDD), y seguir igual
  las transiciones de estado obligatorias de abajo.
 **Con plan formal**: leer la spec completa y generar un plan (en
  Claude Code: `superpowers:writing-plans`). El propio plan decide la
  granularidad en YouTrack con el mismo criterio de tamaño de tarea:
  varias unidades independientes → sub-issue por tarea (y
  sub-subtareas si alguna lo amerita); plan chico o secuencial →
  trabajar sobre el issue padre comentando el progreso.
 **Con plan formal** (en Claude Code): además de lo anterior, seguir
  la sección "Model Selection" de `subagent-driven-development` —
  especificar SIEMPRE el modelo explícito al dispatchear cada
  subagente (mecánico → barato, integración/juicio → estándar,
  arquitectura y review final de todo el branch → el más capaz). No
  omitir el modelo — si se omite, hereda el de la sesión, generalmente
  el más caro, y anula el ahorro.

## Transiciones de estado — obligatorias, en este orden

Estos son pasos de ejecución, no una descripción — cada uno requiere su
propia llamada de API/MCP para cambiar el State, ANTES de seguir al
siguiente. El harness solo controla hasta "Hecho" — "Mergeado" y "En
producción" las mueve el humano.

1. Antes de escribir una sola línea de código: mover el issue a
   **"En progreso"** y notificar por Telegram que se empezó (ver
   sección Notificaciones).
2. Mientras se implementa (con o sin plan formal, en Claude Code:
   `superpowers:subagent-driven-development` si hubo plan): el issue
   queda en "En progreso". El testing real (TDD por tarea, review por
   tarea) ya ocurre continuamente en esta etapa.
3. Antes de crear el PR: correr la whole-branch review final / suite de
   tests completa (el único punto donde es puramente verificación, sin
   código nuevo).
   tests completa — **solo si hubo plan formal**. Si fue una tarea
   sin plan formal, el self-review que ya hizo la implementación TDD
   (tests corridos, diff propio revisado) alcanza — no dispatchear un
   reviewer separado para un cambio chico y mecánico.
4. Recién cuando la review está limpia: crear el PR, comentar el link,
   y mover el issue a **"Hecho"** — notificar por Telegram.

Si en algún punto el estado actual del issue no coincide con el paso
que se está por hacer, corregirlo antes de continuar — no asumir que
ya está bien.

## Convenciones

  - Branch: `<YOUTRACK-ID>-slug-corto` (ej. `creditonet-123-fix-auth`).
  - Cada ticket trabaja en su propio git worktree/branch — nunca
  compartir worktree entre tickets distintos, incluso si corren en
  paralelo (dos tickets en paralelo son seguros; dos tareas del MISMO
  ticket en paralelo, no — por eso nunca pasa, ver más abajo).
  El nombre del branch y del PR deben incluir el ID del issue — la
  integración VCS de YouTrack ya está configurada para linkear
  commits/PRs automáticamente cuando aparece ese ID.
- Cada comentario que se deja en YouTrack debe ser breve: qué se hizo,
  qué falta, link a commits/PR — no pegar el diff completo.
- Acceso a YouTrack: si el harness tiene disponible el MCP de YouTrack,
  usarlo. Si no, usar la REST API directa con el token disponible en el
  entorno (`YOUTRACK_API_TOKEN` / `YOUTRACK_URL`).
- Si durante la tarea se genera un archivo `.md` de spec o plan (por
  ejemplo el que arma `superpowers:writing-plans` en
  `docs/superpowers/plans/`), subirlo como adjunto al issue de YouTrack
  antes de terminar. El MCP de YouTrack no tiene una tool para esto -
  usar la REST API directa con `curl`, sin importar si el resto del
  acceso a YouTrack se hace por MCP:
  ```bash
  curl -s -F "file=@<ruta al .md>" \
    -H "Authorization: Bearer $YOUTRACK_API_TOKEN" \
    -X POST "$YOUTRACK_URL/api/issues/<ID>/attachments?fields=id,name"
  ```

## Cuándo parar y cuándo no

Un flujo corriendo no espera a un humano por defecto — ante una decisión
ambigua, tomarla con el mejor criterio razonable y seguir. Solo estas
cuatro cosas ameritan preguntar:

1. Una operación irreversible o destructiva
2. Una acción sensible a seguridad
3. Un side-effect fuera de este repo/worktree que las normas piden
   confirmar antes (merge, push a branch compartido, publicar algo)
4. Un plan tan roto que cualquier camino hacia adelante es una adivinanza

Para cualquier otra ambigüedad: decidir, dejarlo registrado en el
comentario del issue, y seguir — no bloquear esperando respuesta.

Cuando sí aplica uno de los 4 casos: imprimir la pregunta con el
marcador `NEEDS_INPUT: <pregunta>` y terminar el turno ahí. El
orquestador externo manda esa pregunta por Telegram y retoma la sesión
cuando llegue la respuesta.

## Notificaciones (Telegram)

Notificar por Telegram al mover a "En progreso" y al llegar a "Hecho".

**Paso 1**: escribir el mensaje a un archivo de texto plano temporal
usando la herramienta de escritura de archivos (Write/edit de archivo)
— NUNCA un comando de shell (`echo`, `printf`) — con este contenido:

    Proyecto: creditonet
    Tarea: <ID> - <título corto>
    Estado: <🔄 En progreso | ✅ Hecho>
    PR: <link o "—">
    Link de tarea: https://miguel.youtrack.cloud/issue/<ID>

**Paso 2**: correr curl leyendo el contenido de ESE archivo con `@`
(no repetir el texto en el comando):

```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  --data-urlencode "chat_id=$TELEGRAM_CHAT_ID" \
  --data-urlencode "text@/ruta/al/archivo/del/paso1.txt"

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
