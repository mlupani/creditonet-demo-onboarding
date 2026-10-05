import { test } from "node:test";
import assert from "node:assert/strict";
import { plazosDeFila, terminosDe, type FilaGrilla } from "./config";

const fila = (f: Partial<FilaGrilla>): FilaGrilla => ({
  plazo: 12,
  tna: 60,
  recomendada: false,
  primeraCuota: "10/10/2026",
  ...f,
});

test("plazo exacto: sólo esa cantidad de cuotas", () => {
  assert.deepEqual(plazosDeFila(fila({ plazo: 24 })), [24]);
  assert.deepEqual(plazosDeFila(fila({ plazo: 24, modo: "EXACTO", plazoHasta: 36 })), [24]);
});

test("rango corrido: todas las cuotas de desde a hasta", () => {
  assert.deepEqual(plazosDeFila(fila({ plazo: 12, modo: "CORRIDO", plazoHasta: 15 })), [12, 13, 14, 15]);
});

test("rango con 'cada': un plazo cada tantas cuotas y siempre entra el último", () => {
  assert.deepEqual(plazosDeFila(fila({ plazo: 12, modo: "CORRIDO", plazoHasta: 36, cada: 12 })), [12, 24, 36]);
  assert.deepEqual(plazosDeFila(fila({ plazo: 12, modo: "CORRIDO", plazoHasta: 20, cada: 6 })), [12, 18, 20]);
});

test("terminosDe expande los rangos con su TNA, ordena y marca la recomendada en el primer plazo", () => {
  const t = terminosDe([
    fila({ plazo: 36, tna: 72 }),
    fila({ plazo: 12, modo: "CORRIDO", plazoHasta: 14, tna: 58, recomendada: true }),
  ]);
  assert.deepEqual(t.map((x) => [x.plazo, x.tna, x.recomendada]), [
    [12, 58, true],
    [13, 58, false],
    [14, 58, false],
    [36, 72, false],
  ]);
});
