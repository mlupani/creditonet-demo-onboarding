// Piezas del circuito de pagos (v4, 2.5 y 4.1) compartidas por las operaciones de proveedores y de
// cheques: reservas de saldo, cambios de estado de un pago y recálculo de la orden de pago y de sus
// comprobantes. Escribe en los stores pero no valida permisos: eso lo hace cada operación. Vive aparte
// para que proveedores-operaciones y cheques-operaciones no se importen entre sí.

import { ahoraTexto, auditar, cajaStores as S, siguienteId, usuarioActual } from "./caja-store";
import type { Cheque, Moneda, Reserva } from "./caja-tipos";
import { pagadoDe, pagadoDeOrden } from "./proveedores-reglas";
import { provStores as P } from "./proveedores-store";
import {
  ESTADO_COMPROBANTE_LABEL,
  ESTADO_ORDEN_LABEL,
  ESTADO_PAGO_LABEL,
  type EstadoComprobanteId,
  type EstadoOrdenPago,
  type EstadoPago,
  type PagoProveedor,
} from "./proveedores-tipos";

// ---------- Reservas ----------

export function crearReserva(r: {
  origenTipo: Reserva["origenTipo"];
  origenId: string;
  moneda: Moneda;
  importe: number;
  operacionId: string;
}): Reserva {
  const lista = S.reservas.get();
  const reserva: Reserva = {
    id: siguienteId("RSV", lista.map((x) => x.id), 4),
    ...r,
    operacionTipo: "PAGO",
    estado: "ACTIVA",
    creada: { usuarioId: usuarioActual().id, fechaHora: ahoraTexto() },
  };
  S.reservas.commit([...lista, reserva]);
  auditar("Reserva", reserva.id, "ALTA", null, `${r.origenTipo} ${r.origenId} · ${r.importe} · ${r.operacionId}`);
  return reserva;
}

function cerrarReserva(reserva: Reserva | undefined, estado: "CONSUMIDA" | "LIBERADA", motivo: string) {
  if (!reserva || reserva.estado !== "ACTIVA") return;
  S.reservas.commit(
    S.reservas.get().map((x) =>
      x.id === reserva.id ? { ...x, estado, cierre: { usuarioId: usuarioActual().id, fechaHora: ahoraTexto(), motivo } } : x
    )
  );
  auditar("Reserva", reserva.id, "ESTADO", "Activa", `${estado === "CONSUMIDA" ? "Consumida" : "Liberada"} · ${motivo}`);
}

const reservaPorId = (id: string | undefined) => (id ? S.reservas.get().find((r) => r.id === id) : undefined);

// El dinero salió (transferencia ejecutada, cheque debitado): la reserva se consume en el mismo movimiento.
export const consumirReserva = (id: string | undefined, motivo: string) => cerrarReserva(reservaPorId(id), "CONSUMIDA", motivo);
// Cancelación, rechazo o anulación: se libera sólo con motivo.
export const liberarReserva = (id: string | undefined, motivo: string) => cerrarReserva(reservaPorId(id), "LIBERADA", motivo);

// Reserva de un cheque propio: la del pago que lo emitió o, en los datos de ejemplo, la que apunta al cheque.
export function reservaDeCheque(cheque: Pick<Cheque, "id">): Reserva | undefined {
  const pago = P.pagos.get().find((p) => p.chequeId === cheque.id);
  return reservaPorId(pago?.reservaId) ?? S.reservas.get().find((r) => r.operacionId === cheque.id);
}

// ---------- Estado de un pago ----------

export function cambiarEstadoPago(pagoId: string, estado: EstadoPago, detalle?: string): PagoProveedor | undefined {
  const pago = P.pagos.get().find((p) => p.id === pagoId);
  if (!pago) return undefined;
  const nuevo: PagoProveedor = {
    ...pago,
    estado,
    historial: [...pago.historial, { estado, usuarioId: usuarioActual().id, fechaHora: ahoraTexto(), detalle }],
  };
  P.pagos.commit(P.pagos.get().map((p) => (p.id === pagoId ? nuevo : p)));
  auditar("Pago", pagoId, "ESTADO", ESTADO_PAGO_LABEL[pago.estado], `${ESTADO_PAGO_LABEL[estado]}${detalle ? ` · ${detalle}` : ""}`);
  return nuevo;
}

// ---------- Orden de pago y comprobantes ----------

export function eventoDeOrden(ordenId: string, evento: string, detalle?: string) {
  P.ordenesPago.commit(
    P.ordenesPago.get().map((o) =>
      o.id === ordenId ? { ...o, historial: [...o.historial, { fechaHora: ahoraTexto(), usuarioId: usuarioActual().id, evento, detalle }] } : o
    )
  );
}

// Recalcula, desde los pagos, el estado de una orden autorizada (Autorizada · pendiente de pago, Pendiente
// de transferencia o Pagada) y el de cada uno de sus comprobantes. Es el único lugar que lo decide, así un
// cheque rechazado o una transferencia rechazada reabren la orden sin lógica repetida.
export function recalcularOrden(ordenId: string): void {
  const orden = P.ordenesPago.get().find((o) => o.id === ordenId);
  if (!orden || !["AUTORIZADA", "PENDIENTE_TRANSFERENCIA", "PAGADA"].includes(orden.estado)) return;
  const pagos = P.pagos.get();
  const enTransferencia = pagos.some((p) => p.ordenPago === ordenId && (p.estado === "PREPARADA" || p.estado === "PENDIENTE_EJECUCION"));
  const estado: EstadoOrdenPago =
    pagadoDeOrden(ordenId, pagos) >= orden.total - 0.001 ? "PAGADA" : enTransferencia ? "PENDIENTE_TRANSFERENCIA" : "AUTORIZADA";

  const comprobantes = P.comprobantes.get();
  const nuevos = comprobantes.map((c) => {
    const item = orden.items.find((i) => i.comprobanteId === c.id);
    if (!item || c.estado === "ANULADO") return c;
    // Lo cubierto sólo con notas de crédito (o la propia nota) se salda cuando se salda la orden.
    const siguiente: EstadoComprobanteId =
      item.aPagar <= 0.001
        ? estado === "PAGADA"
          ? "PAGADO"
          : "EN_ORDEN_PAGO"
        : pagadoDe(c.id, pagos) >= item.aPagar - 0.001
          ? "PAGADO"
          : pagadoDe(c.id, pagos) > 0.001
            ? "PAGO_PARCIAL"
            : "EN_ORDEN_PAGO";
    if (siguiente !== c.estado) {
      auditar("Comprobante", c.id, "ESTADO", ESTADO_COMPROBANTE_LABEL[c.estado], `${ESTADO_COMPROBANTE_LABEL[siguiente]} · ${ordenId}`);
      return { ...c, estado: siguiente };
    }
    return c;
  });
  P.comprobantes.commit(nuevos);

  if (estado !== orden.estado) {
    P.ordenesPago.commit(P.ordenesPago.get().map((o) => (o.id === ordenId ? { ...o, estado } : o)));
    auditar("Orden de pago", ordenId, "ESTADO", ESTADO_ORDEN_LABEL[orden.estado], ESTADO_ORDEN_LABEL[estado]);
    eventoDeOrden(ordenId, ESTADO_ORDEN_LABEL[estado]);
  }
}
