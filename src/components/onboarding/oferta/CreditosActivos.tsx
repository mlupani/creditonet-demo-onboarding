"use client";

import { useApplication } from "@/lib/application-context";
import { getPlan } from "@/lib/config";
import { cuotasAbonadasPct, hayPrecancelacion } from "@/lib/credit";
import { formatARS } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { DemoTag } from "@/components/ui/DemoTag";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IconArrowRight, IconCheckCircle, IconLoader, IconRefresh } from "@/components/icons";

// Precancelación de créditos propios sobre la primera oferta (Plan §9). Marcar o desmarcar
// un crédito recalcula la oferta sin contabilizar ese crédito en la exposición del cliente.
export function CreditosActivos({
  reevaluandoId,
  onToggle,
}: {
  reevaluandoId: string | null;
  onToggle: (id: string) => void;
}) {
  const { app } = useApplication();
  const o = app.oferta;
  const minPct = getPlan(app.configuracion.organismoId).renovacionMinCuotasPct;
  const precancelaActiva = hayPrecancelacion(o);
  const cuotasLiberadas = o.creditosActivos
    .filter((c) => c.precancelar)
    .reduce((s, c) => s + c.valorCuota, 0);

  return (
    <Card>
      <CardHeader
        title="Precancelación de créditos propios"
        description="Créditos vigentes del cliente que se pueden renovar o precancelar con esta operación."
        icon={<IconRefresh width={18} height={18} />}
      />
      <div className="space-y-4 p-5 sm:p-6">
        {o.creditosActivos.map((c) => {
          const pct = cuotasAbonadasPct(c);
          const elegible = pct >= minPct;
          const reevaluando = reevaluandoId === c.id;
          return (
            <div key={c.id} className="rounded-xl border border-ink-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-sm font-bold text-ink-900">{c.id}</p>
                <StatusBadge tone={elegible ? "success" : "neutral"}>
                  {elegible ? "Elegible para renovación" : "No elegible"}
                </StatusBadge>
              </div>

              <div className="mt-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-ink-600">
                    <strong className="text-ink-900">
                      {c.cuotasAbonadas} de {c.cuotasOriginales}
                    </strong>{" "}
                    cuotas abonadas ({pct} %)
                  </span>
                  <span className="text-ink-400">Mínimo para renovar: {minPct} %</span>
                </div>
                <div className="relative mt-1.5 h-2 w-full rounded-full bg-ink-100">
                  <div
                    className={`h-full rounded-full ${elegible ? "bg-success-500" : "bg-warning-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                  <span
                    aria-hidden
                    className="absolute -top-1 h-4 w-0.5 rounded-full bg-ink-500"
                    style={{ left: `${minPct}%` }}
                  />
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                {[
                  ["Capital original", formatARS(c.capitalOriginal)],
                  ["Capital residual", formatARS(c.capitalResidual)],
                  ["Cuota vigente", formatARS(c.valorCuota)],
                  ["Saldo a cancelar", formatARS(c.montoCancelacion)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[11px] font-medium text-ink-500">{label}</dt>
                    <dd className="text-sm font-semibold tabular-nums text-ink-900">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-3 rounded-lg border border-ink-100 bg-ink-25 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  Desglose del saldo a cancelar
                </p>
                <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-5">
                  {(
                    [
                      ["Capital residual", c.desglose.capitalResidual],
                      ["Intereses a vencer", c.desglose.interesesAVencer],
                      ["IVA", c.desglose.iva],
                      ["Cargos de cancelación", c.desglose.cargosCancelacion],
                      ["Punitorios / mora", c.desglose.punitorios],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-2 sm:block">
                      <dt className="text-ink-500">{label}</dt>
                      <dd className="font-semibold tabular-nums text-ink-800">
                        {formatARS(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="mt-3.5 border-t border-ink-100 pt-3.5">
                <Checkbox
                  checked={c.precancelar}
                  onChange={() => onToggle(c.id)}
                  disabled={!elegible || reevaluandoId !== null}
                  label="Renovar / precancelar este crédito"
                  description={`Se cancela ${c.id} por ${formatARS(
                    c.montoCancelacion
                  )} y se descuenta de la acreditación neta.`}
                />
              </div>

              {reevaluando && (
                <p className="mt-3 flex animate-fade-in items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700">
                  <IconLoader width={14} height={14} />
                  Recalculando la oferta sin {c.id} en la exposición…
                </p>
              )}
            </div>
          );
        })}

        {precancelaActiva && reevaluandoId === null && (
          <div className="animate-fade-up rounded-xl border border-success-200 bg-success-50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-success-700">
              <IconCheckCircle width={16} height={16} />
              Nueva oferta recalculada con la precancelación
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="text-center">
                <p className="text-[11px] font-medium text-ink-500">Cuota que se libera</p>
                <p className="text-sm font-semibold tabular-nums text-success-700">
                  {formatARS(cuotasLiberadas)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-medium text-ink-500">Primera oferta</p>
                <p className="text-sm font-semibold tabular-nums text-ink-400 line-through">
                  {formatARS(o.capitalMaximoBase)}
                </p>
              </div>
              <IconArrowRight width={16} height={16} className="text-success-600" />
              <div className="text-center">
                <p className="text-[11px] font-medium text-ink-500">Nueva oferta</p>
                <p
                  key={o.capitalMaximoActual}
                  className="animate-pop text-lg font-bold tabular-nums text-success-700"
                >
                  {formatARS(o.capitalMaximoActual)}
                </p>
              </div>
              <DemoTag
                variant="regla"
                detalle="El crédito que se renueva deja de pesar en la exposición: su cuota libera capacidad y el capital máximo se recalcula. Si la precancelación puede ser parcial es una decisión pendiente."
              />
            </div>
            <p className="mt-2 text-xs text-success-700/80">
              El importe pasó al nuevo capital máximo: volvé a elegir el plazo sobre la nueva
              oferta.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
