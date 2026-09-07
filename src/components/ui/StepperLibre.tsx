"use client";

import type { PantallaPostOfertaId } from "@/lib/types";
import { IconCheck } from "@/components/icons";

export interface PasoLibre {
  id: PantallaPostOfertaId;
  label: string;
  obligatoria: boolean;
  completa: boolean;
}

/**
 * Stepper de navegación libre para la etapa post-oferta.
 * Estados: ✓ Completa (verde) · ● Activa (azul) · ○ Pendiente (gris).
 * Todos los pasos son navegables en cualquier momento.
 */
export function StepperLibre({
  pasos,
  actual,
  onSelect,
}: {
  pasos: PasoLibre[];
  actual: PantallaPostOfertaId;
  onSelect: (id: PantallaPostOfertaId) => void;
}) {
  return (
    <ol className="flex items-stretch gap-1.5 overflow-x-auto scroll-thin pb-1">
      {pasos.map((paso, index) => {
        const activa = paso.id === actual;
        const completa = paso.completa && !activa;
        return (
          <li key={paso.id} className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => onSelect(paso.id)}
              aria-current={activa ? "step" : undefined}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                activa
                  ? "border-brand-300 bg-brand-50 shadow-xs"
                  : completa
                    ? "border-success-200 bg-success-50/50 hover:bg-success-50"
                    : "border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                  activa
                    ? "bg-brand-600 text-white ring-4 ring-brand-100"
                    : completa
                      ? "bg-success-600 text-white"
                      : "border border-ink-300 bg-white text-ink-400"
                }`}
              >
                {completa ? (
                  <IconCheck width={12} height={12} strokeWidth={3} />
                ) : activa ? (
                  "●"
                ) : (
                  index + 1
                )}
              </span>
              <span className="min-w-0">
                <span
                  className={`block whitespace-nowrap text-xs font-semibold ${
                    activa
                      ? "text-brand-700"
                      : completa
                        ? "text-success-700"
                        : "text-ink-600"
                  }`}
                >
                  {paso.label}
                </span>
                <span className="block text-[10px] font-medium text-ink-400">
                  {paso.obligatoria ? "Obligatoria" : "Opcional"}
                </span>
              </span>
            </button>
            {index < pasos.length - 1 && (
              <span aria-hidden className="mx-0.5 h-0.5 w-3 shrink-0 rounded-full bg-ink-200" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
