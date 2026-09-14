"use client";

import { useApplication } from "@/lib/application-context";
import { nombreOpcion, ORGANISMOS } from "@/lib/config";
import { RESULTADO_LABEL } from "@/lib/credit";
import { getMotor, reglaMarcada } from "@/lib/motores";
import { formatARS, formatDNI } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { IconCheckCircle, IconRefresh } from "@/components/icons";

export function BandejaAnalista({ onTomar }: { onTomar: () => void }) {
  const { app } = useApplication();
  if (!app.cliente) return null;
  const o = app.oferta;
  const motor = getMotor(app.riesgo.motorId);
  const resultado = app.riesgo.resultado ? RESULTADO_LABEL[app.riesgo.resultado] : "—";
  const marcadas = app.riesgo.reglas.filter(reglaMarcada).length;

  const checks = [
    "Carga post-oferta completa",
    "Legajo virtual completo",
    "Oferta aceptada y preaprobada",
    "Reglas institucionales: pasan",
    `${motor.nombre}: ${resultado}`,
    marcadas > 0
      ? `${marcadas} regla${marcadas === 1 ? "" : "s"} no bloqueante${
          marcadas === 1 ? "" : "s"
        } marcada${marcadas === 1 ? "" : "s"} para revisión`
      : "Sin reglas marcadas para revisión",
  ];

  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 px-6 py-5">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700">
            {app.cliente.nombre.charAt(0)}
            {app.cliente.apellido.charAt(0)}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-sm font-bold text-brand-700">{app.numeroCredito}</p>
              <EstadoBadge estado={app.estado} />
              {app.analista.reenviada && (
                <span className="inline-flex items-center gap-1 rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-700">
                  <IconRefresh width={11} height={11} />
                  Reenviada con correcciones
                </span>
              )}
            </div>
            <p className="mt-0.5 text-base font-bold tracking-tight text-ink-900">
              {app.cliente.nombre} {app.cliente.apellido}
            </p>
            <p className="text-sm text-ink-500">
              DNI {formatDNI(app.cliente.dni)} · ID de Cliente {app.numeroCliente} ·{" "}
              {nombreOpcion(ORGANISMOS, app.configuracion.organismoId)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold tabular-nums tracking-tight text-ink-900">
            {formatARS(o.montoSolicitado)}
          </p>
          <p className="text-sm text-ink-500">
            {o.plazo} cuotas de {formatARS(o.valorCuota)}
          </p>
          {app.fechaEnvioAnalisis && (
            <p className="mt-0.5 text-xs text-ink-400">Recibida {app.fechaEnvioAnalisis}</p>
          )}
        </div>
      </div>

      <div className="grid gap-2 px-6 py-4 sm:grid-cols-2">
        {checks.map((c) => (
          <div key={c} className="flex items-center gap-2 text-sm font-medium text-ink-700">
            <IconCheckCircle width={15} height={15} className="shrink-0 text-success-600" />
            {c}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-ink-100 px-6 py-4">
        <p className="text-xs text-ink-500">
          Revisá el legajo completo antes de decidir.
        </p>
        <Button size="lg" onClick={onTomar}>
          Tomar análisis
        </Button>
      </div>
    </Card>
  );
}
