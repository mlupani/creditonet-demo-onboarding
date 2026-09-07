"use client";

import { formatNumber, onlyDigits } from "@/lib/format";
import { ValidationMessage } from "./ValidationMessage";

interface MoneyInputProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  size?: "md" | "lg";
  className?: string;
}

export function MoneyInput({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  required = false,
  disabled = false,
  size = "md",
  className = "",
}: MoneyInputProps) {
  const display = value > 0 ? formatNumber(value) : "";
  const showError = !!error;
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink-700">
          {label}
          {required && <span className="ml-0.5 text-danger-500">*</span>}
        </label>
      </div>
      <div className="relative">
        <span
          className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-ink-500 ${
            size === "lg" ? "text-lg" : "text-sm"
          }`}
        >
          $
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={display}
          onChange={(e) => {
            const digits = onlyDigits(e.target.value);
            onChange(digits ? Number(digits) : 0);
          }}
          placeholder="0"
          disabled={disabled}
          aria-invalid={showError}
          className={`w-full rounded-lg border bg-white shadow-xs outline-none transition tabular-nums ${
            size === "lg" ? "py-3 pl-9 pr-4 text-lg font-semibold" : "py-2.5 pl-7 pr-3 text-sm"
          } ${
            showError
              ? "border-danger-400 focus:border-danger-500 focus:ring-2 focus:ring-danger-100"
              : "border-ink-300 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          } ${disabled ? "cursor-not-allowed bg-ink-50 text-ink-500" : "text-ink-900"}`}
        />
      </div>
      {error ? (
        <ValidationMessage tipo="error">{error}</ValidationMessage>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}
