import type {
  CreditApplication,
  CreditoActivo,
  Oferta,
  Plazo,
  RiskResultado,
  RiskRule,
} from "./types";
import { calcularEdad } from "./format";
import { getPlan, type PlanCuotas } from "./config";

// --- Parámetros de la oferta (Configuración DEMO / Regla simulada) ---

export const CAPITAL_MAXIMO_BASE = 2_500_000;
// Regla simulada: al renovar un crédito propio el motor lo excluye de la exposición y el
// plan emite un capital máximo mayor. Valor fijo para la demo.
export const CAPITAL_MAXIMO_CON_PRECANCELACION = 2_850_000;

export const EDAD_MINIMA = 18;
export const EDAD_MAXIMA = 75;

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
  { plazo: 36, tna: 72, recomendada: false, primeraCuota: "10/11/2026" },
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

// Regla en cascada (Guía §5.5):
// Acreditación neta = Capital solicitado − Σ cancelaciones propias − Σ cancelaciones terceros
export function netoAAcreditar(oferta: Oferta): number {
  return oferta.montoSolicitado - totalPrecancelaciones(oferta) - importeTerceros(oferta);
}

export function cancelacionesExcedenCapital(oferta: Oferta): boolean {
  return totalPrecancelaciones(oferta) + importeTerceros(oferta) > oferta.montoSolicitado;
}

export function ofertaExcedeMaximo(oferta: Oferta): boolean {
  return oferta.montoSolicitado > oferta.capitalMaximoActual;
}

export function cuotasAbonadasPct(c: CreditoActivo): number {
  return Math.round((c.cuotasAbonadas / c.cuotasOriginales) * 100);
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

// --- Motor de riesgo ("El Patovica"): filtro pasa / no pasa (Guía §4.1) ---

export interface FaseRiesgo {
  id: string;
  mensaje: string;
}

export const FASES_RIESGO: FaseRiesgo[] = [
  { id: "id", mensaje: "Generando ID de crédito…" },
  { id: "bcra", mensaje: "Consultando Vector BCRA…" },
  { id: "mora", mensaje: "Consultando mora interna…" },
  { id: "reglas", mensaje: "Aplicando reglas del motor…" },
];

export function evaluarReglas(app: CreditApplication): RiskRule[] {
  const edad = calcularEdad(app.cliente?.fechaNacimiento ?? "");
  const edadOk = edad !== null && edad >= EDAD_MINIMA && edad <= EDAD_MAXIMA;

  return [
    {
      id: "edad",
      codigo: "MR-01",
      nombre: "Edad dentro del rango permitido",
      detalle: "Calculada a partir de la fecha de nacimiento informada por la API.",
      valorEvaluado: edad !== null ? `${edad} años` : "Sin dato",
      condicion: `Entre ${EDAD_MINIMA} y ${EDAD_MAXIMA} años`,
      resultado: edadOk ? "CUMPLE" : "NO_CUMPLE",
    },
    {
      id: "bcra",
      codigo: "MR-02",
      nombre: "Vector BCRA",
      detalle: "Situación del cliente en la Central de Deudores del BCRA (simulada).",
      valorEvaluado: "Situación 1 · sin deudas reportadas",
      condicion: "Situación 1 o 2",
      resultado: "CUMPLE",
    },
    {
      id: "mora",
      codigo: "MR-03",
      nombre: "Vector de mora interna",
      detalle: "Historial de cumplimiento con la financiera.",
      valorEvaluado: "0 días de atraso · CR-000102 al día",
      condicion: "Hasta 30 días de atraso",
      resultado: "CUMPLE",
    },
    {
      id: "carencia",
      codigo: "MR-04",
      nombre: "Sin trámite activo ni carencia vigente",
      detalle: "Sin otra solicitud en curso ni rechazos del motor en los últimos 30 días.",
      valorEvaluado: "0 solicitudes activas · sin rechazos",
      condicion: "Sin carencia vigente",
      resultado: "CUMPLE",
    },
  ];
}

export function resolverResultado(reglas: RiskRule[]): RiskResultado {
  if (reglas.some((r) => r.resultado === "NO_CUMPLE")) return "RECHAZADO";
  if (reglas.some((r) => r.resultado === "ADVERTENCIA")) return "VERIFICACION_MANUAL";
  return "APROBADO";
}

export const RESULTADO_LABEL: Record<RiskResultado, string> = {
  APROBADO: "Aprobado",
  VERIFICACION_MANUAL: "Requiere verificación manual",
  RECHAZADO: "Rechazado",
};

export const OUTCOME_LABEL: Record<RiskRule["resultado"], string> = {
  CUMPLE: "Cumple",
  ADVERTENCIA: "Advertencia",
  NO_CUMPLE: "No cumple",
};

// --- Plan de cuotas / Línea: validación financiera (Guía §2.3, §4.3) ---

export interface EvaluacionPlan {
  plan: PlanCuotas;
  ingresoNeto: number;
  cuotaPlan: number;
  cuotaMaximaRci: number;
  rciPct: number;
  cuotasVigentes: number;
  endeudamientoPct: number;
  ingresoBolsillo: number;
  cumpleRci: boolean;
  cumpleEndeudamiento: boolean;
  cumpleSmvm: boolean;
  capitalMaximo: number;
}

export function evaluarPlan(app: CreditApplication): EvaluacionPlan {
  const plan = getPlan(app.configuracion.organismoId);
  const o = app.oferta;
  const neto = app.laboral.ingresoNeto;
  // Los créditos marcados para renovar no cuentan en la exposición (Guía §5.3).
  const cuotasVigentes = o.creditosActivos
    .filter((c) => !c.precancelar)
    .reduce((s, c) => s + c.valorCuota, 0);
  const pct = (v: number) => (neto > 0 ? Math.round((v / neto) * 1000) / 10 : 0);
  const rciPct = pct(o.valorCuota);
  const endeudamientoPct = pct(o.valorCuota + cuotasVigentes);
  const ingresoBolsillo = neto - o.valorCuota - cuotasVigentes;
  return {
    plan,
    ingresoNeto: neto,
    cuotaPlan: o.valorCuota,
    cuotaMaximaRci: Math.round((neto * plan.rciMaxPct) / 100),
    rciPct,
    cuotasVigentes,
    endeudamientoPct,
    ingresoBolsillo,
    cumpleRci: rciPct <= plan.rciMaxPct,
    cumpleEndeudamiento: endeudamientoPct <= plan.endeudamientoMaxPct,
    cumpleSmvm: ingresoBolsillo >= plan.smvmBolsillo,
    capitalMaximo: o.capitalMaximoActual,
  };
}
