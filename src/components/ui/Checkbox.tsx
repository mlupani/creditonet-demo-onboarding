"use client";

import { IconCheck } from "@/components/icons";

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-start gap-3 rounded-lg text-left transition disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
          checked
            ? "border-brand-600 bg-brand-600 text-white"
            : "border-ink-300 bg-white group-hover:border-ink-400"
        }`}
      >
        {checked && <IconCheck width={13} height={13} strokeWidth={3} className="animate-fade-in" />}
      </span>
      <span>
        <span className={`block text-sm font-medium ${checked ? "text-ink-900" : "text-ink-700"}`}>
          {label}
        </span>
        {description && <span className="mt-0.5 block text-xs text-ink-500">{description}</span>}
      </span>
    </button>
  );
}
