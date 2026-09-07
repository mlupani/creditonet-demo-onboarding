"use client";

import type { RiskRule as RiskRuleType } from "@/lib/types";
import { OUTCOME_LABEL } from "@/lib/credit";
import { IconAlertTriangle, IconCheck, IconX } from "@/components/icons";
import { StatusBadge } from "./ui/StatusBadge";

export function RiskRule({ rule, index }: { rule: RiskRuleType; index: number }) {
  const cumple = rule.resultado === "CUMPLE";
  const advertencia = rule.resultado === "ADVERTENCIA";
  const tone = cumple ? "success" : advertencia ? "warning" : "danger";

  return (
    <li
      className="animate-fade-up rounded-xl border border-ink-200 bg-white p-4 shadow-card transition hover:border-ink-300"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
            cumple
              ? "border-success-200 bg-success-50 text-success-600"
              : advertencia
                ? "border-warning-200 bg-warning-50 text-warning-600"
                : "border-danger-200 bg-danger-50 text-danger-600"
          }`}
        >
          {cumple ? (
            <IconCheck width={17} height={17} strokeWidth={2.5} />
          ) : advertencia ? (
            <IconAlertTriangle width={17} height={17} />
          ) : (
            <IconX width={17} height={17} strokeWidth={2.5} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink-900">{rule.nombre}</p>
            <StatusBadge tone={tone}>
              {cumple ? "✓ " : ""}
              {OUTCOME_LABEL[rule.resultado]}
            </StatusBadge>
          </div>
          <p className="mt-0.5 text-xs text-ink-500">{rule.detalle}</p>
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
