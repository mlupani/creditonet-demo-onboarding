import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarGasto, type GastoOtorgamiento } from "./config";
import { calcularCuota, capitalDesdeCuota, gastoDeOtorgamiento, totalAPagarDe } from "./credit";

const pct = (tratamiento: GastoOtorgamiento["tratamiento"], valor = 10): GastoOtorgamiento => ({
  tipo: "PORCENTAJE",
  valor,
  tratamiento,
});
const fijo = (tratamiento: GastoOtorgamiento["tratamiento"], valor = 120_000): GastoOtorgamiento => ({
  tipo: "MONTO_FIJO",
  valor,
  tratamiento,
});

test("compatibilidad: seCapitaliza true pasa a 'se capitaliza' y false a 'se distribuye'", () => {
  const base = { tipo: "PORCENTAJE" as const, valor: 3 };
  assert.equal(normalizarGasto({ ...base, seCapitaliza: true }).tratamiento, "CAPITALIZA");
  assert.equal(normalizarGasto({ ...base, seCapitaliza: false }).tratamiento, "DISTRIBUYE_CUOTAS");
  const nuevo = normalizarGasto({ ...base, tratamiento: "CAPITALIZA" });
  assert.equal(nuevo.tratamiento, "CAPITALIZA");
  assert.ok(!("seCapitaliza" in nuevo));
});

test("importe del gasto: porcentaje del capital o monto fijo", () => {
  assert.equal(gastoDeOtorgamiento(1_000_000, pct("CAPITALIZA")), 100_000);
  assert.equal(gastoDeOtorgamiento(1_000_000, fijo("CAPITALIZA")), 120_000);
});

test("sin gasto la cuota no cambia", () => {
  assert.equal(
    calcularCuota(1_000_000, 12, 60, "FRANCES", pct("CAPITALIZA", 0)),
    calcularCuota(1_000_000, 12, 60, "FRANCES")
  );
});

test("se capitaliza: el gasto se suma al capital financiado", () => {
  const cuota = calcularCuota(1_000_000, 12, 60, "FRANCES", pct("CAPITALIZA"));
  assert.equal(cuota, calcularCuota(1_100_000, 12, 60, "FRANCES"));
});

test("se distribuye: el gasto se reparte en partes iguales sobre cada cuota", () => {
  const cuota = calcularCuota(1_000_000, 10, 60, "TASA_DIRECTA", fijo("DISTRIBUYE_CUOTAS", 100_000));
  assert.equal(cuota, calcularCuota(1_000_000, 10, 60, "TASA_DIRECTA") + 10_000);
});

test("capitalizar cuesta más intereses que distribuir en el sistema francés", () => {
  const capitaliza = calcularCuota(1_000_000, 24, 60, "FRANCES", pct("CAPITALIZA"));
  const distribuye = calcularCuota(1_000_000, 24, 60, "FRANCES", pct("DISTRIBUYE_CUOTAS"));
  assert.ok(capitaliza > distribuye);
});

test("total a pagar: americano devuelve el capital financiado en la última cuota", () => {
  const g = pct("CAPITALIZA");
  const cuota = calcularCuota(1_000_000, 12, 60, "AMERICANO", g);
  assert.equal(totalAPagarDe(1_000_000, 12, cuota, "AMERICANO", g), cuota * 12 + 1_100_000);
  const d = pct("DISTRIBUYE_CUOTAS");
  const cuotaD = calcularCuota(1_000_000, 12, 60, "AMERICANO", d);
  assert.equal(totalAPagarDe(1_000_000, 12, cuotaD, "AMERICANO", d), cuotaD * 12 + 1_000_000);
});

test("capitalDesdeCuota invierte calcularCuota con el gasto (sin pasarse de la cuota)", () => {
  for (const sistema of ["FRANCES", "AMERICANO", "TASA_DIRECTA"] as const) {
    for (const g of [
      pct("CAPITALIZA"),
      pct("DISTRIBUYE_CUOTAS"),
      fijo("CAPITALIZA"),
      fijo("DISTRIBUYE_CUOTAS"),
    ]) {
      const cuotaMax = 150_000;
      const capital = capitalDesdeCuota(cuotaMax, 24, 60, sistema, g);
      assert.ok(capital > 0, `${sistema} ${g.tipo} ${g.tratamiento}`);
      assert.ok(
        calcularCuota(capital, 24, 60, sistema, g) <= cuotaMax + 50,
        `${sistema} ${g.tipo} ${g.tratamiento}: la cuota supera el máximo`
      );
    }
  }
});
