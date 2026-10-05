import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularCuota,
  capitalDesdeCuota,
  cargoDeCuota,
  cronogramaCuotas,
  totalAPagarDe,
} from "./credit";
import { normalizarCargos, type CargoPeriodico, type CargosPlan } from "./config";

const cargo = (c: Partial<CargoPeriodico>): CargoPeriodico => ({
  id: "x",
  nombre: "Cargo",
  servicioId: null,
  tipo: "MONTO_FIJO",
  valor: 0,
  conIva: true,
  ...c,
});
const plan = (cargos: CargoPeriodico[], ivaPct = 21): CargosPlan => ({ cargos, ivaPct });

const pct = plan([cargo({ tipo: "PORCENTAJE_CUOTA", valor: 5 })]);
const fijo = plan([cargo({ tipo: "MONTO_FIJO", valor: 2_000 })]);
const sobreCapital = plan([cargo({ tipo: "PORCENTAJE_CAPITAL", valor: 0.1 })]);
const varios = plan([
  cargo({ tipo: "PORCENTAJE_CUOTA", valor: 2 }),
  cargo({ tipo: "MONTO_FIJO", valor: 1_000, conIva: false }),
  cargo({ tipo: "PORCENTAJE_CAPITAL", valor: 0.05, conIva: false }),
]);

test("cargoDeCuota: porcentaje de la cuota, monto fijo o porcentaje del capital", () => {
  assert.equal(cargoDeCuota(100_000, 1_000_000, pct), 5_000);
  assert.equal(cargoDeCuota(100_000, 1_000_000, fijo), 2_000);
  assert.equal(cargoDeCuota(100_000, 1_000_000, sobreCapital), 1_000);
  assert.equal(cargoDeCuota(100_000, 1_000_000, null), 0);
});

test("cargoDeCuota: suma varios cargos y agrega el IVA a los que son sin IVA", () => {
  // 2 % de 100.000 (con IVA) + 1.000 × 1,21 + 0,05 % de 1.000.000 × 1,21
  assert.ok(Math.abs(cargoDeCuota(100_000, 1_000_000, varios) - (2_000 + 1_210 + 605)) < 1e-6);
  // Un plan que no calcula IVA no lo suma.
  assert.equal(cargoDeCuota(0, 0, plan(varios.cargos, 0)), 1_000);
});

test("el cargo va dentro de la cuota", () => {
  const base = calcularCuota(1_000_000, 12, 60, "FRANCES_FIJA");
  const conPct = calcularCuota(1_000_000, 12, 60, "FRANCES_FIJA", null, pct);
  const conFijo = calcularCuota(1_000_000, 12, 60, "FRANCES_FIJA", null, fijo);
  const conCapital = calcularCuota(1_000_000, 12, 60, "FRANCES_FIJA", null, sobreCapital);
  assert.ok(Math.abs(conPct - base * 1.05) <= 100);
  assert.ok(Math.abs(conFijo - (base + 2_000)) <= 100);
  assert.ok(Math.abs(conCapital - (base + 1_000)) <= 100);
});

test("el porcentaje se aplica sobre la cuota con el gasto distribuido incluido", () => {
  const gasto = { tipo: "PORCENTAJE", valor: 3, tratamiento: "DISTRIBUYE_CUOTAS" } as const;
  const sin = cronogramaCuotas(1_000_000, 12, 60, "FRANCES_FIJA", gasto)[0];
  const con = cronogramaCuotas(1_000_000, 12, 60, "FRANCES_FIJA", gasto, pct)[0];
  assert.ok(Math.abs(con.cargo - sin.cuota * 0.05) < 1e-6);
  assert.ok(Math.abs(con.cuota - sin.cuota * 1.05) < 1e-6);
});

test("total a pagar suma el cargo de todas las cuotas", () => {
  const cuota = calcularCuota(1_000_000, 12, 60, "FRANCES_FIJA", null, fijo);
  assert.equal(totalAPagarDe(1_000_000, 12, 60, cuota, "FRANCES_FIJA", null, fijo), cuota * 12);
  const americano = calcularCuota(1_000_000, 12, 60, "AMERICANO", null, fijo);
  assert.equal(totalAPagarDe(1_000_000, 12, 60, americano, "AMERICANO", null, fijo), americano * 12 + 1_000_000);
});

test("capitalDesdeCuota invierte calcularCuota con los cargos (sin pasarse de la cuota)", () => {
  const gastos = [
    null,
    { tipo: "PORCENTAJE", valor: 3, tratamiento: "DISTRIBUYE_CUOTAS" },
    { tipo: "PORCENTAJE", valor: 3, tratamiento: "CAPITALIZA" },
  ] as const;
  for (const cargos of [pct, fijo, sobreCapital, varios]) {
    for (const sistema of ["FRANCES_FIJA", "TASA_DIRECTA", "ALEMAN"] as const) {
      for (const gasto of gastos) {
        const cuotaMax = 150_000;
        const capital = capitalDesdeCuota(cuotaMax, 24, 60, sistema, gasto, cargos);
        assert.ok(capital > 0);
        assert.ok(calcularCuota(capital, 24, 60, sistema, gasto, cargos) <= cuotaMax + 100, sistema);
        // Un escalón más de capital ya se pasa de la cuota.
        assert.ok(calcularCuota(capital + 10_000, 24, 60, sistema, gasto, cargos) > cuotaMax - 100, sistema);
      }
    }
  }
});

test("compatibilidad: el cargo administrativo único pasa a la lista de cargos", () => {
  const [c] = normalizarCargos({ cargoAdministrativoPct: 4 });
  assert.equal(c.tipo, "PORCENTAJE_CUOTA");
  assert.equal(c.valor, 4);
  assert.equal(c.conIva, true);
  assert.deepEqual(normalizarCargos({ cargoAdministrativo: { tipo: "MONTO_FIJO", valor: 2_000 } })[0].tipo, "MONTO_FIJO");
  assert.deepEqual(normalizarCargos({}), []);
  const existentes = [cargo({})];
  assert.equal(normalizarCargos({ cargos: existentes }), existentes);
});
