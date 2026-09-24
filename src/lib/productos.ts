// ABM de Productos (demo).
//
// El producto es la configuración general del crédito (Producto §1–§2). Este módulo es la
// fuente de verdad de esa configuración: el estado vive acá, se persiste en la sesión y se
// vuelca *en el lugar* sobre los registros de config.ts (PRODUCTOS, PRODUCTOS_CONFIG y los
// productos de cada ORGANISMO), que son los que lee el resto de la demo. Así, editar un
// producto cambia el onboarding, los canales, el capital máximo y el motor de la solicitud.
//
// Las secciones que la documentación del repo todavía no detalla (vencimiento, cobro,
// renovación, cancelación, notificaciones, etc.) se guardan como valores de ejemplo en
// `extras`: no alteran ningún cálculo.

import { useSyncExternalStore } from "react";
import {
  ORGANISMOS,
  PRODUCTOS,
  excepcionesDe,
  PRODUCTOS_CONFIG,
  VENDEDORES,
  type EstadoProducto,
  type ProductoConfig,
} from "./config";
import { fechaHoy, parseFecha } from "./format";

// --- Catálogos de las listas del ABM ---

export const CATEGORIAS_PRODUCTO = ["Préstamo", "Tarjeta", "Adelanto", "Refinanciación"];
// Modalidades habilitadas desde Parámetros.
export const MODALIDADES_COBRO = [
  "Descuento por haberes",
  "Débito en cuenta (CBU)",
  "Débito en tarjeta",
  "Pago voluntario",
];
export const CANALES_NOTIFICACION = ["WhatsApp", "Email", "SMS"];
export const MAX_TRAMOS_PUNITORIOS = 5;

export const MODALIDADES_FIRMA = [
  { value: "ELECTRONICA", label: "Electrónica" },
  { value: "FISICA", label: "Física" },
  { value: "AMBAS", label: "Ambas" },
];
export const TIPOS_VENCIMIENTO = [
  { value: "FIJO", label: "Fijo (día del mes)" },
  { value: "A_30_DIAS", label: "A 30 días del alta" },
];
// Supuesto a confirmar con Cristian: el resumen sólo dice "Movimiento por mes".
export const MOVIMIENTOS_MES = [
  { value: "MISMO_DIA", label: "Se mantiene el día" },
  { value: "HABIL_SIGUIENTE", label: "Corre al día hábil siguiente" },
  { value: "HABIL_ANTERIOR", label: "Corre al día hábil anterior" },
];
// Notificaciones de onboarding: hasta 5 estados (los de la bandeja del canal de venta).
export const ESTADOS_NOTIFICACION_ONBOARDING = [
  { id: "EN_TRAMITE", label: "En trámite" },
  { id: "PREAPROBADO", label: "Preaprobado" },
  { id: "OBSERVADO", label: "Observado" },
  { id: "RECHAZADO", label: "Rechazado" },
  { id: "PARA_LIQUIDAR", label: "Para liquidar" },
] as const;

// --- Modelo ---

export type ModalidadFirma = "ELECTRONICA" | "FISICA" | "AMBAS";
export type TipoVencimiento = "FIJO" | "A_30_DIAS";
export type MovimientoMes = "MISMO_DIA" | "HABIL_SIGUIENTE" | "HABIL_ANTERIOR";
export type EstadoNotificacionOnboarding = (typeof ESTADOS_NOTIFICACION_ONBOARDING)[number]["id"];

// Habilitar todos o seleccionar determinados (canales y vendedores).
export interface SeleccionLista {
  todos: boolean;
  ids: string[];
}

// Gestión de préstamos: si está activa, se informa quién gestiona la cartera.
export interface GestionPrestamos {
  activa: boolean;
  razonSocial: string;
  domicilio: string;
  cuit: string;
}

// Datos financieros: qué conceptos intervienen en el recálculo del sueldo neto.
export interface RecalculoNeto {
  disponible: boolean;
  extraccionesTransferencias: boolean;
  cuotasBuroExterno: boolean;
  noRemunerativosHorasExtra: boolean;
}

// Interés punitorio por tramo (hasta 5).
export interface TramoPunitorio {
  desdeDia: number;
  // Porcentaje del punitorio sobre la tasa del crédito.
  punitorioPct: number;
  diasGracia: number;
  montoTopeSinIva: number;
}

export interface NotificacionesProducto {
  // Onboarding: qué estados avisan al cliente.
  onboarding: Record<EstadoNotificacionOnboarding, boolean>;
  // Crédito activo: vencimiento, pago, mora y cancelación.
  creditoActivo: {
    vencimiento: boolean;
    diasAntesVencimiento: number;
    pago: boolean;
    mora: boolean;
    cancelacion: boolean;
  };
  canales: string[];
}

// Valores de ejemplo: se guardan y se muestran, pero no cambian el flujo ni el cálculo.
// El organismo puede hacer excepciones sobre cualquiera de estos valores.
export interface ExtrasProducto {
  // Tipo de producto
  categoria: string;
  // Vencimientos
  diaCorte: number;
  tipoVencimiento: TipoVencimiento;
  diaVencimientoFijo: number;
  movimientoMes: MovimientoMes;
  // Plazos del flujo (30 días de condiciones, 15 para corregir una observación).
  diasValidezCondiciones: number;
  diasPlazoObservacion: number;
  // Opciones generales
  permiteCreditosParalelos: boolean;
  modalidadFirma: ModalidadFirma;
  // Si es true, después de la firma el crédito pasa por chequeo telefónico antes de liquidarse.
  requiereChequeoTelefonico: boolean;
  seContabiliza: boolean;
  centroCostos: string;
  visibleDashboard: boolean;
  // Gestión de préstamos
  gestionPrestamos: GestionPrestamos;
  // Datos financieros
  recalculoNeto: RecalculoNeto;
  // Modalidades de cobro, canales y vendedores (los canales están en `config.canales`).
  modalidadesCobro: string[];
  canalesTodos: boolean;
  vendedores: SeleccionLista;
  // Intereses punitorios
  tramosPunitorios: TramoPunitorio[];
  modificarCarteraActiva: boolean;
  // Permisos de operación (Onboarding)
  permiteRenovacion: boolean;
  cargoRenovacionPct: number;
  permiteCancelacionAnticipada: boolean;
  cargoCancelacionPct: number;
  permiteCambioPrimerVencimiento: boolean;
  // Notificaciones
  notificaciones: NotificacionesProducto;
}

export interface ProductoAbm {
  codigo: string;
  descripcion: string;
  // Lo que lee el flujo (estado, vigencia, capital, canales, onboarding, motor).
  config: ProductoConfig;
  extras: ExtrasProducto;
  // Organismos que ofrecen el producto (Producto §5).
  organismos: string[];
}

const EXTRAS_BASE: ExtrasProducto = {
  categoria: "Préstamo",
  diaCorte: 20,
  tipoVencimiento: "A_30_DIAS",
  diaVencimientoFijo: 10,
  movimientoMes: "HABIL_SIGUIENTE",
  diasValidezCondiciones: 30,
  diasPlazoObservacion: 15,
  permiteCreditosParalelos: true,
  modalidadFirma: "AMBAS",
  requiereChequeoTelefonico: false,
  seContabiliza: true,
  centroCostos: "CC-100 · Créditos personales",
  visibleDashboard: true,
  gestionPrestamos: { activa: false, razonSocial: "", domicilio: "", cuit: "" },
  recalculoNeto: {
    disponible: true,
    extraccionesTransferencias: true,
    cuotasBuroExterno: true,
    noRemunerativosHorasExtra: false,
  },
  modalidadesCobro: ["Descuento por haberes", "Débito en cuenta (CBU)"],
  canalesTodos: true,
  vendedores: { todos: true, ids: VENDEDORES.map((v) => v.id) },
  tramosPunitorios: [
    { desdeDia: 1, punitorioPct: 50, diasGracia: 5, montoTopeSinIva: 50_000 },
    { desdeDia: 16, punitorioPct: 60, diasGracia: 0, montoTopeSinIva: 80_000 },
    { desdeDia: 31, punitorioPct: 75, diasGracia: 0, montoTopeSinIva: 120_000 },
    { desdeDia: 61, punitorioPct: 90, diasGracia: 0, montoTopeSinIva: 200_000 },
    { desdeDia: 91, punitorioPct: 100, diasGracia: 0, montoTopeSinIva: 300_000 },
  ],
  modificarCarteraActiva: false,
  permiteRenovacion: true,
  cargoRenovacionPct: 2,
  permiteCancelacionAnticipada: true,
  cargoCancelacionPct: 2,
  permiteCambioPrimerVencimiento: true,
  notificaciones: {
    onboarding: {
      EN_TRAMITE: false,
      PREAPROBADO: true,
      OBSERVADO: true,
      RECHAZADO: true,
      PARA_LIQUIDAR: true,
    },
    creditoActivo: {
      vencimiento: true,
      diasAntesVencimiento: 5,
      pago: true,
      mora: true,
      cancelacion: true,
    },
    canales: ["WhatsApp", "Email"],
  },
};

// Ajustes por producto sobre el ejemplo base.
const EXTRAS_POR_PRODUCTO: Record<string, Partial<ExtrasProducto>> = {
  "tarjeta-credito": {
    categoria: "Tarjeta",
    permiteCreditosParalelos: false,
    centroCostos: "CC-200 · Tarjetas",
  },
  "adelanto-sueldo": {
    categoria: "Adelanto",
    modalidadesCobro: ["Descuento por haberes"],
    permiteRenovacion: false,
    centroCostos: "CC-300 · Adelantos",
  },
  refinanciacion: { categoria: "Refinanciación", permiteCreditosParalelos: false },
};

function extrasDe(id: string): ExtrasProducto {
  return structuredClone({ ...EXTRAS_BASE, ...(EXTRAS_POR_PRODUCTO[id] ?? {}) });
}

function estadoInicial(): ProductoAbm[] {
  return PRODUCTOS.map((p, i) => ({
    codigo: String(i + 1).padStart(3, "0"),
    descripcion: p.detalle ?? "",
    config: structuredClone(PRODUCTOS_CONFIG[p.id]),
    extras: extrasDe(p.id),
    organismos: ORGANISMOS.filter((o) => o.productos.includes(p.id)).map((o) => o.id),
  }));
}

// --- Store ---

const CLAVE = "creditonet.productos.v4";
const INICIAL = estadoInicial();
let registros: ProductoAbm[] = INICIAL;
const oyentes = new Set<() => void>();

// Vuelca el estado sobre los registros de config.ts, que son los que lee el resto de la demo.
function aplicar(lista: ProductoAbm[]) {
  PRODUCTOS.splice(
    0,
    PRODUCTOS.length,
    ...lista.map((r) => ({ id: r.config.id, nombre: r.config.nombre, detalle: r.descripcion }))
  );
  for (const id of Object.keys(PRODUCTOS_CONFIG)) delete PRODUCTOS_CONFIG[id];
  for (const r of lista) PRODUCTOS_CONFIG[r.config.id] = r.config;
  for (const o of ORGANISMOS)
    o.productos = lista.filter((r) => r.organismos.includes(o.id)).map((r) => r.config.id);
}

function commit(lista: ProductoAbm[]) {
  registros = lista;
  aplicar(lista);
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    /* demo sin persistencia si el storage no está disponible */
  }
  oyentes.forEach((f) => f());
}

// Se llama una vez al hidratar la sesión, antes de mostrar ninguna pantalla que dependa de
// la configuración de los productos.
export function hidratarProductos() {
  try {
    const raw = sessionStorage.getItem(CLAVE);
    if (!raw) return;
    const guardado = JSON.parse(raw) as ProductoAbm[];
    if (Array.isArray(guardado) && guardado.length > 0 && guardado.every((r) => r?.config?.id))
      commit(guardado);
  } catch {
    /* si el guardado está dañado se queda con los valores de ejemplo */
  }
}

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

export function getProductos(): ProductoAbm[] {
  return registros;
}

// Para que otros stores (organismos) se mantengan al día cuando cambia la configuración.
export const alCambiarProductos = suscribir;

// Un organismo habilita productos: la relación vive del lado del producto (Producto §5).
export function asignarProductosAOrganismo(organismoId: string, productoIds: string[]) {
  commit(
    registros.map((r) => {
      const habilitado = productoIds.includes(r.config.id);
      const tiene = r.organismos.includes(organismoId);
      if (habilitado === tiene) return r;
      return {
        ...r,
        organismos: habilitado
          ? [...r.organismos, organismoId]
          : r.organismos.filter((o) => o !== organismoId),
      };
    })
  );
}

// Extras del producto con las excepciones del organismo ya aplicadas (firma, chequeo, etc.).
export function extrasEfectivos(productoId: string, organismoId: string): ExtrasProducto | null {
  const base = registros.find((r) => r.config.id === productoId)?.extras;
  if (!base) return null;
  const exc = organismoId ? excepcionesDe(organismoId, productoId).extras : {};
  return { ...base, ...exc };
}

export function useProductos(): ProductoAbm[] {
  return useSyncExternalStore(
    suscribir,
    () => registros,
    () => INICIAL
  );
}

export function guardarProducto(p: ProductoAbm) {
  commit(registros.map((r) => (r.config.id === p.config.id ? p : r)));
}

export function cambiarEstadoProducto(id: string, estado: EstadoProducto) {
  commit(registros.map((r) => (r.config.id === id ? { ...r, config: { ...r.config, estado } } : r)));
}

export function restaurarProductosDemo() {
  commit(structuredClone(INICIAL));
}

function idLibre(nombre: string): string {
  const base =
    nombre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "producto";
  let id = base;
  for (let n = 2; registros.some((r) => r.config.id === id); n++) id = `${base}-${n}`;
  return id;
}

// Alta de producto: parte de cero (valores por defecto) o copia la configuración de otro.
export function crearProducto(datos: {
  nombre: string;
  descripcion: string;
  categoria: string;
  copiarDeId: string | null;
}): string {
  const id = idLibre(datos.nombre);
  const origen = registros.find((r) => r.config.id === datos.copiarDeId);
  const base = origen ?? registros.find((r) => r.config.id === "prestamo-personal") ?? registros[0];
  const siguiente = Math.max(0, ...registros.map((r) => Number(r.codigo) || 0)) + 1;
  const nuevo: ProductoAbm = {
    codigo: String(siguiente).padStart(3, "0"),
    descripcion: datos.descripcion,
    config: {
      ...structuredClone(base.config),
      id,
      nombre: datos.nombre,
      estado: "ACTIVO",
      vigenciaDesde: fechaHoy(),
      vigenciaHasta: null,
    },
    extras: { ...structuredClone(base.extras), categoria: datos.categoria },
    // Un producto nuevo no se ofrece en ningún organismo hasta que se lo habilite.
    organismos: [],
  };
  commit([...registros, nuevo]);
  return id;
}

// --- Vigencia ---

export type EstadoVigencia = "VIGENTE" | "POR_INICIAR" | "VENCIDA";

export function estadoVigencia(
  c: { vigenciaDesde: string; vigenciaHasta: string | null },
  hoy: Date = new Date()
): EstadoVigencia {
  const dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const desde = parseFecha(c.vigenciaDesde);
  const hasta = c.vigenciaHasta ? parseFecha(c.vigenciaHasta) : null;
  if (desde && dia < desde) return "POR_INICIAR";
  if (hasta && dia > hasta) return "VENCIDA";
  return "VIGENTE";
}

export function textoVigencia(c: { vigenciaDesde: string; vigenciaHasta: string | null }): string {
  return c.vigenciaHasta
    ? `${c.vigenciaDesde} al ${c.vigenciaHasta}`
    : `Desde ${c.vigenciaDesde} · sin vencimiento`;
}

// --- Validación (por campo) ---

export function validarProducto(p: ProductoAbm, todos: ProductoAbm[]): Record<string, string> {
  const e: Record<string, string> = {};
  const c = p.config;
  const nombre = c.nombre.trim();
  if (!nombre) e.nombre = "Ingresá el nombre del producto.";
  else if (
    todos.some((r) => r.config.id !== c.id && r.config.nombre.trim().toLowerCase() === nombre.toLowerCase())
  )
    e.nombre = "Ya existe otro producto con ese nombre.";
  if (c.capitalMaximo <= 0) e.capitalMaximo = "El capital máximo debe ser mayor a cero.";
  if (c.canales.length === 0) e.canales = "Habilitá al menos un canal.";

  const desde = parseFecha(c.vigenciaDesde);
  if (!desde) e.vigenciaDesde = "Ingresá la fecha de inicio de la vigencia.";
  if (c.vigenciaHasta) {
    const hasta = parseFecha(c.vigenciaHasta);
    if (!hasta) e.vigenciaHasta = "La fecha de fin no es válida.";
    else if (desde && hasta < desde) e.vigenciaHasta = "El fin no puede ser anterior al inicio.";
  }

  const ob = c.onboarding;
  if (ob.referencias.minimo > ob.referencias.maximo)
    e.referencias = "El mínimo de referencias supera al máximo.";
  if (ob.garantes.minimo > ob.garantes.maximo) e.garantes = "El mínimo de garantes supera al máximo.";
  if (ob.tokenizacion.maximoTarjetas < 0) e.tokenizacion = "El máximo de tarjetas no puede ser negativo.";
  if (!ob.pantallas.some((s) => s.visible))
    e.pantallas = "Al menos una pantalla de onboarding tiene que estar habilitada.";

  const x = p.extras;
  const dia = (n: number) => Number.isInteger(n) && n >= 1 && n <= 31;
  if (!dia(x.diaCorte)) e.diaCorte = "El día de corte va de 1 a 31.";
  if (x.tipoVencimiento === "FIJO" && !dia(x.diaVencimientoFijo))
    e.diaVencimientoFijo = "El día de vencimiento va de 1 a 31.";
  if (x.gestionPrestamos.activa) {
    if (!x.gestionPrestamos.razonSocial.trim()) e.gestionRazonSocial = "Ingresá la razón social.";
    if (x.gestionPrestamos.cuit.replace(/\D/g, "").length !== 11)
      e.gestionCuit = "El CUIT debe tener 11 dígitos.";
  }
  const t = x.tramosPunitorios;
  if (t.length === 0 || t.length > MAX_TRAMOS_PUNITORIOS)
    e.tramos = `Cargá entre 1 y ${MAX_TRAMOS_PUNITORIOS} tramos de punitorios.`;
  else if (t.some((tr, i) => i > 0 && tr.desdeDia <= t[i - 1].desdeDia))
    e.tramos = "Los tramos deben ir en orden creciente de días.";
  return e;
}

// --- Exportación ---

// CSV con separador `;` y BOM: es lo que Excel (configuración regional es-AR) abre directo.
export function productosACsv(lista: ProductoAbm[]): string {
  const filas = [
    ["ID", "Nombre", "Tipo de producto", "Estado", "Vigencia desde", "Vigencia hasta", "Capital máximo", "Canales", "Organismos"],
    ...lista.map((r) => [
      r.codigo,
      r.config.nombre,
      r.extras.categoria,
      r.config.estado,
      r.config.vigenciaDesde,
      r.config.vigenciaHasta ?? "",
      String(r.config.capitalMaximo),
      r.config.canales.join(", "),
      r.organismos.length === 0
        ? ""
        : r.organismos
            .map((id) => ORGANISMOS.find((o) => o.id === id)?.nombre ?? id)
            .join(", "),
    ]),
  ];
  const celda = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
}
