"use client";

import { useMemo } from "react";
import { useCajaDatos } from "@/lib/caja-store";
import { lotesTransferencia } from "@/lib/proveedores-operaciones";
import { useOrdenesPago, usePagosProveedor, useProveedores } from "@/lib/proveedores-store";
import { TIPO_PENDIENTE_LABEL, pendientesDeBandeja, type FiltrosBandeja, type TipoPendiente, type VistaBandeja } from "@/lib/bandeja-reglas";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { descargarXlsx, dinero } from "@/components/caja/comunes";
import { pesos } from "./comunes";

const TONO: Record<TipoPendiente, "danger" | "warning"> = {
  PAGO_RECHAZADO: "danger",
  CHEQUE: "danger",
  PARCIAL: "warning",
  INCIDENCIA: "danger",
};

const ACCION: Record<TipoPendiente, string> = {
  PAGO_RECHAZADO: "Reintentar el pago",
  CHEQUE: "Reintentar el pago",
  PARCIAL: "Pagar el saldo",
  INCIDENCIA: "Resolver en Remesas",
};

// Contingencias: pagos que no salieron como se esperaba y remesas con diferencia. Nada se borra: cada
// resolución queda en el historial de la orden o del movimiento.
export function VistaPendientes({ filtros, onIr }: { filtros: FiltrosBandeja; onIr: (vista: VistaBandeja, busqueda: string) => void }) {
  const { usuario, cajas, movimientos } = useCajaDatos();
  const ordenes = useOrdenesPago();
  const pagos = usePagosProveedor();
  const proveedores = useProveedores();

  const lista = useMemo(
    () => pendientesDeBandeja({ usuario, ordenes, pagos, proveedores, lotes: lotesTransferencia(), movimientos, cajas }, filtros),
    [usuario, ordenes, pagos, proveedores, movimientos, cajas, filtros]
  );

  const exportar = () =>
    descargarXlsx("bandeja-pendientes.xlsx", "Pendientes", [
      ["Tipo", "Referencia", "Detalle", "Importe", "Moneda"],
      ...lista.map((p) => [TIPO_PENDIENTE_LABEL[p.tipo], p.referencia, p.detalle, String(p.importe), p.moneda]),
    ]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-ink-500">
          Una transferencia rechazada vuelve a Autorizado con su comentario y libera la reserva; un cheque rechazado o anulado reabre la deuda; un
          pago parcial deja saldo. Cada contingencia avisa por mail al Tesorero central y al Director (ver Alertas enviadas).
        </p>
        <Button variant="outline" size="sm" onClick={exportar} disabled={lista.length === 0}>
          Exportar a Excel
        </Button>
      </div>

      {lista.length === 0 ? (
        <Card className="px-5 py-8 text-center text-sm text-ink-400">No hay contingencias pendientes para tu perfil.</Card>
      ) : (
        <ul className="space-y-2">
          {lista.map((p) => (
            <li key={p.clave}>
              <Card className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={TONO[p.tipo]}>{TIPO_PENDIENTE_LABEL[p.tipo]}</StatusBadge>
                    <span className="text-sm font-semibold text-ink-900">{p.titulo}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-600">{p.detalle}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums text-ink-900">{p.moneda === "ARS" ? pesos(p.importe) : dinero(p.moneda, p.importe)}</span>
                  <Button size="sm" onClick={() => onIr(p.vista, p.busqueda)}>
                    {ACCION[p.tipo]}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
