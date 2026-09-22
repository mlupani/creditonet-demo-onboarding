"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconCheck, IconChevronDown } from "@/components/icons";
import { RequiredBadge } from "./RequiredBadge";
import { ValidationMessage } from "./ValidationMessage";

// Compacto estilo shadcn: ocupa lo mismo que SelectField (una sola fila).
// Trigger tipo <select> + popover con checkboxes. Mantiene <select multiple>
// oculto para semántica/a11y y preserva el orden del catálogo al guardar.
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
  placeholder = "Seleccioná bancos…",
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
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const showError = !!error;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (opcion: string) => {
    onChange(
      values.includes(opcion)
        ? values.filter((v) => v !== opcion)
        : options.filter((o) => o === opcion || values.includes(o))
    );
  };

  const display =
    values.length === 0
      ? placeholder
      : values.length <= 2
        ? values.join(", ")
        : `${values.length} bancos seleccionados`;

  return (
    <div ref={ref} className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink-700">
          {label}
        </label>
        {badge}
      </div>
      <div className="relative">
        {/* trigger compacto: misma altura que SelectField */}
        <button
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={showError}
          onClick={() => setOpen((v) => !v)}
          className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2.5 pr-9 text-left text-sm shadow-xs outline-none transition ${
            values.length === 0 ? "text-ink-400" : "text-ink-900"
          } ${
            showError
              ? "border-danger-400 focus:border-danger-500 focus:ring-2 focus:ring-danger-100"
              : open
                ? "border-brand-500 ring-2 ring-brand-100"
                : "border-ink-300 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          }`}
        >
          <span className="truncate">{display}</span>
          <IconChevronDown
            width={16}
            height={16}
            className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 transition ${open ? "rotate-180" : ""}`}
          />
        </button>
        {required && <RequiredBadge />}

        {/* popover estilo shadcn Command/Popover */}
        {open && (
          <div
            role="listbox"
            aria-multiselectable="true"
            className="absolute left-0 top-full z-20 mt-1 w-full rounded-lg border border-ink-200 bg-white p-1 shadow-lg"
          >
            <div className="max-h-56 overflow-auto">
              {options.map((opcion) => {
                const activa = values.includes(opcion);
                return (
                  <button
                    key={opcion}
                    type="button"
                    role="option"
                    aria-selected={activa}
                    onClick={() => toggle(opcion)}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition ${
                      activa ? "bg-brand-50 text-brand-700" : "text-ink-700 hover:bg-ink-50"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-white transition ${
                        activa ? "border-brand-500 bg-brand-500" : "border-ink-300 bg-white"
                      }`}
                    >
                      {activa && <IconCheck width={12} height={12} className="text-white" />}
                    </span>
                    <span className="flex-1 truncate">{opcion}</span>
                  </button>
                );
              })}
            </div>
            {values.length > 0 && (
              <div className="flex items-center justify-between border-t border-ink-100 px-2.5 py-1.5">
                <span className="text-xs text-ink-500">{values.length} seleccionado(s)</span>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-xs font-medium text-ink-600 hover:text-ink-900"
                >
                  Limpiar
                </button>
              </div>
            )}
          </div>
        )}

        {/* select nativo oculto: mantiene semántica SELECT + OPTIONS múltiples */}
        <select
          aria-hidden="true"
          tabIndex={-1}
          multiple
          value={values}
          onChange={() => {}}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <ValidationMessage tipo="error">{error}</ValidationMessage>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}
