"use client";

import type { PantallaPostOfertaId } from "@/lib/types";
import type { EstadoVisualPantalla } from "@/lib/validation";
import { IconCheck } from "@/components/icons";

export interface PasoLibre {
  id: PantallaPostOfertaId;
  numero: number;
  label: string;
  obligatoria: boolean;
  estado: EstadoVisualPantalla;
  // El analista observó justamente esta pantalla: se resalta para ir derecho a ella.
  observada?: boolean;
}

const CIRCULO: Record<EstadoVisualPantalla, string> = {
  COMPLETA: "bg-success-600 text-white",
  INICIADA: "bg-brand-600 text-white",
  NO_INICIADA: "border border-ink-300 bg-ink-100 text-ink-500",
};

const TEXTO: Record<EstadoVisualPantalla, string> = {
  COMPLETA: "text-success-700",
  INICIADA: "text-brand-700",
  NO_INICIADA: "text-ink-500",
};

const DETALLE: Record<EstadoVisualPantalla, string> = {
  COMPLETA: "Completa",
  INICIADA: "Con pendientes",
  NO_INICIADA: "No iniciada",
};

/**
 * Indicador numérico de la etapa post-oferta (Guía §6.1).
 * Verde: completa y validada · Azul: iniciada con obligatorios pendientes · Gris: no iniciada.
 * La pantalla actual se marca con un anillo, independiente del color. Todas son navegables.
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
    <div>
      <ol className="flex items-stretch gap-1.5 overflow-x-auto scroll-thin pb-1">
        {pasos.map((paso, index) => {
          const activa = paso.id === actual;
          return (
            <li key={paso.id} className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => onSelect(paso.id)}
                aria-current={activa ? "step" : undefined}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                  activa
                    ? "border-brand-400 bg-white shadow-card ring-2 ring-brand-100"
                    : paso.observada
                      ? "border-warning-400 bg-warning-50 hover:bg-warning-50"
                      : "border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                    CIRCULO[paso.estado]
                  } ${activa ? "ring-4 ring-brand-100" : ""}`}
                >
                  {paso.estado === "COMPLETA" ? (
                    <IconCheck width={12} height={12} strokeWidth={3} />
                  ) : (
                    paso.numero
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block whitespace-nowrap text-xs ${
                      activa ? "font-bold" : "font-semibold"
                    } ${TEXTO[paso.estado]}`}
                  >
                    {paso.label}
                  </span>
                  <span
                    className={`block text-[10px] font-medium ${
                      paso.observada ? "text-warning-700" : "text-ink-400"
                    }`}
                  >
                    {paso.observada
                      ? "A corregir"
                      : `${DETALLE[paso.estado]} · ${paso.obligatoria ? "Obligatoria" : "Opcional"}`}
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
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-success-600" /> Completa y validada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-600" /> Iniciada con pendientes
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-ink-300 bg-ink-100" /> No
          iniciada
        </span>
      </div>
    </div>
  );
}
