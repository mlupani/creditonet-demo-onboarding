"use client";

import { useApplication } from "@/lib/application-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { resumenConfig } from "@/lib/config";
import { formatARS, sumarDias } from "@/lib/format";
import { netoAAcreditar } from "@/lib/credit";
import { IconArrowDown, IconArrowRight, IconCheck } from "@/components/icons";

export function TransicionEtapa() {
  const { app, irAPostOferta } = useApplication();
  const resumen = resumenConfig(app.configuracion);

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

        <div className="px-6 py-7 sm:px-10">
          <div className="flex justify-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-ink-25 text-ink-400">
              <IconArrowDown width={18} height={18} />
            </span>
          </div>

          <div className="mt-4 text-center">
            <h2 className="text-lg font-bold tracking-tight text-ink-900">Carga post-oferta</h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-500">
              Completá las pantallas que requiere el producto. Cuando todas las obligatorias estén
              en verde, la solicitud queda preaprobada y pasa al analista de riesgo.
            </p>
          </div>

          <div className="mt-6 rounded-xl border border-ink-200 bg-ink-25 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
              {resumen.producto} · {resumen.organismo}
            </p>
            <p className="mt-1 text-xs text-ink-500">{resumen.herencia}</p>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <dt className="text-[11px] font-medium text-ink-500">Pantallas</dt>
                <dd className="text-lg font-bold tabular-nums text-ink-900">{resumen.total}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-ink-500">Obligatorias</dt>
                <dd className="text-lg font-bold tabular-nums text-brand-700">
                  {resumen.obligatorias}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-ink-500">Opcionales</dt>
                <dd className="text-lg font-bold tabular-nums text-ink-500">
                  {resumen.opcionales}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-xl border border-success-200 bg-success-50/60 px-4 py-3">
            <span className="text-sm font-medium text-success-700">Acreditación neta</span>
            <span className="text-lg font-bold tabular-nums text-success-700">
              {formatARS(netoAAcreditar(app.oferta))}
            </span>
          </div>

          <Button size="lg" className="mt-6 w-full" onClick={irAPostOferta}>
            Comenzar la carga
            <IconArrowRight width={17} height={17} />
          </Button>
        </div>
      </Card>
    </div>
  );
}
