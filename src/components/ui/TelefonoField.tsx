"use client";

import { useState } from "react";
import { armarTelefono, parseTelefono, sanitizarNumero } from "@/lib/telefono";
import { PaisSelect } from "./PaisSelect";
import { ValidationMessage } from "./ValidationMessage";

const control =
  "rounded-lg border bg-white px-3 py-2.5 text-sm text-ink-900 shadow-xs outline-none transition placeholder:text-ink-400";

// Teléfono con área (país) y número. El valor es un único texto ("+54 3515432100") y el
// número se limita a los dígitos del país elegido.
export function TelefonoField({
  id,
  label,
  value,
  onChange,
  error,
  required = false,
  className = "",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  className?: string;
}) {
  const [touched, setTouched] = useState(false);
  const { pais, numero } = parseTelefono(value);
  const showError = touched && !!error;
  const border = showError
    ? "border-danger-400 focus:border-danger-500 focus:ring-2 focus:ring-danger-100"
    : "border-ink-300 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <div className={className}>
      <label htmlFor={`${id}-numero`} className="mb-1.5 block text-sm font-medium text-ink-700">
        {label}
        {required && <span className="ml-0.5 text-danger-500">*</span>}
      </label>
      <div className="flex gap-2">
        <PaisSelect
          id={`${id}-pais`}
          value={pais}
          onChange={(codigo) => onChange(armarTelefono(codigo, sanitizarNumero(codigo, numero)))}
          invalid={showError}
          className="w-32 shrink-0"
        />
        <input
          id={`${id}-numero`}
          type="text"
          inputMode="tel"
          value={numero}
          onChange={(e) => onChange(armarTelefono(pais, sanitizarNumero(pais, e.target.value)))}
          onBlur={() => setTouched(true)}
          aria-invalid={showError}
          className={`${control} ${border} min-w-0 flex-1`}
        />
      </div>
      {showError && <ValidationMessage tipo="error">{error}</ValidationMessage>}
    </div>
  );
}
