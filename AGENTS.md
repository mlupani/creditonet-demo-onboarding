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
- **En testing**: implementación completa, corriendo self-review antes
  del PR.
- **Terminado**: PR abierto, esperando revisión humana.
- **En producción**: la mueve el humano a mano después de revisar y
  mergear. El harness nunca mueve un issue a esta columna.

(Ver "Transiciones de estado" más abajo para el orden exacto en que se
mueve el issue entre estas columnas — no es opcional ni descriptivo,
son pasos obligatorios.)

## Al tomar un ticket de "Por hacer"

Decidir caso a caso si el trabajo amerita plan formal — no hay un
checklist fijo de tamaño. Pregunta guía: ¿tiene pasos independientes que
valga la pena trackear o revisar por separado, o es una unidad que se
resuelve de punta a punta sin beneficio real de partirla?

- **Sin plan formal**: comentar en el issue un resumen de una línea de
  lo que se va a hacer, implementar directo (con TDD), y seguir igual
  las transiciones de estado obligatorias de abajo.
- **Con plan formal**: leer la spec completa y generar un plan (en
  Claude Code: `superpowers:writing-plans`). El propio plan decide la
  granularidad en YouTrack con el mismo criterio de tamaño de tarea:
  varias unidades independientes → sub-issue por tarea (y
  sub-subtareas si alguna lo amerita); plan chico o secuencial →
  trabajar sobre el issue padre comentando el progreso.

## Transiciones de estado — obligatorias, en este orden

Estos son pasos de ejecución, no una descripción — cada uno requiere su
propia llamada de API/MCP para cambiar el State, ANTES de seguir al
siguiente. Nunca saltar de "Por hacer" directo a "Terminado".

1. Antes de escribir una sola línea de código: mover el issue a
   **"En progreso"**.
2. Mientras se implementa (con o sin plan formal, en Claude Code:
   `superpowers:subagent-driven-development` si hubo plan): el issue
   queda en "En progreso".
3. Al terminar la implementación, ANTES de crear el PR: mover el issue
   a **"En testing"** y correr el self-review / whole-branch review.
4. Recién cuando la review está limpia: crear el PR, comentar el link,
   y mover el issue a **"Terminado"**.

Si en algún punto el estado actual del issue no coincide con el paso
que se está por hacer, corregirlo antes de continuar — no asumir que
ya está bien.

## Convenciones

- Branch: `<YOUTRACK-ID>-slug-corto` (ej. `creditonet-123-fix-auth`).
  El nombre del branch y del PR deben incluir el ID del issue — la
  integración VCS de YouTrack ya está configurada para linkear
  commits/PRs automáticamente cuando aparece ese ID, así que no hace
  falta pegar el link a mano.
- Cada comentario que se deja en YouTrack debe ser breve: qué se hizo,
  qué falta, link a commits/PR — no pegar el diff completo.
- Acceso a YouTrack: si el harness tiene disponible el MCP de YouTrack,
  usarlo. Si no, usar la REST API directa con el token disponible en el
  entorno (`YOUTRACK_API_TOKEN` / `YOUTRACK_URL`).

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
comentario del issue como una decisión tomada (qué se decidió y por qué),
y seguir — no bloquear esperando respuesta.

Cuando sí aplica uno de los 4 casos: imprimir la pregunta con el
marcador `NEEDS_INPUT: <pregunta>` y terminar el turno ahí. El
orquestador externo se encarga de mandar esa pregunta por Telegram y
retomar la sesión cuando llegue la respuesta.

## Notificaciones (Telegram)

Al abrir un PR o terminar una tarea, notificar por Telegram:

```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  --data-urlencode "chat_id=$TELEGRAM_CHAT_ID" \
  --data-urlencode "text=<resumen breve: qué se hizo, link al PR>"