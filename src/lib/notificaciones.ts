import { useSyncExternalStore } from "react";
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

function esValida(r: unknown): r is ComentarioNotificacion {
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
    if (Array.isArray(guardado) && guardado.every(esValida)) commit(guardado);
  } catch {
    /* si el guardado está dañado se arranca vacío */
  }
}

export function agregarNotificacion(n: Omit<ComentarioNotificacion, "id" | "leida">) {
  commit([{ ...n, id: `notif-${Date.now()}`, leida: false }, ...registros]);
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
