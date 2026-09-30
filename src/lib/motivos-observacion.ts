// Tipificación de observaciones: los motivos que el analista elige al observar una solicitud.
//
// Es un parámetro editable (alta, edición y baja desde /parametros). El estado vive acá y se
// persiste en la sesión. Cada observación guarda el texto del motivo, así que dar de baja o
// renombrar uno no altera las observaciones ya registradas.

import { crearStoreAbm } from "./store-abm";

export interface MotivoObservacion {
  id: string;
  nombre: string;
}

// Motivos iniciales; la lista definitiva la completa el negocio desde la pantalla de parámetros.
const MOTIVOS_INICIALES = [
  "Volver a subir imagen del legajo (titular o garante)",
  "Agregar referencia",
  "Agregar garante",
  "Cambiar tarjeta",
];

const store = crearStoreAbm<MotivoObservacion>({
  clave: "creditonet.motivos-observacion.v1",
  inicial: MOTIVOS_INICIALES.map((nombre, i) => ({ id: `mo-${i + 1}`, nombre })),
  valido: (r) => typeof r?.id === "string" && typeof r?.nombre === "string",
  aplicar: () => {},
});

export const useMotivosObservacion = store.useLista;
export const hidratarMotivosObservacion = store.hidratar;

const normalizar = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

// Devuelve el error de validación del nombre, o undefined si es válido. `ignorarId` excluye el
// motivo que se está editando de la comprobación de duplicados.
export function errorNombreMotivo(nombre: string, ignorarId?: string): string | undefined {
  if (!nombre.trim()) return "Ingresá el nombre del motivo.";
  const repetido = store
    .get()
    .some((m) => m.id !== ignorarId && normalizar(m.nombre) === normalizar(nombre));
  return repetido ? "Ya existe un motivo con ese nombre." : undefined;
}

export function crearMotivoObservacion(nombre: string) {
  const usados = store.get().map((m) => Number(m.id.replace("mo-", "")) || 0);
  const id = `mo-${Math.max(0, ...usados) + 1}`;
  store.commit([...store.get(), { id, nombre: nombre.trim().replace(/\s+/g, " ") }]);
}

export function editarMotivoObservacion(id: string, nombre: string) {
  store.commit(
    store
      .get()
      .map((m) => (m.id === id ? { ...m, nombre: nombre.trim().replace(/\s+/g, " ") } : m))
  );
}

export function eliminarMotivoObservacion(id: string) {
  store.commit(store.get().filter((m) => m.id !== id));
}
