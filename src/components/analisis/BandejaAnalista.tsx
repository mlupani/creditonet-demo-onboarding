"use client";

import { useApplication } from "@/lib/application-context";
import { nombreOpcion, ORGANISMOS } from "@/lib/config";
import { formatARS, formatDNI } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { IconCheckCircle } from "@/components/icons";

const CHECKS = [
  "Datos completos",
  "Legajo completo",
  "Oferta aceptada",
  "Motor de riesgo evaluado",
];

export function BandejaAnalista({ onTomar }: { onTomar: () => void }) {
  const { app } = useApplication();
  if (!app.cliente) return null;
  const o = app.oferta;

  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 px-6 py-5">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700">
            {app.cliente.nombre.charAt(0)}
            {app.cliente.apellido.charAt(0)}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-sm font-bold text-brand-700">{app.numeroCredito}</p>
              <EstadoBadge estado={app.estado} />
            </div>
            <p className="mt-0.5 text-base font-bold tracking-tight text-ink-900">
              {app.cliente.nombre} {app.cliente.apellido}
            </p>
            <p className="text-sm text-ink-500">
              DNI {formatDNI(app.cliente.dni)} ·{" "}
              {nombreOpcion(ORGANISMOS, app.configuracion.organismoId)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold tabular-nums tracking-tight text-ink-900">
            {formatARS(o.montoSolicitado)}
          </p>
          <p className="text-sm text-ink-500">
            {o.plazo} cuotas de {formatARS(o.valorCuota)}
          </p>
        </div>
      </div>

      <div className="grid gap-2 px-6 py-4 sm:grid-cols-2">
        {CHECKS.map((c) => (
          <div key={c} className="flex items-center gap-2 text-sm font-medium text-success-700">
            <IconCheckCircle width={15} height={15} className="shrink-0" />
            {c}
          </div>
        ))}
      </div>

      <div className="flex justify-end border-t border-ink-100 px-6 py-4">
        <Button size="lg" onClick={onTomar}>
          Tomar análisis
        </Button>
      </div>
    </Card>
  );
}
