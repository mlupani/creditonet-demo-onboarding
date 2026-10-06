// Modificación de punitorios sobre la cartera activa de un producto (demo).
//
// Con "Modificar cartera activa" tildado, el producto puede recalcular los punitorios de todos sus
// créditos en mora con nuevos valores por tramo. El recálculo va desde el primer día de mora hacia
// adelante con los nuevos valores (retroactivo) y la diferencia respecto de lo que ya tenía el
// crédito se suma, como interés adicional, a la cuota actual. Cada aplicación y cada restauración
// queda en un log con los valores anteriores y quién la hizo.
//
// La cartera es de ejemplo: se genera siempre igual para un mismo producto, no hay créditos
// activos reales en la demo.

import { ORGANISMOS, SESION_PARAMETROS } from "./config";
import { fechaHora } from "./format";
import { getProductos, guardarProducto, type TramoPunitorio } from "./productos";
import { crearStoreAbm } from "./store-abm";

// --- Cartera de ejemplo ---

export interface CreditoCartera {
  id: string;
  numero: string;
  cliente: string;
  // Organismo del colectivo al que pertenece el crédito ("" si el producto no tiene organismos).
  organismoId: string;
  diasMora: number;
  importeCuota: number;
  // Tasa nominal anual del crédito (%): los punitorios son un porcentaje de esta tasa.
  tasaAnual: number;
}

const NOMBRES = [
  "Gómez, Laura",
  "Pérez, Martín",
  "Rodríguez, Ana",
  "Fernández, Diego",
  "López, Carolina",
  "Martínez, Pablo",
  "Sánchez, Julieta",
  "Romero, Nicolás",
  "Díaz, Valeria",
  "Torres, Sebastián",
  "Álvarez, Florencia",
  "Ruiz, Hernán",
];
const DIAS_MORA = [3, 12, 20, 35, 48, 62, 75, 93, 110, 8, 28, 135];
const CUOTAS = [42_000, 58_500, 36_000, 71_000, 49_000, 64_000, 38_500, 83_000, 52_000, 45_500, 60_000, 77_000];

/** Organismos que ofrecen el producto (los eliminados no cuentan). */
export function organismosDelProducto(productoId: string) {
  return ORGANISMOS.filter((o) => o.estado !== "ELIMINADO" && o.productos.includes(productoId));
}

/**
 * Créditos activos en mora del producto: siempre los mismos, al menos 10, repartidos entre los
 * organismos del producto. Con `organismoIds` sólo los de esos organismos.
 */
export function carteraEnMora(productoId: string, organismoIds?: string[]): CreditoCartera[] {
  const semilla = [...productoId].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const organismos = organismosDelProducto(productoId);
  const cartera = NOMBRES.map((cliente, i) => ({
    id: `${productoId}-cart-${i + 1}`,
    numero: `CR-${String(40_000 + ((semilla * 7 + i * 131) % 9_000)).padStart(5, "0")}`,
    cliente,
    organismoId: organismos.length ? organismos[i % organismos.length].id : "",
    diasMora: DIAS_MORA[(i + semilla) % DIAS_MORA.length],
    importeCuota: CUOTAS[(i * 5 + semilla) % CUOTAS.length],
    tasaAnual: 90 + ((i * 11 + semilla) % 5) * 10,
  }));
  return organismoIds ? cartera.filter((c) => organismoIds.includes(c.organismoId)) : cartera;
}

// --- Cálculo ---

/**
 * Punitorio acumulado por la mora del crédito: para cada tramo cuenta los días de atraso que caen en
 * él (menos los de gracia), a la tasa diaria del crédito por el % del tramo, con el tope del tramo.
 */
export function punitorioDe(c: CreditoCartera, tramos: TramoPunitorio[]): number {
  const orden = [...tramos].sort((a, b) => a.desdeDia - b.desdeDia);
  const diario = (c.importeCuota * (c.tasaAnual / 365)) / 100;
  let total = 0;
  orden.forEach((t, i) => {
    const hasta = orden[i + 1] ? orden[i + 1].desdeDia - 1 : Infinity;
    const dias = Math.max(0, Math.min(c.diasMora, hasta) - t.desdeDia + 1);
    const cobrables = Math.max(0, dias - t.diasGracia);
    total += Math.min(cobrables * diario * (t.punitorioPct / 100), t.montoTopeSinIva);
  });
  return Math.round(total);
}

export interface FilaSimulacion {
  credito: CreditoCartera;
  antes: number;
  despues: number;
  // Lo que se suma (o resta) a la cuota actual.
  ajuste: number;
}

export function simular(
  productoId: string,
  tramosActuales: TramoPunitorio[],
  tramosNuevos: TramoPunitorio[],
  retroactivo = true,
  organismoIds?: string[]
): FilaSimulacion[] {
  return carteraEnMora(productoId, organismoIds).map((credito) => {
    const antes = punitorioDe(credito, tramosActuales);
    // Sólo hacia adelante: lo ya devengado no cambia.
    const despues = retroactivo ? punitorioDe(credito, tramosNuevos) : antes;
    return { credito, antes, despues, ajuste: despues - antes };
  });
}

// --- Log ---

export interface CambioTramo {
  tramo: number;
  desdeDia: number;
  pctAntes: number;
  pctDespues: number;
  topeAntes: number;
  topeDespues: number;
}

export interface RegistroPunitorios {
  id: string;
  fecha: string;
  usuario: string;
  accion: "APLICAR" | "RESTAURAR";
  productoId: string;
  productoNombre: string;
  tramosAntes: TramoPunitorio[];
  tramosDespues: TramoPunitorio[];
  cambios: CambioTramo[];
  creditos: number;
  ajusteTotal: number;
  // true: recalculó toda la cartera histórica desde el primer día de mora; false: rige sólo hacia adelante.
  retroactivo: boolean;
  // Organismos cuya cartera se modificó (los registros viejos no lo guardan: toda la cartera).
  organismos?: string[];
}

const store = crearStoreAbm<RegistroPunitorios>({
  clave: "creditonet.punitorios-log.v1",
  inicial: [],
  valido: (r) => !!r?.id && Array.isArray(r.tramosAntes),
  aplicar: () => {},
});

export const useLogPunitorios = store.useLista;
export const hidratarLogPunitorios = store.hidratar;

/** Cambios de % y de tope entre dos listas de tramos (sólo los que difieren). */
export function cambiosDe(antes: TramoPunitorio[], despues: TramoPunitorio[]): CambioTramo[] {
  return despues
    .map((t, i) => ({
      tramo: i + 1,
      desdeDia: t.desdeDia,
      pctAntes: antes[i]?.punitorioPct ?? 0,
      pctDespues: t.punitorioPct,
      topeAntes: antes[i]?.montoTopeSinIva ?? 0,
      topeDespues: t.montoTopeSinIva,
    }))
    .filter((c) => c.pctAntes !== c.pctDespues || c.topeAntes !== c.topeDespues);
}

/**
 * Aplica los nuevos tramos al producto. Con `retroactivo` recalcula toda la cartera histórica desde
 * el primer día de mora; si no, los nuevos valores rigen sólo hacia adelante. Cada aplicación es un
 * checkpoint: guarda los tramos de antes para poder volver a esa versión cuando se quiera.
 */
export function aplicarPunitorios(
  productoId: string,
  tramosNuevos: TramoPunitorio[],
  retroactivo: boolean,
  organismoIds?: string[]
): RegistroPunitorios | null {
  const producto = getProductos().find((p) => p.config.id === productoId);
  if (!producto) return null;
  const antes = structuredClone(producto.extras.tramosPunitorios);
  const filas = simular(productoId, antes, tramosNuevos, retroactivo, organismoIds);
  const registro: RegistroPunitorios = {
    id: `pun-${Date.now().toString(36)}-${productoId}`,
    fecha: fechaHora(),
    usuario: SESION_PARAMETROS.nombre,
    accion: "APLICAR",
    productoId,
    productoNombre: producto.config.nombre,
    tramosAntes: antes,
    tramosDespues: structuredClone(tramosNuevos),
    cambios: cambiosDe(antes, tramosNuevos),
    creditos: filas.length,
    ajusteTotal: filas.reduce((s, f) => s + f.ajuste, 0),
    retroactivo,
    organismos: organismoIds,
  };
  guardarProducto({ ...producto, extras: { ...producto.extras, tramosPunitorios: structuredClone(tramosNuevos) } });
  store.commit([registro, ...store.get()]);
  return registro;
}

/** Vuelve a la versión anterior a un checkpoint (los tramos de antes de esa aplicación). */
export function restaurarPunitorios(checkpointId: string): RegistroPunitorios | null {
  const checkpoint = store.get().find((r) => r.id === checkpointId && r.accion === "APLICAR");
  const producto = checkpoint && getProductos().find((p) => p.config.id === checkpoint.productoId);
  if (!checkpoint || !producto) return null;
  const actuales = producto.extras.tramosPunitorios;
  const original = checkpoint.tramosAntes;
  const filas = simular(checkpoint.productoId, actuales, original, checkpoint.retroactivo, checkpoint.organismos);
  const registro: RegistroPunitorios = {
    id: `pun-${Date.now().toString(36)}-${checkpoint.productoId}`,
    fecha: fechaHora(),
    usuario: SESION_PARAMETROS.nombre,
    accion: "RESTAURAR",
    productoId: checkpoint.productoId,
    productoNombre: producto.config.nombre,
    tramosAntes: structuredClone(actuales),
    tramosDespues: structuredClone(original),
    cambios: cambiosDe(actuales, original),
    creditos: filas.length,
    ajusteTotal: filas.reduce((s, f) => s + f.ajuste, 0),
    retroactivo: checkpoint.retroactivo,
    organismos: checkpoint.organismos,
  };
  guardarProducto({ ...producto, extras: { ...producto.extras, tramosPunitorios: structuredClone(original) } });
  store.commit([registro, ...store.get()]);
  return registro;
}
