import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import { fijarFechaDemo, fijarUsuarioActual as como, reiniciarCaja } from "./caja-store";
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
  cuentaCorriente,
  erroresComprobante,
  formatearCuit,
  saldoProveedor,
  validarCuit,
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
  assert.equal(a.ordenPago, "OP-0004");

  como("carlos-ibarra");
  const p1 = ok(registrarPago({ comprobanteId: c.id, importe: 50000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" })).pago;
  assert.equal(p1.ordenPago, "OP-0004");
  assert.equal(P.comprobantes.get().find((x) => x.id === c.id)?.estado, "PAGO_PARCIAL");
  falla(registrarPago({ comprobanteId: c.id, importe: 80000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" }), /supera el saldo/i);
  ok(registrarPago({ comprobanteId: c.id, importe: 71000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" }));
  assert.equal(P.comprobantes.get().find((x) => x.id === c.id)?.estado, "PAGADO");
  falla(anularComprobante(c.id, "error"), /pagos aplicados/i);
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
    fila("6"),
  ];
  const r = validarFilasLote("PRV-005", filas);
  assert.deepEqual(r.aceptadas.map((a) => a.fila), [2, 9]);
  assert.deepEqual(r.rechazadas.map((x) => x.fila), [3, 4, 5, 6, 7]);
  assert.match(r.rechazadas[0].motivo, /tipo de comprobante/i);
  assert.match(r.rechazadas[1].motivo, /fecha/i);
  assert.match(r.rechazadas[2].motivo, /no cierran/i);
  assert.match(r.rechazadas[3].motivo, /ya está cargado/i);
  assert.match(r.rechazadas[4].motivo, /cuit/i);

  const antes = P.comprobantes.get().length;
  const lote = ok(confirmarLote("PRV-005", "facturas.xlsx", r.aceptadas, r.rechazadas.length));
  assert.equal(lote.lote.id, "LOT-0002");
  assert.equal(lote.lote.aceptadas, 2);
  assert.equal(lote.lote.rechazadas, 5);
  assert.equal(P.comprobantes.get().length, antes + 2);
  assert.ok(P.comprobantes.get().filter((c) => c.loteId === "LOT-0002").every((c) => c.estado === "PREAPROBADO"));
  falla(confirmarLote("PRV-005", "vacio.xlsx", []), /no hay filas/i);
});
