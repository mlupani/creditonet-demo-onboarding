# Diseño — Demo CreditoNet: Onboarding en dos etapas

Fecha: 2026-09-06
Estado: aprobado para plan de implementación

## 1. Contexto y objetivo

Existe una primera iteración de la demo del Módulo Onboarding de CreditoNet
(Next.js 16 App Router, React 19, Tailwind v4). Hoy el flujo es un wizard lineal
de 7 pasos (`Identificación → Producto → Datos → Riesgo → Oferta → Documentación
→ Confirmación`) con `/analisis` para la aprobación.

El objetivo NO es reescribir desde cero. Se toma la implementación actual como
base y se la reestructura para que represente correctamente el **modelo de
negocio** descrito en la documentación funcional real (documentos: *Pantalla
inicial v0.4*, *Pantalla de oferta crediticia v0.3*, *Pantallas post oferta v3*).
La fuente de verdad para este diseño es el prompt de corrección provisto por el
usuario (los documentos no están adjuntos; si más adelante contradicen algo, se
ajusta).

Sigue siendo una demo **MOCK**: sin APIs reales ni backend. Pero el flujo, los
campos, los estados y la lógica visual deben ser fieles.

La demo es una herramienta para **discutir el producto con el jefe** y detectar
cambios funcionales. Por eso, toda decisión todavía pendiente se hace **visible
como "Configuración DEMO" / "Regla simulada"**, no se esconde ni se presenta como
definitiva.

## 2. Cambio de concepto

El flujo deja de ser una única secuencia lineal. Pasa a representar dos grandes
etapas más una fase de análisis:

- **ETAPA 1 — Originación / solicitud inicial** (8 pasos, navegación lineal
  *gated*: no se avanza sin completar el paso actual).
- **Transición** — pantalla intermedia "Oferta aceptada → Carga post-oferta".
- **ETAPA 2 — Post-oferta** (7 pantallas, **navegación libre**, dirigidas por
  configuración de producto, con "Finalizar carga" siempre visible).
- **Análisis** — ruta `/analisis`: bandeja → tomar análisis → análisis →
  aprobación → Caja y Bancos (pendiente).

La cantidad, orden y obligatoriedad de las pantallas POST OFERTA son
**configurables por producto**. En la demo se usa una configuración fija, pero la
arquitectura (objeto de config real que maneja el stepper y los gates) transmite
que son parametrizables.

## 3. Arquitectura

### 3.1 Rutas

| Ruta | Contenido |
|---|---|
| `/` | Home del Módulo Onboarding: 3 tarjetas de acción + tarjeta "solicitud en curso" + reiniciar demo. Reemplaza el dashboard actual (se quitan las métricas). |
| `/onboarding` | `<SolicitudFlow/>`: originación + transición + post-oferta. |
| `/analisis` | Bandeja del analista + análisis del crédito + aprobación. |

Sidebar: se mantiene la estructura actual (Inicio, Onboarding, y módulos futuros
deshabilitados: Solicitudes, Clientes, Créditos, Riesgo, Caja y Bancos, Reportes,
Parámetros). Se agrega **"Bandeja de análisis"** como ítem disponible.

### 3.2 Árbol de componentes

```
app/(app)/
  page.tsx                          Home: 3 acciones del módulo
  onboarding/page.tsx               render <SolicitudFlow/>
  analisis/page.tsx                 bandeja + análisis + aprobación

components/onboarding/
  SolicitudFlow.tsx                 orquestador: etapa ORIGINACION | TRANSICION | POST_OFERTA
  TransicionEtapa.tsx               "OFERTA ACEPTADA ✓ → Carga post-oferta"

  originacion/
    OriginacionWizard.tsx           stepper gated (8 pasos) + resumen lateral en vivo + gate de avance
    PasoTipoPersona.tsx
    PasoIdentificacion.tsx
    PasoConfiguracion.tsx
    PasoLaboralIngresos.tsx
    PasoDatosAdicionales.tsx
    PasoVerificacionIdentidad.tsx
    PasoRiesgo.tsx
    PasoOferta.tsx                  compone las subvistas de oferta

  oferta/
    OfertaCabecera.tsx              cliente / DNI / Cliente # / Crédito #
    TablaCuotas.tsx                 12 / 18 / 24, una recomendada
    MontoSolicitado.tsx             input monetario + validación de tope
    CreditosActivos.tsx             CR-000102 + desglose + checkbox precancelar + recálculo animado
    DeudaTerceros.tsx               visible sólo si producto lo permite
    ComposicionCredito.tsx          card destacada: neto a acreditar
    SeleccionFinal.tsx              importe + cuotas + valor cuota + primera cuota
    ConfirmarOfertaModal.tsx        modal "Confirmá la oferta"

  postoferta/
    PostOfertaShell.tsx             stepper libre + "Finalizar carga" + panel "Configuración del producto" + panel de pendientes
    PantallaLaboral.tsx
    PantallaPersonales.tsx
    PantallaTokenizacion.tsx
    PantallaReferencias.tsx
    PantallaGarantias.tsx
    PantallaLegajo.tsx
    PantallaImpresion.tsx

components/analisis/
  BandejaAnalista.tsx
  AnalisisCredito.tsx               5 cards: Cliente / Riesgo / Oferta / Pagos-Historial / Documentación
  AprobacionModal.tsx

components/ui/                      se reutiliza todo lo existente, se agrega:
  StepperLibre.tsx                  stepper navegable con estados ✓ / ● / ○
  ComposicionCard.tsx              (si conviene extraer de ComposicionCredito)
  DemoTag.tsx                       pill "Configuración DEMO" / "Regla simulada" + tooltip
```

### 3.3 Estado — `lib/application-context.tsx`

`AppProvider` sigue siendo un contexto React con persistencia en `sessionStorage`
(nueva key `creditonet.demo.app.v2`; "Reiniciar demo" limpia todo). Hidratación
diferida como hoy.

Modelo `CreditApplication` reorganizado por bloques:

```ts
type Etapa = "ORIGINACION" | "TRANSICION" | "POST_OFERTA" | "ENVIADA";

type EstadoCredito =
  | "BORRADOR"
  | "EN_ANALISIS"          // enviada, sin tomar
  | "ANALISIS_TOMADO"      // analista tomó el caso
  | "OBSERVADA"
  | "APROBADO"
  | "RECHAZADO";

type TipoCliente = "NUEVO" | "EXISTENTE";

interface DatoAutocompletado<T> {
  valor: T;
  origen: "API pública" | "Base interna" | "Manual";
  autocompletado: boolean;   // true = vino de fuente, badge "Autocompletado"
}

interface CreditApplication {
  // identidad de la solicitud
  numeroCredito: string | null;     // "CR-000184", se asigna al generar oferta el motor
  numeroCliente: string | null;     // "000928", se asigna al identificar (cliente existente)
  estado: EstadoCredito;
  etapa: Etapa;

  // --- ETAPA 1 ---
  tipoPersona: "FISICA" | "JURIDICA" | null;

  identificacion: {
    documento: string;              // DNI (o CUIT si jurídica)
    consultado: boolean;
    tipoCliente: TipoCliente | null;
  };

  cliente: Customer | null;         // datos con metadata de origen (ver 3.4)
  identidadVerificada: boolean;

  configuracion: {
    productoId: string;             // "prestamo-personal"
    organismoId: string;            // "empleados-salud"
    canalId: string;                // "venta-directa"
    vendedorId: string;             // "juan-perez"
  };

  laboralIngresos: {
    // obligatorios
    bancoSueldo: string;            // "Banco Galicia"
    ingresoNeto: number;            // 1_000_000
    ingresoBruto: number;           // 1_250_000
    fechaInicioLaboral: string;     // "12/03/2019"
    // información adicional (configurable por producto)
    email: string;                  // completo
    cuitEmpleador: string;          // completo
    extraccionesFecha: string;      // vacío -> "No informado"
    extraccionesImporte: number;
    transferenciasFecha: string;
    transferenciasImporte: number;
    disponible: number;
    debitosNoRemunerativos: number;
  };

  datosAdicionales: {
    estadoCivil: string;
    domicilio: string;
    telefonoCelular: string;
    // ... según lo que no haya venido de la API
  };

  riesgo: {
    estado: "PENDIENTE" | "EVALUANDO" | "COMPLETO";
    faseActual: number;             // índice del mensaje de loading
    reglas: RiskRule[];             // 7 reglas (ver 4.7)
    resultado: "GENERAR_OFERTA" | "RECHAZAR" | "PASAR_A_ANALISTA" | null;
    evaluadoConIngresoNeto: number | null;
    fecha: string | null;
  };

  oferta: {
    capitalMaximoBase: number;      // 2_500_000
    capitalMaximoActual: number;    // 2_500_000 -> 2_850_000 tras precancelación
    montoSolicitado: number;        // inicial 2_500_000, editable
    plazoCuotas: 12 | 18 | 24;      // inicial 12 (recomendada)
    tna: number;
    valorCuota: number;             // calculado
    totalAPagar: number;            // calculado
    primeraCuotaVencimiento: string; // según plazo, "Regla simulada"
    creditosActivos: CreditoActivo[];
    deudaTerceros: { habilitado: boolean; importe: number };  // habilitado según producto
    aceptada: boolean;
  };

  // --- ETAPA 2 ---
  postOferta: {
    laboral: PantallaLaboralData;
    personales: PantallaPersonalesData;
    tokenizacion: { tipoTarjeta: "DEBITO" | "PREPAGA" | "CREDITO"; numero: string;
                    vencimiento: string; marca: string; cvv: string;
                    tokenizada: boolean; token: string | null };
    referencias: Referencia[];      // 1..2
    garantias: { garante: Garante; documentos: DocItem[] };
    legajo: DocItem[];              // DNI frente/dorso, recibo, certificación domicilio
    impresion: { generado: boolean };
  };
  pantallasVisitadas: Record<PantallaPostOfertaId, boolean>;

  // --- ANÁLISIS ---
  analista: {
    tomado: boolean;
    observacion: string | null;
    motivoRechazo: string | null;
  };

  // fechas / trazabilidad
  fechaEnvioAnalisis: string | null;
  fechaAprobacion: string | null;
}

interface CreditoActivo {
  id: string;                       // "CR-000102"
  capitalOriginal: number;          // 1_500_000
  capitalResidual: number;          // 850_000
  montoCancelacion: number;         // 1_000_000
  desglose: { capital: number; intereses: number; iva: number; cargos: number };
  cuotasOriginales: number;         // 24
  cuotaActual: number;              // 14
  precancelar: boolean;
}
```

Acciones del contexto: `patchApp`, `patchCliente`, `patchLaboral`,
`patchDatosAdicionales`, `patchOferta` (recalcula), `patchPostOferta(seccion,
patch)`, `setEtapa`, `setPaso` (originación), `irAPantalla(id)` (post-oferta),
`reiniciarDemo`.

### 3.4 Metadata de origen de datos del cliente

Para poder mostrar badges "Autocompletado" y la fuente por campo, `Customer`
guarda, además del valor, si el dato vino de fuente pública y si fue editado
manualmente. Implementación simple: un `Customer` plano + un objeto paralelo
`origenCampos: Record<keyof Customer, "API pública" | "Manual" | "Base interna">`.
Al editar un campo autocompletado, su origen pasa a "Manual".

### 3.5 Configuración de producto — `lib/config.ts`

```ts
type PantallaPostOfertaId =
  | "laboral" | "personales" | "tokenizacion"
  | "referencias" | "garantias" | "legajo" | "impresion";

interface PantallaPostOfertaConfig {
  id: PantallaPostOfertaId;
  label: string;
  orden: number;
  obligatoria: boolean;
  visible: boolean;
}

interface ProductoConfig {
  id: string;
  nombre: string;                       // "Préstamo personal"
  permiteDeudaTerceros: boolean;        // true en la demo
  requiereGaranteDefault: boolean;
  camposAdicionalesObligatorios: Array<keyof LaboralIngresos>; // ["email", "cuitEmpleador"]
  pantallasPostOferta: PantallaPostOfertaConfig[];
}

export const PRODUCTOS_CONFIG: Record<string, ProductoConfig> = {
  "prestamo-personal": {
    id: "prestamo-personal",
    nombre: "Préstamo personal",
    permiteDeudaTerceros: true,
    requiereGaranteDefault: true,
    camposAdicionalesObligatorios: ["email", "cuitEmpleador"],
    pantallasPostOferta: [
      { id: "laboral",      label: "Datos laborales",     orden: 1, obligatoria: true,  visible: true },
      { id: "personales",   label: "Datos personales",    orden: 2, obligatoria: true,  visible: true },
      { id: "tokenizacion", label: "Tokenización",        orden: 3, obligatoria: false, visible: true },
      { id: "referencias",  label: "Referencias",         orden: 4, obligatoria: true,  visible: true },
      { id: "garantias",    label: "Garantías",           orden: 5, obligatoria: true,  visible: true },
      { id: "legajo",       label: "Legajo virtual",      orden: 6, obligatoria: true,  visible: true },
      { id: "impresion",    label: "Impresión de legajo", orden: 7, obligatoria: false, visible: true },
    ],
  },
};
```

Derivados de este objeto:
- El **stepper libre** de la etapa 2 (orden + qué pantallas se muestran).
- El **gate de "Finalizar carga"** (sólo bloquean las `obligatoria: true`).
- El panel **"Configuración del producto"**: `Producto: Préstamo personal ·
  Pantallas configuradas: 7 · Obligatorias: 5 · Opcionales: 2` (todo calculado).
- Visibilidad de la sección "Cancelación de deudas externas" en la oferta.

Catálogos parametrizados (simulan venir del módulo Parámetros):
`PRODUCTOS`, `ORGANISMOS` (`empleados-salud` → "Empleados de salud"), `CANALES`
(`venta-directa` → "Venta directa"), `VENDEDORES` (`juan-perez` → "Juan Pérez").

## 4. ETAPA 1 — Originación (detalle por paso)

`OriginacionWizard`: barra de progreso + stepper (8 pasos) + contenido + resumen
lateral en vivo (Estado, Cliente, Producto, Organismo, y cuando existan: Capital,
Cuotas, Valor cuota, Neto, Riesgo, Oferta). Botones Atrás / Continuar; "Continuar"
deshabilitado con mensaje contextual (causa + cómo resolver) mientras el gate no
pase.

### 4.1 Paso 1 — Tipo de persona

Título: **"¿Qué tipo de persona querés registrar?"**
Dos cards seleccionables:
- **Persona física** — "Se identifica con DNI."
- **Persona jurídica** — "Se identifica con CUIT."

- Física → habilita el paso 2 con campo DNI.
- Jurídica → muestra campo CUIT y aclaración **"Flujo de persona jurídica
  disponible en la versión futura de la demo."** El wizard no avanza (dead-end
  informativo). `DemoTag` "Configuración DEMO".

La demo principal usa **Persona física**.

### 4.2 Paso 2 — Identificación del cliente

Título: **"Identificación del cliente"**
Descripción: **"Ingresá el DNI para consultar los datos disponibles."**
Campo: **DNI**. Botón: **"Consultar cliente"**.

Al presionar:
- Loading **"Consultando información del cliente…"** (~800 ms, simula API).
- Devuelve:
  - Apellido: **González**
  - Nombre: **María Fernanda**
  - DNI: **27.456.890**
  - CUIL: **27-27456890-4**
  - Sexo: **Femenino**
  - Fecha de nacimiento: **14/05/1982**
- Cada dato con badge **"Autocompletado"** + etiqueta de fuente:
  `✓ Apellido — API pública`, `✓ Nombre — API pública`, `✓ CUIL — API pública`,
  `✓ Sexo — API pública`, `✓ Fecha de nacimiento — API pública`.
- Todos los campos **editables**; al editar uno, su badge pasa a "Manual".
- Advertencia contextual: **"Algunos datos pueden requerir carga manual si la
  fuente consultada no los devuelve."**
- `DemoTag` "Regla simulada" en: qué APIs públicas concretas se usan (pendiente en
  la doc).

**Cliente nuevo vs existente** (se resuelve en este paso, no en el 6):
- La demo principal usa **CLIENTE EXISTENTE** →
  card **"Cliente existente"** + **"Encontramos un historial previo para este
  cliente."** Se asigna `numeroCliente = "000928"`.
- Alternativa **CLIENTE NUEVO** → **"No encontramos historial interno."**
  (para cliente nuevo, el paso 6 mostraría captura/liveness en lugar de cotejo).

Validación inline inmediata: **"El DNI debe contener entre 7 y 8 dígitos."**

### 4.3 Paso 3 — Configuración de la solicitud

Título: **"Configuración de la solicitud"**
Campos (selección parametrizada, no texto libre):
- **Producto**: Préstamo personal
- **Organismo**: Empleados de salud
- **Canal de venta**: Venta directa
- **Vendedor**: Juan Pérez

Indicación: **"Las opciones disponibles dependen de la configuración de
CreditoNet."** El organismo se siente como selección de catálogo, no como campo
abierto.

### 4.4 Paso 4 — Datos laborales e ingresos

Card **"Datos laborales e ingresos"**.

**Campos obligatorios** (marcados "Campos obligatorios"):
- Banco donde cobra el sueldo: **Banco Galicia**
- Ingreso neto: **$1.000.000**
- Ingreso bruto: **$1.250.000**
- Fecha de inicio laboral: **12/03/2019**

Sección **"Información adicional"** (visualmente opcional / configurable):
- Email — **✓ Completo**
- CUIT del empleador — **✓ Completo**
- Extracciones (Fecha de acreditación, Importe) — **No informado**
- Transferencias (Fecha de acreditación, Importe) — **No informado**
- Disponible — configurable
- Débitos no remunerativos — configurable

Cada campo adicional no informado muestra: **"Este campo puede ser obligatorio
según la configuración del producto."** (los que están en
`camposAdicionalesObligatorios` sí bloquean; en la demo `email` y `cuitEmpleador`
ya vienen completos, así que no molestan).

**Validaciones tempranas** (inmediatas, inline, nunca sólo "Error" — siempre qué
pasa + cómo se soluciona):
- Ingreso neto: **"No puede ser $0."**
- CBU: **"El CBU debe contener 22 dígitos."**
- DNI: **"El DNI debe contener entre 7 y 8 dígitos."**
- Email: **"El formato del email no es válido."**

### 4.5 Paso 5 — Datos adicionales

Bloque configurable con lo que no devuelve la API pública del paso 2. Campos:
**estado civil, domicilio particular completo, localidad / provincia, teléfono de
contacto, nacionalidad**.
Para **cliente existente** (demo), domicilio y teléfono vienen de **"Base
interna"** con badge "Autocompletado"; estado civil y nacionalidad quedan para
revisión / carga manual. Para cliente nuevo, todo es carga manual.
`DemoTag` "Regla simulada" (comportamiento si la fuente no devuelve un dato es
decisión pendiente en la doc).

### 4.6 Paso 6 — Verificación de identidad

Card **"Verificación de identidad"**:
- Imagen mock del cliente previamente almacenada (cliente existente).
- Texto: **"Compará la imagen archivada con la persona presente y validá su
  identidad."**
- Botón: **"Identidad verificada"** → setea `identidadVerificada = true`.

Cliente nuevo → captura / liveness (simulado). No se implementa biometría real.
`DemoTag` "Regla simulada" (política de captura biométrica pendiente en la doc).

### 4.7 Paso 7 — Motor de riesgo

Encabezado **"Evaluar solicitud"** + botón **"Evaluar crédito"**.

Al ejecutar, loading encadenado (mensajes en secuencia):
1. **"Analizando la solicitud…"**
2. **"Consultando información crediticia…"**
3. **"Aplicando reglas…"**
4. **"Generando condiciones de oferta…"**

Luego, pantalla de evaluación **muy visual**: se revelan las reglas una por una.
Cada regla muestra **Regla / Valor evaluado / Condición / Resultado**:

| Regla | Valor evaluado | Condición | Resultado |
|---|---|---|---|
| Identificación validada | María Fernanda González | Identidad validada | ✓ |
| Cliente sin trámite duplicado | 0 solicitudes activas | 0 solicitudes activas | ✓ |
| Ingreso mínimo cumplido | $1.000.000 | Mínimo $750.000 | ✓ Cumple |
| Situación BCRA dentro de parámetros | Situación 1 · sin deudas | Situación 1 o 2 | ✓ |
| Comportamiento interno favorable | Score 82/100 | Score ≥ 60 | ✓ |
| Días de mora dentro del límite | 0 días | ≤ 30 días | ✓ |
| Historial de pagos compatible | Último pago hace 25 días | ≤ 60 días | ✓ |

El motor evalúa sobre **ingreso neto** ($1.000.000 vs mínimo $750.000).
No mostrar solo "APROBADO": se muestra el proceso completo, regla por regla, y
recién al final el resultado global + `resultado = "GENERAR_OFERTA"`.
Al completar se asigna `numeroCredito = "CR-000184"`.

Si se cambian datos clave después de evaluar → banner "volvé a evaluar" (si
cambiar producto re-ejecuta riesgo es decisión pendiente → `DemoTag`).

### 4.8 Paso 8 — Oferta

Ver sección 5.

## 5. Pantalla de Oferta

Layout desktop: contenido + **resumen lateral en vivo** que se mantiene
actualizado:

```
RESUMEN DEL CRÉDITO
Capital           $2.500.000
Precancelación   -$1.000.000
Terceros         -$100.000
Neto              $1.400.000
12 cuotas         $XXX.XXX
```

### 5.1 Cabecera

```
María Fernanda González
DNI 27.456.890
Cliente #000928
Crédito #CR-000184
```

### 5.2 Oferta disponible

- **Capital máximo**: $2.500.000 (`capitalMaximoActual`)
- **Producto**: Préstamo personal
- **Organismo**: Empleados de salud

### 5.3 Monto solicitado

Input monetario. Valor inicial **$2.500.000**. Editable (ej. bajar a $2.000.000)
→ recalcula todo. Al cambiar muestra: `✓ Importe actualizado`, `✓ Nueva cuota`,
`✓ Nuevo total`.
Si supera el máximo: inline **"El importe solicitado supera el capital máximo
aprobado de $2.500.000."** y **no permite continuar**.

### 5.4 Tabla de cuotas

Alternativas **12 / 18 / 24** cuotas, cada una con `$XXX.XXX / mes`. Todas
seleccionables. Una marcada **Recomendada** (12). La selección cambia: cantidad de
cuotas, valor cuota, **primera fecha de vencimiento**, resumen final.

`primeraCuotaVencimiento` (Regla simulada, formato pendiente en la doc):
- 12 cuotas → **10/10/2026**
- 18 cuotas → 25/10/2026
- 24 cuotas → 10/11/2026

### 5.5 Créditos activos / precancelación

Sección **"Créditos activos"**:

```
CR-000102
Capital original:   $1.500.000
Capital residual:   $850.000
Monto a cancelar:   $1.000.000
Desglose:
  Capital:          $850.000
  Intereses:        $100.000
  IVA:              $30.000
  Cargos:           $20.000
Cuotas originales:  24
Cuota actual:       14
```

Checkbox **"Precancelar este crédito"** → muestra **"Precancelación
seleccionada"** y **recalcula la oferta**. El recálculo genera **mayor monto
disponible** (Regla simulada):

```
Capital máximo anterior:              $2.500.000
Capital máximo luego de precancelación: $2.850.000
```

Con animación / actualización clara. Luego el usuario vuelve al detalle de la
oferta para re-elegir importe + cuotas + valor cuota. `DemoTag` "Regla simulada"
(si la precancelación es total o parcial es decisión pendiente).

### 5.6 Cancelación de deudas con terceros

Sección **"Cancelación de deudas externas"**. Sólo aparece si el producto lo
permite (`permiteDeudaTerceros`); en la demo, **habilitada**.
Campo **Importe destinado a cancelación**: **$100.000**.
Explicación: **"Este importe será destinado a cancelar una deuda externa."**
No hay transferencia real, pero queda visualmente claro que **reduce el dinero
neto** que recibe el cliente. `DemoTag` "Configuración DEMO" (qué productos
permiten deuda de terceros es decisión pendiente).

### 5.7 Composición de la operación

Card **muy visual** (verde / azul eléctrico), valor final destacado:

```
COMPOSICIÓN DE LA OPERACIÓN
Nuevo crédito                    $2.500.000
Precancelación crédito existente -$1.000.000
Cancelación deuda externa        -$100.000
------------------------------------------
NETO A ACREDITAR                 $1.400.000
```

`neto = montoSolicitado − Σ(precancelaciones) − deudaTerceros.importe`

### 5.8 Selección final

El cliente confirma tres condiciones: **importe del préstamo**, **cantidad de
cuotas**, **valor de la cuota**. Texto: **"Estas tres condiciones forman parte de
la aceptación de la oferta."**
Además: **"Primera cuota — Vencimiento: 10/10/2026"** (según plazo).

### 5.9 Confirmación de oferta

Modal **"Confirmá la oferta"**:

```
Cliente                 María Fernanda González
Producto                Préstamo personal
Organismo               Empleados de salud
Importe solicitado      $2.500.000
Importe a precancelar   $1.000.000
Cancelación terceros    $100.000
Neto a acreditar        $1.400.000
Plazo                   12 cuotas
Valor cuota             $XXX.XXX
Primer vencimiento      10/10/2026
```

Botones: **"Volver a modificar"** / **"Confirmar oferta"**.
Al confirmar: **"Oferta aceptada correctamente"** +
**"Comenzá la carga de los datos requeridos para completar la solicitud."**
Setea `oferta.aceptada = true`, `etapa = "TRANSICION"`.

## 6. Transición de etapa

Pantalla dedicada (no saltar directo a documentación):

```
OFERTA ACEPTADA ✓
        ↓
Carga post-oferta
"Completá la información necesaria para finalizar el pedido."
```

Botón para entrar a la etapa 2 → `etapa = "POST_OFERTA"`.

## 7. ETAPA 2 — Post-oferta

`PostOfertaShell`:
- **Stepper libre** (`StepperLibre`): pantallas en el orden de la config, cada una
  con estado **✓ Completa** (verde) / **● Activa** (azul) / **○ Pendiente**
  (gris). Todas clickeables siempre; cambiar de pantalla NUNCA bloquea.
- Botón **"Finalizar carga"** siempre visible arriba.
- Panel lateral **"Configuración del producto"**: Producto, Pantallas
  configuradas 7, Obligatorias 5, Opcionales 2. `DemoTag` "Configuración DEMO".

### 7.1 Datos laborales

Campos: domicilio laboral, fecha de ingreso laboral, razón social del empleador,
rubro / actividad, provincia, teléfono laboral, número de legajo, banco donde
cobra, CBU.
Badges **"Ya informado"** / **"Autocompletado"** para lo que viene de la etapa 1.
Estado inicial en la demo: **completa** (todo autocompletado).

### 7.2 Datos personales

Campos: email, domicilio completo, teléfono celular, nacionalidad, estado civil,
tipo de vivienda, hijos a cargo, tarjeta de crédito.
Tipo de vivienda: **Propietario / Inquilino / Prestado por familiar-amigo**
(opciones "provienen de una configuración").
Estado inicial en la demo: **teléfono celular vacío → pendiente** (ítem 1 de los 3
pendientes de arranque).

### 7.3 Tokenización de tarjeta

Título **"Tokenización de tarjeta"**. Opciones: **Tarjeta de débito / Tarjeta
prepaga / Tarjeta de crédito** (demo: **crédito**).
Campos: Número, Vencimiento, Marca, Código de seguridad.
Explicación: **"La tarjeta será tokenizada mediante el proveedor configurado."**
+ **"Proveedor de tokenización — DEMO"**. No se envían datos reales; valores
ficticios.
Al confirmar: **✓ Tarjeta tokenizada** · Token: **`tok_demo_8F29A1`**.
Pantalla **opcional** en la config demo (no bloquea "Finalizar carga"), pero el
happy path la completa.

### 7.4 Referencias personales

Mínimo 1, máximo 2. Referencia 1 / Referencia 2, con agregar / eliminar según los
límites.
Campos: Nombre completo, Teléfono, Email, Domicilio, Relación.
Relaciones: **Familiar directo / Amigo / Compañero de trabajo / Otros**.
Contador **"1 de 2 referencias cargadas"** + validación clara.
Email es requerido en la referencia (Regla simulada).
Estado inicial en la demo: Referencia 1 cargada salvo **email → pendiente**
(ítem 2 de los 3 pendientes). Referencia 2 no agregada.

### 7.5 Garantías

Pantalla **"Datos del garante"**.
Campos: Nombre completo, DNI, Teléfono, Datos laborales, Ingresos, Lugar de
trabajo.
Documentos: Recibo de sueldo, DNI, Otros.
Si la config marca la pantalla como no obligatoria → badge **"Opcional según
producto"**. En la demo está **requerida** (para mostrar el flujo completo) y el
garante viene **pre-cargado con datos DEMO** para no frenar el happy path.
`DemoTag` "Configuración DEMO".

### 7.6 Legajo virtual

Título **"Legajo virtual"**.
Descripción: **"Cargá los documentos requeridos para completar el legajo."**
Checklist: **DNI frente / DNI dorso / Recibo de sueldo / Certificación de
domicilio**. Contador **"X de 4 documentos completos"**.
Cada documento = card:
- Cargado → Estado **✓ Cargado**, Archivo `dni_frente_demo.jpg`, botón **"Ver"**.
- Pendiente → Estado **○ Pendiente**, botón **"Adjuntar"** (upload simulado).
Estado inicial en la demo: 3 de 4 cargados, **Certificación de domicilio →
pendiente** (ítem 3 de los 3 pendientes).

### 7.7 Impresión de legajo

Título **"Impresión de legajo"**. Preview del documento con: datos del cliente,
condiciones del crédito, plan de pagos, términos y condiciones.
Botón **"Imprimir legajo"** → genera PDF simulado → **✓ Legajo generado** y
**marca automáticamente la pantalla como completa** (la doc establece que
presionar "Imprimir" completa la pantalla).
Pantalla **opcional** en la config demo.

### 7.8 Finalizar carga

Botón siempre visible arriba de la etapa 2.
- **Con pendientes** (obligatorias sin completar): banner / pantalla de
  validaciones **"Hay N elementos pendientes"** con lista:
  ```
  • Datos personales → Teléfono celular
  • Referencias → Email de referencia
  • Legajo virtual → Certificación de domicilio
  ```
  Cada ítem es **clickeable y navega directo a la pantalla correspondiente**.
  No permite finalizar.
- **Sin pendientes**: modal
  **"El crédito ha sido debidamente cargado y pasa a análisis de riesgo."**
  Botón **"Continuar"** → estado `EN_ANALISIS`, `etapa = "ENVIADA"`,
  `fechaEnvioAnalisis` seteada. El crédito **desaparece de la bandeja del
  vendedor**. Se muestra **"Solicitud enviada a análisis"** · CR-000184 ·
  **EN ANÁLISIS**.

## 8. Análisis (`/analisis`)

### 8.1 Bandeja del analista

Si no hay solicitud enviada → estado vacío.
Con solicitud → card:

```
CR-000184
María Fernanda González
$2.500.000 · 12 cuotas · Empleados de salud
Estado: EN ANÁLISIS
✓ Datos completos   ✓ Legajo completo
✓ Oferta aceptada   ✓ Motor evaluado
[ Tomar análisis ]
```

`"Tomar análisis"` → `estado = "ANALISIS_TOMADO"`, `analista.tomado = true`.

### 8.2 Análisis del crédito

Título **"Análisis del crédito"**. 5 cards con info suficiente:
- **Cliente** — nombre, DNI, CUIL, situación laboral, ingreso neto.
- **Riesgo** — 7 reglas evaluadas, resultado del motor, fecha.
- **Oferta** — capital, cuotas, valor cuota, precancelación, deuda terceros, neto.
- **Pagos / Historial** — CR-000102 (crédito activo), comportamiento interno,
  historial de pagos. `DemoTag` "Configuración DEMO".
- **Documentación** — legajo (4/4), tokenización, referencias, garante.

Botones: **Observar / Rechazar / Aprobar**.
- Observar → `estado = "OBSERVADA"` + `analista.observacion`. Puede reanudarse.
- Rechazar → modal con motivo obligatorio (≥ 5 caracteres) → `estado =
  "RECHAZADO"`.
- Aprobar → sección 8.3. (Happy path de la demo.)

### 8.3 Aprobación

Modal **"Confirmar aprobación"**:

```
Cliente          María Fernanda González
Capital          $2.500.000
Cuotas           12
Cuota            $XXX.XXX
Neto a acreditar $1.400.000
```

Botones: **Cancelar / Confirmar aprobación**.
Al confirmar (breve loading "Procesando aprobación…"):

```
✓ CRÉDITO APROBADO
CR-000184
Estado: APROBADO
Capital aprobado: $2.500.000
Neto a acreditar: $1.400.000
12 cuotas
```

Timeline debajo:

```
Solicitud ✓   Riesgo ✓   Oferta ✓   Onboarding ✓   Análisis ✓   Aprobación ✓
Caja y Bancos → Pendiente
```

Representa que tras la aprobación el crédito pasa a **Caja y Bancos** para
liquidación (fuera del alcance de la demo).

## 9. Sistema "Configuración DEMO" / "Regla simulada"

Componente `<DemoTag variant="config" | "regla" />`:
- `config` → "Configuración DEMO" (valor elegido para la demo).
- `regla` → "Regla simulada" (decisión funcional todavía pendiente).
- Pill ámbar discreto + `Tooltip` que explica qué está pendiente.

Se coloca (mínimo) en:
- Qué APIs públicas concretas se usan (paso 2).
- Comportamiento si la API no devuelve datos (paso 2/5).
- Política de captura biométrica (paso 6).
- Valor del ingreso mínimo (paso 7).
- Si cambiar producto re-ejecuta el motor de riesgo (paso 7).
- Formato / fecha de vencimiento de la primera cuota (oferta 5.4 / 5.8).
- Si la precancelación es total o parcial y el recálculo del capital máximo (5.5).
- Qué productos permiten cancelación de deuda de terceros (5.6).
- Comportamiento si el cliente NO acepta la oferta (5.9) — en la demo simplemente
  se puede volver a modificar; se marca como pendiente.
- Split 5 obligatorias / 2 opcionales de pantallas post-oferta (7).

## 10. Diseño visual

Se mantiene la estética y los tokens actuales (`globals.css`, Tailwind v4):
claro, moderno, fintech, profesional. Sin estética bancaria antigua.
- **Azul eléctrico** (`brand`): acciones principales / información / progreso.
- **Verde eléctrico** (`success`): éxito / aprobado / completado.
- **Rojo eléctrico** (`danger`): rechazo / error / bloqueo.
- **Amarillo** (`warning`): advertencia / pendiente / `DemoTag`.
- Fondo blanco / gris muy claro (`ink-25`/`ink-50`).

Patrones priorizados: cards, badges, stepper, progress bars, resúmenes laterales,
tablas limpias, inline validation, status indicators. Desktop = **formulario +
resumen lateral** actualizado en vivo (originación y oferta).

Estados de feedback consistentes en toda acción:
**✓ Completado · ⚠ Requiere atención · ✕ No válido · ○ Pendiente · ℹ Información.**
Nunca dejar al usuario sin saber qué está pasando. Ejemplos de copy:
"El cliente fue identificado correctamente." · "El importe supera el máximo
permitido." · "La oferta fue recalculada." · "El crédito tiene documentación
pendiente." · "El crédito fue enviado a análisis."

## 11. Decisiones tomadas (aprobadas)

- **D1** — Split post-oferta 5 obligatorias / 2 opcionales: obligatorias =
  laboral, personales, referencias, garantías, legajo; opcionales = tokenización,
  impresión. Garantías queda **requerida** en la demo (sección 23 del prompt).
- **D2** — La etapa 2 arranca con **3 ítems pendientes a propósito** (teléfono
  celular, email de referencia, certificación de domicilio) para lucir la UX de
  "elementos pendientes". El resto viene autocompletado / pre-cargado.
- **D3** — Primera cuota: 12 → 10/10/2026 (fija); 18 → 25/10/2026; 24 →
  10/11/2026. Todo con `DemoTag` "Regla simulada".
- **D4** — El motor de riesgo evalúa sobre **ingreso neto** ($1.000.000 vs mínimo
  $750.000).
- **D5** — `/` reemplaza el dashboard por las 3 tarjetas de acción + tarjeta
  "solicitud en curso" + reiniciar demo. Se quitan las métricas. Se agrega
  "Bandeja de análisis" al sidebar.
- **D6** — `numeroCliente = "000928"` se asigna al identificar (cliente
  existente); `numeroCredito = "CR-000184"` al generar la oferta el motor de
  riesgo (lo necesita la cabecera de la oferta).
- **D7** — Persistencia en `sessionStorage` con nueva key `...v2`; "Reiniciar
  demo" limpia todo.
- **D8** — El análisis agrega un estado intermedio `ANALISIS_TOMADO` ("Tomar
  análisis") antes de Observar / Rechazar / Aprobar.

## 12. Reutilización vs reescritura

**Se mantiene**: todos los `components/ui/*` (Button, Card, Banner, FormField,
SelectField, MoneyInput, Modal, Checkbox, StatusBadge, SummaryCard,
ValidationMessage, Tooltip, Stepper), `icons.tsx` (+3-4 iconos nuevos:
IconIdCard, IconCamera/IconScan, IconPrinter, IconRepeat según haga falta),
tokens de `globals.css`, `RiskRule`, `DocumentChecklist`, `SuccessScreen`,
`ConfirmationModal` (adaptados), layout `Sidebar` / `Header`.

**Se reescribe**: `OnboardingWizard` → `SolicitudFlow` + `OriginacionWizard` +
`PostOfertaShell`; los 7 `Step*` → pasos / pantallas nuevos; `application-context`,
`types`, `mocks`, `validation`, `credit`; `app/(app)/page.tsx` y
`app/(app)/analisis/page.tsx`.

**Nuevo**: `lib/config.ts`, `components/ui/StepperLibre.tsx`,
`components/ui/DemoTag.tsx`, `components/onboarding/**` (según árbol de 3.2),
`components/analisis/**`.

## 13. Verificación

- `npm run build` sin errores.
- `npm run lint` limpio.
- Recorrido manual del happy path completo de punta a punta:
  entrada `/` → Solicitar crédito → Persona física → DNI → cliente existente →
  configuración → datos laborales → datos adicionales → verificación de identidad
  → evaluar crédito → oferta → precancelar CR-000102 (capital máximo 2.5M → 2.85M)
  → deuda terceros $100.000 → seleccionar importe + cuotas + cuota → confirmar
  oferta → transición → tokenizar tarjeta + completar los 3 ítems pendientes
  (teléfono celular, email de referencia, certificación de domicilio) → finalizar
  carga → EN ANÁLISIS → `/analisis` → tomar análisis → aprobar → CRÉDITO APROBADO
  → Caja y Bancos pendiente.
- Revisión de consistencia entre etapas: el número de crédito (CR-000184), el
  número de cliente (#000928), el capital, el neto a acreditar ($1.400.000) y los
  estados coinciden en originación, oferta, post-oferta, análisis y aprobación.
- Probar el camino de bloqueo: importe > capital máximo no deja continuar;
  "Finalizar carga" con pendientes muestra la lista y no finaliza.

## 14. Fuera de alcance

- Módulos Parámetros y Créditos (sólo se simula que la config proviene de ahí).
- Precancelaciones y Gestión de mora como módulos (sólo tarjetas "Próximamente").
- Flujo completo de Persona jurídica (dead-end informativo).
- Caja y Bancos / liquidación (sólo aparece como paso pendiente en el timeline).
- Biometría real, tokenización real, generación real de PDF, APIs reales.
- Bandeja multi-solicitud / gestión de varios analistas (una sola solicitud).
