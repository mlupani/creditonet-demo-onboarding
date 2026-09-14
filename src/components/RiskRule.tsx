"use client";

import type { ReglaInstitucional, RiskRule as RiskRuleType } from "@/lib/types";
import { OUTCOME_LABEL } from "@/lib/credit";
import { reglaMarcada } from "@/lib/motores";
import { IconAlertTriangle, IconCheck, IconClock, IconX } from "@/components/icons";
import { StatusBadge } from "./ui/StatusBadge";

// Una regla del motor o una regla institucional. Cada una indica si es bloqueante; una no
// bloqueante que no pasa se muestra marcada para el analista (Motor §4).
export function RiskRule({
  rule,
  index,
  momento,
}: {
  rule: RiskRuleType | ReglaInstitucional;
  index: number;
  momento?: string;
}) {
  const pasa = rule.resultado === "PASA";
  const esperando = rule.resultado === "ESPERANDO_DATOS";
  const marcada = reglaMarcada(rule);
  const tone = pasa ? "success" : esperando ? "neutral" : marcada ? "warning" : "danger";

  return (
    <li
      className="animate-fade-up rounded-xl border border-ink-200 bg-white p-4 shadow-card transition hover:border-ink-300"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
            pasa
              ? "border-success-200 bg-success-50 text-success-600"
              : esperando
                ? "border-ink-200 bg-ink-50 text-ink-400"
                : marcada
                  ? "border-warning-200 bg-warning-50 text-warning-600"
                  : "border-danger-200 bg-danger-50 text-danger-600"
          }`}
        >
          {pasa ? (
            <IconCheck width={17} height={17} strokeWidth={2.5} />
          ) : esperando ? (
            <IconClock width={17} height={17} />
          ) : marcada ? (
            <IconAlertTriangle width={17} height={17} />
          ) : (
            <IconX width={17} height={17} strokeWidth={2.5} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
              <span className="rounded-md border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink-500">
                {rule.codigo}
              </span>
              {rule.nombre}
              <span className="rounded-full border border-ink-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                {rule.fuente}
              </span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  rule.bloqueante
                    ? "bg-ink-900 text-white"
                    : "border border-warning-300 bg-warning-50 text-warning-700"
                }`}
              >
                {rule.bloqueante ? "Bloqueante" : "No bloqueante"}
              </span>
            </p>
            <StatusBadge tone={tone}>
              {pasa ? "✓ " : ""}
              {marcada ? "No pasa · marcada para el analista" : OUTCOME_LABEL[rule.resultado]}
            </StatusBadge>
          </div>
          <p className="mt-0.5 text-xs text-ink-500">{rule.detalle}</p>
          {momento && <p className="mt-0.5 text-[11px] text-ink-400">{momento}</p>}
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:gap-4">
            <div className="rounded-lg bg-ink-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                Valor evaluado
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-ink-800">
                {rule.valorEvaluado}
              </p>
            </div>
            <div className="rounded-lg bg-ink-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                Condición
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-ink-800">
                {rule.condicion}
              </p>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
