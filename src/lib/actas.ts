// Actas de conformidad (v4). Un acta es un formulario de conformidad en el que intervienen dos usuarios,
// cada uno con su llave de autorización (R6): deja constancia de un momento de la caja —qué decía el
// sistema, qué se contó, qué diferencia hubo y quién respondió— y es inalterable: nunca se edita ni se
// borra. Si hubo un error se crea un acta nueva que referencia a la anterior (R1).
//
// Este módulo sólo registra firmas ya autenticadas (las produce `firmar` de llave.ts) y mueve el acta
// por sus estados: BORRADOR → PEND_FIRMA_1 → PEND_FIRMA_2 → FIRMADA, con las salidas RECHAZADA (el
// segundo firmante marca No conforme), ESCALADA (el responsable se niega a firmar) y RESUELTA (un
// superior resolvió el escalamiento). Los flujos de caja (caja-operaciones.ts) generan las actas.

import { emitirAlerta } from "./alertas";
import { USUARIOS_CAJA } from "./caja-datos";
import { cajasVisibles, veTodo } from "./caja-reglas";
import { ahoraTexto, cajaStores as S, nombreUsuario, siguienteId, usuarioActual, usuarioPorId } from "./caja-store";
import type { Res } from "./caja-operaciones";
import {
  TIPO_ACTA_LABEL,
  type ActaConformidad,
  type Caja,
  type ContenidoActa,
  type EstadoActa,
  type FirmaActa,
  type TipoActa,
  type UsuarioCaja,
} from "./caja-tipos";
import type { Firma } from "./control-tipos";

const ES_SUPERIOR = ["TESORERO_CENTRAL", "DIRECTOR"];

export interface EntradaActa {
  tipo: TipoActa;
  sucursalId: string;
  cajaId?: string;
  eventoTipo: string;
  eventoId: string;
  contenido: ContenidoActa;
  // Usuarios previstos: si se indican, sólo ellos pueden dar esa firma (salvo `enNombreDe`).
  firmante1Id?: string;
  firmante2Id?: string;
  // Acta nueva que corrige o repite a otra (R1).
  referenciaActaId?: string;
  // La segunda firma será remota de Casa Central (sucursal con una sola persona): avisa por mail.
  solicitaRemota?: boolean;
}

// Foto serializable: el acta no cambia aunque después se modifique el objeto de origen.
const congelar = <T>(valor: T): T => JSON.parse(JSON.stringify(valor)) as T;

const guardar = (acta: ActaConformidad) => {
  const lista = S.actas.get();
  const i = lista.findIndex((a) => a.id === acta.id);
  S.actas.commit(i < 0 ? [...lista, acta] : lista.map((a) => (a.id === acta.id ? acta : a)));
};

export const actaPorId = (id: string | undefined): ActaConformidad | undefined =>
  id ? S.actas.get().find((a) => a.id === id) : undefined;

// Todas las actas de un evento, de la más vieja a la más nueva.
export const actasDeEvento = (eventoTipo: string, eventoId: string, actas: ActaConformidad[] = S.actas.get()) =>
  actas.filter((a) => a.eventoTipo === eventoTipo && a.eventoId === eventoId);

// La última acta de un evento (la vigente: las anteriores quedaron rechazadas o reemplazadas).
export const actaDe = (eventoTipo: string, eventoId: string, actas: ActaConformidad[] = S.actas.get()): ActaConformidad | undefined =>
  actasDeEvento(eventoTipo, eventoId, actas).at(-1);

export const actasPorCaja = (cajaId: string, actas: ActaConformidad[] = S.actas.get()) => actas.filter((a) => a.cajaId === cajaId);
export const actasPorTipo = (tipo: TipoActa, actas: ActaConformidad[] = S.actas.get()) => actas.filter((a) => a.tipo === tipo);
export const actasPorEstado = (estado: EstadoActa, actas: ActaConformidad[] = S.actas.get()) => actas.filter((a) => a.estado === estado);

// Actas que el usuario puede ver: las de las cajas de su ámbito (R5). Las que no tienen caja
// (cierre diario) se ven por sucursal.
export function actasVisibles(usuario: UsuarioCaja, actas: ActaConformidad[], cajas: Caja[]): ActaConformidad[] {
  if (veTodo(usuario)) return actas;
  const ids = new Set(cajasVisibles(usuario, cajas).map((c) => c.id));
  return actas.filter((a) => (a.cajaId ? ids.has(a.cajaId) : a.sucursalId === usuario.sucursalId));
}

export function crearActa(e: EntradaActa): Res<{ acta: ActaConformidad }> {
  if (!e.sucursalId) return { ok: false, error: "El acta necesita la sucursal." };
  if (!e.eventoId) return { ok: false, error: "El acta necesita el evento que la origina." };
  if (e.firmante1Id && e.firmante2Id && e.firmante1Id === e.firmante2Id)
    return { ok: false, error: "Los dos firmantes de un acta deben ser usuarios distintos." };
  if (e.referenciaActaId && !actaPorId(e.referenciaActaId)) return { ok: false, error: "El acta que se corrige no existe." };
  const lista = S.actas.get();
  const acta: ActaConformidad = {
    id: siguienteId("ACT", lista.map((a) => a.id), 6),
    tipo: e.tipo,
    sucursalId: e.sucursalId,
    cajaId: e.cajaId,
    eventoTipo: e.eventoTipo,
    eventoId: e.eventoId,
    fechaHora: ahoraTexto(),
    estado: "PEND_FIRMA_1",
    contenido: congelar(e.contenido),
    firmante1Id: e.firmante1Id,
    firmante2Id: e.firmante2Id,
    referenciaActaId: e.referenciaActaId,
    remota: e.solicitaRemota ? true : undefined,
    creadaPor: usuarioActual().id,
  };
  guardar(acta);
  if (e.solicitaRemota)
    emitirAlerta(
      "SOLICITUD_FIRMA_REMOTA",
      `${TIPO_ACTA_LABEL[acta.tipo]} ${acta.id}: la sucursal no tiene otro usuario habilitado y pide la segunda firma remota de Casa Central.`,
      acta.id,
      { sucursalId: acta.sucursalId }
    );
  return { ok: true, acta };
}

export interface EntradaFirmaActa {
  paso: 1 | 2;
  // Firma con llave ya registrada (resultado de `firmar`).
  firma: Firma;
  conforme: boolean;
  observaciones?: string;
  // El supervisor firma por el cajero saliente que no pudo contar ni firmar (reemplazo por emergencia).
  enNombreDe?: string;
}

const aFirmaActa = (e: EntradaFirmaActa): FirmaActa => ({
  firmaId: e.firma.id,
  usuarioId: e.firma.usuarioId,
  rol: e.firma.rol,
  conforme: e.conforme,
  observaciones: e.observaciones?.trim() || undefined,
  modalidad: e.firma.modalidad,
  equipo: e.firma.equipo,
  fechaHora: e.firma.fechaHora,
  enNombreDe: e.enNombreDe,
});

export function firmarActa(actaId: string, e: EntradaFirmaActa): Res<{ acta: ActaConformidad }> {
  const acta = actaPorId(actaId);
  if (!acta) return { ok: false, error: "El acta no existe." };
  const esperado: EstadoActa = e.paso === 1 ? "PEND_FIRMA_1" : "PEND_FIRMA_2";
  if (acta.estado !== esperado)
    return { ok: false, error: `El acta ${acta.id} está ${acta.estado === "FIRMADA" ? "firmada" : "en otro estado"} y no admite la firma ${e.paso}.` };
  if (!e.conforme && !e.observaciones?.trim())
    return { ok: false, error: "Si firmás disconforme o No conforme, las observaciones son obligatorias." };
  const previsto = e.paso === 1 ? acta.firmante1Id : acta.firmante2Id;
  if (previsto && previsto !== e.firma.usuarioId && !e.enNombreDe)
    return { ok: false, error: `Esta firma le corresponde a ${nombreUsuario(previsto)}.` };
  if (e.enNombreDe && !usuarioPorId(e.enNombreDe)) return { ok: false, error: "El usuario en cuyo nombre se firma no existe." };
  if (e.paso === 2 && acta.firma1?.usuarioId === e.firma.usuarioId)
    return { ok: false, error: "Los dos firmantes de un acta deben ser usuarios distintos." };
  if (e.paso === 2 && acta.remota && e.firma.modalidad !== "REMOTA")
    return { ok: false, error: "Esta acta pide la segunda firma remota de Casa Central." };

  const firma = aFirmaActa(e);
  let siguiente: ActaConformidad;
  if (e.paso === 1) {
    siguiente = { ...acta, firma1: firma, estado: "PEND_FIRMA_2" };
  } else if (e.conforme) {
    siguiente = { ...acta, firma2: firma, estado: "FIRMADA" };
  } else {
    siguiente = {
      ...acta,
      firma2: firma,
      estado: "RECHAZADA",
      rechazo: { usuarioId: firma.usuarioId, fechaHora: firma.fechaHora, motivo: firma.observaciones ?? "" },
    };
  }
  guardar(siguiente);
  if (!e.conforme)
    emitirAlerta(
      "ACTA_NO_CONFORME",
      `${TIPO_ACTA_LABEL[acta.tipo]} ${acta.id}: ${nombreUsuario(firma.usuarioId)} firmó ${e.paso === 1 ? "disconforme" : "No conforme"}. ${firma.observaciones ?? ""}`.trim(),
      acta.id,
      { sucursalId: acta.sucursalId }
    );
  return { ok: true, acta: siguiente };
}

export interface EntradaNegativa {
  firma: Firma; // la del supervisor que registra la negativa
  observacion: string;
}

// El responsable de los fondos se niega a firmar: el supervisor lo deja asentado con su llave y el acta
// escala a un superior. La negativa no elimina la diferencia ni registra una conformidad inexistente.
export function registrarNegativaAFirmar(actaId: string, e: EntradaNegativa): Res<{ acta: ActaConformidad }> {
  const acta = actaPorId(actaId);
  if (!acta) return { ok: false, error: "El acta no existe." };
  if (acta.estado !== "PEND_FIRMA_1") return { ok: false, error: "Sólo se registra la negativa mientras falta la firma del responsable." };
  if (!e.observacion.trim()) return { ok: false, error: "Anotá la observación de la negativa a firmar." };
  if (e.firma.rol !== "SUPERVISOR") return { ok: false, error: "La negativa la registra un Supervisor de caja con su llave." };
  if (acta.firmante1Id && e.firma.usuarioId === acta.firmante1Id)
    return { ok: false, error: "El responsable de los fondos no puede registrar su propia negativa." };
  const siguiente: ActaConformidad = {
    ...acta,
    estado: "ESCALADA",
    negativa: { supervisorId: e.firma.usuarioId, firmaId: e.firma.id, observacion: e.observacion.trim(), fechaHora: e.firma.fechaHora },
  };
  guardar(siguiente);
  emitirAlerta(
    "NEGATIVA_A_FIRMAR",
    `${TIPO_ACTA_LABEL[acta.tipo]} ${acta.id}: el responsable de los fondos se negó a firmar. Registró la negativa ${nombreUsuario(e.firma.usuarioId)}: ${e.observacion.trim()}`,
    acta.id,
    { sucursalId: acta.sucursalId }
  );
  return { ok: true, acta: siguiente };
}

export interface EntradaResolucion {
  firma: Firma; // la del superior (Tesorero central o Director)
  decision: "AUTORIZAR" | "NUEVA_VERIFICACION";
  observaciones: string;
}

// El superior resuelve el acta escalada con su llave: autoriza el ajuste o pide nueva verificación.
export function resolverActaEscalada(actaId: string, e: EntradaResolucion): Res<{ acta: ActaConformidad }> {
  const acta = actaPorId(actaId);
  if (!acta) return { ok: false, error: "El acta no existe." };
  if (acta.estado !== "ESCALADA") return { ok: false, error: "Sólo se resuelve un acta escalada." };
  if (!ES_SUPERIOR.includes(e.firma.rol)) return { ok: false, error: "Resuelve el Tesorero central o el Director, con su llave." };
  if (acta.negativa && e.firma.usuarioId === acta.negativa.supervisorId)
    return { ok: false, error: "Quien registró la negativa no puede resolverla." };
  if (!e.observaciones.trim()) return { ok: false, error: "Anotá las observaciones de la resolución." };
  const siguiente: ActaConformidad = {
    ...acta,
    estado: "RESUELTA",
    resolucion: {
      usuarioId: e.firma.usuarioId,
      firmaId: e.firma.id,
      decision: e.decision,
      observaciones: e.observaciones.trim(),
      fechaHora: e.firma.fechaHora,
    },
  };
  guardar(siguiente);
  return { ok: true, acta: siguiente };
}

// Marca un acta pendiente como rechazada cuando el flujo se repite (por ejemplo, el supervisor rechaza el
// ajuste y se pide un nuevo recuento): el acta no se edita, sólo cambia de estado con el motivo.
export function rechazarActa(actaId: string, firma: Firma, motivo: string): Res<{ acta: ActaConformidad }> {
  const acta = actaPorId(actaId);
  if (!acta) return { ok: false, error: "El acta no existe." };
  if (acta.estado === "FIRMADA" || acta.estado === "RECHAZADA" || acta.estado === "RESUELTA")
    return { ok: false, error: "El acta ya está cerrada y no se modifica." };
  if (!motivo.trim()) return { ok: false, error: "Anotá el motivo del rechazo." };
  const siguiente: ActaConformidad = {
    ...acta,
    estado: "RECHAZADA",
    rechazo: { usuarioId: firma.usuarioId, fechaHora: firma.fechaHora, motivo: motivo.trim() },
  };
  guardar(siguiente);
  return { ok: true, acta: siguiente };
}

// Sucursal con una sola persona: no hay otro Supervisor o Tesorero habilitado que pueda dar la segunda
// firma, así que la da Casa Central de forma remota (sin verificación física).
export const necesitaFirmaRemota = (sucursalId: string, firma1UsuarioId?: string): boolean =>
  !USUARIOS_CAJA.some(
    (u) => u.sucursalId === sucursalId && u.id !== firma1UsuarioId && (u.roles.includes("SUPERVISOR") || u.roles.includes("TESORERO"))
  );

// Pide la segunda firma remota de Casa Central: deja marcada el acta y avisa por mail.
export function solicitarFirmaRemota(actaId: string): Res<{ acta: ActaConformidad }> {
  const acta = actaPorId(actaId);
  if (!acta) return { ok: false, error: "El acta no existe." };
  if (acta.estado !== "PEND_FIRMA_2") return { ok: false, error: "La firma remota se pide cuando ya firmó el primer firmante." };
  if (acta.remota) return { ok: true, acta };
  const siguiente: ActaConformidad = { ...acta, remota: true };
  guardar(siguiente);
  emitirAlerta(
    "SOLICITUD_FIRMA_REMOTA",
    `${TIPO_ACTA_LABEL[acta.tipo]} ${acta.id}: la sucursal no tiene otro usuario habilitado y pide la segunda firma remota de Casa Central.`,
    acta.id,
    { sucursalId: acta.sucursalId }
  );
  return { ok: true, acta: siguiente };
}

// Deja asentados en el acta los movimientos de ajuste que generó la autorización. El contenido del acta
// no se toca: sólo se vincula el resultado, una única vez.
export function vincularAjustes(actaId: string, ajusteIds: string[]) {
  const acta = actaPorId(actaId);
  if (!acta || acta.ajusteIds || ajusteIds.length === 0) return;
  guardar({ ...acta, ajusteIds });
}

// Texto corto para mostrar el acta de un evento en una pantalla.
export const estadoActaTexto = (a: ActaConformidad | undefined): string =>
  !a ? "Sin acta" : a.estado === "FIRMADA" ? "Firmada" : a.estado === "RECHAZADA" ? "Rechazada" : a.estado === "ESCALADA" ? "Escalada" : a.estado === "RESUELTA" ? "Resuelta por un superior" : a.estado === "PEND_FIRMA_2" ? "Pendiente de firma 2" : "Pendiente de firma 1";
