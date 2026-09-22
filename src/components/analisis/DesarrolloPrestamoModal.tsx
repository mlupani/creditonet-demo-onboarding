"use client";

import { useApplication } from "@/lib/application-context";
import { Modal } from "@/components/ui/Modal";
import { CerrarFooter } from "@/components/bandeja/ModalesBandeja";
import { generarDesarrolloCuotas, formatCuotaValor } from "@/lib/desarrollo-prestamo";
import { IconWallet, IconBuilding, IconCreditCard } from "@/components/icons";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DesarrolloPrestamoModal({ open, onClose }: Props) {
  const { app } = useApplication();
  const cuotas = generarDesarrolloCuotas(app);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Desarrollo del préstamo"
      maxWidth="max-w-[95vw] lg:max-w-6xl"
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
            {app.oferta.valorCuota ? `$${app.oferta.valorCuota.toLocaleString("es-AR")}` : "—"} · Capital{" "}
            ${app.oferta.montoSolicitado.toLocaleString("es-AR")}
          </p>
          <p className="text-xs text-ink-500">
            Grilla de cuotas con capitales, intereses, IVA y remanentes — como en el core de préstamos.
            HABER es el mes del haber, VTO el vencimiento de la cuota.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-ink-200">
        <table className="min-w-[1400px] text-left text-[11px]">
          <thead className="bg-ink-50 text-[10px] uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-2 py-2 font-semibold">Venta</th>
              <th className="px-2 py-2 font-semibold">Cta</th>
              <th className="px-2 py-2 font-semibold">Valor Cuota</th>
              <th className="px-2 py-2 font-semibold">Pagos / NC</th>
              <th className="px-2 py-2 font-semibold">Saldo Cuota</th>
              <th className="px-2 py-2 font-semibold">HABER</th>
              <th className="px-2 py-2 font-semibold">VTO</th>
              <th className="px-2 py-2 font-semibold">Capital</th>
              <th className="px-2 py-2 font-semibold">Interes</th>
              <th className="px-2 py-2 font-semibold">Iva Interes</th>
              <th className="px-2 py-2 font-semibold">Comision</th>
              <th className="px-2 py-2 font-semibold">Iva Comision</th>
              <th className="px-2 py-2 font-semibold">Seguro</th>
              <th className="px-2 py-2 font-semibold">Servicio1</th>
              <th className="px-2 py-2 font-semibold">Servicio2</th>
              <th className="px-2 py-2 font-semibold">Rem Capital</th>
              <th className="px-2 py-2 font-semibold">Rem Interes</th>
              <th className="px-2 py-2 font-semibold">Rem Iva Interes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 bg-white">
            {cuotas.map((c) => (
              <tr key={c.nro}>
                <td className="px-2 py-1.5 tabular-nums text-ink-600">{app.numeroCredito?.slice(-6) ?? "—"}</td>
                <td className="px-2 py-1.5 text-center font-semibold text-ink-900">{c.nro}</td>
                <td className="px-2 py-1.5 tabular-nums text-ink-900">{formatCuotaValor(c.valorCuota)}</td>
                <td className="px-2 py-1.5 tabular-nums text-ink-700">{formatCuotaValor(c.pagos)}</td>
                <td className="px-2 py-1.5 tabular-nums font-medium text-ink-900">{formatCuotaValor(c.saldoCuota)}</td>
                <td className="px-2 py-1.5 tabular-nums text-ink-600">{c.haber}</td>
                <td className="px-2 py-1.5 tabular-nums text-ink-600">{c.vto}</td>
                <td className="px-2 py-1.5 tabular-nums text-ink-900">{formatCuotaValor(c.capital)}</td>
                <td className="px-2 py-1.5 tabular-nums text-ink-700">{formatCuotaValor(c.interes)}</td>
                <td className="px-2 py-1.5 tabular-nums text-ink-700">{formatCuotaValor(c.ivaInteres)}</td>
                <td className="px-2 py-1.5 tabular-nums text-ink-500">{formatCuotaValor(c.comision)}</td>
                <td className="px-2 py-1.5 tabular-nums text-ink-500">{formatCuotaValor(c.ivaComision)}</td>
                <td className="px-2 py-1.5 tabular-nums text-ink-500">{formatCuotaValor(c.seguro)}</td>
                <td className="px-2 py-1.5 tabular-nums text-ink-500">{formatCuotaValor(c.servicio1)}</td>
                <td className="px-2 py-1.5 tabular-nums text-ink-500">{formatCuotaValor(c.servicio2)}</td>
                <td className="px-2 py-1.5 tabular-nums font-medium text-ink-900">{formatCuotaValor(c.remCapital)}</td>
                <td className="px-2 py-1.5 tabular-nums text-ink-700">{formatCuotaValor(c.remInteres)}</td>
                <td className="px-2 py-1.5 tabular-nums text-ink-700">{formatCuotaValor(c.remIvaInteres)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-ink-400">
        <span className="inline-flex items-center gap-1">
          <IconBuilding width={11} height={11} />
          {cuotas.length} cuotas · crédito arrancando — Pagos, Saldo y Rem. en 0,00 (demo)
        </span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <IconCreditCard width={11} height={11} />
          Capital {formatCuotaValor(cuotas[0]?.capital ?? 0)} + Interés {formatCuotaValor(cuotas[0]?.interes ?? 0)} + IVA{" "}
          {formatCuotaValor(cuotas[0]?.ivaInteres ?? 0)} = Cuota {formatCuotaValor(cuotas[0]?.valorCuota ?? 0)}
        </span>
      </div>

      <p className="mt-3 rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 text-xs text-ink-500">
        Demo: grilla calculada desde monto solicitado, plazo, TNA e IVA del plan ({app.oferta.tna}% TNA, IVA{" "}
        21%). En producción se consulta al core de préstamos con la liquidación real.
      </p>
    </Modal>
  );
}
