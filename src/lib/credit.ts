import type {
  CreditApplication,
  Oferta,
  Plazo,
  RiskResultado,
  RiskRule,
} from "./types";
import { formatARS } from "./format";

// --- Parámetros del motor (Configuración DEMO / Regla simulada) ---

export const CAPITAL_MAXIMO_BASE = 2_500_000;
// Regla simulada: si la precancelación libera capacidad, el motor recalcula un
// capital máximo mayor. Valor fijo para la demo.
export const CAPITAL_MAXIMO_CON_PRECANCELACION = 2_850_000;

export const INGRESO_MINIMO = 750_000;

export interface OfferTerm {
  plazo: Plazo;
  tna: number;
  recomendada: boolean;
  // Regla simulada: el formato/fecha de la primera cuota es una decisión pendiente.
  primeraCuota: string;
}

export const OFFER_TERMS: OfferTerm[] = [
  { plazo: 12, tna: 58, recomendada: true, primeraCuota: "10/10/2026" },
  { plazo: 18, tna: 63, recomendada: false, primeraCuota: "25/10/2026" },
  { plazo: 24, tna: 67, recomendada: false, primeraCuota: "10/11/2026" },
];

export function getTerm(plazo: Plazo): OfferTerm {
  return OFFER_TERMS.find((t) => t.plazo === plazo) ?? OFFER_TERMS[0];
}

// Sistema francés, cuota fija. Se redondea a $100.
export function calcularCuota(monto: number, plazo: number, tna: number): number {
  if (monto <= 0 || plazo <= 0) return 0;
  const i = tna / 100 / 12;
  const factor = Math.pow(1 + i, plazo);
  const cuota = (monto * i * factor) / (factor - 1);
  return Math.round(cuota / 100) * 100;
}

export function hayPrecancelacion(oferta: Oferta): boolean {
  return oferta.creditosActivos.some((c) => c.precancelar);
}

export function totalPrecancelaciones(oferta: Oferta): number {
  return oferta.creditosActivos
    .filter((c) => c.precancelar)
    .reduce((s, c) => s + c.montoCancelacion, 0);
}

export function importeTerceros(oferta: Oferta): number {
  return oferta.deudaTerceros.habilitado ? oferta.deudaTerceros.importe : 0;
}

export function netoAAcreditar(oferta: Oferta): number {
  return oferta.montoSolicitado - totalPrecancelaciones(oferta) - importeTerceros(oferta);
}

export function ofertaExcedeMaximo(oferta: Oferta): boolean {
  return oferta.montoSolicitado > oferta.capitalMaximoActual;
}

// Recalcula todos los derivados de la oferta a partir de sus entradas.
export function recalcularOferta(oferta: Oferta): Oferta {
  const term = getTerm(oferta.plazo);
  const capitalMaximoActual = hayPrecancelacion(oferta)
    ? CAPITAL_MAXIMO_CON_PRECANCELACION
    : oferta.capitalMaximoBase;
  const valorCuota = calcularCuota(oferta.montoSolicitado, oferta.plazo, term.tna);
  return {
    ...oferta,
    capitalMaximoActual,
    tna: term.tna,
    valorCuota,
    totalAPagar: valorCuota * oferta.plazo,
    primeraCuotaVencimiento: term.primeraCuota,
  };
}

// --- Motor de riesgo ---

export interface FaseRiesgo {
  id: string;
  mensaje: string;
}

export const FASES_RIESGO: FaseRiesgo[] = [
  { id: "analizar", mensaje: "Analizando la solicitud…" },
  { id: "crediticia", mensaje: "Consultando información crediticia…" },
  { id: "reglas", mensaje: "Aplicando reglas…" },
  { id: "condiciones", mensaje: "Generando condiciones de oferta…" },
];

export function evaluarReglas(app: CreditApplication): RiskRule[] {
  const neto = app.laboral.ingresoNeto;
  const cumpleIngreso = neto >= INGRESO_MINIMO;
  const nombreCliente = app.cliente
    ? `${app.cliente.nombre} ${app.cliente.apellido}`
    : "Cliente identificado";

  return [
    {
      id: "identificacion",
      nombre: "Identificación validada",
      detalle: "Identidad confirmada contra la fuente pública y la imagen archivada.",
      valorEvaluado: nombreCliente,
      condicion: "Identidad verificada",
      resultado: app.identidadVerificada ? "CUMPLE" : "ADVERTENCIA",
    },
    {
      id: "duplicado",
      nombre: "Cliente sin trámite duplicado",
      detalle: "No existe otra solicitud de crédito en curso para este cliente.",
      valorEvaluado: "0 solicitudes activas",
      condicion: "0 solicitudes activas",
      resultado: "CUMPLE",
    },
    {
      id: "ingreso",
      nombre: "Ingreso mínimo cumplido",
      detalle: "El ingreso neto declarado supera el piso definido para el organismo.",
      valorEvaluado: formatARS(neto),
      condicion: `Mínimo ${formatARS(INGRESO_MINIMO)}`,
      resultado: cumpleIngreso ? "CUMPLE" : "NO_CUMPLE",
    },
    {
      id: "bcra",
      nombre: "Situación BCRA dentro de parámetros",
      detalle: "Situación crediticia informada por el BCRA (simulada).",
      valorEvaluado: "Situación 1 · sin deudas reportadas",
      condicion: "Situación 1 o 2",
      resultado: "CUMPLE",
    },
    {
      id: "comportamiento",
      nombre: "Comportamiento interno favorable",
      detalle: "Score de comportamiento en créditos anteriores de CreditoNet.",
      valorEvaluado: "Score 82 / 100",
      condicion: "Score ≥ 60",
      resultado: "CUMPLE",
    },
    {
      id: "mora",
      nombre: "Días de mora dentro del límite",
      detalle: "Mora máxima admitida en créditos vigentes del cliente.",
      valorEvaluado: "0 días",
      condicion: "≤ 30 días",
      resultado: "CUMPLE",
    },
    {
      id: "historial",
      nombre: "Historial de pagos compatible",
      detalle: "Antigüedad del último pago registrado en créditos internos.",
      valorEvaluado: "Último pago hace 25 días",
      condicion: "≤ 60 días",
      resultado: "CUMPLE",
    },
  ];
}

export function resolverResultado(reglas: RiskRule[]): RiskResultado {
  if (reglas.some((r) => r.resultado === "NO_CUMPLE")) return "RECHAZAR";
  if (reglas.some((r) => r.resultado === "ADVERTENCIA")) return "PASAR_A_ANALISTA";
  return "GENERAR_OFERTA";
}

export const RESULTADO_LABEL: Record<RiskResultado, string> = {
  GENERAR_OFERTA: "Generar oferta",
  PASAR_A_ANALISTA: "Pasar a analista",
  RECHAZAR: "Rechazar solicitud",
};

export const OUTCOME_LABEL: Record<RiskRule["resultado"], string> = {
  CUMPLE: "Cumple",
  ADVERTENCIA: "Advertencia",
  NO_CUMPLE: "No cumple",
};
