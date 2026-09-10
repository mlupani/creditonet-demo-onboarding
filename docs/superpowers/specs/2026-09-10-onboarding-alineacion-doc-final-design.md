# Diseño — Alineación de la demo con la Guía Definitiva del Módulo Onboarding

Fecha: 2026-09-10
Estado: aprobado
Fuente de verdad: *Creditonet — Guía Definitiva de Arquitectura y Operación del Módulo de
Onboarding* v2.1 (FINAL EXTENDIDA). Reemplaza en lo que contradiga a
`2026-09-06-onboarding-dos-etapas-design.md`.

## 1. Objetivo y restricciones

Ajustar la demo existente para que se parezca al módulo completo descrito en el documento
final. **No se agrega funcionalidad nueva**: los cambios son de flujo, nomenclatura, estados y
estética. Sigue siendo una demo mock (sin backend, persistencia en `sessionStorage`).

Decisiones del usuario:

- Pre-oferta en **4 pasos** como el documento.
- De los agregados que rozaban funcionalidad nueva, **sólo** se incluye "Observado vuelve al
  vendedor". Quedan **fuera**: protocolo de firma presencial (§9), registro de auditoría
  (§10.1) y validación/bloqueo de RCI por plazo.

## 2. Pre-oferta (doc §3–§4): de 8 a 4 pasos

| # | Paso | Contenido |
|---|---|---|
| 1 | Identificación | DNI **o CUIL** → la API autocompleta Nombre, Apellido, Domicilio, Fecha de nacimiento y Género (editables, badge de origen). Cliente existente → **ID de Cliente** + foto archivada para **verificación presencial** (absorbe el ex paso "Verificación"). |
| 2 | Producto y datos mínimos | Selección comercial: Producto, Organismo (hereda del producto, sin excepciones en la demo) y el **Plan de cuotas / Línea** resultante (sólo lectura). Canal y vendedor bloqueados. Datos laborales y financieros mínimos: fecha de inicio laboral, banco de cobro, ingreso bruto, ingreso neto, monto extraído/transferido el día de cobro. Aviso de persistencia obligatoria para auditoría. |
| 3 | Solicitar | Botón **"Solicitar"**: genera el **ID de Crédito** y el estado **En trámite**. Evaluación en dos capas: **Motor de riesgo ("El Patovica")** pasa / no pasa con reglas codificadas (Edad, Vector BCRA, Mora interna, Carencia) → si aprueba, **Plan de cuotas / Línea** (RCI 40 %, endeudamiento máximo, SMVM de bolsillo → capital máximo otorgable). Si el motor rechaza → estado **Rechazado** con códigos de regla y período de carencia de 30 días; no se puede continuar. |
| 4 | Oferta | Ver §3. |

Se eliminan los pasos "Tipo de persona" y "Datos adicionales" (el doc no los contempla; los
datos personales se cargan en post-oferta). Salen de la pre-oferta CBU, email, CUIT del
empleador, disponible y débitos no remunerativos. El "ingreso mínimo" deja de ser regla del
motor: el doc ubica RCI / endeudamiento / SMVM en el Plan de cuotas.

Para ver un rechazo del motor en la demo: editar la fecha de nacimiento (edad fuera de 18–75).

## 3. Oferta (doc §5)

- Cabecera: nombre, **ID de Cliente**, **ID de Crédito**, estado.
- Monto: el input edita un borrador y el botón **"Recalcular"** lo aplica contra la grilla del
  plan, sin volver al motor. No se puede continuar con un borrador sin recalcular.
- Plazos 12 / 18 / 24 / **36**.
- **Renovación / precancelación de créditos propios**: elegibilidad (cuotas abonadas ≥ 50 %),
  desglose Capital residual / Intereses a vencer / IVA / Cargos de cancelación / Punitorios.
  Marcar o desmarcar muestra "Reevaluando en el motor de riesgo…" (disparador dinámico §4.2)
  y luego el nuevo capital máximo.
- **Deudas con terceros**: Entidad acreedora, Monto a cancelar, CBU de destino.
- **Acreditación neta** con la fórmula en cascada; si las cancelaciones superan el capital, los
  montos se resaltan en rojo y "Continuar" queda bloqueado.

## 4. Post-oferta (doc §6)

- Indicador numérico 1–7 con la semántica del doc: **Verde** completa y validada · **Azul**
  iniciada con obligatorios pendientes · **Gris** no iniciada. La pantalla actual se marca
  aparte (anillo). "Iniciada" = visitada o con datos cargados. Leyenda visible.
- **Finalizar carga** deshabilitado hasta que el 100 % de las pantallas obligatorias estén en
  verde (reemplaza el modal de pendientes). La lista de pendientes navegable queda en el panel
  lateral.
- Legajo virtual: DNI frente, DNI dorso, Recibo de sueldo, Comprobante de servicio (pendiente
  inicial). Tokenización: sólo débito / crédito. Datos personales: "Domicilio real".
- Pendientes iniciales (sin cambios de criterio): teléfono celular, email de referencia,
  comprobante de servicio.

## 5. Estados y bandejas (doc §7, §8, §11)

Estados: `BORRADOR` (antes de Solicitar) → `EN_TRAMITE` → `EN_ANALISIS` (`ANALISIS_TOMADO`
se muestra como "En análisis") → `OBSERVADO` | `RECHAZADO` | `PARA_LIQUIDAR`. `Expirado` y
`Activo` no se simulan (sólo se muestran el vencimiento y el próximo paso).

- **Inicio = Bandeja del canal de venta**: las 3 vías (Solicitar crédito · Precancelación /
  Renovación · Gestión de mora, las dos últimas "Próximamente") + lista de solicitudes con
  búsqueda por DNI/CUIL, estado, vigencia de condiciones (30 días desde Solicitar; 15 días para
  corregir si está Observado) y acción (Retomar / Corregir y reenviar / Ver estado).
- **Observar** (analista): motivo + nota obligatoria → `OBSERVADO` → vuelve a la bandeja del
  vendedor → "Corregir y reenviar" abre la post-oferta con la observación visible → botón
  **"Reenviar correcciones"** → `EN_ANALISIS`.
- **Rechazar** (analista): motivo codificado + observación obligatorios. Se distingue el
  origen del rechazo (motor vs analista).
- **Aprobar** → `PARA_LIQUIDAR`. Pantalla final: aprobado, enviado a la Bandeja de Liquidación
  (Tesorería) con preview estático de las operaciones (transferencia neta, orden de pago a
  terceros, cancelación de créditos propios). Timeline hasta "Activo".
- Header muestra el rol según la bandeja (Vendedor / Analista de riesgo). Sidebar: "Caja y
  Bancos" → "Liquidación".

## 6. Modelo y configuración

- `lib/config.ts`: se agrega `PLANES_CUOTAS` (Línea Salud 2026: francés, plazos, monto máximo,
  RCI 40 %, endeudamiento 50 %, SMVM de bolsillo, mínimo de cuotas para renovar 50 %) y
  resolución Producto → Organismo (overrides nulos = hereda) → Plan. Se elimina
  `camposAdicionalesObligatorios`.
- `lib/types.ts`: `EstadoCredito` nuevo; `ClienteDatos` reducido (con `genero`, `domicilio`);
  `LaboralIngresos` reducido a los 5 datos mínimos; `RiskRule.codigo`; `RiskResultado` =
  `APROBADO | VERIFICACION_MANUAL | RECHAZADO`; `DeudaTerceros` con entidad y CBU;
  `CreditoActivo` con cuotas abonadas, cuota vigente y desglose ampliado; `rechazo` y
  `observacion` estructurados; `fechaSolicitud`. Sin `tipoPersona`.
- `STORAGE_KEY` → `creditonet.demo.v3` (la sesión anterior se descarta).

## 7. Verificación

- `npm run lint` y `npm run build` sin errores.
- Recorrido del happy path: `/` → Solicitar crédito → DNI → verificar identidad → producto y
  datos mínimos → Solicitar (motor aprobado + plan) → oferta: recalcular monto, renovar
  CR-000102 (2,5 M → 2,85 M), deuda con terceros → confirmar → transición → completar 3
  pendientes → Finalizar carga → `/analisis` → tomar → Observar → vendedor corrige y reenvía →
  tomar → Aprobar → Para liquidar.
- Caminos de bloqueo: borrador sin recalcular, importe > capital máximo, cancelaciones >
  capital, Finalizar carga con pendientes, rechazo del motor por edad.
