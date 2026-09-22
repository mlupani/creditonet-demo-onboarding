"use client";

import { useMemo, useState } from "react";
import { useApplication } from "@/lib/application-context";
import { formatARS } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { CerrarFooter } from "@/components/bandeja/ModalesBandeja";
import {
  generarHistorialPagos,
  resumenHistorial,
  estadoTone,
} from "@/lib/historial-pagos";
import { IconCalendar, IconClock, IconCreditCard } from "@/components/icons";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function HistorialPagosModal({ open, onClose }: Props) {
  const { app } = useApplication();
  const creditos = app.oferta.creditosActivos;
  const [expandido, setExpandido] = useState<string | null>(null);

  const resumenGlobal = useMemo(() => {
    if (creditos.length === 0) return null;
    const todos = creditos.flatMap(generarHistorialPagos);
    return resumenHistorial(todos);
  }, [creditos]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Historial de pagos"
      maxWidth="max-w-3xl"
      footer={<CerrarFooter onClose={onClose} />}
    >
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
          <IconCreditCard width={16} height={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink-900">
            {app.cliente ? `${app.cliente.nombre} ${app.cliente.apellido}` : "Cliente"} ·{" "}
            {app.numeroCliente ?? "—"} · BCRA {app.situaciones?.bcra ?? "—"} · Interna{" "}
            {app.situaciones?.interna ?? "—"}
          </p>
          <p className="text-xs text-ink-500">
            {creditos.length === 0
              ? "Sin créditos propios vigentes — no hay historial para mostrar."
              : `${creditos.length} crédito${creditos.length === 1 ? "" : "s"} vigente${creditos.length === 1 ? "" : "s"} · ${resumenGlobal?.pagadas ?? 0} pagada${(resumenGlobal?.pagadas ?? 0) === 1 ? "" : "s"} · ${resumenGlobal?.conAtraso ?? 0} con atraso · ${resumenGlobal?.enMora ?? 0} en mora`}
          </p>
        </div>
      </div>

      {creditos.length === 0 ? (
        <p className="rounded-xl border border-ink-200 bg-ink-25 px-4 py-6 text-center text-sm text-ink-500">
          El cliente no tiene créditos propios vigentes. No hay historial de pagos para mostrar.
        </p>
      ) : (
        <div className="space-y-4">
          {creditos.map((c) => {
            const historial = generarHistorialPagos(c);
            const resumen = resumenHistorial(historial);
            const abierto =
              creditos.length === 1 ? true : expandido === null ? c === creditos[0] : expandido === c.id;
            const pagadasPct = Math.round((c.cuotasAbonadas / c.cuotasOriginales) * 100);

            return (
              <div key={c.id} className="rounded-xl border border-ink-200 bg-white">
                <button
                  onClick={() => setExpandido(c.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-ink-25 transition"
                >
                  <div>
                    <p className="font-mono text-sm font-bold text-brand-700">{c.id}</p>
                    <p className="text-xs text-ink-500">
                      {c.cuotasAbonadas} de {c.cuotasOriginales} cuotas · {pagadasPct}% · {formatARS(c.valorCuota)}/mes
                      {c.enMora && <span className="ml-2 font-semibold text-danger-700">· En mora</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-ink-700">
                      {resumen.pagadas + resumen.conAtraso} pagadas
                      {resumen.conAtraso > 0 && ` · ${resumen.conAtraso} con atraso`}
                      {resumen.enMora > 0 && ` · ${resumen.enMora} en mora`}
                    </p>
                    <p className="text-[11px] text-ink-400">
                      Max atraso {resumen.maxAtraso} días · Residual {formatARS(c.capitalResidual)}
                    </p>
                  </div>
                </button>

                {abierto && (
                  <div className="border-t border-ink-100">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-ink-50 text-[11px] uppercase tracking-wide text-ink-500">
                          <tr>
                            <th className="px-3 py-2">Cuota</th>
                            <th className="px-3 py-2">Vencimiento</th>
                            <th className="px-3 py-2">Importe</th>
                            <th className="px-3 py-2">Fecha pago</th>
                            <th className="px-3 py-2">Estado</th>
                            <th className="px-3 py-2">Medio</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ink-100">
                          {historial.map((cuota) => (
                            <tr
                              key={cuota.nro}
                              className={
                                cuota.estado === "En mora"
                                  ? "bg-danger-50/40"
                                  : cuota.estado === "Pagada con atraso"
                                    ? "bg-warning-50/30"
                                    : ""
                              }
                            >
                              <td className="px-3 py-2 font-mono font-semibold text-ink-800">{cuota.nro}</td>
                              <td className="px-3 py-2 tabular-nums text-ink-700">{cuota.vencimiento}</td>
                              <td className="px-3 py-2 tabular-nums font-medium text-ink-900">{formatARS(cuota.importe)}</td>
                              <td className="px-3 py-2 tabular-nums text-ink-600">{cuota.fechaPago ?? "—"}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${estadoTone(cuota.estado)}`}
                                >
                                  {cuota.estado}
                                  {cuota.diasAtraso ? ` · ${cuota.diasAtraso}d` : ""}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-ink-500">{cuota.medio}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 bg-ink-25 px-4 py-3 text-xs text-ink-600">
                      <span className="inline-flex items-center gap-1.5">
                        <IconCalendar width={12} height={12} /> Vencimiento día 10
                      </span>
                      <span className="text-ink-300">·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <IconClock width={12} height={12} /> Vector mora 0 días si pagada a término
                      </span>
                      {c.enMora && (
                        <>
                          <span className="text-ink-300">·</span>
                          <span className="font-semibold text-danger-700">Crédito en mora — requiere cancelación obligatoria</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 text-xs text-ink-500">
        Demo: historial simulado a partir de las cuotas del crédito vigente. En producción se consulta al core de préstamos.
      </p>
    </Modal>
  );
}
