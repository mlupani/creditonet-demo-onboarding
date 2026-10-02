// ABM de notificaciones (demo).
//
// Una notificación es una plantilla: un evento que la dispara, el texto, los medios por los que se
// envía y sus parámetros (por ejemplo, "avisar al pasar los X días de mora": X es un parámetro).
// Hay dos ámbitos: externas (al cliente) e internas (a los equipos de la financiera). Por ahora
// sólo se configuran y se guardan en la sesión: no envían nada.

import { crearStoreAbm } from "./store-abm";

export type AmbitoNotificacion = "EXTERNO" | "INTERNO";
export type MedioNotificacion = "WHATSAPP" | "EMAIL" | "SMS" | "APP";
export type EstadoNotificacion = "ACTIVA" | "INACTIVA";

export const AMBITOS: { id: AmbitoNotificacion; label: string; detalle: string }[] = [
  { id: "EXTERNO", label: "Externas", detalle: "Avisos al cliente." },
  { id: "INTERNO", label: "Internas", detalle: "Avisos a los equipos de la financiera." },
];

// Medios disponibles por ámbito.
export const MEDIOS: { id: MedioNotificacion; label: string; ambitos: AmbitoNotificacion[] }[] = [
  { id: "WHATSAPP", label: "WhatsApp", ambitos: ["EXTERNO"] },
  { id: "SMS", label: "SMS", ambitos: ["EXTERNO"] },
  { id: "EMAIL", label: "Email", ambitos: ["EXTERNO", "INTERNO"] },
  { id: "APP", label: "Campana de la app", ambitos: ["INTERNO"] },
];

// Equipo al que va dirigida una notificación interna.
export const CANALES_DESTINO: { id: string; nombre: string }[] = [
  { id: "venta", nombre: "Canal de venta" },
  { id: "analistas", nombre: "Analistas" },
  { id: "telefonistas", nombre: "Telefonistas" },
];

export interface ParametroNotificacion {
  id: string;
  // Nombre con el que se usa en el texto: {{clave}}.
  clave: string;
  etiqueta: string;
  valor: string;
  unidad: string;
}

export interface Notificacion {
  id: string;
  codigo: string;
  nombre: string;
  ambito: AmbitoNotificacion;
  evento: string;
  texto: string;
  medios: MedioNotificacion[];
  parametros: ParametroNotificacion[];
  // Sólo internas: equipo (ver CANALES_DESTINO) al que va dirigido el aviso (vacío o ausente = todos).
  canal?: string;
  // Productos para los que la notificación está disponible (cada producto elige luego cuáles envía).
  disponibleEn: { todos: boolean; ids: string[] };
  estado: EstadoNotificacion;
}

// Las guardadas antes de esta opción no tienen la lista: estaban disponibles para todos.
export const disponibleEnProducto = (n: Pick<Notificacion, "disponibleEn">, productoId: string) =>
  !n.disponibleEn || n.disponibleEn.todos || n.disponibleEn.ids.includes(productoId);

interface EventoNotificacion {
  id: string;
  ambito: AmbitoNotificacion;
  label: string;
  // Parámetros que el evento necesita: se cargan al elegirlo, con un valor sugerido.
  parametros: { clave: string; etiqueta: string; valor: string; unidad: string }[];
}

export const EVENTOS: EventoNotificacion[] = [
  { id: "SOLICITUD_EN_TRAMITE", ambito: "EXTERNO", label: "Solicitud en trámite", parametros: [] },
  { id: "SOLICITUD_PREAPROBADA", ambito: "EXTERNO", label: "Solicitud preaprobada", parametros: [] },
  { id: "SOLICITUD_OBSERVADA", ambito: "EXTERNO", label: "Solicitud observada", parametros: [] },
  { id: "SOLICITUD_RECHAZADA", ambito: "EXTERNO", label: "Solicitud rechazada", parametros: [] },
  { id: "CREDITO_PARA_LIQUIDAR", ambito: "EXTERNO", label: "Crédito para liquidar", parametros: [] },
  {
    id: "VENCIMIENTO_PROXIMO",
    ambito: "EXTERNO",
    label: "Vencimiento próximo",
    parametros: [{ clave: "dias_antes", etiqueta: "Días antes del vencimiento", valor: "3", unidad: "días" }],
  },
  { id: "PAGO_RECIBIDO", ambito: "EXTERNO", label: "Pago recibido", parametros: [] },
  {
    id: "MORA_CLIENTE",
    ambito: "EXTERNO",
    label: "Mora del crédito",
    parametros: [{ clave: "dias_mora", etiqueta: "Días de mora", valor: "5", unidad: "días" }],
  },
  { id: "CREDITO_CANCELADO", ambito: "EXTERNO", label: "Cancelación del crédito", parametros: [] },
  {
    id: "CREDITO_SIN_TOMAR",
    ambito: "INTERNO",
    label: "Crédito sin tomar para análisis",
    parametros: [{ clave: "horas_sin_tomar", etiqueta: "Horas sin tomar", valor: "24", unidad: "horas" }],
  },
  { id: "OBSERVACION_RESPONDIDA", ambito: "INTERNO", label: "Observación respondida", parametros: [] },
  { id: "CAMBIO_OFERTA", ambito: "INTERNO", label: "Cambio de oferta", parametros: [] },
  {
    id: "CHEQUEO_PENDIENTE",
    ambito: "INTERNO",
    label: "Chequeo telefónico pendiente",
    parametros: [{ clave: "horas_pendiente", etiqueta: "Horas pendiente", valor: "12", unidad: "horas" }],
  },
  {
    id: "MORA_CARTERA",
    ambito: "INTERNO",
    label: "Mora de cartera",
    parametros: [{ clave: "dias_mora", etiqueta: "Días de mora", valor: "30", unidad: "días" }],
  },
];

export const getEvento = (id: string) => EVENTOS.find((e) => e.id === id);

// Variables que se pueden usar en el texto, además de los parámetros de la notificación.
export const VARIABLES_TEXTO: { clave: string; detalle: string }[] = [
  { clave: "cliente", detalle: "Nombre del cliente" },
  { clave: "numero_credito", detalle: "Número del crédito" },
  { clave: "monto", detalle: "Monto del crédito" },
  { clave: "producto", detalle: "Producto" },
  { clave: "fecha_vencimiento", detalle: "Fecha de vencimiento" },
];

const RE_VARIABLE = /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi;
export const RE_CLAVE = /^[a-z_][a-z0-9_]*$/;

export const variablesDeTexto = (texto: string): string[] =>
  [...texto.matchAll(RE_VARIABLE)].map((m) => m[1].toLowerCase());

function iniciales(): Notificacion[] {
  const param = (clave: string, etiqueta: string, valor: string, unidad: string): ParametroNotificacion => ({
    id: `p-${clave}`,
    clave,
    etiqueta,
    valor,
    unidad,
  });
  return [
    {
      id: "ntf-1",
      codigo: "N-001",
      nombre: "Aviso de mora al cliente",
      ambito: "EXTERNO",
      evento: "MORA_CLIENTE",
      texto:
        "Hola {{cliente}}, tu crédito {{numero_credito}} tiene {{dias_mora}} días de mora. Regularizá tu situación para evitar cargos punitorios.",
      medios: ["WHATSAPP", "SMS"],
      parametros: [param("dias_mora", "Días de mora", "5", "días")],
      disponibleEn: { todos: true, ids: [] },
      estado: "ACTIVA",
    },
    {
      id: "ntf-2",
      codigo: "N-002",
      nombre: "Recordatorio de vencimiento",
      ambito: "EXTERNO",
      evento: "VENCIMIENTO_PROXIMO",
      texto: "Hola {{cliente}}, tu cuota del crédito {{numero_credito}} vence el {{fecha_vencimiento}}.",
      medios: ["WHATSAPP", "EMAIL"],
      parametros: [param("dias_antes", "Días antes del vencimiento", "3", "días")],
      disponibleEn: { todos: true, ids: [] },
      estado: "ACTIVA",
    },
    {
      id: "ntf-3",
      codigo: "N-003",
      nombre: "Solicitud preaprobada",
      ambito: "EXTERNO",
      evento: "SOLICITUD_PREAPROBADA",
      texto: "¡Buenas noticias, {{cliente}}! Tu solicitud de {{producto}} fue preaprobada por {{monto}}.",
      medios: ["EMAIL"],
      parametros: [],
      disponibleEn: { todos: true, ids: [] },
      estado: "ACTIVA",
    },
    {
      id: "ntf-4",
      codigo: "N-004",
      nombre: "Mora crítica en cartera",
      ambito: "INTERNO",
      evento: "MORA_CARTERA",
      texto: "El crédito {{numero_credito}} de {{cliente}} superó los {{dias_mora}} días de mora.",
      medios: ["APP", "EMAIL"],
      parametros: [param("dias_mora", "Días de mora", "30", "días")],
      disponibleEn: { todos: true, ids: [] },
      estado: "ACTIVA",
    },
    {
      id: "ntf-5",
      codigo: "N-005",
      nombre: "Observación respondida por el canal de venta",
      ambito: "INTERNO",
      evento: "OBSERVACION_RESPONDIDA",
      texto: "El canal de venta respondió la observación del crédito {{numero_credito}}.",
      medios: ["APP"],
      parametros: [],
      disponibleEn: { todos: true, ids: [] },
      estado: "ACTIVA",
    },
  ];
}

const store = crearStoreAbm<Notificacion>({
  clave: "creditonet.plantillas-notificacion.v1",
  inicial: iniciales(),
  valido: (r) => !!r?.id && typeof r.nombre === "string" && Array.isArray(r.medios) && Array.isArray(r.parametros),
  aplicar: () => {},
});

export const usePlantillasNotificacion = store.useLista;
export const getPlantillasNotificacion = store.get;
export const hidratarPlantillasNotificacion = store.hidratar;

export function siguienteCodigo(lista: Notificacion[]): string {
  const max = Math.max(0, ...lista.map((n) => Number(n.codigo.replace(/\D/g, "")) || 0));
  return `N-${String(max + 1).padStart(3, "0")}`;
}

export const nuevaNotificacion = (ambito: AmbitoNotificacion): Notificacion => ({
  id: "",
  codigo: siguienteCodigo(store.get()),
  nombre: "",
  ambito,
  evento: "",
  texto: "",
  medios: [],
  parametros: [],
  canal: "",
  disponibleEn: { todos: true, ids: [] },
  estado: "ACTIVA",
});

export function guardarNotificacion(n: Notificacion) {
  const lista = store.get();
  if (!n.id) store.commit([...lista, { ...n, id: `ntf-${Date.now().toString(36)}` }]);
  else store.commit(lista.map((x) => (x.id === n.id ? n : x)));
}

export const eliminarNotificacion = (id: string) => store.commit(store.get().filter((n) => n.id !== id));

export function cambiarEstadoNotificacion(id: string, estado: EstadoNotificacion) {
  store.commit(store.get().map((n) => (n.id === id ? { ...n, estado } : n)));
}

// Errores por campo; vacío = se puede guardar.
export function validarNotificacion(n: Notificacion, todas: Notificacion[]): Record<string, string> {
  const e: Record<string, string> = {};
  const nombre = n.nombre.trim();
  if (!nombre) e.nombre = "Ingresá el nombre de la notificación.";
  else if (todas.some((x) => x.id !== n.id && x.ambito === n.ambito && x.nombre.trim().toLowerCase() === nombre.toLowerCase()))
    e.nombre = "Ya existe otra notificación con ese nombre.";
  if (!n.evento) e.evento = "Elegí el evento que la dispara.";
  if (!n.texto.trim()) e.texto = "Escribí el texto de la notificación.";
  if (n.disponibleEn && !n.disponibleEn.todos && n.disponibleEn.ids.length === 0)
    e.productos = "Elegí al menos un producto o dejala disponible para todos.";
  if (n.medios.length === 0) e.medios = "Elegí al menos un medio de envío.";
  const claves = new Set<string>();
  n.parametros.forEach((p, i) => {
    if (!RE_CLAVE.test(p.clave)) e[`parametro-${i}`] = "La clave usa minúsculas, números y guion bajo, y no empieza con número.";
    else if (claves.has(p.clave)) e[`parametro-${i}`] = "Esa clave está repetida.";
    else if (!p.valor.trim()) e[`parametro-${i}`] = "Ingresá el valor del parámetro.";
    claves.add(p.clave);
  });
  const conocidas = new Set([...VARIABLES_TEXTO.map((v) => v.clave), ...n.parametros.map((p) => p.clave)]);
  const desconocidas = [...new Set(variablesDeTexto(n.texto))].filter((v) => !conocidas.has(v));
  if (!e.texto && desconocidas.length > 0)
    e.texto = `El texto usa variables que no existen: ${desconocidas.map((v) => `{{${v}}}`).join(", ")}.`;
  return e;
}
