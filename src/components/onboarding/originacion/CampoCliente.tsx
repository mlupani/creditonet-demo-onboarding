"use client";

import { useApplication } from "@/lib/application-context";
import { maskFecha } from "@/lib/format";
import type { ClienteDatos } from "@/lib/types";

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
  const valor = app.cliente ? String(app.cliente[campo] ?? "") : "";
  const esFecha = campo === "fechaNacimiento";

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink-700">
        {label}
      </label>
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
          onChange={(e) =>
            patchCliente({ [campo]: esFecha ? maskFecha(e.target.value) : e.target.value })
          }
          placeholder={esFecha ? "dd/mm/aaaa" : undefined}
          inputMode={esFecha ? "numeric" : undefined}
          className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-sm text-ink-900 shadow-xs outline-none transition placeholder:text-ink-400 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      )}
    </div>
  );
}
