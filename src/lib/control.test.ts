import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import { actaDe, firmarActa } from "./actas";
import { destinatariosDe, emitirAlerta, revisarAlertas } from "./alertas";
import { CAJAS_INICIALES, DENOMINACIONES_INICIALES, SUCURSALES_INICIALES, USUARIOS_CAJA } from "./caja-datos";
import { registrarApertura, resolverApertura } from "./caja-operaciones";
import { cajasVisibles, recuentoSugerido, sucursalesVisibles } from "./caja-reglas";
import { cajaStores as S, fijarFechaDemo, fijarHoraDemo, fijarUsuarioActual, reiniciarCaja, usuarioPorId } from "./caja-store";
import { CLAVE_DEMO } from "./control-datos";
import { controlStores, reiniciarControl } from "./control-store";
import { codigoTemporal, firmar, firmaPorId } from "./llave";
import { admiteRemota, perfilesQueAutorizan, perfilesQueCargan, puedeAutorizarPorMatriz, requiereDobleAutorizacion } from "./matriz";

const usuario = (id: string) => usuarioPorId(id)!;
const firmaDe = (usuarioId: string, extra: Partial<Parameters<typeof firmar>[0]> = {}) =>
  firmar({ usuarioId, clave: CLAVE_DEMO, codigo: codigoTemporal(usuarioId), operacion: "Prueba", referencia: "REF-1", ...extra });

beforeEach(() => {
  reiniciarCaja();
  reiniciarControl();
  fijarFechaDemo("2026-11-18");
  fijarHoraDemo("11:00");
});

// ---------- Llave de autorización ----------

test("la firma con llave registra usuario, rol, fecha, equipo y modalidad", () => {
  const r = firmaDe("marta-diaz", { operacion: "Aprobación de diferencia", referencia: "JOR-0001", importe: 2000, moneda: "ARS" });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.firma.id, "FIR-0001");
  assert.equal(r.firma.rol, "SUPERVISOR");
  assert.equal(r.firma.modalidad, "PRESENCIAL");
  assert.equal(r.firma.fechaHora, "2026-11-18 11:00");
  assert.equal(r.firma.equipo, "PC-SUC-002-01");
  assert.equal(controlStores.firmas.get().length, 1);
  assert.equal(firmaPorId("FIR-0001")?.referencia, "JOR-0001");
  assert.equal(firmaDe("raul-molina").ok && controlStores.firmas.get().at(-1)?.id, "FIR-0002");
});

test("la llave rechaza clave y código incorrectos, y el código cambia con la hora simulada", () => {
  const mal = firmar({ usuarioId: "marta-diaz", clave: "0000", codigo: codigoTemporal("marta-diaz"), operacion: "x", referencia: "y" });
  assert.ok(!mal.ok && /clave/i.test(mal.error));
  const sinCodigo = firmar({ usuarioId: "marta-diaz", clave: CLAVE_DEMO, codigo: "000000", operacion: "x", referencia: "y" });
  assert.ok(!sinCodigo.ok && /código/i.test(sinCodigo.error));
  const antes = codigoTemporal("marta-diaz");
  fijarHoraDemo("11:01");
  assert.notEqual(codigoTemporal("marta-diaz"), antes);
  assert.ok(!firmar({ usuarioId: "marta-diaz", clave: CLAVE_DEMO, codigo: antes, operacion: "x", referencia: "y" }).ok, "el código anterior venció");
  assert.equal(controlStores.firmas.get().length, 0, "una firma fallida no se registra");
});

test("nadie firma lo que cargó, aunque tenga varios roles", () => {
  // Tomás es Tesorero y Cajero: cargó la operación como cajero y no puede firmarla como tesorero.
  const r = firmaDe("tomas-ruiz", { cargadoPor: "tomas-ruiz", rol: "TESORERO" });
  assert.ok(!r.ok && /cargaste/.test(r.error));
  assert.ok(firmaDe("tomas-ruiz", { cargadoPor: "ana-gomez", rol: "TESORERO" }).ok);
});

test("una llave bloqueada o de baja no firma, y sólo se elige un rol propio", () => {
  controlStores.llaves.commit(controlStores.llaves.get().map((l) => (l.id === "marta-diaz" ? { ...l, estado: "BLOQUEADA" as const } : l)));
  assert.ok(!firmaDe("marta-diaz").ok);
  controlStores.llaves.commit(controlStores.llaves.get().map((l) => (l.id === "marta-diaz" ? { ...l, estado: "BAJA" as const } : l)));
  assert.ok(!firmaDe("marta-diaz").ok);
  assert.ok(!firmaDe("raul-molina", { rol: "DIRECTOR" }).ok, "Raúl no tiene el rol Director");
});

test("la firma remota la da Casa Central y queda marcada como remota", () => {
  const sucursal = firmaDe("marta-diaz", { remota: true }); // supervisora de Bariloche
  assert.ok(!sucursal.ok && /Casa Central/.test(sucursal.error));
  const central = firmaDe("ricardo-pena", { remota: true });
  assert.ok(central.ok && central.firma.modalidad === "REMOTA" && central.firma.equipo === "PC-CASA-CENTRAL-01");
});

test("una aprobación con llave guarda la firma en la jornada", () => {
  fijarUsuarioActual("ana-gomez");
  const r = registrarApertura("CAJ-003", {
    detalle: recuentoSugerido(DENOMINACIONES_INICIALES, "ARS", 598000),
    ajustes: [{ moneda: "ARS", importe: 0, motivoId: "MDC-001", nota: "vuelto" }],
  });
  assert.ok(r.ok);
  const jornadaId = r.ok ? r.jornadaId : "";
  // Con llave, el supervisor no autoriza hasta que el responsable de los fondos firma el acta de diferencia.
  const acta = actaDe("JORNADA_APERTURA", jornadaId);
  assert.ok(acta && acta.tipo === "DIFERENCIA");
  fijarUsuarioActual("marta-diaz");
  const antes = firmaDe("marta-diaz", { cargadoPor: "ana-gomez", referencia: jornadaId });
  assert.ok(antes.ok);
  assert.ok(!resolverApertura(jornadaId, true, "ok", antes.ok ? antes.firma.id : undefined).ok, "falta la firma del responsable");
  const f1 = firmaDe("ana-gomez", { referencia: acta?.id });
  assert.ok(f1.ok && firmarActa(acta!.id, { paso: 1, firma: f1.firma, conforme: true }).ok);
  const f = firmaDe("marta-diaz", { cargadoPor: "ana-gomez", referencia: jornadaId });
  assert.ok(f.ok);
  assert.ok(resolverApertura(jornadaId, true, "ok", f.ok ? f.firma.id : undefined).ok);
  assert.equal(S.jornadas.get()[0].apertura.aprobacion?.firmaId, f.ok ? f.firma.id : "?");
});

// ---------- Matriz de autorizaciones ----------

test("la matriz decide quién autoriza según el importe", () => {
  const supervisor = usuario("marta-diaz");
  assert.equal(puedeAutorizarPorMatriz(supervisor, "MOVIMIENTO_TESORERIA", 3000000, "ARS"), null);
  const sobreTope = puedeAutorizarPorMatriz(supervisor, "MOVIMIENTO_TESORERIA", 8000000, "ARS");
  assert.ok(sobreTope && /Tesorero central/.test(sobreTope) && /Director/.test(sobreTope));
  assert.equal(puedeAutorizarPorMatriz(usuario("ricardo-pena"), "MOVIMIENTO_TESORERIA", 8000000, "ARS"), null);
  assert.equal(puedeAutorizarPorMatriz(usuario("laura-benitez"), "MOVIMIENTO_TESORERIA", 900000000, "ARS"), null, "el Director no tiene tope");
  assert.ok(puedeAutorizarPorMatriz(usuario("ana-gomez"), "MOVIMIENTO_TESORERIA", 1000, "ARS"), "el cajero no autoriza");
});

test("los topes son por moneda y el escalón más alto cubre importes que superan al resto", () => {
  assert.deepEqual(perfilesQueAutorizan("AJUSTE_DIFERENCIA", 50000, "ARS"), ["SUPERVISOR", "TESORERO_CENTRAL", "DIRECTOR"]);
  assert.deepEqual(perfilesQueAutorizan("AJUSTE_DIFERENCIA", 500000, "ARS"), ["TESORERO_CENTRAL", "DIRECTOR"]);
  assert.deepEqual(perfilesQueAutorizan("AJUSTE_DIFERENCIA", 500000, "USD"), ["DIRECTOR"]);
  assert.deepEqual(perfilesQueCargan("REAPERTURA"), ["TESORERO", "SUPERVISOR"]);
});

test("la matriz sabe si admite autorización remota o doble autorización", () => {
  assert.equal(admiteRemota(usuario("ricardo-pena"), "MOVIMIENTO_TESORERIA", 8000000, "ARS"), true);
  assert.equal(admiteRemota(usuario("marta-diaz"), "MOVIMIENTO_TESORERIA", 1000, "ARS"), false);
  assert.equal(requiereDobleAutorizacion(usuario("laura-benitez"), "ORDEN_PAGO", 100000000, "ARS"), true);
  assert.equal(requiereDobleAutorizacion(usuario("ricardo-pena"), "ORDEN_PAGO", 1000, "ARS"), false);
});

test("una regla suspendida no cuenta, y sin reglas activas la operación no se autoriza", () => {
  const reglas = controlStores.matriz.get().map((r) => (r.operacion === "REAPERTURA" ? { ...r, estado: "SUSPENDIDO" as const } : r));
  const r = puedeAutorizarPorMatriz(usuario("ricardo-pena"), "REAPERTURA", 0, "ARS", reglas);
  assert.ok(r && /no tiene reglas activas/.test(r));
  assert.equal(puedeAutorizarPorMatriz(usuario("ricardo-pena"), "REAPERTURA", 0, "ARS"), null);
});

// ---------- Alertas ----------

test("una alerta se registra con los destinatarios configurados", () => {
  const a = emitirAlerta("DIFERENCIA_SOBRE_TOLERANCIA", "detalle", "JOR-1", { sucursalId: "SUC-002" });
  assert.ok(a);
  assert.equal(a?.id, "ALE-0001");
  assert.deepEqual(a?.destinatarios.map((d) => d.usuarioId).sort(), ["laura-benitez", "ricardo-pena"]);
  assert.equal(controlStores.alertasEnviadas.get().length, 1);
});

test("los roles de sucursal reciben sólo las alertas de su sucursal", () => {
  assert.deepEqual(destinatariosDe("CAJA_SIN_CERRAR", "SUC-002").map((d) => d.usuarioId).sort(), ["marta-diaz", "tomas-ruiz"]);
  assert.deepEqual(destinatariosDe("CAJA_SIN_CERRAR", "SUC-001").map((d) => d.usuarioId).sort(), ["carlos-ibarra", "raul-molina"]);
});

test("una alerta suspendida no se envía y la configuración cambia los destinatarios", () => {
  const config = controlStores.alertasConfig.get();
  controlStores.alertasConfig.commit(config.map((c) => (c.evento === "ARQUEO_VENCIDO" ? { ...c, estado: "SUSPENDIDO" as const } : c)));
  assert.equal(emitirAlerta("ARQUEO_VENCIDO", "x"), null);
  controlStores.alertasConfig.commit(
    controlStores.alertasConfig.get().map((c) => (c.evento === "NEGATIVA_A_FIRMAR" ? { ...c, destinatarios: ["DIRECTOR" as const] } : c))
  );
  assert.deepEqual(emitirAlerta("NEGATIVA_A_FIRMAR", "x")?.destinatarios.map((d) => d.usuarioId), ["laura-benitez"]);
});

test("una diferencia sobre la tolerancia en la apertura dispara el mail a Director y Tesorero central", () => {
  fijarUsuarioActual("ana-gomez");
  const r = registrarApertura("CAJ-003", {
    detalle: recuentoSugerido(DENOMINACIONES_INICIALES, "ARS", 598000),
    ajustes: [{ moneda: "ARS", importe: 0, motivoId: "MDC-001", nota: "vuelto" }],
  });
  assert.ok(r.ok);
  const alertas = controlStores.alertasEnviadas.get().filter((a) => a.evento === "DIFERENCIA_SOBRE_TOLERANCIA");
  assert.equal(alertas.length, 1);
  assert.match(alertas[0].detalle, /faltante de 2\.000/);
  assert.deepEqual(alertas[0].destinatarios.map((d) => d.usuarioId).sort(), ["laura-benitez", "ricardo-pena"]);
  // Una diferencia dentro de la tolerancia no avisa.
  reiniciarCaja();
  reiniciarControl();
  fijarFechaDemo("2026-11-18");
  fijarUsuarioActual("ana-gomez");
  registrarApertura("CAJ-003", { detalle: recuentoSugerido(DENOMINACIONES_INICIALES, "ARS", 599800) });
  assert.equal(controlStores.alertasEnviadas.get().length, 0);
});

test("rechazar una apertura (acta No conforme) dispara el mail", () => {
  fijarUsuarioActual("ana-gomez");
  const r = registrarApertura("CAJ-003", {
    detalle: recuentoSugerido(DENOMINACIONES_INICIALES, "ARS", 598000),
    ajustes: [{ moneda: "ARS", importe: 0, motivoId: "MDC-001", nota: "" }],
  });
  fijarUsuarioActual("marta-diaz");
  assert.ok(resolverApertura(r.ok ? r.jornadaId : "", false, "no cuadra").ok);
  assert.equal(controlStores.alertasEnviadas.get().filter((a) => a.evento === "ACTA_NO_CONFORME").length, 1);
});

test("la revisión avisa una sola vez por fecha de la caja que sigue abierta pasada la hora de fin", () => {
  fijarUsuarioActual("ana-gomez");
  assert.ok(registrarApertura("CAJ-003", { detalle: recuentoSugerido(DENOMINACIONES_INICIALES, "ARS", 600000) }).ok);
  revisarAlertas();
  const sin = () => controlStores.alertasEnviadas.get().filter((a) => a.evento === "CAJA_SIN_CERRAR").length;
  assert.equal(sin(), 0, "a las 11:00 la caja está en horario");
  fijarHoraDemo("18:45"); // fin 18:00 + 30 minutos de margen
  revisarAlertas();
  assert.equal(sin(), 1);
  revisarAlertas();
  assert.equal(sin(), 1, "no repite el aviso en la misma fecha");
});

test("la revisión avisa los acuerdos por vencer dentro de los días de aviso", () => {
  fijarFechaDemo("2026-12-20"); // ACU-002 vence el 2026-12-30; el aviso es con 15 días
  revisarAlertas();
  const acuerdos = controlStores.alertasEnviadas.get().filter((a) => a.evento === "ACUERDO_POR_VENCER");
  assert.deepEqual(acuerdos.map((a) => a.referencia), ["ACU-002"]);
});

// ---------- Visibilidad por rol ----------

test("cada rol ve las cajas de su ámbito", () => {
  const ids = (u: string) => cajasVisibles(usuario(u), CAJAS_INICIALES).map((c) => c.id);
  assert.deepEqual(ids("laura-benitez"), ["CAJ-001", "CAJ-002", "CAJ-003", "CAJ-004"], "el Director ve todo");
  assert.deepEqual(ids("ricardo-pena"), ["CAJ-001", "CAJ-002", "CAJ-003", "CAJ-004"], "el Tesorero central ve todo");
  assert.deepEqual(ids("marta-diaz"), ["CAJ-002", "CAJ-003", "CAJ-004"], "el Supervisor ve su sucursal");
  assert.deepEqual(ids("carlos-ibarra"), ["CAJ-001"], "el Tesorero ve su sucursal (Casa Central)");
  assert.deepEqual(ids("ana-gomez"), ["CAJ-003"], "el Cajero ve sólo su caja");
  assert.deepEqual(ids("luis-pereyra"), ["CAJ-003"]);
  assert.deepEqual(sucursalesVisibles(usuario("ana-gomez"), SUCURSALES_INICIALES, CAJAS_INICIALES).map((s) => s.id), ["SUC-002"]);
  assert.equal(sucursalesVisibles(usuario("laura-benitez"), SUCURSALES_INICIALES, CAJAS_INICIALES).length, SUCURSALES_INICIALES.length);
});

test("los usuarios de la demo incluyen Director y Tesorero central", () => {
  assert.ok(USUARIOS_CAJA.some((u) => u.roles.includes("DIRECTOR")));
  assert.ok(USUARIOS_CAJA.some((u) => u.roles.includes("TESORERO_CENTRAL")));
});
