"use client";

import type { ReactNode } from "react";
import { Card } from "./Card";

export interface SummaryRow {
  label: string;
  value: ReactNode;
  tone?: "default" | "brand" | "success" | "danger" | "muted" | "warning";
  strong?: boolean;
  big?: boolean;
}

const toneClasses: Record<SummaryRow["tone"] & string, string> = {
  default: "text-ink-900",
  brand: "text-brand-700",
  success: "text-success-700",
  danger: "text-danger-600",
  warning: "text-warning-700",
  muted: "text-ink-500",
};

export function SummaryCard({
  title,
  icon,
  rows,
  footer,
  className = "",
  children,
}: {
  title?: string;
  icon?: ReactNode;
  rows?: SummaryRow[];
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Card className={className}>
      {title && (
        <div className="flex items-center gap-2.5 border-b border-ink-100 px-5 py-4">
          {icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              {icon}
            </span>
          )}
          <h3 className="text-sm font-semibold tracking-tight text-ink-900">{title}</h3>
        </div>
      )}
      <div className="px-5 py-4">
        {rows && rows.length > 0 && (
          <dl className="space-y-2.5">
            {rows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4">
                <dt className={`text-sm ${row.strong ? "font-medium text-ink-700" : "text-ink-500"}`}>
                  {row.label}
                </dt>
                <dd
                  className={`text-right tabular-nums ${
                    row.big
                      ? `text-lg font-bold ${toneClasses[row.tone ?? "default"]}`
                      : `text-sm font-semibold ${toneClasses[row.tone ?? "default"]}`
                  }`}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {children}
      </div>
      {footer && <div className="border-t border-ink-100 px-5 py-4">{footer}</div>}
    </Card>
  );
}
