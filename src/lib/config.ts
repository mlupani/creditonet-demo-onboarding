// Configuración parametrizada (simula provenir del Módulo Créditos / Parámetros de CreditoNet).
// Producto (configuración general) → Organismo (sólo excepciones; lo que no define hereda del
// producto) → Plan de cuotas (condiciones financieras).
// Acá se define de forma fija para la demo, pero el objeto es real y maneja el flujo
// (stepper post-oferta, gates, cantidades, documentos, obligatoriedad de campos).

import type { PantallaPostOfertaId, Plazo, TipoCliente } from "./types";
import { parseFecha } from "./format";
import type { ExtrasProducto } from "./productos";

export interface OpcionCatalogo {
  id: string;
  nombre: string;
  detalle?: string;
}

// Catálogo vivo: el ABM de Productos lo actualiza en el lugar (ver productos.ts), así que los
// lugares que lo consultan por nombre siempre ven el estado vigente. Incluye los eliminados,
// para poder rotular solicitudes históricas.
export const PRODUCTOS: OpcionCatalogo[] = [
  {
    id: "prestamo-personal",
    nombre: "Préstamo personal",
    detalle: "Crédito en efectivo con descuento por haberes o débito automático.",
  },
  {
    id: "credito-judicial",
    nombre: "Crédito judicial",
    detalle: "Adelanto sobre sentencia u honorarios con cesión de cobro.",
  },
  {
    id: "prestamo-prendario",
    nombre: "Préstamo prendario",
    detalle: "Crédito con garantía de un vehículo u otro bien registrable.",
  },
  {
    id: "tarjeta-credito",
    nombre: "Tarjeta de crédito",
    detalle: "Línea revolving con tope mensual renovable.",
  },
  {
    id: "adelanto-sueldo",
    nombre: "Adelanto de sueldo",
    detalle: "Adelanto a cuenta del próximo haber, con descuento directo.",
  },
  {
    id: "refinanciacion",
    nombre: "Refinanciación",
    detalle: "Reunifica deudas vigentes del cliente en una sola cuota.",
  },
  {
    id: "prestamo-emergencia",
    nombre: "Préstamo de emergencia",
    detalle: "Desembolso rápido para gastos imprevistos.",
  },
  {
    id: "linea-consumo",
    nombre: "Línea de consumo",
    detalle: "Financiación para la compra de bienes y servicios.",
  },
];

// Arquitectura §3: el canal es el primer elemento del flujo y puede condicionar qué
// productos se ofrecen. No es el vendedor, que se toma de la sesión.
export const CANALES: OpcionCatalogo[] = [
  { id: "sucursal", nombre: "Sucursal", detalle: "Atención presencial en el punto de venta" },
  { id: "digital", nombre: "Canal digital", detalle: "Solicitud iniciada desde la web o la app" },
];

export const VENDEDORES: OpcionCatalogo[] = [
  { id: "juan-perez", nombre: "Juan Pérez", detalle: "Legajo V-118 · CreditoNet Casa Central" },
  { id: "ana-torres", nombre: "Ana Torres", detalle: "Legajo V-142 · CreditoNet Casa Central" },
  { id: "carlos-ruiz", nombre: "Carlos Ruiz", detalle: "Legajo V-097 · Sucursal Nueva Córdoba" },
];

// --- Plan de cuotas / Línea (§2.3) ---

interface PlanSemilla {
  id: string;
  nombre: string;
  sistema: string;
  plazos: Plazo[];
  montoMaximo: number;
  // Tope habilitado cuando la operación renueva un crédito propio vigente.
  montoMaximoRenovacion: number;
  rciMaxPct: number;
  endeudamientoMaxPct: number;
  smvmBolsillo: number;
  // Condición laboral que habilita la línea (reunión 11/09, 02:20 y 02:35). Si ninguna línea
  // del organismo la acepta, la solicitud se rechaza sin motor. La situación BCRA/buró interno
  // no bloquea la línea: sólo recorta el capital (situacionBcraDistintaDeUnoPct).
  condicionesLaborales: string[];
  // Recortes porcentuales sobre el capital ya calculado (02:48). Si aplican varios,
  // manda el mayor. 0 significa que la condición no recorta nada.
  limitantes: {
    clienteNuevoPct: number;
    clienteExistentePct: number;
    condicionLaboralPct: Partial<Record<string, number>>;
    situacionBcraDistintaDeUnoPct: number;
  };
  // Parámetros del cálculo financiero (Plan de Cuotas §6). Valores de demo.
  periodoGraciaDias: number;
  ivaPct: number;
  sellosPct: number;
  cargoOtorgamientoPct: number;
}

const PLANES_SEMILLA: Record<string, PlanSemilla> = {
  "linea-salud-2026": {
    id: "linea-salud-2026",
    nombre: "Línea Salud 2026",
    sistema: "Francés",
    plazos: [12, 18, 24, 36, 48, 60, 72, 84, 96, 120],
    montoMaximo: 2_500_000,
    montoMaximoRenovacion: 2_850_000,
    rciMaxPct: 40,
    endeudamientoMaxPct: 50,
    smvmBolsillo: 350_000,
    condicionesLaborales: ["Empleado fijo", "Contratado"],
    limitantes: {
      clienteNuevoPct: 50,
      clienteExistentePct: 0,
      condicionLaboralPct: { Contratado: 30 },
      situacionBcraDistintaDeUnoPct: 25,
    },
    periodoGraciaDias: 30,
    ivaPct: 21,
    sellosPct: 1.2,
    cargoOtorgamientoPct: 3,
  },
  "linea-seguridad-2026": {
    id: "linea-seguridad-2026",
    nombre: "Línea Fuerzas de Seguridad 2026",
    sistema: "Francés",
    plazos: [12, 18, 24, 36, 48, 60, 72, 84, 96, 120],
    montoMaximo: 3_200_000,
    montoMaximoRenovacion: 3_600_000,
    rciMaxPct: 35,
    endeudamientoMaxPct: 45,
    smvmBolsillo: 400_000,
    condicionesLaborales: ["Empleado fijo", "Contratado"],
    limitantes: {
      clienteNuevoPct: 40,
      clienteExistentePct: 0,
      condicionLaboralPct: { Contratado: 50 },
      situacionBcraDistintaDeUnoPct: 30,
    },
    periodoGraciaDias: 30,
    ivaPct: 21,
    sellosPct: 1.2,
    cargoOtorgamientoPct: 2.5,
  },
  "linea-pasivos-2026": {
    id: "linea-pasivos-2026",
    nombre: "Línea Pasivos 2026",
    sistema: "Francés",
    plazos: [12, 18, 24, 36, 48, 60, 72, 84, 96, 120],
    montoMaximo: 1_600_000,
    montoMaximoRenovacion: 1_800_000,
    rciMaxPct: 30,
    endeudamientoMaxPct: 40,
    smvmBolsillo: 300_000,
    condicionesLaborales: ["Jubilado / Pensionado"],
    limitantes: {
      clienteNuevoPct: 50,
      clienteExistentePct: 0,
      condicionLaboralPct: {},
      situacionBcraDistintaDeUnoPct: 40,
    },
    periodoGraciaDias: 45,
    ivaPct: 21,
    sellosPct: 1.2,
    cargoOtorgamientoPct: 3.5,
  },
  "linea-docentes-2026": {
    id: "linea-docentes-2026",
    nombre: "Línea Docentes 2026",
    sistema: "Francés",
    plazos: [12, 18, 24, 36, 48, 60, 72, 84, 96, 120],
    montoMaximo: 2_200_000,
    montoMaximoRenovacion: 2_500_000,
    rciMaxPct: 40,
    endeudamientoMaxPct: 50,
    smvmBolsillo: 350_000,
    condicionesLaborales: ["Empleado fijo", "Contratado"],
    limitantes: {
      clienteNuevoPct: 50,
      clienteExistentePct: 0,
      condicionLaboralPct: { Contratado: 30 },
      situacionBcraDistintaDeUnoPct: 25,
    },
    periodoGraciaDias: 30,
    ivaPct: 21,
    sellosPct: 1.2,
    cargoOtorgamientoPct: 3,
  },
  "linea-municipal-2026": {
    id: "linea-municipal-2026",
    nombre: "Línea Municipal 2026",
    sistema: "Francés",
    plazos: [12, 18, 24, 36, 48, 60, 72, 84, 96, 120],
    montoMaximo: 1_800_000,
    montoMaximoRenovacion: 2_000_000,
    rciMaxPct: 35,
    endeudamientoMaxPct: 45,
    smvmBolsillo: 320_000,
    condicionesLaborales: ["Empleado fijo", "Contratado"],
    limitantes: {
      clienteNuevoPct: 45,
      clienteExistentePct: 0,
      condicionLaboralPct: { Contratado: 35 },
      situacionBcraDistintaDeUnoPct: 30,
    },
    periodoGraciaDias: 30,
    ivaPct: 21,
    sellosPct: 1.2,
    cargoOtorgamientoPct: 3,
  },
};

// --- Plan de cuotas (modelo del ABM) ---
//
// Los planes se asignan al organismo y concentran las condiciones financieras, el cálculo de la
// oferta, los limitantes y la grilla de tasas. Un organismo puede tener varios planes: el plan de
// cada solicitud es el primero, por prioridad, que habilita al perfil del cliente.

export type SistemaAmortizacion = "FRANCES" | "AMERICANO" | "TASA_DIRECTA";

export const SISTEMAS_AMORTIZACION: { value: SistemaAmortizacion; label: string }[] = [
  { value: "FRANCES", label: "Francés (cuota fija)" },
  { value: "AMERICANO", label: "Americano (interés + capital al final)" },
  { value: "TASA_DIRECTA", label: "Tasa directa (interés sobre capital original)" },
];

// Una fila de la grilla de tasas: TNA de cada plazo. Es lo que arma la oferta.
export interface FilaGrilla {
  plazo: Plazo;
  tna: number;
  recomendada: boolean;
  // Regla simulada: el formato/fecha de la primera cuota es una decisión pendiente.
  primeraCuota: string;
}

export const GRILLA_BASE: FilaGrilla[] = [
  { plazo: 12, tna: 58, recomendada: true, primeraCuota: "10/10/2026" },
  { plazo: 18, tna: 63, recomendada: false, primeraCuota: "25/10/2026" },
  { plazo: 24, tna: 67, recomendada: false, primeraCuota: "10/11/2026" },
  { plazo: 36, tna: 72, recomendada: false, primeraCuota: "10/11/2026" },
  { plazo: 48, tna: 75, recomendada: false, primeraCuota: "10/12/2026" },
  { plazo: 60, tna: 78, recomendada: false, primeraCuota: "10/12/2026" },
  { plazo: 72, tna: 81, recomendada: false, primeraCuota: "10/01/2027" },
  { plazo: 84, tna: 84, recomendada: false, primeraCuota: "10/01/2027" },
  { plazo: 96, tna: 87, recomendada: false, primeraCuota: "10/02/2027" },
  { plazo: 120, tna: 90, recomendada: false, primeraCuota: "10/02/2027" },
];

export interface GastoOtorgamiento {
  tipo: "PORCENTAJE" | "MONTO_FIJO";
  // Porcentaje sobre el capital o monto fijo, según el tipo.
  valor: number;
  // Si se capitaliza, el gasto se suma al capital financiado en vez de descontarse.
  seCapitaliza: boolean;
}

export interface BonificacionPlan {
  id: string;
  concepto: string;
  pct: number;
  condicion: string;
}

// Hasta qué monto autoriza cada rol; por encima interviene el siguiente.
export interface TopesAutorizacion {
  montoAnalista: number;
  montoSupervisor: number;
}

export interface PlanCuotas {
  id: string;
  nombre: string;
  estado: EstadoProducto;
  // Vigencia comercial (dd/mm/aaaa).
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  // Orden de evaluación dentro del organismo: gana el primero que habilita al cliente.
  prioridad: number;
  // Condiciones generales
  sistema: SistemaAmortizacion;
  calculaIva: boolean;
  ivaPct: number;
  sellosPct: number;
  periodoGraciaDias: number;
  gastoOtorgamiento: GastoOtorgamiento;
  // Cargo administrativo / de cobranza, como porcentaje sobre la cuota.
  cargoAdministrativoPct: number;
  // Habilitación: para qué perfiles puede usarse el plan.
  situacionesBcra: number[];
  condicionesLaborales: string[];
  perfilesInternos: number[];
  // Capital máximo, y el tope ampliado cuando la operación renueva un crédito propio.
  montoMaximo: number;
  montoMaximoRenovacion: number;
  // Cuota máxima: compiten estas tres reglas y gana la menor.
  rciMaxPct: number;
  endeudamientoMaxPct: number;
  smvmBolsillo: number;
  // Recortes porcentuales sobre el capital ya calculado (02:48). Si aplican varios, manda el
  // mayor. 0 significa que la condición no recorta nada.
  limitantes: {
    clienteNuevoPct: number;
    clienteExistentePct: number;
    condicionLaboralPct: Partial<Record<string, number>>;
    situacionBcraDistintaDeUnoPct: number;
  };
  bonificaciones: BonificacionPlan[];
  topes: TopesAutorizacion;
  grilla: FilaGrilla[];
}

function semillaAPlan(p: PlanSemilla, i: number): PlanCuotas {
  return {
    id: p.id,
    nombre: p.nombre,
    estado: "ACTIVO",
    vigenciaDesde: "01/01/2026",
    vigenciaHasta: null,
    prioridad: 1,
    sistema: "FRANCES",
    calculaIva: true,
    ivaPct: p.ivaPct,
    sellosPct: p.sellosPct,
    periodoGraciaDias: p.periodoGraciaDias,
    gastoOtorgamiento: { tipo: "PORCENTAJE", valor: p.cargoOtorgamientoPct, seCapitaliza: false },
    cargoAdministrativoPct: 0,
    // Hoy la situación BCRA y el perfil interno no bloquean el plan: sólo recortan capital.
    situacionesBcra: [1, 2, 3, 4, 5],
    condicionesLaborales: [...p.condicionesLaborales],
    perfilesInternos: [1, 2, 3, 4, 5],
    montoMaximo: p.montoMaximo,
    montoMaximoRenovacion: p.montoMaximoRenovacion,
    rciMaxPct: p.rciMaxPct,
    endeudamientoMaxPct: p.endeudamientoMaxPct,
    smvmBolsillo: p.smvmBolsillo,
    limitantes: structuredClone(p.limitantes),
    bonificaciones:
      i === 0
        ? [
            {
              id: "bonif-1",
              concepto: "Bonificación del gasto de otorgamiento",
              pct: 50,
              condicion: "Cliente existente",
            },
          ]
        : [],
    topes: { montoAnalista: 1_500_000, montoSupervisor: 3_000_000 },
    grilla: GRILLA_BASE.filter((f) => p.plazos.includes(f.plazo)).map((f) => ({ ...f })),
  };
}

// Catálogo vivo: el ABM de Planes de cuotas lo actualiza en el lugar (ver planes.ts).
export const PLANES_CUOTAS: Record<string, PlanCuotas> = Object.fromEntries(
  Object.values(PLANES_SEMILLA).map((p, i) => [p.id, semillaAPlan(p, i)])
);

// Un plan se usa si está activo y dentro de su vigencia.
export function planOfrecible(plan: PlanCuotas, hoy: Date = new Date()): boolean {
  if (plan.estado !== "ACTIVO") return false;
  const desde = parseFecha(plan.vigenciaDesde);
  const hasta = plan.vigenciaHasta ? parseFecha(plan.vigenciaHasta) : null;
  const dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (desde && dia < desde) return false;
  if (hasta && dia > hasta) return false;
  return true;
}

// --- Onboarding post-oferta (Producto §7 bis · Onboarding §11) ---

export interface PantallaPostOfertaConfig {
  id: PantallaPostOfertaId;
  label: string;
  descripcion: string;
  orden: number;
  obligatoria: boolean;
  visible: boolean;
}

export interface CantidadConfig {
  minimo: number;
  maximo: number;
}

export interface DocumentoConfig {
  // Tipo de documento definido en Parámetros.
  tipoId: string;
  obligatorio: boolean;
  // Si el concepto admite una o varias imágenes.
  multiple: boolean;
}

// Producto: navegación entre las pantallas del onboarding. Libre: en cualquier orden.
// Secuencial: no se avanza a una pantalla mientras falte completar una obligatoria anterior.
export type NavegacionOnboarding = "LIBRE" | "SECUENCIAL";

export interface OnboardingConfig {
  pantallas: PantallaPostOfertaConfig[];
  navegacion: NavegacionOnboarding;
  // Pisa la obligatoriedad por defecto del catálogo de campos.
  camposObligatorios: Partial<Record<string, boolean>>;
  referencias: CantidadConfig;
  garantes: CantidadConfig;
  tokenizacion: { maximoTarjetas: number; proveedorId: string };
  documentos: DocumentoConfig[];
}

type CambiosPantalla = Partial<Record<PantallaPostOfertaId, { visible?: boolean; obligatoria?: boolean }>>;

// Onboarding §3: las 7 pantallas disponibles, en el orden de la documentación.
const PANTALLAS_BASE: PantallaPostOfertaConfig[] = [
  {
    id: "personales",
    label: "Datos personales",
    descripcion: "Identificación, domicilio particular y contacto.",
    orden: 1,
    obligatoria: true,
    visible: true,
  },
  {
    id: "laboral",
    label: "Datos laborales",
    descripcion: "Empleador, domicilio y teléfono laboral.",
    orden: 2,
    obligatoria: true,
    visible: true,
  },
  {
    id: "tokenizacion",
    label: "Tokenización de tarjetas",
    descripcion: "Una o varias tarjetas, por link de WhatsApp o carga presencial.",
    orden: 3,
    obligatoria: false,
    visible: true,
  },
  {
    id: "referencias",
    label: "Referencias personales",
    descripcion: "Una o varias referencias con DNI autocompletable.",
    orden: 4,
    obligatoria: true,
    visible: true,
  },
  {
    id: "garantias",
    label: "Garantías",
    descripcion: "Uno o varios garantes que firman el préstamo y el pagaré.",
    orden: 5,
    obligatoria: true,
    visible: true,
  },
  {
    id: "legajo",
    label: "Legajo virtual",
    descripcion: "Documentos definidos en Parámetros.",
    orden: 6,
    obligatoria: true,
    visible: true,
  },
  {
    id: "impresion",
    label: "Impresión de legajo",
    descripcion: "Imprimir o visualizar el PDF completo del legajo.",
    orden: 7,
    obligatoria: false,
    visible: true,
  },
];

function pantallas(cambios: CambiosPantalla = {}): PantallaPostOfertaConfig[] {
  return PANTALLAS_BASE.map((p) => ({ ...p, ...(cambios[p.id] ?? {}) }));
}

// --- Producto (entidad padre) ---

// Alta, baja y suspensión lógicas: un producto eliminado se conserva para las solicitudes que
// ya lo usaron, pero deja de ofrecerse.
export type EstadoProducto = "ACTIVO" | "SUSPENDIDO" | "ELIMINADO";

// Motor §9: qué motor (grupo de reglas) corresponde según el cliente. Prioridad: tipo de cliente
// (si se lo distingue) → condición laboral → situación BCRA → situación en buró interno →
// motor general. Las claves de las situaciones son "1".."5".
export interface AsignacionMotor {
  motorId: string | null;
  distingueTipoCliente: boolean;
  porTipoCliente: Record<TipoCliente, string | null>;
  porCondicionLaboral: Record<string, string>;
  porSituacionBcra: Record<string, string>;
  porSituacionInterna: Record<string, string>;
}

export function asignacionMotorVacia(motorId: string | null = null): AsignacionMotor {
  return {
    motorId,
    distingueTipoCliente: false,
    porTipoCliente: { NUEVO: null, EXISTENTE: null },
    porCondicionLaboral: {},
    porSituacionBcra: {},
    porSituacionInterna: {},
  };
}

export function motorAsignado(
  a: AsignacionMotor,
  condicionLaboral: string,
  tipoCliente: TipoCliente | null,
  situaciones: { bcra: number; interna: number } | null = null
): string | null {
  if (a.distingueTipoCliente && tipoCliente && a.porTipoCliente[tipoCliente])
    return a.porTipoCliente[tipoCliente];
  return (
    a.porCondicionLaboral[condicionLaboral] ??
    (situaciones ? a.porSituacionBcra?.[situaciones.bcra] : undefined) ??
    (situaciones ? a.porSituacionInterna?.[situaciones.interna] : undefined) ??
    a.motorId
  );
}

export interface ProductoConfig {
  id: string;
  nombre: string;
  estado: EstadoProducto;
  // Vigencia comercial (dd/mm/aaaa). Fuera de este rango el producto no se ofrece.
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  // Motor de riesgo del producto (Producto §6). El organismo puede pisar esta asignación.
  motor: AsignacionMotor;
  permiteDeudaTerceros: boolean;
  // Premisa general del producto (Producto §4): tope de capital antes de aplicar
  // los límites del riesgo, del plan y del salario.
  capitalMaximo: number;
  // Canales en los que se ofrece el producto (Producto §3).
  canales: string[];
  onboarding: OnboardingConfig;
}

export const PRODUCTOS_CONFIG: Record<string, ProductoConfig> = {
  "prestamo-personal": {
    id: "prestamo-personal",
    nombre: "Préstamo personal",
    estado: "ACTIVO",
    vigenciaDesde: "01/01/2026",
    vigenciaHasta: null,
    motor: asignacionMotorVacia(),
    permiteDeudaTerceros: true,
    capitalMaximo: 4_000_000,
    canales: ["sucursal", "digital"],
    onboarding: {
      pantallas: pantallas(),
      navegacion: "LIBRE",
      camposObligatorios: {},
      referencias: { minimo: 1, maximo: 2 },
      garantes: { minimo: 1, maximo: 2 },
      tokenizacion: { maximoTarjetas: 2, proveedorId: "proveedor-a" },
      documentos: [
        { tipoId: "dni-frente", obligatorio: true, multiple: false },
        { tipoId: "dni-dorso", obligatorio: true, multiple: false },
        { tipoId: "recibo-sueldo", obligatorio: true, multiple: true },
        { tipoId: "comprobante-servicio", obligatorio: true, multiple: false },
        { tipoId: "otros", obligatorio: false, multiple: true },
      ],
    },
  },
  "credito-judicial": {
    id: "credito-judicial",
    nombre: "Crédito judicial",
    estado: "ACTIVO",
    vigenciaDesde: "01/01/2026",
    vigenciaHasta: null,
    motor: asignacionMotorVacia("motor-judicial"),
    permiteDeudaTerceros: false,
    capitalMaximo: 6_000_000,
    // Requiere presentar la sentencia y firmar la cesión de cobro en persona.
    canales: ["sucursal"],
    onboarding: {
      pantallas: pantallas({
        tokenizacion: { visible: false },
        garantias: { visible: true, obligatoria: false },
      }),
      navegacion: "LIBRE",
      camposObligatorios: {},
      referencias: { minimo: 1, maximo: 2 },
      garantes: { minimo: 0, maximo: 0 },
      tokenizacion: { maximoTarjetas: 1, proveedorId: "proveedor-b" },
      documentos: [
        { tipoId: "dni-frente", obligatorio: true, multiple: false },
        { tipoId: "dni-dorso", obligatorio: true, multiple: false },
        { tipoId: "sentencia", obligatorio: true, multiple: true },
        { tipoId: "comprobante-servicio", obligatorio: true, multiple: false },
      ],
    },
  },
};

// Los productos del catálogo sin configuración propia partían del préstamo personal: ahora se
// materializan para poder editarlos desde el ABM sin cambiar cómo se comportan.
for (const p of PRODUCTOS) {
  if (PRODUCTOS_CONFIG[p.id]) continue;
  PRODUCTOS_CONFIG[p.id] = {
    ...structuredClone(PRODUCTOS_CONFIG["prestamo-personal"]),
    id: p.id,
    nombre: p.nombre,
  };
}

// --- Organismo (excepciones sobre el producto) ---

// Lo que el organismo pisa del onboarding del producto. Sólo se guardan las excepciones
// explícitas; lo que no está, hereda del producto (Organismo §4 bis).
export interface OverridesOrganismo {
  permiteDeudaTerceros?: boolean;
  capitalMaximo?: number;
  navegacion?: NavegacionOnboarding;
  pantallas?: CambiosPantalla;
  camposObligatorios?: Partial<Record<string, boolean>>;
  // Campos del formulario que el organismo quita (no se muestran ni se validan).
  camposQuitados?: string[];
  referencias?: Partial<CantidadConfig>;
  garantes?: Partial<CantidadConfig>;
  tokenizacion?: Partial<OnboardingConfig["tokenizacion"]>;
  // Documentación propia del organismo: reemplaza la lista del producto.
  documentos?: DocumentoConfig[];
}

// Excepciones de un organismo sobre UN producto (Organismo × Producto).
// Motor: null hereda el del producto; si el organismo lo define, pisa al del producto.
// Canales: null hereda los del producto; con lista, sólo se ofrece en esos canales.
// Extras: excepciones sobre los valores de ejemplo del producto (vencimiento, punitorios…).
export interface ExcepcionesOrganismo {
  overrides: OverridesOrganismo;
  motor: AsignacionMotor | null;
  canales: string[] | null;
  extras: Partial<ExtrasProducto>;
}

export function excepcionesVacias(): ExcepcionesOrganismo {
  return { overrides: {}, motor: null, canales: null, extras: {} };
}

export interface OrganismoConfig extends OpcionCatalogo {
  // Alta, baja y suspensión lógicas (igual que el producto). Sólo un organismo activo y vigente
  // se ofrece.
  estado: EstadoProducto;
  // Vigencia comercial (dd/mm/aaaa).
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  // Planes de cuotas vinculados (la vinculación se define en el plan).
  planes: string[];
  // Condición laboral del colectivo: participa en la selección del motor (Motor §9).
  condicionLaboral: string;
  // Productos activos que este organismo ofrece a su colectivo.
  productos: string[];
  // Excepciones por producto. Un producto sin entrada hereda todo.
  excepciones: Record<string, ExcepcionesOrganismo>;
}

// Forma en que están escritos los datos de ejemplo: un único juego de excepciones que se
// reparte a todos los productos del organismo.
interface OrganismoSemilla extends OpcionCatalogo {
  estado: EstadoProducto;
  motor: AsignacionMotor | null;
  canales: string[] | null;
  planId: string;
  condicionLaboral: string;
  productos: string[];
  overrides: OverridesOrganismo;
}

const ORGANISMOS_SEMILLA: OrganismoSemilla[] = [
  {
    id: "empleados-salud",
    nombre: "Empleados de salud",
    detalle: "Sector salud · Convenio provincial",
    condicionLaboral: "Empleado en relación de dependencia",
    estado: "ACTIVO",
    motor: asignacionMotorVacia("motor-salud"),
    canales: null,
    planId: "linea-salud-2026",
    productos: [
      "prestamo-personal",
      "credito-judicial",
      "prestamo-prendario",
      "adelanto-sueldo",
      "linea-consumo",
    ],
    overrides: {},
  },
  {
    id: "policia-provincial",
    nombre: "Policía de la Provincia",
    detalle: "Fuerzas de seguridad · Descuento por haberes",
    condicionLaboral: "Personal de fuerzas de seguridad",
    estado: "ACTIVO",
    motor: asignacionMotorVacia("motor-seguridad"),
    canales: null,
    planId: "linea-seguridad-2026",
    productos: [
      "prestamo-personal",
      "credito-judicial",
      "prestamo-prendario",
      "refinanciacion",
      "prestamo-emergencia",
    ],
    overrides: {
      pantallas: {
        referencias: { obligatoria: false },
        garantias: { visible: true, obligatoria: false },
      },
      // La repartición identifica la dependencia policial del cliente.
      camposObligatorios: { reparticion: true },
    },
  },
  {
    id: "jubilados-provincial",
    nombre: "Jubilados y pensionados",
    detalle: "Caja de jubilaciones · Haber previsional",
    condicionLaboral: "Pasivo / haber previsional",
    estado: "ACTIVO",
    motor: asignacionMotorVacia("motor-pasivos"),
    canales: null,
    planId: "linea-pasivos-2026",
    productos: [
      "prestamo-personal",
      "adelanto-sueldo",
      "refinanciacion",
      "prestamo-emergencia",
      "linea-consumo",
    ],
    overrides: {
      permiteDeudaTerceros: false,
      capitalMaximo: 2_000_000,
      pantallas: {
        tokenizacion: { obligatoria: true },
      },
      tokenizacion: { maximoTarjetas: 1 },
      // Un pasivo no tiene cargo ni legajo de empleado.
      camposObligatorios: { cargo: false, numeroLegajo: false },
      documentos: [
        { tipoId: "dni-frente", obligatorio: true, multiple: false },
        { tipoId: "dni-dorso", obligatorio: true, multiple: false },
        { tipoId: "recibo-haberes", obligatorio: true, multiple: false },
        { tipoId: "comprobante-servicio", obligatorio: true, multiple: false },
      ],
    },
  },
  {
    id: "docentes-provincial",
    nombre: "Docentes de la Provincia",
    detalle: "Sector educación · Convenio provincial",
    condicionLaboral: "Empleado en relación de dependencia",
    estado: "ACTIVO",
    motor: null,
    canales: null,
    planId: "linea-docentes-2026",
    productos: [
      "prestamo-personal",
      "tarjeta-credito",
      "prestamo-prendario",
      "linea-consumo",
      "refinanciacion",
    ],
    overrides: {},
  },
  {
    id: "municipales",
    nombre: "Empleados municipales",
    detalle: "Planta municipal · Descuento por haberes",
    condicionLaboral: "Empleado en relación de dependencia",
    estado: "ACTIVO",
    motor: null,
    canales: null,
    planId: "linea-municipal-2026",
    productos: [
      "prestamo-personal",
      "credito-judicial",
      "tarjeta-credito",
      "adelanto-sueldo",
      "prestamo-emergencia",
    ],
    overrides: {},
  },
];

// Catálogo vivo: el ABM de Organismos lo actualiza en el lugar (ver organismos.ts).
export const ORGANISMOS: OrganismoConfig[] = ORGANISMOS_SEMILLA.map((o) => ({
  id: o.id,
  nombre: o.nombre,
  detalle: o.detalle,
  estado: o.estado,
  vigenciaDesde: "01/01/2026",
  vigenciaHasta: null,
  planes: [o.planId],
  condicionLaboral: o.condicionLaboral,
  productos: [...o.productos],
  excepciones: Object.fromEntries(
    o.productos.map((id) => [
      id,
      {
        overrides: structuredClone(o.overrides),
        motor: structuredClone(o.motor),
        canales: o.canales ? [...o.canales] : null,
        extras: {},
      } satisfies ExcepcionesOrganismo,
    ])
  ),
}));

// --- Resolución de configuración efectiva ---

type Seleccion = { productoId: string; organismoId: string };

export function getProductoConfig(productoId: string): ProductoConfig {
  return PRODUCTOS_CONFIG[productoId] ?? PRODUCTOS_CONFIG["prestamo-personal"];
}

// El organismo puede restringir los canales del producto (excepción): sólo se ofrece donde
// ambos coinciden.
export function productoHabilitadoEnCanal(
  productoId: string,
  canalId: string,
  organismoId?: string
): boolean {
  if (!getProductoConfig(productoId).canales.includes(canalId)) return false;
  const canalesOrganismo = organismoId ? excepcionesDe(organismoId, productoId).canales : null;
  return !canalesOrganismo || canalesOrganismo.includes(canalId);
}

export function organismoOfrecible(organismoId: string, hoy: Date = new Date()): boolean {
  const o = getOrganismo(organismoId);
  if (o.estado !== "ACTIVO") return false;
  const desde = parseFecha(o.vigenciaDesde);
  const hasta = o.vigenciaHasta ? parseFecha(o.vigenciaHasta) : null;
  const dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (desde && dia < desde) return false;
  if (hasta && dia > hasta) return false;
  return true;
}

// Excepciones del organismo sobre un producto; sin entrada, hereda todo.
export function excepcionesDe(organismoId: string, productoId: string): ExcepcionesOrganismo {
  return getOrganismo(organismoId).excepciones[productoId] ?? excepcionesVacias();
}

// Un producto se ofrece si está activo y dentro de su vigencia.
export function productoOfrecible(productoId: string, hoy: Date = new Date()): boolean {
  const p = getProductoConfig(productoId);
  if (p.estado !== "ACTIVO") return false;
  const desde = parseFecha(p.vigenciaDesde);
  const hasta = p.vigenciaHasta ? parseFecha(p.vigenciaHasta) : null;
  const dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (desde && dia < desde) return false;
  if (hasta && dia > hasta) return false;
  return true;
}

export function getOrganismo(organismoId: string): OrganismoConfig {
  return ORGANISMOS.find((o) => o.id === organismoId) ?? ORGANISMOS[0];
}

// Cada organismo ofrece su propio subconjunto de productos (Producto §3 bis).
export function productoHabilitadoEnOrganismo(productoId: string, organismoId: string): boolean {
  return getOrganismo(organismoId).productos.includes(productoId);
}

export function productosDelOrganismo(organismoId: string): OpcionCatalogo[] {
  const ids = getOrganismo(organismoId).productos;
  return PRODUCTOS.filter((p) => ids.includes(p.id) && productoOfrecible(p.id));
}

// Planes del organismo que pueden usarse hoy, en orden de prioridad.
export function planesDelOrganismo(organismoId: string): PlanCuotas[] {
  return getOrganismo(organismoId)
    .planes.map((id) => PLANES_CUOTAS[id])
    .filter((p): p is PlanCuotas => !!p && planOfrecible(p))
    .sort((a, b) => a.prioridad - b.prioridad || a.nombre.localeCompare(b.nombre, "es"));
}

// Perfil del cliente que habilita (o no) un plan.
export interface ContextoLinea {
  condicionLaboral: string;
  situacionBcra: number;
  perfilInterno: number;
}

export interface ResultadoLinea {
  plan: PlanCuotas | null;
  // Qué dejó afuera a los planes, para poder explicar el rechazo.
  motivo: string | null;
}

// Por qué un plan no habilita al perfil (vacío si lo habilita).
export function motivosDeExclusion(plan: PlanCuotas, ctx: ContextoLinea): string[] {
  const motivos: string[] = [];
  if (!plan.condicionesLaborales.includes(ctx.condicionLaboral))
    motivos.push(
      ctx.condicionLaboral
        ? `no admite la condición laboral “${ctx.condicionLaboral}”`
        : "requiere una condición laboral declarada"
    );
  if (!plan.situacionesBcra.includes(ctx.situacionBcra))
    motivos.push(`no admite la situación BCRA ${ctx.situacionBcra}`);
  if (!plan.perfilesInternos.includes(ctx.perfilInterno))
    motivos.push(`no admite el perfil de riesgo interno ${ctx.perfilInterno}`);
  return motivos;
}

/**
 * Busca la línea aplicable dentro del organismo (reunión 11/09, 02:28–02:35).
 *
 * Se corre DESPUÉS del motor y ANTES del cálculo. El organismo puede tener varios planes: se
 * usa el primero, por prioridad, que habilita la condición laboral, la situación BCRA y el
 * perfil de riesgo interno del cliente. Si ninguno lo habilita, la solicitud se rechaza: es un
 * rechazo que no pertenece al motor y que no llega al analista.
 */
export function seleccionarLinea(organismoId: string, ctx: ContextoLinea): ResultadoLinea {
  const planes = planesDelOrganismo(organismoId);
  if (planes.length === 0)
    return { plan: null, motivo: "El organismo no tiene planes de cuotas activos y vigentes" };
  const detalle: string[] = [];
  for (const plan of planes) {
    const motivos = motivosDeExclusion(plan, ctx);
    if (motivos.length === 0) return { plan, motivo: null };
    detalle.push(`${plan.nombre} ${motivos.join(" y ")}`);
  }
  return {
    plan: null,
    motivo:
      planes.length === 1
        ? detalle[0]
        : `Ningún plan del organismo habilita este perfil: ${detalle.join(" · ")}`,
  };
}

export function configEfectiva({ productoId, organismoId }: Seleccion) {
  const producto = getProductoConfig(productoId);
  const organismo = getOrganismo(organismoId);
  const excepciones = excepcionesDe(organismoId, productoId);
  const o = excepciones.overrides;
  const base = producto.onboarding;
  const pantallasEfectivas = base.pantallas.map((p) => ({
    ...p,
    ...(o.pantallas?.[p.id] ?? {}),
  }));
  const cantidadExcepciones =
    (o.permiteDeudaTerceros !== undefined ? 1 : 0) +
    (o.capitalMaximo !== undefined ? 1 : 0) +
    (o.navegacion !== undefined ? 1 : 0) +
    Object.keys(o.pantallas ?? {}).length +
    Object.keys(o.camposObligatorios ?? {}).length +
    (o.camposQuitados?.length ?? 0) +
    (o.referencias ? 1 : 0) +
    (o.garantes ? 1 : 0) +
    (o.tokenizacion ? 1 : 0) +
    (o.documentos ? 1 : 0);
  return {
    producto,
    organismo,
    excepciones,
    overrides: o,
    permiteDeudaTerceros: o.permiteDeudaTerceros ?? producto.permiteDeudaTerceros,
    capitalMaximo: o.capitalMaximo ?? producto.capitalMaximo,
    pantallas: pantallasEfectivas,
    navegacion: o.navegacion ?? base.navegacion,
    camposObligatorios: { ...base.camposObligatorios, ...(o.camposObligatorios ?? {}) },
    camposQuitados: o.camposQuitados ?? [],
    referencias: { ...base.referencias, ...(o.referencias ?? {}) },
    garantes: { ...base.garantes, ...(o.garantes ?? {}) },
    tokenizacion: { ...base.tokenizacion, ...(o.tokenizacion ?? {}) },
    documentos: o.documentos ?? base.documentos,
    cantidadExcepciones,
  };
}

export function pantallasVisibles(sel: Seleccion): PantallaPostOfertaConfig[] {
  return configEfectiva(sel)
    .pantallas.filter((p) => p.visible)
    .sort((a, b) => a.orden - b.orden);
}

export function resumenConfig(sel: Seleccion) {
  const cfg = configEfectiva(sel);
  const visibles = pantallasVisibles(sel);
  const obligatorias = visibles.filter((p) => p.obligatoria).length;
  return {
    producto: cfg.producto.nombre,
    organismo: cfg.organismo.nombre,
    herencia:
      cfg.cantidadExcepciones === 0
        ? "Hereda 100 % del producto"
        : `${cfg.cantidadExcepciones} excepción${cfg.cantidadExcepciones === 1 ? "" : "es"} del organismo`,
    total: visibles.length,
    obligatorias,
    opcionales: visibles.length - obligatorias,
  };
}

export function nombreOpcion(catalogo: OpcionCatalogo[], id: string): string {
  return catalogo.find((o) => o.id === id)?.nombre ?? "—";
}

// Usuarios de la sesión según la bandeja (roles de la Guía Definitiva §1).
export const SESION = {
  vendedorId: "juan-perez",
  nombre: "Juan Pérez",
  iniciales: "JP",
  rol: "Canal de venta",
  organizacion: "CreditoNet · Casa Central",
};

// Quien administra los Parámetros (productos y organismos).
export const SESION_PARAMETROS = {
  nombre: "Marina Costa",
  iniciales: "MC",
  rol: "Analista de parámetros",
  organizacion: "CreditoNet · Parámetros",
};

export const SESION_SUPERVISOR = {
  nombre: "Diego Suárez",
  iniciales: "DS",
  rol: "Supervisor de riesgo",
  organizacion: "CreditoNet · Supervisión",
};

// Quien llama al cliente para el chequeo telefónico posterior a la firma.
export const SESION_CHEQUEADOR = {
  nombre: "Rodrigo Bianchi",
  iniciales: "RB",
  rol: "Chequeador telefónico",
  organizacion: "CreditoNet · Chequeo telefónico",
};

export const SESION_ANALISTA = {
  nombre: "Lucía Martínez",
  iniciales: "LM",
  rol: "Analista de riesgo",
  organizacion: "CreditoNet · Análisis de riesgo",
};
