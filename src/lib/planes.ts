// ABM de Planes de cuotas (demo).
//
// Los planes se asignan al organismo y concentran las condiciones financieras, la habilitación
// (para qué perfiles sirve), el capital y la cuota máxima, los limitantes y la grilla de tasas.
// Un organismo puede tener varios planes: el de cada solicitud es el primero, por prioridad, que
// habilita al cliente (ver `seleccionarLinea` en config.ts).
//
// El estado vive acá, se persiste en la sesión y se vuelca en el lugar sobre PLANES_CUOTAS y
// sobre los planes de cada ORGANISMO (config.ts), que son los que lee el resto de la demo. La
// relación plan ↔ organismo se guarda del lado del plan (Vinculaciones).

import {
  ORGANISMOS,
  PLANES_CUOTAS,
  type EstadoProducto,
  type PlanCuotas,
} from "./config";
import { fechaHoy, parseFecha } from "./format";
import { crearStoreAbm } from "./store-abm";

export interface PlanAbm {
  codigo: string;
  // Lo que lee el flujo.
  config: PlanCuotas;
  // Organismos a los que se asigna el plan (Vinculaciones).
  organismos: string[];
}

export const SITUACIONES_BCRA = [1, 2, 3, 4, 5];
export const PERFILES_INTERNOS = [1, 2, 3, 4, 5];

export const ROTULO_BCRA: Record<number, string> = {
  1: "Situación 1 · Normal",
  2: "Situación 2 · Riesgo bajo / seguimiento especial",
  3: "Situación 3 · Con problemas",
  4: "Situación 4 · Alto riesgo de insolvencia",
  5: "Situación 5 · Irrecuperable",
};

export const ROTULO_PERFIL: Record<number, string> = {
  1: "Perfil 1 · Al día, sin atrasos",
  2: "Perfil 2 · Atrasos menores",
  3: "Perfil 3 · Con mora",
  4: "Perfil 4 · Mora prolongada",
  5: "Perfil 5 · Incobrable",
};

function estadoInicial(): PlanAbm[] {
  return Object.values(PLANES_CUOTAS).map((p, i) => ({
    codigo: String(i + 1).padStart(3, "0"),
    config: structuredClone(p),
    organismos: ORGANISMOS.filter((o) => o.planes.includes(p.id)).map((o) => o.id),
  }));
}

const porPrioridad = (a: PlanAbm, b: PlanAbm) =>
  a.config.prioridad - b.config.prioridad || a.config.nombre.localeCompare(b.config.nombre, "es");

const store = crearStoreAbm<PlanAbm>({
  clave: "creditonet.planes.v1",
  inicial: estadoInicial(),
  valido: (r) => !!r?.config?.id && Array.isArray(r.config.grilla) && Array.isArray(r.organismos),
  aplicar: (lista) => {
    for (const id of Object.keys(PLANES_CUOTAS)) delete PLANES_CUOTAS[id];
    for (const r of lista) PLANES_CUOTAS[r.config.id] = r.config;
    for (const o of ORGANISMOS)
      o.planes = lista
        .filter((r) => r.organismos.includes(o.id))
        .sort(porPrioridad)
        .map((r) => r.config.id);
  },
});

export const usePlanes = store.useLista;
export const hidratarPlanes = store.hidratar;
export const getPlanes = store.get;
// Para que otros stores (organismos) se mantengan al día cuando cambia un plan.
export const alCambiarPlanes = store.suscribir;

export function guardarPlan(p: PlanAbm) {
  store.commit(store.get().map((r) => (r.config.id === p.config.id ? p : r)));
}

export function cambiarEstadoPlan(id: string, estado: EstadoProducto) {
  store.commit(
    store.get().map((r) => (r.config.id === id ? { ...r, config: { ...r.config, estado } } : r))
  );
}

// Un organismo elige qué planes usa: la vinculación vive del lado del plan.
export function asignarPlanesAOrganismo(organismoId: string, planIds: string[]) {
  store.commit(
    store.get().map((r) => {
      const asignado = planIds.includes(r.config.id);
      const tiene = r.organismos.includes(organismoId);
      if (asignado === tiene) return r;
      return {
        ...r,
        organismos: asignado
          ? [...r.organismos, organismoId]
          : r.organismos.filter((o) => o !== organismoId),
      };
    })
  );
}

function idLibre(nombre: string): string {
  const base =
    nombre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "plan";
  let id = base;
  for (let n = 2; store.get().some((r) => r.config.id === id); n++) id = `${base}-${n}`;
  return id;
}

// Alta de plan: copia las condiciones de otro plan (o del primero) y queda sin organismos.
export function crearPlan(datos: { nombre: string; copiarDeId: string | null }): string {
  const lista = store.get();
  const id = idLibre(datos.nombre);
  const base = lista.find((r) => r.config.id === datos.copiarDeId) ?? lista[0];
  const siguiente = Math.max(0, ...lista.map((r) => Number(r.codigo) || 0)) + 1;
  const nuevo: PlanAbm = {
    codigo: String(siguiente).padStart(3, "0"),
    config: {
      ...structuredClone(base.config),
      id,
      nombre: datos.nombre,
      estado: "ACTIVO",
      vigenciaDesde: fechaHoy(),
      vigenciaHasta: null,
      prioridad: Math.max(0, ...lista.map((r) => r.config.prioridad)) + 1,
    },
    organismos: [],
  };
  store.commit([...lista, nuevo]);
  return id;
}

// --- Validación (por campo) ---

export function validarPlan(p: PlanAbm, todos: PlanAbm[]): Record<string, string> {
  const e: Record<string, string> = {};
  const c = p.config;
  const nombre = c.nombre.trim();
  if (!nombre) e.nombre = "Ingresá el nombre del plan.";
  else if (
    todos.some((r) => r.config.id !== c.id && r.config.nombre.trim().toLowerCase() === nombre.toLowerCase())
  )
    e.nombre = "Ya existe otro plan con ese nombre.";
  if (!Number.isInteger(c.prioridad) || c.prioridad < 1)
    e.prioridad = "La prioridad es un número entero desde 1.";

  const desde = parseFecha(c.vigenciaDesde);
  if (!desde) e.vigenciaDesde = "Ingresá la fecha de inicio de la vigencia.";
  if (c.vigenciaHasta) {
    const hasta = parseFecha(c.vigenciaHasta);
    if (!hasta) e.vigenciaHasta = "La fecha de fin no es válida.";
    else if (desde && hasta < desde) e.vigenciaHasta = "El fin no puede ser anterior al inicio.";
  }

  if (c.calculaIva && (c.ivaPct < 0 || c.ivaPct > 100)) e.ivaPct = "El IVA va de 0 a 100 %.";
  if (c.sellosPct < 0 || c.sellosPct > 100) e.sellosPct = "Los sellos van de 0 a 100 %.";
  const g = c.gastoOtorgamiento;
  if (g.valor < 0 || (g.tipo === "PORCENTAJE" && g.valor > 100))
    e.gastoOtorgamiento = "Revisá el valor del gasto de otorgamiento.";
  if (c.cargoAdministrativoPct < 0 || c.cargoAdministrativoPct > 100)
    e.cargoAdministrativoPct = "El cargo va de 0 a 100 %.";

  if (c.situacionesBcra.length === 0) e.situacionesBcra = "Aceptá al menos una situación BCRA.";
  if (c.condicionesLaborales.length === 0)
    e.condicionesLaborales = "Habilitá al menos una condición laboral.";
  if (c.perfilesInternos.length === 0) e.perfilesInternos = "Habilitá al menos un perfil interno.";

  if (c.montoMaximo <= 0) e.montoMaximo = "El capital máximo debe ser mayor a cero.";
  if (c.montoMaximoRenovacion < c.montoMaximo)
    e.montoMaximoRenovacion = "El tope por renovación no puede ser menor al capital máximo.";
  if (c.rciMaxPct <= 0 || c.rciMaxPct > 100) e.rciMaxPct = "La relación cuota-ingreso va de 1 a 100 %.";
  if (c.endeudamientoMaxPct <= 0 || c.endeudamientoMaxPct > 100)
    e.endeudamientoMaxPct = "El endeudamiento va de 1 a 100 %.";
  if (c.smvmBolsillo < 0) e.smvmBolsillo = "El mínimo de bolsillo no puede ser negativo.";

  const l = c.limitantes;
  const pcts = [
    l.clienteNuevoPct,
    l.clienteExistentePct,
    l.situacionBcraDistintaDeUnoPct,
    ...Object.values(l.condicionLaboralPct).map((v) => v ?? 0),
  ];
  if (pcts.some((v) => v < 0 || v > 100)) e.limitantes = "Los recortes van de 0 a 100 %.";

  if (c.bonificaciones.some((b) => b.pct < 0 || b.pct > 100 || !b.concepto.trim()))
    e.bonificaciones = "Cada bonificación necesita un concepto y un porcentaje de 0 a 100 %.";
  if (c.topes.montoAnalista > c.topes.montoSupervisor)
    e.topes = "El tope del analista no puede superar al del supervisor.";

  const plazos = c.grilla.map((f) => f.plazo);
  if (c.grilla.length === 0) e.grilla = "La grilla necesita al menos un plazo.";
  else if (new Set(plazos).size !== plazos.length) e.grilla = "Hay plazos repetidos en la grilla.";
  else if (c.grilla.some((f) => f.tna <= 0)) e.grilla = "Cada plazo necesita una TNA mayor a cero.";
  return e;
}
