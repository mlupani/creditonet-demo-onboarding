# Diseño — Firma FEL/AFEL, refirma y chequeo telefónico antes de liquidar

Fecha: 2026-09-23
Estado: implementado

## Regla de negocio

Aprobar un crédito ya no lo manda a liquidación. El camino es:

```text
Analista aprueba
  ↓ según modalidad de firma del producto (con excepciones del organismo)
  ├─ Electrónica → FEL (EN_FIRMA) → el cliente firma → AFEL
  ├─ Física      → AFEL (FIRMADO) directo, firma manual ya cargada
  └─ Ambas       → el analista elige el método en el modal de aprobación
AFEL: el analista verifica → Aprobar firma / Rechazar / Refirmar
  ↓ firma aprobada
  ├─ producto.requiereChequeoTelefonico → CHEQUEO_TELEFONICO → PARA_LIQUIDAR
  └─ si no → PARA_LIQUIDAR
```

Nunca se llega a `PARA_LIQUIDAR` sin firma aprobada ni, si el producto lo exige, sin chequeo
(`puedeLiquidar` en `src/lib/firma.ts`).

## Refirma

- Una sola refirma: el historial (`firmas`) tiene como máximo 2 instancias.
- Primera AFEL: "Refirmar" disponible → vuelve a FEL, la instancia 1 queda
  `REFIRMA_SOLICITADA` y se abre la instancia 2.
- Segunda AFEL: no hay "Refirmar"; sólo aprobar o rechazar. Rechazar deja la instancia 2 como
  `RECHAZADA` y el crédito en `RECHAZADO` (origen ANALISTA).
- El historial registra ambas instancias (método, fecha de firma, resultado, fecha de decisión).

## Modelo

- `EstadoCredito` suma `CHEQUEO_TELEFONICO` (FEL = `EN_FIRMA`, AFEL = `FIRMADO`).
- `CreditApplication.firmas: IntentoFirma[]` y `chequeoTelefonico: { fecha } | null`.
- `ExtrasProducto.requiereChequeoTelefonico: boolean` (default `false`), en "Opciones generales" del
  ABM de productos. Clave de storage de productos `v3` → `v4`; de la demo `v19` → `v20`.
- Los créditos de `creditos.json` derivan su historial de firma del estado
  (`firmasDeSemilla`); el JSON no cambia.

## Decisiones tomadas sin bloquear

- La refirma vuelve siempre a FEL (como pide el texto), también en productos de firma física, con
  el mismo método de la instancia anterior.
- La firma "física" se considera cargada al aprobar (fecha de firma = fecha de aprobación).
- La firma del cliente en FEL se simula con un botón (demo sin backend).
- La bandeja de chequeos telefónicos se resolvió después (ver sección siguiente).
- `fechaAprobacion` sigue siendo la fecha en que el analista aprueba el crédito.

## Archivos

Nuevos: `src/lib/firma.ts`, `src/components/analisis/FirmaPanel.tsx`.
Modificados: `types.ts`, `productos.ts`, `mocks.ts`, `creditos-db.ts`, `application-context.tsx`
(`aprobarCredito(metodo?)`, `registrarFirmaCliente`, `verificarFirma`, `solicitarRefirma`,
`tomarChequeo`, `soltarChequeo`, `finalizarChequeo`), `AprobacionModal`, `ConfirmationModal` (children),
`SeccionesProducto`, `ListaAnalisis`, `StatusBadge`, `ModalesBandeja`, `app/(app)/page.tsx`,
`app/(app)/analisis/page.tsx`, `AnalisisCredito` (texto).

## Verificación

`npx tsc --noEmit` limpio; `eslint src` con los mismos 6 errores previos de `main`. Recorrido en
navegador: AFEL → refirma → FEL → segunda AFEL sin "Refirmar" → rechazo; AFEL sin chequeo →
liquidar; producto con chequeo: aprobar (Ambas) → FEL → AFEL → chequeo → liquidar; método manual
→ AFEL directo.


## Bandeja de chequeo telefónico (`/chequeo`)

Rol nuevo `SESION_CHEQUEADOR`, entrada "Bandeja de chequeo" en la sidebar y título en el Header.

- `ChequeoTelefonico { tomado, resultado: "OK" | "NO_OK" | null, comentario, fecha }` nace al
  verificarse la firma (`CHEQUEO_PENDIENTE`). El estado sigue siendo `CHEQUEO_TELEFONICO`;
  tomar/soltar sólo cambia `tomado`.
- Lista (`ListaChequeo`): Pendientes (sin tomar), En chequeo (tomados), Finalizados (con resultado).
- Detalle (`ChequeoCredito`): al tomar muestra teléfonos (cliente, referencias, garantes), datos del
  crédito, oferta, firma verificada, datos personales/laborales, legajo y comentarios; formulario de
  resultado + comentario obligatorio (≥5 caracteres) con confirmación.
- **OK** → `PARA_LIQUIDAR` en el mismo acto (`puedeLiquidar` exige `resultado === "OK"`). No pasa
  por el analista.
- **No correcto** (decisión del usuario) → `RECHAZADO`, `rechazo.origen = "CHEQUEADOR"`, código
  `CT-01`.
- Se elimina la pestaña provisional CHT y el botón provisional del analista; `FirmaPanel` sólo avisa
  que el crédito fue enviado a chequeo. La pestaña LIQ del analista sigue listando lo que está para
  liquidar (comportamiento previo, sólo lectura).
- Datos de ejemplo: CR-000213 y CR-000220 pasan de PARA_LIQUIDAR a CHEQUEO_TELEFONICO.
- Storage de la demo: `v21`.
- Verificado en navegador: tomar/soltar, validaciones, OK → liquidación automática, no correcto →
  rechazo, Finalizados, y el flujo completo analista → firma → chequeo con el flag del producto.

## Visibilidad del chequeo para analista y vendedor (sólo lectura)

Mientras el crédito está en `CHEQUEO_TELEFONICO` lo gestiona únicamente el chequeador; el analista y
el canal de venta lo **ven pero no lo operan**.

- Historial general: `historialCredito(app)` (`src/lib/historial.ts`) arma los eventos en orden
  (solicitud, análisis, aprobación, firmas/refirma/verificación, entrada a chequeo, resultado del
  chequeo, para liquidar / rechazo). Lo muestran `HistorialCredito` (analista y vendedor), el modal
  "Ver estado" del vendedor y el "log de estados" del análisis. `ChequeoTelefonico.fechaInicio` marca
  cuándo entró a chequeo; `textoChequeo` resume su estado (pendiente / en curso / finalizado).
- Analista: pestaña **CHT** en su bandeja (sólo lectura). Al abrir el crédito ve el estado del chequeo,
  el historial de firma y el historial general, sin ninguna acción. También ve en sólo lectura los
  créditos que salieron del chequeo (para liquidar, o rechazados por el chequeador).
- Vendedor: en su bandeja la fila muestra "En chequeo telefónico · … · sólo lectura"; "Ver datos" abre
  una pantalla de sólo lectura (antes caía en "enviada a análisis") con el estado y el historial. Lo
  mismo para EN_FIRMA y FIRMADO.
- Guardia: `setAppOperativo` en el contexto ignora las acciones de analista/vendedor (tomar, observar,
  anular, soltar, rechazar, aprobar, refirmar, verificar firma, cambios de oferta) si el crédito está en
  `CHEQUEO_TELEFONICO`. Sólo `tomarChequeo`, `soltarChequeo` y `finalizarChequeo` lo mueven.
