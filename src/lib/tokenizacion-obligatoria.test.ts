import { test } from "node:test";
import assert from "node:assert/strict";
import { errorTokenizacionObligatoria } from "./productos";
import { minimoTokenizacion } from "./config";

const bloque = (proveedorId: string, minimo: number, maximo = 2) => ({ proveedorId, minimo, maximo });

test("sin proveedores asignados no alcanza", () => {
  assert.match(errorTokenizacionObligatoria({ proveedores: [] }) ?? "", /proveedor/i);
});

test("con proveedor pero mínimo 0 en todos, no alcanza", () => {
  const t = { proveedores: [bloque("proveedor-a", 0), bloque("proveedor-b", 0)] };
  assert.match(errorTokenizacionObligatoria(t) ?? "", /al menos una tarjeta/i);
});

test("un proveedor con mínimo 1 es válido", () => {
  assert.equal(errorTokenizacionObligatoria({ proveedores: [bloque("proveedor-a", 1)] }), null);
});

test("alcanza con que un solo proveedor pida una tarjeta", () => {
  const t = { proveedores: [bloque("proveedor-a", 0), bloque("proveedor-b", 1)] };
  assert.equal(errorTokenizacionObligatoria(t), null);
});

test("opcional: no exige mínimo, pero sí un proveedor asignado", () => {
  const t = { proveedores: [bloque("proveedor-a", 0)], obligatoria: false };
  assert.equal(errorTokenizacionObligatoria(t), null);
  assert.match(errorTokenizacionObligatoria({ proveedores: [], obligatoria: false }) ?? "", /proveedor/i);
});

test("obligatoria explícita mantiene la validación de mínimo ≥ 1", () => {
  const t = { proveedores: [bloque("proveedor-a", 0)], obligatoria: true };
  assert.match(errorTokenizacionObligatoria(t) ?? "", /al menos una tarjeta/i);
});

test("minimoTokenizacion: opcional vale 0; obligatoria (o sin definir) respeta el mínimo", () => {
  const b = bloque("proveedor-a", 2);
  assert.equal(minimoTokenizacion({ proveedores: [b], obligatoria: false }, b), 0);
  assert.equal(minimoTokenizacion({ proveedores: [b], obligatoria: true }, b), 2);
  assert.equal(minimoTokenizacion({ proveedores: [b] }, b), 2);
});
