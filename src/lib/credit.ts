import type {
  CambioOfertaRegistro,
  CreditApplication,
  CreditoActivo,
  LimitanteOferta,
  LimiteCapital,
  LimiteCuota,
  Oferta,
  Observacion,
  OfertaAnalista,
  Plazo,
  ResultadoLimites,
  RiskResultado,
} from "./types";
import {
  GRILLA_BASE,
  PLANES_CUOTAS,
  SESION_ANALISTA,
  configEfectiva,
  planesDelOrganismo,
  type FilaGrilla,
  type PlanCuotas,
  type SistemaAmortizacion,
} from "./config";
import { formatARS } from "./format";
import type { CondicionRenovacion, ExtrasProducto } from "./productos";

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

// Fila de la grilla de tasas. Cada plan tiene la suya; ésta es la grilla base, que se usa
// mientras la solicitud todavía no tiene plan (antes de la evaluación).
export type OfferTerm = FilaGrilla;

export const OFFER_TERMS: OfferTerm[] = GRILLA_BASE;

// Oferta que dejó el analista y el vendedor tiene que resolver (aceptar o reducir). Una
// solicitud observada por un cambio de oferta anterior a este campo se reconstruye desde la
// observación y la oferta vigente.
export function ofertaAnalistaDe(app: CreditApplication): OfertaAnalista | null {
  if (app.estado !== "OBSERVADO") return null;
  if (app.analista.ofertaAnalista) return app.analista.ofertaAnalista;
  const obs = app.analista.observacion;
  if (obs?.motivo !== "Cambio de oferta del analista") return null;
  return { montoSolicitado: app.oferta.montoSolicitado, plazo: app.oferta.plazo, nota: obs.nota };
}

// Cambios de oferta que el analista ya hizo. Los créditos de la DB simulada anteriores al
// registro se reconstruyen desde la observación / oferta que dejó el cambio.
export function cambiosOfertaDe(app: CreditApplication): CambioOfertaRegistro[] {
  const registrados = app.analista.historialCambiosOferta ?? [];
  if (registrados.length > 0) return registrados;
  const obs = app.analista.observacion;
  const ofertaAnalista = app.analista.ofertaAnalista ?? null;
  const tipo =
    obs?.motivo === "Cambio de oferta del analista"
      ? "OFERTA"
      : obs?.motivo === "Cambio de datos financieros del analista"
        ? "DATOS_FINANCIEROS"
        : ofertaAnalista
          ? "OFERTA"
          : null;
  if (tipo === null) return [];
  return [
    {
      tipo,
      fecha: obs?.fecha ?? "—",
      montoAnterior: null,
      plazoAnterior: null,
      montoNuevo: ofertaAnalista?.montoSolicitado ?? app.oferta.montoSolicitado,
      plazoNuevo: ofertaAnalista?.plazo ?? app.oferta.plazo,
      nota: ofertaAnalista?.nota ?? obs?.nota ?? "",
      autor: SESION_ANALISTA.nombre,
    },
  ];
}

// Cambios de oferta que el analista puede hacer por solicitud sin excepción. El siguiente
// requiere que lo autorice el supervisor (creditonet-78).
export const MAX_CAMBIOS_OFERTA = 2;

export function cambioOfertaPermitido(app: CreditApplication): boolean {
  const hechos = cambiosOfertaDe(app).length;
  return hechos < MAX_CAMBIOS_OFERTA || app.analista.excepcionCambioOferta?.n === hechos;
}

// Observaciones del analista, de la más vieja a la más nueva. Los créditos anteriores al
// historial sólo tienen la vigente.
export function observacionesDe(app: Pick<CreditApplication, "analista">): Observacion[] {
  const historial = app.analista.historialObservaciones ?? [];
  if (historial.length > 0) return historial;
  return app.analista.observacion ? [app.analista.observacion] : [];
}

// Estado con que la bandeja del vendedor muestra una solicitud devuelta por el analista: COFE
// (cambio de oferta) si la observación es un cambio de oferta, si la solicitud está esperando su
// confirmación o si el crédito ya tuvo uno y después recibió otra observación; si no, OBS. El
// motivo de la observación no es un estado: se lee en el detalle de la fila.
export function etiquetaObservado(app: CreditApplication): string | undefined {
  const sub = subestadoObservado(app);
  return sub ? SUBESTADO_OBSERVADO[sub].etiqueta : undefined;
}

// Subestados de un crédito devuelto al vendedor (creditonet-74): OBS es una observación pura,
// COFE viene de un cambio de oferta y OBS_COFE es una observación pura sobre un crédito que ya
// tuvo un cambio de oferta ("observado cofre").
export type SubestadoObservado = "OBS" | "COFE" | "OBS_COFE";

export const SUBESTADO_OBSERVADO: Record<SubestadoObservado, { etiqueta: string; origen: string }> = {
  OBS: { etiqueta: "OBS", origen: "Observación pura del analista" },
  COFE: { etiqueta: "COFE", origen: "Viene de un cambio de oferta" },
  OBS_COFE: {
    etiqueta: "OBS · COFE",
    origen: "Observación pura sobre un crédito con cambio de oferta previo",
  },
};

export function subestadoObservado(app: CreditApplication): SubestadoObservado | undefined {
  if (app.estado === "CAMBIO_OFERTA") return "COFE";
  if (app.estado !== "OBSERVADO") return undefined;
  const motivo = app.analista.observacion?.motivo;
  const esCambio =
    ofertaAnalistaDe(app) !== null ||
    motivo === "Cambio de oferta del analista" ||
    motivo === "Cambio de datos financieros del analista";
  if (esCambio) return "COFE";
  return cambiosOfertaDe(app).length > 0 ? "OBS_COFE" : "OBS";
}

// Grilla de un plan (o la base, si no hay plan).
export function grillaDe(plan?: PlanCuotas | null): OfferTerm[] {
  return plan && plan.grilla.length > 0 ? plan.grilla : OFFER_TERMS;
}

export function getTerm(plazo: Plazo, plan?: PlanCuotas | null): OfferTerm {
  const grilla = grillaDe(plan);
  return grilla.find((t) => t.plazo === plazo) ?? grilla[0];
}

// Plan de la solicitud: el que resultó de la evaluación (el primero, por prioridad, que
// habilita al cliente). Antes de evaluar, el primero del organismo como referencia.
export function planDeSolicitud(app: CreditApplication): PlanCuotas {
  const evaluado = app.riesgo.planId ? PLANES_CUOTAS[app.riesgo.planId] : undefined;
  return (
    evaluado ?? planesDelOrganismo(app.configuracion.organismoId)[0] ?? Object.values(PLANES_CUOTAS)[0]
  );
}

// Cuota mensual según el sistema de amortización del plan. Se redondea a $100.
// Francés: cuota fija. Americano: sólo interés y el capital se devuelve al final. Tasa directa:
// el interés se calcula sobre el capital original durante todo el plazo.
export function calcularCuota(
  monto: number,
  plazo: number,
  tna: number,
  sistema: SistemaAmortizacion = "FRANCES"
): number {
  if (monto <= 0 || plazo <= 0) return 0;
  const i = tna / 100 / 12;
  let cuota: number;
  if (sistema === "AMERICANO") cuota = monto * i;
  else if (sistema === "TASA_DIRECTA") cuota = (monto * (1 + (tna / 100) * (plazo / 12))) / plazo;
  else {
    const factor = Math.pow(1 + i, plazo);
    cuota = (monto * i * factor) / (factor - 1);
  }
  return Math.round(cuota / 100) * 100;
}

// Total a pagar: en el sistema americano la última cuota incluye el capital.
export function totalAPagarDe(
  monto: number,
  plazo: number,
  cuota: number,
  sistema: SistemaAmortizacion = "FRANCES"
): number {
  return sistema === "AMERICANO" ? cuota * plazo + monto : cuota * plazo;
}

// Inversa de la anterior: qué capital soporta una cuota máxima. Se trunca a $10.000.
export function capitalDesdeCuota(
  cuota: number,
  plazo: number,
  tna: number,
  sistema: SistemaAmortizacion = "FRANCES"
): number {
  if (cuota <= 0 || plazo <= 0) return 0;
  const i = tna / 100 / 12;
  let capital: number;
  if (sistema === "AMERICANO") capital = cuota / i;
  else if (sistema === "TASA_DIRECTA") capital = (cuota * plazo) / (1 + (tna / 100) * (plazo / 12));
  else {
    const factor = Math.pow(1 + i, plazo);
    capital = (cuota * (factor - 1)) / (i * factor);
  }
  return Math.floor(capital / 10_000) * 10_000;
}

// Un crédito en mora se cancela siempre: entra solo en la renovación y no se puede quitar.
export function seCancela(c: CreditoActivo): boolean {
  return c.precancelar || c.enMora === true;
}

// Deja marcados para cancelar los créditos en mora.
export function conMoraCancelada(creditos: CreditoActivo[]): CreditoActivo[] {
  return creditos.map((c) => (c.enMora && !c.precancelar ? { ...c, precancelar: true } : c));
}

export function hayPrecancelacion(oferta: Oferta): boolean {
  return oferta.creditosActivos.some(seCancela);
}

export function totalPrecancelaciones(oferta: Oferta): number {
  return oferta.creditosActivos.filter(seCancela).reduce((s, c) => s + c.montoCancelacion, 0);
}

export function importeTerceros(oferta: Oferta): number {
  return oferta.deudaTerceros.habilitado ? oferta.deudaTerceros.importe : 0;
}

// Regla en cascada (Guía §5.5):
// Saldo de acreditación = Capital solicitado − Σ cancelaciones propias − Σ cancelaciones terceros
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

// Condición mínima de renovación del producto (con las excepciones del organismo): la opción A
// exige un porcentaje del crédito pagado; la B, una cantidad de cuotas pagadas.
export interface RequisitoRenovacion {
  tipo: CondicionRenovacion;
  cumple: boolean;
  // Mínimo expresado en la unidad de la condición ("50 %" / "6 cuotas") y como % del crédito,
  // para ubicarlo sobre la barra de avance.
  texto: string;
  minimoPct: number;
}

export function requisitoRenovacion(
  c: CreditoActivo,
  extras: ExtrasProducto | null
): RequisitoRenovacion {
  if (extras?.condicionRenovacion === "CUOTAS") {
    const min = extras.renovacionMinCuotasPagas;
    return {
      tipo: "CUOTAS",
      cumple: c.cuotasAbonadas >= min,
      texto: `${min} ${min === 1 ? "cuota" : "cuotas"}`,
      minimoPct: Math.min(100, Math.round((min / c.cuotasOriginales) * 100)),
    };
  }
  const min = extras?.renovacionMinPctPagado ?? 50;
  return {
    tipo: "PORCENTAJE",
    cumple: cuotasAbonadasPct(c) >= min,
    texto: `${min} %`,
    minimoPct: min,
  };
}

// Recalcula todos los derivados de la oferta a partir de sus entradas.
export function recalcularOferta(entrada: Oferta): Oferta {
  const oferta = { ...entrada, creditosActivos: conMoraCancelada(entrada.creditosActivos) };
  // La TNA y el sistema salen del plan de la solicitud; sin plan, la grilla base y el francés.
  const plan = oferta.planId ? PLANES_CUOTAS[oferta.planId] : undefined;
  const term = getTerm(oferta.plazo, plan);
  const capitalMaximoActual = hayPrecancelacion(oferta)
    ? oferta.capitalMaximoRenovacion
    : oferta.capitalMaximoBase;
  const valorCuota = calcularCuota(oferta.montoSolicitado, oferta.plazo, term.tna, plan?.sistema);
  return {
    ...oferta,
    capitalMaximoActual,
    tna: term.tna,
    valorCuota,
    totalAPagar: totalAPagarDe(oferta.montoSolicitado, oferta.plazo, valorCuota, plan?.sistema),
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
  { conCancelaciones, plan: planElegido }: { conCancelaciones: boolean; plan?: PlanCuotas }
): ResultadoLimites {
  const cfg = configEfectiva(app.configuracion);
  // En la primera evaluación el plan todavía no está en la solicitud: se lo pasa quien lo eligió.
  const plan = planElegido ?? planDeSolicitud(app);
  const neto = app.laboral.ingresoNeto;
  const bruto = app.laboral.ingresoBruto;
  const term = getTerm(app.oferta.plazo, plan);

  // "Los dos palos se lo está dando sabiendo que este préstamo se va a cancelar"
  // (reunión 11/09, 44:00): la cuota de un crédito marcado para precancelar deja de pesar en
  // la exposición, así que libera capacidad y el capital máximo sube.
  const cancelado = (c: CreditoActivo) => conCancelaciones && seCancela(c);
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
      detalle: cfg.overrides.capitalMaximo
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
      monto: capitalDesdeCuota(cuotaMaxima, app.oferta.plazo, term.tna, plan.sistema),
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
  const plan = planDeSolicitud(app);
  const o = app.oferta;
  const neto = app.laboral.ingresoNeto;
  // Los créditos marcados para renovar no cuentan en la exposición (Guía §5.3).
  const cuotasVigentes = o.creditosActivos
    .filter((c) => !seCancela(c))
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
