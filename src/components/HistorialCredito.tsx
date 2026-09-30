"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { historialCredito } from "@/lib/historial";
import { Card } from "@/components/ui/Card";
import { HiloObservacion } from "@/components/analisis/HiloObservacion";
import { LogEstados } from "@/components/LogEstados";

const PESTANAS = [
  { id: "interacciones", label: "Interacciones" },
  { id: "log", label: "Log de estados" },
  { id: "eventos", label: "Cronología" },
] as const;

type Pestana = (typeof PESTANAS)[number]["id"];

// Historial general del crédito (sólo lectura): lo que se dijeron el vendedor, el analista y el
// chequeador, el log de estados y la cronología de la solicitud.
export function HistorialCredito({ className = "" }: { className?: string }) {
  const { app } = useApplication();
  const [pestana, setPestana] = useState<Pestana>("interacciones");
  const eventos = historialCredito(app);
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
        {pestana === "eventos" &&
          (eventos.length === 0 ? (
            <p className="text-sm text-ink-500">Sin movimientos registrados.</p>
          ) : (
            <ol className="-my-2.5 divide-y divide-ink-100">
              {eventos.map((e, i) => (
                <li key={`${e.etiqueta}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-800">{e.etiqueta}</p>
                    {e.detalle && <p className="text-xs text-ink-500">{e.detalle}</p>}
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-ink-900">{e.fecha}</span>
                </li>
              ))}
            </ol>
          ))}
      </div>
    </Card>
  );
}
