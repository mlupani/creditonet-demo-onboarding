// Historial general del crédito: lo que ven el canal de venta y el analista, incluida la etapa
// de firma y de chequeo telefónico (que gestiona el chequeador).

import { actorActivo } from "./actor";
import { CANALES, SESION_ANALISTA, SESION_CHEQUEADOR, SESION_SUPERVISOR, nombreOpcion } from "./config";
import { observacionesDe } from "./credit";
import { fechaHora, formatARS, instante, parseFecha } from "./format";
import type {
  CambioEstadoLog,
  ChequeoTelefonico,
  CreditApplication,
  EstadoLog,
} from "./types";

export interface EventoHistorial {
  etiqueta: string;
  fecha: string;
  detalle?: string;
}

// --- Log de estados (creditonet-112) ---

function registroLog(
  app: Pick<CreditApplication, "configuracion">,
  anterior: EstadoLog | null,
  siguiente: EstadoLog
): CambioEstadoLog {
  return {
    anterior,
    siguiente,
    fecha: fechaHora(),
    ...actorActivo(),
    canal: nombreOpcion(CANALES, app.configuracion.canalId),
  };
}

// Deja asentado el cambio de estado que hay entre `prev` y `next` (si lo hay), firmado por quien
// opera la pestaña. El "Pendiente" no se registra acá: arranca al elegir la oferta
// (`conPendienteIniciado`), no al crear la solicitud, y termina con el primer cambio de estado.
export function conCambioEstadoRegistrado(prev: CreditApplication, next: CreditApplication): CreditApplication {
  if (next.estado === prev.estado || next.estado === "EN_TRAMITE") return next;
  const log = next.logEstados ?? [];
  const pendienteAbierto = prev.estado === "EN_TRAMITE" && log.some((c) => c.siguiente === "PENDIENTE");
  const anterior: EstadoLog | null = prev.estado === "EN_TRAMITE" ? (pendienteAbierto ? "PENDIENTE" : null) : prev.estado;
  return { ...next, logEstados: [...log, registroLog(next, anterior, next.estado)] };
}

// Primer registro del log: el vendedor eligió la oferta y la solicitud queda Pendiente hasta
// que pase a análisis.
export function conPendienteIniciado(app: CreditApplication): CreditApplication {
  const log = app.logEstados ?? [];
  if (app.estado !== "EN_TRAMITE" || log.some((c) => c.siguiente === "PENDIENTE")) return app;
  return { ...app, logEstados: [...log, registroLog(app, null, "PENDIENTE")] };
}

// --- Historial de interacciones (creditonet-112) ---

export type PerfilInteraccion = "VENTA" | "ANALISTA" | "SUPERVISOR" | "CHEQUEO";

// El canal de venta va de un lado del chat y el resto de los perfiles (analista, supervisor,
// chequeador) del otro.
export const LADO_BACKOFFICE: PerfilInteraccion[] = ["ANALISTA", "SUPERVISOR", "CHEQUEO"];

// Lado de cada mensaje de una conversación, como en un chat: los mensajes seguidos de un mismo
// perfil van del mismo lado y cuando responde otro perfil pasa al lado contrario. El primero va a
// la derecha si es del canal de venta y a la izquierda si no. true = derecha.
export function ladosDeChat(perfiles: PerfilInteraccion[]): boolean[] {
  let derecha = false;
  return perfiles.map((p, i) => {
    if (i === 0) derecha = !LADO_BACKOFFICE.includes(p);
    else if (p !== perfiles[i - 1]) derecha = !derecha;
    return derecha;
  });
}

export const PERFIL_ETIQUETA: Record<PerfilInteraccion, string> = {
  VENTA: "Canal de venta",
  ANALISTA: "Analista de riesgo",
  SUPERVISOR: "Supervisor de riesgo",
  CHEQUEO: "Chequeador telefónico",
};

export interface Interaccion {
  clave: string;
  perfil: PerfilInteraccion;
  usuario: string;
  fecha: string;
  // Tema de una observación del analista; los comentarios no lo tienen.
  tema?: string;
  texto: string;
  // Pantallas observadas (ids); el llamador les pone la etiqueta.
  pantallas?: string[];
}

export function perfilDeAutor(autor: string): PerfilInteraccion {
  if (autor.startsWith(SESION_ANALISTA.nombre)) return "ANALISTA";
  if (autor.startsWith(SESION_SUPERVISOR.nombre)) return "SUPERVISOR";
  if (autor.startsWith(SESION_CHEQUEADOR.nombre)) return "CHEQUEO";
  return "VENTA";
}

/**
 * Todo lo que se dijeron el vendedor, el analista y el chequeador, en orden cronológico: las
 * observaciones del analista (que abren un tema), los comentarios de cualquiera de los tres y lo
 * que dejó el chequeador al observar o finalizar el chequeo. A igual fecha el tema del analista va
 * antes que las respuestas.
 */
export function interaccionesCredito(
  app: Pick<CreditApplication, "analista" | "comentarios" | "chequeoTelefonico" | "rechazo">
): Interaccion[] {
  const observaciones = [...observacionesDe(app)];
  const anulada = app.analista.observacion;
  if (anulada?.motivo === "Anulada" && !observaciones.includes(anulada)) observaciones.push(anulada);

  const ch = app.chequeoTelefonico;
  const chequeador = SESION_CHEQUEADOR.nombre;
  const interacciones: Interaccion[] = [
    ...observaciones.map(
      (o, i): Interaccion => ({
        clave: `obs-${i}`,
        perfil: "ANALISTA",
        usuario: SESION_ANALISTA.nombre,
        fecha: o.fecha,
        tema: o.motivo,
        texto: o.nota,
        pantallas: o.pantallas,
      })
    ),
    ...app.comentarios.map(
      (c): Interaccion => ({
        clave: c.id,
        perfil: perfilDeAutor(c.autor),
        usuario: c.autor,
        fecha: c.fecha,
        texto: c.texto,
      })
    ),
    ...intentosChequeo(ch).map(
      (it, i): Interaccion => ({
        clave: `intento-${i}`,
        perfil: it.nota.startsWith("Devuelto por el superior") ? "SUPERVISOR" : "CHEQUEO",
        usuario: it.nota.startsWith("Devuelto por el superior") ? SESION_SUPERVISOR.nombre : chequeador,
        fecha: it.fecha,
        tema: "Chequeo telefónico sin completar",
        texto: it.nota,
      })
    ),
    ...(ch?.resultado && ch.comentario && ch.fecha
      ? [
          {
            clave: "chequeo-final",
            perfil: "CHEQUEO" as const,
            usuario: chequeador,
            fecha: ch.fecha,
            tema: ch.resultado === "OK" ? "Chequeo telefónico correcto" : "Chequeo telefónico no correcto",
            texto: ch.comentario,
          },
        ]
      : []),
    ...(app.rechazo && (app.rechazo.origen === "ANALISTA" || app.rechazo.origen === "SUPERIOR") && app.rechazo.observacion
      ? [
          {
            clave: "rechazo",
            perfil: app.rechazo.origen === "SUPERIOR" ? ("SUPERVISOR" as const) : ("ANALISTA" as const),
            usuario: app.rechazo.origen === "SUPERIOR" ? SESION_SUPERVISOR.nombre : SESION_ANALISTA.nombre,
            fecha: app.rechazo.fecha,
            tema: `Rechazada · ${app.rechazo.motivo}`,
            texto: app.rechazo.observacion,
          },
        ]
      : []),
  ];

  return interacciones
    .map((m, i) => ({ m, i, t: instante(m.fecha) }))
    .sort((a, b) => a.t - b.t || Number(!!b.m.tema) - Number(!!a.m.tema) || a.i - b.i)
    .map(({ m }) => m);
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
  if (app.estado === "PARA_LIQUIDAR" || app.estado === "ACTIVO") {
    const ultimaFirma = app.firmas[app.firmas.length - 1];
    push("Para liquidar", ch?.fecha ?? ultimaFirma?.fechaResultado ?? app.fechaAprobacion);
  }
  if (app.estado === "ACTIVO") push("Liquidado · crédito activo", app.fechaAprobacion);
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
