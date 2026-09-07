"use client";

import { useApplication } from "@/lib/application-context";
import { importeTerceros, netoAAcreditar, totalPrecancelaciones } from "@/lib/credit";
import { formatARS } from "@/lib/format";
import { IconWallet } from "@/components/icons";

export function ComposicionCredito() {
  const { app } = useApplication();
  const o = app.oferta;
  const precancel = totalPrecancelaciones(o);
  const terceros = importeTerceros(o);
  const neto = netoAAcreditar(o);
  const netoOk = neto >= 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-card">
      <div className="flex items-center gap-2.5 border-b border-brand-100 bg-brand-50/60 px-5 py-3.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
          <IconWallet width={16} height={16} />
        </span>
        <h3 className="text-sm font-bold uppercase tracking-wide text-brand-700">
          Composición de la operación
        </h3>
      </div>
      <div className="px-5 py-4">
        <dl className="space-y-2.5">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-ink-600">Nuevo crédito</dt>
            <dd className="text-sm font-semibold tabular-nums text-ink-900">
              {formatARS(o.montoSolicitado)}
            </dd>
          </div>
          {precancel > 0 && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-ink-600">Precancelación crédito existente</dt>
              <dd className="text-sm font-semibold tabular-nums text-danger-600">
                −{formatARS(precancel)}
              </dd>
            </div>
          )}
          {terceros > 0 && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-ink-600">Cancelación deuda externa</dt>
              <dd className="text-sm font-semibold tabular-nums text-danger-600">
                −{formatARS(terceros)}
              </dd>
            </div>
          )}
        </dl>
        <div
          className={`mt-4 flex items-baseline justify-between gap-4 rounded-xl px-4 py-3.5 ${
            netoOk ? "bg-success-50" : "bg-danger-50"
          }`}
        >
          <span
            className={`text-sm font-bold uppercase tracking-wide ${
              netoOk ? "text-success-700" : "text-danger-700"
            }`}
          >
            Neto a acreditar
          </span>
          <span
            key={neto}
            className={`animate-pop text-2xl font-bold tabular-nums ${
              netoOk ? "text-success-700" : "text-danger-600"
            }`}
          >
            {formatARS(neto)}
          </span>
        </div>
        {!netoOk && (
          <p className="mt-2 text-xs font-medium text-danger-600">
            El importe solicitado no alcanza para cubrir las cancelaciones seleccionadas. Aumentá
            el monto o desmarcá una cancelación.
          </p>
        )}
      </div>
    </div>
  );
}
