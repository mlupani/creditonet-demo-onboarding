"use client";

import { useApplication } from "@/lib/application-context";
import { getPlan } from "@/lib/config";
import { OFFER_TERMS, calcularCuota } from "@/lib/credit";
import { formatARS } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { DemoTag } from "@/components/ui/DemoTag";
import { IconCheckCircle } from "@/components/icons";

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

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink-900">
            Alternativas de financiación · {plan.nombre}
          </h3>
          <p className="mt-0.5 text-xs text-ink-500">
            Sistema {plan.sistema.toLowerCase()}. Son las combinaciones que quedaron válidas
            después de aplicar los límites. La selección cambia la cuota, el total y la primera
            fecha de vencimiento.
          </p>
        </div>
        <DemoTag
          variant="regla"
          detalle="El vendedor no opera la grilla: el plan la consulta internamente y acá sólo se presentan las alternativas que cumplen el capital y la cuota máxima. Las tasas y la fecha de la primera cuota son valores de demo."
        />
      </div>

      {pendiente && (
        <div className="mt-3 rounded-lg border border-warning-300 bg-warning-50 px-3.5 py-2.5 text-xs font-medium text-warning-700">
          Cambió la renovación, así que la combinación anterior ya no existe: elegí de nuevo el
          plazo sobre los importes actualizados.
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {terms.map((term) => {
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
              <p className={`text-sm font-bold ${seleccionada ? "text-brand-700" : "text-ink-900"}`}>
                {term.plazo} cuotas
              </p>
              <p className="mt-1.5 text-lg font-bold tabular-nums text-ink-900">
                {formatARS(cuota)}
              </p>
              <p className="text-xs text-ink-500">por mes · TNA {term.tna}%</p>
              <p className="mt-1.5 text-[11px] text-ink-400">
                1ª cuota: <span className="font-semibold text-ink-600">{term.primeraCuota}</span>
              </p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
