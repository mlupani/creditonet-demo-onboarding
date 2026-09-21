// ABM de Organismos (demo).
//
// Producto = configuración general; Organismo = particularizaciones (Producto §2). El organismo
// no define su configuración completa: hereda la del producto y sólo guarda las *excepciones*,
// y las guarda POR PRODUCTO (Organismo × Producto): Policía puede pisar cosas distintas sobre el
// préstamo personal y sobre el adelanto de sueldo.
//
// Una excepción no rige al guardarla: queda pendiente de refrendación del supervisor. Los demás
// cambios (nombre, vigencia, productos habilitados…) se aplican directo.
//
// Igual que el ABM de Productos, el estado vive acá, se persiste en la sesión y se vuelca en el
// lugar sobre ORGANISMOS (config.ts). La relación organismo ↔ producto se guarda del lado del
// producto: este store la refleja y, al guardar, la devuelve al store de productos.

import {
  ORGANISMOS,
  SESION_PARAMETROS,
  SESION_SUPERVISOR,
  excepcionesVacias,
  type EstadoProducto,
  type ExcepcionesOrganismo,
  type OrganismoConfig,
} from "./config";
import {
  alCambiarProductos,
  asignarProductosAOrganismo,
  getProductos,
  type ExtrasProducto,
} from "./productos";
import { alCambiarPlanes, asignarPlanesAOrganismo, getPlanes } from "./planes";
import { fechaHoy, parseFecha, selloTiempo } from "./format";
import { crearStoreAbm } from "./store-abm";

// --- Modelo ---

// Valores de ejemplo de la ficha del organismo.
export interface ExtrasOrganismo {
  cuit: string;
  rubro: string;
  contactoNombre: string;
  contactoEmail: string;
  diaCorteHaberes: number;
}

// Excepciones que esperan la refrendación del supervisor. No rigen hasta entonces.
export interface PropuestaExcepciones {
  excepciones: Record<string, ExcepcionesOrganismo>;
  solicitadoPor: string;
  fecha: string;
}

export interface OrganismoAbm {
  codigo: string;
  // Lo que lee el flujo: estado, vigencia, plan, productos y excepciones aplicadas (por producto).
  config: OrganismoConfig;
  extras: ExtrasOrganismo;
  pendiente: PropuestaExcepciones | null;
  refrendada: { por: string; fecha: string } | null;
}

// Qué valores del producto puede pisar el organismo, agrupados por sección del detalle.
export const EXTRAS_POR_SECCION = {
  vencimiento: [
    "diaCorte",
    "tipoVencimiento",
    "diaVencimientoFijo",
    "movimientoMes",
    "diasValidezCondiciones",
    "diasPlazoObservacion",
  ],
  permisos: [
    "permiteCreditosParalelos",
    "visibleDashboard",
    "seContabiliza",
    "centroCostos",
    "gestionPrestamos",
    "permiteRenovacion",
    "cargoRenovacionPct",
    "permiteCancelacionAnticipada",
    "cargoCancelacionPct",
    "permiteCambioPrimerVencimiento",
  ],
  financieros: ["recalculoNeto"],
  punitorios: ["tramosPunitorios", "modificarCarteraActiva", "modalidadesCobro"],
  firma: ["modalidadFirma"],
  vendedores: ["vendedores"],
  notificaciones: ["notificaciones"],
} as const satisfies Record<string, readonly (keyof ExtrasProducto)[]>;

const EXTRAS_ORGANISMO_BASE: ExtrasOrganismo = {
  cuit: "30-00000000-0",
  rubro: "Administración pública",
  contactoNombre: "",
  contactoEmail: "",
  diaCorteHaberes: 20,
};

const EXTRAS_POR_ORGANISMO: Record<string, Partial<ExtrasOrganismo>> = {
  "empleados-salud": {
    cuit: "30-71234567-8",
    rubro: "Salud - Servicios sanatoriales",
    contactoNombre: "Recursos Humanos",
    contactoEmail: "rrhh@salud.gob.example",
  },
  "policia-provincial": {
    cuit: "30-70123456-4",
    rubro: "Seguridad",
    contactoNombre: "Jefatura de Personal",
    contactoEmail: "personal@policia.gob.example",
    diaCorteHaberes: 25,
  },
  "jubilados-provincial": {
    cuit: "30-69876543-1",
    rubro: "Administración pública",
    contactoNombre: "Caja de Jubilaciones",
    contactoEmail: "convenios@caja.gob.example",
    diaCorteHaberes: 10,
  },
  "docentes-provincial": {
    cuit: "30-70765432-9",
    rubro: "Educación",
    contactoNombre: "Dirección de Liquidaciones",
    contactoEmail: "liquidaciones@educacion.gob.example",
  },
  municipales: {
    cuit: "30-99999999-5",
    rubro: "Administración pública",
    contactoNombre: "Oficina de Haberes",
    contactoEmail: "haberes@municipio.gob.example",
  },
};

// Excepciones de ejemplo ya cargadas sobre el préstamo personal, para que la herencia se vea
// desde el primer momento.
const EXCEPCIONES_INICIALES: Record<string, Partial<ExtrasProducto>> = {
  // Firma: el producto admite electrónica y física; la Policía sólo firma en papel.
  "policia-provincial": { modalidadFirma: "FISICA", diaCorte: 25 },
  // Punitorios: el producto tiene 5 tramos; Jubilados sólo 3 y más suaves.
  "jubilados-provincial": {
    diasValidezCondiciones: 45,
    tramosPunitorios: [
      { desdeDia: 1, punitorioPct: 30, diasGracia: 10, montoTopeSinIva: 30_000 },
      { desdeDia: 31, punitorioPct: 40, diasGracia: 0, montoTopeSinIva: 60_000 },
      { desdeDia: 91, punitorioPct: 50, diasGracia: 0, montoTopeSinIva: 100_000 },
    ],
  },
};

function estadoInicial(): OrganismoAbm[] {
  return ORGANISMOS.map((o, i) => {
    const config = structuredClone(o);
    const ejemplo = EXCEPCIONES_INICIALES[o.id];
    const producto = config.productos.includes("prestamo-personal")
      ? "prestamo-personal"
      : config.productos[0];
    if (ejemplo && producto) {
      const exc = config.excepciones[producto] ?? excepcionesVacias();
      config.excepciones[producto] = { ...exc, extras: structuredClone(ejemplo) };
    }
    return {
      codigo: String(i + 1).padStart(3, "0"),
      config,
      extras: { ...EXTRAS_ORGANISMO_BASE, ...(EXTRAS_POR_ORGANISMO[o.id] ?? {}) },
      pendiente: null,
      refrendada: null,
    };
  });
}

// --- Store ---

// Planes vinculados, en orden de prioridad (la vinculación se define del lado del plan).
function planesDe(organismoId: string): string[] {
  return getPlanes()
    .filter((p) => p.organismos.includes(organismoId))
    .sort(
      (a, b) =>
        a.config.prioridad - b.config.prioridad || a.config.nombre.localeCompare(b.config.nombre, "es")
    )
    .map((p) => p.config.id);
}

function productosDe(organismoId: string): string[] {
  return getProductos()
    .filter((p) => p.organismos.includes(organismoId))
    .map((p) => p.config.id);
}

const store = crearStoreAbm<OrganismoAbm>({
  clave: "creditonet.organismos.v4",
  inicial: estadoInicial(),
  valido: (r) => !!r?.config?.id && !!r.config.excepciones && !!r.extras,
  aplicar: (lista) => {
    ORGANISMOS.splice(
      0,
      ORGANISMOS.length,
      ...lista.map((r) =>
        structuredClone({ ...r.config, productos: productosDe(r.config.id), planes: planesDe(r.config.id) })
      )
    );
  },
});

// Los productos habilitados del organismo salen del store de productos: cuando éste cambia, el
// organismo se actualiza para no quedar desfasado. No hace nada hasta que este store se hidrate:
// si no, al hidratar los productos pisaría con valores iniciales lo que quedó guardado.
let hidratado = false;

function resincronizar() {
  if (!hidratado) return;
  const actual = store.get();
  const nueva = actual.map((r) => {
    const productos = productosDe(r.config.id);
    const planes = planesDe(r.config.id);
    return JSON.stringify(productos) === JSON.stringify(r.config.productos) &&
      JSON.stringify(planes) === JSON.stringify(r.config.planes)
      ? r
      : { ...r, config: { ...r.config, productos, planes } };
  });
  if (nueva.some((r, i) => r !== actual[i])) store.commit(nueva);
}
alCambiarProductos(resincronizar);
alCambiarPlanes(resincronizar);

export const useOrganismos = store.useLista;

// Se llama al hidratar la sesión, después de hidratar los productos.
export function hidratarOrganismos() {
  store.hidratar();
  hidratado = true;
  resincronizar();
}

// Lo que se edita: las excepciones de partida son las propuestas pendientes, si las hay, para
// no perder el trabajo ya cargado.
export function borradorDe(o: OrganismoAbm): OrganismoAbm {
  const base = structuredClone(o);
  if (o.pendiente) base.config.excepciones = structuredClone(o.pendiente.excepciones);
  return base;
}

// Guarda el borrador. Los cambios comunes rigen enseguida; las excepciones quedan pendientes de
// refrendación del supervisor (o se descartan si el borrador vuelve a coincidir con lo aplicado).
export function guardarOrganismo(borrador: OrganismoAbm) {
  const actual = store.get().find((r) => r.config.id === borrador.config.id);
  if (!actual) return;
  asignarProductosAOrganismo(borrador.config.id, borrador.config.productos);
  asignarPlanesAOrganismo(borrador.config.id, borrador.config.planes);
  const cambiaExcepciones =
    JSON.stringify(borrador.config.excepciones) !== JSON.stringify(actual.config.excepciones);
  const nuevo: OrganismoAbm = {
    ...borrador,
    config: { ...borrador.config, excepciones: actual.config.excepciones },
    pendiente: cambiaExcepciones
      ? {
          excepciones: structuredClone(borrador.config.excepciones),
          solicitadoPor: SESION_PARAMETROS.nombre,
          fecha: selloTiempo(),
        }
      : null,
    refrendada: actual.refrendada,
  };
  store.commit(store.get().map((r) => (r.config.id === nuevo.config.id ? nuevo : r)));
}

// Simulación del supervisor: aprueba o rechaza las excepciones pendientes.
export function refrendarExcepciones(id: string) {
  store.commit(
    store.get().map((r) =>
      r.config.id === id && r.pendiente
        ? {
            ...r,
            config: { ...r.config, excepciones: structuredClone(r.pendiente.excepciones) },
            pendiente: null,
            refrendada: { por: SESION_SUPERVISOR.nombre, fecha: selloTiempo() },
          }
        : r
    )
  );
}

export function rechazarExcepciones(id: string) {
  store.commit(store.get().map((r) => (r.config.id === id ? { ...r, pendiente: null } : r)));
}

export function cambiarEstadoOrganismo(id: string, estado: EstadoProducto) {
  store.commit(
    store.get().map((r) => (r.config.id === id ? { ...r, config: { ...r.config, estado } } : r))
  );
}

function idLibre(nombre: string): string {
  const base =
    nombre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "organismo";
  let id = base;
  for (let n = 2; store.get().some((r) => r.config.id === id); n++) id = `${base}-${n}`;
  return id;
}

// Alta de organismo: parte de cero (sin excepciones) o copia productos y excepciones de otro.
export function crearOrganismo(datos: {
  nombre: string;
  detalle: string;
  copiarDeId: string | null;
}): string {
  const lista = store.get();
  const id = idLibre(datos.nombre);
  const origen = lista.find((r) => r.config.id === datos.copiarDeId);
  const siguiente = Math.max(0, ...lista.map((r) => Number(r.codigo) || 0)) + 1;
  const base = origen ?? lista[0];
  const activos = new Set(
    getProductos()
      .filter((p) => p.config.estado === "ACTIVO")
      .map((p) => p.config.id)
  );
  const productos = origen ? origen.config.productos.filter((p) => activos.has(p)) : [];
  const planes = origen ? [...origen.config.planes] : [];
  const nuevo: OrganismoAbm = {
    codigo: String(siguiente).padStart(3, "0"),
    config: {
      ...structuredClone(base.config),
      id,
      nombre: datos.nombre,
      detalle: datos.detalle,
      estado: "ACTIVO",
      vigenciaDesde: fechaHoy(),
      vigenciaHasta: null,
      productos,
      planes,
      excepciones: origen ? structuredClone(origen.config.excepciones) : {},
    },
    extras: { ...EXTRAS_ORGANISMO_BASE },
    pendiente: null,
    refrendada: null,
  };
  store.commit([...lista, nuevo]);
  asignarProductosAOrganismo(id, productos);
  asignarPlanesAOrganismo(id, planes);
  return id;
}

// --- Vista por producto ---
//
// Las secciones del detalle editan las excepciones de UN producto. Para no repetir el mapa por
// producto en cada sección, se les entrega una "vista" plana (overrides, motor, canales y
// extras del producto elegido) y los cambios se vuelcan de nuevo en el mapa.

export interface VistaOrganismo {
  codigo: string;
  config: Omit<OrganismoConfig, "excepciones"> &
    Pick<ExcepcionesOrganismo, "overrides" | "motor" | "canales">;
  extras: ExtrasOrganismo;
  // Excepciones sobre los valores de ejemplo del producto.
  excepciones: Partial<ExtrasProducto>;
}

export function vistaDe(o: OrganismoAbm, productoId: string): VistaOrganismo {
  const exc = o.config.excepciones[productoId] ?? excepcionesVacias();
  const { excepciones: _todas, ...resto } = o.config;
  void _todas;
  return {
    codigo: o.codigo,
    extras: o.extras,
    config: { ...resto, overrides: exc.overrides, motor: exc.motor, canales: exc.canales },
    excepciones: exc.extras,
  };
}

function estaVacia(e: ExcepcionesOrganismo): boolean {
  return (
    Object.keys(e.overrides).length === 0 &&
    e.motor === null &&
    e.canales === null &&
    Object.keys(e.extras).length === 0
  );
}

export function desdeVista(o: OrganismoAbm, productoId: string, v: VistaOrganismo): OrganismoAbm {
  const { overrides, motor, canales, ...resto } = v.config;
  const exc: ExcepcionesOrganismo = { overrides, motor, canales, extras: v.excepciones };
  const excepciones = { ...o.config.excepciones };
  if (estaVacia(exc)) delete excepciones[productoId];
  else excepciones[productoId] = exc;
  return { ...o, extras: v.extras, config: { ...resto, excepciones } };
}

// --- Excepciones ---

export type SeccionOrganismo =
  | "vencimiento"
  | "permisos"
  | "motor"
  | "financieros"
  | "punitorios"
  | "formulario"
  | "onboarding"
  | "firma"
  | "canales"
  | "vendedores"
  | "notificaciones";

// Cantidad de excepciones que tiene el organismo, en un producto, en cada sección del detalle.
export function excepcionesPorSeccion(exc: ExcepcionesOrganismo): Record<SeccionOrganismo, number> {
  const ov = exc.overrides;
  const extras = (claves: readonly (keyof ExtrasProducto)[]) =>
    claves.filter((k) => exc.extras[k] !== undefined).length;
  return {
    vencimiento: extras(EXTRAS_POR_SECCION.vencimiento),
    permisos:
      extras(EXTRAS_POR_SECCION.permisos) +
      (ov.permiteDeudaTerceros !== undefined ? 1 : 0) +
      (ov.capitalMaximo !== undefined ? 1 : 0),
    motor: exc.motor ? 1 : 0,
    financieros: extras(EXTRAS_POR_SECCION.financieros),
    punitorios: extras(EXTRAS_POR_SECCION.punitorios),
    formulario:
      (ov.documentos ? 1 : 0) +
      Object.keys(ov.camposObligatorios ?? {}).length +
      (ov.camposQuitados?.length ?? 0),
    onboarding:
      (ov.navegacion !== undefined ? 1 : 0) +
      Object.keys(ov.pantallas ?? {}).length +
      (ov.referencias ? 1 : 0) +
      (ov.garantes ? 1 : 0) +
      (ov.tokenizacion ? 1 : 0),
    firma: extras(EXTRAS_POR_SECCION.firma),
    canales: exc.canales ? 1 : 0,
    vendedores: extras(EXTRAS_POR_SECCION.vendedores),
    notificaciones: extras(EXTRAS_POR_SECCION.notificaciones),
  };
}

export function totalExcepcionesProducto(exc: ExcepcionesOrganismo | undefined): number {
  if (!exc) return 0;
  return Object.values(excepcionesPorSeccion(exc)).reduce((s, n) => s + n, 0);
}

// Excepciones aplicadas en todos los productos que el organismo ofrece.
export function totalExcepciones(o: OrganismoAbm): number {
  return o.config.productos.reduce((s, id) => s + totalExcepcionesProducto(o.config.excepciones[id]), 0);
}

export function productosConExcepciones(o: OrganismoAbm): number {
  return o.config.productos.filter((id) => totalExcepcionesProducto(o.config.excepciones[id]) > 0)
    .length;
}

// --- Validación (por campo) ---
//
// Los errores del organismo van con su clave; los de las excepciones de un producto, como
// `clave@productoId` (ver `erroresDe`).

export function validarOrganismo(o: OrganismoAbm, todos: OrganismoAbm[]): Record<string, string> {
  const e: Record<string, string> = {};
  const c = o.config;
  const nombre = c.nombre.trim();
  if (!nombre) e.nombre = "Ingresá el nombre del organismo.";
  else if (
    todos.some((r) => r.config.id !== c.id && r.config.nombre.trim().toLowerCase() === nombre.toLowerCase())
  )
    e.nombre = "Ya existe otro organismo con ese nombre.";

  const desde = parseFecha(c.vigenciaDesde);
  if (!desde) e.vigenciaDesde = "Ingresá la fecha de inicio de la vigencia.";
  if (c.vigenciaHasta) {
    const hasta = parseFecha(c.vigenciaHasta);
    if (!hasta) e.vigenciaHasta = "La fecha de fin no es válida.";
    else if (desde && hasta < desde) e.vigenciaHasta = "El fin no puede ser anterior al inicio.";
  }

  for (const [productoId, exc] of Object.entries(c.excepciones)) {
    if (!c.productos.includes(productoId)) continue;
    const ov = exc.overrides;
    if (ov.capitalMaximo !== undefined && ov.capitalMaximo <= 0)
      e[`capitalMaximo@${productoId}`] = "El capital máximo debe ser mayor a cero.";
    if (ov.referencias && (ov.referencias.minimo ?? 0) > (ov.referencias.maximo ?? Infinity))
      e[`referencias@${productoId}`] = "El mínimo de referencias supera al máximo.";
    if (ov.garantes && (ov.garantes.minimo ?? 0) > (ov.garantes.maximo ?? Infinity))
      e[`garantes@${productoId}`] = "El mínimo de garantes supera al máximo.";
    if (exc.canales && exc.canales.length === 0)
      e[`canales@${productoId}`] = "Habilitá al menos un canal o volvé a heredar los del producto.";
  }
  return e;
}

// Errores que corresponden al producto elegido: los del organismo más los de ese producto.
export function erroresDe(errores: Record<string, string>, productoId: string): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const [clave, msg] of Object.entries(errores)) {
    const [campo, prod] = clave.split("@");
    if (!prod || prod === productoId) salida[campo] = msg;
  }
  return salida;
}
