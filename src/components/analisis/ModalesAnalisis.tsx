"use client";

import { useApplication } from "@/lib/application-context";
import { getMotor, reglaMarcada } from "@/lib/motores";
import { RESULTADO_LABEL, seCancela, totalPrecancelaciones } from "@/lib/credit";
import { formatARS } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { CerrarFooter, Filas, Seccion } from "@/components/bandeja/ModalesBandeja";

interface ModalProps {
  open: boolean;
  onClose: () => void;
}

const tonoResultado = {
  ok: "text-success-700",
  marcada: "text-warning-700",
  falla: "text-danger-600",
} as const;

// Buró (situaciones que se traen con el DNI) y detalle de las reglas que evaluó el motor.
export function BuroMotorModal({ open, onClose }: ModalProps) {
  const { app } = useApplication();
  const motor = getMotor(app.riesgo.motorId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Buró y motor de riesgo"
      maxWidth="max-w-2xl"
      footer={<CerrarFooter onClose={onClose} />}
    >
      <Seccion titulo="Buró">
        <Filas
          filas={[
            { label: "Situación BCRA", value: app.situaciones?.bcra ?? "—" },
            { label: "Situación interna", value: app.situaciones?.interna ?? "—" },
          ]}
        />
      </Seccion>

      <Seccion titulo={`Motor · ${motor.nombre}`}>
        <ul className="space-y-2">
          {app.riesgo.reglas.map((r) => {
            const marcada = reglaMarcada(r);
            const estado = r.resultado === "PASA" ? "ok" : marcada ? "marcada" : "falla";
            return (
              <li key={r.id} className="rounded-xl border border-ink-200 px-4 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-ink-900">
                    {r.codigo} · {r.nombre}
                    {!r.bloqueante && (
                      <span className="ml-1.5 text-[11px] font-medium text-ink-400">
                        no bloqueante
                      </span>
                    )}
                  </p>
                  <span className={`shrink-0 text-xs font-bold ${tonoResultado[estado]}`}>
                    {estado === "ok" ? "Pasa" : estado === "marcada" ? "Marcada · revisar" : "No pasa"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-500">
                  {r.fuente} · Valor {r.valorEvaluado} · Condición {r.condicion}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-ink-600">
          Resultado:{" "}
          <strong>{app.riesgo.resultado ? RESULTADO_LABEL[app.riesgo.resultado] : "—"}</strong>
          {app.riesgo.fecha && ` · evaluado ${app.riesgo.fecha}`}
        </p>
      </Seccion>
    </Modal>
  );
}

// Créditos propios vigentes del cliente y cuáles se renuevan (cancelan) con esta operación.
export function CreditosRenovarModal({ open, onClose }: ModalProps) {
  const { app } = useApplication();
  const { creditosActivos } = app.oferta;
  const total = totalPrecancelaciones(app.oferta);
  const aRenovar = creditosActivos.filter(seCancela);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Créditos a renovar"
      footer={<CerrarFooter onClose={onClose} />}
    >
      {creditosActivos.length === 0 ? (
        <p className="rounded-xl border border-ink-200 bg-ink-25 px-4 py-3 text-sm text-ink-500">
          El cliente no tiene créditos propios vigentes.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {creditosActivos.map((c) => (
              <li key={c.id} className="rounded-xl border border-ink-200 px-4 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-sm font-bold text-brand-700">{c.id}</p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      seCancela(c)
                        ? "border-brand-200 bg-brand-50 text-brand-700"
                        : "border-ink-200 bg-ink-50 text-ink-500"
                    }`}
                  >
                    {seCancela(c) ? "A renovar" : "Sigue vigente"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-500">
                  Cuota {c.cuotasAbonadas} de {c.cuotasOriginales} · {formatARS(c.valorCuota)}
                  {c.enMora && <span className="font-semibold text-danger-700"> · En mora</span>}
                </p>
                <p className="mt-1 text-sm text-ink-700">
                  Capital residual {formatARS(c.capitalResidual)} · Cancelación{" "}
                  <strong className="tabular-nums">{formatARS(c.montoCancelacion)}</strong>
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-ink-600">
            {aRenovar.length === 0
              ? "La operación no renueva créditos propios."
              : `Se cancelan ${aRenovar.length} crédito${aRenovar.length === 1 ? "" : "s"} por ${formatARS(total)}, que se descuentan de la acreditación neta.`}
          </p>
        </>
      )}
    </Modal>
  );
}
