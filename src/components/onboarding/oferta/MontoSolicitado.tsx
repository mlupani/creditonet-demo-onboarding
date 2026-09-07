"use client";

import { useApplication } from "@/lib/application-context";
import { ofertaExcedeMaximo } from "@/lib/credit";
import { formatARS } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { IconCheckCircle } from "@/components/icons";

const PRESETS = [2_000_000, 2_500_000, 2_850_000];

export function MontoSolicitado() {
  const { app, patchOferta } = useApplication();
  const o = app.oferta;
  const excede = ofertaExcedeMaximo(o);

  return (
    <Card className="p-5 sm:p-6">
      <h3 className="text-sm font-semibold tracking-tight text-ink-900">Monto solicitado</h3>
      <p className="mt-0.5 text-xs text-ink-500">
        Valor inicial: {formatARS(o.capitalMaximoBase)}. Podés ajustarlo dentro del capital máximo
        aprobado.
      </p>
      <div className="mt-4">
        <MoneyInput
          id="monto-solicitado"
          label="Importe del préstamo"
          required
          size="lg"
          value={o.montoSolicitado}
          onChange={(v) => patchOferta({ montoSolicitado: v })}
          error={
            excede
              ? `El importe solicitado supera el capital máximo aprobado de ${formatARS(
                  o.capitalMaximoActual
                )}. Reducí el importe para continuar.`
              : undefined
          }
          hint={`Capital máximo aprobado: ${formatARS(o.capitalMaximoActual)}.`}
        />
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ink-400">Montos rápidos:</span>
          {PRESETS.filter((p) => p <= o.capitalMaximoActual).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => patchOferta({ montoSolicitado: preset })}
              className={`rounded-full border px-3 py-1 text-xs font-semibold tabular-nums transition ${
                o.montoSolicitado === preset
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:text-brand-700"
              }`}
            >
              {formatARS(preset)}
            </button>
          ))}
        </div>
      </div>

      {!excede && o.montoSolicitado > 0 && (
        <div className="mt-4 grid gap-1.5 rounded-lg border border-success-200 bg-success-50/60 px-4 py-3 text-xs font-medium text-success-700 sm:grid-cols-3">
          <span className="flex items-center gap-1.5">
            <IconCheckCircle width={13} height={13} /> Importe actualizado
          </span>
          <span className="flex items-center gap-1.5">
            <IconCheckCircle width={13} height={13} /> Nueva cuota {formatARS(o.valorCuota)}
          </span>
          <span className="flex items-center gap-1.5">
            <IconCheckCircle width={13} height={13} /> Nuevo total {formatARS(o.totalAPagar)}
          </span>
        </div>
      )}
    </Card>
  );
}
