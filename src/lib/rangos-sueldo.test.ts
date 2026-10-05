import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_RANGOS_SUELDO, type RangoSueldoCapital } from "./config";
import { rangoSueldoDe } from "./credit";
import { getPlanes, validarPlan } from "./planes";

const rango = (desde: number, hasta: number | null, capitalMaximo: number): RangoSueldoCapital => ({
  id: `r-${desde}`,
  desde,
  hasta,
  capitalMaximo,
});

const RANGOS = [rango(0, 500_000, 1_000_000), rango(500_000, 1_000_000, 2_000_000), rango(1_000_000, null, 4_000_000)];

test("el sueldo neto cae en su rango: desde incluido, hasta excluido", () => {
  assert.equal(rangoSueldoDe(499_999, RANGOS)?.capitalMaximo, 1_000_000);
  assert.equal(rangoSueldoDe(500_000, RANGOS)?.capitalMaximo, 2_000_000);
  assert.equal(rangoSueldoDe(9_000_000, RANGOS)?.capitalMaximo, 4_000_000);
});

test("fuera de todos los rangos no hay rango", () => {
  assert.equal(rangoSueldoDe(100, [rango(200_000, 300_000, 1)]), undefined);
});

function errores(rangos: RangoSueldoCapital[]) {
  const plan = structuredClone(getPlanes()[0]);
  plan.config.rangosSueldoNeto = rangos;
  return validarPlan(plan, getPlanes());
}

test("validación: sin rangos, rangos válidos y seis como máximo", () => {
  assert.equal(errores([]).rangosSueldoNeto, undefined);
  assert.equal(errores(RANGOS).rangosSueldoNeto, undefined);
  const siete = Array.from({ length: MAX_RANGOS_SUELDO + 1 }, (_, i) => rango(i * 100, i * 100 + 100, 1));
  assert.ok(errores(siete).rangosSueldoNeto);
});

test("validación: superposición, hasta menor al desde y capital en cero", () => {
  assert.ok(errores([rango(0, 600_000, 1), rango(500_000, 900_000, 1)]).rangosSueldoNeto);
  assert.ok(errores([rango(0, null, 1), rango(500_000, 900_000, 1)]).rangosSueldoNeto);
  assert.ok(errores([rango(500_000, 400_000, 1)]).rangosSueldoNeto);
  assert.ok(errores([rango(0, 500_000, 0)]).rangosSueldoNeto);
});

test("los planes existentes no tienen rangos", () => {
  for (const r of getPlanes()) assert.deepEqual(r.config.rangosSueldoNeto, []);
});

// --- Cuota máxima por rango de sueldo ---
import { rangosCuotaIniciales, type RangoSueldoCuota } from "./config";

test("un plan arranca con 5 rangos de cuota contiguos, el último sin tope", () => {
  const r = rangosCuotaIniciales(40, 350_000);
  assert.equal(r.length, 5);
  assert.equal(r[0].desde, 0);
  assert.equal(r[4].hasta, null);
  r.slice(1).forEach((x, i) => assert.equal(x.desde, r[i].hasta));
  assert.ok(r.every((x) => x.rciPct === 40 && x.smvmBolsillo === 350_000 && x.cuotaMaxima > 0));
});

test("los planes existentes tienen 5 rangos de cuota y siguen con su endeudamiento", () => {
  for (const p of getPlanes()) {
    assert.equal(p.config.rangosCuota.length, 5);
    assert.ok(p.config.endeudamientoMaxPct > 0);
  }
});

function erroresCuota(rangos: RangoSueldoCuota[]) {
  const plan = structuredClone(getPlanes()[0]);
  plan.config.rangosCuota = rangos;
  return validarPlan(plan, getPlanes());
}
const rc = (desde: number, hasta: number | null, extra: Partial<RangoSueldoCuota> = {}): RangoSueldoCuota => ({
  id: `c-${desde}`,
  desde,
  hasta,
  smvmBolsillo: 300_000,
  rciPct: 30,
  cuotaMaxima: 200_000,
  ...extra,
});

test("validación de rangos de cuota: válidos, ilimitados en cantidad, y sus errores", () => {
  assert.equal(erroresCuota(rangosCuotaIniciales(30, 300_000)).rangosCuota, undefined);
  const muchos = Array.from({ length: 9 }, (_, i) => rc(i * 100, i * 100 + 100));
  assert.equal(erroresCuota(muchos).rangosCuota, undefined);
  assert.ok(erroresCuota([]).rangosCuota);
  assert.ok(erroresCuota([rc(0, 500_000), rc(400_000, 900_000)]).rangosCuota);
  assert.ok(erroresCuota([rc(500_000, 100_000)]).rangosCuota);
  assert.ok(erroresCuota([rc(0, 500_000, { rciPct: 0 })]).rangosCuota);
  assert.ok(erroresCuota([rc(0, 500_000, { cuotaMaxima: 0 })]).rangosCuota);
});
