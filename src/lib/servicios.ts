// ABM de servicios (demo): catálogo de servicios que un plan puede cobrar como cargo periódico
// dentro de la cuota (seguro de vida, asistencia, sepelio…). Un plan puede cargar más de uno.
//
// El estado vive acá y se persiste en la sesión. Un servicio inactivo no se puede elegir en un
// cargo nuevo; uno que algún plan usa no se puede eliminar (se desactiva).

import type { TipoCargo } from "./config";
import { getPlanes } from "./planes";
import { crearStoreAbm } from "./store-abm";

export type EstadoServicio = "ACTIVO" | "INACTIVO";

export interface Servicio {
  id: string;
  nombre: string;
  descripcion: string;
  // Forma de cálculo del cargo: el plan sólo carga el valor (monto o porcentaje).
  tipo: TipoCargo;
  estado: EstadoServicio;
}

const INICIAL: Servicio[] = [
  { id: "srv-cargo-administrativo", nombre: "Cargo administrativo / cobranza", descripcion: "Gastos de administración y cobranza de la cuota.", tipo: "PORCENTAJE_CUOTA", estado: "ACTIVO" },
  { id: "srv-seguro-vida", nombre: "Seguro de vida", descripcion: "Cobertura por fallecimiento e invalidez del titular.", tipo: "PORCENTAJE_CAPITAL", estado: "ACTIVO" },
  { id: "srv-asistencia", nombre: "Asistencia al cliente", descripcion: "Asistencia médica y legal telefónica.", tipo: "MONTO_FIJO", estado: "ACTIVO" },
  { id: "srv-sepelio", nombre: "Servicio de sepelio", descripcion: "Cobertura de gastos de sepelio.", tipo: "MONTO_FIJO", estado: "ACTIVO" },
];

const store = crearStoreAbm<Servicio>({
  clave: "creditonet.servicios.v1",
  inicial: INICIAL,
  valido: (s) => !!s?.id && typeof s.nombre === "string",
  aplicar: () => {},
  // Servicios guardados antes de tener forma de cálculo: monto fijo por cuota.
  migrar: (s) => ({ ...s, tipo: s.tipo ?? "MONTO_FIJO" }),
});

export const useServicios = store.useLista;
export const hidratarServicios = store.hidratar;
export const getServicios = store.get;

export function guardarServicio(s: Servicio) {
  const existe = store.get().some((x) => x.id === s.id);
  store.commit(existe ? store.get().map((x) => (x.id === s.id ? s : x)) : [...store.get(), s]);
}

export function nuevoServicio(): Servicio {
  return { id: `srv-${Date.now().toString(36)}`, nombre: "", descripcion: "", tipo: "MONTO_FIJO", estado: "ACTIVO" };
}

// Planes que cobran el servicio como cargo.
export function planesDelServicio(id: string): string[] {
  return getPlanes()
    .filter((p) => p.config.cargos.some((c) => c.servicioId === id))
    .map((p) => p.config.nombre);
}

export function eliminarServicio(id: string): { ok: true } | { ok: false; error: string } {
  const usados = planesDelServicio(id);
  if (usados.length > 0)
    return { ok: false, error: `Lo usan ${usados.length === 1 ? "el plan" : "los planes"}: ${usados.join(", ")}. Desactivalo en su lugar.` };
  store.commit(store.get().filter((s) => s.id !== id));
  return { ok: true };
}

export function validarServicio(s: Servicio, todos: Servicio[]): Record<string, string> {
  const e: Record<string, string> = {};
  const nombre = s.nombre.trim();
  if (!nombre) e.nombre = "Ingresá el nombre del servicio.";
  else if (todos.some((x) => x.id !== s.id && x.nombre.trim().toLowerCase() === nombre.toLowerCase()))
    e.nombre = "Ya existe un servicio con ese nombre.";
  return e;
}
