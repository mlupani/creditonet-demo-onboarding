"use client";

import type { ReactNode } from "react";
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconInfo,
  IconXCircle,
} from "@/components/icons";

type Tone = "error" | "warning" | "success" | "info";

const config: Record<Tone, { icon: ReactNode; box: string; text: string }> = {
  error: {
    icon: <IconXCircle width={20} height={20} />,
    box: "border-danger-200 bg-danger-50",
    text: "text-danger-700",
  },
  warning: {
    icon: <IconAlertTriangle width={20} height={20} />,
    box: "border-warning-200 bg-warning-50",
    text: "text-warning-700",
  },
  success: {
    icon: <IconCheckCircle width={20} height={20} />,
    box: "border-success-200 bg-success-50",
    text: "text-success-700",
  },
  info: {
    icon: <IconInfo width={20} height={20} />,
    box: "border-brand-200 bg-brand-50",
    text: "text-brand-700",
  },
};

export function Banner({
  tone,
  title,
  children,
  className = "",
}: {
  tone: Tone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const c = config[tone];
  return (
    <div className={`animate-fade-in rounded-xl border p-4 ${c.box} ${className}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 ${c.text}`}>{c.icon}</span>
        <div className="min-w-0 text-sm">
          {title && <p className={`font-semibold ${c.text}`}>{title}</p>}
          <div className={title ? "mt-0.5 text-ink-700" : c.text}>{children}</div>
        </div>
      </div>
    </div>
  );
}
