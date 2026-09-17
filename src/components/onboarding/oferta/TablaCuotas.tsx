"use client";

import { useEffect, useRef, useState } from "react";
import { useApplication } from "@/lib/application-context";
import { getPlan } from "@/lib/config";
import { OFFER_TERMS, calcularCuota } from "@/lib/credit";
import { formatARS, formatPct } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { IconCheckCircle } from "@/components/icons";

// Placeholder de una cuota mientras se "recalcula" (delay ficticio, ver más abajo).
function SkeletonCuota() {
  return (
    <div className="rounded-xl border border-ink-200 p-4">
      <div className="h-3.5 w-14 animate-pulse rounded bg-ink-150" />
      <div className="mt-2.5 h-5 w-24 animate-pulse rounded bg-ink-150" />
      <div className="mt-2 h-3 w-20 animate-pulse rounded bg-ink-100" />
      <div className="mt-2 h-3 w-28 animate-pulse rounded bg-ink-100" />
    </div>
  );
}

export function TablaCuotas({
  pendiente = false,
  onSeleccion,
}: {
  pendiente?: boolean;
  onSeleccion?: () => void;
} = {}) {
  const { app, patchOferta } = useApplication();
  const o = app.oferta;
  const plan = getPlan(app.configuracion.organismoId);
  const terms = OFFER_TERMS.filter((t) => plan.plazos.includes(t.plazo));

  // Recalculo ficticio: cada cambio de monto muestra un skeleton 1 segundo para que se note
  // que las cuotas se están recalculando, en vez de cambiar el número de golpe.
  const [recalculando, setRecalculando] = useState(false);
  const montoAnterior = useRef(o.montoSolicitado);
  useEffect(() => {
    if (montoAnterior.current === o.montoSolicitado) return;
    montoAnterior.current = o.montoSolicitado;
    setRecalculando(true);
    const t = window.setTimeout(() => setRecalculando(false), 1000);
    return () => window.clearTimeout(t);
  }, [o.montoSolicitado]);

  return (
    <Card className="p-5 sm:p-6">
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-ink-900">
          Plan de cuotas · {plan.nombre}
        </h3>
        <p className="mt-0.5 text-xs text-ink-500">
          Alternativas válidas después de aplicar los límites. La selección define la cuota, el
          total y el primer vencimiento.
        </p>
      </div>

      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
        {[
          ["Sistema", plan.sistema.toLowerCase()],
          ["Gracia", `${plan.periodoGraciaDias} días`],
          ["IVA", formatPct(plan.ivaPct)],
          ["Sellos", formatPct(plan.sellosPct)],
          ["Cargo de otorgamiento", formatPct(plan.cargoOtorgamientoPct)],
        ].map(([label, valor]) => (
          <span key={label}>
            {label} <strong className="font-semibold text-ink-700">{valor}</strong>
          </span>
        ))}
      </p>

      {pendiente && (
        <div className="mt-3 rounded-lg border border-warning-300 bg-warning-50 px-3.5 py-2.5 text-xs font-medium text-warning-700">
          Cambió la renovación, así que la combinación anterior ya no existe: elegí de nuevo el
          plazo sobre los importes actualizados.
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {recalculando
          ? terms.map((term) => <SkeletonCuota key={term.plazo} />)
          : terms.map((term) => {
              const seleccionada = term.plazo === o.plazo && !pendiente;
              const cuota = calcularCuota(o.montoSolicitado, term.plazo, term.tna);
              return (
                <button
                  key={term.plazo}
                  type="button"
                  onClick={() => {
                    patchOferta({ plazo: term.plazo });
                    onSeleccion?.();
                  }}
                  className={`relative rounded-xl border p-4 text-left transition-all ${
                    seleccionada
                      ? "border-brand-600 bg-brand-50/60 shadow-sm ring-1 ring-brand-600"
                      : "border-ink-200 bg-white hover:border-brand-300 hover:bg-brand-50/30"
                  }`}
                >
                  {term.recomendada && (
                    <span className="absolute -top-2.5 left-3 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                      Recomendada
                    </span>
                  )}
                  {seleccionada && (
                    <span className="absolute right-3 top-3 text-brand-600">
                      <IconCheckCircle width={17} height={17} />
                    </span>
                  )}
                  <p
                    className={`text-sm font-bold ${seleccionada ? "text-brand-700" : "text-ink-900"}`}
                  >
                    {term.plazo} cuotas
                  </p>
                  <p className="mt-1.5 text-lg font-bold tabular-nums text-ink-900">
                    {formatARS(cuota)}
                  </p>
                  <p className="text-xs text-ink-500">por mes · TNA {term.tna}%</p>
                  <p className="mt-1.5 text-[11px] text-ink-400">
                    1ª cuota:{" "}
                    <span className="font-semibold text-ink-600">{term.primeraCuota}</span>
                  </p>
                </button>
              );
            })}
      </div>
    </Card>
  );
}
