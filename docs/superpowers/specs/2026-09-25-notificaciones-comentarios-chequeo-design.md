# Diseño — Notificaciones de comentarios + "Comentario canal de venta" en chequeo

## Contexto

La comunicación entre chequeadores telefónicos y canal de venta hoy existe a medias:
los comentarios por crédito (`app.comentarios`) ya se pueden crear y ver, pero nadie se
entera cuando el otro rol escribe. La campanita del header (`Header.tsx`) muestra solo
avisos estáticos (`NOTIFICACIONES` en `mocks.ts`). Las sesiones son mockeadas por
bandeja (`SESION`, `SESION_ANALISTA`, `SESION_CHEQUEADOR`), sin usuarios reales.

## Objetivo

1. Tercera opción en el Resultado del chequeo: **"Comentario canal de venta"** — deja
   solo un comentario, sin cambiar el estado del crédito.
2. La campanita refleja esa comunicación: cada comentario en un crédito genera un aviso;
   al hacer clic navega al crédito según el estado en que esté.

## Alcance

- Nuevo store liviano `src/lib/notificaciones.ts` (`useSyncExternalStore` +
  `sessionStorage`, mismo patrón que `productos.ts`).
- Regla uniforme: **todo** `agregarComentario` emite 1 notificación (chequeador,
  vendedor y analista). Mundo mockeado: visibles para todos los roles.
- Campanita: sección dinámica sobre las estáticas, punto rojo, "Marcar todas como
  leídas", clic navega + precarga + marca leída.
- Tercera opción radial en `ChequeoCredito.tsx` con botón "Enviar comentario".

## Fuera de alcance

- Targeting por rol (autor → rol destino) y auto-apertura del detalle al navegar: queda
  como follow-up cuando existan usuarios/roles reales.
- Push, sonido, polling entre pestañas (el store vive por pestaña vía `sessionStorage`).

## Modelo

```ts
export interface ComentarioNotificacion {
  id: string;                 // `notif-${Date.now()}`
  creditoId: string;          // `_id` de la DB o "" si es la solicitud en curso
  numeroCredito: string | null;
  autor: string;
  texto: string;              // extracto (primeros ~120 caracteres)
  fecha: string;              // selloTiempo()
  estado: EstadoCredito;      // snapshot para resolver la bandeja destino
  leida: boolean;
}
```

Store: `getNotificaciones()`, `agregarNotificacion()`, `marcarLeida(id)`,
`marcarTodasLeidas()`, `useNotificaciones()`; persistencia en
`"creditonet.notificaciones.v1"` (tolerante a storage ausente/dañado, como productos).

## Eventos

- `agregarComentario(texto, autor)` (application-context) además apendea la
  notificación con snapshot `{creditoId: appDbId, numeroCredito, estado}` del `app`
  vigente. Sin cambios a su firma.
- La opción "Comentario canal de venta" del chequeo usa ese mismo camino
  (`autor = SESION_CHEQUEADOR.nombre`); no toca `chequeoTelefonico` ni el estado.

## Campanita (`Header.tsx`)

- `Notificaciones()` lee `useNotificaciones()`; dinámicas primero (con crédito, autor,
  extracto, fecha), luego las estáticas actuales sin cambios.
- No-leídas = dinámicas `!leida` + estáticas no marcadas (lógica actual intacta).
- Clic en dinámica: `marcarLeida(id)` + `cargarCreditoDeDB(creditoId)` (si hay) +
  `router.push(resolverBandeja(estado))`. Si es la solicitud en curso sin `_id`, solo
  navega a la bandeja.
- `resolverBandeja(estado)`: `CHEQUEO_TELEFONICO → /chequeo`;
  `OBSERVADO | BORRADOR | EN_TRAMITE → /`; resto `→ /analisis`. El crédito queda
  cargado como "En curso" en su bandeja (no se auto-abre el detalle: follow-up).

## Opción en chequeo (`ChequeoCredito.tsx`)

- Tercer radio: título "Comentario canal de venta", detalle "Deja un comentario para
  el canal de venta sin mover el crédito: sigue en chequeo." (tono info/neutro, no
  danger: no es un no-correcto).
- Requiere comentario ≥ 5 (misma regla vigente). Botón primario "Enviar comentario":
  `agregarComentario(texto, SESION_CHEQUEADOR.nombre)`, limpia el campo y **se queda**
  (sin `onSalir`, sin `ConfirmationModal`: no hay cambio de estado que confirmar).
- El hilo (`ListaComentarios`, ya renderizado arriba) muestra el comentario al instante.

## Testing

- `npx tsc --noEmit` + `npx eslint` en tocados (solo pre-existentes).
- Manual: comentario desde chequeo → punto rojo → clic → cae en el crédito (CHEQUEO);
  comentario desde vendedor (bandeja) → campanita → clic → bandeja según estado;
  "Marcar todas como leídas" apaga el punto; recarga conserva leídas (sessionStorage).
- Casos borde: comentar sobre solicitud en curso sin `_id` (navega sin precargar);
  crédito que cambió de estado después del comentario (navega por snapshot, aceptado).
