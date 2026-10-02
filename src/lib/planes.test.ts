import { test } from "node:test";
import assert from "node:assert/strict";
import { ORGANISMOS, PLANES_CUOTAS, planOfrecible, planesDelOrganismo } from "./config";
import {
  asignarPlanesAOrganismo,
  cambiarEstadoPlan,
  crearPlan,
  getPlanes,
  guardarPlan,
} from "./planes";

const estadoDe = (id: string) => getPlanes().find((r) => r.config.id === id)?.config.estado;

test("los planes existentes conservan su estado", () => {
  const previos = getPlanes().filter((r) => r.config.estado === "ACTIVO");
  assert.ok(previos.length > 0);
  crearPlan({ nombre: "Plan de prueba conserva", copiarDeId: null });
  for (const r of previos) assert.equal(estadoDe(r.config.id), "ACTIVO");
});

test("un plan nuevo se crea en BORRADOR y no se ofrece", () => {
  const id = crearPlan({ nombre: "Plan de prueba borrador", copiarDeId: null });
  assert.equal(estadoDe(id), "BORRADOR");
  assert.equal(planOfrecible(PLANES_CUOTAS[id]), false);

  // Ni siquiera vinculado a un organismo llega a las solicitudes.
  const organismo = ORGANISMOS[0].id;
  asignarPlanesAOrganismo(organismo, [...ORGANISMOS[0].planes, id]);
  assert.ok(ORGANISMOS[0].planes.includes(id));
  assert.ok(!planesDelOrganismo(organismo).some((p) => p.id === id));
  asignarPlanesAOrganismo(
    organismo,
    ORGANISMOS[0].planes.filter((p) => p !== id)
  );
});

test("activar pasa el borrador a ACTIVO y lo deja ofrecible", () => {
  const id = crearPlan({ nombre: "Plan de prueba activar", copiarDeId: null });
  assert.deepEqual(cambiarEstadoPlan(id, "ACTIVO"), { ok: true });
  assert.equal(estadoDe(id), "ACTIVO");
  assert.equal(planOfrecible(PLANES_CUOTAS[id]), true);
});

test("activar valida el plan: un borrador inválido sigue en BORRADOR", () => {
  const id = crearPlan({ nombre: "Plan de prueba inválido", copiarDeId: null });
  const registro = getPlanes().find((r) => r.config.id === id)!;
  guardarPlan({ ...registro, config: { ...registro.config, grilla: [] } });

  const r = cambiarEstadoPlan(id, "ACTIVO");
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /grilla/i);
  assert.equal(estadoDe(id), "BORRADOR");
});

test("activar un plan inexistente devuelve error", () => {
  const r = cambiarEstadoPlan("no-existe", "ACTIVO");
  assert.equal(r.ok, false);
});
