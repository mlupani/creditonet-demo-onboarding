// Saldo real, comprometido y estimado de cada caja y cuenta bancaria (v4, R3 y 4.1). Funciones puras
// sobre los datos del módulo: no leen stores ni React.
//
//  - Real: lo que hay. Caja: el efectivo confirmado del libro. Banco: saldo inicial + depósitos
//    conciliados − transferencias ejecutadas − cheques debitados (preparar una transferencia o emitir un
//    cheque no mueve el real).
//  - Comprometido: reservas activas (una por operación autorizada) y, en las cajas, lo ya reservado por los
//    movimientos de tesorería autorizados (`reservado`, que no duplica filas de reserva).
//  - Estimado = real − comprometido. Es el saldo que manda: ningún egreso se autoriza si lo supera.
//  - A recibir: ingresos que todavía no entraron (informativo, no suma al estimado hasta que entran).

import { reservado, saldoCaja } from "./caja-reglas";
import type { Cheque, CuentaBancaria, Moneda, MovimientoCaja, MovimientoTesoreria, Reserva } from "./caja-tipos";
import type { PagoProveedor } from "./proveedores-tipos";

export interface Posicion {
  real: number;
  comprometido: number;
  estimado: number;
  aRecibir: number;
}

export function reservasActivas(reservas: Reserva[], origenTipo: Reserva["origenTipo"], origenId: string, moneda: Moneda): Reserva[] {
  return reservas.filter((r) => r.estado === "ACTIVA" && r.origenTipo === origenTipo && r.origenId === origenId && r.moneda === moneda);
}

const sumaReservas = (rs: Reserva[]) => rs.reduce((s, r) => s + r.importe, 0);

// ---------- Cajas ----------

export const saldoRealCaja = saldoCaja;

export function comprometidoCaja(reservas: Reserva[], movimientos: MovimientoTesoreria[], cajaId: string, moneda: Moneda, ignorarMovimientoId?: string): number {
  return sumaReservas(reservasActivas(reservas, "CAJA", cajaId, moneda)) + reservado(movimientos, cajaId, moneda, ignorarMovimientoId);
}

// Movimientos de tesorería en tránsito hacia la caja: por recibir, informativo.
export function aRecibirCaja(movimientos: MovimientoTesoreria[], cajaId: string, moneda: Moneda): number {
  return movimientos
    .filter((m) => m.estado === "EN_TRANSITO" && m.destino.tipo === "CAJA" && m.destino.cajaId === cajaId && m.moneda === moneda)
    .reduce((s, m) => s + m.importe, 0);
}

export function posicionCaja(
  libro: MovimientoCaja[],
  reservas: Reserva[],
  movimientos: MovimientoTesoreria[],
  cajaId: string,
  moneda: Moneda
): Posicion {
  const real = saldoCaja(libro, cajaId, moneda);
  const comprometido = comprometidoCaja(reservas, movimientos, cajaId, moneda);
  return { real, comprometido, estimado: real - comprometido, aRecibir: aRecibirCaja(movimientos, cajaId, moneda) };
}

// ---------- Cuentas bancarias ----------

// Egresos que ya bajaron el saldo real del banco: transferencias ejecutadas (o confirmadas) y cheques propios
// debitados. Las transferencias salen de los pagos; los cheques, del propio cheque (no se cuentan dos veces).
// Las extracciones de los pedidos de refuerzo a banco (v4) también bajan el real cuando se registran.
export function egresosBanco(cuentaId: string, pagos: PagoProveedor[], cheques: Cheque[], movimientos: MovimientoTesoreria[] = []): number {
  const extracciones = movimientos
    .filter((m) => m.origenBancoId === cuentaId && m.extraccion)
    .reduce((s, m) => s + (m.extraccion?.importe ?? 0), 0);
  const transferencias = pagos
    .filter((p) => p.medio === "TRANSFERENCIA" && p.origenTipo === "BANCO" && p.origenId === cuentaId && (p.estado === "EJECUTADA" || p.estado === "CONFIRMADA"))
    .reduce((s, p) => s + p.importe, 0);
  const debitados = cheques
    .filter((c) => c.origen === "PROPIO" && c.cuentaId === cuentaId && c.estado === "DEBITADO")
    .reduce((s, c) => s + c.importe, 0);
  return transferencias + debitados + extracciones;
}

const depositosDe = (movimientos: MovimientoTesoreria[], cuentaId: string) =>
  movimientos.filter((m) => m.destino.tipo === "BANCO" && m.destino.cuentaId === cuentaId && m.envio);

export interface PosicionBanco extends Posicion {
  cuentaId: string;
  saldoInicial: number;
  conciliado: number; // depósitos conciliados
  pagado: number; // egresos que ya bajaron el real (transferencias ejecutadas + cheques debitados)
}

export function posicionBanco(
  cuenta: CuentaBancaria,
  movimientos: MovimientoTesoreria[],
  pagos: PagoProveedor[],
  cheques: Cheque[],
  reservas: Reserva[]
): PosicionBanco {
  const depositos = depositosDe(movimientos, cuenta.id);
  const conciliado = depositos.filter((m) => m.conciliacion).reduce((s, m) => s + m.importe, 0);
  const pagado = egresosBanco(cuenta.id, pagos, cheques, movimientos);
  const saldoInicial = cuenta.saldoInicial ?? 0;
  const real = saldoInicial + conciliado - pagado;
  const comprometido = sumaReservas(reservasActivas(reservas, "BANCO", cuenta.id, cuenta.moneda));
  return {
    cuentaId: cuenta.id,
    saldoInicial,
    conciliado,
    pagado,
    real,
    comprometido,
    estimado: real - comprometido,
    aRecibir: depositos.filter((m) => !m.conciliacion).reduce((s, m) => s + m.importe, 0),
  };
}

// ---------- Validación de egresos ----------

// Ningún egreso se aprueba si supera el estimado.
export const alcanzaElEstimado = (posicion: Pick<Posicion, "estimado">, importe: number) => importe <= posicion.estimado + 0.001;
