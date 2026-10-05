import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

// localStorage mínimo para correr el store fuera del navegador.
const datos = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
  },
});

import {
  SIDEBAR_COLAPSADO_KEY,
  alternarSidebarColapsado,
  leerSidebarColapsado,
  recargarSidebarColapsado,
} from "./sidebar-colapsado";

beforeEach(() => {
  datos.clear();
  recargarSidebarColapsado();
});

test("por defecto el sidebar está expandido", () => {
  assert.equal(leerSidebarColapsado(), false);
});

test("alternar colapsa y persiste el estado", () => {
  alternarSidebarColapsado();
  assert.equal(leerSidebarColapsado(), true);
  assert.equal(datos.get(SIDEBAR_COLAPSADO_KEY), "1");
});

test("alternar dos veces vuelve a expandir", () => {
  alternarSidebarColapsado();
  alternarSidebarColapsado();
  assert.equal(leerSidebarColapsado(), false);
  assert.equal(datos.get(SIDEBAR_COLAPSADO_KEY), "0");
});

test("recupera el estado guardado entre navegaciones", () => {
  datos.set(SIDEBAR_COLAPSADO_KEY, "1");
  recargarSidebarColapsado();
  assert.equal(leerSidebarColapsado(), true);
});

test("el menú de secciones persiste con su propia clave", async () => {
  const { NAV_SECCIONES_COLAPSADO_KEY, alternarNavSeccionesColapsado, leerNavSeccionesColapsado } =
    await import("./sidebar-colapsado");
  alternarNavSeccionesColapsado();
  assert.equal(leerNavSeccionesColapsado(), true);
  assert.equal(datos.get(NAV_SECCIONES_COLAPSADO_KEY), "1");
  assert.equal(leerSidebarColapsado(), false);
});
