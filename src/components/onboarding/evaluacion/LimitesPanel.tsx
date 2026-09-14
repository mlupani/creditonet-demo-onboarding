"use client";

import type { ResultadoLimites } from "@/lib/types";
import { formatARS } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { DemoTag } from "@/components/ui/DemoTag";
import { IconArrowDown, IconCheck, IconWallet } from "@/components/icons";

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold tracking-tight text-ink-900">
            Límites aplicables al capital
          </h3>
          <p className="mt-0.5 text-xs text-ink-500">
            Límites de la primera oferta, sin cancelaciones. Cuando existen varios se toma el
            menor capital permitido. Ninguno sale del motor: el motor sólo dijo que la solicitud
            pasa.
          </p>
        </div>
        <DemoTag
          variant="regla"
          detalle="Los importes de cada límite son valores de demo. El universal por cliente y el de sueldos brutos son condiciones generales; el resto sale del producto, del organismo y del plan."
        />
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-ink-200 bg-ink-25 px-4 py-2.5">
        <span className="text-sm font-medium text-ink-600">Capital solicitado</span>
        <span className="text-sm font-bold tabular-nums text-ink-900">
          {formatARS(limites.capitalSolicitado)}
        </span>
      </div>

      <ul className="mt-3 space-y-2">
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

      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-ink-400">
        <IconArrowDown width={13} height={13} />
        se toma el menor · {formatARS(limites.capitalPorLimites)}
      </p>

      {/* Limitantes: recortes porcentuales sobre el capital ya calculado. Gana el mayor. */}
      <div className="mt-3 rounded-xl border border-ink-200 bg-ink-25 px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
          Limitantes de la oferta
        </p>
        <p className="mt-0.5 text-xs text-ink-500">
          Recortan el capital ya calculado. Si aplican varios, manda el mayor recorte.
        </p>
        <ul className="mt-2 space-y-1">
          {limites.limitantes.map((l) => {
            const manda = l.aplica && l.recortePct === limites.recorteAplicadoPct && l.recortePct > 0;
            return (
              <li
                key={l.id}
                className={`flex flex-wrap items-baseline justify-between gap-2 rounded-lg px-2 py-1.5 text-xs ${
                  manda ? "bg-warning-50" : ""
                }`}
              >
                <span className={manda ? "font-semibold text-warning-700" : "text-ink-600"}>
                  {l.label} <span className="text-ink-400">· {l.detalle}</span>
                </span>
                <span
                  className={`shrink-0 font-semibold tabular-nums ${
                    l.aplica && l.recortePct > 0 ? "text-warning-700" : "text-ink-400"
                  }`}
                >
                  {l.aplica && l.recortePct > 0 ? `−${l.recortePct} %` : "sin recorte"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-600">
            <IconWallet width={12} height={12} />
            Capital considerado
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-brand-700">
            {formatARS(limites.capitalConsiderado)}
          </p>
          {limites.recorteAplicadoPct > 0 && (
            <p className="mt-0.5 text-[11px] text-brand-700/80">
              {formatARS(limites.capitalPorLimites)} con −{limites.recorteAplicadoPct} %
            </p>
          )}
        </div>
        <div className="rounded-xl border border-ink-200 bg-white px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500">
            <IconCheck width={12} height={12} />
            Cuota máxima
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-ink-900">
            {formatARS(limites.cuotaMaxima)}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {limites.limitesCuota.map((c) => {
              const manda = c.id === limites.limiteCuotaAplicadoId;
              return (
                <li
                  key={c.id}
                  className={`flex items-baseline justify-between gap-2 text-[11px] ${
                    manda ? "font-semibold text-ink-800" : "text-ink-400"
                  }`}
                >
                  <span>{c.label}</span>
                  <span className="tabular-nums">{formatARS(c.monto)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Card>
  );
}
