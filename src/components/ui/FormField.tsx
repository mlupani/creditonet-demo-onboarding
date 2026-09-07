"use client";

import { useState, type ReactNode } from "react";
import { IconCheck, IconSparkles } from "@/components/icons";
import { ValidationMessage } from "./ValidationMessage";

const inputBase =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink-900 shadow-xs outline-none transition placeholder:text-ink-400";

interface FormFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  autocompletado?: boolean;
  badge?: ReactNode;
  required?: boolean;
  maxLength?: number;
  inputMode?: "numeric" | "text" | "email" | "tel";
  disabled?: boolean;
  className?: string;
}

export function FormField({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  hint,
  autocompletado = false,
  badge,
  required = false,
  maxLength,
  inputMode,
  disabled = false,
  className = "",
}: FormFieldProps) {
  const [touched, setTouched] = useState(false);
  const showError = touched && !!error;
  const showOk = touched && !error && value.trim().length > 0;

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink-700">
          {label}
          {required && <span className="ml-0.5 text-danger-500">*</span>}
        </label>
        {badge
          ? badge
          : autocompletado && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-100 bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                <IconSparkles width={11} height={11} />
                Autocompletado
              </span>
            )}
      </div>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          maxLength={maxLength}
          inputMode={inputMode}
          disabled={disabled}
          aria-invalid={showError}
          className={`${inputBase} ${
            showError
              ? "border-danger-400 focus:border-danger-500 focus:ring-2 focus:ring-danger-100"
              : "border-ink-300 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          } ${showOk ? "pr-9" : ""} ${disabled ? "cursor-not-allowed bg-ink-50 text-ink-500" : ""}`}
        />
        {showOk && (
          <IconCheck
            width={16}
            height={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-success-600"
          />
        )}
      </div>
      {showError ? (
        <ValidationMessage tipo="error">{error}</ValidationMessage>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}
