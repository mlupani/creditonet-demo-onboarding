import { useSyncExternalStore } from "react";
import { SESION_CHEQUEADOR } from "./config";
import type { EstadoCredito } from "./types";

export interface ComentarioNotificacion {
  id: string;
  creditoId: string | null;
  numeroCredito: string | null;
  autor: string;
  texto: string;
  fecha: string;
  estado: EstadoCredito;
  leida: boolean;
  // Instante de creación (ms): "selloTiempo" sólo dice "Hoy", no alcanza para saber si pasó un día.
  creadaEn: number;
  // Sólo en avisos del chequeador: el canal de venta ya contestó sobre este crédito.
  respondida: boolean;
}

const CLAVE = "creditonet.notificaciones.v1";
let registros: ComentarioNotificacion[] = [];
const oyentes = new Set<() => void>();

function commit(lista: ComentarioNotificacion[]) {
  registros = lista;
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    /* demo sin persistencia si el storage no está disponible */
  }
  oyentes.forEach((f) => f());
}

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

type Guardada = Omit<ComentarioNotificacion, "creadaEn" | "respondida"> &
  Partial<Pick<ComentarioNotificacion, "creadaEn" | "respondida">>;

function esValida(r: unknown): r is Guardada {
  const o = r as Record<string, unknown>;
  return (
    !!o &&
    typeof o.id === "string" &&
    (o.creditoId === null || typeof o.creditoId === "string") &&
    typeof o.autor === "string" &&
    typeof o.texto === "string" &&
    typeof o.fecha === "string" &&
    typeof o.estado === "string" &&
    typeof o.leida === "boolean"
  );
}

// Se llama una vez al hidratar la sesión, junto a hidratarProductos().
export function hidratarNotificaciones() {
  try {
    const raw = sessionStorage.getItem(CLAVE);
    if (!raw) return;
    const guardado = JSON.parse(raw) as unknown;
    if (Array.isArray(guardado) && guardado.every(esValida)) {
      // Los avisos guardados antes de creditonet-110 no traen creadaEn ni respondida.
      commit(guardado.map((r) => ({ ...r, creadaEn: r.creadaEn ?? Date.now(), respondida: r.respondida ?? false })));
    }
  } catch {
    /* si el guardado está dañado se arranca vacío */
  }
}

export function esDelChequeador(n: Pick<ComentarioNotificacion, "autor">): boolean {
  return n.autor === SESION_CHEQUEADOR.nombre;
}

// Un aviso del chequeador espera respuesta del canal de venta hasta que otro autor comenta el
// mismo crédito: ahí pasa de "pendiente" a "respondida" (y la respuesta es el aviso nuevo).
export function agregarNotificacion(
  n: Omit<ComentarioNotificacion, "id" | "leida" | "creadaEn" | "respondida">
) {
  const respondeAlChequeador = !esDelChequeador(n) && n.creditoId !== null;
  const previas = respondeAlChequeador
    ? registros.map((r) =>
        esDelChequeador(r) && r.creditoId === n.creditoId ? { ...r, respondida: true } : r
      )
    : registros;
  const ahora = Date.now();
  commit([{ ...n, id: `notif-${ahora}`, leida: false, creadaEn: ahora, respondida: false }, ...previas]);
}

// Avisos que esperan respuesta del canal de venta / respuestas que el chequeador debe tratar.
export const estaPendiente = (n: ComentarioNotificacion) => esDelChequeador(n) && !n.respondida;
export const estaRespondida = (n: ComentarioNotificacion) => !esDelChequeador(n);

// A partir del día calendario siguiente sin respuesta se puede cerrar como no concretado.
export function sinRespuestaDesdeAyer(n: ComentarioNotificacion, ahora = new Date()): boolean {
  const inicioHoy = new Date(ahora).setHours(0, 0, 0, 0);
  return estaPendiente(n) && n.creadaEn < inicioHoy;
}

export function marcarLeida(id: string) {
  commit(registros.map((r) => (r.id === id ? { ...r, leida: true } : r)));
}

export function marcarTodasLeidas() {
  commit(registros.map((r) => ({ ...r, leida: true })));
}

export function quitarNotificacion(id: string) {
  commit(registros.filter((r) => r.id !== id));
}

const VACIO: ComentarioNotificacion[] = [];

export function useNotificaciones(): ComentarioNotificacion[] {
  // getServerSnapshot debe devolver un valor cacheado (misma referencia): si no,
  // React reporta "should be cached to avoid an infinite loop".
  return useSyncExternalStore(suscribir, () => registros, () => VACIO);
}

export function extracto(texto: string): string {
  const t = texto.trim();
  return t.length > 120 ? `${t.slice(0, 117)}…` : t;
}

export function rutaParaEstado(estado: EstadoCredito): "/" | "/analisis" | "/chequeo" {
  if (estado === "CHEQUEO_TELEFONICO") return "/chequeo";
  if (estado === "OBSERVADO" || estado === "BORRADOR" || estado === "EN_TRAMITE") return "/";
  return "/analisis";
}
