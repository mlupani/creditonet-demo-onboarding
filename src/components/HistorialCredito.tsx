"use client";

import { useApplication } from "@/lib/application-context";
import { historialCredito } from "@/lib/historial";
import { Card } from "@/components/ui/Card";

// Historial general del crédito (sólo lectura), incluida la etapa de chequeo telefónico.
export function HistorialCredito({ className = "" }: { className?: string }) {
  const { app } = useApplication();
  const eventos = historialCredito(app);
  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="border-b border-ink-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-ink-900">Historial del crédito</h3>
      </div>
      {eventos.length === 0 ? (
        <p className="px-5 py-4 text-sm text-ink-500">Sin movimientos registrados.</p>
      ) : (
        <ol className="divide-y divide-ink-100">
          {eventos.map((e, i) => (
            <li key={`${e.etiqueta}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-5 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-800">{e.etiqueta}</p>
                {e.detalle && <p className="text-xs text-ink-500">{e.detalle}</p>}
              </div>
              <span className="text-sm font-semibold tabular-nums text-ink-900">{e.fecha}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
