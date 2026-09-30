"use client";

import { cerrarToast, useToasts } from "@/lib/toast";
import { IconCheck } from "@/components/icons";

export function ToastAcciones() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => cerrarToast(t.id)}
          className="pointer-events-auto flex items-center gap-2 rounded-xl bg-ink-900 px-4 py-3 text-sm font-semibold text-white shadow-lg"
        >
          <IconCheck width={16} height={16} className="text-success-500" />
          {t.texto}
        </button>
      ))}
    </div>
  );
}
