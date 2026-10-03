import { useSyncExternalStore } from "react";

// Estado del sidebar de escritorio (colapsado = solo íconos). Se persiste en localStorage para
// recordarlo entre navegaciones y se sincroniza entre pestañas.
export const SIDEBAR_COLAPSADO_KEY = "creditonet:sidebar-colapsado";

const oyentes = new Set<() => void>();
let colapsado: boolean | null = null;

function leerGuardado(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLAPSADO_KEY) === "1";
  } catch {
    return false;
  }
}

const emitir = () => oyentes.forEach((o) => o());

export function leerSidebarColapsado(): boolean {
  if (colapsado === null) colapsado = leerGuardado();
  return colapsado;
}

export function alternarSidebarColapsado() {
  colapsado = !leerSidebarColapsado();
  try {
    localStorage.setItem(SIDEBAR_COLAPSADO_KEY, colapsado ? "1" : "0");
  } catch {
    // Sin storage disponible el estado vive sólo en memoria.
  }
  emitir();
}

export function recargarSidebarColapsado() {
  colapsado = null;
  emitir();
}

function suscribir(cb: () => void) {
  oyentes.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SIDEBAR_COLAPSADO_KEY) recargarSidebarColapsado();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    oyentes.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useSidebarColapsado() {
  return useSyncExternalStore(suscribir, leerSidebarColapsado, () => false);
}
