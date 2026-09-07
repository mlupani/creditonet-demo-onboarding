"use client";

import { useApplication } from "@/lib/application-context";
import { formatARS } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { DemoTag } from "@/components/ui/DemoTag";
import { IconCalendar, IconCheckCircle } from "@/components/icons";

export function SeleccionFinal() {
  const { app } = useApplication();
  const o = app.oferta;

  const condiciones = [
    { label: "Importe del préstamo", value: formatARS(o.montoSolicitado) },
    { label: "Cantidad de cuotas", value: `${o.plazo}` },
    { label: "Valor de la cuota", value: formatARS(o.valorCuota) },
  ];

  return (
    <Card className="p-5 sm:p-6">
      <h3 className="text-sm font-semibold tracking-tight text-ink-900">Selección final</h3>
      <p className="mt-0.5 text-xs text-ink-500">
        Estas tres condiciones forman parte de la aceptación de la oferta.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {condiciones.map((c) => (
          <div key={c.label} className="rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-600">
              <IconCheckCircle width={12} height={12} />
              {c.label}
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink-900">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-ink-25 px-4 py-3">
        <IconCalendar width={15} height={15} className="text-ink-400" />
        <span className="text-sm text-ink-600">
          Primera cuota · vencimiento{" "}
          <strong className="text-ink-900">{o.primeraCuotaVencimiento}</strong>
        </span>
        <DemoTag
          variant="regla"
          detalle="El formato y la fecha de vencimiento de la primera cuota son una decisión pendiente en la documentación."
        />
      </div>
    </Card>
  );
}
