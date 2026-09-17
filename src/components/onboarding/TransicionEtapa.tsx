"use client";

import { useApplication } from "@/lib/application-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatARS, sumarDias } from "@/lib/format";
import { netoAAcreditar } from "@/lib/credit";
import { IconArrowDown, IconArrowRight, IconCheck } from "@/components/icons";

export function TransicionEtapa() {
  const { app, irAPostOferta } = useApplication();

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <Card className="animate-fade-up overflow-hidden">
        <div className="bg-success-50/70 px-6 py-8 text-center sm:px-10">
          <span className="mx-auto flex h-14 w-14 animate-pop items-center justify-center rounded-full bg-success-600 text-white shadow-sm">
            <IconCheck width={28} height={28} strokeWidth={2.6} />
          </span>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-success-700">
            Oferta aceptada
          </h1>
          <p className="mx-auto mt-1.5 flex max-w-sm flex-wrap items-center justify-center gap-2 text-sm leading-relaxed text-success-700/80">
            {app.cliente?.nombre} {app.cliente?.apellido} · {app.numeroCredito}
          </p>
          {app.fechaSolicitud && (
            <p className="mt-2 text-xs text-success-700/70">
              Condiciones vigentes hasta el {sumarDias(app.fechaSolicitud, 30)} (30 días corridos).
            </p>
          )}
        </div>

        <div className="px-6 py-1 sm:px-10">

          <div className="mt-5 flex items-center justify-between rounded-xl border border-success-200 bg-success-50/60 px-4 py-3">
            <span className="text-sm font-medium text-success-700">Acreditación neta</span>
            <span className="text-lg font-bold tabular-nums text-success-700">
              {formatARS(netoAAcreditar(app.oferta))}
            </span>
          </div>

          <Button size="lg" className="mt-6 w-full" onClick={irAPostOferta}>
            Cargar datos del legajo
            <IconArrowRight width={17} height={17} />
          </Button>
        </div>
      </Card>
    </div>
  );
}
