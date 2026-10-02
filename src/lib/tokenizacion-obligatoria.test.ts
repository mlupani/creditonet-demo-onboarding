import { test } from "node:test";
import assert from "node:assert/strict";
import { errorTokenizacionObligatoria } from "./productos";

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
