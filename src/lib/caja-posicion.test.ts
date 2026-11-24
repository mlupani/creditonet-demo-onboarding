import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CAJAS_INICIALES,
  CHEQUES_INICIALES,
  CUENTAS_BANCARIAS_INICIALES,
  LIBRO_INICIAL,
  MOVIMIENTOS_TESORERIA_INICIALES,
  SUCURSALES_INICIALES,
} from "./caja-datos";
import {
  alertasPara,
  calcularAlertas,
  diferenciasDeCaja,
  historicoSaldos,
  resumenPosicion,
  saldosAFecha,
  seriesDe,
  tablero,
  type DatosPosicion,
  type Serie,
} from "./caja-posicion";
import type { Arqueo, Jornada, MovimientoCaja, Recuento } from "./caja-tipos";
import { PAGOS_INICIALES } from "./proveedores-datos";

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

const serieCaja = (clave: string, moneda: "ARS" | "USD", movs: [string, number, number][]): Serie => ({
  clave,
  tipo: "CAJA",
  id: clave,
  nombre: clave,
  moneda,
  movimientos: movs.map(([fecha, ingreso, egreso]) => ({ fecha, hora: "10:00", descripcion: "x", comprobante: "c", ingreso, egreso })),
});

test("histórico diario: saldo inicial, ingresos, egresos y final por período", () => {
  const s = serieCaja("A", "ARS", [["2026-10-30", 1000, 0], ["2026-11-02", 500, 200], ["2026-11-02", 0, 100], ["2026-11-05", 50, 0]]);
  const { bloques, consolidado } = historicoSaldos([s], { desde: "2026-11-01", hasta: "2026-11-30", periodicidad: "DIARIA" });
  assert.deepEqual(bloques[0].filas.map((f) => f.periodo), ["2026-11-02", "2026-11-05"]);
  assert.deepEqual(bloques[0].filas[0], { periodo: "2026-11-02", inicial: 1000, ingresos: 500, egresos: 300, final: 1200 });
  assert.equal(bloques[0].filas[1].inicial, 1200, "el inicial encadena con el final anterior");
  assert.equal(bloques[0].filas[1].final, 1250);
  assert.equal(consolidado.length, 0, "con una sola serie no hay consolidado");
});

test("histórico mensual recorta al rango y consolida varias series por moneda", () => {
  const a = serieCaja("A", "ARS", [["2026-10-20", 100, 0], ["2026-11-10", 50, 0], ["2026-11-20", 0, 30]]);
  const b = serieCaja("B", "ARS", [["2026-11-25", 10, 0]]);
  const usd = serieCaja("C", "USD", [["2026-11-03", 5, 0]]);
  const { bloques, consolidado } = historicoSaldos([a, b, usd], { desde: "2026-11-15", hasta: "2026-11-30", periodicidad: "MENSUAL" });
  assert.deepEqual(bloques[0].filas, [{ periodo: "2026-11", inicial: 150, ingresos: 0, egresos: 30, final: 120 }], "arranca el 15: el ingreso del 10 ya está en el inicial");
  assert.equal(bloques[1].filas[0].final, 10, "una serie sin movimientos previos también tiene fila");
  assert.equal(consolidado.length, 1, "sólo pesos tiene más de una serie");
  assert.deepEqual(consolidado[0], { periodo: "2026-11", moneda: "ARS", series: 2, inicial: 150, ingresos: 10, egresos: 30, final: 130 });
});

test("sin movimientos en el rango, hay una fila al cierre con saldo inicial igual al final", () => {
  const s = serieCaja("A", "ARS", [["2026-09-01", 700, 0]]);
  const { bloques } = historicoSaldos([s], { desde: "2026-11-01", hasta: "2026-11-30", periodicidad: "MENSUAL" });
  assert.deepEqual(bloques[0].filas, [{ periodo: "2026-11", inicial: 700, ingresos: 0, egresos: 0, final: 700 }]);
});

test("saldo a una fecha: la foto de todas las series al cierre del día", () => {
  const a = serieCaja("A", "ARS", [["2026-11-01", 100, 0], ["2026-11-10", 0, 40], ["2026-11-20", 500, 0]]);
  const b = serieCaja("B", "USD", [["2026-11-10", 9, 0]]);
  const foto = saldosAFecha([a, b], "2026-11-10");
  assert.deepEqual(foto.map((x) => x.saldo), [60, 9]);
});

test("las series de caja usan sólo efectivo confirmado y las de banco sólo depósitos conciliados", () => {
  const cuenta = CUENTAS_BANCARIAS_INICIALES[0];
  const dep = {
    ...MOVIMIENTOS_TESORERIA_INICIALES[0],
    id: "MT-D",
    destino: { tipo: "BANCO" as const, cuentaId: cuenta.id },
    importe: 900,
    envio: { usuarioId: "a", fechaHora: "2026-11-10 10:00", detalle: {}, importe: 900, conformidad: true },
    conciliacion: { usuarioId: "a", fechaHora: "2026-11-12 09:00", fechaAcreditacion: "2026-11-11", importe: 900, referencia: "REF-1" },
  };
  const sinConciliar = { ...dep, id: "MT-E", conciliacion: undefined };
  const libro = [
    ...LIBRO_INICIAL,
    { ...ajuste("CAJ-003", "ana-gomez", 0, 10, 1), medio: "TARJETA" as const },
    { ...ajuste("CAJ-003", "ana-gomez", 0, 20, 2), estado: "ANULADO" as const },
  ];
  const pagoBanco = { ...PAGOS_INICIALES[0], id: "PAG-X", origenTipo: "BANCO" as const, origenId: cuenta.id, importe: 300, fecha: "2026-11-13", estado: "EJECUTADA" as const };
  const pagoCaja = { ...PAGOS_INICIALES[0], id: "PAG-Y", origenTipo: "CAJA" as const, origenId: "CAJ-003", importe: 50 };
  // Preparada o rechazada no bajan el real del banco; un cheque propio sólo cuando se debita.
  const pagoPreparado = { ...pagoBanco, id: "PAG-Z", importe: 700, estado: "PREPARADA" as const };
  const pagoRechazado = { ...pagoBanco, id: "PAG-W", importe: 800, estado: "RECHAZADA" as const };
  const propio = { ...CHEQUES_INICIALES.find((c) => c.origen === "PROPIO")!, cuentaId: cuenta.id, importe: 120, fechaPago: "2026-11-14" };
  const series = seriesDe(
    {
      cajas: CAJAS_INICIALES,
      cuentas: CUENTAS_BANCARIAS_INICIALES,
      libro,
      movimientos: [dep, sinConciliar],
      pagos: [pagoBanco, pagoCaja, pagoPreparado, pagoRechazado],
      cheques: [{ ...propio, id: "CHE-D", estado: "DEBITADO" }, { ...propio, id: "CHE-E", estado: "EMITIDO" }, { ...propio, id: "CHE-P", estado: "PRESENTADO" }],
    },
    ["CAJ-003"],
    [cuenta.id],
    ""
  );
  const caja = series.find((x) => x.tipo === "CAJA")!;
  assert.equal(saldosAFecha([caja], "2099-01-01")[0].saldo, 600000, "no cuenta ni tarjeta ni anulados");
  const banco = series.find((x) => x.tipo === "BANCO")!;
  assert.deepEqual(
    banco.movimientos.map((m) => [m.descripcion.split(" ")[0], m.fecha, m.ingreso, m.egreso]),
    [["Saldo", cuenta.fechaAlta, cuenta.saldoInicial, 0], ["Depósito", "2026-11-11", 900, 0], ["Pago", "2026-11-13", 0, 300], ["Cheque", "2026-11-14", 0, 120]],
    "saldo inicial, depósito conciliado, transferencia ejecutada y cheque debitado: lo preparado, emitido o rechazado no baja el real"
  );
  assert.equal(saldosAFecha([banco], "2026-11-12")[0].saldo, (cuenta.saldoInicial ?? 0) + 900);
  assert.equal(saldosAFecha([banco], "2026-11-13")[0].saldo, (cuenta.saldoInicial ?? 0) + 900 - 300);
  assert.equal(saldosAFecha([banco], "2026-11-14")[0].saldo, (cuenta.saldoInicial ?? 0) + 900 - 300 - 120);
  assert.equal(seriesDe({ cajas: CAJAS_INICIALES, cuentas: CUENTAS_BANCARIAS_INICIALES, libro, movimientos: [] }, ["CAJ-003", "CAJ-002"], [], "USD").length, 1, "el filtro de moneda aplica");
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
