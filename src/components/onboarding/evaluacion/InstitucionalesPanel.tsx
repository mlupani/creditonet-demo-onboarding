"use client";

import type { ReglaInstitucional } from "@/lib/types";
import { MOMENTO_LABEL } from "@/lib/reglas-institucionales";
import { RiskRule } from "@/components/RiskRule";
import { Card } from "@/components/ui/Card";
import { DemoTag } from "@/components/ui/DemoTag";
import { IconLandmark } from "@/components/icons";

/**
 * Reglas universales / institucionales (Motor §6 y §11 · Arquitectura §6).
 *
 * Son políticas transversales: no pertenecen a un motor y se evalúan cuando existen los
 * datos que necesitan. Se muestran al identificar al cliente y otra vez al solicitar.
 */
export function InstitucionalesPanel({ reglas }: { reglas: ReglaInstitucional[] }) {
  const evaluadas = reglas.filter((r) => r.resultado !== "ESPERANDO_DATOS").length;

  return (
    <div className="space-y-3">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-white">
              <IconLandmark width={20} height={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                Reglas institucionales
              </p>
              <p className="text-base font-bold tracking-tight text-ink-900">
                Políticas transversales del negocio
              </p>
              <p className="mt-0.5 text-xs text-ink-500">
                No pertenecen a un motor: cada una se evalúa cuando están los datos que necesita.
                Si una bloqueante no pasa, la solicitud se descarta antes de continuar.
              </p>
            </div>
          </div>
          <DemoTag
            variant="regla"
            detalle="Las reglas institucionales y sus umbrales son de demo. Qué reglas existen y en qué momento corresponde evaluar cada una se define en la parametrización del negocio."
          />
        </div>
        <p className="mt-3 text-xs font-medium text-ink-500">
          {evaluadas} de {reglas.length} evaluadas
        </p>
      </Card>

      <ul className="space-y-2.5">
        {reglas.map((r, i) => (
          <RiskRule key={r.id} rule={r} index={i} momento={MOMENTO_LABEL[r.momento]} />
        ))}
      </ul>
    </div>
  );
}
