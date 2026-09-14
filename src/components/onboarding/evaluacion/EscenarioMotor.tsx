"use client";

import { useApplication } from "@/lib/application-context";
import { ESCENARIOS_MOTOR } from "@/lib/motores";
import { IconInfo } from "@/components/icons";

/**
 * Control exclusivo de la demo: fuerza las reglas que dependen de fuentes externas para
 * mostrar los tres caminos del motor en una presentación. No existe en el producto real:
 * ahí el resultado surge de las reglas configuradas.
 */
export function EscenarioMotor({ disabled = false }: { disabled?: boolean }) {
  const { app, setEscenarioMotor } = useApplication();

  return (
    <div className="rounded-xl border border-dashed border-warning-300 bg-warning-50/50 p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-warning-700">
        <IconInfo width={12} height={12} />
        Escenario de demo · resultado que devolverá el motor
      </p>
      <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
        {ESCENARIOS_MOTOR.map((r) => {
          const activo = app.riesgo.escenario === r.id;
          return (
            <button
              key={r.id}
              type="button"
              disabled={disabled}
              onClick={() => setEscenarioMotor(r.id)}
              aria-pressed={activo}
              className={`rounded-lg border px-3 py-2 text-left transition ${
                activo
                  ? "border-warning-500 bg-white shadow-xs ring-1 ring-warning-400"
                  : "border-ink-200 bg-white/70 hover:border-warning-300"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <span
                className={`block text-xs font-bold uppercase tracking-wide ${
                  activo ? "text-warning-700" : "text-ink-600"
                }`}
              >
                {r.label}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-ink-500">
                {r.detalle}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
        “Pasa con reglas marcadas” hace fallar la blacklist, configurada como no bloqueante: la
        solicitud continúa y el analista ve la regla marcada. “No pasa” hace fallar la situación
        BCRA, que es bloqueante. Edad, antigüedad e ingreso mínimo se evalúan siempre con los
        datos reales: si alguna no pasa, el motor no pasa aunque el escenario sea “Pasa”.
      </p>
    </div>
  );
}
