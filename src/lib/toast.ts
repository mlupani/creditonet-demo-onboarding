import { useSyncExternalStore } from "react";

// Toasts de retroalimentación por acción (breves, se cierran solos). Distintos de los avisos de
// comentarios sin leer (ToastNotificaciones), que persisten hasta que se atienden.
export type Toast = { id: number; texto: string };

const VACIO: Toast[] = [];
let toasts: Toast[] = VACIO;
let siguiente = 1;
const oyentes = new Set<() => void>();

const emitir = () => oyentes.forEach((o) => o());

export function mostrarToast(texto: string, ms = 4000) {
  const id = siguiente++;
  toasts = [...toasts, { id, texto }];
  emitir();
  setTimeout(() => cerrarToast(id), ms);
}

export function cerrarToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emitir();
}

export function useToasts() {
  return useSyncExternalStore(
    (cb) => {
      oyentes.add(cb);
      return () => oyentes.delete(cb);
    },
    () => toasts,
    () => VACIO
  );
}
