import { test } from "node:test";
import assert from "node:assert/strict";
import { asignadasDe, efectivasDe, quitadasDe, marcarExcepcion } from "./productos";

const base = { asignadas: ["a", "b", "c"] };

test("sin excepciones, las efectivas son todas las asignadas", () => {
  assert.deepEqual(quitadasDe(base), []);
  assert.deepEqual(efectivasDe(base), ["a", "b", "c"]);
});

test("quitar como excepción no elimina la asignación y la saca de las efectivas", () => {
  const n = marcarExcepcion(base, "b", true);
  assert.deepEqual(asignadasDe(n), ["a", "b", "c"]);
  assert.deepEqual(quitadasDe(n), ["b"]);
  assert.deepEqual(efectivasDe(n), ["a", "c"]);
});

test("la excepción es reversible", () => {
  const n = marcarExcepcion(marcarExcepcion(base, "b", true), "b", false);
  assert.deepEqual(quitadasDe(n), []);
  assert.deepEqual(efectivasDe(n), ["a", "b", "c"]);
});

test("marcar dos veces no duplica y no muta el original", () => {
  const n = marcarExcepcion(marcarExcepcion(base, "a", true), "a", true);
  assert.deepEqual(quitadasDe(n), ["a"]);
  assert.deepEqual(base, { asignadas: ["a", "b", "c"] });
});

test("una excepción sobre algo no asignado no afecta a las efectivas", () => {
  assert.deepEqual(efectivasDe({ asignadas: ["a"], excepciones: ["z"] }), ["a"]);
});

test("formato anterior (sin lista ni excepciones)", () => {
  assert.deepEqual(efectivasDe(undefined), []);
  assert.deepEqual(efectivasDe({} as never), []);
});
