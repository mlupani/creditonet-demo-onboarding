"use client";

import type { ReactNode } from "react";
import { IconCheck } from "@/components/icons";
import { RequiredBadge } from "./RequiredBadge";
import { ValidationMessage } from "./ValidationMessage";

// Selección múltiple con opciones visibles: cada opción se marca o desmarca por separado.
export function MultiSelectField({
  id,
  label,
  values,
  onChange,
  options,
  error,
  hint,
  badge,
  required = false,
  className = "",
}: {
  id: string;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: string[];
  error?: string;
  hint?: string;
  badge?: ReactNode;
  required?: boolean;
  className?: string;
}) {
  const alternar = (opcion: string) =>
    onChange(
      values.includes(opcion)
        ? values.filter((v) => v !== opcion)
        : options.filter((o) => o === opcion || values.includes(o))
    );

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-medium text-ink-700">
          {label}
        </span>
        {badge}
      </div>
      <div
        id={id}
        role="group"
        aria-labelledby={`${id}-label`}
        className="relative flex flex-wrap gap-2"
      >
        {required && <RequiredBadge />}
        {options.map((opcion) => {
          const activa = values.includes(opcion);
          return (
            <button
              key={opcion}
              type="button"
              aria-pressed={activa}
              onClick={() => alternar(opcion)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm shadow-xs outline-none transition focus-visible:ring-2 focus-visible:ring-brand-100 ${
                activa
                  ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                  : error
                    ? "border-danger-400 bg-white text-ink-700 hover:border-danger-500"
                    : "border-ink-300 bg-white text-ink-700 hover:border-ink-400"
              }`}
            >
              {activa && <IconCheck width={14} height={14} />}
              {opcion}
            </button>
          );
        })}
      </div>
      {error ? (
        <ValidationMessage tipo="error">{error}</ValidationMessage>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}
