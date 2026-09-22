// DB simulada — helpers tipados para consumir src/data/creditos.json
// Cada registro es un CreditApplication completo + metadatos de bandeja (_bandeja, _descripcion).

import type { CreditApplication, EstadoCredito } from "./types";
import db from "@/data/creditos.json";

export interface CreditoDB extends CreditApplication {
  _bandeja: "vendedor" | "analista";
  _descripcion: string;
}

interface DBFile {
  meta: {
    version: string;
    descripcion: string;
    generado: string;
    total: number;
    bandejas: { vendedor: number; analista: number };
  };
  creditos: CreditoDB[];
}

const data = db as unknown as DBFile;

export const CREDITOS_DB: CreditoDB[] = data.creditos;
export const META_DB = data.meta;

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
export type GrupoVendedor = "TRAMITE" | "OBSERVADAS" | "ANALISIS" | "RESUELTAS";

const GRUPO_POR_ESTADO: Record<EstadoCredito, GrupoVendedor> = {
  BORRADOR: "TRAMITE",
  EN_TRAMITE: "TRAMITE",
  OBSERVADO: "OBSERVADAS",
  CAMBIO_OFERTA: "OBSERVADAS",
  PREAPROBADO: "ANALISIS",
  ANALISIS_TOMADO: "ANALISIS",
  EN_FIRMA: "RESUELTAS",
  FIRMADO: "RESUELTAS",
  PARA_LIQUIDAR: "RESUELTAS",
  RECHAZADO: "RESUELTAS",
  ANULADO: "RESUELTAS",
};

export function creditosPorGrupoVendedor(grupo: GrupoVendedor): CreditoDB[] {
  return CREDITOS_DB.filter((c) => GRUPO_POR_ESTADO[c.estado] === grupo);
}

// --- Bandeja del analista (ListaAnalisis.tsx) — 8 pestañas ---
export type PestanaAnalista = "PEND" | "PRE" | "OBS" | "COFE" | "RECH" | "FEL" | "AFEL" | "LIQ";

export const PESTANA_ESTADOS: Record<PestanaAnalista, EstadoCredito[]> = {
  PEND: ["BORRADOR", "EN_TRAMITE"],
  PRE: ["PREAPROBADO", "ANALISIS_TOMADO"],
  OBS: ["OBSERVADO"],
  COFE: ["CAMBIO_OFERTA"],
  RECH: ["RECHAZADO"],
  FEL: ["EN_FIRMA"],
  AFEL: ["FIRMADO"],
  LIQ: ["PARA_LIQUIDAR"],
};

export function creditosPorPestana(pestana: PestanaAnalista): CreditoDB[] {
  const estados = PESTANA_ESTADOS[pestana];
  return CREDITOS_DB.filter((c) => estados.includes(c.estado));
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
