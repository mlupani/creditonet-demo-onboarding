"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { ValidationMessage } from "@/components/ui/ValidationMessage";

// Campo numérico (enteros o decimales) con sufijo opcional: "%", "días", etc.
export function CampoNumero({
  id,
  label,
  value,
  onChange,
  sufijo,
  hint,
  error,
  min = 0,
  step = 1,
  disabled = false,
  className = "",
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  sufijo?: string;
  hint?: string;
  error?: string;
  min?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={Number.isFinite(value) ? value : ""}
          disabled={disabled}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm tabular-nums text-ink-900 shadow-xs outline-none transition ${
            sufijo ? "pr-14" : ""
          } ${
            error
              ? "border-danger-400 focus:border-danger-500 focus:ring-2 focus:ring-danger-100"
              : "border-ink-300 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          } ${disabled ? "cursor-not-allowed bg-ink-50 text-ink-500" : ""}`}
        />
        {sufijo && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-400">
            {sufijo}
          </span>
        )}
      </div>
      {error ? (
        <ValidationMessage tipo="error">{error}</ValidationMessage>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

// Las fechas de la demo se guardan como dd/mm/aaaa; el selector nativo usa aaaa-mm-dd.
export function fechaAIso(texto: string | null): string {
  const m = texto ? /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim()) : null;
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}

export function isoAFecha(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

// Encabezado común de cada sección: deja claro si lo que se edita cambia el flujo de la demo.
export function Panel({
  titulo,
  descripcion,
  vivo = false,
  nota,
  children,
}: {
  titulo: string;
  descripcion: string;
  // true: alimenta el flujo real de la demo. false: valores de ejemplo que sólo se guardan.
  vivo?: boolean;
  nota?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-ink-900">{titulo}</h2>
          <p className="mt-0.5 text-sm text-ink-500">{descripcion}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            vivo
              ? "border-brand-200 bg-brand-50 text-brand-700"
              : "border-ink-200 bg-ink-50 text-ink-500"
          }`}
        >
          {vivo ? "Conectado al flujo" : "Valores de ejemplo"}
        </span>
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        {nota && <p className="rounded-lg bg-ink-25 px-3 py-2 text-xs text-ink-500">{nota}</p>}
        {children}
      </div>
    </Card>
  );
}

export function Subtitulo({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{children}</h3>
  );
}
