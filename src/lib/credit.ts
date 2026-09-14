import type {
  CreditApplication,
  CreditoActivo,
  LimitanteOferta,
  LimiteCapital,
  LimiteCuota,
  Oferta,
  Plazo,
  ResultadoLimites,
  ResultadoRegla,
  RiskResultado,
} from "./types";
import { configEfectiva, getPlan, type PlanCuotas } from "./config";
import { formatARS } from "./format";

// --- Parámetros de la oferta (Configuración DEMO / Regla simulada) ---

export const CAPITAL_MAXIMO_BASE = 2_500_000;

// Condición universal, por encima de producto y organismo: exposición máxima por cliente
// (reunión 11/09, 02:40: "un cliente mío no puede endeudarse más de 5").
export const LIMITE_UNIVERSAL_CLIENTE = 5_000_000;
// Condición universal sobre el haber: tope en cantidad de sueldos brutos (02:46).
export const LIMITE_SUELDOS_BRUTOS = 3;
// Regla simulada: al renovar un crédito propio el motor lo excluye de la exposición y el
// plan emite un capital máximo mayor.
export const CAPITAL_MAXIMO_CON_PRECANCELACION = 2_850_000;

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

// Inversa de la anterior: qué capital soporta una cuota máxima. Se trunca a $10.000.
export function capitalDesdeCuota(cuota: number, plazo: number, tna: number): number {
  if (cuota <= 0 || plazo <= 0) return 0;
  const i = tna / 100 / 12;
  const factor = Math.pow(1 + i, plazo);
  const capital = (cuota * (factor - 1)) / (i * factor);
  return Math.floor(capital / 10_000) * 10_000;
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
    ? oferta.capitalMaximoRenovacion
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

// --- Fases visuales de la evaluación ---

export interface FaseRiesgo {
  id: string;
  mensaje: string;
}

export const FASES_RIESGO: FaseRiesgo[] = [
  { id: "id", mensaje: "Generando ID de crédito…" },
  { id: "institucionales", mensaje: "Evaluando las reglas institucionales…" },
  { id: "motor", mensaje: "Seleccionando el motor de riesgo correspondiente…" },
  { id: "bcra", mensaje: "Consultando BCRA y base interna…" },
  { id: "reglas", mensaje: "Aplicando las reglas del motor…" },
];

export const RESULTADO_LABEL: Record<RiskResultado, string> = {
  PASA: "Pasa",
  NO_PASA: "No pasa",
};

export const OUTCOME_LABEL: Record<ResultadoRegla | "ESPERANDO_DATOS", string> = {
  PASA: "Pasa",
  NO_PASA: "No pasa",
  ESPERANDO_DATOS: "Esperando datos",
};

// --- Límites de capital (Plan de Cuotas §3.3, §8 · Flujos Integrados §13) ---
//
// Pueden existir varios límites simultáneos. La lógica es tomar el más restrictivo:
// ese es el capital que continúa hacia el Plan de Cuotas.
//
// `conCancelaciones: false` da los límites de la PRIMERA oferta, que es anterior a la
// precancelación (Plan §9). Con `true` se descuentan los créditos marcados para precancelar
// y se obtiene el capital de la nueva oferta.

export function calcularLimites(
  app: CreditApplication,
  { conCancelaciones }: { conCancelaciones: boolean }
): ResultadoLimites {
  const cfg = configEfectiva(app.configuracion);
  const plan = cfg.plan;
  const neto = app.laboral.ingresoNeto;
  const bruto = app.laboral.ingresoBruto;
  const term = getTerm(app.oferta.plazo);

  // "Los dos palos se lo está dando sabiendo que este préstamo se va a cancelar"
  // (reunión 11/09, 44:00): la cuota de un crédito marcado para precancelar deja de pesar en
  // la exposición, así que libera capacidad y el capital máximo sube.
  const cancelado = (c: CreditoActivo) => conCancelaciones && c.precancelar;
  const renovando = app.oferta.creditosActivos.some(cancelado);
  const cuotasVigentes = app.oferta.creditosActivos
    .filter((c) => !cancelado(c))
    .reduce((s, c) => s + c.valorCuota, 0);
  const cuotasLiberadas = app.oferta.creditosActivos
    .filter(cancelado)
    .reduce((s, c) => s + c.valorCuota, 0);

  // --- Cuota máxima: compiten tres reglas y gana la menor (reunión 11/09, 02:47) ---
  const limitesCuota: LimiteCuota[] = [
    {
      id: "smvm",
      label: "SMVM de bolsillo",
      detalle: `Ingreso neto ${formatARS(neto)} menos el mínimo de bolsillo ${formatARS(plan.smvmBolsillo)}`,
      monto: Math.max(neto - plan.smvmBolsillo - cuotasVigentes, 0),
    },
    {
      id: "rci",
      label: "Relación cuota-ingreso",
      detalle: `${plan.rciMaxPct} % del ingreso neto`,
      monto: Math.round((neto * plan.rciMaxPct) / 100),
    },
    {
      id: "endeudamiento",
      label: "Nivel de endeudamiento",
      detalle: `${plan.endeudamientoMaxPct} % del bruto menos cuotas vigentes por ${formatARS(cuotasVigentes)}`,
      monto: Math.max(
        Math.round((bruto * plan.endeudamientoMaxPct) / 100) - cuotasVigentes,
        0
      ),
    },
  ];
  const menorCuota = limitesCuota.reduce((a, b) => (b.monto < a.monto ? b : a));
  const cuotaMaxima = menorCuota.monto;

  // --- Límites de capital: ninguno sale del motor (02:22, 02:24). Gana el menor. ---
  const limites: LimiteCapital[] = [
    {
      id: "universal",
      label: "Límite universal por cliente",
      detalle: "Exposición máxima de un cliente con la financiera",
      monto: LIMITE_UNIVERSAL_CLIENTE,
    },
    {
      id: "brutos",
      label: "Límite por sueldos brutos",
      detalle: `${LIMITE_SUELDOS_BRUTOS} sueldos brutos de ${formatARS(bruto)}`,
      monto: bruto * LIMITE_SUELDOS_BRUTOS,
    },
    {
      id: "producto",
      label: "Límite por producto",
      detalle: cfg.organismo.overrides.capitalMaximo
        ? `${cfg.producto.nombre} · excepción del organismo`
        : cfg.producto.nombre,
      monto: cfg.capitalMaximo,
    },
    {
      id: "plan",
      label: "Límite por plan de cuotas",
      detalle: renovando
        ? `${plan.nombre} · tope ampliado por renovación`
        : plan.nombre,
      monto: renovando ? plan.montoMaximoRenovacion : plan.montoMaximo,
    },
    {
      id: "cuota",
      label: "Límite por cuota máxima",
      detalle: `${menorCuota.label}: ${formatARS(cuotaMaxima)} en ${app.oferta.plazo} cuotas`,
      monto: capitalDesdeCuota(cuotaMaxima, app.oferta.plazo, term.tna),
    },
  ];
  const menor = limites.reduce((a, b) => (b.monto < a.monto ? b : a));
  const capitalPorLimites = menor.monto;

  // --- Limitantes de la oferta: recortes porcentuales sobre el capital ya calculado.
  // Si aplican varios, manda el mayor recorte (02:48-02:50). ---
  const lim = plan.limitantes;
  const esNuevo = app.identificacion.tipoCliente === "NUEVO";
  const condicion = app.laboral.condicionLaboral;
  const recorteCondicion = lim.condicionLaboralPct[condicion] ?? 0;
  const bcra = app.situaciones?.bcra ?? 1;

  const limitantes: LimitanteOferta[] = [
    {
      id: "tipo-cliente",
      label: esNuevo ? "Cliente nuevo" : "Cliente existente",
      detalle: esNuevo
        ? "Primera operación con la financiera"
        : "Con historial de cumplimiento: sin recorte",
      recortePct: esNuevo ? lim.clienteNuevoPct : lim.clienteExistentePct,
      aplica: true,
    },
    {
      id: "condicion-laboral",
      label: `Condición laboral: ${condicion || "sin declarar"}`,
      detalle: recorteCondicion > 0 ? "Condición con recorte configurado" : "Sin recorte",
      recortePct: recorteCondicion,
      aplica: recorteCondicion > 0,
    },
    {
      id: "situacion-bcra",
      label: `Situación BCRA ${bcra}`,
      detalle: bcra !== 1 ? "Situación distinta de 1" : "Situación 1: sin recorte",
      recortePct: bcra !== 1 ? lim.situacionBcraDistintaDeUnoPct : 0,
      aplica: bcra !== 1,
    },
  ];

  const recorteAplicadoPct = limitantes.reduce(
    (max, l) => (l.aplica && l.recortePct > max ? l.recortePct : max),
    0
  );
  const capitalConsiderado =
    Math.floor((capitalPorLimites * (100 - recorteAplicadoPct)) / 100 / 10_000) * 10_000;

  return {
    capitalSolicitado: app.oferta.montoSolicitado,
    cuotasVigentes,
    cuotasLiberadas,
    limites,
    limiteAplicadoId: menor.id,
    capitalPorLimites,
    limitantes,
    recorteAplicadoPct,
    capitalConsiderado,
    limitesCuota,
    limiteCuotaAplicadoId: menorCuota.id,
    cuotaMaxima,
  };
}

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
