"use client";

import { useMemo } from "react";
import { useCajaDatos } from "@/lib/caja-store";
import { lotesTransferencia } from "@/lib/proveedores-operaciones";
import { useOrdenesPago, usePagosProveedor, useProveedores } from "@/lib/proveedores-store";
import { TIPO_PENDIENTE_LABEL, pendientesDeBandeja, type FiltrosBandeja, type TipoPendiente, type VistaBandeja } from "@/lib/bandeja-reglas";
import { Button } from "@/components/ui/Button";
import { dinero } from "@/components/caja/comunes";
import { Pill, TablaCompacta, Td, Th, type Fase } from "@/components/caja/compacto";
import { pesos } from "./comunes";

const FASE: Record<TipoPendiente, Fase> = {
  PAGO_RECHAZADO: "rechazo",
  CHEQUE: "rechazo",
  PARCIAL: "espera",
  INCIDENCIA: "rechazo",
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

  return (
    <div className="space-y-2">
      <p className="max-w-3xl text-[11px] text-ink-500">
        Una transferencia rechazada vuelve a Autorizado con su comentario y libera la reserva; un cheque rechazado o anulado reabre la deuda; un
        pago parcial deja saldo. Cada contingencia avisa por mail al Tesorero central y al Director (ver Alertas enviadas).
      </p>

      <TablaCompacta etiqueta="Contingencias pendientes" minWidth="min-w-[44rem]">
        <thead>
          <tr>
            <Th>Contingencia</Th>
            <Th>Qué pasa</Th>
            <Th derecha>Importe</Th>
            <Th>Cómo se resuelve</Th>
          </tr>
        </thead>
        <tbody>
          {lista.length === 0 && (
            <tr>
              <Td colSpan={4} className="py-6 text-center text-ink-400">
                No hay contingencias pendientes para tu perfil.
              </Td>
            </tr>
          )}
          {lista.map((p) => (
            <tr key={p.clave}>
              <Td>
                <Pill fase={FASE[p.tipo]}>{TIPO_PENDIENTE_LABEL[p.tipo]}</Pill>
                <p className="mt-1 font-semibold text-ink-900">{p.titulo}</p>
              </Td>
              <Td>{p.detalle}</Td>
              <Td derecha className="whitespace-nowrap font-semibold text-ink-900">
                {p.moneda === "ARS" ? pesos(p.importe) : dinero(p.moneda, p.importe)}
              </Td>
              <Td>
                <Button size="xs" variant="brandOutline" onClick={() => onIr(p.vista, p.busqueda)}>
                  {ACCION[p.tipo]}
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </TablaCompacta>
    </div>
  );
}