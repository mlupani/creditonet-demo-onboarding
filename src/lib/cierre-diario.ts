// Cierre diario de sucursal (v4, 1.6), entrega y recepción del efectivo al cerrar una caja (1.2) y orden
// de arqueo sorpresivo desde Casa Central (4.2). Cada operación valida las reglas del documento, escribe
// en los stores y devuelve { ok } o un error en español. Las firmas con llave (R6) las produce `firmar`
// (llave.ts) y llegan como ID; las actas las registra actas.ts. Las correcciones se hacen con ajustes,
// nunca editando (R7).

import { USUARIOS_CAJA } from "./caja-datos";
import { actaDe, actaPorId, crearActa, firmarActa } from "./actas";
import { emitirAlerta } from "./alertas";
import { asentarAjuste, bloqueoCaja, type Res } from "./caja-operaciones";
import {
  cierreEnCurso,
  cierreVigente,
  controlesCierreDiario,
  diasHabilesEntre,
  estaCerrado,
  esResponsable,
  esSupervisor,
  estadoCierreDiario,
  puedeArquear,
  receptoresDeEntrega,
  sumarMinutos,
  ventanaVigente,
  veTodo,
  type ControlCierre,
} from "./caja-reglas";
import { ahoraTexto, auditar, cajaStores as S, horaActual, hoy, nombreUsuario, siguienteId, usuarioActual, usuarioPorId } from "./caja-store";
import {
  ESTADO_CIERRE_DIARIO_LABEL,
  esTesoro,
  type AjusteCierre,
  type Aprobacion,
  type Caja,
  type CierreSucursal,
  type Moneda,
  type PendienteJustificado,
} from "./caja-tipos";
import { plazosControl } from "./control-store";
import type { Firma } from "./control-tipos";
import { esCasaCentral, firmaPorId } from "./llave";
import { puedeAutorizarPorMatriz } from "./matriz";

const error = (mensaje: string): { ok: false; error: string } => ({ ok: false, error: mensaje });

const sucursalDe = (id: string) => S.sucursales.get().find((s) => s.id === id);
const cajasDeSucursal = (sucursalId: string): Caja[] => S.cajas.get().filter((c) => c.sucursalId === sucursalId && c.estado === "ACTIVO");
const esTesoreroDeSucursal = (sucursalId: string, usuarioId: string) =>
  cajasDeSucursal(sucursalId).some((c) => esTesoro(c.tipo) && c.tesoreroId === usuarioId);
const cierrePorId = (id: string) => S.cierresSucursal.get().find((c) => c.id === id);

// ---------- Controles automáticos ----------

const actaFirmada = (eventoTipo: string, eventoId: string): boolean | undefined => {
  const a = actaDe(eventoTipo, eventoId);
  return a ? a.estado === "FIRMADA" || a.estado === "RESUELTA" : undefined;
};

export function controlesDeSucursal(sucursalId: string, fecha = hoy(), cierreId?: string): ControlCierre[] {
  return controlesCierreDiario({
    sucursalId,
    fecha,
    cajas: S.cajas.get(),
    jornadas: S.jornadas.get(),
    movimientos: S.movimientos.get(),
    arqueos: S.arqueos.get(),
    cambiosTurno: S.cambiosTurno.get(),
    ajustes: S.ajustesCierre.get(),
    cierreId,
    actaFirmada,
  });
}

// Estado que ve Casa Central para una sucursal en la fecha y hora de la demo.
export const estadoDiarioDe = (sucursalId: string, fecha = hoy()) =>
  estadoCierreDiario(S.cierresSucursal.get(), sucursalId, fecha, horaActual(), plazosControl().horaLimiteCierreDiario);

// Tesorero y supervisores de la sucursal a quien se le puede pedir cada firma.
export const supervisoresDeSucursal = (sucursalId: string, excluirId?: string) =>
  USUARIOS_CAJA.filter((u) => u.id !== excluirId && u.sucursalId === sucursalId && u.roles.includes("SUPERVISOR"));

// La segunda firma remota de Casa Central sólo vale si la sucursal no tiene otro usuario habilitado.
export const permiteFirmaRemota = (sucursalId: string, excluirId?: string) => supervisoresDeSucursal(sucursalId, excluirId).length === 0;

// ---------- Entrega y recepción del efectivo al cerrar (1.2) ----------

// El cajero entrega y el tesorero (o un supervisor de la sucursal) recibe y asume la custodia: ambos firman el
// acta de entrega y recepción con su llave. Hasta entonces la caja está "Cerrada en sistema".
export function recibirEntregaCierre(jornadaId: string, firmaEntregaId: string, firmaRecepcionId: string): Res<{ actaId: string }> {
  const jornada = S.jornadas.get().find((j) => j.id === jornadaId);
  const caja = jornada && S.cajas.get().find((c) => c.id === jornada.cajaId);
  if (!jornada || !caja || !jornada.cierre) return error("La jornada no existe.");
  if (jornada.estado !== "CERRADA") return error("La caja todavía no está cerrada en el sistema.");
  if (jornada.custodia) return error("El efectivo ya fue recibido: la caja está en custodia.");
  const entrega = firmaPorId(firmaEntregaId);
  const recepcion = firmaPorId(firmaRecepcionId);
  if (!entrega || !recepcion) return error("Faltan las firmas con llave de la entrega y de la recepción.");
  const cajeroId = jornada.cierre.usuarioId;
  if (entrega.usuarioId !== cajeroId) return error(`La entrega la firma ${nombreUsuario(cajeroId)}, quien cerró la caja.`);
  if (recepcion.usuarioId === entrega.usuarioId) return error("Quien recibe el efectivo tiene que ser otro usuario: nadie firma su propia entrega.");
  const { fisicos, remotos } = receptoresDeEntrega(caja, cajeroId, USUARIOS_CAJA);
  const remota = recepcion.modalidad === "REMOTA";
  if (remota) {
    if (!remotos.some((u) => u.id === recepcion.usuarioId)) return error("La recepción remota la firma el Director o el Tesorero central.");
    if (fisicos.length > 0) return error("La sucursal tiene otro usuario habilitado: el efectivo lo recibe en forma presencial.");
  } else if (!fisicos.some((u) => u.id === recepcion.usuarioId)) {
    return error("Recibe el efectivo el tesorero o un supervisor de la sucursal.");
  }

  const nueva = crearActa({
    tipo: "CIERRE_ENTREGA",
    sucursalId: caja.sucursalId,
    cajaId: caja.id,
    eventoTipo: "JORNADA_ENTREGA",
    eventoId: jornada.id,
    firmante1Id: cajeroId,
    firmante2Id: recepcion.usuarioId,
    solicitaRemota: remota,
    contenido: {
      moneda: undefined,
      contado: jornada.cierre.contado,
      esperado: jornada.cierre.esperado,
      diferencia: jornada.cierre.diferencia,
      responsableFondosId: cajeroId,
      descripcion: remota
        ? "Autorización remota — sin verificación física. El efectivo sigue bajo custodia del empleado de la sucursal."
        : `Entrega del efectivo al cierre de ${caja.nombre}: ${nombreUsuario(recepcion.usuarioId)} recibe y asume la custodia.`,
    },
  });
  if (!nueva.ok) return nueva;
  const f1 = firmarActa(nueva.acta.id, { paso: 1, firma: entrega, conforme: true });
  if (!f1.ok) return f1;
  const f2 = firmarActa(nueva.acta.id, { paso: 2, firma: recepcion, conforme: true });
  if (!f2.ok) return f2;

  S.jornadas.commit(
    S.jornadas.get().map((j) =>
      j.id === jornada.id
        ? {
            ...j,
            custodia: {
              actaId: nueva.acta.id,
              entregaUsuarioId: cajeroId,
              recibeUsuarioId: recepcion.usuarioId,
              fechaHora: ahoraTexto(),
              remota,
              firmaEntregaId,
              firmaRecepcionId,
            },
          }
        : j
    )
  );
  auditar("Cierre de caja", jornada.id, "ESTADO", "Cerrada en sistema", `Efectivo en custodia de ${nombreUsuario(recepcion.usuarioId)}${remota ? " (firma remota)" : ""} · ${nueva.acta.id}`);
  return { ok: true, actaId: nueva.acta.id };
}

// ---------- Reapertura de una caja cerrada (1.2) ----------

export function diasDeReapertura(fechaCierre: string): number {
  return diasHabilesEntre(fechaCierre, hoy(), S.feriados.get());
}

// Un Tesorero central o el Director autorizan con su llave dentro del plazo; vencido el plazo, sólo el Director.
function errorAutorizaReapertura(firma: Firma, solicitanteId: string, fechaCierre: string): string | undefined {
  const u = usuarioPorId(firma.usuarioId);
  if (!u) return "Elegí el usuario que autoriza.";
  if (firma.usuarioId === solicitanteId) return "Quien pide la reapertura no puede autorizarla.";
  const matriz = puedeAutorizarPorMatriz(u, "REAPERTURA", 0, "ARS");
  if (matriz) return matriz;
  const plazo = plazosControl().plazoReaperturaDias;
  if (diasDeReapertura(fechaCierre) > plazo && !u.roles.includes("DIRECTOR"))
    return `Pasaron más de ${plazo} días hábiles desde el cierre: sólo el Director puede autorizar la reapertura.`;
  return undefined;
}

// Reapertura de una caja cerrada: sólo con autorización y registro. La caja vuelve a Abierta (hay que
// volver a cerrarla y a entregar el efectivo); queda auditada y avisa a Casa Central.
export function reabrirCaja(jornadaId: string, motivo: string, firmaId: string): Res {
  const jornada = S.jornadas.get().find((j) => j.id === jornadaId);
  const caja = jornada && S.cajas.get().find((c) => c.id === jornada.cajaId);
  const u = usuarioActual();
  if (!jornada || !caja) return error("La jornada no existe.");
  if (jornada.estado !== "CERRADA") return error("La caja no está cerrada.");
  if (!esResponsable(caja, u.id) && !esTesoreroDeSucursal(caja.sucursalId, u.id) && !esSupervisor(u)) return error("Pide la reapertura un responsable de la caja, el tesorero o un supervisor.");
  if (!motivo.trim()) return error("Indicá el motivo de la reapertura.");
  if (cierreVigente(S.cierresSucursal.get(), caja.sucursalId, jornada.fecha)) return error("La sucursal cerró la fecha: primero hay que reabrir el cierre diario.");
  const firma = firmaPorId(firmaId);
  if (!firma) return error("Falta la firma con llave de quien autoriza.");
  const e = errorAutorizaReapertura(firma, u.id, jornada.fecha);
  if (e) return error(e);
  S.jornadas.commit(
    S.jornadas.get().map((j) =>
      j.id === jornada.id
        ? {
            ...j,
            estado: "ABIERTA" as const,
            custodia: undefined,
            reaperturas: [...(j.reaperturas ?? []), { solicitadaPor: u.id, motivo: motivo.trim(), autorizadaPor: firma.usuarioId, firmaId, fechaHora: ahoraTexto() }],
          }
        : j
    )
  );
  emitirAlerta(
    "SOLICITUD_REAPERTURA",
    `${caja.nombre}: ${u.nombre} pidió reabrir la caja cerrada (${motivo.trim()}); autorizó ${nombreUsuario(firma.usuarioId)} con su llave.`,
    jornada.id,
    { sucursalId: caja.sucursalId }
  );
  auditar("Cierre de caja", jornada.id, "ESTADO", "Cerrada", `Reabierta · ${motivo.trim()} · autorizó ${nombreUsuario(firma.usuarioId)}`);
  return { ok: true };
}

// ---------- Cierre diario de sucursal (1.6) ----------

// El tesorero de la sucursal inicia el cierre: queda "En controles" hasta que se pasan los controles.
export function iniciarCierreDiario(sucursalId: string): Res<{ cierreId: string }> {
  const sucursal = sucursalDe(sucursalId);
  const u = usuarioActual();
  if (!sucursal) return error("Elegí la sucursal.");
  if (!esTesoreroDeSucursal(sucursalId, u.id)) return error("Sólo el tesorero de la sucursal puede cerrar la fecha operativa.");
  const cierres = S.cierresSucursal.get();
  if (cierreVigente(cierres, sucursalId, hoy())) return error("La sucursal ya cerró la fecha operativa.");
  if (cierreEnCurso(cierres, sucursalId, hoy())) return error("El cierre diario de la sucursal ya está en marcha.");
  const cierre: CierreSucursal = {
    id: siguienteId("CS", cierres.map((c) => c.id), 4),
    sucursalId,
    fecha: hoy(),
    usuarioId: u.id,
    fechaHora: ahoraTexto(),
    estado: "EN_CONTROLES",
  };
  S.cierresSucursal.commit([...cierres, cierre]);
  auditar("Cierre diario", cierre.id, "ALTA", null, `${sucursal.nombre} · ${cierre.fecha} · En controles`);
  return { ok: true, cierreId: cierre.id };
}

// Con los controles bloqueantes resueltos se abre la ventana de ajuste (tiempo parametrizable en 7.17).
export function abrirVentanaDeAjuste(cierreId: string): Res<{ ventanaHasta: string }> {
  const cierre = cierrePorId(cierreId);
  if (!cierre || cierre.estado !== "EN_CONTROLES") return error("El cierre diario no está en controles.");
  if (cierre.usuarioId !== usuarioActual().id) return error("Sigue el tesorero que inició el cierre.");
  const bloqueantes = controlesDeSucursal(cierre.sucursalId, cierre.fecha, cierre.id).flatMap((c) => c.bloqueantes);
  if (bloqueantes.length > 0) return error([...new Set(bloqueantes)].join(" "));
  const ventanaHasta = sumarMinutos(hoy(), horaActual(), plazosControl().ventanaAjusteHoras * 60);
  S.cierresSucursal.commit(S.cierresSucursal.get().map((c) => (c.id === cierreId ? { ...c, estado: "EN_VENTANA" as const, ventanaHasta } : c)));
  auditar("Cierre diario", cierre.id, "ESTADO", ESTADO_CIERRE_DIARIO_LABEL.EN_CONTROLES, `${ESTADO_CIERRE_DIARIO_LABEL.EN_VENTANA} hasta ${ventanaHasta}`);
  return { ok: true, ventanaHasta };
}

// ---------- Ventana de ajuste: el tesorero carga, el supervisor autoriza con su llave ----------

export interface NuevoAjusteCierre {
  cierreId: string;
  cajaId: string;
  moneda: Moneda;
  importe: number; // con signo
  motivoId: string;
  nota: string;
}

function errorVentana(cierre: CierreSucursal | undefined): string | undefined {
  if (!cierre || cierre.estado !== "EN_VENTANA") return "Sólo se cargan ajustes con el cierre diario en la ventana de ajuste.";
  if (!ventanaVigente(cierre, hoy(), horaActual())) return "La ventana de ajuste ya venció: la fecha está bloqueada. Una reapertura autorizada la vuelve a abrir.";
  return undefined;
}

export function cargarAjusteCierre(a: NuevoAjusteCierre): Res<{ ajusteId: string }> {
  const cierre = cierrePorId(a.cierreId);
  const u = usuarioActual();
  const e = errorVentana(cierre);
  if (e || !cierre) return error(e ?? "El cierre diario no existe.");
  if (!esTesoreroDeSucursal(cierre.sucursalId, u.id)) return error("Carga los ajustes el tesorero de la sucursal.");
  const caja = cajasDeSucursal(cierre.sucursalId).find((c) => c.id === a.cajaId);
  if (!caja) return error("Elegí una caja de la sucursal.");
  if (!(Math.abs(a.importe) > 0)) return error("El importe del ajuste tiene que ser distinto de cero.");
  const motivo = S.motivos.get().find((m) => m.id === a.motivoId && m.estado === "ACTIVO");
  if (!motivo) return error("Elegí el motivo del ajuste.");
  const lista = S.ajustesCierre.get();
  const ajuste: AjusteCierre = {
    id: siguienteId("AJC", lista.map((x) => x.id), 4),
    cierreId: cierre.id,
    cajaId: caja.id,
    moneda: a.moneda,
    importe: a.importe,
    motivoId: a.motivoId,
    nota: a.nota.trim(),
    cargadoPor: u.id,
    fechaHora: ahoraTexto(),
    estado: "PENDIENTE",
  };
  S.ajustesCierre.commit([...lista, ajuste]);
  auditar("Ajuste de cierre", ajuste.id, "ALTA", null, `${caja.nombre} · ${a.moneda} ${a.importe} · ${motivo.descripcion}`);
  return { ok: true, ajusteId: ajuste.id };
}

// El supervisor (distinto de quien cargó) autoriza con su llave y la matriz por importe. Autorizar asienta un
// movimiento de ajuste propio en el libro (R7); rechazar deja el ajuste sin efecto y con su motivo.
export function resolverAjusteCierre(id: string, aprobar: boolean, nota: string, firmaId?: string): Res {
  const ajuste = S.ajustesCierre.get().find((a) => a.id === id);
  const cierre = ajuste && cierrePorId(ajuste.cierreId);
  const u = usuarioActual();
  if (!ajuste || ajuste.estado !== "PENDIENTE") return error("El ajuste ya fue resuelto.");
  // Autoriza un supervisor (o Casa Central cuando el importe supera su tope en la matriz), nunca quien lo cargó.
  if (u.id === ajuste.cargadoPor || !(esSupervisor(u) || veTodo(u))) return error("Autoriza un supervisor distinto de quien cargó el ajuste.");
  if (!aprobar && !nota.trim()) return error("Indicá el motivo del rechazo.");
  if (aprobar) {
    const e = errorVentana(cierre);
    if (e) return error(e);
    const m = puedeAutorizarPorMatriz(u, "AJUSTE_DIFERENCIA", Math.abs(ajuste.importe), ajuste.moneda);
    if (m) return error(m);
  }
  const autorizacion: Aprobacion = { supervisorId: u.id, fechaHora: ahoraTexto(), resultado: aprobar ? "APROBADA" : "RECHAZADA", nota, ...(firmaId ? { firmaId } : {}) };
  const mov = aprobar ? asentarAjuste(ajuste.cajaId, ajuste.moneda, ajuste.importe, `Ajuste de cierre ${ajuste.id}`, ajuste.motivoId, ajuste.nota) : undefined;
  S.ajustesCierre.commit(
    S.ajustesCierre.get().map((a) => (a.id === id ? { ...a, estado: aprobar ? ("AUTORIZADO" as const) : ("RECHAZADO" as const), autorizacion, libroId: mov?.id } : a))
  );
  auditar("Ajuste de cierre", id, "ESTADO", "Pendiente", `${aprobar ? "Autorizado" : "Rechazado"} por ${u.nombre}${mov ? ` · ${mov.id}` : ""}`);
  return { ok: true };
}

// ---------- Acta de cierre diario y resultado ----------

export interface ConfirmacionCierre {
  // Justificación del tesorero para cada control con pendientes justificables (clave: id del control).
  justificaciones?: Record<string, string>;
  firma1Id: string; // tesorero
  firma2Id: string; // supervisor (presencial) o Casa Central (remota)
}

// Doble firma del acta de cierre diario: Tesorero + Supervisor, o la segunda firma remota de Casa Central si la
// sucursal opera con una sola persona. Con pendientes justificados la fecha queda "Cerrada con pendientes".
export function confirmarCierreDiario(cierreId: string, c: ConfirmacionCierre): Res<{ actaId: string; estado: CierreSucursal["estado"] }> {
  const cierre = cierrePorId(cierreId);
  const u = usuarioActual();
  if (!cierre || cierre.estado !== "EN_VENTANA") return error("El cierre diario tiene que estar en la ventana de ajuste.");
  if (cierre.usuarioId !== u.id) return error("Confirma el cierre el tesorero que lo inició.");
  const f1 = firmaPorId(c.firma1Id);
  const f2 = firmaPorId(c.firma2Id);
  if (!f1 || !f2) return error("Faltan las firmas con llave del tesorero y del supervisor.");
  if (f1.usuarioId !== cierre.usuarioId) return error("La primera firma es la del tesorero que cierra la fecha.");
  if (f2.usuarioId === f1.usuarioId) return error("Los dos firmantes del acta tienen que ser usuarios distintos.");
  const remota = f2.modalidad === "REMOTA";
  const segundo = usuarioPorId(f2.usuarioId);
  if (!segundo) return error("La segunda firma no corresponde a un usuario.");
  if (remota) {
    if (!esCasaCentral(segundo)) return error("La firma remota la da un usuario de Casa Central.");
    if (!permiteFirmaRemota(cierre.sucursalId, f1.usuarioId)) return error("La sucursal tiene un supervisor habilitado: la segunda firma es presencial.");
  } else if (!(segundo.roles.includes("SUPERVISOR") && segundo.sucursalId === cierre.sucursalId)) {
    return error("La segunda firma la da un supervisor de la sucursal.");
  }

  const controles = controlesDeSucursal(cierre.sucursalId, cierre.fecha, cierre.id);
  const bloqueantes = controles.flatMap((x) => x.bloqueantes);
  if (bloqueantes.length > 0) return error([...new Set(bloqueantes)].join(" "));
  const pendientes: PendienteJustificado[] = [];
  for (const ctl of controles.filter((x) => x.justificables.length > 0)) {
    const justificacion = c.justificaciones?.[ctl.id]?.trim() ?? "";
    if (!justificacion) return error(`Justificá los pendientes de «${ctl.label}»: ${ctl.justificables.join(" ")}`);
    pendientes.push({ control: ctl.label, detalle: ctl.justificables.join(" "), justificacion });
  }
  if (remota) pendientes.push({ control: "Firma remota", detalle: "El acta se cerró con la segunda firma remota de Casa Central, sin verificación física.", justificacion: "Sucursal con una sola persona" });

  const sucursal = sucursalDe(cierre.sucursalId);
  const anterior = cierre.reabreDeId ? cierrePorId(cierre.reabreDeId) : undefined;
  const ajustes = S.ajustesCierre.get().filter((a) => a.cierreId === cierre.id);
  const nueva = crearActa({
    tipo: "CIERRE_DIARIO",
    sucursalId: cierre.sucursalId,
    eventoTipo: "CIERRE_DIARIO",
    eventoId: cierre.id,
    firmante1Id: f1.usuarioId,
    firmante2Id: f2.usuarioId,
    solicitaRemota: remota,
    referenciaActaId: anterior?.actaId,
    contenido: {
      descripcion: `Cierre diario de ${sucursal?.nombre ?? cierre.sucursalId} · fecha operativa ${cierre.fecha}${anterior ? ` (nuevo cierre tras la reapertura de ${anterior.id})` : ""}.`,
      controles: controles.map((x) => ({ control: x.label, ok: x.ok, pendientes: [...x.bloqueantes, ...x.justificables] })),
      ajustes: ajustes.map((a) => ({ id: a.id, caja: a.cajaId, moneda: a.moneda, importe: a.importe, estado: a.estado, libroId: a.libroId })),
      pendientes,
      observaciones: remota ? "Autorización remota — sin verificación física." : undefined,
    },
  });
  if (!nueva.ok) return nueva;
  const a1 = firmarActa(nueva.acta.id, { paso: 1, firma: f1, conforme: true });
  if (!a1.ok) return a1;
  const a2 = firmarActa(nueva.acta.id, { paso: 2, firma: f2, conforme: true });
  if (!a2.ok) return a2;

  const estado = pendientes.length > 0 ? ("CERRADA_CON_PENDIENTES" as const) : ("CERRADA_OK" as const);
  S.cierresSucursal.commit(
    S.cierresSucursal.get().map((x) => (x.id === cierre.id ? { ...x, estado, pendientes, actaId: nueva.acta.id, cerradaEn: ahoraTexto() } : x))
  );
  if (estado === "CERRADA_CON_PENDIENTES")
    emitirAlerta(
      "SUCURSAL_SIN_CIERRE_DIARIO",
      `${sucursal?.nombre ?? cierre.sucursalId} cerró la fecha ${cierre.fecha} con pendientes: ${pendientes.map((p) => p.control).join(", ")}.`,
      cierre.id,
      { sucursalId: cierre.sucursalId }
    );
  auditar("Cierre diario", cierre.id, "ESTADO", ESTADO_CIERRE_DIARIO_LABEL.EN_VENTANA, `${ESTADO_CIERRE_DIARIO_LABEL[estado]} · ${nueva.acta.id}`);
  return { ok: true, actaId: nueva.acta.id, estado };
}

// ---------- Reapertura del cierre diario ----------

// El tesorero de la sucursal pide la reapertura de una fecha cerrada, con su motivo.
export function solicitarReaperturaCierre(cierreId: string, motivo: string): Res {
  const cierre = cierrePorId(cierreId);
  const u = usuarioActual();
  if (!cierre || !estaCerrado(cierre)) return error("La fecha no está cerrada.");
  if (!esTesoreroDeSucursal(cierre.sucursalId, u.id)) return error("Pide la reapertura el tesorero de la sucursal.");
  if (cierre.reapertura && !cierre.reapertura.autorizadaPor) return error("Ya hay una solicitud de reapertura esperando la autorización de Casa Central.");
  if (!motivo.trim()) return error("Indicá el motivo de la reapertura.");
  S.cierresSucursal.commit(
    S.cierresSucursal.get().map((c) => (c.id === cierreId ? { ...c, reapertura: { solicitadaPor: u.id, motivo: motivo.trim(), fechaHoraSolicitud: ahoraTexto() } } : c))
  );
  emitirAlerta(
    "SOLICITUD_REAPERTURA",
    `${sucursalDe(cierre.sucursalId)?.nombre ?? cierre.sucursalId}: ${u.nombre} pide reabrir la fecha ${cierre.fecha} (${motivo.trim()}).`,
    cierre.id,
    { sucursalId: cierre.sucursalId }
  );
  auditar("Cierre diario", cierre.id, "MODIFICACION", null, `Solicitud de reapertura · ${motivo.trim()}`);
  return { ok: true };
}

// El Tesorero central o el Director autorizan con su llave, dentro del plazo en días hábiles (7.17); vencido el
// plazo sólo el Director. El cierre queda Reabierto y se abre otro que lo referencia: sólo admite ajustes.
export function autorizarReaperturaCierre(cierreId: string, firmaId: string): Res<{ nuevoCierreId: string }> {
  const cierre = cierrePorId(cierreId);
  if (!cierre || !estaCerrado(cierre)) return error("La fecha no está cerrada.");
  if (!cierre.reapertura || cierre.reapertura.autorizadaPor) return error("No hay una solicitud de reapertura para autorizar.");
  const firma = firmaPorId(firmaId);
  if (!firma) return error("Falta la firma con llave de quien autoriza.");
  const e = errorAutorizaReapertura(firma, cierre.reapertura.solicitadaPor, cierre.fecha);
  if (e) return error(e);
  const cierres = S.cierresSucursal.get();
  const nuevo: CierreSucursal = {
    id: siguienteId("CS", cierres.map((c) => c.id), 4),
    sucursalId: cierre.sucursalId,
    fecha: cierre.fecha,
    usuarioId: cierre.reapertura.solicitadaPor,
    fechaHora: ahoraTexto(),
    estado: "EN_VENTANA",
    reabreDeId: cierre.id,
  };
  S.cierresSucursal.commit([
    ...cierres.map((c) =>
      c.id === cierreId
        ? { ...c, estado: "REABIERTA" as const, reapertura: { ...c.reapertura!, autorizadaPor: firma.usuarioId, firmaId, fechaHoraAutorizacion: ahoraTexto() } }
        : c
    ),
    nuevo,
  ]);
  auditar("Cierre diario", cierre.id, "ESTADO", ESTADO_CIERRE_DIARIO_LABEL.CERRADA_OK, `Reabierta · autorizó ${nombreUsuario(firma.usuarioId)} · nuevo cierre ${nuevo.id}`);
  return { ok: true, nuevoCierreId: nuevo.id };
}

// Acta del cierre (la última del evento) para mostrarla en pantalla.
export const actaDeCierre = (cierre: CierreSucursal) => (cierre.actaId ? actaPorId(cierre.actaId) : undefined);

// ---------- Arqueo sorpresivo ordenado desde Casa Central (4.2) ----------

// El Director o el Tesorero central ordenan el arqueo sorpresivo de una caja y designan al controlador (un
// Supervisor o Tesorero que no sea responsable de la caja). El corte congela la caja de inmediato.
export function ordenarArqueoSorpresivo(cajaId: string, controladorId: string): Res<{ arqueoId: string }> {
  const caja = S.cajas.get().find((c) => c.id === cajaId);
  const ordena = usuarioActual();
  const controlador = usuarioPorId(controladorId);
  if (!caja) return error("Elegí la caja.");
  if (!veTodo(ordena)) return error("Sólo Casa Central (Director o Tesorero central) ordena un arqueo sorpresivo desde el Tablero.");
  if (!controlador) return error("Designá al controlador.");
  if (!puedeArquear(controlador)) return error("El controlador necesita el permiso Realizar arqueo (Supervisor o Tesorero).");
  if (esResponsable(caja, controlador.id)) return error(`El controlador no puede ser responsable de la caja arqueada (${caja.nombre}).`);
  if (caja.estado !== "ACTIVO") return error(`${caja.nombre} no está activa.`);
  const bloqueo = bloqueoCaja(caja.id);
  if (bloqueo) return error(`${caja.nombre}: ${bloqueo}`);
  const arqueos = S.arqueos.get();
  const id = siguienteId("ARQ", arqueos.map((a) => a.id), 4);
  S.arqueos.commit([
    ...arqueos,
    { id, cajaId: caja.id, tipo: "SORPRESIVO", controladorId: controlador.id, ordenadoPor: ordena.id, corte: ahoraTexto(), estado: "EN_CURSO", conteos: [] },
  ]);
  // El anexo de alertas no tiene un evento para la orden en sí (sin aviso previo al cajero): el mail de
  // "arqueo sorpresivo con diferencia" lo emite el arqueo al finalizar. Acá queda la auditoría.
  auditar("Arqueo", id, "ALTA", null, `Sorpresivo ordenado por ${ordena.nombre} · controla ${controlador.nombre} · ${caja.nombre}`);
  return { ok: true, arqueoId: id };
}
