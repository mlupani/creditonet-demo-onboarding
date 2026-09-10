"use client";

import { useApplication } from "@/lib/application-context";
import {
  cancelacionesExcedenCapital,
  importeTerceros,
  netoAAcreditar,
  totalPrecancelaciones,
} from "@/lib/credit";
import { formatARS } from "@/lib/format";
import { IconAlertTriangle, IconWallet } from "@/components/icons";

// Regla de validación en cascada (Guía §5.5).
export function ComposicionCredito() {
  const { app } = useApplication();
  const o = app.oferta;
  const precancel = totalPrecancelaciones(o);
  const terceros = importeTerceros(o);
  const neto = netoAAcreditar(o);
  const excede = cancelacionesExcedenCapital(o);

  // Si las cancelaciones superan el capital, se resaltan en rojo (control bloqueante).
  const fila = `flex items-baseline justify-between gap-4 ${
    excede ? "-mx-2 rounded-lg bg-danger-50 px-2 py-1" : ""
  }`;
  const monto = `whitespace-nowrap text-sm tabular-nums ${
    excede ? "font-bold text-danger-700" : "font-semibold text-danger-600"
  }`;

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white shadow-card ${
        excede ? "border-danger-300" : "border-brand-200"
      }`}
    >
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
            <dt className="text-sm text-ink-600">Capital solicitado</dt>
            <dd className="text-sm font-semibold tabular-nums text-ink-900">
              {formatARS(o.montoSolicitado)}
            </dd>
          </div>
          {precancel > 0 && (
            <div className={fila}>
              <dt className="text-sm text-ink-600">Cancelación créditos propios</dt>
              <dd className={monto}>−{formatARS(precancel)}</dd>
            </div>
          )}
          {terceros > 0 && (
            <div className={fila}>
              <dt className="text-sm text-ink-600">Cancelación deudas con terceros</dt>
              <dd className={monto}>−{formatARS(terceros)}</dd>
            </div>
          )}
        </dl>
        <div
          className={`mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl px-4 py-3.5 ${
            excede ? "bg-danger-50" : "bg-success-50"
          }`}
        >
          <span
            className={`whitespace-nowrap text-sm font-bold uppercase tracking-wide ${
              excede ? "text-danger-700" : "text-success-700"
            }`}
          >
            Acreditación neta
          </span>
          <span
            key={neto}
            className={`animate-pop text-2xl font-bold tabular-nums ${
              excede ? "text-danger-600" : "text-success-700"
            }`}
          >
            {formatARS(neto)}
          </span>
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-ink-400">
          Acreditación neta = Capital solicitado − Σ cancelaciones propias − Σ cancelaciones con
          terceros.
        </p>
        {excede && (
          <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-danger-600">
            <IconAlertTriangle width={14} height={14} className="mt-0.5 shrink-0" />
            Las cancelaciones superan el capital solicitado. Aumentá el capital o quitá una
            cancelación para poder continuar.
          </p>
        )}
      </div>
    </div>
  );
}
