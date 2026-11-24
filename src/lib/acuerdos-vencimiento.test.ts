import assert from "node:assert/strict";
import { test } from "node:test";
import type { AcuerdoBancario } from "./caja-tipos";
import { acuerdosPorVencer, diasHastaVencimiento, textoVencimiento } from "./acuerdos-vencimiento";

const acuerdo = (id: string, vencimiento: string, estado: AcuerdoBancario["estado"] = "ACTIVO"): AcuerdoBancario => ({
  id,
  cuentaId: "CB-001",
  fecha: "2026-01-01",
  importe: 1000,
  tasa: 50,
  vencimiento,
  estado,
  fechaAlta: "2026-01-01",
  usuarioAlta: "demo",
});

test("diasHastaVencimiento cuenta días corridos, también negativos", () => {
  assert.equal(diasHastaVencimiento("2026-11-27", "2026-11-20"), 7);
  assert.equal(diasHastaVencimiento("2026-11-20", "2026-11-20"), 0);
  assert.equal(diasHastaVencimiento("2026-11-17", "2026-11-20"), -3);
});

test("acuerdosPorVencer avisa los que vencen en el plazo o ya vencieron, ordenados por urgencia", () => {
  const lista = [acuerdo("A", "2026-12-10"), acuerdo("B", "2026-11-27"), acuerdo("C", "2026-11-18"), acuerdo("D", "2027-06-01")];
  const avisos = acuerdosPorVencer(lista, "2026-11-20");
  assert.deepEqual(
    avisos.map((a) => [a.acuerdoId, a.dias, a.vencido]),
    [
      ["C", -2, true],
      ["B", 7, false],
      ["A", 20, false],
    ]
  );
});

test("acuerdosPorVencer ignora los suspendidos y eliminados y respeta el umbral", () => {
  const lista = [acuerdo("A", "2026-11-25", "SUSPENDIDO"), acuerdo("B", "2026-11-25", "ELIMINADO"), acuerdo("C", "2026-12-15")];
  assert.equal(acuerdosPorVencer(lista, "2026-11-20").length, 1);
  assert.equal(acuerdosPorVencer(lista, "2026-11-20", 10).length, 0);
});

test("textoVencimiento redacta el aviso", () => {
  assert.equal(textoVencimiento(7), "vence en 7 días");
  assert.equal(textoVencimiento(1), "vence mañana");
  assert.equal(textoVencimiento(0), "vence hoy");
  assert.equal(textoVencimiento(-1), "venció hace 1 día");
  assert.equal(textoVencimiento(-3), "venció hace 3 días");
});
