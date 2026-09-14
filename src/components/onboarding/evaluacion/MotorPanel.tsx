"use client";

import { useApplication } from "@/lib/application-context";
import { RESULTADO_LABEL } from "@/lib/credit";
import { getMotor, reglaMarcada, RESULTADOS_MOTOR, seleccionarMotor } from "@/lib/motores";
import type { RiskResultado, RiskRule as RiskRuleType } from "@/lib/types";
import { RiskRule } from "@/components/RiskRule";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DemoTag } from "@/components/ui/DemoTag";
import { IconShieldCheck } from "@/components/icons";

const TONO: Record<RiskResultado, "success" | "danger"> = {
  PASA: "success",
  NO_PASA: "danger",
};

/**
 * Motor de riesgo (doc v1 §2, §9, §11).
 *
 * Existen múltiples motores configurados en el Módulo Créditos. Durante la originación se
 * ejecuta el que corresponde según Producto + Organismo + condiciones del cliente.
 */
export function MotorPanel({
  reglas,
  resultado,
}: {
  reglas: RiskRuleType[];
  resultado: RiskResultado | null;
}) {
  const { app } = useApplication();
  const seleccion = seleccionarMotor(app.configuracion, app.laboral.condicionLaboral);
  const motor = app.riesgo.motorId ? getMotor(app.riesgo.motorId) : seleccion.motor;
  const marcadas = reglas.filter(reglaMarcada).length;

  return (
    <div className="space-y-3">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-white">
              <IconShieldCheck width={20} height={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                Motor ejecutado
              </p>
              <p className="text-base font-bold tracking-tight text-ink-900">{motor.nombre}</p>
              <p className="mt-0.5 text-xs text-ink-500">{motor.descripcion}</p>
            <p className="mt-1 text-[11px] text-ink-400">
              El motor decide si la operación pasa o rebota. No devuelve capital: los cálculos
              arrancan después, en el plan de cuotas.
            </p>
            </div>
          </div>
          {resultado && (
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge tone={TONO[resultado]}>{RESULTADO_LABEL[resultado]}</StatusBadge>
              {marcadas > 0 && (
                <StatusBadge tone="warning">
                  {marcadas} regla{marcadas === 1 ? "" : "s"} marcada
                  {marcadas === 1 ? "" : "s"} para el analista
                </StatusBadge>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-ink-200 bg-ink-25 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Criterio de selección
            </p>
            <p className="mt-0.5 text-sm font-medium text-ink-800">{seleccion.criterio}</p>
          </div>
          <div className="rounded-lg border border-ink-200 bg-ink-25 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Fuentes de información
            </p>
            <p className="mt-0.5 flex flex-wrap gap-1.5">
              {motor.fuentes.map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-ink-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-600"
                >
                  {f}
                </span>
              ))}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Resultados posibles del motor
          </p>
          <DemoTag
            variant="config"
            detalle="Los motores, sus reglas y la asociación con Producto/Organismo se configuran en el Módulo Créditos. La demo no crea ni edita motores: sólo ejecuta el que corresponde."
          />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {RESULTADOS_MOTOR.map((r) => {
            const obtenido = r.id === resultado;
            return (
              <span
                key={r.id}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                  obtenido
                    ? "border-ink-900 bg-ink-900 text-white"
                    : "border-ink-200 bg-white text-ink-400"
                }`}
              >
                {r.label}
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
          Cada regla es bloqueante o no bloqueante. Si una bloqueante no pasa, el motor no pasa. Si
          no pasa una no bloqueante, la solicitud continúa y la regla queda marcada para que el
          analista la revise al final.
        </p>
      </Card>

      <ul className="space-y-2.5">
        {reglas.map((rule, i) => (
          <RiskRule key={rule.id} rule={rule} index={i} />
        ))}
      </ul>
    </div>
  );
}
