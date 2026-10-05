import { useSyncExternalStore } from "react";

// Estado colapsado (solo íconos) de un menú lateral. Se persiste en localStorage para recordarlo
// entre navegaciones y se sincroniza entre pestañas. Cada menú usa su propia clave.
export function crearEstadoColapsable(key: string) {
  const oyentes = new Set<() => void>();
  let colapsado: boolean | null = null;

  function leerGuardado(): boolean {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  }

  const emitir = () => oyentes.forEach((o) => o());

  function leer(): boolean {
    if (colapsado === null) colapsado = leerGuardado();
    return colapsado;
  }

  function alternar() {
    colapsado = !leer();
    try {
      localStorage.setItem(key, colapsado ? "1" : "0");
    } catch {
      // Sin storage disponible el estado vive sólo en memoria.
    }
    emitir();
  }

  function recargar() {
    colapsado = null;
    emitir();
  }

  function suscribir(cb: () => void) {
    oyentes.add(cb);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) recargar();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      oyentes.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  }

  function useColapsado() {
    return useSyncExternalStore(suscribir, leer, () => false);
  }

  return { leer, alternar, recargar, useColapsado };
}

// Sidebar principal de escritorio.
export const SIDEBAR_COLAPSADO_KEY = "creditonet:sidebar-colapsado";
const sidebar = crearEstadoColapsable(SIDEBAR_COLAPSADO_KEY);
export const leerSidebarColapsado = sidebar.leer;
export const alternarSidebarColapsado = sidebar.alternar;
export const recargarSidebarColapsado = sidebar.recargar;
export const useSidebarColapsado = sidebar.useColapsado;

// Menú de secciones de las pantallas de detalle (producto, organismo, plan, motor).
export const NAV_SECCIONES_COLAPSADO_KEY = "creditonet:nav-secciones-colapsado";
const navSecciones = crearEstadoColapsable(NAV_SECCIONES_COLAPSADO_KEY);
export const leerNavSeccionesColapsado = navSecciones.leer;
export const alternarNavSeccionesColapsado = navSecciones.alternar;
export const recargarNavSeccionesColapsado = navSecciones.recargar;
export const useNavSeccionesColapsado = navSecciones.useColapsado;
