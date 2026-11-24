import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import { DENOMINACIONES_INICIALES } from "./caja-datos";
import { registrarApertura, saldosBancarios } from "./caja-operaciones";
import { recuentoSugerido, saldoCaja } from "./caja-reglas";
import { cajaStores as S, fijarFechaDemo, fijarUsuarioActual as como, reiniciarCaja } from "./caja-store";
import {
  anularComprobante,
  anularOrdenPago,
  armarOrdenPago,
  autorizarComprobante,
  autorizarOrdenPago,
  cargarComprobante,
  confirmarLote,
  confirmarTransferencia,
  corregirComprobante,
  csvLoteTransferencia,
  generarPlantilla,
  lotesTransferencia,
  marcarPendienteEjecucion,
  pagarOrdenPago,
  rechazarComprobante,
  rechazarOrdenPago,
  registrarResultadoTransferencia,
  validarFilasLote,
} from "./proveedores-operaciones";
import { debitarChequePropio, entregarChequePropio, presentarChequePropio, rechazarChequePropio } from "./cheques-operaciones";
import { pagadoDeOrden, pendienteDeOrden } from "./proveedores-reglas";
import { posicionDeCaja } from "./caja-operaciones";
import {
  antiguedadDeuda,
  cuentaCorriente,
  diasDeAtraso,
  erroresComprobante,
  formatearCuit,
  saldoProveedor,
  tramoDeAtraso,
  validarCuit,
  vencimientoDe,
  type DatosComprobante,
} from "./proveedores-reglas";
import { provStores as P, reiniciarProveedores } from "./proveedores-store";

beforeEach(() => {
  reiniciarCaja();
  reiniciarProveedores();
  fijarFechaDemo("2026-11-18");
  como("ana-gomez");
});

const vacio = { base: 0, iva: 0 };
function datos(numero: string, base = 100000, extra: Partial<DatosComprobante> = {}): DatosComprobante {
  const iva = base * 0.21;
  return {
    tipoId: "TCP-001",
    fechaComprobante: "2026-11-17",
    prefijo: "0005",
    numero,
    noGravado: 0,
    exento: 0,
    subtotalGravado: base,
    gravados: { "10.5": vacio, "21": { base, iva }, "27": vacio },
    percepcionIva: 0,
    percepcionesIibb: [],
    percepcionesMunicipales: [],
    total: base + iva,
    observaciones: "",
    ...extra,
  };
}

const ok = <T extends { ok: boolean }>(r: T) => {
  assert.equal(r.ok, true, JSON.stringify(r));
  return r as Extract<T, { ok: true }>;
};
const falla = (r: { ok: boolean; error?: string }, texto: RegExp) => {
  assert.equal(r.ok, false);
  assert.match(r.error ?? "", texto);
};

test("el CUIT se valida con su dígito verificador", () => {
  assert.equal(validarCuit("30-69710012-8"), true);
  assert.equal(validarCuit("30697100129"), false);
  assert.equal(validarCuit("123"), false);
  assert.equal(formatearCuit("30697100128"), "30-69710012-8");
  assert.ok(P.proveedores.get().every((p) => validarCuit(p.cuit)));
});

test("los totales deben cerrar y las alícuotas coincidir con la base", () => {
  const ctx = { proveedor: P.proveedores.get()[4], tipos: P.tiposComprobante.get(), comprobantes: [], hoy: "2026-11-18" };
  assert.deepEqual(erroresComprobante(datos("1"), ctx), {});
  assert.ok(erroresComprobante(datos("1", 100000, { total: 1 }), ctx).total);
  assert.ok(erroresComprobante(datos("1", 100000, { fechaComprobante: "2026-12-01" }), ctx).fechaComprobante);
  assert.ok(erroresComprobante(datos("1", 100000, { percepcionesIibb: [1, 1, 1, 1] }), ctx).percepcionesIibb);
  const mal = datos("1");
  mal.gravados["21"] = { base: 100000, iva: 5000 };
  assert.ok(erroresComprobante(mal, ctx)["iva21"]);
});

test("no se puede cargar dos veces el mismo CUIT, tipo, prefijo y número", () => {
  ok(cargarComprobante("PRV-005", datos("77")));
  falla(cargarComprobante("PRV-005", datos("77")), /ya está cargado/i);
  // Otro proveedor con el mismo número no es duplicado.
  ok(cargarComprobante("PRV-004", datos("77")));
});

// Carga (Ana) y autoriza (Marta) un comprobante de PRV-005; deja al usuario actual en Ana.
function autorizado(numero: string, base: number) {
  como("ana-gomez");
  const c = ok(cargarComprobante("PRV-005", datos(numero, base))).comprobante;
  como("marta-diaz");
  ok(autorizarComprobante(c.id));
  como("ana-gomez");
  return c;
}

// Arma (Carlos, Tesorero) y autoriza (Ricardo, Tesorero central) una orden de pago; deja a Ricardo, que paga.
function ordenAutorizada(ids: string[], proveedorId = "PRV-005") {
  como("carlos-ibarra");
  const orden = ok(armarOrdenPago(proveedorId, ids)).orden;
  como("ricardo-pena");
  ok(autorizarOrdenPago(orden.id));
  return orden;
}

const banco = (id: string) => saldosBancarios().find((s) => s.cuentaId === id)!;
const comprobante = (id: string) => P.comprobantes.get().find((c) => c.id === id)!;
const orden = (id: string) => P.ordenesPago.get().find((o) => o.id === id)!;

test("circuito: autorizar deja Para liquidar sin número de orden; la OP se arma y se autoriza aparte", () => {
  const c = ok(cargarComprobante("PRV-005", datos("100"))).comprobante;
  assert.equal(c.estado, "PREAPROBADO");
  assert.equal(c.cargadoPor, "ana-gomez");

  como("marta-diaz");
  const a = ok(autorizarComprobante(c.id)).comprobante;
  assert.equal(a.estado, "PARA_LIQUIDAR");
  assert.equal(a.ordenPago, undefined, "el número de OP se genera al armarla");

  como("carlos-ibarra");
  const op = ok(armarOrdenPago("PRV-005", [c.id])).orden;
  assert.equal(op.id, "OP-0005", "las órdenes de ejemplo llegan hasta OP-0004");
  assert.equal(op.estado, "EMITIDA");
  assert.equal(op.total, 121000);
  assert.equal(op.cuentaDestino, "0170099220000067890125", "la cuenta destino es la de la ficha del proveedor");
  assert.equal(comprobante(c.id).estado, "EN_ORDEN_PAGO");
  assert.equal(comprobante(c.id).ordenPago, op.id);
  falla(anularComprobante(c.id, "x"), /orden de pago/i);
});

test("la OP es de un solo proveedor y sólo admite comprobantes Para liquidar", () => {
  const a = autorizado("110", 100000);
  como("marta-diaz");
  const b = ok(cargarComprobante("PRV-004", datos("111"))).comprobante;
  como("raul-molina");
  ok(autorizarComprobante(b.id));
  como("carlos-ibarra");
  falla(armarOrdenPago("PRV-005", [a.id, b.id]), /mezclar proveedores/i);
  falla(armarOrdenPago("PRV-005", []), /al menos un comprobante/i);
  falla(armarOrdenPago("PRV-005", ["CMP-0001"]), /mezclar proveedores/i); // es de otro proveedor
  ok(armarOrdenPago("PRV-005", [a.id]));
  falla(armarOrdenPago("PRV-005", [a.id]), /Para liquidar/i); // ya está en una orden
  como("ana-gomez");
  falla(armarOrdenPago("PRV-004", [b.id]), /perfil financiero/i);
});

test("cuatro ojos en la orden de pago: no la autoriza quien la armó, aunque tenga el rol", () => {
  como("marta-diaz"); // supervisora
  const c = autorizado("120", 100000);
  como("marta-diaz");
  const op = ok(armarOrdenPago("PRV-005", [c.id])).orden;
  falla(autorizarOrdenPago(op.id), /armaste vos/i);
  como("carlos-ibarra"); // tesorero: no autoriza órdenes
  falla(autorizarOrdenPago(op.id), /Tesorero central, el Director o un Supervisor/i);
  como("raul-molina");
  ok(autorizarOrdenPago(op.id, "FIRMA-1"));
  assert.equal(orden(op.id).estado, "AUTORIZADA");
  assert.equal(orden(op.id).autorizacion?.firmaId, "FIRMA-1");
});

test("rechazar la OP exige motivo y libera los comprobantes", () => {
  const c = autorizado("130", 100000);
  como("carlos-ibarra");
  const op = ok(armarOrdenPago("PRV-005", [c.id])).orden;
  como("ricardo-pena");
  falla(rechazarOrdenPago(op.id, " "), /motivo/i);
  ok(rechazarOrdenPago(op.id, "Falta la conformidad de compras"));
  assert.equal(orden(op.id).estado, "RECHAZADA");
  assert.equal(comprobante(c.id).estado, "PARA_LIQUIDAR");
  assert.equal(comprobante(c.id).ordenPago, undefined);
});

test("una transferencia preparada reserva (baja el estimado, no el real) y ejecutada baja el real", () => {
  const c = autorizado("140", 100000); // 121.000
  const op = ordenAutorizada([c.id]);
  const antes = banco("CB-001");
  assert.equal(antes.real, 7850000);
  assert.equal(antes.comprometido, 410000, "cheque CHE-0005 (310.000) y transferencia PAG-0003 (100.000) de ejemplo");
  assert.equal(antes.estimado, 7440000);

  const pago = ok(pagarOrdenPago({ ordenId: op.id, importe: 121000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" })).pago;
  assert.equal(pago.estado, "PREPARADA");
  assert.equal(banco("CB-001").real, 7850000, "preparar no mueve el saldo real");
  assert.equal(banco("CB-001").estimado, 7440000 - 121000);
  assert.equal(orden(op.id).estado, "PENDIENTE_TRANSFERENCIA");
  falla(registrarResultadoTransferencia(pago.id, { resultado: "EJECUTADA", comprobante: "OP-1" }), /Pendiente de ejecución/i);

  ok(marcarPendienteEjecucion(pago.id));
  falla(registrarResultadoTransferencia(pago.id, { resultado: "EJECUTADA" }), /comprobante del banco/i);
  ok(registrarResultadoTransferencia(pago.id, { resultado: "EJECUTADA", comprobante: "OP-998877" }));
  assert.equal(banco("CB-001").real, 7850000 - 121000, "ejecutar baja el real");
  assert.equal(banco("CB-001").estimado, 7440000 - 121000, "y consume la reserva: el estimado no cambia");
  assert.equal(banco("CB-001").comprometido, 410000);
  assert.equal(orden(op.id).estado, "PAGADA");
  assert.equal(comprobante(c.id).estado, "PAGADO");

  ok(confirmarTransferencia(pago.id));
  falla(confirmarTransferencia(pago.id), /Ejecutada/i);
});

test("una transferencia rechazada libera la reserva y la orden vuelve a Autorizada", () => {
  const c = autorizado("150", 100000);
  const op = ordenAutorizada([c.id]);
  const pago = ok(pagarOrdenPago({ ordenId: op.id, importe: 121000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" })).pago;
  ok(marcarPendienteEjecucion(pago.id));
  falla(registrarResultadoTransferencia(pago.id, { resultado: "RECHAZADA" }), /motivo/i);
  ok(registrarResultadoTransferencia(pago.id, { resultado: "RECHAZADA", motivo: "El home banking estaba caído" }));
  assert.equal(orden(op.id).estado, "AUTORIZADA");
  assert.equal(banco("CB-001").estimado, 7440000, "se liberó la reserva");
  assert.equal(S.reservas.get().find((r) => r.id === pago.reservaId)?.estado, "LIBERADA");
  assert.equal(pendienteDeOrden(orden(op.id), P.pagos.get()), 121000, "el importe vuelve a quedar pendiente");
  assert.equal(comprobante(c.id).estado, "EN_ORDEN_PAGO");
  // y se puede volver a pagar
  ok(pagarOrdenPago({ ordenId: op.id, importe: 121000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-002" }));
});

test("pago parcial: la orden sigue Autorizada, los comprobantes se pagan en orden de vencimiento", () => {
  // OP-0004 de ejemplo: CMP-0008 (vence 15/7, 72.600) y CMP-0006 (vence 30/9, 181.500).
  como("ricardo-pena");
  falla(pagarOrdenPago({ ordenId: "OP-0004", importe: 1000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" }), /no está autorizada/i);
  como("raul-molina");
  ok(autorizarOrdenPago("OP-0004"));
  como("ricardo-pena");
  const p1 = ok(pagarOrdenPago({ ordenId: "OP-0004", importe: 100000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" })).pago;
  assert.deepEqual(p1.aplicaciones, [
    { comprobanteId: "CMP-0008", importe: 72600 },
    { comprobanteId: "CMP-0006", importe: 27400 },
  ]);
  assert.equal(pendienteDeOrden(orden("OP-0004"), P.pagos.get()), 154100);
  falla(pagarOrdenPago({ ordenId: "OP-0004", importe: 154101, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" }), /supera lo que queda/i);
  ok(marcarPendienteEjecucion(p1.id));
  ok(registrarResultadoTransferencia(p1.id, { resultado: "EJECUTADA", comprobante: "A-1" }));
  assert.equal(orden("OP-0004").estado, "AUTORIZADA");
  assert.equal(comprobante("CMP-0008").estado, "PAGADO");
  assert.equal(comprobante("CMP-0006").estado, "PAGO_PARCIAL");

  const p2 = ok(pagarOrdenPago({ ordenId: "OP-0004", importe: 154100, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" })).pago;
  ok(marcarPendienteEjecucion(p2.id));
  ok(registrarResultadoTransferencia(p2.id, { resultado: "EJECUTADA", comprobante: "A-2" }));
  assert.equal(orden("OP-0004").estado, "PAGADA");
  assert.equal(comprobante("CMP-0006").estado, "PAGADO");
  assert.equal(pagadoDeOrden("OP-0004", P.pagos.get()), 254100);
});

test("ningún egreso supera el estimado: no se paga más de lo que hay sin reservar", () => {
  const grande = autorizado("160", 8000000); // 9.680.000
  const op = ordenAutorizada([grande.id]);
  falla(pagarOrdenPago({ ordenId: op.id, importe: 9680000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" }), /saldo estimado/i);
  // CB-001 tiene 7.850.000 reales pero 410.000 reservados: 7.440.000 es el máximo.
  ok(pagarOrdenPago({ ordenId: op.id, importe: 7440000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" }));
  falla(pagarOrdenPago({ ordenId: op.id, importe: 1000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" }), /saldo estimado/i);
  falla(pagarOrdenPago({ ordenId: op.id, importe: 1000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-003" }), /en pesos/i);
  falla(pagarOrdenPago({ ordenId: op.id, importe: 1000, medio: "EFECTIVO", origenTipo: "BANCO", origenId: "CB-001" }), /efectivo sale de una caja/i);
});

test("pagar con cheque: emitido reserva, entregado deja la orden Pagada y debitado baja el real", () => {
  const c = autorizado("170", 100000); // 121.000
  const op = ordenAutorizada([c.id]);
  falla(pagarOrdenPago({ ordenId: op.id, importe: 1000, medio: "CHEQUE", origenTipo: "BANCO", origenId: "CB-001", chequeraId: "CHQ-002" }), /chequera/i);
  assert.equal(P.pagos.get().filter((p) => p.ordenPago === op.id).length, 0, "si el cheque falla, no queda pago");

  const pago = ok(pagarOrdenPago({ ordenId: op.id, importe: 121000, medio: "CHEQUE", origenTipo: "BANCO", origenId: "CB-001", chequeraId: "CHQ-001" })).pago;
  assert.equal(pago.estado, "EMITIDO");
  assert.ok(pago.chequeId && pago.reservaId);
  assert.equal(banco("CB-001").real, 7850000);
  assert.equal(banco("CB-001").estimado, 7440000 - 121000);
  assert.equal(orden(op.id).estado, "AUTORIZADA", "emitir no es pagar");

  ok(entregarChequePropio(pago.chequeId!, "Distribuidora Cuyo"));
  assert.equal(orden(op.id).estado, "PAGADA", "con la entrega, el pago al proveedor queda hecho");
  assert.equal(comprobante(c.id).estado, "PAGADO");
  assert.equal(banco("CB-001").real, 7850000, "el banco todavía no debitó");
  ok(presentarChequePropio(pago.chequeId!));
  ok(debitarChequePropio(pago.chequeId!));
  assert.equal(banco("CB-001").real, 7850000 - 121000);
  assert.equal(banco("CB-001").estimado, 7440000 - 121000, "el estimado no cambia al consumirse la reserva");
  assert.equal(S.reservas.get().find((r) => r.id === pago.reservaId)?.estado, "CONSUMIDA");
});

test("un cheque rechazado por el banco libera la reserva y reabre la deuda de la orden", () => {
  const c = autorizado("180", 100000);
  const op = ordenAutorizada([c.id]);
  const pago = ok(pagarOrdenPago({ ordenId: op.id, importe: 121000, medio: "CHEQUE", origenTipo: "BANCO", origenId: "CB-001", chequeraId: "CHQ-001" })).pago;
  ok(entregarChequePropio(pago.chequeId!, "Proveedor"));
  falla(rechazarChequePropio(pago.chequeId!, "Sin fondos"), /no puede pasar/i); // todavía no se presentó
  ok(presentarChequePropio(pago.chequeId!));
  ok(rechazarChequePropio(pago.chequeId!, "Cuenta cerrada"));
  assert.equal(orden(op.id).estado, "AUTORIZADA");
  assert.equal(comprobante(c.id).estado, "EN_ORDEN_PAGO");
  assert.equal(pendienteDeOrden(orden(op.id), P.pagos.get()), 121000);
  assert.equal(banco("CB-001").estimado, 7440000, "la reserva se liberó");
});

test("anular una OP cancela lo que está en curso, libera comprobantes y reservas", () => {
  const c = autorizado("190", 100000);
  const op = ordenAutorizada([c.id]);
  const pago = ok(pagarOrdenPago({ ordenId: op.id, importe: 50000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" })).pago;
  como("ana-gomez");
  falla(anularOrdenPago(op.id, "x"), /perfil financiero/i);
  como("carlos-ibarra");
  falla(anularOrdenPago(op.id, " "), /motivo/i);
  ok(anularOrdenPago(op.id, "Se pagó por otro medio"));
  assert.equal(orden(op.id).estado, "ANULADA");
  assert.equal(comprobante(c.id).estado, "PARA_LIQUIDAR");
  assert.equal(P.pagos.get().find((p) => p.id === pago.id)?.estado, "RECHAZADA");
  assert.equal(banco("CB-001").estimado, 7440000);
  // Con pagos hechos no se anula.
  como("ricardo-pena");
  falla(anularOrdenPago("OP-0003", "x"), /no se puede anular en su estado/i);
  falla(anularOrdenPago("OP-0002", "x"), /pagos hechos/i);
});

test("un pago en efectivo sale del libro de la caja y exige caja abierta y estimado", () => {
  const c = autorizado("200", 100000); // 121.000
  const op = ordenAutorizada([c.id]);
  const pagar = (importe: number) => pagarOrdenPago({ ordenId: op.id, importe, medio: "EFECTIVO", origenTipo: "CAJA", origenId: "CAJ-004" });
  como("ricardo-pena");
  falla(pagar(1000), /asignado a la caja/i);
  como("ana-gomez"); // no es perfil de pago
  falla(pagar(1000), /Tesorero central/i);
  como("tomas-ruiz"); // tesorero y cajero de la caja
  falla(pagar(1000), /no está abierta/i);

  const detalle = recuentoSugerido(DENOMINACIONES_INICIALES, "ARS", saldoCaja(S.libro.get(), "CAJ-004", "ARS"));
  const apertura = registrarApertura("CAJ-004", { detalle });
  assert.ok(apertura.ok, JSON.stringify(apertura));
  const antes = saldoCaja(S.libro.get(), "CAJ-004", "ARS");
  const pago = ok(pagar(100000)).pago;
  assert.equal(pago.estado, "EJECUTADA");
  assert.equal(saldoCaja(S.libro.get(), "CAJ-004", "ARS"), antes - 100000, "el efectivo baja el real en el momento");
  const asiento = S.libro.get().find((m) => m.id === pago.asientoLibroId);
  assert.equal(asiento?.egreso, 100000);
  assert.equal(asiento?.medio, "EFECTIVO");
  assert.match(asiento?.descripcion ?? "", new RegExp(`Pago a proveedor Distribuidora Cuyo S\\.A\\. · ${op.id}`));
  assert.equal(asiento?.refId, pago.id);
  assert.equal(posicionDeCaja("CAJ-004", "ARS").estimado, antes - 100000);
  assert.equal(orden(op.id).estado, "AUTORIZADA", "quedan 21.000 por pagar");

  // No alcanza el efectivo.
  const grande = autorizado("202", 600000); // 726.000, más que el efectivo
  const opGrande = ordenAutorizada([grande.id]);
  como("tomas-ruiz");
  falla(pagarOrdenPago({ ordenId: opGrande.id, importe: 726000, medio: "EFECTIVO", origenTipo: "CAJA", origenId: "CAJ-004" }), /saldo estimado/i);
});

test("las transferencias se agrupan en lotes por cuenta de origen y se descargan en CSV", () => {
  const lotes = lotesTransferencia();
  assert.equal(lotes.length, 1);
  assert.equal(lotes[0].cuentaId, "CB-001");
  assert.equal(lotes[0].items[0].pagoId, "PAG-0003");
  assert.equal(lotes[0].items[0].cbuDestino, "0110441230044129000019");
  assert.equal(lotes[0].total, 100000);

  const c = autorizado("210", 100000);
  const op = ordenAutorizada([c.id]);
  ok(pagarOrdenPago({ ordenId: op.id, importe: 21000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-002" }));
  assert.deepEqual(lotesTransferencia().map((l) => l.cuentaId).sort(), ["CB-001", "CB-002"]);
  const csv = csvLoteTransferencia("CB-001").split("\n");
  assert.equal(csv.length, 2);
  assert.match(csv[1], /PAG-0003;OP-0002;Papelera del Plata S\.A\.;30697100128;0110441230044129000019;100000/);
});



test("la antigüedad de la deuda agrupa lo pendiente por días de vencida", () => {
  const todos = antiguedadDeuda(P.comprobantes.get(), P.pagos.get(), P.tiposComprobante.get(), "2026-11-18");
  // CMP-0002 vence el 5/12 (no vencido), CMP-0003 el 12/11 (saldo 213.000), CMP-0006 el 30/9, CMP-0007 el 25/8 y CMP-0008 el 15/7.
  assert.equal(todos.total.NO_VENCIDO, 242000);
  assert.equal(todos.total.D1_30, 213000);
  assert.equal(todos.total.D31_60, 181500);
  assert.equal(todos.total.D61_90, 96800);
  assert.equal(todos.total.MAS_90, 72600);
  assert.equal(todos.total.total, 805900);
  const cuyo = todos.porProveedor.find((x) => x.proveedorId === "PRV-005")!;
  assert.equal(cuyo.D31_60 + cuyo.MAS_90, cuyo.total);
  assert.equal(antiguedadDeuda(P.comprobantes.get(), P.pagos.get(), P.tiposComprobante.get(), "2026-11-18", "PRV-001").total.total, 213000);
  // Lo pagado sale de la deuda y una fecha de corte anterior vuelve no vencido lo que todavía no había vencido.
  assert.equal(antiguedadDeuda(P.comprobantes.get(), P.pagos.get(), P.tiposComprobante.get(), "2026-07-01").total.NO_VENCIDO, 805900);
  assert.equal(tramoDeAtraso(0), "NO_VENCIDO");
  assert.equal(tramoDeAtraso(30), "D1_30");
  assert.equal(tramoDeAtraso(31), "D31_60");
  assert.equal(tramoDeAtraso(91), "MAS_90");
  assert.equal(diasDeAtraso("2026-11-12", "2026-11-18"), 6);
  assert.equal(vencimientoDe({ fechaComprobante: "2026-11-01", fechaVencimiento: undefined }), "2026-11-01", "sin vencimiento vence a la vista");
});

test("el vencimiento no puede ser anterior a la fecha del comprobante", () => {
  const ctx = { proveedor: P.proveedores.get()[4], tipos: P.tiposComprobante.get(), comprobantes: [], hoy: "2026-11-18" };
  assert.deepEqual(erroresComprobante(datos("1", 100000, { fechaVencimiento: "2026-12-10" }), ctx), {});
  assert.ok(erroresComprobante(datos("1", 100000, { fechaVencimiento: "2026-11-01" }), ctx).fechaVencimiento);
  assert.ok(erroresComprobante(datos("1", 100000, { fechaVencimiento: "2026-02-31" }), ctx).fechaVencimiento);
  const c = ok(cargarComprobante("PRV-005", datos("203", 100000, { fechaVencimiento: "2026-12-10" }))).comprobante;
  assert.equal(c.fechaVencimiento, "2026-12-10");
});

test("cuatro ojos: nadie autoriza lo que cargó y sólo un supervisor o tesorero autoriza", () => {
  const c = ok(cargarComprobante("PRV-005", datos("101"))).comprobante;
  falla(autorizarComprobante(c.id), /sólo un supervisor o un tesorero/i);

  como("tomas-ruiz"); // tesorero y cajero
  const propio = ok(cargarComprobante("PRV-005", datos("102"))).comprobante;
  falla(autorizarComprobante(propio.id), /cargaste vos/i);
  ok(autorizarComprobante(c.id));
});

test("el rechazo pide motivo y el operador corrige y reenvía", () => {
  const c = ok(cargarComprobante("PRV-005", datos("103"))).comprobante;
  como("marta-diaz");
  falla(rechazarComprobante(c.id, " "), /motivo/i);
  ok(rechazarComprobante(c.id, "Falta la orden de compra"));
  como("ana-gomez");
  const corregido = ok(corregirComprobante(c.id, datos("103", 120000))).comprobante;
  assert.equal(corregido.estado, "PREAPROBADO");
  assert.equal(corregido.total, 145200);
});

test("la cuenta corriente suma facturas, resta pagos y no cuenta lo no autorizado", () => {
  const tipos = P.tiposComprobante.get();
  // PRV-001: CMP-0003 (363.000, pagó 150.000) cuenta; CMP-0001 está Preaprobado y no cuenta.
  assert.equal(saldoProveedor("PRV-001", P.comprobantes.get(), P.pagos.get(), tipos), 213000);
  const cc = cuentaCorriente("PRV-001", P.comprobantes.get(), P.pagos.get(), tipos);
  assert.equal(cc.filas.length, 2);
  assert.equal(cc.filas[0].saldoPendiente, 213000);
  assert.equal(cc.saldoActual, 213000);
  // Con un rango que arranca después de la factura, el saldo inicial arrastra la deuda.
  const desde = cuentaCorriente("PRV-001", P.comprobantes.get(), P.pagos.get(), tipos, { desde: "2026-11-01" });
  assert.equal(desde.saldoInicial, 363000);
  assert.equal(desde.filas.length, 1);
  assert.equal(desde.saldoActual, 213000);
  // Un proveedor sin deuda autorizada queda en cero.
  assert.equal(saldoProveedor("PRV-003", P.comprobantes.get(), P.pagos.get(), tipos), 0);
});

test("la nota de crédito descuenta de la cuenta corriente y, en una OP, resta de las facturas", () => {
  como("carlos-ibarra");
  const nc = ok(cargarComprobante("PRV-005", datos("900", 50000, { tipoId: "TCP-005" }))).comprobante; // 60.500
  como("marta-diaz");
  ok(autorizarComprobante(nc.id));
  const factura = autorizado("300", 100000); // 121.000
  const tipos = P.tiposComprobante.get();
  const antes = saldoProveedor("PRV-005", P.comprobantes.get(), P.pagos.get(), tipos);
  assert.equal(antes, 181500 + 72600 + 121000 - 60500, "CMP-0006, CMP-0008 y la factura, menos la nota de crédito");

  como("carlos-ibarra");
  falla(armarOrdenPago("PRV-005", [nc.id]), /nota de crédito sola/i);
  const op = ok(armarOrdenPago("PRV-005", [nc.id, factura.id])).orden;
  // La factura (121.000) menos la nota (60.500): quedan 60.500 en dinero.
  assert.equal(op.total, 60500);
  assert.deepEqual(op.items.find((i) => i.comprobanteId === factura.id), { comprobanteId: factura.id, credito: 60500, aPagar: 60500 });
  assert.equal(op.items.find((i) => i.comprobanteId === nc.id)?.credito, 60500);
  // La nota se consume en la OP: no cambia lo que se le debe al proveedor.
  assert.equal(saldoProveedor("PRV-005", P.comprobantes.get(), P.pagos.get(), tipos, P.ordenesPago.get()), antes);

  como("ricardo-pena");
  ok(autorizarOrdenPago(op.id));
  const pago = ok(pagarOrdenPago({ ordenId: op.id, importe: 60500, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" })).pago;
  ok(marcarPendienteEjecucion(pago.id));
  ok(registrarResultadoTransferencia(pago.id, { resultado: "EJECUTADA", comprobante: "NC-1" }));
  assert.equal(orden(op.id).estado, "PAGADA");
  assert.equal(comprobante(factura.id).estado, "PAGADO");
  assert.equal(comprobante(nc.id).estado, "PAGADO", "la nota se salda cuando se salda la orden");
  assert.equal(saldoProveedor("PRV-005", P.comprobantes.get(), P.pagos.get(), tipos, P.ordenesPago.get()), 181500 + 72600, "quedan CMP-0006 y CMP-0008");
});

test("las notas de crédito no pueden superar las facturas de la orden", () => {
  const factura = autorizado("301", 100000); // 121.000
  como("carlos-ibarra");
  const nc = ok(cargarComprobante("PRV-005", datos("901", 1000000, { tipoId: "TCP-005" }))).comprobante;
  como("marta-diaz");
  ok(autorizarComprobante(nc.id));
  como("carlos-ibarra");
  falla(armarOrdenPago("PRV-005", [nc.id, factura.id]), /superan/i);
});



test("la carga masiva acepta las filas válidas y rechaza las que no, con su motivo", () => {
  const fila = (num: string, extra: Partial<Record<number, string>> = {}) => {
    const f = ["", "Factura A", "2026-11-10", "0003", num, "0", "0", "1000", "0", "0", "1000", "210", "0", "0", "0", "0", "0", "0", "0", "0", "1210", ""];
    Object.entries(extra).forEach(([k, v]) => (f[Number(k)] = v as string));
    return f;
  };
  const filas = [
    generarPlantilla()[0],
    fila("1"),
    fila("2", { 1: "Remito" }), // tipo inexistente
    fila("3", { 2: "31/02/2026" }), // fecha inválida
    fila("4", { 20: "999" }), // totales que no cierran
    fila("1"), // duplicado dentro del archivo
    fila("5", { 0: "30697100128" }), // CUIT de otro proveedor
    [],
    fila("6", { 22: "2026-12-15" }), // con vencimiento
    fila("7", { 22: "2026-11-01" }), // vencimiento anterior al comprobante
  ];
  const r = validarFilasLote("PRV-005", filas);
  assert.deepEqual(r.aceptadas.map((a) => a.fila), [2, 9]);
  assert.deepEqual(r.rechazadas.map((x) => x.fila), [3, 4, 5, 6, 7, 10]);
  assert.equal(r.aceptadas[1].datos.fechaVencimiento, "2026-12-15");
  assert.equal(r.aceptadas[0].datos.fechaVencimiento, undefined);
  assert.match(r.rechazadas[5].motivo, /vencimiento/i);
  assert.match(r.rechazadas[0].motivo, /tipo de comprobante/i);
  assert.match(r.rechazadas[1].motivo, /fecha/i);
  assert.match(r.rechazadas[2].motivo, /no cierran/i);
  assert.match(r.rechazadas[3].motivo, /ya está cargado/i);
  assert.match(r.rechazadas[4].motivo, /cuit/i);

  const antes = P.comprobantes.get().length;
  const lote = ok(confirmarLote("PRV-005", "facturas.xlsx", r.aceptadas, r.rechazadas.length));
  assert.equal(lote.lote.id, "LOT-0002");
  assert.equal(lote.lote.aceptadas, 2);
  assert.equal(lote.lote.rechazadas, 6);
  assert.equal(P.comprobantes.get().length, antes + 2);
  assert.ok(P.comprobantes.get().filter((c) => c.loteId === "LOT-0002").every((c) => c.estado === "PREAPROBADO"));
  falla(confirmarLote("PRV-005", "vacio.xlsx", []), /no hay filas/i);
});
