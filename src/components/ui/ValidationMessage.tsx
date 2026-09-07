"use client";

import type { ReactNode } from "react";
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconInfo,
  IconXCircle,
} from "@/components/icons";

type Tipo = "error" | "warning" | "success" | "info";

const config: Record<
  Tipo,
  { icon: ReactNode; classes: string }
> = {
  error: {
    icon: <IconXCircle width={15} height={15} />,
    classes: "text-danger-600",
  },
  warning: {
    icon: <IconAlertTriangle width={15} height={15} />,
    classes: "text-warning-600",
  },
  success: {
    icon: <IconCheckCircle width={15} height={15} />,
    classes: "text-success-600",
  },
  info: {
    icon: <IconInfo width={15} height={15} />,
    classes: "text-brand-600",
  },
};

export function ValidationMessage({
  tipo,
  children,
  className = "",
}: {
  tipo: Tipo;
  children: ReactNode;
  className?: string;
}) {
  const c = config[tipo];
  return (
    <p
      role={tipo === "error" ? "alert" : "status"}
      className={`mt-1.5 flex items-start gap-1.5 text-xs font-medium leading-relaxed ${c.classes} ${className}`}
    >
      <span className="mt-[1px] shrink-0">{c.icon}</span>
      <span>{children}</span>
    </p>
  );
}
