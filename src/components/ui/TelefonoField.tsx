"use client";

import { useState } from "react";
import {
  armarTelefono,
  parseTelefono,
  sanitizarCaracteristica,
  sanitizarNumero,
} from "@/lib/telefono";
import { PaisSelect } from "./PaisSelect";
import { RequiredBadge } from "./RequiredBadge";
import { ValidationMessage } from "./ValidationMessage";

const control =
  "rounded-lg border bg-white px-3 py-2.5 text-sm text-ink-900 shadow-xs outline-none transition placeholder:text-ink-400";

// Teléfono con área (país), característica (código de área/localidad) y número. El valor es un
// único texto ("+54 351 5432100") y el número se limita a los dígitos que le quedan al país
// elegido una vez descontada la característica.
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
  const { pais, caracteristica, numero } = parseTelefono(value);
  const showError = touched && !!error;
  const border = showError
    ? "border-danger-400 focus:border-danger-500 focus:ring-2 focus:ring-danger-100"
    : "border-ink-300 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <div className={className}>
      <label htmlFor={`${id}-numero`} className="mb-1.5 block text-sm font-medium text-ink-700">
        {label}
      </label>
      <div className="relative flex gap-2">
        {required && <RequiredBadge />}
        <PaisSelect
          id={`${id}-pais`}
          value={pais}
          onChange={(codigo) =>
            onChange(armarTelefono(codigo, caracteristica, sanitizarNumero(codigo, caracteristica, numero)))
          }
          invalid={showError}
          className="w-32 shrink-0"
        />
        <input
          id={`${id}-caracteristica`}
          type="text"
          inputMode="tel"
          placeholder="Caract."
          aria-label="Característica"
          value={caracteristica}
          onChange={(e) => {
            const car = sanitizarCaracteristica(e.target.value);
            onChange(armarTelefono(pais, car, sanitizarNumero(pais, car, numero)));
          }}
          onBlur={() => setTouched(true)}
          aria-invalid={showError}
          className={`${control} ${border} w-20 shrink-0`}
        />
        <input
          id={`${id}-numero`}
          type="text"
          inputMode="tel"
          value={numero}
          onChange={(e) =>
            onChange(armarTelefono(pais, caracteristica, sanitizarNumero(pais, caracteristica, e.target.value)))
          }
          onBlur={() => setTouched(true)}
          aria-invalid={showError}
          className={`${control} ${border} min-w-0 flex-1`}
        />
      </div>
      {showError && <ValidationMessage tipo="error">{error}</ValidationMessage>}
    </div>
  );
}
