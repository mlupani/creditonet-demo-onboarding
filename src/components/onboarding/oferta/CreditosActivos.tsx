"use client";

import { useApplication } from "@/lib/application-context";
import { CAPITAL_MAXIMO_BASE, hayPrecancelacion } from "@/lib/credit";
import { formatARS } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { DemoTag } from "@/components/ui/DemoTag";
import { IconArrowRight, IconCheckCircle, IconWallet } from "@/components/icons";

export function CreditosActivos() {
  const { app, togglePrecancelar } = useApplication();
  const o = app.oferta;
  const precancelaActiva = hayPrecancelacion(o);

  return (
    <Card>
      <CardHeader
        title="Créditos activos"
        description="Créditos vigentes del cliente que se pueden precancelar con esta operación."
        icon={<IconWallet width={18} height={18} />}
      />
      <div className="space-y-4 p-5 sm:p-6">
        {o.creditosActivos.map((c) => (
          <div key={c.id} className="rounded-xl border border-ink-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-sm font-bold text-ink-900">{c.id}</p>
              <p className="text-xs text-ink-500">
                Cuota {c.cuotaActual} de {c.cuotasOriginales}
              </p>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {[
                ["Capital original", formatARS(c.capitalOriginal)],
                ["Capital residual", formatARS(c.capitalResidual)],
                ["Monto a cancelar", formatARS(c.montoCancelacion)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] font-medium text-ink-500">{label}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 rounded-lg border border-ink-100 bg-ink-25 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                Desglose del monto a cancelar
              </p>
              <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                {[
                  ["Capital", c.desglose.capital],
                  ["Intereses", c.desglose.intereses],
                  ["IVA", c.desglose.iva],
                  ["Cargos", c.desglose.cargos],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between gap-2 sm:block">
                    <dt className="text-ink-500">{label}</dt>
                    <dd className="font-semibold tabular-nums text-ink-800">
                      {formatARS(value as number)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="mt-3.5 border-t border-ink-100 pt-3.5">
              <Checkbox
                checked={c.precancelar}
                onChange={() => togglePrecancelar(c.id)}
                label="Precancelar este crédito"
                description={`Se cancela ${c.id} por ${formatARS(
                  c.montoCancelacion
                )}. Se descuenta del neto a acreditar.`}
              />
            </div>
          </div>
        ))}

        {precancelaActiva && (
          <div className="animate-fade-up rounded-xl border border-success-200 bg-success-50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-success-700">
              <IconCheckCircle width={16} height={16} />
              Precancelación seleccionada · la oferta fue recalculada
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="text-center">
                <p className="text-[11px] font-medium text-ink-500">Capital máximo anterior</p>
                <p className="text-sm font-semibold tabular-nums text-ink-400 line-through">
                  {formatARS(CAPITAL_MAXIMO_BASE)}
                </p>
              </div>
              <IconArrowRight width={16} height={16} className="text-success-600" />
              <div className="text-center">
                <p className="text-[11px] font-medium text-ink-500">
                  Capital máximo luego de precancelación
                </p>
                <p
                  key={o.capitalMaximoActual}
                  className="animate-pop text-lg font-bold tabular-nums text-success-700"
                >
                  {formatARS(o.capitalMaximoActual)}
                </p>
              </div>
              <DemoTag
                variant="regla"
                detalle="El recálculo del capital máximo tras la precancelación y si la precancelación es total o parcial son decisiones pendientes. El valor es de demo."
              />
            </div>
            <p className="mt-2 text-xs text-success-700/80">
              Volvé a elegir el importe, el plazo y la cuota con el nuevo capital disponible.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
