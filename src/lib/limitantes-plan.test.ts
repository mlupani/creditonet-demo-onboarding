import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarLimitantes } from "./config";
import { getPlanes, validarPlan } from "./planes";

const VIEJO = {
  clienteNuevoPct: 50,
  clienteExistentePct: 0,
  condicionLaboralPct: { Contratado: 30 },
  situacionBcraDistintaDeUnoPct: 25,
};

test("migración: el recorte BCRA viejo pasa a las situaciones 2 a 5 habilitadas", () => {
  const l = normalizarLimitantes(VIEJO, [1, 2, 3]);
  assert.deepEqual(l.bcra, { situaciones: [2, 3], pct: 25 });
  assert.deepEqual(l.buroInterno, { perfiles: [], pct: 0 });
  assert.equal(l.sueldoRecalculadoPct, 0);
  assert.ok(!("situacionBcraDistintaDeUnoPct" in l));
});

test("migración: se descartan los recortes por tipo de cliente y condición laboral", () => {
  const l = normalizarLimitantes(VIEJO, [1, 2, 3, 4, 5]);
  assert.deepEqual(Object.keys(l).sort(), ["bcra", "buroInterno", "sueldoRecalculadoPct"]);
});

test("un limitante ya migrado no se pisa", () => {
  const nuevo = {
    ...VIEJO,
    bcra: { situaciones: [5], pct: 60 },
    buroInterno: { perfiles: [4], pct: 20 },
    sueldoRecalculadoPct: 10,
  };
  const l = normalizarLimitantes(nuevo, [1, 2, 3, 4, 5]);
  assert.deepEqual(l.bcra, { situaciones: [5], pct: 60 });
  assert.deepEqual(l.buroInterno, { perfiles: [4], pct: 20 });
  assert.equal(l.sueldoRecalculadoPct, 10);
});

test("los planes existentes conservan el recorte BCRA sobre las situaciones distintas de 1", () => {
  for (const p of getPlanes()) {
    assert.ok(p.config.limitantes.bcra.pct > 0);
    assert.ok(!p.config.limitantes.bcra.situaciones.includes(1));
  }
});

test("validación: los recortes nuevos van de 0 a 100 %", () => {
  const plan = structuredClone(getPlanes()[0]);
  assert.equal(validarPlan(plan, getPlanes()).limitantes, undefined);
  plan.config.limitantes.buroInterno.pct = 120;
  assert.ok(validarPlan(plan, getPlanes()).limitantes);
  plan.config.limitantes.buroInterno.pct = 10;
  plan.config.limitantes.sueldoRecalculadoPct = -1;
  assert.ok(validarPlan(plan, getPlanes()).limitantes);
});
