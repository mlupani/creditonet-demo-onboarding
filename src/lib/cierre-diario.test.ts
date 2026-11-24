import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import { DENOMINACIONES_INICIALES } from "./caja-datos";
import { autorizarMovimiento, bloqueoCaja, registrarApertura, registrarCierre } from "./caja-operaciones";
import { recuentoSugerido, saldoCaja } from "./caja-reglas";
import { cajaStores as S, fijarFechaDemo, fijarHoraDemo, fijarUsuarioActual, reiniciarCaja } from "./caja-store";
import {
  abrirVentanaDeAjuste,
  autorizarReaperturaCierre,
  cargarAjusteCierre,
  confirmarCierreDiario,
  controlesDeSucursal,
  estadoDiarioDe,
  iniciarCierreDiario,
  ordenarArqueoSorpresivo,
  reabrirCaja,
  recibirEntregaCierre,
  resolverAjusteCierre,
  solicitarReaperturaCierre,
} from "./cierre-diario";
import { CLAVE_DEMO } from "./control-datos";
import { controlStores, reiniciarControl } from "./control-store";
import { codigoTemporal, firmar } from "./llave";
import { reiniciarProveedores } from "./proveedores-store";

const como = fijarUsuarioActual;

beforeEach(() => {
  reiniciarCaja();
  reiniciarControl();
  reiniciarProveedores();
  fijarFechaDemo("2026-11-18");
});

function firmaDe(usuarioId: string, referencia: string, remota = false): string {
  const r = firmar({ usuarioId, clave: CLAVE_DEMO, codigo: codigoTemporal(usuarioId), operacion: "Prueba", referencia, remota });
  assert.ok(r.ok, r.ok ? "" : r.error);
  return r.ok ? r.firma.id : "";
}

// Ana abre y cierra la caja 1 (sin diferencia). Devuelve la jornada cerrada.
function cerrarCaja003() {
  como("ana-gomez");
  const detalle = recuentoSugerido(DENOMINACIONES_INICIALES, "ARS", saldoCaja(S.libro.get(), "CAJ-003", "ARS"));
  assert.ok(registrarApertura("CAJ-003", { detalle }).ok);
  assert.ok(registrarCierre("CAJ-003", { detalle }).ok);
  const j = S.jornadas.get().find((x) => x.cajaId === "CAJ-003" && x.estado === "CERRADA");
  assert.ok(j?.cierre);
  return j;
}

const entregar = (jornadaId: string, cajeroId: string, recibeId: string) => recibirEntregaCierre(jornadaId, firmaDe(cajeroId, jornadaId), firmaDe(recibeId, jornadaId));

// Deja la sucursal 2 con las cajas cerradas, el efectivo recibido y la ventana de ajuste abierta.
function ventanaAbierta(): string {
  const j = cerrarCaja003();
  como("marta-diaz");
  assert.ok(autorizarMovimiento("MT-0002", false, "ya no hace falta").ok);
  assert.ok(entregar(j.id, "ana-gomez", "marta-diaz").ok);
  como("tomas-ruiz");
  const inicio = iniciarCierreDiario("SUC-002");
  assert.ok(inicio.ok);
  const id = inicio.ok ? inicio.cierreId : "";
  const v = abrirVentanaDeAjuste(id);
  assert.ok(v.ok, v.ok ? "" : v.error);
  return id;
}

test("la caja cerrada en el sistema no es efectivo en custodia hasta que el tesorero firma la recepción", () => {
  const j = cerrarCaja003();
  assert.equal(S.jornadas.get().find((x) => x.id === j.id)?.custodia, undefined);
  assert.ok(!entregar(j.id, "ana-gomez", "ana-gomez").ok, "nadie recibe su propia entrega");
  assert.ok(!entregar(j.id, "ana-gomez", "luis-pereyra").ok, "un cajero no recibe el efectivo");
  assert.ok(!entregar(j.id, "luis-pereyra", "marta-diaz").ok, "la entrega la firma quien cerró la caja");
  const remota = recibirEntregaCierre(j.id, firmaDe("ana-gomez", j.id), firmaDe("ricardo-pena", j.id, true));
  assert.ok(!remota.ok && /presencial/.test(remota.error), "con un supervisor en la sucursal la recepción es presencial");
  const r = entregar(j.id, "ana-gomez", "marta-diaz");
  assert.ok(r.ok);
  const custodia = S.jornadas.get().find((x) => x.id === j.id)?.custodia;
  assert.equal(custodia?.recibeUsuarioId, "marta-diaz");
  assert.equal(custodia?.remota, false);
  const acta = S.actas.get().find((a) => a.id === custodia?.actaId);
  assert.equal(acta?.estado, "FIRMADA");
  assert.equal(acta?.tipo, "CIERRE_ENTREGA");
  assert.ok(!entregar(j.id, "ana-gomez", "marta-diaz").ok, "ya está en custodia");
});

test("los controles distinguen lo bloqueante de lo que se puede justificar", () => {
  const antes = controlesDeSucursal("SUC-002");
  assert.deepEqual(antes.find((c) => c.id === "CAJAS")?.bloqueantes, []);
  assert.match(antes.find((c) => c.id === "PENDIENTES")?.justificables.join(" ") ?? "", /MT-0002/);
  assert.equal(antes.find((c) => c.id === "MEDIOS")?.informativo, true);
  const j = cerrarCaja003();
  const sinRecibir = controlesDeSucursal("SUC-002").find((c) => c.id === "RENDICIONES");
  assert.match(sinRecibir?.bloqueantes.join(" ") ?? "", /todavía no fue recibido/);
  assert.ok(entregar(j.id, "ana-gomez", "marta-diaz").ok);
  assert.deepEqual(controlesDeSucursal("SUC-002").find((c) => c.id === "RENDICIONES")?.bloqueantes, []);
});

test("ventana de ajuste: el tesorero carga, el supervisor autoriza con la matriz y se asienta un ajuste propio", () => {
  const cierreId = ventanaAbierta();
  const ajuste = { cierreId, cajaId: "CAJ-003", moneda: "ARS" as const, importe: -2000, motivoId: "MDC-001", nota: "vuelto" };
  como("ana-gomez");
  assert.ok(!cargarAjusteCierre(ajuste).ok, "sólo el tesorero carga");
  como("tomas-ruiz");
  const cargado = cargarAjusteCierre(ajuste);
  assert.ok(cargado.ok);
  const id = cargado.ok ? cargado.ajusteId : "";
  assert.ok(!cargarAjusteCierre({ ...ajuste, importe: 0 }).ok, "el importe no puede ser cero");
  assert.ok(!resolverAjusteCierre(id, true, "").ok, "el tesorero no autoriza");
  const antes = saldoCaja(S.libro.get(), "CAJ-003", "ARS");
  como("marta-diaz");
  assert.ok(resolverAjusteCierre(id, true, "").ok);
  assert.equal(saldoCaja(S.libro.get(), "CAJ-003", "ARS"), antes - 2000);
  const a = S.ajustesCierre.get().find((x) => x.id === id);
  assert.equal(a?.estado, "AUTORIZADO");
  assert.ok(a?.libroId, "el ajuste tiene su movimiento en el libro");
  assert.ok(!resolverAjusteCierre(id, true, "").ok, "ya está resuelto");

  // Por encima del tope del supervisor en la matriz autoriza el Tesorero central.
  como("tomas-ruiz");
  const grande = cargarAjusteCierre({ ...ajuste, importe: 150000 });
  const gid = grande.ok ? grande.ajusteId : "";
  como("marta-diaz");
  assert.ok(!resolverAjusteCierre(gid, true, "").ok, "supera el tope del supervisor");
  como("ricardo-pena");
  assert.ok(resolverAjusteCierre(gid, true, "").ok);
});

test("la ventana vencida bloquea la fecha: ya no se cargan ajustes", () => {
  const cierreId = ventanaAbierta();
  fijarFechaDemo("2026-11-19");
  fijarHoraDemo("11:30");
  como("tomas-ruiz");
  const r = cargarAjusteCierre({ cierreId, cajaId: "CAJ-003", moneda: "ARS", importe: -100, motivoId: "MDC-001", nota: "" });
  assert.ok(!r.ok && /venció/.test(r.error));
});

test("pasada la hora límite sin iniciar el cierre la sucursal queda No cerrada", () => {
  assert.equal(estadoDiarioDe("SUC-002").estado, "ABIERTA");
  fijarHoraDemo("21:00");
  assert.equal(estadoDiarioDe("SUC-002").estado, "NO_CERRADA");
});

test("la segunda firma remota sólo vale si la sucursal no tiene otro usuario habilitado", () => {
  const cierreId = ventanaAbierta();
  como("tomas-ruiz");
  const r = confirmarCierreDiario(cierreId, { firma1Id: firmaDe("tomas-ruiz", cierreId), firma2Id: firmaDe("ricardo-pena", cierreId, true) });
  assert.ok(!r.ok && /supervisor habilitado/.test(r.error));
  const mal = confirmarCierreDiario(cierreId, { firma1Id: firmaDe("tomas-ruiz", cierreId), firma2Id: firmaDe("tomas-ruiz", cierreId) });
  assert.ok(!mal.ok, "los dos firmantes tienen que ser distintos");
});

test("un cierre con acta firmada deja la fecha Cerrada OK y bloquea las cajas", () => {
  const cierreId = ventanaAbierta();
  como("tomas-ruiz");
  const r = confirmarCierreDiario(cierreId, { firma1Id: firmaDe("tomas-ruiz", cierreId), firma2Id: firmaDe("marta-diaz", cierreId) });
  assert.ok(r.ok && r.estado === "CERRADA_OK");
  const cierre = S.cierresSucursal.get().find((c) => c.id === cierreId);
  assert.equal(cierre?.estado, "CERRADA_OK");
  const acta = S.actas.get().find((a) => a.id === cierre?.actaId);
  assert.equal(acta?.tipo, "CIERRE_DIARIO");
  assert.equal(acta?.estado, "FIRMADA");
  assert.match(bloqueoCaja("CAJ-002") ?? "", /cerró la fecha/);
  assert.equal(estadoDiarioDe("SUC-002").estado, "CERRADA_OK");
});

test("reapertura: el plazo es en días hábiles y vencido sólo autoriza el Director", () => {
  const cierreId = ventanaAbierta();
  como("tomas-ruiz");
  assert.ok(confirmarCierreDiario(cierreId, { firma1Id: firmaDe("tomas-ruiz", cierreId), firma2Id: firmaDe("marta-diaz", cierreId) }).ok);
  assert.ok(solicitarReaperturaCierre(cierreId, "falta una rendición").ok);
  assert.ok(!solicitarReaperturaCierre(cierreId, "otra").ok, "ya hay una solicitud pendiente");
  // 18/11 → 30/11: siete días hábiles (el 23/11 es feriado), más que los cinco del plazo.
  fijarFechaDemo("2026-11-30");
  assert.ok(!autorizarReaperturaCierre(cierreId, firmaDe("ricardo-pena", cierreId)).ok, "vencido el plazo, el Tesorero central no alcanza");
  const r = autorizarReaperturaCierre(cierreId, firmaDe("laura-benitez", cierreId));
  assert.ok(r.ok);
  const nuevo = S.cierresSucursal.get().find((c) => c.id === (r.ok ? r.nuevoCierreId : ""));
  assert.equal(nuevo?.estado, "EN_VENTANA");
  assert.equal(nuevo?.reabreDeId, cierreId);
  assert.equal(S.cierresSucursal.get().find((c) => c.id === cierreId)?.estado, "REABIERTA");
  assert.ok(controlStores.alertasEnviadas.get().some((a) => a.evento === "SOLICITUD_REAPERTURA" && a.referencia === cierreId), "avisa a Casa Central");
});

test("el nuevo cierre tras una reapertura referencia el acta anterior", () => {
  const cierreId = ventanaAbierta();
  como("tomas-ruiz");
  assert.ok(confirmarCierreDiario(cierreId, { firma1Id: firmaDe("tomas-ruiz", cierreId), firma2Id: firmaDe("marta-diaz", cierreId) }).ok);
  assert.ok(solicitarReaperturaCierre(cierreId, "ajuste olvidado").ok);
  const r = autorizarReaperturaCierre(cierreId, firmaDe("ricardo-pena", cierreId));
  assert.ok(r.ok);
  const nuevoId = r.ok ? r.nuevoCierreId : "";
  const ok = confirmarCierreDiario(nuevoId, { firma1Id: firmaDe("tomas-ruiz", nuevoId), firma2Id: firmaDe("marta-diaz", nuevoId) });
  assert.ok(ok.ok);
  const anterior = S.cierresSucursal.get().find((c) => c.id === cierreId);
  const acta = S.actas.get().find((a) => a.id === (ok.ok ? ok.actaId : ""));
  assert.equal(acta?.referenciaActaId, anterior?.actaId);
});

test("reabrir una caja cerrada exige la llave de Casa Central y la deja Abierta", () => {
  const j = cerrarCaja003();
  assert.ok(entregar(j.id, "ana-gomez", "marta-diaz").ok);
  como("ana-gomez");
  assert.ok(!reabrirCaja(j.id, " ", firmaDe("ricardo-pena", j.id)).ok, "falta el motivo");
  assert.ok(!reabrirCaja(j.id, "error de carga", firmaDe("marta-diaz", j.id)).ok, "un supervisor no tiene facultades para reabrir");
  assert.ok(reabrirCaja(j.id, "error de carga", firmaDe("ricardo-pena", j.id)).ok);
  const despues = S.jornadas.get().find((x) => x.id === j.id);
  assert.equal(despues?.estado, "ABIERTA");
  assert.equal(despues?.custodia, undefined, "hay que entregar el efectivo de nuevo");
  assert.equal(despues?.reaperturas?.length, 1);
  assert.ok(controlStores.alertasEnviadas.get().some((a) => a.evento === "SOLICITUD_REAPERTURA" && a.referencia === j.id), "avisa a Casa Central");
});

test("Casa Central ordena un arqueo sorpresivo y designa al controlador", () => {
  como("tomas-ruiz");
  assert.ok(!ordenarArqueoSorpresivo("CAJ-003", "marta-diaz").ok, "sólo Casa Central ordena");
  como("ricardo-pena");
  assert.ok(!ordenarArqueoSorpresivo("CAJ-003", "ana-gomez").ok, "el controlador no puede ser responsable de la caja");
  assert.ok(!ordenarArqueoSorpresivo("CAJ-003", "ricardo-pena").ok, "el controlador necesita el permiso Realizar arqueo");
  const r = ordenarArqueoSorpresivo("CAJ-003", "marta-diaz");
  assert.ok(r.ok);
  const arqueo = S.arqueos.get().find((a) => a.id === (r.ok ? r.arqueoId : ""));
  assert.equal(arqueo?.tipo, "SORPRESIVO");
  assert.equal(arqueo?.controladorId, "marta-diaz");
  assert.equal(arqueo?.ordenadoPor, "ricardo-pena");
  assert.match(bloqueoCaja("CAJ-003") ?? "", /arqueo/);
  assert.ok(!ordenarArqueoSorpresivo("CAJ-003", "marta-diaz").ok, "la caja ya está en arqueo");
});
