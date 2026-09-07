"use client";

import type { ReactNode } from "react";

export function Tooltip({
  label,
  children,
  side = "right",
}: {
  label: string;
  children: ReactNode;
  side?: "right" | "top";
}) {
  const position =
    side === "right"
      ? "left-full top-1/2 ml-2 -translate-y-1/2"
      : "bottom-full left-1/2 mb-2 -translate-x-1/2";
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 ${position} hidden whitespace-nowrap rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lift group-hover:block`}
      >
        {label}
      </span>
    </span>
  );
}

export function TooltipInline({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="group relative inline-flex cursor-help underline decoration-dotted decoration-ink-300 underline-offset-2">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-56 -translate-x-1/2 whitespace-normal rounded-lg bg-ink-900 px-3 py-2 text-xs font-medium leading-relaxed text-white shadow-lift group-hover:block"
      >
        {label}
      </span>
    </span>
  );
}
