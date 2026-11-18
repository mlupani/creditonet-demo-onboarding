import { test } from "node:test";
import assert from "node:assert/strict";

import { esGrupo, menuVisible, pantallaActiva, pantallas, primeraPantalla, type MenuEntrada } from "./navegacion";

const etiquetas = (items: readonly MenuEntrada[]) => items.map((i) => i.label);

test("el superior ve los siete módulos del árbol más el diagrama de la demo", () => {
  assert.deepEqual(etiquetas(menuVisible("superior")), [
    "Créditos",
    "Onboarding",
    "Parámetros",
    "Usuarios y accesos",
    "Caja y Bancos",
    "Contable",
    "Reportes",
    "Diagrama de flujo",
  ]);
});

test("un rol sin pantallas en un módulo no ve ese módulo ni los 'próximamente'", () => {
  const venta = menuVisible("venta");
  assert.deepEqual(etiquetas(venta), ["Créditos", "Diagrama de flujo"]);
  const creditos = venta[0];
  assert.ok(esGrupo(creditos));
  assert.deepEqual(etiquetas(creditos.children), ["Solicitar crédito", "Bandejas"]);
});

test("el analista ve sólo las solapas de Parámetros que existen en la demo", () => {
  const parametros = menuVisible("analista").find((e) => e.label === "Parámetros");
  assert.ok(parametros && esGrupo(parametros));
  const hojas = pantallas(parametros.children).map((p) => p.solapa);
  assert.deepEqual(hojas.sort(), ["impositivos", "motivos", "provincias", "servicios"]);
});

test("la pantalla activa respeta la ruta más larga y la solapa", () => {
  assert.equal(pantallaActiva("/", null)?.label, "Solicitudes");
  assert.equal(pantallaActiva("/productos/abc", null)?.label, "Producto");
  assert.equal(pantallaActiva("/parametros", "servicios")?.label, "Cargos/servicios");
  assert.equal(pantallaActiva("/parametros", "inexistente")?.label, "Motivos de observación");
  assert.equal(pantallaActiva("/ruta-desconocida", null), undefined);
});

test("un módulo sin pantallas no tiene primera pantalla", () => {
  const onboarding = menuVisible("superior").find((e) => e.label === "Onboarding");
  assert.ok(onboarding);
  assert.equal(primeraPantalla(onboarding), undefined);
});
