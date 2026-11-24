"use client";

import { useEffect, type ReactNode } from "react";
import { IconX } from "@/components/icons";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = "max-w-lg",
  closeDisabled = false,
  variant = "default",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
  /** Bloquea Escape, el fondo y la X mientras se graba. */
  closeDisabled?: boolean;
  /** `alert`: confirmación corta sin barras; el contenido dibuja su propio título y la X flota arriba a la derecha. */
  variant?: "default" | "alert";
}) {
  const cerrar = () => {
    if (!closeDisabled) onClose();
  };
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !closeDisabled) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, closeDisabled]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 animate-fade-in bg-ink-900/50 backdrop-blur-[2px]"
        onClick={cerrar}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex max-h-[90vh] w-full ${maxWidth} animate-scale-in flex-col overflow-hidden rounded-2xl bg-white shadow-lift`}
      >
        {variant === "alert" ? (
          <>
            <button
              onClick={cerrar}
              disabled={closeDisabled}
              aria-label="Cerrar"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-ink-500 text-white transition hover:bg-ink-600 disabled:opacity-50"
            >
              <IconX width={16} height={16} strokeWidth={2.4} />
            </button>
            <div className="flex-1 overflow-y-auto scroll-thin px-6 pb-2 pt-8">{children}</div>
            {footer && <div className="px-6 pb-6 pt-4">{footer}</div>}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 border-b border-ink-100 px-6 py-4">
              <h3 className="text-base font-semibold tracking-tight text-ink-900">{title}</h3>
              <button
                onClick={cerrar}
                disabled={closeDisabled}
                aria-label="Cerrar"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
              >
                <IconX width={18} height={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scroll-thin px-6 py-5">{children}</div>
            {footer && <div className="border-t border-ink-100 bg-ink-25 px-6 py-4">{footer}</div>}
          </>
        )}
      </div>
    </div>
  );
}
