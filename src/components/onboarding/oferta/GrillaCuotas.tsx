"use client";

import { useEffect, useMemo, useRef } from "react";
import { calcularCuota, type OfferTerm } from "@/lib/credit";
import type { SistemaAmortizacion } from "@/lib/config";
import { formatARS } from "@/lib/format";
import type { Plazo } from "@/lib/types";

const PASO_CAPITAL = 100_000;

// Capitales que se muestran: del máximo hacia abajo de a $100.000, más el máximo y el monto
// elegido si no caen justo en un paso. Nunca superan el capital máximo otorgable.
function capitalesDe(maximo: number, elegido: number): number[] {
  const capitales = new Set<number>();
  if (maximo > 0) capitales.add(maximo);
  for (let c = Math.floor(maximo / PASO_CAPITAL) * PASO_CAPITAL; c >= PASO_CAPITAL; c -= PASO_CAPITAL)
    capitales.add(c);
  if (elegido > 0 && elegido <= maximo) capitales.add(elegido);
  return Array.from(capitales).sort((a, b) => b - a);
}

// Grilla capital × cantidad de cuotas: cada celda es la cuota mensual de ese capital en ese
// plazo. Sólo capital, cuotas y monto; no muestra tasa, total ni primera cuota.
export function GrillaCuotas({
  terms,
  sistema,
  capitalMaximo,
  capital,
  plazo,
  seleccionable,
  onSeleccionar,
}: {
  terms: OfferTerm[];
  // Sistema de amortización del plan (por defecto, francés).
  sistema?: SistemaAmortizacion;
  capitalMaximo: number;
  capital: number;
  plazo: Plazo;
  // Falso si la combinación elegida quedó obsoleta (cambió la renovación).
  seleccionable: boolean;
  onSeleccionar: (capital: number, plazo: Plazo) => void;
}) {
  const capitales = useMemo(() => capitalesDe(capitalMaximo, capital), [capitalMaximo, capital]);
  const contenedor = useRef<HTMLDivElement>(null);

  // Al abrir, deja a la vista la fila del capital elegido.
  useEffect(() => {
    contenedor.current
      ?.querySelector<HTMLElement>("[data-fila-elegida]")
      ?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <div
      ref={contenedor}
      className="max-h-[60vh] overflow-auto rounded-xl border border-ink-200 scroll-thin"
    >
      <table className="w-full border-separate border-spacing-0 text-right text-sm">
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 top-0 z-30 border-b border-r border-ink-200 bg-ink-50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-500"
            >
              Capital
            </th>
            {terms.map((term) => (
              <th
                key={term.plazo}
                scope="col"
                className={`sticky top-0 z-20 min-w-[4.5rem] border-b border-ink-200 px-2 py-2 leading-tight ${
                  term.plazo === plazo && seleccionable
                    ? "bg-brand-50 text-brand-700"
                    : "bg-ink-50 text-ink-700"
                }`}
              >
                <span className="block text-sm font-bold tabular-nums">{term.plazo}</span>
                <span className="block text-[10px] font-medium uppercase tracking-wide text-ink-400">
                  cuotas
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {capitales.map((cap) => {
            const filaElegida = cap === capital && seleccionable;
            return (
              <tr key={cap} {...(filaElegida ? { "data-fila-elegida": "" } : {})}>
                <th
                  scope="row"
                  className={`sticky left-0 z-10 whitespace-nowrap border-b border-r border-ink-100 px-3 py-2 text-left font-semibold tabular-nums ${
                    filaElegida ? "bg-brand-50 text-brand-700" : "bg-white text-ink-900"
                  }`}
                >
                  {formatARS(cap)}
                  {cap === capitalMaximo && (
                    <span className="ml-2 rounded-full bg-ink-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                      Máx.
                    </span>
                  )}
                </th>
                {terms.map((term) => {
                  const elegida = filaElegida && term.plazo === plazo;
                  return (
                    <td key={term.plazo} className="border-b border-ink-100 p-0">
                      <button
                        type="button"
                        onClick={() => onSeleccionar(cap, term.plazo)}
                        aria-label={`${formatARS(cap)} en ${term.plazo} cuotas de ${formatARS(
                          calcularCuota(cap, term.plazo, term.tna, sistema)
                        )}`}
                        aria-pressed={elegida}
                        className={`block w-full px-2 py-2 text-right tabular-nums transition ${
                          elegida
                            ? "bg-brand-600 font-bold text-white"
                            : filaElegida
                              ? "bg-brand-50/60 text-ink-900 hover:bg-brand-100"
                              : "text-ink-700 hover:bg-brand-50"
                        }`}
                      >
                        {formatARS(calcularCuota(cap, term.plazo, term.tna, sistema))}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
