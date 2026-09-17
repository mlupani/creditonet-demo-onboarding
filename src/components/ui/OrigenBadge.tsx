import type { OrigenCampo, OrigenDato } from "@/lib/types";
import { IconCheck, IconLock, IconRefresh, IconSparkles, IconUser } from "@/components/icons";

const META: Record<
  OrigenDato,
  { label: string; classes: string; icon: React.ReactNode }
> = {
  "API pública": {
    label: "API pública",
    classes: "border-brand-100 bg-brand-50 text-brand-700",
    icon: <IconSparkles width={11} height={11} />,
  },
  "Base interna": {
    label: "Base interna",
    classes: "border-brand-100 bg-brand-50 text-brand-700",
    icon: <IconCheck width={11} height={11} strokeWidth={3} />,
  },
  Manual: {
    label: "Carga manual",
    classes: "border-ink-200 bg-ink-50 text-ink-500",
    icon: <IconUser width={11} height={11} />,
  },
};

export function OrigenBadge({ origen }: { origen: OrigenDato | undefined }) {
  if (!origen) return null;
  const m = META[origen];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${m.classes}`}
    >
      {m.icon}
      {m.label}
    </span>
  );
}

// Onboarding §3: origen del dato en las pantallas post-oferta. Los datos a cargar no llevan
// insignia; un precargado que se corrigió se muestra como rectificado.
export function OrigenCampoBadge({
  origen,
  rectificado = false,
}: {
  origen: OrigenCampo;
  rectificado?: boolean;
}) {
  if (origen === "A_CARGAR") return null;
  const base =
    "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
  if (origen === "NO_MODIFICABLE")
    return (
      <span className={`${base} border-ink-200 bg-ink-100 text-ink-600`}>
        <IconLock width={11} height={11} />
        No modificable
      </span>
    );
  if (rectificado)
    return (
      <span className={`${base} border-warning-200 bg-warning-50 text-warning-700`}>
        <IconRefresh width={11} height={11} />
        Rectificado
      </span>
    );
  return null;
}

export function YaInformadoBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success-700">
      <IconCheck width={11} height={11} strokeWidth={3} />
      Ya informado
    </span>
  );
}
