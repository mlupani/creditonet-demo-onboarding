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

// Etiquetas de la máquina de estados — incluye los 8 estados de creditonet-34 (Guía §8).
export const ESTADO_META: Record<EstadoCredito, { label: string; tone: Tone }> = {
  BORRADOR: { label: "Borrador", tone: "neutral" },
  EN_TRAMITE: { label: "En trámite", tone: "info" },
  PREAPROBADO: { label: "Preaprobado", tone: "brand" },
  ANALISIS_TOMADO: { label: "En análisis", tone: "info" },
  OBSERVADO: { label: "Observado", tone: "warning" },
  CAMBIO_OFERTA: { label: "Cambio de oferta", tone: "warning" },
  RECHAZADO: { label: "Rechazado", tone: "danger" },
  ANULADO: { label: "Anulado", tone: "neutral" },
  APROBADO: { label: "Aprobado", tone: "success" },
  EN_FIRMA: { label: "En firma", tone: "info" },
  FIRMADO: { label: "Firma aprobada", tone: "success" },
  CHEQUEO_TELEFONICO: { label: "Chequeo telefónico", tone: "info" },
  PARA_LIQUIDAR: { label: "Para liquidar", tone: "success" },
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

// `etiqueta`: reemplaza el texto de una solicitud devuelta por el analista (COFE u OBS en la bandeja del vendedor).
export function EstadoBadge({
  estado,
  etiqueta,
}: {
  estado: EstadoCredito;
  etiqueta?: string;
}) {
  const meta =
    etiqueta && (estado === "OBSERVADO" || estado === "CAMBIO_OFERTA")
      ? { label: etiqueta, tone: "warning" as const }
      : ESTADO_META[estado];
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>;
}
