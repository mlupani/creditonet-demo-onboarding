"use client";

import type { WizardStepMeta } from "@/lib/types";
import { IconCheck } from "@/components/icons";

/**
 * Stepper no destructivo (prompt de auditoría §6–§8).
 *
 * `maxAlcanzado` es el paso más avanzado de la sesión y nunca baja al volver atrás. Por eso
 * un paso ya completado conserva su tilde aunque el usuario esté parado antes, y se puede
 * saltar hacia adelante sin volver a recorrer el flujo: los datos siguen en memoria.
 */
export function Stepper({
  steps,
  current,
  maxAlcanzado,
  onStepClick,
}: {
  steps: WizardStepMeta[];
  current: number;
  maxAlcanzado: number;
  onStepClick?: (numero: number) => void;
}) {
  return (
    <ol className="flex items-center overflow-x-auto scroll-thin pb-1">
      {steps.map((step, index) => {
        const numero = index + 1;
        // Completado = se avanzó más allá de él en algún momento de la sesión.
        const done = numero < maxAlcanzado && numero !== current;
        const active = numero === current;
        const clickable = numero <= maxAlcanzado && !active && !!onStepClick;
        return (
          <li key={step.id} className="flex shrink-0 items-center">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(numero)}
              className={`flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition ${
                clickable ? "cursor-pointer hover:bg-ink-100" : "cursor-default"
              }`}
              aria-current={active ? "step" : undefined}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                  active
                    ? "bg-brand-600 text-white shadow-sm ring-4 ring-brand-100"
                    : done
                      ? "border border-brand-200 bg-brand-100 text-brand-700"
                      : "border border-ink-200 bg-white text-ink-400"
                }`}
              >
                {done ? <IconCheck width={14} height={14} strokeWidth={2.5} /> : numero}
              </span>
              <span
                className={`hidden whitespace-nowrap text-sm md:block ${
                  active
                    ? "font-semibold text-brand-700"
                    : done
                      ? "font-medium text-ink-700"
                      : "font-medium text-ink-400"
                }`}
              >
                {step.titulo}
              </span>
            </button>
            {index < steps.length - 1 && (
              <span
                className={`mx-1 h-0.5 w-6 rounded-full transition-colors md:w-9 ${
                  numero < maxAlcanzado ? "bg-brand-500" : "bg-ink-200"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
