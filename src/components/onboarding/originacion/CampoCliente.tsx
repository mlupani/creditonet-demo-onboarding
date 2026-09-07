"use client";

import { useApplication } from "@/lib/application-context";
import type { ClienteDatos } from "@/lib/types";
import { OrigenBadge } from "@/components/ui/OrigenBadge";

export function CampoCliente({
  id,
  label,
  campo,
  as = "input",
  options,
}: {
  id: string;
  label: string;
  campo: keyof ClienteDatos;
  as?: "input" | "select";
  options?: string[];
}) {
  const { app, patchCliente } = useApplication();
  const valor = app.cliente ? String(app.cliente[campo]) : "";

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink-700">
          {label}
        </label>
        <OrigenBadge origen={app.origenCampos[campo]} />
      </div>
      {as === "select" ? (
        <select
          id={id}
          value={valor}
          onChange={(e) => patchCliente({ [campo]: e.target.value })}
          className="w-full appearance-none rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-sm text-ink-900 shadow-xs outline-none transition hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        >
          {(options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          value={valor}
          onChange={(e) => patchCliente({ [campo]: e.target.value })}
          className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-sm text-ink-900 shadow-xs outline-none transition hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      )}
    </div>
  );
}
