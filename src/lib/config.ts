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

// Cada vendedor está vinculado a los canales en los que opera.
export interface Vendedor extends OpcionCatalogo {
  canales: string[];
}

export const VENDEDORES: Vendedor[] = [
  {
    id: "juan-perez",
    nombre: "Juan Pérez",
    detalle: "Legajo V-118 · CreditoNet Casa Central",
    canales: ["sucursal"],
  },
  {
    id: "ana-torres",
    nombre: "Ana Torres",
    detalle: "Legajo V-142 · CreditoNet Casa Central",
    canales: ["digital"],
  },
  {
    id: "carlos-ruiz",
    nombre: "Carlos Ruiz",
    detalle: "Legajo V-097 · Sucursal Nueva Córdoba",
    canales: ["sucursal"],
  },
];

// --- Plan de cuotas / Línea (§2.3) ---

interface PlanSemilla {
  id: string;
  nombre: string;
  sistema: string;
  plazos: Plazo[];
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
  cargoOtorgamientoPct: number;
}

const PLANES_SEMILLA: Record<string, PlanSemilla> = {
  "linea-salud-2026": {
    id: "linea-salud-2026",
    nombre: "Línea Salud 2026",
    sistema: "Francés",
    plazos: [12, 18, 24, 36, 48, 60, 72, 84, 96, 120],
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
    cargoOtorgamientoPct: 3,
  },
  "linea-seguridad-2026": {
    id: "linea-seguridad-2026",
    nombre: "Línea Fuerzas de Seguridad 2026",
    sistema: "Francés",
    plazos: [12, 18, 24, 36, 48, 60, 72, 84, 96, 120],
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
    cargoOtorgamientoPct: 2.5,
  },
  "linea-pasivos-2026": {
    id: "linea-pasivos-2026",
    nombre: "Línea Pasivos 2026",
    sistema: "Francés",
    plazos: [12, 18, 24, 36, 48, 60, 72, 84, 96, 120],
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
    cargoOtorgamientoPct: 3.5,
  },
  "linea-docentes-2026": {
    id: "linea-docentes-2026",
    nombre: "Línea Docentes 2026",
    sistema: "Francés",
    plazos: [12, 18, 24, 36, 48, 60, 72, 84, 96, 120],
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
    cargoOtorgamientoPct: 3,
  },
  "linea-municipal-2026": {
    id: "linea-municipal-2026",
    nombre: "Línea Municipal 2026",
    sistema: "Francés",
    plazos: [12, 18, 24, 36, 48, 60, 72, 84, 96, 120],
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
    cargoOtorgamientoPct: 3,
  },
};

// --- Plan de cuotas (modelo del ABM) ---
//
// Los planes se asignan al organismo y concentran las condiciones financieras, el cálculo de la
// oferta, los limitantes y la grilla de tasas. Un organismo puede tener varios planes: el plan de
// cada solicitud es el primero, por prioridad, que habilita al perfil del cliente.

export type SistemaAmortizacion =
  | "FRANCES_FIJA"
  | "FRANCES_VARIABLE"
  | "AMERICANO"
  | "TASA_DIRECTA"
  | "ALEMAN";

export const SISTEMAS_AMORTIZACION: { value: SistemaAmortizacion; label: string }[] = [
  { value: "FRANCES_FIJA", label: "Francés cuota fija (cuota constante)" },
  { value: "FRANCES_VARIABLE", label: "Francés cuota variable (cuota que se ajusta cada mes)" },
  { value: "AMERICANO", label: "Americano (interés + capital al final)" },
  { value: "TASA_DIRECTA", label: "Tasa directa (interés sobre capital original)" },
  { value: "ALEMAN", label: "Alemán (capital constante, cuota decreciente)" },
];

// Regla simulada: en el francés cuota variable la cuota arranca como la del francés y se ajusta
// este porcentaje cada mes (como una cuota indexada).
export const AJUSTE_CUOTA_VARIABLE_PCT = 2;

// Los planes guardados antes de separar el francés tenían "FRANCES": pasan a cuota fija. Un
// valor desconocido también cae en el francés cuota fija.
export function migrarSistemaAmortizacion(valor: string): SistemaAmortizacion {
  return SISTEMAS_AMORTIZACION.some((s) => s.value === valor)
    ? (valor as SistemaAmortizacion)
    : "FRANCES_FIJA";
}

// Una fila de la grilla de tasas: TNA de un plazo exacto o de un rango de plazos. Es lo que arma
// la oferta (ver `terminosDe`).
export type ModoPlazo = "EXACTO" | "CORRIDO";

export const MAX_PLAZO_GRILLA = 120;

export interface FilaGrilla {
  // Plazo exacto o, en modo CORRIDO, el primero del rango.
  plazo: Plazo;
  // EXACTO (por defecto): sólo ese plazo. CORRIDO: de `plazo` a `plazoHasta`, un plazo cada `cada`
  // cuotas (por defecto, todos).
  modo?: ModoPlazo;
  plazoHasta?: Plazo;
  cada?: number;
  tna: number;
  recomendada: boolean;
  // Regla simulada: el formato/fecha de la primera cuota es una decisión pendiente.
  primeraCuota: string;
}

// Rango de capitales que cubre la grilla del plan y cada cuánto se abre una fila.
export interface RangoCapitalGrilla {
  minimo: number;
  maximo: number;
  salto: number;
}

export const RANGO_CAPITAL_GRILLA_BASE: RangoCapitalGrilla = {
  minimo: 100_000,
  maximo: 2_000_000,
  salto: 100_000,
};

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

// Plazos que ofrece una fila de la grilla, de menor a mayor. En un rango siempre entra el último.
export function plazosDeFila(f: FilaGrilla): Plazo[] {
  if (f.modo !== "CORRIDO") return [f.plazo];
  const hasta = Math.max(f.plazoHasta ?? f.plazo, f.plazo);
  const cada = Math.max(1, Math.floor(f.cada ?? 1));
  const plazos: Plazo[] = [];
  for (let n = f.plazo; n < hasta; n += cada) plazos.push(n);
  plazos.push(hasta);
  return plazos;
}

// La grilla expandida a un término por plazo (lo que ve la oferta), ordenada por plazo. La fila
// recomendada marca su primer plazo.
export function terminosDe(grilla: FilaGrilla[]): FilaGrilla[] {
  return grilla
    .flatMap((f) =>
      plazosDeFila(f).map((plazo) => ({
        plazo,
        tna: f.tna,
        recomendada: f.recomendada && plazo === f.plazo,
        primeraCuota: f.primeraCuota,
      }))
    )
    .sort((a, b) => a.plazo - b.plazo);
}

// Qué se hace con el gasto de otorgamiento: se suma al capital financiado (y paga interés) o se
// reparte en partes iguales sobre cada cuota.
export type TratamientoGasto = "CAPITALIZA" | "DISTRIBUYE_CUOTAS";

export const TRATAMIENTOS_GASTO: { value: TratamientoGasto; label: string }[] = [
  { value: "CAPITALIZA", label: "Se capitaliza" },
  { value: "DISTRIBUYE_CUOTAS", label: "Se distribuye en las cuotas" },
];

export interface GastoOtorgamiento {
  tipo: "PORCENTAJE" | "MONTO_FIJO";
  // Porcentaje sobre el capital o monto fijo, según el tipo.
  valor: number;
  tratamiento: TratamientoGasto;
}

// Los planes guardados antes tenían el check `seCapitaliza`: true pasa a "se capitaliza" y false
// a "se distribuye en las cuotas".
export function normalizarGasto(
  g: Omit<GastoOtorgamiento, "tratamiento"> & { tratamiento?: TratamientoGasto; seCapitaliza?: boolean }
): GastoOtorgamiento {
  const { seCapitaliza, tratamiento, ...resto } = g;
  return {
    ...resto,
    tratamiento: tratamiento ?? (seCapitaliza ? "CAPITALIZA" : "DISTRIBUYE_CUOTAS"),
  };
}

// Cargos periódicos del plan: cada uno va dentro de la cuota que paga el cliente. El importe es
// un porcentaje de la cuota, un monto fijo por cuota o un porcentaje del capital solicitado
// (por cuota). Con IVA, el valor ya lo incluye; sin IVA, se le suma el IVA del plan.
export type TipoCargo = "PORCENTAJE_CUOTA" | "MONTO_FIJO" | "PORCENTAJE_CAPITAL";

export const TIPOS_CARGO: { value: TipoCargo; label: string }[] = [
  { value: "PORCENTAJE_CUOTA", label: "Porcentaje de la cuota" },
  { value: "MONTO_FIJO", label: "Monto fijo por cuota" },
  { value: "PORCENTAJE_CAPITAL", label: "Porcentaje del capital solicitado" },
];

export interface CargoPeriodico {
  id: string;
  // Nombre del servicio elegido.
  nombre: string;
  // Servicio del catálogo (ABM de servicios) que origina el cargo; null sólo en cargos viejos.
  servicioId: string | null;
  // Forma de cálculo: la define el servicio en su ABM y se copia al elegirlo.
  tipo: TipoCargo;
  valor: number;
  conIva: boolean;
}

// Cargos del plan con el IVA que se les suma cuando el valor es sin IVA (0 si el producto no
// calcula IVA).
export interface CargosPlan {
  cargos: CargoPeriodico[];
  ivaPct: number;
}

// IVA y sellos los define el producto (antes, el plan de cuotas).
export function impuestosDe(productoId: string): Pick<ProductoConfig, "calculaIva" | "ivaPct" | "sellosPct"> {
  const { calculaIva, ivaPct, sellosPct } = getProductoConfig(productoId);
  return { calculaIva, ivaPct, sellosPct };
}

// Producto con el que se usa un plan: el del primer organismo vigente que lo tiene vinculado.
export function productoDelPlan(planId: string): string {
  return (
    ORGANISMOS.find((o) => o.estado !== "ELIMINADO" && o.planes.includes(planId))?.productos[0] ??
    "prestamo-personal"
  );
}

// Con `productoId` (el de la solicitud) el IVA sale de ese producto; sin él, del producto del plan.
export function cargosDe(
  plan?: Pick<PlanCuotas, "id" | "cargos"> | null,
  productoId?: string
): CargosPlan | null {
  if (!plan) return null;
  const imp = impuestosDe(productoId ?? productoDelPlan(plan.id));
  return { cargos: plan.cargos, ivaPct: imp.calculaIva ? imp.ivaPct : 0 };
}

export function cargoNuevo(): CargoPeriodico {
  return {
    id: `cg-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    nombre: "",
    servicioId: null,
    tipo: "MONTO_FIJO",
    valor: 0,
    conIva: false,
  };
}

// Los planes guardados antes tenían un único cargo administrativo (`cargoAdministrativo`, y antes
// `cargoAdministrativoPct`): pasa a ser el primer cargo de la lista, con IVA incluido para no
// cambiar la cuota.
export function normalizarCargos(
  c: Partial<PlanCuotas> & {
    cargoAdministrativo?: { tipo: "PORCENTAJE" | "MONTO_FIJO"; valor: number };
    cargoAdministrativoPct?: number;
  }
): CargoPeriodico[] {
  if (c.cargos) return c.cargos;
  const previo =
    c.cargoAdministrativo ?? { tipo: "PORCENTAJE" as const, valor: c.cargoAdministrativoPct ?? 0 };
  if (!(previo.valor > 0)) return [];
  return [
    {
      id: "cg-administrativo",
      nombre: "Cargo administrativo / cobranza",
      servicioId: "srv-cargo-administrativo",
      tipo: previo.tipo === "PORCENTAJE" ? "PORCENTAJE_CUOTA" : "MONTO_FIJO",
      valor: previo.valor,
      conIva: true,
    },
  ];
}

// Capital máximo por rango de sueldo neto del cliente. `hasta: null` es un rango sin tope.
export const MAX_RANGOS_SUELDO = 6;

export interface RangoSueldoCapital {
  id: string;
  desde: number;
  hasta: number | null;
  capitalMaximo: number;
}

// Recortes porcentuales del plan sobre el capital. BCRA y buró interno recortan sólo a las
// situaciones elegidas (que tienen que estar habilitadas en el plan). `sueldoRecalculadoPct`
// recorta cuando el sueldo se recalcula para la oferta.
export interface LimitantesPlan {
  bcra: { situaciones: number[]; pct: number };
  buroInterno: { perfiles: number[]; pct: number };
  sueldoRecalculadoPct: number;
}

// Los planes guardados tenían un único recorte "situación BCRA distinta de 1": pasa a las
// situaciones 2 a 5 que el plan habilita.
// Los recortes por tipo de cliente y por condición laboral se eliminaron: se descartan.
export function normalizarLimitantes(
  l: Partial<LimitantesPlan> & { situacionBcraDistintaDeUnoPct?: number },
  situacionesBcraPlan: number[]
): LimitantesPlan {
  const { situacionBcraDistintaDeUnoPct } = l;
  return {
    bcra: l.bcra ?? {
      situaciones: [2, 3, 4, 5].filter((n) => situacionesBcraPlan.includes(n)),
      pct: situacionBcraDistintaDeUnoPct ?? 0,
    },
    buroInterno: l.buroInterno ?? { perfiles: [], pct: 0 },
    sueldoRecalculadoPct: l.sueldoRecalculadoPct ?? 0,
  };
}

// Cuota máxima por rango de sueldo neto: en cada rango rigen su mínimo de bolsillo (SMVM), su RCI
// (% del ingreso neto) y su tope de cuota en monto. `hasta: null` es un rango sin tope.
export interface RangoSueldoCuota {
  id: string;
  desde: number;
  hasta: number | null;
  smvmBolsillo: number;
  rciPct: number;
  cuotaMaxima: number;
}

// Sueldo neto desde / hasta de los 5 rangos con que arranca un plan (el último, sin tope).
const RANGOS_CUOTA_INICIALES: [number, number | null][] = [
  [0, 500_000],
  [500_000, 1_000_000],
  [1_000_000, 2_000_000],
  [2_000_000, 4_000_000],
  [4_000_000, null],
];

export function rangosCuotaIniciales(rciPct: number, smvmBolsillo: number): RangoSueldoCuota[] {
  return RANGOS_CUOTA_INICIALES.map(([desde, hasta], i) => ({
    id: `rc-${i + 1}`,
    desde,
    hasta,
    smvmBolsillo,
    rciPct,
    cuotaMaxima: Math.round(((hasta ?? 6_000_000) * rciPct) / 100 / 1000) * 1000,
  }));
}

// Condiciones que activan una campaña de bonificación (la primera es la habitual).
export const CONDICIONES_BONIFICACION = [
  { value: "PAGO_AL_DIA", label: "Paga al día" },
  { value: "CLIENTE_EXISTENTE", label: "Cliente existente" },
  { value: "PRIMER_CREDITO", label: "Primer crédito" },
  { value: "SIN_MORA_12M", label: "Sin mora en los últimos 12 meses" },
] as const;

export type CondicionBonificacion = (typeof CONDICIONES_BONIFICACION)[number]["value"];

// Campaña de bonificación de cuotas: si se cumple la condición (ej. paga al día), se bonifican
// las últimas `cuotasBonificadas` cuotas del plan.
export interface BonificacionPlan {
  id: string;
  nombre: string;
  cuotasBonificadas: number;
  condicion: CondicionBonificacion;
}

// Hasta qué monto autoriza cada rol; por encima interviene el siguiente.
export interface TopesAutorizacion {
  montoAnalista: number;
  montoSupervisor: number;
}

export interface PlanCuotas {
  id: string;
  nombre: string;
  // El plan nace en borrador y se ofrece recién cuando se lo activa.
  estado: EstadoProductoAbm;
  // Vigencia comercial (dd/mm/aaaa).
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  // Orden de evaluación dentro del organismo: gana el primero que habilita al cliente.
  prioridad: number;
  // Condiciones generales
  sistema: SistemaAmortizacion;
  periodoGraciaDias: number;
  gastoOtorgamiento: GastoOtorgamiento;
  // Cargos periódicos (administrativo, cobranza, servicios): incluidos en la cuota.
  cargos: CargoPeriodico[];
  // Habilitación: para qué perfiles puede usarse el plan.
  situacionesBcra: number[];
  condicionesLaborales: string[];
  perfilesInternos: number[];
  // Capital máximo según el sueldo neto (hasta MAX_RANGOS_SUELDO). Vacío: el plan no limita el capital.
  rangosSueldoNeto: RangoSueldoCapital[];
  // Cuota máxima: compiten estas tres reglas y gana la menor.
  // Cuota máxima por rango de sueldo neto (SMVM, RCI y tope de cuota de cada rango).
  rangosCuota: RangoSueldoCuota[];
  // Nivel de endeudamiento: limitante aparte, sobre el ingreso bruto.
  endeudamientoMaxPct: number;
  // Recortes porcentuales sobre el capital ya calculado (02:48). Si aplican varios, manda el
  // mayor. 0 significa que la condición no recorta nada.
  limitantes: LimitantesPlan;
  bonificaciones: BonificacionPlan[];
  topes: TopesAutorizacion;
  grilla: FilaGrilla[];
  capitalGrilla: RangoCapitalGrilla;
}

function semillaAPlan(p: PlanSemilla, i: number): PlanCuotas {
  return {
    id: p.id,
    nombre: p.nombre,
    estado: "ACTIVO",
    vigenciaDesde: "01/01/2026",
    vigenciaHasta: null,
    prioridad: 1,
    sistema: "FRANCES_FIJA",
    periodoGraciaDias: p.periodoGraciaDias,
    gastoOtorgamiento: {
      tipo: "PORCENTAJE",
      valor: p.cargoOtorgamientoPct,
      tratamiento: "DISTRIBUYE_CUOTAS",
    },
    cargos: [],
    // Hoy la situación BCRA y el perfil interno no bloquean el plan: sólo recortan capital.
    situacionesBcra: [1, 2, 3, 4, 5],
    condicionesLaborales: [...p.condicionesLaborales],
    perfilesInternos: [1, 2, 3, 4, 5],
    rangosSueldoNeto: [],
    rangosCuota: rangosCuotaIniciales(p.rciMaxPct, p.smvmBolsillo),
    endeudamientoMaxPct: p.endeudamientoMaxPct,
    limitantes: normalizarLimitantes(structuredClone(p.limitantes), [1, 2, 3, 4, 5]),
    bonificaciones:
      i === 0
        ? [
            {
              id: "bonif-1",
              nombre: "Campaña pago al día",
              cuotasBonificadas: 3,
              condicion: "PAGO_AL_DIA",
            },
          ]
        : [],
    topes: { montoAnalista: 1_500_000, montoSupervisor: 3_000_000 },
    grilla: GRILLA_BASE.filter((f) => p.plazos.includes(f.plazo)).map((f) => ({ ...f })),
    capitalGrilla: { ...RANGO_CAPITAL_GRILLA_BASE },
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
  // Una pantalla habilitada es obligatoria: ya no se configura aparte (creditonet-117).
  visible: boolean;
}

export interface CantidadConfig {
  minimo: number;
  maximo: number;
}

export interface DocumentoConfig {
  // Tipo de documento definido en Parámetros.
  tipoId: string;
  // Sólo en los ítems creados a mano desde el legajo del producto (los del catálogo no los llevan).
  nombre?: string;
  categoria?: string;
  obligatorio: boolean;
  // Cantidad de imágenes: el mínimo sólo se exige si el documento es obligatorio (al menos 1);
  // el máximo (≥ 1, ≥ mínimo) limita cuántas se pueden adjuntar.
  minimo: number;
  maximo: number;
}

// Cantidad mínima que se exige de un documento: 0 si es opcional, al menos 1 si es obligatorio.
export function minimoDocumento(d: DocumentoConfig): number {
  return d.obligatorio ? Math.max(d.minimo, 1) : 0;
}

// Un proveedor de tokenización con la cantidad de tarjetas que se piden con él. El bloque se
// repite para pedir mínimos por proveedor que coexisten (ej. mín. 1 de A y mín. 2 de B).
export interface BloqueTokenizacion {
  proveedorId: string;
  minimo: number;
  maximo: number;
}

export type TipoTarjeta = "DEBITO" | "CREDITO" | "PRECARGABLE";

export const TIPOS_TARJETA: { value: TipoTarjeta; label: string }[] = [
  { value: "DEBITO", label: "Débito" },
  { value: "CREDITO", label: "Crédito" },
  { value: "PRECARGABLE", label: "Precargable" },
];

export const tiposTarjetaDe = (t: { tiposTarjeta?: TipoTarjeta[]; tipoTarjeta?: TipoTarjeta }): TipoTarjeta[] =>
  t.tiposTarjeta && t.tiposTarjeta.length > 0 ? t.tiposTarjeta : [t.tipoTarjeta ?? "DEBITO"];

export interface TokenizacionConfig {
  proveedores: BloqueTokenizacion[];
  // Tipos de tarjeta que se pueden tokenizar (uno o más). Sin definir: débito.
  tiposTarjeta?: TipoTarjeta[];
  // Formato anterior (un solo tipo): se lee como lista de uno.
  tipoTarjeta?: TipoTarjeta;
  // false: el código de seguridad deja de ser obligatorio. Sin definir: se pide.
  pedirCodigoSeguridad?: boolean;
  // false: la tokenización es opcional (el cliente puede seguir sin tarjeta y los mínimos no se
  // exigen). Sin definir: obligatoria. Sólo aplica si la pantalla de tokenización está habilitada.
  obligatoria?: boolean;
}

// Mínimo de tarjetas que se exige de un bloque: 0 si la tokenización es opcional.
export function minimoTokenizacion(t: TokenizacionConfig, b: BloqueTokenizacion): number {
  return t.obligatoria === false ? 0 : b.minimo;
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
  tokenizacion: TokenizacionConfig;
  documentos: DocumentoConfig[];
}

// El organismo puede habilitar/deshabilitar una pantalla y cambiarla de lugar.
export type CambiosPantalla = Partial<Record<PantallaPostOfertaId, { visible?: boolean; orden?: number }>>;

// Onboarding §3: las 7 pantallas disponibles, en el orden de la documentación.
const PANTALLAS_BASE: PantallaPostOfertaConfig[] = [
  {
    id: "personales",
    label: "Datos personales",
    descripcion: "Identificación, domicilio particular y contacto.",
    orden: 1,
    visible: true,
  },
  {
    id: "laboral",
    label: "Datos laborales",
    descripcion: "Empleador, domicilio y teléfono laboral.",
    orden: 2,
    visible: true,
  },
  {
    id: "tokenizacion",
    label: "Tokenización de tarjetas",
    descripcion: "Una o varias tarjetas, por link de WhatsApp o carga presencial.",
    orden: 3,
    visible: true,
  },
  {
    id: "referencias",
    label: "Referencias personales",
    descripcion: "Una o varias referencias con DNI autocompletable.",
    orden: 4,
    visible: true,
  },
  {
    id: "garantias",
    label: "Garantías",
    descripcion: "Uno o varios garantes que firman el préstamo y el pagaré.",
    orden: 5,
    visible: true,
  },
  {
    id: "legajo",
    label: "Legajo virtual",
    descripcion: "Documentos definidos en Parámetros.",
    orden: 6,
    visible: true,
  },
  {
    id: "impresion",
    label: "Impresión de legajo",
    descripcion: "Imprimir o visualizar el PDF completo del legajo.",
    orden: 7,
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
// El producto nace en borrador y se ofrece recién cuando se lo activa.
export type EstadoProductoAbm = EstadoProducto | "BORRADOR";

// Motor §9: qué motor (grupo de reglas) corresponde según el cliente. La asignación es una tabla
// de combinaciones: cada fila fija, de forma opcional, el tipo de cliente, la condición laboral, la
// situación BCRA y la situación en buró interno, y el grupo de reglas que rige cuando el cliente
// cumple todo lo que la fila fija. Lo que la fila deja vacío ("cualquiera") no se mira. Si aplican
// varias filas gana la más específica (la que fija más datos); a igual especificidad, la primera.
// Sin ninguna fila aplicable rige el motor general. Las situaciones son "1".."5".
export interface CombinacionMotor {
  id: string;
  tipoCliente: TipoCliente | "";
  condicion: string;
  bcra: string;
  interna: string;
  motor: string;
}

export interface AsignacionMotor {
  motorId: string | null;
  combinaciones: CombinacionMotor[];
}

export function asignacionMotorVacia(motorId: string | null = null): AsignacionMotor {
  return { motorId, combinaciones: [] };
}

// Dos filas con la misma clave son la misma combinación.
export const claveCombinacion = (c: Pick<CombinacionMotor, "tipoCliente" | "condicion" | "bcra" | "interna">) =>
  [c.tipoCliente, c.condicion, c.bcra, c.interna].join("|");

export function textoCombinacion(c: Pick<CombinacionMotor, "tipoCliente" | "condicion" | "bcra" | "interna">): string {
  const partes = [
    c.tipoCliente === "NUEVO" ? "cliente nuevo" : c.tipoCliente === "EXISTENTE" ? "cliente existente" : "",
    c.condicion,
    c.bcra ? `BCRA ${c.bcra}` : "",
    c.interna ? `buró interno ${c.interna}` : "",
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : "cualquier cliente";
}

// Formatos guardados antes de la tabla de combinaciones.
interface AsignacionAnterior {
  distingueTipoCliente?: boolean;
  porTipoCliente?: Partial<Record<TipoCliente, string | null>>;
  porCondicionLaboral?: Record<string, string>;
  porSituacionBcra?: Record<string, string>;
  porSituacionInterna?: Record<string, string>;
  // Versión intermedia: una fila por condición con el motor del cliente nuevo y el del existente.
  combinaciones?: { id: string; condicion: string; nuevo?: string; existente?: string; motor?: string }[];
}

// Devuelve la asignación en formato de combinaciones; las anteriores se convierten conservando
// su prioridad (tipo de cliente → condición → BCRA → buró interno) como orden de las filas.
export function normalizarAsignacion(a: AsignacionMotor): AsignacionMotor {
  const v = a as unknown as AsignacionAnterior;
  if (Array.isArray(v.combinaciones) && v.combinaciones.every((c) => "motor" in c) && !("porSituacionBcra" in v))
    return a;
  const filas: CombinacionMotor[] = [];
  const fila = (id: string, parte: Partial<CombinacionMotor>, motor: string | null | undefined) => {
    if (motor) filas.push({ id, tipoCliente: "", condicion: "", bcra: "", interna: "", ...parte, motor });
  };
  if (v.distingueTipoCliente) {
    fila("mig-nuevo", { tipoCliente: "NUEVO" }, v.porTipoCliente?.NUEVO);
    fila("mig-existente", { tipoCliente: "EXISTENTE" }, v.porTipoCliente?.EXISTENTE);
  }
  for (const c of v.combinaciones ?? []) {
    const condicion = c.condicion === "*" ? "" : c.condicion;
    fila(`${c.id}-n`, { tipoCliente: "NUEVO", condicion }, c.nuevo);
    fila(`${c.id}-e`, { tipoCliente: "EXISTENTE", condicion }, c.existente);
  }
  for (const [condicion, id] of Object.entries(v.porCondicionLaboral ?? {})) fila(`mig-c-${condicion}`, { condicion }, id);
  for (const [n, id] of Object.entries(v.porSituacionBcra ?? {})) fila(`mig-b-${n}`, { bcra: n }, id);
  for (const [n, id] of Object.entries(v.porSituacionInterna ?? {})) fila(`mig-i-${n}`, { interna: n }, id);
  return { motorId: a.motorId ?? null, combinaciones: filas };
}

// Cada fila necesita su grupo de reglas y no puede repetirse la misma combinación.
export function errorAsignacionMotor(a: AsignacionMotor | null | undefined): string | undefined {
  if (!a) return undefined;
  const filas = normalizarAsignacion(a).combinaciones;
  if (filas.some((c) => !c.motor)) return "Hay combinaciones sin grupo de reglas: completalas o eliminalas.";
  const vistas = new Set<string>();
  for (const c of filas) {
    const k = claveCombinacion(c);
    if (vistas.has(k)) return `La combinación “${textoCombinacion(c)}” está repetida: dejá una sola.`;
    vistas.add(k);
  }
  return undefined;
}

export function motorAsignado(
  asignacion: AsignacionMotor,
  condicionLaboral: string,
  tipoCliente: TipoCliente | null,
  situaciones: { bcra: number; interna: number } | null = null
): string | null {
  const aplica = (c: CombinacionMotor) =>
    (!c.tipoCliente || c.tipoCliente === tipoCliente) &&
    (!c.condicion || c.condicion === condicionLaboral) &&
    (!c.bcra || (situaciones !== null && c.bcra === String(situaciones.bcra))) &&
    (!c.interna || (situaciones !== null && c.interna === String(situaciones.interna)));
  const fijados = (c: CombinacionMotor) => [c.tipoCliente, c.condicion, c.bcra, c.interna].filter(Boolean).length;
  let mejor: CombinacionMotor | null = null;
  for (const c of normalizarAsignacion(asignacion).combinaciones)
    if (c.motor && aplica(c) && (!mejor || fijados(c) > fijados(mejor))) mejor = c;
  return mejor?.motor ?? asignacion.motorId ?? null;
}

export interface ProductoConfig {
  id: string;
  nombre: string;
  estado: EstadoProductoAbm;
  // Vigencia comercial (dd/mm/aaaa). Fuera de este rango el producto no se ofrece.
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  // Motor de riesgo del producto (Producto §6). El organismo puede pisar esta asignación.
  motor: AsignacionMotor;
  permiteDeudaTerceros: boolean;
  // Premisa general del producto (Producto §4): tope de capital antes de aplicar
  // los límites del riesgo, del plan y del salario. null: el producto no tiene capital máximo.
  capitalMaximo: number | null;
  // Canales en los que se ofrece el producto (Producto §3).
  canales: string[];
  onboarding: OnboardingConfig;
  // IVA y sellos de la operación (antes en el plan de cuotas). El IVA se suma a los cargos sin IVA.
  calculaIva: boolean;
  ivaPct: number;
  sellosPct: number;
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
    calculaIva: true,
    ivaPct: 21,
    sellosPct: 1.2,
    canales: ["sucursal", "digital"],
    onboarding: {
      pantallas: pantallas(),
      navegacion: "LIBRE",
      camposObligatorios: {},
      referencias: { minimo: 1, maximo: 2 },
      garantes: { minimo: 1, maximo: 2 },
      tokenizacion: { proveedores: [{ proveedorId: "proveedor-a", minimo: 1, maximo: 2 }] },
      documentos: [
        { tipoId: "dni-frente", obligatorio: true, minimo: 1, maximo: 1 },
        { tipoId: "dni-dorso", obligatorio: true, minimo: 1, maximo: 1 },
        { tipoId: "recibo-sueldo", obligatorio: true, minimo: 1, maximo: 2 },
        { tipoId: "comprobante-servicio", obligatorio: true, minimo: 1, maximo: 1 },
        { tipoId: "otros", obligatorio: false, minimo: 0, maximo: 5 },
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
    calculaIva: true,
    ivaPct: 21,
    sellosPct: 1.2,
    // Requiere presentar la sentencia y firmar la cesión de cobro en persona.
    canales: ["sucursal"],
    onboarding: {
      pantallas: pantallas({ tokenizacion: { visible: false } }),
      navegacion: "LIBRE",
      camposObligatorios: {},
      referencias: { minimo: 1, maximo: 2 },
      garantes: { minimo: 0, maximo: 0 },
      tokenizacion: { proveedores: [{ proveedorId: "proveedor-b", minimo: 0, maximo: 1 }] },
      documentos: [
        { tipoId: "dni-frente", obligatorio: true, minimo: 1, maximo: 1 },
        { tipoId: "dni-dorso", obligatorio: true, minimo: 1, maximo: 1 },
        { tipoId: "sentencia", obligatorio: true, minimo: 1, maximo: 3 },
        { tipoId: "comprobante-servicio", obligatorio: true, minimo: 1, maximo: 1 },
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
  // Lista propia de proveedores: reemplaza la del producto.
  tokenizacion?: TokenizacionConfig;
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
  // Producto que este organismo ofrece a su colectivo (uno solo; la lista queda por la relación
  // que se guarda del lado del producto).
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
  // Excepciones de extras (firma, chequeo, etc.) sólo para algunos productos del organismo.
  extrasPorProducto?: Record<string, Partial<ExtrasProducto>>;
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
    productos: ["prestamo-personal"],
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
    productos: ["prestamo-personal"],
    overrides: {
      // Referencias y garantías opcionales: mínimo cero (la pantalla habilitada igual es obligatoria).
      referencias: { minimo: 0 },
      garantes: { minimo: 0 },
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
    productos: ["prestamo-personal"],
    overrides: {
      permiteDeudaTerceros: false,
      capitalMaximo: 2_000_000,
      // Tokenización obligatoria: al menos una tarjeta, de un único proveedor.
      tokenizacion: { proveedores: [{ proveedorId: "proveedor-a", minimo: 1, maximo: 1 }] },
      // Un pasivo no tiene cargo ni legajo de empleado.
      camposObligatorios: { cargo: false, numeroLegajo: false },
      documentos: [
        { tipoId: "dni-frente", obligatorio: true, minimo: 1, maximo: 1 },
        { tipoId: "dni-dorso", obligatorio: true, minimo: 1, maximo: 1 },
        { tipoId: "recibo-haberes", obligatorio: true, minimo: 1, maximo: 1 },
        { tipoId: "comprobante-servicio", obligatorio: true, minimo: 1, maximo: 1 },
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
    productos: ["prestamo-personal"],
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
    productos: ["prestamo-personal"],
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
        extras: { ...o.extrasPorProducto?.[id] },
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
    tokenizacion: o.tokenizacion ?? base.tokenizacion,
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
  return {
    producto: cfg.producto.nombre,
    organismo: cfg.organismo.nombre,
    herencia:
      cfg.cantidadExcepciones === 0
        ? "Hereda 100 % del producto"
        : `${cfg.cantidadExcepciones} excepción${cfg.cantidadExcepciones === 1 ? "" : "es"} del organismo`,
    total: visibles.length,
    obligatorias: visibles.length,
    opcionales: 0,
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

// Segundo superior: el caso puede derivarse de un SUP a otro.
export const SESION_SUPERVISOR_2 = {
  nombre: "Laura Benítez",
  iniciales: "LB",
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
