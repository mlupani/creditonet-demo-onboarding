import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  SIN_FILTROS,
  enRangoDeFechas,
  esCobrador,
  lotesDeBandeja,
  ordenesDeBandeja,
  pendientesDeBandeja,
  remesasDeBandeja,
  resumenBandeja,
  totalBandeja,
  vistasDe,
  type DatosBandeja,
} from "./bandeja-reglas";
import { cajaStores as S, fijarFechaDemo, fijarUsuarioActual as como, reiniciarCaja, usuarioPorId } from "./caja-store";
import { reiniciarControl } from "./control-store";
import { lotesTransferencia, marcarPendienteEjecucion, pagarOrdenPago, registrarResultadoTransferencia } from "./proveedores-operaciones";
import { pendienteDeOrden } from "./proveedores-reglas";
import { provStores as P, reiniciarProveedores } from "./proveedores-store";

beforeEach(() => {
  reiniciarCaja();
  reiniciarControl();
  reiniciarProveedores();
  fijarFechaDemo("2026-11-18");
});

const datos = (usuarioId: string): DatosBandeja => ({
  usuario: usuarioPorId(usuarioId)!,
  ordenes: P.ordenesPago.get(),
  pagos: P.pagos.get(),
  proveedores: P.proveedores.get(),
  lotes: lotesTransferencia(),
  movimientos: S.movimientos.get(),
  cajas: S.cajas.get(),
});

test("cada rol ve sólo sus botones de la bandeja", () => {
  assert.deepEqual(vistasDe(usuarioPorId("laura-benitez")), ["proveedores", "transferencias", "remesas", "pendientes"]);
  assert.deepEqual(vistasDe(usuarioPorId("ricardo-pena")), ["proveedores", "transferencias", "remesas", "pendientes"]);
  assert.deepEqual(vistasDe(usuarioPorId("carlos-ibarra")), ["remesas", "pendientes"]);
  assert.deepEqual(vistasDe(usuarioPorId("marta-diaz")), ["remesas", "pendientes"]);
  assert.deepEqual(vistasDe(usuarioPorId("ana-gomez")), ["remesas"]);
  assert.deepEqual(vistasDe(undefined), []);
});

test("el bloque de cobrador es del cajero y del tesorero de sucursal", () => {
  assert.equal(esCobrador(usuarioPorId("ana-gomez")), true);
  assert.equal(esCobrador(usuarioPorId("tomas-ruiz")), true);
  assert.equal(esCobrador(usuarioPorId("carlos-ibarra")), true);
  assert.equal(esCobrador(usuarioPorId("marta-diaz")), false);
  assert.equal(esCobrador(usuarioPorId("ricardo-pena")), false);
  assert.equal(esCobrador(usuarioPorId("laura-benitez")), false);
});

test("el filtro de fechas recorta órdenes, transferencias, remesas y pendientes por día", () => {
  assert.equal(enRangoDeFechas("2026-11-10 09:40", SIN_FILTROS), true);
  assert.equal(enRangoDeFechas(undefined, { fechaDesde: "2026-11-01", fechaHasta: "2026-11-02" }), true, "sin fecha no se filtra");
  assert.equal(enRangoDeFechas("2026-11-10 09:40", { fechaDesde: "2026-11-10", fechaHasta: "2026-11-10" }), true, "incluye ambos extremos");
  assert.equal(enRangoDeFechas("2026-11-10", { fechaDesde: "2026-11-11", fechaHasta: "" }), false);
  assert.equal(enRangoDeFechas("2026-11-10", { fechaDesde: "", fechaHasta: "2026-11-09" }), false);

  const todas = ordenesDeBandeja(P.ordenesPago.get(), P.pagos.get(), P.proveedores.get());
  const futuras = ordenesDeBandeja(P.ordenesPago.get(), P.pagos.get(), P.proveedores.get(), { ...SIN_FILTROS, fechaDesde: "2099-01-01" });
  assert.ok(todas.length > 0);
  assert.deepEqual(futuras, []);
  const dia = todas[0].orden.fechaArmado;
  const delDia = ordenesDeBandeja(P.ordenesPago.get(), P.pagos.get(), P.proveedores.get(), { ...SIN_FILTROS, fechaDesde: dia, fechaHasta: dia });
  assert.ok(delDia.length > 0 && delDia.every((f) => f.orden.fechaArmado === dia));

  const lotes = lotesTransferencia();
  assert.ok(lotes.length > 0);
  assert.deepEqual(lotesDeBandeja(lotes, { ...SIN_FILTROS, fechaDesde: "2099-01-01" }, P.pagos.get()), []);
  assert.ok(lotesDeBandeja(lotes, SIN_FILTROS, P.pagos.get()).length > 0);

  const central = usuarioPorId("ricardo-pena")!;
  assert.deepEqual(remesasDeBandeja(S.movimientos.get(), S.cajas.get(), central, { ...SIN_FILTROS, fechaDesde: "2099-01-01" }), []);
  assert.deepEqual(pendientesDeBandeja(datos("ricardo-pena"), { ...SIN_FILTROS, fechaDesde: "2099-01-01" }), []);
  // Las tarjetas respetan el rango.
  const r = resumenBandeja(datos("ricardo-pena"), { ...SIN_FILTROS, fechaDesde: "2099-01-01" });
  assert.equal(totalBandeja(r).cantidad, 0);
});

test("Proveedores lista las órdenes emitidas (por autorizar) y las autorizadas con saldo (por pagar)", () => {
  const filas = ordenesDeBandeja(P.ordenesPago.get(), P.pagos.get(), P.proveedores.get());
  assert.ok(filas.length > 0);
  for (const f of filas) {
    assert.ok(f.orden.estado === "EMITIDA" || f.orden.estado === "AUTORIZADA");
    assert.equal(f.fase, f.orden.estado === "EMITIDA" ? "AUTORIZAR" : "PAGAR");
    assert.ok(f.pendiente > 0);
  }
  // Las órdenes con todo el importe en transferencias en curso no se listan acá: están en Transferencias.
  assert.ok(!filas.some((f) => f.orden.estado === "PENDIENTE_TRANSFERENCIA"));
  // Primero lo que espera autorización.
  const fases = filas.map((f) => f.fase);
  assert.deepEqual(fases, [...fases].sort((a, b) => (a === b ? 0 : a === "AUTORIZAR" ? -1 : 1)));
});

test("los filtros de búsqueda y moneda recortan las órdenes y los lotes", () => {
  const todas = ordenesDeBandeja(P.ordenesPago.get(), P.pagos.get(), P.proveedores.get());
  const una = ordenesDeBandeja(P.ordenesPago.get(), P.pagos.get(), P.proveedores.get(), { ...SIN_FILTROS, busqueda: "op-0004" });
  assert.deepEqual(una.map((f) => f.orden.id), ["OP-0004"]);
  assert.deepEqual(ordenesDeBandeja(P.ordenesPago.get(), P.pagos.get(), P.proveedores.get(), { ...SIN_FILTROS, busqueda: "zzzz" }), []);
  assert.deepEqual(ordenesDeBandeja(P.ordenesPago.get(), P.pagos.get(), P.proveedores.get(), { ...SIN_FILTROS, moneda: "USD" }), []);
  assert.ok(todas.length >= una.length);
  const lotes = lotesTransferencia();
  assert.ok(lotes.length > 0);
  assert.deepEqual(lotesDeBandeja(lotes, { ...SIN_FILTROS, moneda: "USD" }), []);
  const proveedor = lotes[0].items[0].proveedor;
  const filtrados = lotesDeBandeja(lotes, { ...SIN_FILTROS, busqueda: proveedor.slice(0, 5) });
  assert.ok(filtrados.every((l) => l.items.every((i) => i.proveedor.toLowerCase().includes(proveedor.slice(0, 5).toLowerCase()))));
});

test("las tarjetas cuentan por rol y suman el total", () => {
  const central = resumenBandeja(datos("ricardo-pena"));
  assert.equal(central.proveedores.cantidad, ordenesDeBandeja(P.ordenesPago.get(), P.pagos.get(), P.proveedores.get()).length);
  assert.equal(central.transferencias.cantidad, lotesTransferencia().flatMap((l) => l.items).length);
  assert.ok(central.proveedores.importe.ARS > 0);
  const total = totalBandeja(central);
  assert.equal(total.cantidad, central.proveedores.cantidad + central.transferencias.cantidad + central.remesas.cantidad + central.pendientes.cantidad);

  const cajero = resumenBandeja(datos("ana-gomez"));
  assert.equal(cajero.proveedores.cantidad, 0);
  assert.equal(cajero.transferencias.cantidad, 0);
  assert.equal(cajero.pendientes.cantidad, 0);
  assert.equal(totalBandeja(cajero, vistasDe(usuarioPorId("ana-gomez"))).cantidad, cajero.remesas.cantidad);
});

test("el cajero sólo ve las remesas de su caja y el tesorero central las de todas", () => {
  const todas = remesasDeBandeja(S.movimientos.get(), S.cajas.get(), usuarioPorId("ricardo-pena")!);
  const deAna = remesasDeBandeja(S.movimientos.get(), S.cajas.get(), usuarioPorId("ana-gomez")!);
  assert.ok(todas.length >= deAna.length);
  const suyas = new Set(S.cajas.get().filter((c) => c.cajeros.some((x) => x.usuarioId === "ana-gomez" && x.estado === "ACTIVO") || c.tesoreroId === "ana-gomez").map((c) => c.id));
  for (const m of deAna) assert.ok(suyas.has(m.origenId) || (m.destino.tipo === "CAJA" && suyas.has(m.destino.cajaId)));
  assert.ok(deAna.every((m) => ["SOLICITADO", "AUTORIZADO", "EN_TRANSITO", "CON_INCIDENCIA"].includes(m.estado)));
  assert.deepEqual(remesasDeBandeja(S.movimientos.get(), S.cajas.get(), usuarioPorId("ricardo-pena")!, { ...SIN_FILTROS, busqueda: "zzzz" }), []);
});

test("una transferencia rechazada aparece en Pendientes y la orden vuelve a tener saldo", () => {
  como("ricardo-pena");
  const orden = P.ordenesPago.get().find((o) => o.id === "OP-0001")!;
  assert.equal(orden.estado, "AUTORIZADA");
  const antes = pendienteDeOrden(orden, P.pagos.get());
  assert.ok(antes > 1000);
  const pago = pagarOrdenPago({ ordenId: "OP-0001", importe: 1000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" });
  assert.ok(pago.ok, pago.ok ? "" : pago.error);
  if (!pago.ok) return;
  assert.equal(pendienteDeOrden(P.ordenesPago.get().find((o) => o.id === "OP-0001")!, P.pagos.get()), antes - 1000);
  assert.ok(marcarPendienteEjecucion(pago.pago.id).ok);
  const sinMotivo = registrarResultadoTransferencia(pago.pago.id, { resultado: "RECHAZADA" });
  assert.equal(sinMotivo.ok, false);
  const r = registrarResultadoTransferencia(pago.pago.id, { resultado: "RECHAZADA", motivo: "CBU inexistente" });
  assert.ok(r.ok);

  const pendientes = pendientesDeBandeja(datos("ricardo-pena"));
  const p = pendientes.find((x) => x.tipo === "PAGO_RECHAZADO" && x.referencia === "OP-0001");
  assert.ok(p, "la transferencia rechazada debe figurar como contingencia");
  assert.match(p.detalle, /CBU inexistente/);
  assert.equal(p.vista, "proveedores");
  assert.equal(p.busqueda, "OP-0001");
  // El tesorero de sucursal no ve las contingencias de Proveedores.
  assert.ok(!pendientesDeBandeja(datos("carlos-ibarra")).some((x) => x.tipo === "PAGO_RECHAZADO"));
  // Y vuelve a poder pagarse el importe completo.
  assert.equal(pendienteDeOrden(P.ordenesPago.get().find((o) => o.id === "OP-0001")!, P.pagos.get()), antes);
});

test("una orden pagada en parte figura como pago parcial", () => {
  como("ricardo-pena");
  const orden = P.ordenesPago.get().find((o) => o.id === "OP-0001")!;
  const antes = pendienteDeOrden(orden, P.pagos.get());
  const r = pagarOrdenPago({ ordenId: "OP-0001", importe: 1000, medio: "TRANSFERENCIA", origenTipo: "BANCO", origenId: "CB-001" });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.ok(marcarPendienteEjecucion(r.pago.id).ok);
  assert.ok(registrarResultadoTransferencia(r.pago.id, { resultado: "EJECUTADA", comprobante: "BNA-1234" }).ok);
  const p = pendientesDeBandeja(datos("ricardo-pena")).find((x) => x.tipo === "PARCIAL" && x.referencia === "OP-0001");
  assert.ok(p);
  assert.equal(p.importe, antes - 1000);
});
