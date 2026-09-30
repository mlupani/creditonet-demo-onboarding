"use client";

import { useApplication } from "@/lib/application-context";
import type { EstadoLog } from "@/lib/types";
import { EstadoBadge, StatusBadge } from "@/components/ui/StatusBadge";

function EstadoLogBadge({ estado }: { estado: EstadoLog | null }) {
  if (estado === null) return <span className="text-ink-400">—</span>;
  if (estado === "PENDIENTE") return <StatusBadge tone="neutral">Pendiente</StatusBadge>;
  return <EstadoBadge estado={estado} />;
}

// Log de estados (creditonet-112): sólo los cambios de estado, para medir tiempos de respuesta.
// Cada cambio en dos líneas, para que entre en las tarjetas angostas del análisis.
export function LogEstados() {
  const { app } = useApplication();
  const log = app.logEstados ?? [];

  if (log.length === 0)
    return (
      <p className="text-sm text-ink-500">
        Sin cambios de estado registrados. Los créditos anteriores al registro no tienen log.
      </p>
    );

  return (
    <ol aria-label="Log de estados del crédito" className="divide-y divide-ink-100">
      {log.map((c, i) => (
        <li key={`${c.siguiente}-${i}`} className="py-2.5 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <EstadoLogBadge estado={c.anterior} />
            <span aria-hidden className="text-ink-400">
              →
            </span>
            <EstadoLogBadge estado={c.siguiente} />
            <span className="ml-auto text-sm font-semibold tabular-nums text-ink-900">{c.fecha}</span>
          </div>
          <p className="mt-1 text-xs text-ink-600">
            {c.usuario} · {c.perfil} · Canal {c.canal.toLowerCase()}
          </p>
        </li>
      ))}
    </ol>
  );
}
