// Historial general del crédito: lo que ven el canal de venta y el analista, incluida la etapa
// de firma y de chequeo telefónico (que gestiona el chequeador).

import { formatARS, parseFecha } from "./format";
import type { ChequeoTelefonico, CreditApplication } from "./types";

export interface EventoHistorial {
  etiqueta: string;
  fecha: string;
  detalle?: string;
}

const METODO = { ELECTRONICA: "electrónica", FISICA: "manual" } as const;

// Intentos de chequeo que no se pudieron completar. Los créditos anteriores al registro sólo
// tienen la última observación.
export function intentosChequeo(c: ChequeoTelefonico | null): { nota: string; fecha: string }[] {
  if (!c) return [];
  return c.intentos ?? (c.observacion ? [c.observacion] : []);
}

// Dónde está el chequeo, en una línea (para bandejas y avisos).
export function textoChequeo(c: ChequeoTelefonico | null): string {
  if (!c) return "No aplica";
  if (c.resultado === "OK") return "Finalizado · correcto";
  if (c.resultado === "NO_OK") return "Finalizado · no correcto";
  const intentos = intentosChequeo(c);
  if (c.observacion)
    return `Observado · ${intentos.length} ${intentos.length === 1 ? "intento" : "intentos"} · ${c.observacion.nota}`;
  return c.tomado ? "En curso · tomado por el chequeador" : "Pendiente de toma por el chequeador";
}

export function historialCredito(
  app: Pick<
    CreditApplication,
    | "estado"
    | "fechaSolicitud"
    | "fechaPreaprobacion"
    | "fechaEnvioAnalisis"
    | "fechaAprobacion"
    | "analista"
    | "firmas"
    | "chequeoTelefonico"
    | "aprobacionSuperior"
    | "rechazo"
  >
): EventoHistorial[] {
  const eventos: (EventoHistorial | null)[] = [];
  const push = (etiqueta: string, fecha: string | null | undefined, detalle?: string) =>
    eventos.push(fecha ? { etiqueta, fecha, detalle } : null);

  push("Solicitada", app.fechaSolicitud);
  push("Preaprobada", app.fechaPreaprobacion);
  push("Enviada a análisis", app.fechaEnvioAnalisis);
  const obs = app.analista.observacion;
  push(obs?.motivo === "Anulada" ? "Anulada" : "Observada", obs?.fecha, obs?.nota);
  const ex = app.analista.excepcionCambioOferta;
  push("Excepción de cambio de oferta autorizada", ex?.fecha, `Supervisor: ${ex?.autorizadoPor}`);
  push("Observación confirmada por el analista", app.analista.observacionConfirmada?.fecha);
  // Derivación pendiente: mientras el supervisor no decida, es el último estado del cambio.
  const der = app.analista.derivacionCambioFinanciero;
  push(
    "Cambio de datos financieros derivado al supervisor",
    der?.fecha,
    der ? `${der.motivo} Derivado por ${der.derivadoPor}` : undefined
  );
  for (const c of app.analista.historialCambiosOferta ?? []) {
    if (c.tipo !== "DATOS_FINANCIEROS" || !c.datos?.length) continue;
    push(
      "Datos financieros corregidos por el analista",
      c.fecha,
      c.datos.map((d) => `${d.campo}: ${formatARS(d.antes)} → ${formatARS(d.despues)}`).join(" · ")
    );
  }
  push("Aprobada por el analista", app.fechaAprobacion);

  for (const f of app.firmas) {
    const m = METODO[f.metodo];
    push(f.n === 1 ? `Firma ${m} del cliente (FEL)` : `Refirma ${m} del cliente (FEL)`, f.fechaFirma);
    if (f.resultado === "APROBADA") push("Firma verificada por el analista (AFEL)", f.fechaResultado);
    if (f.resultado === "REFIRMA_SOLICITADA") push("Refirma solicitada por el analista", f.fechaResultado);
    if (f.resultado === "RECHAZADA") push("Firma rechazada por el analista", f.fechaResultado);
  }

  const sup = app.aprobacionSuperior;
  if (sup) {
    push("Enviada a aprobación superior (SUP)", sup.fechaEnvio, `Pedida por ${sup.enviadaPor}`);
    push("Aprobada por el superior (SUP)", sup.fechaAprobacion, sup.aprobadaPor ? `Superior: ${sup.aprobadaPor}` : undefined);
  }

  const ch = app.chequeoTelefonico;
  if (ch) {
    push("En chequeo telefónico", ch.fechaInicio, "Gestionado por el chequeador");
    intentosChequeo(ch).forEach((it, i) =>
      push(`Chequeo telefónico · intento ${i + 1} sin completar`, it.fecha, it.nota)
    );
    if (ch.resultado)
      push(
        ch.resultado === "OK" ? "Chequeo telefónico correcto" : "Chequeo telefónico no correcto",
        ch.fecha,
        ch.comentario || undefined
      );
  }
  if (app.estado === "PARA_LIQUIDAR") {
    const ultimaFirma = app.firmas[app.firmas.length - 1];
    push("Para liquidar", ch?.fecha ?? ultimaFirma?.fechaResultado ?? app.fechaAprobacion);
  }
  if (app.estado === "RECHAZADO" && app.rechazo) {
    push("Rechazada", app.rechazo.fecha, `${app.rechazo.codigos.join(", ")} · ${app.rechazo.motivo}`);
  }

  // Orden cronológico; un sello que no se puede leer hereda la posición del anterior.
  let anterior = 0;
  return eventos
    .filter((e): e is EventoHistorial => e !== null)
    .map((e, i) => {
      const t = parseFecha(e.fecha)?.getTime();
      anterior = t ?? anterior;
      return { e, t: anterior, i };
    })
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map(({ e }) => e);
}
