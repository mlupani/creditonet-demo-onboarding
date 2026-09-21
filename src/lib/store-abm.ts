// Store mínimo para los ABM de la demo: una lista en memoria que se persiste en la sesión, se
// vuelca sobre la configuración que lee el flujo (`aplicar`) y se puede observar desde React.

import { useSyncExternalStore } from "react";

export function crearStoreAbm<T>(opciones: {
  clave: string;
  inicial: T[];
  // Vuelca la lista sobre los registros de config.ts que lee el resto de la demo.
  aplicar: (lista: T[]) => void;
  // Valida el guardado antes de restaurarlo.
  valido: (registro: T) => boolean;
}) {
  let registros = opciones.inicial;
  const oyentes = new Set<() => void>();

  function commit(lista: T[]) {
    registros = lista;
    opciones.aplicar(lista);
    try {
      sessionStorage.setItem(opciones.clave, JSON.stringify(lista));
    } catch {
      /* demo sin persistencia si el storage no está disponible */
    }
    oyentes.forEach((f) => f());
  }

  function hidratar() {
    try {
      const raw = sessionStorage.getItem(opciones.clave);
      if (!raw) return;
      const guardado = JSON.parse(raw) as T[];
      if (Array.isArray(guardado) && guardado.length > 0 && guardado.every(opciones.valido))
        commit(guardado);
    } catch {
      /* si el guardado está dañado se queda con los valores de ejemplo */
    }
  }

  function suscribir(f: () => void) {
    oyentes.add(f);
    return () => oyentes.delete(f);
  }

  function useLista(): T[] {
    return useSyncExternalStore(
      suscribir,
      () => registros,
      () => opciones.inicial
    );
  }

  return { get: () => registros, commit, hidratar, suscribir, useLista };
}
