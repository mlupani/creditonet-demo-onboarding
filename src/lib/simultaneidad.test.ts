import { test } from "node:test";
import assert from "node:assert/strict";
import { bloqueaSimultaneidad, creditoSimultaneoEnOtroCanal } from "./simultaneidad";
import type { EstadoCredito } from "./types";

type C = Parameters<typeof creditoSimultaneoEnOtroCanal>[0][number];

const credito = (estado: EstadoCredito, canalId = "digital", numeroCredito = "CR-000001"): C =>
  ({ numeroCredito, estado, cliente: { dni: "30.111.222" }, configuracion: { canalId } }) as C;

test("un crédito vivo en otro canal bloquea al cliente", () => {
  const vivo = credito("EN_TRAMITE");
  assert.equal(creditoSimultaneoEnOtroCanal([vivo], "30111222", "sucursal", null), vivo);
});

test("un crédito Anulado deja de bloquear al cliente en otro canal", () => {
  const anulado = credito("ANULADO");
  assert.equal(creditoSimultaneoEnOtroCanal([anulado], "30111222", "sucursal", null), undefined);
});

test("pasar de vivo a Anulado libera la validación", () => {
  assert.ok(creditoSimultaneoEnOtroCanal([credito("PREAPROBADO")], "30111222", "sucursal", null));
  assert.equal(creditoSimultaneoEnOtroCanal([credito("ANULADO")], "30111222", "sucursal", null), undefined);
});

test("sólo bloquean los créditos en trámite: anulados, rechazados y activos no", () => {
  assert.equal(bloqueaSimultaneidad("EN_TRAMITE"), true);
  assert.equal(bloqueaSimultaneidad("EN_FIRMA"), true);
  for (const e of ["ANULADO", "RECHAZADO", "ACTIVO"] as const) assert.equal(bloqueaSimultaneidad(e), false);
});

test("el mismo canal, otro cliente o la propia solicitud no bloquean", () => {
  assert.equal(creditoSimultaneoEnOtroCanal([credito("EN_TRAMITE", "sucursal")], "30111222", "sucursal", null), undefined);
  assert.equal(creditoSimultaneoEnOtroCanal([credito("EN_TRAMITE")], "20999888", "sucursal", null), undefined);
  assert.equal(creditoSimultaneoEnOtroCanal([credito("EN_TRAMITE")], "30111222", "sucursal", "CR-000001"), undefined);
});
