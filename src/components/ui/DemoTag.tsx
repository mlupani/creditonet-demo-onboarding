"use client";

import { IconInfo } from "@/components/icons";

type Variant = "config" | "regla";

const LABEL: Record<Variant, string> = {
  config: "Configuración DEMO",
  regla: "Regla simulada",
};

/**
 * Marca visible para toda decisión funcional todavía pendiente en la
 * documentación de CreditoNet. No representa una regla definitiva.
 */
export function DemoTag({
  variant = "regla",
  detalle,
  className = "",
}: {
  variant?: Variant;
  detalle: string;
  className?: string;
}) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      <span className="inline-flex cursor-help items-center gap-1 rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-700">
        <IconInfo width={11} height={11} />
        {LABEL[variant]}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 hidden w-64 whitespace-normal rounded-lg bg-ink-900 px-3 py-2 text-[11px] font-medium leading-relaxed text-white shadow-lift group-hover:block"
      >
        <span className="mb-0.5 block font-bold text-warning-200">{LABEL[variant]}</span>
        {detalle}
      </span>
    </span>
  );
}
