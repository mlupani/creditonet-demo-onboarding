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
  CANALES,
  ORGANISMOS,
  PLANES_CUOTAS,
  PRODUCTOS_CONFIG,
  VENDEDORES,
  migrarSistemaAmortizacion,
  RANGO_CAPITAL_GRILLA_BASE,
  MAX_PLAZO_GRILLA,
  terminosDe,
  MAX_RANGOS_SUELDO,
  rangosCuotaIniciales,
  normalizarCargos,
  normalizarLimitantes,
  normalizarGasto,
  TRATAMIENTOS_GASTO,
  type EstadoProductoAbm,
  type PlanCuotas,
} from "./config";
import { fechaHoy, parseFecha } from "./format";
import { PROVINCIAS } from "./parametros";
import type { ResultadoEstado } from "./productos";
import { crearStoreAbm } from "./store-abm";

export interface PlanAbm {
  codigo: string;
  // Lo que lee el flujo.
  config: PlanCuotas;
  // Vinculaciones, en cascada: productos → organismos de esos productos → canales de venta →
  // vendedores de esos canales → provincias. Sólo los organismos cambian el flujo (deciden qué
  // planes evalúa cada solicitud); el resto es de ejemplo.
  productos: string[];
  organismos: string[];
  canales: string[];
  vendedores: string[];
  provincias: string[];
}

// --- Vinculaciones en cascada ---

export const productosVinculables = () =>
  Object.values(PRODUCTOS_CONFIG).filter((p) => p.estado !== "ELIMINADO");

export const organismosDeProductos = (productos: string[]) =>
  ORGANISMOS.filter((o) => o.estado !== "ELIMINADO" && o.productos.some((p) => productos.includes(p)));

// Canales en los que se ofrece alguno de los productos.
export const canalesDeProductos = (productos: string[]) =>
  CANALES.filter((c) => productos.some((p) => PRODUCTOS_CONFIG[p]?.canales.includes(c.id)));

export const vendedoresDeCanalesPlan = (canales: string[]) =>
  VENDEDORES.filter((v) => v.canales.some((c) => canales.includes(c)));

// Cada nivel queda acotado a lo que permite el anterior. Los organismos de un producto recién
// elegido entran todos tildados (se pueden quitar); los de un producto que se quita, salen.
export function ajustarVinculaciones(r: PlanAbm, productosAntes: string[] = r.productos): PlanAbm {
  const nuevos = r.productos.filter((p) => !productosAntes.includes(p));
  const validos = organismosDeProductos(r.productos).map((o) => o.id);
  const agregados = organismosDeProductos(nuevos)
    .map((o) => o.id)
    .filter((id) => !r.organismos.includes(id));
  const organismos = [...r.organismos.filter((id) => validos.includes(id)), ...agregados];
  const canalesValidos = canalesDeProductos(r.productos).map((c) => c.id);
  const canales = r.canales.filter((id) => canalesValidos.includes(id));
  const vendedoresValidos = vendedoresDeCanalesPlan(canales).map((v) => v.id);
  const vendedores = r.vendedores.filter((id) => vendedoresValidos.includes(id));
  return { ...r, organismos, canales, vendedores };
}

// Planes guardados antes de la cascada: los productos salen de sus organismos y el resto arranca
// con todo lo que esos productos permiten.
function conVinculaciones(r: Partial<PlanAbm> & Pick<PlanAbm, "organismos">) {
  const productos =
    r.productos ??
    Object.keys(PRODUCTOS_CONFIG).filter((p) =>
      ORGANISMOS.some((o) => r.organismos.includes(o.id) && o.productos.includes(p))
    );
  const canales = r.canales ?? canalesDeProductos(productos).map((c) => c.id);
  return {
    productos,
    canales,
    vendedores: r.vendedores ?? vendedoresDeCanalesPlan(canales).map((v) => v.id),
    provincias: r.provincias ?? [...PROVINCIAS],
  };
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
  return Object.values(PLANES_CUOTAS).map((p, i) => {
    const organismos = ORGANISMOS.filter((o) => o.planes.includes(p.id)).map((o) => o.id);
    return {
      codigo: String(i + 1).padStart(3, "0"),
      config: structuredClone(p),
      organismos,
      ...conVinculaciones({ organismos }),
    };
  });
}

const porPrioridad = (a: PlanAbm, b: PlanAbm) =>
  a.config.prioridad - b.config.prioridad || a.config.nombre.localeCompare(b.config.nombre, "es");

const store = crearStoreAbm<PlanAbm>({
  clave: "creditonet.planes.v1",
  inicial: estadoInicial(),
  valido: (r) => !!r?.config?.id && Array.isArray(r.config.grilla) && Array.isArray(r.organismos),
  migrar: (r) => ({
    ...r,
    ...conVinculaciones(r),
    config: { ...r.config, sistema: migrarSistemaAmortizacion(r.config.sistema) },
  }),
  aplicar: (lista) => {
    // Planes guardados con el check `seCapitaliza`: se pasan al select de tratamiento.
    for (const r of lista) {
      r.config.gastoOtorgamiento = normalizarGasto(r.config.gastoOtorgamiento);
      // Planes guardados con un único cargo administrativo: pasa a la lista de cargos periódicos.
      r.config.cargos = normalizarCargos(r.config);
      delete (r.config as { cargoAdministrativo?: unknown }).cargoAdministrativo;
      delete (r.config as { cargoAdministrativoPct?: number }).cargoAdministrativoPct;
      r.config.rangosSueldoNeto ??= [];
      // Bonificaciones guardadas con concepto y %: eran de ejemplo, se descartan.
      r.config.bonificaciones = (r.config.bonificaciones ?? []).filter(
        (b) => typeof b.cuotasBonificadas === "number"
      );
      r.config.capitalGrilla ??= { ...RANGO_CAPITAL_GRILLA_BASE };
      r.config.limitantes = normalizarLimitantes(r.config.limitantes, r.config.situacionesBcra);
      // Planes guardados con RCI y SMVM únicos: se reparten en los 5 rangos iniciales.
      const previo = r.config as { rciMaxPct?: number; smvmBolsillo?: number };
      r.config.rangosCuota ??= rangosCuotaIniciales(previo.rciMaxPct ?? 40, previo.smvmBolsillo ?? 0);
      delete previo.rciMaxPct;
      delete previo.smvmBolsillo;
    }
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

// Único punto donde cambia el estado: activar (desde borrador o suspendido) valida el plan acá
// además de en la pantalla, para que ninguna vía (lista, detalle) pueda activar un plan inválido.
export function cambiarEstadoPlan(id: string, estado: EstadoProductoAbm): ResultadoEstado {
  const actual = store.get().find((r) => r.config.id === id);
  if (!actual) return { ok: false, error: "El plan no existe." };
  if (estado === "ACTIVO") {
    const primero = Object.values(validarPlan(actual, store.get()))[0];
    if (primero) return { ok: false, error: `No se puede activar el plan: ${primero}` };
  }
  store.commit(
    store.get().map((r) => (r.config.id === id ? { ...r, config: { ...r.config, estado } } : r))
  );
  return { ok: true };
}

// Un organismo elige qué planes usa: la vinculación vive del lado del plan.
export function asignarPlanesAOrganismo(organismoId: string, planIds: string[]) {
  store.commit(
    store.get().map((r) => {
      const asignado = planIds.includes(r.config.id);
      const tiene = r.organismos.includes(organismoId);
      if (asignado === tiene) return r;
      const organismos = asignado
        ? [...r.organismos, organismoId]
        : r.organismos.filter((o) => o !== organismoId);
      // Asignado desde el organismo: su producto pasa a estar vinculado al plan.
      const productos = asignado
        ? [
            ...r.productos,
            ...(ORGANISMOS.find((o) => o.id === organismoId)?.productos ?? []).filter(
              (p) => !r.productos.includes(p)
            ),
          ]
        : r.productos;
      return { ...r, organismos, productos };
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

// Alta de plan: copia las condiciones de otro plan (o del primero) y queda sin organismos. Nace
// en borrador: no se ofrece hasta que se lo activa.
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
      estado: "BORRADOR",
      vigenciaDesde: fechaHoy(),
      vigenciaHasta: null,
      prioridad: Math.max(0, ...lista.map((r) => r.config.prioridad)) + 1,
    },
    productos: [],
    organismos: [],
    canales: [],
    vendedores: [],
    provincias: [],
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

  const g = c.gastoOtorgamiento;
  if (g.valor < 0 || (g.tipo === "PORCENTAJE" && g.valor > 100))
    e.gastoOtorgamiento = "Revisá el valor del gasto de otorgamiento.";
  if (!TRATAMIENTOS_GASTO.some((t) => t.value === g.tratamiento))
    e.gastoTratamiento = "Elegí si el gasto se capitaliza o se distribuye en las cuotas.";
  const cargosInvalidos = c.cargos.some(
    (g) => !g.servicioId || g.valor < 0 || (g.tipo !== "MONTO_FIJO" && g.valor > 100)
  );
  if (cargosInvalidos)
    e.cargos = "Elegí el cargo de cada fila y cargá un valor válido (los porcentajes van de 0 a 100 %).";

  if (c.situacionesBcra.length === 0) e.situacionesBcra = "Aceptá al menos una situación BCRA.";
  if (c.condicionesLaborales.length === 0)
    e.condicionesLaborales = "Habilitá al menos una condición laboral.";
  if (c.perfilesInternos.length === 0) e.perfilesInternos = "Habilitá al menos un perfil interno.";

  const rangos = [...c.rangosSueldoNeto].sort((a, b) => a.desde - b.desde);
  if (rangos.length > MAX_RANGOS_SUELDO)
    e.rangosSueldoNeto = `El plan admite hasta ${MAX_RANGOS_SUELDO} rangos de sueldo.`;
  else if (rangos.some((r) => r.capitalMaximo <= 0 || (r.hasta !== null && r.hasta <= r.desde)))
    e.rangosSueldoNeto = "Cada rango necesita un sueldo hasta mayor al desde y un capital máximo mayor a cero.";
  else if (rangos.some((r, i) => i > 0 && (rangos[i - 1].hasta === null || r.desde < rangos[i - 1].hasta!)))
    e.rangosSueldoNeto = "Los rangos de sueldo no pueden superponerse.";
  const rangosCuota = [...c.rangosCuota].sort((a, b) => a.desde - b.desde);
  if (rangosCuota.length === 0) e.rangosCuota = "Cargá al menos un rango de sueldo.";
  else if (rangosCuota.some((r) => r.hasta !== null && r.hasta <= r.desde))
    e.rangosCuota = "En cada rango el sueldo hasta tiene que ser mayor al desde.";
  else if (rangosCuota.some((r) => r.smvmBolsillo < 0 || r.rciPct <= 0 || r.rciPct > 100 || r.cuotaMaxima <= 0))
    e.rangosCuota = "Cada rango necesita un RCI de 1 a 100 %, un mínimo de bolsillo sin negativos y una cuota máxima mayor a cero.";
  else if (rangosCuota.some((r, i) => i > 0 && (rangosCuota[i - 1].hasta === null || r.desde < rangosCuota[i - 1].hasta!)))
    e.rangosCuota = "Los rangos de sueldo no pueden superponerse.";
  if (c.endeudamientoMaxPct <= 0 || c.endeudamientoMaxPct > 100)
    e.endeudamientoMaxPct = "El endeudamiento va de 1 a 100 %.";

  const l = c.limitantes;
  const pcts = [
    l.bcra.pct,
    l.buroInterno.pct,
    l.sueldoRecalculadoPct,
  ];
  if (pcts.some((v) => v < 0 || v > 100)) e.limitantes = "Los recortes van de 0 a 100 %.";

  const plazoMinimo = Math.min(...c.grilla.map((f) => f.plazo));
  if (c.bonificaciones.some((b) => !b.nombre.trim()))
    e.bonificaciones = "Cada campaña necesita un nombre.";
  else if (c.bonificaciones.some((b) => !Number.isInteger(b.cuotasBonificadas) || b.cuotasBonificadas < 1))
    e.bonificaciones = "Las cuotas bonificadas tienen que ser un número entero de 1 en adelante.";
  else if (c.bonificaciones.some((b) => b.cuotasBonificadas >= plazoMinimo))
    e.bonificaciones = `Las cuotas bonificadas tienen que ser menos que el plazo más corto de la grilla (${plazoMinimo}).`;
  if (c.topes.montoAnalista > c.topes.montoSupervisor)
    e.topes = "El tope del analista no puede superar al del supervisor.";

  const enteroEnRango = (n: number | undefined, desde: number) =>
    Number.isInteger(n) && (n as number) >= desde && (n as number) <= MAX_PLAZO_GRILLA;
  if (c.grilla.length === 0) e.grilla = "La grilla necesita al menos un plazo.";
  else if (c.grilla.some((f) => !enteroEnRango(f.plazo, 1)))
    e.grilla = `Los plazos son números enteros de cuotas, de 1 a ${MAX_PLAZO_GRILLA}.`;
  else if (
    c.grilla.some(
      (f) =>
        f.modo === "CORRIDO" &&
        (!enteroEnRango(f.plazoHasta, f.plazo + 1) || !Number.isInteger(f.cada ?? 1) || (f.cada ?? 1) < 1)
    )
  )
    e.grilla = "En cada rango, la cuota final tiene que ser mayor a la inicial y “cada” un entero desde 1.";
  else {
    const plazos = terminosDe(c.grilla).map((t) => t.plazo);
    if (new Set(plazos).size !== plazos.length)
      e.grilla = "Hay plazos repetidos o rangos que se superponen en la grilla.";
    else if (c.grilla.some((f) => f.tna <= 0)) e.grilla = "Cada plazo o rango necesita una TNA mayor a cero.";
  }
  const cg = c.capitalGrilla;
  if (!e.grilla) {
    if (cg.minimo <= 0 || cg.maximo < cg.minimo)
      e.grilla = "El capital máximo de la grilla tiene que ser mayor o igual al mínimo, y el mínimo mayor a cero.";
    else if (!(cg.salto > 0)) e.grilla = "El salto de capital tiene que ser mayor a cero.";
    else if (cg.maximo / cg.salto > 500)
      e.grilla = "El salto es muy chico para ese capital máximo: la grilla tendría más de 500 filas.";
  }
  return e;
}
