import type { OrigenDato } from "@/lib/types";
import { IconCheck, IconSparkles, IconUser } from "@/components/icons";

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

export function AutocompletadoBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-100 bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
      <IconSparkles width={11} height={11} />
      Autocompletado
    </span>
  );
}

export function YaInformadoBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success-700">
      <IconCheck width={11} height={11} strokeWidth={3} />
      Ya informado
    </span>
  );
}
