"use client";

import { useApplication } from "@/lib/application-context";
import { nombreOpcion, ORGANISMOS, PRODUCTOS } from "@/lib/config";
import { formatARS, formatDNI } from "@/lib/format";
import { IconSparkles } from "@/components/icons";

export function OfertaCabecera() {
  const { app } = useApplication();
  if (!app.cliente) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 bg-white px-5 py-4">
        <div>
          <p className="text-base font-bold tracking-tight text-ink-900">
            {app.cliente.nombre} {app.cliente.apellido}
          </p>
          <p className="text-sm text-ink-500">DNI {formatDNI(app.cliente.dni)}</p>
        </div>
        <div className="text-right text-xs">
          <p className="font-semibold text-ink-600">Cliente #{app.numeroCliente}</p>
          <p className="font-mono font-semibold text-brand-700">Crédito {app.numeroCredito}</p>
        </div>
      </div>
      <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-5 py-6 text-center sm:py-7">
        <p className="text-sm font-medium text-brand-100">Oferta disponible · capital máximo</p>
        <p className="mt-1.5 text-4xl font-bold tracking-tight tabular-nums text-white sm:text-5xl">
          {formatARS(app.oferta.capitalMaximoActual)}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-brand-50">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1">
            <IconSparkles width={13} height={13} />
            Generada por el motor de riesgo
          </span>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
            {nombreOpcion(PRODUCTOS, app.configuracion.productoId)}
          </span>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
            {nombreOpcion(ORGANISMOS, app.configuracion.organismoId)}
          </span>
        </div>
      </div>
    </div>
  );
}
