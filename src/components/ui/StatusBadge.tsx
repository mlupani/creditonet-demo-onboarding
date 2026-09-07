import type { EstadoCredito } from "@/lib/types";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "brand";

const toneClasses: Record<Tone, string> = {
  success: "bg-success-50 text-success-700 border-success-200",
  warning: "bg-warning-50 text-warning-700 border-warning-200",
  danger: "bg-danger-50 text-danger-700 border-danger-200",
  info: "bg-brand-50 text-brand-700 border-brand-200",
  neutral: "bg-ink-100 text-ink-600 border-ink-200",
  brand: "bg-brand-600 text-white border-brand-600",
};

const ESTADO_META: Record<EstadoCredito, { label: string; tone: Tone }> = {
  BORRADOR: { label: "Borrador", tone: "neutral" },
  EN_ANALISIS: { label: "En análisis", tone: "info" },
  ANALISIS_TOMADO: { label: "Análisis en curso", tone: "info" },
  OBSERVADA: { label: "Observada", tone: "warning" },
  APROBADO: { label: "Aprobado", tone: "success" },
  RECHAZADO: { label: "Rechazada", tone: "danger" },
};

export function StatusBadge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function EstadoBadge({ estado }: { estado: EstadoCredito }) {
  const meta = ESTADO_META[estado];
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>;
}
