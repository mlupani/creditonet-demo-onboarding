import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularCuota,
  capitalDesdeCuota,
  cronogramaCuotas,
  cuotaEsVariable,
  totalAPagarDe,
} from "./credit";
import { AJUSTE_CUOTA_VARIABLE_PCT, migrarSistemaAmortizacion, SISTEMAS_AMORTIZACION } from "./config";

const MONTO = 1_200_000;
const PLAZO = 12;
const TNA = 60; // 5 % mensual

const suma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const cerca = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);

test("el selector ofrece los cinco sistemas", () => {
  assert.deepEqual(
    SISTEMAS_AMORTIZACION.map((s) => s.value),
    ["FRANCES_FIJA", "FRANCES_VARIABLE", "AMERICANO", "TASA_DIRECTA", "ALEMAN"]
  );
});

test("francés cuota fija: cuota constante que amortiza todo el capital", () => {
  const c = cronogramaCuotas(MONTO, PLAZO, TNA, "FRANCES_FIJA");
  assert.equal(c.length, PLAZO);
  for (const f of c) assert.ok(Math.abs(f.cuota - c[0].cuota) < 1e-6);
  assert.ok(Math.abs(suma(c.map((f) => f.capital)) - MONTO) < 1e-6);
  assert.ok(Math.abs(c[PLAZO - 1].saldo) < 1e-6);
  assert.equal(calcularCuota(MONTO, PLAZO, TNA, "FRANCES_FIJA"), 135_400);
  assert.equal(totalAPagarDe(MONTO, PLAZO, TNA, 135_400, "FRANCES_FIJA"), 135_400 * PLAZO);
  assert.equal(capitalDesdeCuota(135_400, PLAZO, TNA, "FRANCES_FIJA"), 1_200_000);
});

test("francés cuota variable: arranca como el francés y la cuota se ajusta cada período", () => {
  const fija = cronogramaCuotas(MONTO, PLAZO, TNA, "FRANCES_FIJA");
  const c = cronogramaCuotas(MONTO, PLAZO, TNA, "FRANCES_VARIABLE");
  const g = 1 + AJUSTE_CUOTA_VARIABLE_PCT / 100;
  assert.ok(Math.abs(c[0].cuota - fija[0].cuota) < 1e-6);
  for (let n = 1; n < PLAZO; n++) assert.ok(Math.abs(c[n].cuota / c[n - 1].cuota - g) < 1e-9);
  assert.equal(calcularCuota(MONTO, PLAZO, TNA, "FRANCES_VARIABLE"), 135_400);
  const total = totalAPagarDe(MONTO, PLAZO, TNA, 135_400, "FRANCES_VARIABLE");
  assert.equal(total, Math.round(suma(c.map((f) => f.cuota)) / 100) * 100);
  assert.ok(total > 135_400 * PLAZO);
  assert.equal(capitalDesdeCuota(135_400, PLAZO, TNA, "FRANCES_VARIABLE"), 1_200_000);
});

test("americano: sólo interés y el capital en la última cuota", () => {
  const c = cronogramaCuotas(MONTO, PLAZO, TNA, "AMERICANO");
  cerca(c[0].cuota, 60_000);
  cerca(c[0].capital, 0);
  cerca(c[PLAZO - 1].capital, MONTO);
  assert.equal(calcularCuota(MONTO, PLAZO, TNA, "AMERICANO"), 60_000);
  assert.equal(totalAPagarDe(MONTO, PLAZO, TNA, 60_000, "AMERICANO"), 60_000 * PLAZO + MONTO);
  assert.equal(capitalDesdeCuota(60_000, PLAZO, TNA, "AMERICANO"), 1_200_000);
});

test("tasa directa: interés sobre el capital original durante todo el plazo", () => {
  const c = cronogramaCuotas(MONTO, PLAZO, TNA, "TASA_DIRECTA");
  for (const f of c) {
    cerca(f.capital, 100_000);
    cerca(f.interes, 60_000);
  }
  assert.equal(calcularCuota(MONTO, PLAZO, TNA, "TASA_DIRECTA"), 160_000);
  assert.equal(totalAPagarDe(MONTO, PLAZO, TNA, 160_000, "TASA_DIRECTA"), 1_920_000);
  assert.equal(capitalDesdeCuota(160_000, PLAZO, TNA, "TASA_DIRECTA"), 1_200_000);
});

test("alemán: capital constante, interés sobre saldo y cuota decreciente", () => {
  const c = cronogramaCuotas(MONTO, PLAZO, TNA, "ALEMAN");
  for (const f of c) cerca(f.capital, 100_000);
  cerca(c[0].interes, 60_000);
  cerca(c[1].interes, 55_000);
  cerca(c[PLAZO - 1].cuota, 105_000);
  for (let n = 1; n < PLAZO; n++) assert.ok(c[n].cuota < c[n - 1].cuota);
  // La cuota que informa la oferta es la primera (la más alta).
  assert.equal(calcularCuota(MONTO, PLAZO, TNA, "ALEMAN"), 160_000);
  // Interés total = monto · i · (n + 1) / 2 = 1.200.000 · 0,05 · 6,5
  assert.equal(totalAPagarDe(MONTO, PLAZO, TNA, 160_000, "ALEMAN"), 1_590_000);
  assert.equal(capitalDesdeCuota(160_000, PLAZO, TNA, "ALEMAN"), 1_200_000);
});

test("cuotaEsVariable distingue los sistemas sin cuota constante", () => {
  assert.equal(cuotaEsVariable("FRANCES_FIJA"), false);
  assert.equal(cuotaEsVariable("TASA_DIRECTA"), false);
  assert.equal(cuotaEsVariable("FRANCES_VARIABLE"), true);
  assert.equal(cuotaEsVariable("ALEMAN"), true);
  assert.equal(cuotaEsVariable("AMERICANO"), true);
});

test("migración: los planes guardados con FRANCES pasan a francés cuota fija", () => {
  assert.equal(migrarSistemaAmortizacion("FRANCES"), "FRANCES_FIJA");
  assert.equal(migrarSistemaAmortizacion("ALEMAN"), "ALEMAN");
  assert.equal(migrarSistemaAmortizacion("CUALQUIERA"), "FRANCES_FIJA");
});
