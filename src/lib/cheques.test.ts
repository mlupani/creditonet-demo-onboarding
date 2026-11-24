import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import { DENOMINACIONES_INICIALES } from "./caja-datos";
import { registrarApertura } from "./caja-operaciones";
import { recuentoSugerido, saldoCaja } from "./caja-reglas";
import { cajaStores as S, fijarFechaDemo, fijarUsuarioActual, reiniciarCaja } from "./caja-store";
import {
  anularChequePropio,
  debitarChequePropio,
  depositarCheque,
  emitirChequePropio,
  entregarCheque,
  entregarChequePropio,
  presentarChequePropio,
  rechazarCheque,
  rechazarChequePropio,
  recibirChequeTercero,
  registrarConteoValores,
} from "./cheques-operaciones";
import { saldosBancarios } from "./caja-operaciones";
import { enCustodia, numeracionDe, proximoNumero, puedeTransicionar, vencePronto } from "./cheques-reglas";

const como = fijarUsuarioActual;
const emision = { importe: 100000, beneficiario: "Proveedor SA", fechaPago: "2026-12-10", referencia: "Factura 1" };

beforeEach(() => {
  reiniciarCaja();
  fijarFechaDemo("2026-11-18");
  como("marta-diaz");
});

test("la emisión toma el próximo número libre del rango de la chequera", () => {
  const r = emitirChequePropio({ ...emision, cuentaId: "CB-001", chequeraId: "CHQ-001" });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.cheque.numero, "10002"); // el 10001 ya está emitido en los datos de ejemplo
  assert.equal(r.cheque.estado, "EMITIDO");
  assert.equal(r.cheque.moneda, "ARS");
  assert.equal(r.cheque.forma, "FISICO");
  // Emitir crea la reserva (baja el estimado) pero no mueve el saldo real del banco.
  assert.equal(r.reserva.estado, "ACTIVA");
  assert.equal(r.reserva.importe, 100000);
  const antes = saldosBancarios().find((s) => s.cuentaId === "CB-001")!;
  assert.equal(antes.real, 7850000);
  assert.equal(antes.estimado, 7850000 - 310000 - 100000 - 100000, "CHE-0005 (310.000), PAG-0003 (100.000) y el cheque nuevo");
});

test("no se emite un cheque por encima del saldo estimado de la cuenta", () => {
  const r = emitirChequePropio({ ...emision, importe: 7600000, cuentaId: "CB-001", chequeraId: "CHQ-001" });
  assert.equal(r.ok, false);
  assert.match(r.ok ? "" : r.error, /saldo estimado/);
});

test("sin chequera elegida usa la primera activa de la cuenta", () => {
  const r = emitirChequePropio({ ...emision, cuentaId: "CB-001" });
  assert.ok(r.ok && r.cheque.chequeraId === "CHQ-001");
});

test("no se emite fuera del rango: sin numeración disponible", () => {
  S.chequeras.commit(S.chequeras.get().map((q) => (q.id === "CHQ-001" ? { ...q, hasta: "10002" } : q)));
  assert.ok(emitirChequePropio({ ...emision, cuentaId: "CB-001", chequeraId: "CHQ-001" }).ok); // 10002
  const r = emitirChequePropio({ ...emision, cuentaId: "CB-001", chequeraId: "CHQ-001" });
  assert.equal(r.ok, false);
  assert.match(r.ok ? "" : r.error, /numeración/);
  const q = S.chequeras.get().find((x) => x.id === "CHQ-001")!;
  assert.equal(numeracionDe(q, S.cheques.get()).disponibles, 0);
});

test("el e-cheq sin rango asigna un correlativo propio", () => {
  const r = emitirChequePropio({ ...emision, cuentaId: "CB-002", chequeraId: "CHQ-002" });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.cheque.forma, "ECHEQ");
  assert.equal(r.cheque.numero, "E-0002"); // E-0001 ya existe en los datos de ejemplo
  const q = S.chequeras.get().find((x) => x.id === "CHQ-002")!;
  assert.equal(proximoNumero(q, "ECHEQ", S.cheques.get()), "E-0003");
});

test("rechaza una chequera de otra cuenta, importes y fechas inválidos", () => {
  assert.equal(emitirChequePropio({ ...emision, cuentaId: "CB-002", chequeraId: "CHQ-001" }).ok, false);
  assert.equal(emitirChequePropio({ ...emision, cuentaId: "CB-003" }).ok, false); // sin chequeras
  assert.equal(emitirChequePropio({ ...emision, cuentaId: "CB-001", importe: 0 }).ok, false);
  assert.equal(emitirChequePropio({ ...emision, cuentaId: "CB-001", fechaPago: "2026-11-01" }).ok, false);
  assert.equal(emitirChequePropio({ ...emision, cuentaId: "CB-001", beneficiario: " " }).ok, false);
});

test("una chequera suspendida no emite", () => {
  S.chequeras.commit(S.chequeras.get().map((q) => (q.id === "CHQ-001" ? { ...q, estado: "SUSPENDIDO" as const } : q)));
  assert.equal(emitirChequePropio({ ...emision, cuentaId: "CB-001", chequeraId: "CHQ-001" }).ok, false);
});

test("transiciones de estado válidas por origen", () => {
  assert.ok(puedeTransicionar({ origen: "TERCERO", estado: "EN_CUSTODIA" }, "DEPOSITADO"));
  assert.ok(puedeTransicionar({ origen: "TERCERO", estado: "DEPOSITADO" }, "RECHAZADO"));
  assert.equal(puedeTransicionar({ origen: "TERCERO", estado: "DEPOSITADO" }, "ENTREGADO"), false);
  assert.equal(puedeTransicionar({ origen: "TERCERO", estado: "ENTREGADO" }, "EN_CUSTODIA"), false);
  assert.ok(puedeTransicionar({ origen: "PROPIO", estado: "EMITIDO" }, "ENTREGADO"));
  assert.ok(puedeTransicionar({ origen: "PROPIO", estado: "EMITIDO" }, "ANULADO"));
  assert.ok(puedeTransicionar({ origen: "PROPIO", estado: "ENTREGADO" }, "PRESENTADO"));
  assert.ok(puedeTransicionar({ origen: "PROPIO", estado: "PRESENTADO" }, "DEBITADO"));
  assert.ok(puedeTransicionar({ origen: "PROPIO", estado: "PRESENTADO" }, "RECHAZADO"));
  assert.equal(puedeTransicionar({ origen: "PROPIO", estado: "ENTREGADO" }, "ANULADO"), false); // se anula antes de entregar
  assert.equal(puedeTransicionar({ origen: "PROPIO", estado: "EMITIDO" }, "DEBITADO"), false); // no se saltea la entrega
  assert.equal(puedeTransicionar({ origen: "PROPIO", estado: "DEBITADO" }, "RECHAZADO"), false);
  assert.equal(puedeTransicionar({ origen: "PROPIO", estado: "EMITIDO" }, "DEPOSITADO"), false);
});

test("el ciclo del cheque propio: el débito baja el real y consume la reserva; anular o rechazar la liberan", () => {
  const banco = () => saldosBancarios().find((s) => s.cuentaId === "CB-001")!;
  assert.equal(banco().comprometido, 410000);
  como("marta-diaz");
  // CHE-0005 ya está Entregado en los datos de ejemplo (reserva de 310.000).
  assert.equal(debitarChequePropio("CHE-0005").ok, false); // falta presentarlo
  assert.ok(presentarChequePropio("CHE-0005").ok);
  assert.ok(debitarChequePropio("CHE-0005").ok);
  assert.equal(banco().real, 7850000 - 310000);
  assert.equal(banco().comprometido, 100000, "la reserva se consumió");
  assert.equal(banco().estimado, 7850000 - 310000 - 100000, "el estimado no cambia con el débito");
  assert.equal(S.reservas.get().find((r) => r.id === "RSV-0001")?.estado, "CONSUMIDA");

  // Un emitido se anula; un presentado, rechazado por el banco, también libera su reserva.
  const nuevo = emitirChequePropio({ ...emision, cuentaId: "CB-001", chequeraId: "CHQ-001" });
  assert.ok(nuevo.ok);
  if (!nuevo.ok) return;
  assert.equal(banco().comprometido, 200000);
  assert.ok(anularChequePropio(nuevo.cheque.id, "Error de carga").ok);
  assert.equal(banco().comprometido, 100000);
  assert.equal(S.reservas.get().find((r) => r.id === nuevo.reserva.id)?.estado, "LIBERADA");
  const otro = emitirChequePropio({ ...emision, cuentaId: "CB-001", chequeraId: "CHQ-001" });
  assert.ok(otro.ok);
  if (!otro.ok) return;
  assert.ok(entregarChequePropio(otro.cheque.id, "Proveedor").ok);
  assert.ok(presentarChequePropio(otro.cheque.id).ok);
  assert.equal(rechazarChequePropio(otro.cheque.id, " ").ok, false);
  assert.ok(rechazarChequePropio(otro.cheque.id, "Sin fondos del librador").ok);
  assert.equal(banco().comprometido, 100000);
  assert.equal(banco().real, 7850000 - 310000, "rechazado nunca bajó el real");
});

test("sólo un responsable de la caja opera el cheque en custodia", () => {
  como("ana-gomez");
  assert.equal(depositarCheque("CHE-0001", "CB-001", "2026-11-18").ok, false);
  como("carlos-ibarra");
  assert.ok(depositarCheque("CHE-0001", "CB-001", "2026-11-18").ok);
  const c = S.cheques.get().find((x) => x.id === "CHE-0001")!;
  assert.equal(c.estado, "DEPOSITADO");
  assert.equal(c.cuentaId, "CB-001");
  assert.equal(c.traza.length, 2);
  assert.equal(enCustodia("CAJ-001", S.cheques.get()).some((x) => x.id === "CHE-0001"), false);
});

test("el depósito exige cuenta de la misma moneda y un cheque en custodia", () => {
  como("carlos-ibarra");
  assert.equal(depositarCheque("CHE-0004", "CB-001", "2026-11-18").ok, false); // USD en cuenta ARS
  assert.ok(depositarCheque("CHE-0004", "CB-003", "2026-11-18").ok);
  assert.equal(entregarCheque("CHE-0004", "Proveedor").ok, false); // ya depositado
});

test("rechazar y anular exigen motivo; propios sólo los cambia Tesorero o Supervisor", () => {
  como("carlos-ibarra");
  assert.equal(rechazarCheque("CHE-0001", " ").ok, false);
  assert.ok(rechazarCheque("CHE-0001", "Sin fondos").ok);
  assert.equal(entregarCheque("CHE-0001", "X").ok, false);
  como("ana-gomez");
  assert.equal(entregarChequePropio("CHE-0006", "Proveedor").ok, false);
  como("marta-diaz");
  assert.equal(anularChequePropio("CHE-0006", "").ok, false);
  assert.ok(anularChequePropio("CHE-0006", "Error de carga").ok);
  assert.equal(entregarChequePropio("CHE-0006", "Proveedor").ok, false); // ya anulado
  // El número anulado sigue consumido: el próximo no lo reutiliza.
  const r = emitirChequePropio({ ...emision, cuentaId: "CB-002", chequeraId: "CHQ-002" });
  assert.ok(r.ok && r.cheque.numero === "E-0002");
});

test("recibir un cheque exige ser responsable de la caja y no repetir banco y número", () => {
  const dato = { cajaId: "CAJ-001", forma: "FISICO" as const, banco: "Banco Hipotecario", numero: "777", importe: 5000, moneda: "ARS" as const, librador: "Cliente SA", fechaEmision: "2026-11-18", fechaPago: "2026-12-01" };
  como("ana-gomez");
  assert.equal(recibirChequeTercero(dato).ok, false);
  como("carlos-ibarra");
  const r = recibirChequeTercero(dato);
  assert.ok(r.ok && r.cheque.id === "CHE-0007" && r.cheque.estado === "EN_CUSTODIA");
  assert.equal(recibirChequeTercero(dato).ok, false);
  assert.equal(recibirChequeTercero({ ...dato, numero: "778", fechaPago: "2026-11-01" }).ok, false);
});

test("vencen pronto sólo los cheques en custodia dentro de la semana", () => {
  const por = S.cheques.get().filter((c) => vencePronto(c, "2026-11-18")).map((c) => c.id);
  assert.deepEqual(por, ["CHE-0001"]); // vence el 23/11
});

test("el conteo de valores es aparte del efectivo y no cambia la jornada", () => {
  como("carlos-ibarra");
  const detalle = Object.assign({}, recuentoSugerido(DENOMINACIONES_INICIALES, "ARS", saldoCaja(S.libro.get(), "CAJ-001", "ARS")), recuentoSugerido(DENOMINACIONES_INICIALES, "USD", saldoCaja(S.libro.get(), "CAJ-001", "USD")));
  const ap = registrarApertura("CAJ-001", { detalle });
  assert.ok(ap.ok, ap.ok ? "" : ap.error);
  const jornada = S.jornadas.get()[0];
  const antes = JSON.stringify(jornada.apertura);

  assert.equal(registrarConteoValores(jornada.id, "APERTURA", 2).ok, false); // no coincide, falta observación
  assert.ok(registrarConteoValores(jornada.id, "APERTURA", 2, "Falta el cheque de Servicios del Sur").ok);
  const actual = S.jornadas.get()[0];
  assert.equal(actual.valoresApertura?.esperados, 3);
  assert.equal(actual.valoresApertura?.conforme, false);
  assert.equal(JSON.stringify(actual.apertura), antes);
  assert.equal(actual.estado, jornada.estado);

  assert.ok(registrarConteoValores(jornada.id, "CIERRE", 3).ok);
  assert.equal(S.jornadas.get()[0].valoresCierre?.conforme, true);
  como("ana-gomez");
  assert.equal(registrarConteoValores(jornada.id, "CIERRE", 3).ok, false); // no es responsable
});
