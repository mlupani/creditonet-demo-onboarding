import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import {
  actaDe,
  actaPorId,
  actasDeEvento,
  actasVisibles,
  crearActa,
  firmarActa,
  necesitaFirmaRemota,
  registrarNegativaAFirmar,
  resolverActaEscalada,
  solicitarFirmaRemota,
} from "./actas";
import { DENOMINACIONES_INICIALES } from "./caja-datos";
import {
  cargarArqueoRelevo,
  ajustarDiferenciaArqueo,
  finalizarArqueo,
  iniciarArqueo,
  recibirTurno,
  registrarApertura,
  registrarConteoArqueo,
  rechazarAjusteArqueo,
  resolverApertura,
  solicitarCambioTurno,
} from "./caja-operaciones";
import { recuentoSugerido, saldoCaja } from "./caja-reglas";
import { cajaStores as S, fijarFechaDemo, fijarHoraDemo, fijarUsuarioActual as como, reiniciarCaja, usuarioPorId } from "./caja-store";
import type { ActaConformidad } from "./caja-tipos";
import { CLAVE_DEMO } from "./control-datos";
import { controlStores, reiniciarControl } from "./control-store";
import { codigoTemporal, firmar } from "./llave";
import { reiniciarProveedores } from "./proveedores-store";

beforeEach(() => {
  reiniciarCaja();
  reiniciarControl();
  reiniciarProveedores();
  fijarFechaDemo("2026-11-18");
  fijarHoraDemo("11:00");
});

const contar = (importe: number) => recuentoSugerido(DENOMINACIONES_INICIALES, "ARS", importe);
const saldo = (cajaId: string) => saldoCaja(S.libro.get(), cajaId, "ARS");

function firma(usuarioId: string, referencia: string, extra: { remota?: boolean; cargadoPor?: string } = {}) {
  const r = firmar({ usuarioId, clave: CLAVE_DEMO, codigo: codigoTemporal(usuarioId), operacion: "Prueba", referencia, ...extra });
  assert.ok(r.ok, r.ok ? "" : r.error);
  return r.ok ? r.firma : (undefined as never);
}

// Apertura de CAJ-003 por Ana con una diferencia sobre la tolerancia (delta sobre el esperado).
function aperturaConDiferencia(delta: number): { jornadaId: string; acta: ActaConformidad } {
  como("ana-gomez");
  const r = registrarApertura("CAJ-003", {
    detalle: contar(saldo("CAJ-003") + delta),
    ajustes: [{ moneda: "ARS", importe: 0, motivoId: "MDC-001", nota: "vuelto" }],
  });
  assert.ok(r.ok && r.estado === "PEND_APERTURA", r.ok ? "" : r.error);
  const jornadaId = r.ok ? r.jornadaId : "";
  const acta = actaDe("JORNADA_APERTURA", jornadaId);
  assert.ok(acta);
  return { jornadaId, acta: acta! };
}

const alertas = (evento: string) => controlStores.alertasEnviadas.get().filter((a) => a.evento === evento);

test("una diferencia sobre la tolerancia genera el acta de diferencia con el responsable de los fondos", () => {
  const { acta } = aperturaConDiferencia(-2000);
  assert.equal(acta.id, "ACT-000001");
  assert.equal(acta.tipo, "DIFERENCIA");
  assert.equal(acta.estado, "PEND_FIRMA_1");
  assert.equal(acta.firmante1Id, "ana-gomez");
  assert.equal(acta.cajaId, "CAJ-003");
  assert.equal(acta.contenido.responsableFondosId, "ana-gomez");
  assert.equal(acta.contenido.diferencia?.ARS, -2000);
  assert.equal(acta.contenido.motivoId, "MDC-001");
});

test("los dos firmantes son usuarios distintos y la disconformidad exige observaciones", () => {
  const { acta } = aperturaConDiferencia(-2000);
  const ana = firma("ana-gomez", acta.id);
  const sinObs = firmarActa(acta.id, { paso: 1, firma: ana, conforme: false });
  assert.ok(!sinObs.ok && /observaciones/i.test(sinObs.error));
  assert.equal(actaPorId(acta.id)?.estado, "PEND_FIRMA_1", "una firma rechazada no mueve el acta");
  const otro = firmarActa(acta.id, { paso: 1, firma: firma("marta-diaz", acta.id), conforme: true });
  assert.ok(!otro.ok && /corresponde/.test(otro.error), "la firma 1 es del responsable");
  const f1 = firmarActa(acta.id, { paso: 1, firma: ana, conforme: false, observaciones: "El vuelto no fue mío" });
  assert.ok(f1.ok && f1.acta.estado === "PEND_FIRMA_2" && f1.acta.firma1?.conforme === false);
  assert.equal(alertas("ACTA_NO_CONFORME").length, 1, "la disconformidad dispara el mail");
  const mismo = firmarActa(acta.id, { paso: 2, firma: firma("ana-gomez", acta.id), conforme: true });
  assert.ok(!mismo.ok && /distintos/.test(mismo.error), "nadie firma las dos puntas");
  const f2 = firmarActa(acta.id, { paso: 2, firma: firma("marta-diaz", acta.id), conforme: true });
  assert.ok(f2.ok && f2.acta.estado === "FIRMADA");
});

test("el supervisor no autoriza el ajuste sin la firma del responsable", () => {
  const { jornadaId, acta } = aperturaConDiferencia(-2000);
  como("marta-diaz");
  const f = firma("marta-diaz", jornadaId, { cargadoPor: "ana-gomez" });
  const r = resolverApertura(jornadaId, true, "ok", f.id);
  assert.ok(!r.ok && /responsable de los fondos/.test(r.error));
  assert.equal(S.jornadas.get()[0].estado, "PEND_APERTURA");
  assert.ok(firmarActa(acta.id, { paso: 1, firma: firma("ana-gomez", acta.id), conforme: true }).ok);
  const ok = resolverApertura(jornadaId, true, "ok", firma("marta-diaz", jornadaId, { cargadoPor: "ana-gomez" }).id);
  assert.ok(ok.ok);
  const cerrada = actaPorId(acta.id)!;
  assert.equal(cerrada.estado, "FIRMADA");
  assert.equal(cerrada.firma2?.usuarioId, "marta-diaz");
  assert.equal(cerrada.ajusteIds?.length, 1, "el acta queda vinculada al movimiento de ajuste");
  assert.equal(S.libro.get().find((m) => m.id === cerrada.ajusteIds?.[0])?.tipo, "Ajuste por faltante");
  assert.equal(S.jornadas.get()[0].estado, "ABIERTA");
});

test("negativa a firmar: queda escalada, avisa, la resuelve un superior con su llave y se autoriza el ajuste", () => {
  const { jornadaId, acta } = aperturaConDiferencia(-2000);
  const sinSup = registrarNegativaAFirmar(acta.id, { firma: firma("ana-gomez", acta.id), observacion: "no firmo" });
  assert.ok(!sinSup.ok, "la negativa la registra un supervisor");
  const sinObs = registrarNegativaAFirmar(acta.id, { firma: firma("marta-diaz", acta.id), observacion: "  " });
  assert.ok(!sinObs.ok && /observación/.test(sinObs.error));
  const n = registrarNegativaAFirmar(acta.id, { firma: firma("marta-diaz", acta.id), observacion: "Se niega a firmar" });
  assert.ok(n.ok && n.acta.estado === "ESCALADA" && n.acta.negativa?.supervisorId === "marta-diaz");
  assert.equal(alertas("NEGATIVA_A_FIRMAR").length, 1);
  // Mientras está escalada no se autoriza por el camino normal.
  como("marta-diaz");
  const bloqueada = resolverApertura(jornadaId, true, "ok", firma("marta-diaz", jornadaId, { cargadoPor: "ana-gomez" }).id);
  assert.ok(!bloqueada.ok && /escalada/.test(bloqueada.error));
  const noSuperior = resolverActaEscalada(acta.id, { firma: firma("raul-molina", acta.id), decision: "AUTORIZAR", observaciones: "ok" });
  assert.ok(!noSuperior.ok, "resuelve el Tesorero central o el Director");
  const mismo = resolverActaEscalada(acta.id, { firma: firma("ricardo-pena", acta.id), decision: "AUTORIZAR", observaciones: "" });
  assert.ok(!mismo.ok, "la resolución lleva observaciones");
  const f = firma("ricardo-pena", acta.id);
  const r = resolverActaEscalada(acta.id, { firma: f, decision: "AUTORIZAR", observaciones: "Autorizo el ajuste" });
  assert.ok(r.ok && r.acta.estado === "RESUELTA" && r.acta.resolucion?.decision === "AUTORIZAR");
  // El superior aplica su resolución en el flujo.
  como("ricardo-pena");
  const ok = resolverApertura(jornadaId, true, "Autorizo el ajuste", f.id);
  assert.ok(ok.ok, ok.ok ? "" : ok.error);
  assert.equal(S.jornadas.get()[0].estado, "ABIERTA");
  assert.equal(actaPorId(acta.id)?.firma1, undefined, "la negativa no registra una conformidad inexistente");
  assert.equal(actaPorId(acta.id)?.ajusteIds?.length, 1);
});

test("rechazo: el supervisor marca No conforme, se repite el recuento y el acta nueva referencia a la rechazada", () => {
  const { jornadaId, acta } = aperturaConDiferencia(-2000);
  assert.ok(firmarActa(acta.id, { paso: 1, firma: firma("ana-gomez", acta.id), conforme: true }).ok);
  como("marta-diaz");
  const sinMotivo = resolverApertura(jornadaId, false, "", firma("marta-diaz", jornadaId, { cargadoPor: "ana-gomez" }).id);
  assert.ok(!sinMotivo.ok);
  const r = resolverApertura(jornadaId, false, "Contá de nuevo", firma("marta-diaz", jornadaId, { cargadoPor: "ana-gomez" }).id);
  assert.ok(r.ok);
  const rechazada = actaPorId(acta.id)!;
  assert.equal(rechazada.estado, "RECHAZADA");
  assert.equal(rechazada.rechazo?.motivo, "Contá de nuevo");
  assert.equal(alertas("ACTA_NO_CONFORME").length, 1, "un solo mail por el acta No conforme");
  assert.equal(S.jornadas.get().length, 0, "se repite el recuento");
  const nueva = aperturaConDiferencia(-2000);
  assert.equal(nueva.acta.referenciaActaId, acta.id);
  assert.equal(actaPorId(acta.id)?.estado, "RECHAZADA", "el acta rechazada no se reabre");
});

test("firma remota de Casa Central para una sucursal con una sola persona", () => {
  const { jornadaId, acta } = aperturaConDiferencia(-2000);
  assert.ok(!solicitarFirmaRemota(acta.id).ok, "primero firma el responsable");
  assert.ok(firmarActa(acta.id, { paso: 1, firma: firma("ana-gomez", acta.id), conforme: true }).ok);
  assert.equal(necesitaFirmaRemota("SUC-002", "ana-gomez"), false, "Bariloche tiene a Marta y a Tomás");
  assert.equal(necesitaFirmaRemota("SUC-009", "ana-gomez"), true, "una sucursal sin otro habilitado");
  const s = solicitarFirmaRemota(acta.id);
  assert.ok(s.ok && s.acta.remota);
  assert.equal(alertas("SOLICITUD_FIRMA_REMOTA").length, 1);
  como("marta-diaz");
  const presencial = resolverApertura(jornadaId, true, "ok", firma("marta-diaz", jornadaId, { cargadoPor: "ana-gomez" }).id);
  assert.ok(!presencial.ok && /remota/.test(presencial.error));
  como("raul-molina");
  const f = firma("raul-molina", jornadaId, { cargadoPor: "ana-gomez", remota: true });
  assert.equal(f.modalidad, "REMOTA");
  assert.ok(resolverApertura(jornadaId, true, "ok", f.id).ok);
  const cerrada = actaPorId(acta.id)!;
  assert.equal(cerrada.estado, "FIRMADA");
  assert.equal(cerrada.remota, true);
  assert.equal(cerrada.firma2?.modalidad, "REMOTA");
});

test("las actas son inalterables: no se firman dos veces ni cambia su contenido", () => {
  const { acta } = aperturaConDiferencia(-2000);
  const foto = JSON.stringify(acta.contenido);
  assert.ok(firmarActa(acta.id, { paso: 1, firma: firma("ana-gomez", acta.id), conforme: true }).ok);
  assert.ok(firmarActa(acta.id, { paso: 2, firma: firma("marta-diaz", acta.id), conforme: true }).ok);
  const final = actaPorId(acta.id)!;
  assert.equal(JSON.stringify(final.contenido), foto, "el contenido es la foto del momento");
  assert.ok(!firmarActa(acta.id, { paso: 1, firma: firma("ana-gomez", acta.id), conforme: true }).ok);
  assert.ok(!firmarActa(acta.id, { paso: 2, firma: firma("raul-molina", acta.id), conforme: false, observaciones: "tarde" }).ok);
  assert.ok(!registrarNegativaAFirmar(acta.id, { firma: firma("marta-diaz", acta.id), observacion: "tarde" }).ok);
  assert.equal(actaPorId(acta.id)?.estado, "FIRMADA");
  // Una corrección es un acta nueva que referencia a la anterior (R1).
  const nueva = crearActa({
    tipo: "DIFERENCIA",
    sucursalId: final.sucursalId,
    cajaId: final.cajaId,
    eventoTipo: final.eventoTipo,
    eventoId: final.eventoId,
    contenido: final.contenido,
    referenciaActaId: final.id,
  });
  assert.ok(nueva.ok && nueva.acta.referenciaActaId === final.id && nueva.acta.id !== final.id);
  assert.equal(actasDeEvento(final.eventoTipo, final.eventoId).length, 2);
  assert.ok(!crearActa({ tipo: "DIFERENCIA", sucursalId: "SUC-002", eventoTipo: "X", eventoId: "Y", contenido: {}, firmante1Id: "ana-gomez", firmante2Id: "ana-gomez" }).ok);
});

function arqueoConDiferencia(delta: number) {
  como("ana-gomez");
  const a = registrarApertura("CAJ-003", { detalle: contar(saldo("CAJ-003")) });
  assert.ok(a.ok && a.estado === "ABIERTA");
  como("marta-diaz");
  const i = iniciarArqueo("CAJ-003", "SORPRESIVO");
  assert.ok(i.ok);
  const arqueoId = i.ok ? i.arqueoId : "";
  assert.ok(registrarConteoArqueo(arqueoId, contar(saldo("CAJ-003") + delta)).ok);
  assert.ok(finalizarArqueo(arqueoId).ok);
  const acta = actaDe("ARQUEO", arqueoId)!;
  return { arqueoId, acta };
}

for (const [nombre, delta, tipoAjuste] of [
  ["faltante", -10000, "Ajuste por faltante"],
  ["sobrante", 10000, "Ajuste por sobrante"],
] as const) {
  test(`arqueo con ${nombre}: el cajero firma, otro supervisor autoriza el ajuste y el acta queda vinculada`, () => {
    const { arqueoId, acta } = arqueoConDiferencia(delta);
    assert.equal(acta.tipo, "DIFERENCIA");
    assert.equal(acta.firmante1Id, "ana-gomez", "el responsable es el cajero de la caja arqueada");
    assert.equal(acta.contenido.detectoId, "marta-diaz", "detectó el controlador");
    assert.equal(acta.contenido.diferencia?.ARS, delta);
    // Mismo rigor para sobrante y faltante: sin la firma del responsable no hay ajuste.
    como("raul-molina");
    const antes = ajustarDiferenciaArqueo(arqueoId, "MDC-001", "ok", firma("raul-molina", arqueoId, { cargadoPor: "marta-diaz" }).id);
    assert.ok(!antes.ok && /responsable de los fondos/.test(antes.error));
    assert.ok(firmarActa(acta.id, { paso: 1, firma: firma("ana-gomez", acta.id), conforme: true }).ok);
    const ok = ajustarDiferenciaArqueo(arqueoId, "MDC-001", "ok", firma("raul-molina", arqueoId, { cargadoPor: "marta-diaz" }).id);
    assert.ok(ok.ok, ok.ok ? "" : ok.error);
    const cerrada = actaPorId(acta.id)!;
    assert.equal(cerrada.estado, "FIRMADA");
    assert.equal(S.libro.get().find((m) => m.id === cerrada.ajusteIds?.[0])?.tipo, tipoAjuste);
  });
}

test("arqueo: el ajuste rechazado deja el acta Rechazada y el arqueo nuevo la referencia", () => {
  const { arqueoId, acta } = arqueoConDiferencia(-10000);
  assert.ok(firmarActa(acta.id, { paso: 1, firma: firma("ana-gomez", acta.id), conforme: false, observaciones: "Yo conté bien" }).ok);
  como("raul-molina");
  const r = rechazarAjusteArqueo(arqueoId, "Hay que verificar de nuevo", firma("raul-molina", arqueoId, { cargadoPor: "marta-diaz" }).id);
  assert.ok(r.ok);
  assert.equal(actaPorId(acta.id)?.estado, "RECHAZADA");
  assert.ok(S.arqueos.get().find((a) => a.id === arqueoId)?.ajusteRechazado);
  assert.ok(!ajustarDiferenciaArqueo(arqueoId, "MDC-001", "ok").ok, "ya no se autoriza ese ajuste");
  como("marta-diaz");
  const i = iniciarArqueo("CAJ-003", "SORPRESIVO");
  assert.ok(i.ok);
  assert.ok(registrarConteoArqueo(i.ok ? i.arqueoId : "", contar(saldo("CAJ-003") - 10000)).ok);
  assert.ok(finalizarArqueo(i.ok ? i.arqueoId : "").ok);
  assert.equal(actaDe("ARQUEO", i.ok ? i.arqueoId : "")?.referenciaActaId, acta.id);
});

test("arqueo sin diferencia: acta de conformidad del controlador y el cajero", () => {
  como("ana-gomez");
  assert.ok(registrarApertura("CAJ-003", { detalle: contar(saldo("CAJ-003")) }).ok);
  como("marta-diaz");
  const i = iniciarArqueo("CAJ-003", "ORDINARIO");
  assert.ok(i.ok);
  const id = i.ok ? i.arqueoId : "";
  assert.ok(registrarConteoArqueo(id, contar(saldo("CAJ-003"))).ok);
  assert.ok(finalizarArqueo(id).ok);
  const acta = actaDe("ARQUEO", id)!;
  assert.equal(acta.tipo, "ARQUEO");
  assert.equal(acta.firmante1Id, "marta-diaz");
  assert.equal(acta.firmante2Id, "ana-gomez");
  assert.ok(firmarActa(acta.id, { paso: 1, firma: firma("marta-diaz", acta.id), conforme: true }).ok);
  assert.ok(!firmarActa(acta.id, { paso: 2, firma: firma("marta-diaz", acta.id), conforme: true }).ok);
  const f2 = firmarActa(acta.id, { paso: 2, firma: firma("ana-gomez", acta.id), conforme: true });
  assert.ok(f2.ok && f2.acta.estado === "FIRMADA");
});

test("una apertura sin diferencia genera el acta de apertura, sin trabar la caja", () => {
  como("ana-gomez");
  const r = registrarApertura("CAJ-003", { detalle: contar(saldo("CAJ-003")) });
  assert.ok(r.ok && r.estado === "ABIERTA");
  const acta = actaDe("JORNADA_APERTURA", r.ok ? r.jornadaId : "")!;
  assert.equal(acta.tipo, "APERTURA");
  assert.equal(acta.estado, "PEND_FIRMA_1");
  assert.equal(acta.firmante1Id, "ana-gomez");
  assert.ok(firmarActa(acta.id, { paso: 1, firma: firma("ana-gomez", acta.id), conforme: true }).ok);
  const f2 = firmarActa(acta.id, { paso: 2, firma: firma("marta-diaz", acta.id), conforme: true });
  assert.ok(f2.ok && f2.acta.estado === "FIRMADA");
});

test("reemplazo por emergencia: lo inicia el supervisor, exige motivo y el acta marca la firma en nombre del saliente", () => {
  como("ana-gomez");
  assert.ok(registrarApertura("CAJ-003", { detalle: contar(saldo("CAJ-003")) }).ok);
  como("tomas-ruiz");
  assert.ok(!solicitarCambioTurno("CAJ-003", "luis-pereyra", { variante: "REEMPLAZO", motivo: "x" }).ok, "un cajero ajeno no lo inicia");
  como("marta-diaz");
  assert.ok(!solicitarCambioTurno("CAJ-003", "luis-pereyra", { variante: "REEMPLAZO" }).ok, "el motivo es obligatorio");
  assert.ok(!solicitarCambioTurno("CAJ-003", "luis-pereyra").ok, "un relevo común lo pide el saliente");
  const s = solicitarCambioTurno("CAJ-003", "luis-pereyra", { variante: "REEMPLAZO", motivo: "El cajero se sintió mal" });
  assert.ok(s.ok);
  const id = s.ok ? s.cambioId : "";
  const cambio = S.cambiosTurno.get().find((c) => c.id === id)!;
  assert.equal(cambio.salienteId, "ana-gomez");
  assert.equal(cambio.iniciadoPor, "marta-diaz");
  // El Supervisor cuenta en nombre del saliente.
  assert.ok(cargarArqueoRelevo(id, { detalle: contar(saldo("CAJ-003")) }).ok);
  como("luis-pereyra");
  const rec = recibirTurno(id, contar(saldo("CAJ-003")));
  assert.ok(rec.ok && rec.estado === "COMPLETADO");
  const acta = actaDe("RELEVO_CONFORMIDAD", id)!;
  assert.equal(acta.tipo, "REEMPLAZO");
  assert.equal(acta.firmante1Id, "ana-gomez");
  assert.equal(acta.firmante2Id, "luis-pereyra");
  const f1 = firmarActa(acta.id, { paso: 1, firma: firma("marta-diaz", acta.id), conforme: true, enNombreDe: "ana-gomez" });
  assert.ok(f1.ok && f1.acta.firma1?.enNombreDe === "ana-gomez", "queda marcado en el acta");
  const f2 = firmarActa(acta.id, { paso: 2, firma: firma("luis-pereyra", acta.id), conforme: true });
  assert.ok(f2.ok && f2.acta.estado === "FIRMADA");
});

test("relevo con diferencia: el acta de diferencia se atribuye al saliente", () => {
  como("ana-gomez");
  assert.ok(registrarApertura("CAJ-003", { detalle: contar(saldo("CAJ-003")) }).ok);
  const s = solicitarCambioTurno("CAJ-003", "luis-pereyra");
  assert.ok(s.ok);
  const id = s.ok ? s.cambioId : "";
  const r = cargarArqueoRelevo(id, {
    detalle: contar(saldo("CAJ-003") - 10000),
    ajustes: [{ moneda: "ARS", importe: 0, motivoId: "MDC-001", nota: "vuelto" }],
  });
  assert.ok(r.ok && r.estado === "PEND_AUTORIZACION");
  const acta = actaDe("RELEVO", id)!;
  assert.equal(acta.tipo, "DIFERENCIA");
  assert.equal(acta.firmante1Id, "ana-gomez", "la diferencia es del saliente, no del entrante");
  assert.equal(acta.contenido.responsableFondosId, "ana-gomez");
});

test("el historial de actas se limita al ámbito del usuario", () => {
  aperturaConDiferencia(-2000);
  const cajas = S.cajas.get();
  const todas = S.actas.get();
  assert.equal(actasVisibles(usuarioPorId("ricardo-pena")!, todas, cajas).length, todas.length, "Casa Central ve todo");
  assert.equal(actasVisibles(usuarioPorId("marta-diaz")!, todas, cajas).length, todas.length, "la supervisora ve su sucursal");
  assert.equal(actasVisibles(usuarioPorId("carlos-ibarra")!, todas, cajas).length, 0, "otra sucursal no ve estas actas");
});
