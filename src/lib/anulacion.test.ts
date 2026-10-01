import { test } from "node:test";
import assert from "node:assert/strict";
import { crearAplicacionInicial } from "./mocks";
import { GRUPO_POR_ESTADO, type CreditoDB } from "./creditos-db";
import { aplicarAnulacion, registrarAnulacion } from "./anulacion";

const FECHA = "30/09/2026";

function enTramite() {
  return {
    ...crearAplicacionInicial(),
    numeroCredito: "CR-900001",
    estado: "EN_TRAMITE" as const,
    cliente: { dni: "30111222", nombre: "Ana", apellido: "Paz" } as CreditoDB["cliente"],
  };
}

test("la caída del crédito persiste el estado ANULADO con el motivo", () => {
  const anulada = aplicarAnulacion(enTramite(), "El cliente desistió", FECHA);
  assert.equal(anulada.estado, "ANULADO");
  assert.deepEqual(anulada.analista.observacion, {
    motivo: "Anulada",
    nota: "El cliente desistió",
    fecha: FECHA,
    pantallas: [],
  });
  assert.equal(anulada.analista.tomado, false);
});

test("registrarAnulacion lista el crédito anulado en la DB sin tocar los demás", () => {
  const otro = { ...enTramite(), numeroCredito: "CR-000001", _bandeja: "vendedor", _descripcion: "", _id: "CR-000001" } as CreditoDB;
  const lista = registrarAnulacion([otro], enTramite(), null, "anulado-1", "desistió", FECHA);
  assert.equal(lista.length, 2);
  assert.equal(lista.find((c) => c._id === "CR-000001")?.estado, "EN_TRAMITE");
  assert.equal(lista.find((c) => c._id === "CR-900001")?.estado, "ANULADO");
});

test("registrarAnulacion reemplaza el registro previo en vez de duplicarlo", () => {
  const previo = { ...enTramite(), _bandeja: "analista", _descripcion: "x", _id: "CR-900001" } as CreditoDB;
  const lista = registrarAnulacion([previo], enTramite(), "CR-900001", "anulado-1", "desistió", FECHA);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].estado, "ANULADO");
  assert.equal(lista[0]._bandeja, "analista");
});

test("sin ID de Crédito el registro usa el id provisorio", () => {
  const borrador = { ...enTramite(), numeroCredito: null, estado: "BORRADOR" as const };
  const lista = registrarAnulacion([], borrador, null, "anulado-7", "desistió", FECHA);
  assert.equal(lista[0]._id, "anulado-7");
  assert.equal(lista[0].estado, "ANULADO");
});

test("en la bandeja del vendedor el crédito deja Trámite y pasa a Resueltas/Anulados", () => {
  const antes = enTramite();
  const despues = aplicarAnulacion(antes, "desistió", FECHA);
  assert.equal(GRUPO_POR_ESTADO[antes.estado], "TRAMITE");
  assert.equal(GRUPO_POR_ESTADO[despues.estado], "RESUELTAS");
});
