// Reglas universales / institucionales (Motor de Riesgo v2 §6 y §11 · Arquitectura §6).
//
// Son políticas transversales al negocio: no pertenecen a un motor en particular y se
// evalúan en el momento en que están disponibles los datos que necesitan. Una regla
// bloqueante que no pasa descarta la solicitud antes de continuar.
//
// En la demo son datos fijos: no hay reglas persistidas ni configurables.

import type { CreditApplication, MomentoRegla, ReglaInstitucional, ResultadoRegla } from "./types";
import { configEfectiva } from "./config";
import { LIMITE_SUELDOS_BRUTOS } from "./credit";
import { calcularEdad, formatARS, formatPct } from "./format";
import { reglaBloquea } from "./motores";

const ORDEN_MOMENTO: Record<MomentoRegla, number> = { IDENTIFICACION: 1, EVALUACION: 2 };

export const MOMENTO_LABEL: Record<MomentoRegla, string> = {
  IDENTIFICACION: "Se evalúa al identificar al cliente",
  EVALUACION: "Se evalúa al solicitar, con los datos mínimos confirmados",
};

export const EDAD_MAXIMA_FEMENINO = 65;
export const ENDEUDAMIENTO_MAXIMO_PCT = 50;

/**
 * Evalúa las reglas institucionales hasta el momento indicado.
 *
 * Una regla de un momento posterior queda ESPERANDO_DATOS aunque alguna variable ya esté
 * precargada: RI-02 depende del ingreso neto confirmado en los datos mínimos, y un cliente
 * existente lo trae de la base interna antes de confirmarlo.
 */
export function evaluarInstitucionales(
  app: CreditApplication,
  momento: MomentoRegla
): ReglaInstitucional[] {
  const alcanzado = (m: MomentoRegla) => ORDEN_MOMENTO[m] <= ORDEN_MOMENTO[momento];
  const resultado = (listo: boolean, pasa: boolean): ResultadoRegla | "ESPERANDO_DATOS" =>
    !listo ? "ESPERANDO_DATOS" : pasa ? "PASA" : "NO_PASA";

  // RI-01 · "No otorgar créditos a personas femeninas mayores de 65 años" (Motor §6).
  const genero = app.cliente?.genero ?? "";
  const edad = calcularEdad(app.cliente?.fechaNacimiento ?? "");
  const ri01Listo = alcanzado("IDENTIFICACION") && !!genero && edad !== null;
  const ri01Pasa = !(genero === "Femenino" && edad !== null && edad > EDAD_MAXIMA_FEMENINO);

  // RI-02 · "No otorgar cuando el nivel de endeudamiento supera el 50 %" (Motor §6). Usa
  // todas las cuotas vigentes: es anterior a la primera oferta y a la precancelación.
  const neto = app.laboral.ingresoNeto;
  const cuotas = app.oferta.creditosActivos.reduce((s, c) => s + c.valorCuota, 0);
  const endeudamientoPct = neto > 0 ? Math.round((cuotas / neto) * 1000) / 10 : null;
  const ri02Listo = alcanzado("EVALUACION") && endeudamientoPct !== null;

  return [
    {
      id: "edad-genero",
      codigo: "RI-01",
      nombre: "Edad máxima para personas de género femenino",
      detalle: `No se otorgan créditos a personas de género femenino mayores de ${EDAD_MAXIMA_FEMENINO} años.`,
      fuente: "API pública",
      valorEvaluado: edad !== null && genero ? `${genero} · ${edad} años` : "Sin dato",
      condicion: `Femenino hasta ${EDAD_MAXIMA_FEMENINO} años`,
      bloqueante: true,
      momento: "IDENTIFICACION",
      resultado: resultado(ri01Listo, ri01Pasa),
    },
    {
      id: "endeudamiento",
      codigo: "RI-02",
      nombre: "Nivel de endeudamiento máximo",
      detalle: "Cuotas vigentes con la financiera sobre el ingreso neto confirmado.",
      fuente: "Base interna",
      valorEvaluado: ri02Listo ? formatPct(endeudamientoPct!) : "Esperando datos mínimos",
      condicion: `Hasta ${ENDEUDAMIENTO_MAXIMO_PCT} %`,
      bloqueante: true,
      momento: "EVALUACION",
      resultado: resultado(ri02Listo, (endeudamientoPct ?? 0) <= ENDEUDAMIENTO_MAXIMO_PCT),
    },
  ];
}

export function institucionalesBloquean(reglas: ReglaInstitucional[]): boolean {
  return reglas.some(reglaBloquea);
}

// --- Reglas institucionales sobre el capital del crédito ---

export interface ReglaInstitucionalCredito {
  codigo: string;
  nombre: string;
  // Doble columna del análisis: dónde está el cliente y qué exige la regla.
  posicion: string;
  regla: string;
  resultado: ResultadoRegla | "ESPERANDO_DATOS";
}

/**
 * Reglas institucionales que se muestran en el análisis del préstamo con la posición del
 * cliente frente a cada regla: capital máximo, capital hasta 3 sueldos brutos y nivel de
 * endeudamiento (más RI-01). Se calculan en vivo con los datos actuales de la solicitud: las
 * de capital dependen del monto de la oferta, que recién existe después de la evaluación.
 */
export function reglasInstitucionalesCredito(app: CreditApplication): ReglaInstitucionalCredito[] {
  const capital = app.oferta.montoSolicitado;
  const bruto = app.laboral.ingresoBruto;
  const cfg = configEfectiva(app.configuracion);
  const topeBrutos = bruto * LIMITE_SUELDOS_BRUTOS;
  const conCapital = (pasa: boolean): ReglaInstitucionalCredito["resultado"] =>
    capital > 0 ? (pasa ? "PASA" : "NO_PASA") : "ESPERANDO_DATOS";
  // RI-01 y RI-02 se recalculan con los datos actuales: la posición del cliente es la de hoy.
  const vigentes = evaluarInstitucionales(app, "EVALUACION");

  const capitalMaximo: ReglaInstitucionalCredito = {
    codigo: "RI-03",
    nombre: "Capital máximo",
    posicion: capital > 0 ? `Solicita ${formatARS(capital)}` : "Sin monto solicitado",
    regla: `Hasta ${formatARS(cfg.capitalMaximo)}${cfg.overrides.capitalMaximo !== undefined ? " (excepción del organismo)" : ""}`,
    resultado: conCapital(capital <= cfg.capitalMaximo),
  };
  const sueldosBrutos: ReglaInstitucionalCredito = {
    codigo: "RI-04",
    nombre: `${LIMITE_SUELDOS_BRUTOS} veces el sueldo bruto`,
    posicion:
      capital > 0 && bruto > 0
        ? `Solicita ${formatARS(capital)} · ${(capital / bruto).toLocaleString("es-AR", { maximumFractionDigits: 1 })} sueldos brutos`
        : "Sin monto o sin sueldo bruto",
    regla: `Hasta ${formatARS(topeBrutos)} (${LIMITE_SUELDOS_BRUTOS} × ${formatARS(bruto)})`,
    resultado: bruto > 0 ? conCapital(capital <= topeBrutos) : "ESPERANDO_DATOS",
  };
  const endeudamiento = vigentes.find((r) => r.codigo === "RI-02");
  const edadGenero = vigentes.find((r) => r.codigo === "RI-01");
  const desdeGuardada = (r: ReglaInstitucional): ReglaInstitucionalCredito => ({
    codigo: r.codigo,
    nombre: r.nombre,
    posicion: r.valorEvaluado,
    regla: r.condicion,
    resultado: r.resultado,
  });

  return [
    capitalMaximo,
    sueldosBrutos,
    ...(endeudamiento ? [{ ...desdeGuardada(endeudamiento), nombre: "Nivel de endeudamiento" }] : []),
    ...(edadGenero ? [desdeGuardada(edadGenero)] : []),
  ];
}
