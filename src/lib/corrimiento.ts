// Corrimiento del cronograma (creditonet-120): el supervisor desplaza la fecha de la cuota 1 —y
// con ella todo el desarrollo del préstamo— una cantidad de días o de meses.

import { parseFecha } from "./format";
import type { UnidadCorrimiento } from "./types";

export const UNIDADES_CORRIMIENTO: Record<UnidadCorrimiento, { singular: string; plural: string }> = {
  DIAS: { singular: "día", plural: "días" },
  MESES: { singular: "mes", plural: "meses" },
};

export const etiquetaCorrimiento = (cantidad: number, unidad: UnidadCorrimiento) =>
  `${cantidad} ${UNIDADES_CORRIMIENTO[unidad][Math.abs(cantidad) === 1 ? "singular" : "plural"]}`;

function aTexto(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// Devuelve la fecha dd/mm/aaaa corrida; null si la fecha o la cantidad no son válidas. En meses el
// día se conserva y, si el mes destino es más corto, queda en su último día (31/01 + 1 mes = 28/02).
export function correrFecha(fecha: string, cantidad: number, unidad: UnidadCorrimiento): string | null {
  const base = parseFecha(fecha);
  if (!base || !Number.isInteger(cantidad) || cantidad === 0) return null;
  if (unidad === "DIAS") {
    base.setDate(base.getDate() + cantidad);
  } else {
    const dia = base.getDate();
    base.setDate(1);
    base.setMonth(base.getMonth() + cantidad);
    const ultimo = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    base.setDate(Math.min(dia, ultimo));
  }
  return aTexto(base);
}
