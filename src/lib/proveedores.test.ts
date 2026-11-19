import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import { DENOMINACIONES_INICIALES } from "./caja-datos";
import { registrarApertura, saldosBancarios } from "./caja-operaciones";
import { recuentoSugerido, saldoCaja } from "./caja-reglas";
import { cajaStores as S, fijarFechaDemo, fijarUsuarioActual as como, reiniciarCaja } from "./caja-store";
import {
  anularComprobante,
  autorizarComprobante,
  cargarComprobante,
  confirmarLote,
  corregirComprobante,
  generarPlantilla,
  rechazarComprobante,
  registrarPago,
  validarFilasLote,
} from "./proveedores-operaciones";
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

test("circuito: cargar, autorizar, pagar parcial y pagar", () => {
  const c = ok(cargarComprobante("PRV-005", datos("100"))).comprobante;
  assert.equal(c.estado, "PREAPROBADO");
  assert.equal(c.cargadoPor, "ana-gomez");

  como("marta-diaz");
  const a = ok(autorizarComprobante(c.id)).comprobante;
  assert.equal(a.estado, "PARA_LIQUIDAR");
  assert.equal(a.ordenPago, "OP-0007");

  como("carlos-ibarra");
  const p1 = ok(registrarPago({ comprobanteId: c.id, importe: 50000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" })).pago;
  assert.equal(p1.ordenPago, "OP-0007");
  assert.equal(P.comprobantes.get().find((x) => x.id === c.id)?.estado, "PAGO_PARCIAL");
  falla(registrarPago({ comprobanteId: c.id, importe: 80000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" }), /supera el saldo/i);
  ok(registrarPago({ comprobanteId: c.id, importe: 71000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" }));
  assert.equal(P.comprobantes.get().find((x) => x.id === c.id)?.estado, "PAGADO");
  falla(anularComprobante(c.id, "error"), /pagos aplicados/i);
});

// Carga (Ana) y autoriza (Marta) un comprobante; deja al usuario actual en Ana.
function autorizado(numero: string, base: number) {
  como("ana-gomez");
  const c = ok(cargarComprobante("PRV-005", datos(numero, base))).comprobante;
  como("marta-diaz");
  ok(autorizarComprobante(c.id));
  como("ana-gomez");
  return c;
}

test("un pago desde el banco es un egreso: baja el saldo de la cuenta", () => {
  const saldo = () => saldosBancarios().find((s) => s.cuentaId === "CB-001")!;
  assert.equal(saldo().saldoInicial, 8000000);
  assert.equal(saldo().pagado, 150000, "el pago de ejemplo PAG-0001 ya descontó");
  assert.equal(saldo().saldo, 7850000);
  const c = autorizado("200", 100000);
  como("carlos-ibarra");
  ok(registrarPago({ comprobanteId: c.id, importe: 50000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" }));
  assert.equal(saldo().saldo, 7800000);
  falla(registrarPago({ comprobanteId: c.id, importe: 1000, medio: "EFECTIVO", origenTipo: "BANCO", origenId: "CB-001" }), /efectivo sale de una caja/i);
  falla(registrarPago({ comprobanteId: c.id, importe: 1000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-003" }), /en pesos/i);
});

test("pagar con cheque desde el banco emite un cheque propio y, si no se puede, no registra el pago", () => {
  const c = autorizado("210", 100000);
  como("carlos-ibarra");
  const pagos = P.pagos.get().length;
  falla(registrarPago({ comprobanteId: c.id, importe: 1000, medio: "CHEQUE", origenTipo: "BANCO", origenId: "CB-001", chequeraId: "CHQ-002" }), /chequera/i);
  assert.equal(P.pagos.get().length, pagos, "si el cheque falla, el pago no se registra");
  const pago = ok(registrarPago({ comprobanteId: c.id, importe: 121000, medio: "CHEQUE", origenTipo: "BANCO", origenId: "CB-001", chequeraId: "CHQ-001" })).pago;
  assert.ok(pago.chequeId, "queda la referencia al cheque emitido");
  assert.equal(P.comprobantes.get().find((x) => x.id === c.id)?.estado, "PAGADO");
});

test("un pago en efectivo sale del libro de la caja y exige caja abierta y saldo", () => {
  const c = autorizado("201", 100000); // total 121.000
  const pagar = (importe: number, medio: "EFECTIVO" | "TRANSFERENCIA" = "EFECTIVO") =>
    registrarPago({ comprobanteId: c.id, importe, medio, origenTipo: "CAJA", origenId: "CAJ-003" });
  falla(pagar(1000), /no está abierta/i);

  const detalle = recuentoSugerido(DENOMINACIONES_INICIALES, "ARS", saldoCaja(S.libro.get(), "CAJ-003", "ARS"));
  assert.ok(registrarApertura("CAJ-003", { detalle }).ok);
  const antes = saldoCaja(S.libro.get(), "CAJ-003", "ARS");
  const pago = ok(pagar(100000)).pago;
  assert.equal(saldoCaja(S.libro.get(), "CAJ-003", "ARS"), antes - 100000);
  const asiento = S.libro.get().find((m) => m.id === pago.asientoLibroId);
  assert.equal(asiento?.egreso, 100000);
  assert.equal(asiento?.medio, "EFECTIVO");
  assert.match(asiento?.descripcion ?? "", /Pago a proveedor Distribuidora Cuyo S\.A\. · OP-0007/);
  assert.equal(asiento?.refId, pago.id);

  // Una transferencia desde la caja figura en el libro pero no mueve el efectivo.
  const transf = ok(pagar(1000, "TRANSFERENCIA")).pago;
  assert.equal(S.libro.get().find((m) => m.id === transf.asientoLibroId)?.medio, "TRANSFERENCIA");
  assert.equal(saldoCaja(S.libro.get(), "CAJ-003", "ARS"), antes - 100000);

  // No alcanza el efectivo.
  const grande = autorizado("202", 600000); // total 726.000, más que el efectivo
  falla(registrarPago({ comprobanteId: grande.id, importe: 726000, medio: "EFECTIVO", origenTipo: "CAJA", origenId: "CAJ-003" }), /saldo suficiente/i);
  // Sólo quien está asignado a la caja paga en efectivo desde ella.
  como("marta-diaz");
  falla(pagar(1000), /asignado a la caja/i);
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

test("la nota de crédito descuenta de la cuenta corriente y no se paga", () => {
  const nc = ok(cargarComprobante("PRV-001", datos("900", 100000, { tipoId: "TCP-005" }))).comprobante;
  como("marta-diaz");
  ok(autorizarComprobante(nc.id));
  const tipos = P.tiposComprobante.get();
  assert.equal(saldoProveedor("PRV-001", P.comprobantes.get(), P.pagos.get(), tipos), 213000 - 121000);
  falla(registrarPago({ comprobanteId: nc.id, importe: 1, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" }), /nota de crédito/i);
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
