import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularCuota,
  capitalDesdeCuota,
  cargoDeCuota,
  cronogramaCuotas,
  totalAPagarDe,
} from "./credit";
import { normalizarCargo, type CargoAdministrativo } from "./config";

const pct: CargoAdministrativo = { tipo: "PORCENTAJE", valor: 5 };
const fijo: CargoAdministrativo = { tipo: "MONTO_FIJO", valor: 2_000 };

test("cargoDeCuota: porcentaje de la cuota o monto fijo", () => {
  assert.equal(cargoDeCuota(100_000, pct), 5_000);
  assert.equal(cargoDeCuota(100_000, fijo), 2_000);
  assert.equal(cargoDeCuota(100_000, null), 0);
});

test("el cargo va dentro de la cuota", () => {
  const base = calcularCuota(1_000_000, 12, 60, "FRANCES_FIJA");
  const conPct = calcularCuota(1_000_000, 12, 60, "FRANCES_FIJA", null, pct);
  const conFijo = calcularCuota(1_000_000, 12, 60, "FRANCES_FIJA", null, fijo);
  assert.ok(Math.abs(conPct - base * 1.05) <= 100);
  assert.ok(Math.abs(conFijo - (base + 2_000)) <= 100);
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

test("capitalDesdeCuota invierte calcularCuota con el cargo (sin pasarse de la cuota)", () => {
  for (const cargo of [pct, fijo]) {
    for (const sistema of ["FRANCES_FIJA", "TASA_DIRECTA", "ALEMAN"] as const) {
      const cuotaMax = 150_000;
      const capital = capitalDesdeCuota(cuotaMax, 24, 60, sistema, null, cargo);
      assert.ok(capital > 0);
      assert.ok(calcularCuota(capital, 24, 60, sistema, null, cargo) <= cuotaMax + 100, `${sistema} ${cargo.tipo}`);
    }
  }
});

test("compatibilidad: cargoAdministrativoPct pasa a porcentaje de la cuota", () => {
  assert.deepEqual(normalizarCargo({ cargoAdministrativoPct: 4 }), { tipo: "PORCENTAJE", valor: 4 });
  assert.deepEqual(normalizarCargo({ cargoAdministrativo: fijo }), fijo);
  assert.deepEqual(normalizarCargo({}), { tipo: "PORCENTAJE", valor: 0 });
});
