// DB simulada — helpers tipados para consumir src/data/creditos.json
// Cada registro es un CreditApplication completo + metadatos de bandeja (_bandeja, _descripcion).

import { CHEQUEO_PENDIENTE, type CreditApplication, type EstadoCredito } from "./types";
import { parseFecha } from "./format";
import { firmasDeSemilla } from "./firma";
import db from "@/data/creditos.json";

export interface CreditoDB extends CreditApplication {
  _bandeja: "vendedor" | "analista";
  _descripcion: string;
  // Id estable del registro dentro de la DB simulada — el numeroCredito no sirve solo porque
  // los BORRADOR todavía no tienen uno (creditonet-64).
  _id: string;
}

interface DBFile {
  meta: {
    version: string;
    descripcion: string;
    generado: string;
    total: number;
    bandejas: { vendedor: number; analista: number };
  };
  // El JSON no trae el historial de firma ni el chequeo: se derivan del estado al cargar.
  creditos: (Omit<CreditoDB, "_id" | "firmas" | "chequeoTelefonico"> &
    Partial<Pick<CreditoDB, "firmas" | "chequeoTelefonico">>)[];
}

const data = db as unknown as DBFile;

// --- Orden centralizado: últimos créditos arriba en todas las bandejas ---
// BORRADOR aún no tiene fechaSolicitud (creditonet-64) — sin una fecha real que los ubique,
// van al final (fallback = época). Array.prototype.sort es estable, así que entre BORRADOR
// (todos con timestamp 0) se conserva el orden original de CREDITOS_DB.json.
function timestampFechaSolicitud(c: Pick<CreditoDB, "fechaSolicitud">): number {
  if (!c.fechaSolicitud) return 0;
  return parseFecha(c.fechaSolicitud)?.getTime() ?? 0;
}

export function ordenarPorFechaDesc<T extends Pick<CreditoDB, "fechaSolicitud">>(creditos: T[]): T[] {
  return [...creditos].sort((a, b) => timestampFechaSolicitud(b) - timestampFechaSolicitud(a));
}

export const CREDITOS_DB: CreditoDB[] = ordenarPorFechaDesc(
  data.creditos.map((c, i) => ({
    ...c,
    firmas: c.firmas ?? firmasDeSemilla(c),
    chequeoTelefonico:
      c.chequeoTelefonico ??
      (c.estado === "CHEQUEO_TELEFONICO"
        ? { ...CHEQUEO_PENDIENTE, fechaInicio: c.fechaAprobacion ?? c.fechaEnvioAnalisis }
        : null),
    _id: c.numeroCredito ?? `borrador-${i}`,
  }))
);
export const META_DB = data.meta;

// Copia mutable de la DB simulada para uso en estado de React (application-context): cada
// consumidor necesita su propia copia porque el import de arriba es una referencia compartida.
export function creditosSeed(): CreditoDB[] {
  return CREDITOS_DB.map((c) => ({ ...c }));
}

// --- Filtros por bandeja ---

export function creditosVendedor(): CreditoDB[] {
  return CREDITOS_DB.filter((c) => c._bandeja === "vendedor");
}

export function creditosAnalista(): CreditoDB[] {
  return CREDITOS_DB.filter((c) => c._bandeja === "analista");
}

export function creditosPorEstado(estado: EstadoCredito): CreditoDB[] {
  return CREDITOS_DB.filter((c) => c.estado === estado);
}

export function getCreditoById(numeroCredito: string | null): CreditoDB | undefined {
  if (!numeroCredito) return undefined;
  return CREDITOS_DB.find((c) => c.numeroCredito === numeroCredito);
}

// --- Bandeja del canal de venta (page.tsx) agrupa por GRUPO_POR_ESTADO ---
export type GrupoVendedor = "TRAMITE" | "OBSERVADAS" | "ANALISIS" | "FIRMA" | "RESUELTAS";

const GRUPO_POR_ESTADO: Record<EstadoCredito, GrupoVendedor> = {
  BORRADOR: "TRAMITE",
  EN_TRAMITE: "TRAMITE",
  OBSERVADO: "OBSERVADAS",
  CAMBIO_OFERTA: "OBSERVADAS",
  PREAPROBADO: "ANALISIS",
  ANALISIS_TOMADO: "ANALISIS",
  APROBADO: "FIRMA",
  EN_FIRMA: "FIRMA",
  FIRMADO: "FIRMA",
  SUPERIOR: "FIRMA",
  CHEQUEO_TELEFONICO: "FIRMA",
  PARA_LIQUIDAR: "RESUELTAS",
  RECHAZADO: "RESUELTAS",
  ANULADO: "RESUELTAS",
};

export function creditosPorGrupoVendedor(grupo: GrupoVendedor): CreditoDB[] {
  return CREDITOS_DB.filter((c) => GRUPO_POR_ESTADO[c.estado] === grupo);
}

// --- Bandeja del analista (ListaAnalisis.tsx) — 7 pestañas ---
export type PestanaAnalista = "PRE" | "COFE" | "RECH" | "APR" | "FEL" | "AFEL" | "SUP" | "CHEQ" | "LIQ";

export const PESTANA_ESTADOS: Record<PestanaAnalista, EstadoCredito[]> = {
  PRE: ["PREAPROBADO", "ANALISIS_TOMADO"],
  COFE: ["CAMBIO_OFERTA"],
  RECH: ["RECHAZADO"],
  APR: ["APROBADO"],
  FEL: ["EN_FIRMA"],
  AFEL: ["FIRMADO"],
  SUP: ["SUPERIOR"],
  CHEQ: ["CHEQUEO_TELEFONICO"],
  LIQ: ["PARA_LIQUIDAR"],
};

export function creditosPorPestana(pestana: PestanaAnalista): CreditoDB[] {
  const estados = PESTANA_ESTADOS[pestana];
  return ordenarPorFechaVisibleAnalista(CREDITOS_DB.filter((c) => estados.includes(c.estado)));
}

// --- Fecha visible en la bandeja del analista (creditonet-67) ---
// La columna "Fecha" de ListaAnalisis.tsx no siempre muestra fechaSolicitud: depende del
// estado. El orden de cada pestaña debe coincidir con esa fecha, no con fechaSolicitud.
type CreditoConFechasAnalista = Pick<CreditoDB, "estado" | "fechaSolicitud" | "fechaEnvioAnalisis" | "fechaAprobacion" | "analista">;

export function fechaVisibleAnalista(c: CreditoConFechasAnalista): string | null | undefined {
  if (c.estado === "PARA_LIQUIDAR") return c.fechaAprobacion;
  if (c.estado === "OBSERVADO") return c.analista.observacion?.fecha;
  return c.fechaEnvioAnalisis ?? c.fechaSolicitud;
}

// Lo que se acaba de enviar al analista ("Hoy HH:MM", sellado al preaprobar) tiene que quedar
// primero. Los datos de ejemplo con una fecha o una hora futura no pueden ganarle: se
// acotan al inicio del día, y todo sello real es de hoy o posterior.
function timestampFechaVisibleAnalista(c: CreditoConFechasAnalista): number {
  const fecha = fechaVisibleAnalista(c);
  const ts = fecha ? parseFecha(fecha)?.getTime() ?? 0 : 0;
  const ahora = new Date();
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
  return ts > ahora.getTime() ? inicioHoy : ts;
}

export function ordenarPorFechaVisibleAnalista<T extends CreditoConFechasAnalista>(creditos: T[]): T[] {
  return [...creditos].sort((a, b) => timestampFechaVisibleAnalista(b) - timestampFechaVisibleAnalista(a));
}

// --- Estadísticas para dashboard / demo ---

export function estadisticasDB() {
  const todos = CREDITOS_DB;
  return {
    total: todos.length,
    vendedor: creditosVendedor().length,
    analista: creditosAnalista().length,
    porEstado: Object.fromEntries(
      [...new Set(todos.map((c) => c.estado))].map((e) => [
        e,
        todos.filter((c) => c.estado === e).length,
      ])
    ) as Record<EstadoCredito, number>,
    montoTotal: todos.reduce((s, c) => s + (c.oferta?.montoSolicitado ?? 0), 0),
    conObservacion: todos.filter((c) => c.analista.observacion !== null).length,
    rechazados: todos.filter((c) => c.estado === "RECHAZADO").length,
    paraLiquidar: todos.filter((c) => c.estado === "PARA_LIQUIDAR").length,
  };
}

// --- Helpers de búsqueda (reusa coincideCliente) ---
export function buscarCreditos(q: string): CreditoDB[] {
  const query = q.trim().toLowerCase();
  if (!query) return CREDITOS_DB;
  const digits = query.replace(/\D+/g, "");
  return CREDITOS_DB.filter((c) => {
    const cli = c.cliente;
    if (!cli) return false;
    if (digits) {
      return cli.dni.includes(digits) || cli.cuil.replace(/\D+/g, "").includes(digits);
    }
    return `${cli.apellido} ${cli.nombre}`.toLowerCase().includes(query);
  });
}
