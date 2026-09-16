"use client";

import type { ReactNode } from "react";
import type { ResultadoLimites } from "@/lib/types";
import { formatARS } from "@/lib/format";
import { Card } from "@/components/ui/Card";

function Subgrupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-ink-25 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">{titulo}</p>
      <ul className="mt-2 space-y-1">{children}</ul>
    </div>
  );
}

function Fila({
  label,
  valor,
  destacada,
  className,
}: {
  label: string;
  valor: string;
  destacada: boolean;
  className: string;
}) {
  return (
    <li
      className={`flex items-baseline justify-between gap-2 text-xs ${
        destacada ? `font-semibold ${className}` : "text-ink-500"
      }`}
    >
      <span>{label}</span>
      <span className="shrink-0 tabular-nums">{valor}</span>
    </li>
  );
}

/**
 * Resultado + límites (Plan de Cuotas §3.3 y §12 · Flujos Integrados §13).
 *
 * Pueden convivir varios límites de capital. El que manda es el más restrictivo: ese es el
 * capital que continúa hacia el Plan de Cuotas.
 */
export function LimitesPanel({ limites }: { limites: ResultadoLimites }) {
  const maximo = Math.max(...limites.limites.map((l) => l.monto), 1);

  return (
    <Card className="p-5 sm:p-6">
      <div>
        <h3 className="text-sm font-bold tracking-tight text-ink-900">
          Límites aplicables al capital
        </h3>
        <p className="mt-0.5 text-xs text-ink-500">
          Calculados sin cancelaciones. Manda el más restrictivo; ninguno sale del motor.
        </p>
      </div>

      <ul className="mt-4 space-y-2">
        {limites.limites.map((l) => {
          const aplicado = l.id === limites.limiteAplicadoId;
          return (
            <li
              key={l.id}
              className={`rounded-xl border px-4 py-3 transition ${
                aplicado ? "border-brand-300 bg-brand-50/60" : "border-ink-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className={`flex items-center gap-1.5 text-sm font-semibold ${
                      aplicado ? "text-brand-700" : "text-ink-800"
                    }`}
                  >
                    {l.label}
                    {aplicado && (
                      <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Más restrictivo
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-500">{l.detalle}</p>
                </div>
                <span
                  className={`shrink-0 text-sm font-bold tabular-nums ${
                    aplicado ? "text-brand-700" : "text-ink-600"
                  }`}
                >
                  {formatARS(l.monto)}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className={`h-full rounded-full ${aplicado ? "bg-brand-600" : "bg-ink-300"}`}
                  style={{ width: `${Math.max((l.monto / maximo) * 100, 3)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Subgrupo titulo="Cuota máxima · gana la menor">
          {limites.limitesCuota.map((c) => (
            <Fila
              key={c.id}
              label={c.label}
              valor={formatARS(c.monto)}
              destacada={c.id === limites.limiteCuotaAplicadoId}
              className="text-ink-900"
            />
          ))}
        </Subgrupo>
        {/* Recortes porcentuales sobre el capital ya calculado. */}
        <Subgrupo titulo="Limitantes · manda el mayor recorte">
          {limites.limitantes.map((l) => {
            const recorta = l.aplica && l.recortePct > 0;
            return (
              <Fila
                key={l.id}
                label={l.label}
                valor={recorta ? `−${l.recortePct} %` : "sin recorte"}
                destacada={recorta && l.recortePct === limites.recorteAplicadoPct}
                className="text-warning-700"
              />
            );
          })}
        </Subgrupo>
      </div>

      {limites.recorteAplicadoPct > 0 && (
        <p className="mt-2 text-right text-xs text-ink-500">
          {formatARS(limites.capitalPorLimites)} − {limites.recorteAplicadoPct} % ={" "}
          <strong className="tabular-nums text-ink-900">
            {formatARS(limites.capitalConsiderado)}
          </strong>
        </p>
      )}
    </Card>
  );
}
