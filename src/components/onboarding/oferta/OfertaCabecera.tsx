"use client";

import { useApplication } from "@/lib/application-context";
import { nombreOpcion, ORGANISMOS, PRODUCTOS } from "@/lib/config";
import { hayPrecancelacion } from "@/lib/credit";
import { formatARS, formatDNI } from "@/lib/format";

// Cabecera de la oferta (Guía §5.1): cliente, ID de Cliente e ID de Crédito.
export function OfertaCabecera() {
  const { app } = useApplication();
  if (!app.cliente) return null;

  return (
    <div className="rounded-2xl border border-ink-200 bg-white px-5 py-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold tracking-tight text-ink-900">
            {app.cliente.nombre} {app.cliente.apellido}
          </p>
          <p className="text-sm text-ink-500">DNI {formatDNI(app.cliente.dni)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              ID de Cliente
            </p>
            <p className="font-mono font-semibold text-ink-700">{app.numeroCliente}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              ID de Crédito
            </p>
            <p className="font-mono font-semibold text-brand-700">{app.numeroCredito}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Capital máximo otorgable (Guía §5.1). Sticky para que quede visible mientras se
// scrollea la oferta y se note el recálculo al precancelar créditos o cancelar deuda
// con terceros más abajo en la página.
export function CapitalMaximoSticky() {
  const { app } = useApplication();
  if (!app.cliente) return null;

  return (
    <div className="overflow-hidden rounded-2xl shadow-card lg:sticky lg:top-[calc(4rem_+_var(--wizard-header-h,0px))] lg:z-30">
      <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-5 py-6 text-center sm:py-7">
        <p className="text-sm font-medium text-brand-100">
          {hayPrecancelacion(app.oferta) ? "Nueva oferta" : "Primera oferta"} · Capital máximo
          otorgable
        </p>
        <p
          key={app.oferta.capitalMaximoActual}
          className="mt-1.5 animate-pop text-4xl font-bold tracking-tight tabular-nums text-white sm:text-5xl"
        >
          {formatARS(app.oferta.capitalMaximoActual)}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-brand-50">
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
