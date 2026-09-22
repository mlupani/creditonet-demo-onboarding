## Contexto del proyecto

- Proyecto YouTrack: `creditonet` (instancia https://miguel.youtrack.cloud)
- Este repo corresponde únicamente a ese proyecto — no actuar sobre
  issues de otros proyectos en la misma instancia salvo que se indique
  explícitamente.

# Flujo de trabajo: YouTrack + GitHub

Este archivo define cómo trabajar sobre tickets de YouTrack en este repo. Aplica a cualquier harness (Claude Code, Codex, OpenCode).

## Tablero YouTrack — columnas y quién las mueve

- **Backlog**: specs en borrador. Solo el humano las crea/edita.
- **Por hacer**: spec o tarea lista para tomar. Al arrancar, el harness:
  1. Decide caso a caso si el trabajo amerita plan formal — no hay un
     checklist fijo de tamaño. Pregunta guía: ¿tiene pasos independientes
     que valga la pena trackear o revisar por separado, o es una unidad
     que se resuelve de punta a punta sin beneficio real de partirla?
     - **Sin plan formal**: comentar en el issue un resumen de una línea
       de lo que se va a hacer, implementar directo (con TDD), y seguir
       el resto del flujo de columnas igual que cualquier otra tarea.
     - **Con plan formal**: leer la spec completa y generar un plan
       (en Claude Code: `superpowers:writing-plans`). El propio plan
       decide la granularidad en YouTrack con el mismo criterio de
       tamaño de tarea: varias unidades independientes → sub-issue por
       tarea (y sub-subtareas si alguna lo amerita); plan chico o
       secuencial → trabajar sobre el issue padre comentando el progreso.
  2. Mover el issue a "En progreso" al empezar.
- **En progreso**: ejecutar el plan (en Claude Code:
  `superpowers:subagent-driven-development`) o implementar directo si no
  hubo plan. Comentar avances relevantes en el issue (o sub-issues) a
  medida que se completan.
- **En testing**: cuando la implementación está completa, antes de abrir
  el PR — corresponde a la revisión final / auto-testing del propio
  harness antes de entregar.
- **Terminado**: al pasar la revisión final, crear el PR y comentar el
  link en el issue. **Nunca mergear el PR ni hacer push a
  main/master sin confirmación explícita del humano.**
- **En producción**: la mueve el humano a mano después de revisar y
  mergear. El harness nunca mueve un issue a esta columna.

## Convenciones

- Branch: `<YOUTRACK-ID>-slug-corto` (ej. `PROJ-123-fix-auth-timeout`).
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
marcador `NEEDS_INPUT: <pregunta>` y terminar el turno ahí, en vez de
quedarse esperando. El orquestador externo se encarga de mandar esa
pregunta por Telegram y retomar la sesión cuando llegue la respuesta.

## GitHub

- `gh` ya está disponible y autenticado — usarlo para todo lo de GitHub
  (`gh pr create`, etc.), nunca operaciones directas contra la API sin
  necesidad.
- El PR sale de la máquina donde corrió el harness (local o VPS, según
  quién haya tomado el job).
- Nunca mergear un PR sin confirmación explícita del humano.

## Notificaciones (Telegram)

Al abrir un PR o terminar una tarea, notificar por Telegram:

curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  --data-urlencode "chat_id=$TELEGRAM_CHAT_ID" \
  --data-urlencode "text=<resumen breve: qué se hizo, link al PR>"

No mandar el diff ni texto largo — un resumen de una línea alcanza.