import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import { DENOMINACIONES_INICIALES } from "./caja-datos";
import { registrarApertura } from "./caja-operaciones";
import { recuentoSugerido, saldoCaja } from "./caja-reglas";
import { cajaStores as S, fijarFechaDemo, fijarUsuarioActual, reiniciarCaja } from "./caja-store";
import {
  anularChequePropio,
  depositarCheque,
  emitirChequePropio,
  entregarCheque,
  marcarChequeCobrado,
  rechazarCheque,
  recibirChequeTercero,
  registrarConteoValores,
} from "./cheques-operaciones";
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
  assert.ok(puedeTransicionar({ origen: "PROPIO", estado: "EMITIDO" }, "COBRADO"));
  assert.equal(puedeTransicionar({ origen: "PROPIO", estado: "COBRADO" }, "ANULADO"), false);
  assert.equal(puedeTransicionar({ origen: "PROPIO", estado: "EMITIDO" }, "DEPOSITADO"), false);
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
  assert.equal(marcarChequeCobrado("CHE-0005").ok, false);
  como("marta-diaz");
  assert.equal(anularChequePropio("CHE-0005", "").ok, false);
  assert.ok(anularChequePropio("CHE-0005", "Error de carga").ok);
  assert.equal(marcarChequeCobrado("CHE-0005").ok, false); // ya anulado
  // El número anulado sigue consumido: el próximo no lo reutiliza.
  const r = emitirChequePropio({ ...emision, cuentaId: "CB-001", chequeraId: "CHQ-001" });
  assert.ok(r.ok && r.cheque.numero === "10002");
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
