"use client";

import { useApplication } from "@/lib/application-context";
import { evaluarPlan, getTerm } from "@/lib/credit";
import { formatARS, formatPct } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { DemoTag } from "@/components/ui/DemoTag";
import { IconCheck, IconLock, IconWallet, IconX } from "@/components/icons";

function Fila({
  label,
  valor,
  detalle,
  ok,
}: {
  label: string;
  valor: string;
  detalle: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-800">{label}</p>
        <p className="text-xs text-ink-500">{detalle}</p>
      </div>
      <span
        className={`inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold tabular-nums ${
          ok ? "text-success-700" : "text-danger-600"
        }`}
      >
        {ok ? (
          <IconCheck width={14} height={14} strokeWidth={3} />
        ) : (
          <IconX width={14} height={14} strokeWidth={3} />
        )}
        {valor}
      </span>
    </div>
  );
}

function Parametro({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg bg-ink-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink-800">{valor}</p>
    </div>
  );
}

/**
 * Plan de Cuotas (doc v2 §1, §6).
 *
 * Toma el capital que habilitó el motor y determina CÓMO se financia: sistema de
 * amortización, tasa, plazos, vencimientos, gracia, impuestos y cargos. La grilla se
 * consulta internamente para producir las alternativas; no es una pantalla del onboarding.
 */
export function PlanPanel() {
  const { app } = useApplication();
  const plan = evaluarPlan(app);
  const p = plan.plan;
  const o = app.oferta;
  const term = getTerm(o.plazo);

  return (
    <div className="space-y-3">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-ink-900">
              Configuración financiera · {p.nombre}
            </h3>
            <p className="mt-0.5 text-xs text-ink-500">
              Parámetros con los que el plan calcula cada alternativa.
            </p>
          </div>
          <DemoTag
            variant="regla"
            detalle="Las fórmulas de tasas, impuestos, sellos y cargos son un pendiente funcional del Plan de Cuotas (§14). Los valores mostrados son de demo."
          />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <Parametro label="Sistema de amortización" valor={p.sistema} />
          <Parametro label="Cantidad de cuotas" valor={p.plazos.join(" · ")} />
          <Parametro label="Tasa nominal anual" valor={`${term.tna} %`} />
          <Parametro label="Período de gracia" valor={`${p.periodoGraciaDias} días`} />
          <Parametro label="1er vencimiento" valor={term.primeraCuota} />
          <Parametro label="IVA" valor={`${p.ivaPct} %`} />
          <Parametro label="Sellos" valor={`${p.sellosPct} %`} />
          <Parametro label="Cargo de otorgamiento" valor={`${p.cargoOtorgamientoPct} %`} />
        </div>
      </Card>

      <Card className="px-5 py-2 sm:px-6">
        <div className="divide-y divide-ink-100">
          <Fila
            label="Relación cuota-ingreso (RCI)"
            valor={formatPct(plan.rciPct)}
            detalle={`Cuota ${formatARS(plan.cuotaPlan)} sobre ingreso neto ${formatARS(plan.ingresoNeto)} · tope ${p.rciMaxPct} % (cuota máx. ${formatARS(plan.cuotaMaximaRci)})`}
            ok={plan.cumpleRci}
          />
          <Fila
            label="Nivel de endeudamiento"
            valor={formatPct(plan.endeudamientoPct)}
            detalle={`Incluye cuotas vigentes por ${formatARS(plan.cuotasVigentes)} · máximo ${p.endeudamientoMaxPct} %`}
            ok={plan.cumpleEndeudamiento}
          />
          <Fila
            label="SMVM de bolsillo"
            valor={formatARS(plan.ingresoBolsillo)}
            detalle={`Ingreso que queda luego de pagar cuotas · mínimo ${formatARS(p.smvmBolsillo)}`}
            ok={plan.cumpleSmvm}
          />
        </div>
      </Card>

      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 px-5 py-5 text-white shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-100">
              <IconWallet width={14} height={14} />
              Capital máximo otorgable
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">
              {formatARS(plan.capitalMaximo)}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {p.plazos.map((n) => (
              <span
                key={n}
                className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-xs font-semibold"
              >
                {n} cuotas
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-ink-200 bg-ink-25 px-4 py-3">
        <IconLock width={15} height={15} className="mt-0.5 shrink-0 text-ink-400" />
        <p className="text-xs leading-relaxed text-ink-500">
          Con el capital y la cuota máxima, el plan consulta <strong>internamente</strong> la
          grilla de financiación y descarta las combinaciones que no cumplen. El vendedor nunca
          opera la grilla: sólo ve las alternativas válidas que resultan, en la pantalla de
          oferta.
        </p>
      </div>
    </div>
  );
}
