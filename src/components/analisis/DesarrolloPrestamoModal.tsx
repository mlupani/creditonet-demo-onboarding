"use client";

import { useApplication } from "@/lib/application-context";
import { Modal } from "@/components/ui/Modal";
import { CerrarFooter } from "@/components/bandeja/ModalesBandeja";
import { getDesarrolloPrestamo } from "@/lib/desarrollo-prestamo";
import { IconWallet, IconBuilding, IconCreditCard } from "@/components/icons";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DesarrolloPrestamoModal({ open, onClose }: Props) {
  const { app } = useApplication();
  const filas = getDesarrolloPrestamo(app);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Desarrollo del préstamo"
      maxWidth="max-w-2xl"
      footer={<CerrarFooter onClose={onClose} />}
    >
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
          <IconWallet width={16} height={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink-900">
            {app.cliente ? `${app.cliente.nombre} ${app.cliente.apellido}` : "Cliente"} ·{" "}
            {app.numeroCredito ?? "—"} · {app.oferta.plazo} cuotas de{" "}
            {app.oferta.valorCuota ? `$${app.oferta.valorCuota.toLocaleString("es-AR")}` : "—"}
          </p>
          <p className="text-xs text-ink-500">
            Detalle financiero del préstamo otorgado: capitales, cancelaciones y datos operativos del
            desembolso.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-ink-200">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-ink-50 text-[11px] uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-2.5 font-semibold">DATO</th>
              <th className="px-4 py-2.5 font-semibold">VALOR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 bg-white">
            {filas.map((fila) => (
              <tr key={fila.dato} className="hover:bg-ink-25/60">
                <td className="px-4 py-2.5 font-medium text-ink-600">{fila.dato}</td>
                <td className="px-4 py-2.5 font-semibold tabular-nums text-ink-900">{fila.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-ink-400">
        <span className="inline-flex items-center gap-1">
          <IconBuilding width={11} height={11} />
          Casa matriz y comercio según organismo y canal
        </span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <IconCreditCard width={11} height={11} />
          Línea: plan de cuotas aplicado
        </span>
      </div>

      <p className="mt-3 rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 text-xs text-ink-500">
        Demo: el desarrollo se arma desde la oferta vigente, renovaciones y la configuración efectiva
        (producto, organismo, plan y banco de cobro). En producción se consulta al core de préstamos.
      </p>
    </Modal>
  );
}
