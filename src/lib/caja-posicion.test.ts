import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CAJAS_INICIALES,
  LIBRO_INICIAL,
  MOVIMIENTOS_TESORERIA_INICIALES,
  SUCURSALES_INICIALES,
} from "./caja-datos";
import { alertasPara, calcularAlertas, diferenciasDeCaja, resumenPosicion, tablero, type DatosPosicion } from "./caja-posicion";
import type { Arqueo, Jornada, MovimientoCaja, Recuento } from "./caja-tipos";

const recuento: Recuento = {
  usuarioId: "ana-gomez",
  fechaHora: "2026-11-18 10:00",
  detalle: {},
  contado: { ARS: 0, USD: 0 },
  esperado: { ARS: 0, USD: 0 },
  diferencia: { ARS: 0, USD: 0 },
  ajustes: [],
};

const jornada = (cajaId: string, estado: Jornada["estado"], fecha = "2026-11-18", turno = "ana-gomez"): Jornada => ({
  id: `JOR-${cajaId}-${estado}-${fecha}`,
  cajaId,
  fecha,
  estado,
  apertura: recuento,
  turnoUsuarioId: turno,
  rechazos: [],
});

const datos = (parche: Partial<DatosPosicion> = {}): DatosPosicion => ({
  cajas: CAJAS_INICIALES,
  sucursales: SUCURSALES_INICIALES,
  libro: LIBRO_INICIAL,
  jornadas: [],
  arqueos: [],
  cambiosTurno: [],
  movimientos: MOVIMIENTOS_TESORERIA_INICIALES,
  fecha: "2026-11-18",
  hora: "11:00",
  ...parche,
});

const ajuste = (cajaId: string, turno: string, ingreso: number, egreso: number, n: number): MovimientoCaja => ({
  id: `LB-X${n}`,
  cajaId,
  fecha: "2026-11-18",
  hora: "11:00",
  turnoUsuarioId: turno,
  tipo: ingreso ? "Ajuste por sobrante" : "Ajuste por faltante",
  descripcion: "Diferencia",
  comprobante: "J",
  moneda: "ARS",
  ingreso,
  egreso,
  medio: "EFECTIVO",
  responsableId: turno,
  estado: "CONFIRMADO",
  diferencia: true,
});

// Arqueos finalizados hoy para que no salten las alertas de arqueo vencido.
const arqueosAlDia: Arqueo[] = CAJAS_INICIALES.map((c, i) => ({
  id: `ARQ-${i}`,
  cajaId: c.id,
  tipo: "ORDINARIO",
  controladorId: "marta-diaz",
  corte: "2026-11-18 09:00",
  fin: "2026-11-18 09:30",
  estado: "FINALIZADO",
  conteos: [],
  resultado: "CONFORME",
}));

test("el tablero muestra una fila por caja activa con su estado y su saldo", () => {
  const filas = tablero(
    datos({ jornadas: [jornada("CAJ-003", "ABIERTA"), jornada("CAJ-002", "PEND_APERTURA"), jornada("CAJ-001", "CERRADA")] })
  );
  const por = Object.fromEntries(filas.map((f) => [f.cajaId, f]));
  assert.equal(filas.length, 4);
  assert.equal(por["CAJ-003"].estado, "ABIERTA");
  assert.equal(por["CAJ-003"].tono, "success");
  assert.equal(por["CAJ-003"].responsableId, "ana-gomez");
  assert.equal(por["CAJ-002"].estado, "PENDIENTE");
  assert.equal(por["CAJ-002"].tono, "warning");
  assert.equal(por["CAJ-001"].estado, "CERRADA");
  assert.equal(por["CAJ-004"].estado, "SIN_ABRIR");
  assert.equal(por["CAJ-004"].tono, "danger");
  assert.equal(por["CAJ-003"].saldos.ARS, 600000);
  assert.equal(por["CAJ-002"].saldos.USD, 5000);
  assert.equal(por["CAJ-003"].sucursal, "Sucursal Bariloche");
});

test("sin jornada, el responsable es el tesorero o el primer cajero activo", () => {
  const por = Object.fromEntries(tablero(datos()).map((f) => [f.cajaId, f]));
  assert.equal(por["CAJ-001"].responsableId, "carlos-ibarra");
  assert.equal(por["CAJ-003"].responsableId, "ana-gomez");
});

test("las diferencias se separan en a favor y en contra, y se desglosan por turno", () => {
  const libro = [...LIBRO_INICIAL, ajuste("CAJ-003", "ana-gomez", 300, 0, 1), ajuste("CAJ-003", "luis-pereyra", 0, 700, 2), ajuste("CAJ-003", "luis-pereyra", 0, 100, 3)];
  const { total, porTurno } = diferenciasDeCaja(libro, "CAJ-003");
  assert.equal(total.favor.ARS, 300);
  assert.equal(total.contra.ARS, 800);
  assert.equal(porTurno.get("luis-pereyra")?.contra.ARS, 800);
  const fila = tablero(datos({ libro })).find((f) => f.cajaId === "CAJ-003")!;
  assert.equal(fila.porTurno.length, 2, "con más de un turno se desglosa");
  const sinDesglose = tablero(datos({ libro: [...LIBRO_INICIAL, ajuste("CAJ-003", "ana-gomez", 300, 0, 1)] })).find((f) => f.cajaId === "CAJ-003")!;
  assert.equal(sinDesglose.porTurno.length, 0, "con un solo turno no hace falta desglose");
  assert.equal(resumenPosicion(datos({ libro })).diferencias.contra.ARS, 800);
});

test("el resumen cuenta pendientes, fondos en tránsito y el efectivo total", () => {
  const movimientos = [
    ...MOVIMIENTOS_TESORERIA_INICIALES,
    { ...MOVIMIENTOS_TESORERIA_INICIALES[1], id: "MT-9", estado: "EN_TRANSITO" as const, importe: 250000 },
    { ...MOVIMIENTOS_TESORERIA_INICIALES[1], id: "MT-10", estado: "CON_INCIDENCIA" as const, importe: 50000 },
  ];
  const r = resumenPosicion(datos({ movimientos, jornadas: [jornada("CAJ-003", "PEND_CIERRE")] }));
  assert.equal(r.pendientes.movimientos, 1, "MT-0002 sigue solicitado");
  assert.equal(r.pendientes.jornadas, 1);
  assert.equal(r.pendientes.incidencias, 1);
  assert.equal(r.pendientes.total, 3);
  assert.equal(r.enTransito.ARS, 300000);
  assert.equal(r.efectivoTotal.ARS, 57000000 + 8000000 + 600000 + 150000);
  assert.equal(r.efectivoTotal.USD, 125000);
});

test("alerta de importe máximo por moneda, para tesorero y supervisor", () => {
  const libro = [...LIBRO_INICIAL, { ...ajuste("CAJ-003", "ana-gomez", 1000000, 0, 9), diferencia: false }];
  const alertas = calcularAlertas(datos({ libro, arqueos: arqueosAlDia })).filter((a) => a.tipo === "IMPORTE_MAXIMO");
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].cajaId, "CAJ-003");
  assert.match(alertas[0].mensaje, /retiro de excedente/);
  assert.deepEqual(alertas[0].destinatarios.sort(), ["SUPERVISOR", "TESORERO"]);
  assert.equal(alertasPara(alertas, ["CAJERO"]).length, 0);
  assert.equal(alertasPara(alertas, ["TESORERO"]).length, 1);
});

test("alerta de caja sin cerrar: pasado el horario más el margen, o de un día anterior", () => {
  const abierta = [jornada("CAJ-003", "ABIERTA")];
  const tipoSinCerrar = (hora: string, js = abierta, fecha = "2026-11-18") =>
    calcularAlertas(datos({ jornadas: js, hora, fecha, arqueos: arqueosAlDia })).filter((a) => a.tipo === "CAJA_SIN_CERRAR");
  assert.equal(tipoSinCerrar("18:30").length, 0, "en el margen todavía no avisa");
  assert.equal(tipoSinCerrar("18:31").length, 1);
  assert.equal(tipoSinCerrar("11:00", [jornada("CAJ-003", "ABIERTA", "2026-11-17")]).length, 1, "abierta desde ayer");
  assert.equal(tipoSinCerrar("19:00", [jornada("CAJ-003", "CERRADA")]).length, 0, "cerrada no alerta");
  const margen = CAJAS_INICIALES.map((c) => (c.id === "CAJ-003" ? { ...c, margenAlertaMin: 90 } : c));
  const conMargen = calcularAlertas(datos({ cajas: margen, jornadas: abierta, hora: "19:00", arqueos: arqueosAlDia })).filter((a) => a.tipo === "CAJA_SIN_CERRAR");
  assert.equal(conMargen.length, 0, "el margen es configurable por caja");
});

test("alerta de arqueo vencido: sólo cajas activas con frecuencia", () => {
  const sin = calcularAlertas(datos()).filter((a) => a.tipo === "ARQUEO_VENCIDO");
  assert.equal(sin.length, 4, "ninguna caja se arqueó nunca");
  assert.equal(calcularAlertas(datos({ arqueos: arqueosAlDia })).filter((a) => a.tipo === "ARQUEO_VENCIDO").length, 0);
  const suspendida = CAJAS_INICIALES.map((c) => (c.id === "CAJ-004" ? { ...c, estado: "SUSPENDIDO" as const } : c));
  assert.equal(calcularAlertas(datos({ cajas: suspendida })).filter((a) => a.tipo === "ARQUEO_VENCIDO").length, 3);
  const sinFrecuencia = CAJAS_INICIALES.map((c) => ({ ...c, frecuenciaArqueo: "SIN_FRECUENCIA" as const }));
  assert.equal(calcularAlertas(datos({ cajas: sinFrecuencia })).filter((a) => a.tipo === "ARQUEO_VENCIDO").length, 0);
});
