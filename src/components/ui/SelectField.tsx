"use client";

import type { ReactNode } from "react";
import { IconChevronDown } from "@/components/icons";
import { RequiredBadge } from "./RequiredBadge";
import { ValidationMessage } from "./ValidationMessage";

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
  error?: string;
  hint?: string;
  badge?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Seleccioná una opción…",
  error,
  hint,
  badge,
  required = false,
  disabled = false,
  className = "",
}: SelectFieldProps) {
  const showError = !!error;
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink-700">
          {label}
        </label>
        {badge}
      </div>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-invalid={showError}
          className={`w-full appearance-none rounded-lg border bg-white px-3 py-2.5 pr-9 text-sm shadow-xs outline-none transition ${
            value ? "text-ink-900" : "text-ink-400"
          } ${
            showError
              ? "border-danger-400 focus:border-danger-500 focus:ring-2 focus:ring-danger-100"
              : "border-ink-300 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          } ${disabled ? "cursor-not-allowed bg-ink-50 text-ink-500" : ""}`}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <IconChevronDown
          width={16}
          height={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"
        />
        {required && <RequiredBadge />}
      </div>
      {error ? (
        <ValidationMessage tipo="error">{error}</ValidationMessage>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}
