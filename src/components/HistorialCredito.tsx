"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { HiloObservacion } from "@/components/analisis/HiloObservacion";
import { LogEstados } from "@/components/LogEstados";

const PESTANAS = [
  { id: "interacciones", label: "Interacciones" },
  { id: "log", label: "Log de estados" },
] as const;

type Pestana = (typeof PESTANAS)[number]["id"];

// Historial general del crédito (sólo lectura): lo que se dijeron el vendedor, el analista y el
// chequeador y el log de estados.
export function HistorialCredito({ className = "" }: { className?: string }) {
  const [pestana, setPestana] = useState<Pestana>("interacciones");
  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-ink-900">Historial del crédito</h3>
        <div role="tablist" aria-label="Secciones del historial" className="flex gap-1">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={pestana === p.id}
              onClick={() => setPestana(p.id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                pestana === p.id
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" className="px-5 py-4">
        {pestana === "interacciones" && <HiloObservacion />}
        {pestana === "log" && <LogEstados />}
      </div>
    </Card>
  );
}
