import { test } from "node:test";
import assert from "node:assert/strict";
import { getProductos } from "./productos";
import type { VistaOrganismo } from "./organismos";
import { aplicarProductoVirtual, productoVirtual } from "./organismo-virtual";

const p = getProductos()[0];
const vacio = {
  codigo: "X",
  config: { overrides: {}, motor: null, canales: null },
  excepciones: {},
} as unknown as VistaOrganismo;

test("sin cambios, el producto virtual no genera excepciones", () => {
  const o = aplicarProductoVirtual(vacio, p, productoVirtual(vacio, p));
  assert.deepEqual(o.config.overrides, {});
  assert.deepEqual(o.excepciones, {});
  assert.equal(o.config.canales, null);
});

test("lo que se cambia queda como excepción y volver al valor del producto la descarta", () => {
  const v = productoVirtual(vacio, p);
  const pantalla = v.config.onboarding.pantallas[0];
  const cambiado = {
    ...v,
    config: {
      ...v.config,
      onboarding: {
        ...v.config.onboarding,
        navegacion: v.config.onboarding.navegacion === "LIBRE" ? ("SECUENCIAL" as const) : ("LIBRE" as const),
        pantallas: v.config.onboarding.pantallas.map((x) => (x.id === pantalla.id ? { ...x, visible: !x.visible } : x)),
      },
    },
    extras: { ...v.extras, diaCorte: v.extras.diaCorte + 1 },
  };
  const o = aplicarProductoVirtual(vacio, p, cambiado);
  assert.equal(o.config.overrides.navegacion, cambiado.config.onboarding.navegacion);
  assert.deepEqual(o.config.overrides.pantallas, { [pantalla.id]: { visible: !pantalla.visible } });
  assert.deepEqual(o.excepciones, { diaCorte: p.extras.diaCorte + 1 });

  const deVuelta = aplicarProductoVirtual(o, p, productoVirtual(vacio, p));
  assert.deepEqual(deVuelta.config.overrides, {});
  assert.deepEqual(deVuelta.excepciones, {});
});

test("los campos quitados y el capital máximo se conservan al editar el onboarding", () => {
  const o = { ...vacio, config: { ...vacio.config, overrides: { camposQuitados: ["x"], capitalMaximo: 5 } } };
  const r = aplicarProductoVirtual(o, p, productoVirtual(o, p));
  assert.deepEqual(r.config.overrides, { camposQuitados: ["x"], capitalMaximo: 5 });
});
