"use client";

import { useApplication } from "@/lib/application-context";
import {
  cancelacionesExcedenCapital,
  importeTerceros,
  netoAAcreditar,
  totalPrecancelaciones,
} from "@/lib/credit";
import { formatARS } from "@/lib/format";
import { IconWallet } from "@/components/icons";

// Resumen de la oferta con la regla de validación en cascada (Guía §5.5).
export function ComposicionCredito() {
  const { app } = useApplication();
  const o = app.oferta;
  const precancel = totalPrecancelaciones(o);
  const terceros = importeTerceros(o);
  const neto = netoAAcreditar(o);
  const excede = cancelacionesExcedenCapital(o);

  const fila = "flex items-baseline justify-between gap-4";
  // Si las cancelaciones superan el capital, se resaltan en rojo (control bloqueante).
  const filaCancelacion = `${fila} ${excede ? "-mx-2 rounded-lg bg-danger-50 px-2 py-1" : ""}`;
  const montoCancelacion = `whitespace-nowrap text-sm tabular-nums ${
    excede ? "font-bold text-danger-700" : "font-semibold text-danger-600"
  }`;

  const condiciones = [
    [`${o.plazo} cuotas de`, formatARS(o.valorCuota)],
    ["TNA", `${o.tna} %`],
    ["Total a pagar", formatARS(o.totalAPagar)],
    ["1er vencimiento", o.primeraCuotaVencimiento],
  ];

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
          Resumen de la oferta
        </h3>
      </div>
      <div className="px-5 py-4">
        <dl className="space-y-2.5">
          <div className={fila}>
            <dt className="text-sm text-ink-600">Capital solicitado</dt>
            <dd className="text-sm font-semibold tabular-nums text-ink-900">
              {formatARS(o.montoSolicitado)}
            </dd>
          </div>
          {precancel > 0 && (
            <div className={filaCancelacion}>
              <dt className="text-sm text-ink-600">Cancelación créditos propios</dt>
              <dd className={montoCancelacion}>−{formatARS(precancel)}</dd>
            </div>
          )}
          {terceros > 0 && (
            <div className={filaCancelacion}>
              <dt className="text-sm text-ink-600">Cancelación deudas con terceros</dt>
              <dd className={montoCancelacion}>−{formatARS(terceros)}</dd>
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
        <dl className="mt-4 space-y-2 border-t border-ink-100 pt-4">
          {condiciones.map(([label, valor]) => (
            <div key={label} className={fila}>
              <dt className="text-sm text-ink-600">{label}</dt>
              <dd className="text-sm font-semibold tabular-nums text-ink-900">{valor}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
