# Diseño — Bloque 1: flujo de originación según la documentación del 14/09

Fecha: 2026-09-14
Estado: implementado
Fuente de verdad: `docs/00_Arquitectura_Flujo_CreditoNet_v3_1409.md`,
`Modulo_Onboarding_CreditoNet_v4_1409`, `Modulo_Motor_Riesgo_CreditoNet_v2_1409`,
`Modulo_Plan_Cuotas_CreditoNet_v3_1409`, `Modulo_Producto_CreditoNet_v5_1409`,
`Modulo_Organismo_CreditoNet_v3_1409` y `00_Revision_Onboarding_PantallasDetalle_1409`.
Reemplaza en lo que contradiga a `2026-09-11-auditoria-flujo-bandejas-navegacion-design.md`
(en particular su §1.1 —orden de pasos— y su §11 —cancelaciones antes de la oferta—).

## 1. Alcance

La documentación del 14/09 se alinea con la demo en tres bloques. Este documento cubre sólo
el **bloque 1 (flujo de originación)**:

1. Orden de pasos: Canal → Tipo de persona → Identificación → Producto + Organismo → Datos
   mínimos → Evaluación → Oferta.
2. Canal como primer elemento del flujo, con efecto visible.
3. Reglas universales / institucionales separadas del motor y evaluables en distintos
   momentos.
4. Reglas del motor configuradas como bloqueantes o no bloqueantes; resultado PASA / NO PASA.
5. Precancelación después de la primera oferta.

Fuera de alcance: bloque 2 (detalle de las 7 pantallas post-oferta, orígenes de campo) y
bloque 3 (parametrización completa por Producto/Organismo y módulo Parámetros).

Restricciones que se mantienen: demo visual, sin backend ni APIs, persistencia en
`sessionStorage`, navegación persistente con `pasoMaximo` (volver atrás no borra).

## 2. Decisiones tomadas con el usuario

| Tema | Decisión |
|---|---|
| Stepper | 6 pasos, 1:1 con el orden de la documentación. |
| Reglas institucionales | Se evalúan en dos momentos: RI-01 al identificar, RI-02 en Evaluación. |
| Canal | Sucursal / Canal digital. El canal filtra los productos disponibles. |
| Reglas no bloqueantes | El escenario de demo pasa a tres opciones: PASA / PASA con reglas marcadas / NO PASA. |

## 3. Flujo de pasos

| # | Paso | Contenido | Gate para continuar |
|---|---|---|---|
| 1 | Inicio | Canal (seleccionable), vendedor desde la sesión (sólo lectura), tipo de persona. | Persona jurídica sigue no navegable. |
| 2 | Identificación | Lo actual (DNI/CUIL, datos de API, situaciones, verificación presencial) + tarjeta **Reglas institucionales**. | Cliente consultado y verificado **y** ninguna regla institucional bloqueante en NO_PASA. |
| 3 | Producto y organismo | `PasoConfiguracion` sin canal ni vendedor. Productos no habilitados por el canal se muestran deshabilitados con el motivo. | — |
| 4 | Datos mínimos | Sin cambios. | Igual que hoy. |
| 5 | Evaluación | Solicitar → 1 Reglas institucionales → 2 Motor → 3 Límites → 4 Plan de cuotas. | Riesgo completo y sin rechazo. |
| 6 | Oferta | Primera oferta → Precancelación opcional → Nueva oferta → Aceptar. | Igual que hoy. |

`STEPS_ORIGINACION` pasa a 6 entradas: `inicio`, `identificacion`, `producto-organismo`,
`datos-minimos`, `evaluacion`, `oferta`. `OriginacionWizard` mapea los componentes por número
y actualiza los gates. `PasoContexto.tsx` se renombra a `PasoInicio.tsx` y pasa a contener
canal + vendedor + tipo de persona (deja de incluir `PasoConfiguracion`);
`PasoConfiguracion` se renderiza solo en el paso 3.

### 3.1 Descarte temprano en Identificación

Si RI-01 no pasa con los datos traídos de la API, la pantalla muestra el descarte con el
código y el motivo. **No se genera ID de Crédito ni cambia el estado**: la solicitud todavía
no existe (el ID nace en Solicitar). El gate bloquea Continuar. Si el vendedor rectifica la
fecha de nacimiento o el género, la regla se reevalúa en vivo.

Como la navegación es libre hasta `pasoMaximo`, un dato puede cambiarse después de haber
llegado a Evaluación. Por eso Solicitar / Volver a ejecutar reevalúa todas las
institucionales y, si alguna bloqueante no pasa, rechaza con origen `INSTITUCIONAL` sin
ejecutar el motor.

### 3.2 Canal

- `CANALES`: `sucursal` (“Sucursal”, default) y `digital` (“Canal digital”).
- `ProductoConfig.canales: string[]`. Préstamo personal: ambos. Crédito judicial: sólo
  `sucursal`.
- Helper `productosDelCanal(canalId)` en `config.ts`.
- Al cambiar de canal, si el producto elegido deja de estar habilitado se selecciona el
  primero disponible.
- `VENDEDORES` / `SESION` no cambian: el vendedor sigue siendo el usuario autenticado.

## 4. Reglas institucionales y motor

### 4.1 Tipos (`types.ts`)

```ts
export type ResultadoRegla = "PASA" | "NO_PASA";
export type RiskResultado = "PASA" | "NO_PASA";
export type EscenarioMotor = "PASA" | "PASA_CON_MARCADAS" | "NO_PASA";

export interface RiskRule {
  id: string;
  codigo: string;
  nombre: string;
  detalle: string;
  fuente: string;
  valorEvaluado: string;
  condicion: string;
  bloqueante: boolean;
  resultado: ResultadoRegla;
}

export type MomentoRegla = "IDENTIFICACION" | "EVALUACION";

export interface ReglaInstitucional extends Omit<RiskRule, "resultado"> {
  momento: MomentoRegla;
  resultado: ResultadoRegla | "ESPERANDO_DATOS";
}
```

Se eliminan `RuleOutcome` (`CUMPLE | ADVERTENCIA | NO_CUMPLE`) y los valores
`OFERTAR | RECHAZAR`. Una regla está **marcada para el analista** cuando
`!bloqueante && resultado === "NO_PASA"`; es derivado, no se persiste. Helper
`reglaMarcada(r)` en `motores.ts`.

`CreditApplication.riesgo` cambia:

- `escenario: EscenarioMotor`
- `resultado: RiskResultado | null`
- nuevo `institucionales: ReglaInstitucional[]` (snapshot tomado en Solicitar)
- `evaluadoCon` suma `genero` para detectar cambios que afectan a RI-01.

`Rechazo.origen` suma `"INSTITUCIONAL"`.

### 4.2 Reglas institucionales (`src/lib/reglas-institucionales.ts`, nuevo)

| Código | Regla | Variables | Momento | Bloqueante |
|---|---|---|---|---|
| RI-01 | No otorgar a personas de género femenino mayores de 65 años | género, fecha de nacimiento | Identificación | Sí |
| RI-02 | Nivel de endeudamiento hasta 50 % | cuotas vigentes de créditos propios, ingreso neto | Evaluación | Sí |

`evaluarInstitucionales(app, momento)` es pura:

- Evalúa las reglas cuyo `momento` es anterior o igual al pedido.
- Una regla de un momento posterior se devuelve `ESPERANDO_DATOS`, aunque alguna variable ya
  esté precargada: RI-02 depende del ingreso neto **confirmado** en Datos mínimos, y un cliente
  existente lo trae precargado desde la base interna antes de confirmarlo.
- Si falta alguna variable de una regla de su momento, también la devuelve `ESPERANDO_DATOS`.
- RI-02 usa **todas** las cuotas vigentes (sin cancelaciones): la primera oferta es previa a
  la precancelación.

`institucionalesBloquean(reglas)` → `true` si alguna bloqueante está en `NO_PASA`.

Con el cliente de la demo (femenino, 1982; cuotas $245.600 sobre neto $1.000.000 = 24,6 %)
ambas pasan. Para mostrar el descarte temprano: fecha de nacimiento `14/05/1955`.

### 4.3 Motor (`motores.ts`)

- Sale MR-06 “Nivel de endeudamiento” (pasa a RI-02). Las reglas quedan renumeradas:
  MR-01 Edad, MR-02 Antigüedad, MR-03 Ingreso mínimo, MR-04 Situación BCRA, MR-05 Mora
  interna, MR-06 Trámite activo en otro canal, MR-07 Blacklist.
- Todas bloqueantes salvo **MR-07 Blacklist, no bloqueante** (Motor §7 usa blacklist como
  ejemplo de condición configurable en cualquiera de los dos modos).
- `MotorRiesgo.endeudamientoMaxPct` se elimina (lo cubre RI-02).
- `resolverResultado(reglas)` → `NO_PASA` si alguna bloqueante no pasa; si no, `PASA`.
- Escenarios:
  - `NO_PASA`: MR-04 BCRA no pasa (como hoy).
  - `PASA_CON_MARCADAS`: MR-07 Blacklist no pasa → PASA con 1 regla marcada.
  - `PASA`: todo pasa.
  - Edad, antigüedad e ingreso siempre se evalúan con los datos reales.
- `RESULTADOS_MOTOR` pasa a PASA / NO PASA. `NOTA_RESULTADOS` se elimina.
- Nuevo `ESCENARIOS_MOTOR` con las tres opciones para `EscenarioMotor.tsx`.

### 4.4 Secuencia de Evaluación (`PasoEvaluacion`)

```text
Solicitar (genera ID, EN_TRAMITE)
  ↓
1 Reglas institucionales (momento EVALUACION)
  ├─ alguna bloqueante NO_PASA → RECHAZADO, origen INSTITUCIONAL (no corre el motor)
  ↓
2 Motor → NO_PASA → RECHAZADO, origen MOTOR
  ↓ PASA (con o sin reglas marcadas)
  Selección de línea → sin línea → RECHAZADO, origen SIN_LINEA
  ↓
3 Límites (sin cancelaciones)
  ↓
4 Plan de cuotas → primera oferta
```

`FASES_RIESGO` suma “Evaluando reglas institucionales…”. `ResultadoEvaluacion` (contexto)
suma `institucionales`. `finalizarRiesgo` resuelve el origen del rechazo en ese orden.

### 4.5 Presentación

- `RiskRule.tsx`: chip “Bloqueante” / “No bloqueante”; resultado “Pasa” / “No pasa”; si está
  marcada, tono warning y “No pasa · marcada para el analista”. Acepta `ReglaInstitucional`
  y muestra “Esperando datos” en tono neutral.
- `InstitucionalesPanel.tsx` (nuevo, en `onboarding/evaluacion/`): lista de reglas
  institucionales con su momento. Se usa en Identificación y como bloque 1 de Evaluación.
- `MotorPanel`: badge PASA / NO PASA y, si hay, “N reglas marcadas para el analista”.
- `EscenarioMotor`: tres opciones y texto actualizado.
- Al vendedor, con NO_PASA se le muestran sólo las bloqueantes que no pasaron (reunión 11/09,
  02:01); con PASA, todas.
- Rechazo institucional en Evaluación: tarjeta equivalente a la del motor, con códigos RI-xx y
  la leyenda de que el motor no llegó a ejecutarse.

## 5. Precancelación después de la primera oferta

### 5.1 Cálculo

- `calcularLimites(app, { conCancelaciones: boolean })`.
  - `false`: ignora `precancelar` y da los límites de la **primera oferta**. Se usa en
    Evaluación; alimenta `riesgo.limites` y `oferta.capitalMaximoBase`.
  - `true`: excluye las cuotas de los créditos marcados. Se usa en la oferta; alimenta sólo
    `oferta.capitalMaximoRenovacion`.
- `aplicarLimites` (contexto) deja de sobrescribir `riesgo.limites`: la primera oferta queda
  como referencia estable.
- Se conserva la corrección del 14/09: si la precancelación mueve el capital máximo, la oferta
  se rearma sobre el nuevo capital (`montoSolicitado` = nuevo máximo) y se recalculan todas las
  cuotas; si no lo mueve (ej. deuda con terceros), se respeta el importe elegido. `PasoOferta`
  sincroniza su borrador de importe cuando el monto cambia desde afuera.
- `recalcularOferta` ya elige `capitalMaximoActual` entre base y renovación según haya
  precancelación: no cambia.
- Volver a Evaluación y reejecutar con créditos ya marcados conserva la selección y recalcula
  la primera oferta sin cancelaciones.
- `CAPITAL_MAXIMO_CON_PRECANCELACION` y `CAPITAL_MAXIMO_BASE` sólo se usan para el estado
  inicial en `mocks.ts`; se mantienen.

### 5.2 Pantallas

- Se elimina `evaluacion/CancelacionesPanel.tsx` y su bloque en `PasoEvaluacion`. El
  `DiagramaEtapas` queda: Reglas institucionales → Motor → Límites → Plan.
- `PasoOferta`:
  1. **Primera oferta**: `OfertaCabecera` (título “Primera oferta”, o “Nueva oferta” si hay
     precancelación; el chip “Motor aprobado” pasa a “Motor: pasa”), `MontoSolicitado`,
     `TablaCuotas`.
  2. **¿Desea precancelar créditos?** (opcional): encabezado de sección + `CreditosActivos` +
     `DeudaTerceros`.
  3. **Nueva oferta**: la comparación (capital máximo de la primera oferta vs. el nuevo, y
     cuota liberada) se integró en el bloque de confirmación que ya tenía `CreditosActivos`,
     visible sólo con precancelación activa, para no duplicarla en otro componente.
  4. `SeleccionFinal` + Aceptar oferta.
- `CreditosActivos`: el mensaje de espera pasa de “Reevaluando en el motor de riesgo…” a
  “Recalculando la oferta sin {id} en la exposición…”. Se mantiene la obligación de volver a
  elegir el plazo.
- `DemoTag` junto a Aceptar: “El orden exacto entre confirmación de la oferta, precancelación
  y las 7 pantallas post-oferta está pendiente de confirmación funcional (Arquitectura §16).”

## 6. Analista y bandejas

- `AnalisisCredito`: nueva `SummaryCard` “Reglas institucionales”; en la del motor cada fila
  indica bloqueante/no bloqueante y las marcadas aparecen “! Marcada · revisar” en warning.
  El resultado muestra “Pasa”.
- `BandejaAnalista`: “N reglas marcadas para revisión” en lugar de advertencias.
- `app/(app)/page.tsx:123`: el texto del rechazo distingue `INSTITUCIONAL` además de
  `MOTOR` y `SIN_LINEA`.
- `OriginacionWizard` (resumen lateral): agrega Canal; resultado del motor Pasa / No pasa;
  si hay marcadas, “N marcadas”.
- `RESULTADO_LABEL` = { PASA: “Pasa”, NO_PASA: “No pasa” }. `OUTCOME_LABEL` se reemplaza por
  etiquetas de `ResultadoRegla` + `ESPERANDO_DATOS`.

## 7. Persistencia

`STORAGE_KEY` pasa a `creditonet.demo.v9`: cambian la forma de las reglas, del escenario y el
significado del número de paso. `crearAplicacionInicial` usa `canalId: "sucursal"`,
`escenario: "PASA"` e `institucionales: []`.

## 8. Archivos afectados

Nuevos: `src/lib/reglas-institucionales.ts`,
`src/components/onboarding/evaluacion/InstitucionalesPanel.tsx`,
`src/components/onboarding/originacion/PasoInicio.tsx` (reemplaza a `PasoContexto.tsx`).

Eliminados: `src/components/onboarding/evaluacion/CancelacionesPanel.tsx`,
`src/components/onboarding/originacion/PasoContexto.tsx`.

Modificados: `types.ts`, `config.ts`, `motores.ts`, `credit.ts`, `mocks.ts`,
`application-context.tsx`, `OriginacionWizard.tsx`, `PasoConfiguracion.tsx`,
`SelectField.tsx` (opciones deshabilitadas), `LimitesPanel.tsx`,
`PasoIdentificacion.tsx`, `PasoEvaluacion.tsx`, `PasoOferta.tsx`, `MotorPanel.tsx`,
`EscenarioMotor.tsx`, `RiskRule.tsx`, `OfertaCabecera.tsx`, `CreditosActivos.tsx`,
`AnalisisCredito.tsx`, `BandejaAnalista.tsx`, `app/(app)/page.tsx`.

## 9. Verificación

El proyecto no tiene test runner. Criterio de terminado:

1. `npm run build` y `npm run lint` sin errores ni warnings.
2. Recorrido en navegador contra `next dev`:
   - Flujo completo con escenario PASA hasta aceptar la oferta.
   - Escenario PASA_CON_MARCADAS: la solicitud continúa, MR-07 aparece marcada en la
     evaluación, en la bandeja del analista y en el análisis.
   - Escenario NO_PASA: rechazo del motor con MR-04.
   - RI-01: fecha de nacimiento `14/05/1955` en Identificación → descarte, Continuar bloqueado;
     volver a `1982` lo habilita.
   - RI-02: ingreso neto bajo (ej. $400.000) → rechazo institucional en Evaluación sin motor.
   - Canal digital: Crédito judicial deshabilitado; con judicial elegido, cambiar a digital
     selecciona Préstamo personal.
   - En la oferta, marcar CR-000102 sube el capital máximo y muestra la comparación; volver a
     Evaluación mantiene los límites de la primera oferta y los ✓ de los pasos siguientes.

## 10. Pendientes que no se inventan

- Orden exacto entre primera oferta, confirmación, precancelación, 7 pantallas y
  preaprobación (Arquitectura §16): la demo usa precancelación → confirmación → 7 pantallas →
  preaprobación y lo marca como pendiente.
- Qué cambios requieren reejecutar reglas de riesgo y cuáles sólo recalcular el Plan (Plan
  §10): se mantiene el banner de datos cambiados con reejecución manual.
