"use client";

import { useApplication } from "@/lib/application-context";
import { formatARS } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
import { IconCheckCircle, IconRefresh } from "@/components/icons";

const PRESETS = [2_000_000, 2_500_000, 2_850_000];

// Modificación de monto y recálculo (Guía §5.2).
export function MontoSolicitado({
  borrador,
  onBorrador,
  onRecalcular,
  recalculado,
}: {
  borrador: number;
  onBorrador: (v: number) => void;
  onRecalcular: () => void;
  recalculado: boolean;
}) {
  const { app } = useApplication();
  const o = app.oferta;
  const excede = borrador > o.capitalMaximoActual;
  const pendiente = borrador !== o.montoSolicitado;

  return (
    <Card className="p-5 sm:p-6">
      <h3 className="text-sm font-semibold tracking-tight text-ink-900">Monto solicitado</h3>
      <p className="mt-0.5 text-xs text-ink-500">
        Si el cliente pide menos que el capital máximo, ajustá el importe y presioná Recalcular.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <MoneyInput
          id="monto-solicitado"
          label="Capital solicitado"
          required
          size="lg"
          value={borrador}
          onChange={onBorrador}
          error={
            excede
              ? `El importe supera el capital máximo otorgable de ${formatARS(
                  o.capitalMaximoActual
                )}. Reducilo para poder recalcular.`
              : undefined
          }
          hint={`Capital máximo otorgable: ${formatARS(o.capitalMaximoActual)}.`}
          className="flex-1"
        />
        <Button
          size="lg"
          variant={pendiente && !excede ? "primary" : "outline"}
          onClick={onRecalcular}
          disabled={!pendiente || excede || borrador <= 0}
          className="sm:mt-[1.625rem]"
        >
          <IconRefresh width={16} height={16} />
          Recalcular
        </Button>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-ink-400">Montos rápidos:</span>
        {PRESETS.filter((p) => p <= o.capitalMaximoActual).map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onBorrador(preset)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold tabular-nums transition ${
              borrador === preset
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:text-brand-700"
            }`}
          >
            {formatARS(preset)}
          </button>
        ))}
      </div>

      {pendiente && !excede && borrador > 0 && (
        <ValidationMessage tipo="warning">
          Importe modificado. Presioná Recalcular para actualizar la cuota y el total.
        </ValidationMessage>
      )}

      {recalculado && !pendiente && (
        <div className="mt-4 animate-fade-up rounded-lg border border-success-200 bg-success-50/60 px-4 py-3">
          <div className="grid gap-1.5 text-xs font-medium text-success-700 sm:grid-cols-3">
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
          <p className="mt-1.5 text-[11px] text-success-700/80">
            Recalculado contra la grilla del plan de cuotas, sin volver a consultar al motor de
            riesgo.
          </p>
        </div>
      )}
    </Card>
  );
}
