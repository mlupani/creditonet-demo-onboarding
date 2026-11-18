import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import { CAJAS_INICIALES, DENOMINACIONES_INICIALES, SUCURSALES_INICIALES, USUARIOS_CAJA } from "./caja-datos";
import {
  autorizarMovimiento,
  cargarArqueoRelevo,
  cargarBoletaDeposito,
  crearMovimiento,
  crearPedidoRefuerzo,
  enviarMovimiento,
  errorNuevoMovimiento,
  finalizarArqueo,
  iniciarArqueo,
  recibirMovimiento,
  recibirTurno,
  registrarApertura,
  registrarCierre,
  registrarConteoArqueo,
  resolverApertura,
  resolverIncidenciaMovimiento,
  resolverPedidoRefuerzo,
  solicitarCambioTurno,
  type NuevoMovimiento,
} from "./caja-operaciones";
import {
  erroresCaja,
  errorBajaCaja,
  errorBajaSucursal,
  fueraDeTolerancia,
  recuentoSugerido,
  saldoCaja,
  totalRecuento,
} from "./caja-reglas";
import { cajaStores as S, fijarUsuarioActual, reiniciarCaja } from "./caja-store";

const den = DENOMINACIONES_INICIALES;
const contar = (moneda: "ARS" | "USD", importe: number) => recuentoSugerido(den, moneda, importe);
const saldo = (cajaId: string, moneda: "ARS" | "USD" = "ARS") => saldoCaja(S.libro.get(), cajaId, moneda);
const como = fijarUsuarioActual;

// Abre una caja con el recuento exacto del saldo esperado.
function abrir(cajaId: string, usuario: string, monedas: ("ARS" | "USD")[] = ["ARS"]) {
  como(usuario);
  const detalle = Object.assign({}, ...monedas.map((m) => contar(m, saldo(cajaId, m))));
  const r = registrarApertura(cajaId, { detalle });
  assert.ok(r.ok, r.ok ? "" : r.error);
}

beforeEach(() => reiniciarCaja());

test("el recuento suma billetes y monedas por moneda y sugiere el importe exacto", () => {
  const detalle = contar("ARS", 123456);
  assert.equal(totalRecuento(detalle, den).ARS, 123456);
  assert.equal(totalRecuento(contar("USD", 1875), den).USD, 1875);
});

test("la tolerancia se evalúa por moneda y distingue sobrante de faltante", () => {
  const caja = CAJAS_INICIALES[2]; // tolerancia $ 500
  assert.equal(fueraDeTolerancia(caja, "ARS", 500), false);
  assert.equal(fueraDeTolerancia(caja, "ARS", 501), true);
  assert.equal(fueraDeTolerancia(caja, "ARS", -501), true);
  assert.equal(fueraDeTolerancia(caja, "ARS", 0), false);
});

test("apertura sin diferencia: la caja queda abierta y no se puede abrir dos veces", () => {
  abrir("CAJ-003", "ana-gomez");
  assert.equal(S.jornadas.get()[0].estado, "ABIERTA");
  const otra = registrarApertura("CAJ-003", { detalle: contar("ARS", 600000) });
  assert.ok(!otra.ok);
});

test("sólo un usuario asignado a la caja puede abrirla, dentro de su turno", () => {
  como("luis-pereyra"); // su turno es de 14:00 a 18:00 y la hora de la demo es 11:00
  const r = registrarApertura("CAJ-003", { detalle: contar("ARS", 600000) });
  assert.ok(!r.ok);
  como("marta-diaz");
  assert.ok(!registrarApertura("CAJ-003", { detalle: contar("ARS", 600000) }).ok);
});

test("diferencia mayor a la tolerancia: exige motivo, queda pendiente y la aprueba otro usuario", () => {
  como("ana-gomez");
  const sin = registrarApertura("CAJ-003", { detalle: contar("ARS", 598000) });
  assert.ok(!sin.ok, "sin motivo no avanza");
  const r = registrarApertura("CAJ-003", {
    detalle: contar("ARS", 598000),
    ajustes: [{ moneda: "ARS", importe: 0, motivoId: "MDC-001", nota: "vuelto" }],
  });
  assert.ok(r.ok && r.estado === "PEND_APERTURA");
  assert.equal(saldo("CAJ-003"), 600000, "mientras está pendiente no se toca el saldo");
  const jornadaId = r.ok ? r.jornadaId : "";
  assert.ok(!resolverApertura(jornadaId, true, "").ok, "el cajero no es supervisor");
  como("marta-diaz");
  assert.ok(resolverApertura(jornadaId, true, "ok").ok);
  assert.equal(S.jornadas.get()[0].estado, "ABIERTA");
  assert.equal(saldo("CAJ-003"), 598000, "la diferencia aprobada genera un ajuste en el libro");
  assert.equal(S.libro.get().at(-1)?.egreso, 2000);
});

test("el supervisor que carga el recuento no puede aprobarlo él mismo", () => {
  // Un usuario puede tener más de un rol: Marta pasa a ser supervisora y cajera para armar el caso.
  const marta = USUARIOS_CAJA.find((u) => u.id === "marta-diaz")!;
  marta.roles.push("CAJERO");
  try {
    const caja = { ...CAJAS_INICIALES[2], cajeros: [{ usuarioId: "marta-diaz", desde: "10:00", hasta: "18:00", estado: "ACTIVO" as const }] };
    S.cajas.commit(S.cajas.get().map((c) => (c.id === caja.id ? caja : c)));
    como("marta-diaz");
    const r = registrarApertura("CAJ-003", {
      detalle: contar("ARS", 590000),
      ajustes: [{ moneda: "ARS", importe: 0, motivoId: "MDC-004", nota: "" }],
    });
    assert.ok(r.ok && r.estado === "PEND_APERTURA");
    assert.ok(!resolverApertura(r.ok ? r.jornadaId : "", true, "").ok);
  } finally {
    marta.roles.pop();
  }
});

test("cierre: bloquea nuevas operaciones de la fecha y no se puede reabrir el mismo día", () => {
  abrir("CAJ-003", "ana-gomez");
  const c = registrarCierre("CAJ-003", { detalle: contar("ARS", 600000) });
  assert.ok(c.ok && c.estado === "CERRADA");
  assert.ok(!registrarApertura("CAJ-003", { detalle: contar("ARS", 600000) }).ok);
});

test("circuito de tesorería: solicitud, autorización, envío, tránsito y aceptación", () => {
  abrir("CAJ-002", "tomas-ruiz", ["ARS", "USD"]);
  abrir("CAJ-003", "ana-gomez");
  const antesOrigen = saldo("CAJ-002");
  const antesDestino = saldo("CAJ-003");

  assert.ok(!enviarMovimiento("MT-0002", contar("ARS", 400000), true).ok, "sin autorización no sale el dinero");
  como("tomas-ruiz");
  assert.ok(!autorizarMovimiento("MT-0002", true, "").ok, "Tomás cargó el movimiento y no es supervisor");
  como("marta-diaz");
  assert.ok(autorizarMovimiento("MT-0002", true, "").ok);

  como("tomas-ruiz");
  assert.ok(!enviarMovimiento("MT-0002", contar("ARS", 399000), true).ok, "el recuento tiene que coincidir con el importe");
  assert.ok(enviarMovimiento("MT-0002", contar("ARS", 400000), true).ok);
  assert.equal(S.movimientos.get().find((m) => m.id === "MT-0002")?.estado, "EN_TRANSITO");
  assert.equal(saldo("CAJ-002"), antesOrigen - 400000);
  assert.equal(saldo("CAJ-003"), antesDestino, "en tránsito no figura en el destino");

  como("ana-gomez");
  const r = recibirMovimiento("MT-0002", contar("ARS", 400000));
  assert.ok(r.ok && r.estado === "ACEPTADO");
  assert.equal(saldo("CAJ-003"), antesDestino + 400000);
  const enLibro = S.libro.get().filter((m) => m.refId === "MT-0002");
  assert.equal(enLibro.length, 2, "salida y entrada comparten el ID de referencia");
});

test("recepción con diferencia: queda con incidencia hasta que otro supervisor resuelva", () => {
  abrir("CAJ-002", "tomas-ruiz", ["ARS", "USD"]);
  abrir("CAJ-003", "ana-gomez");
  como("marta-diaz");
  autorizarMovimiento("MT-0002", true, "");
  como("tomas-ruiz");
  enviarMovimiento("MT-0002", contar("ARS", 400000), true);
  const antes = saldo("CAJ-003");
  como("ana-gomez");
  const r = recibirMovimiento("MT-0002", contar("ARS", 398000));
  assert.ok(r.ok && r.estado === "CON_INCIDENCIA");
  assert.equal(saldo("CAJ-003"), antes, "el dinero no se integra hasta resolver");
  assert.ok(!resolverIncidenciaMovimiento("MT-0002", 398000, "recontado").ok, "Ana no es supervisora");
  como("raul-molina");
  assert.ok(resolverIncidenciaMovimiento("MT-0002", 398000, "recontado").ok);
  assert.equal(saldo("CAJ-003"), antes + 398000);
});

test("validaciones del nuevo movimiento: saldo, pase a sí misma y tipos permitidos", () => {
  const base: NuevoMovimiento = {
    tipoId: "TMT-006",
    origenId: "CAJ-003",
    destino: { tipo: "CAJA", cajaId: "CAJ-003" },
    moneda: "ARS",
    importe: 1000,
    motivo: "pase",
    precinto: "",
    observaciones: "",
  };
  assert.match(errorNuevoMovimiento(base) ?? "", /misma|sí misma/);
  assert.match(errorNuevoMovimiento({ ...base, tipoId: "TMT-005", destino: { tipo: "CAJA", cajaId: "CAJ-001" } }) ?? "", /origen/);
  assert.match(
    errorNuevoMovimiento({ ...base, tipoId: "TMT-005", origenId: "CAJ-002", destino: { tipo: "CAJA", cajaId: "CAJ-001" }, importe: 99999999999, transportista: { tipo: "EMPLEADO", nombre: "A", documento: "1" } }) ?? "",
    /saldo/
  );
  como("tomas-ruiz");
  assert.ok(!crearMovimiento({ ...base, tipoId: "TMT-005", origenId: "CAJ-001", destino: { tipo: "CAJA", cajaId: "CAJ-002" } }).ok, "Tomás no es responsable del tesoro central");
});

test("depósito en banco: queda en tránsito hasta cargar la boleta", () => {
  abrir("CAJ-002", "tomas-ruiz", ["ARS", "USD"]);
  como("tomas-ruiz");
  const c = crearMovimiento({
    tipoId: "TMT-007",
    origenId: "CAJ-002",
    destino: { tipo: "BANCO", cuentaId: "cb-1" },
    moneda: "ARS",
    importe: 1000000,
    motivo: "Depósito semanal",
    transportista: { tipo: "EMPRESA", nombre: "Transportadora Andina", documento: "30-1" },
    precinto: "P-1",
    observaciones: "",
  });
  assert.ok(c.ok);
  const id = c.ok ? c.movimientoId : "";
  como("marta-diaz");
  autorizarMovimiento(id, true, "");
  como("tomas-ruiz");
  assert.ok(enviarMovimiento(id, contar("ARS", 1000000), true).ok);
  assert.ok(!cargarBoletaDeposito(id, " ").ok);
  assert.ok(cargarBoletaDeposito(id, "BOL-123").ok);
  assert.equal(S.movimientos.get().find((m) => m.id === id)?.estado, "ACEPTADO");
});

test("pedido de refuerzo: no mueve dinero y al aprobarlo genera el movimiento", () => {
  como("tomas-ruiz");
  const antes = saldo("CAJ-001");
  como("carlos-ibarra");
  const r = resolverPedidoRefuerzo("PR-0001", true, 1500000, "parcial");
  assert.ok(r.ok && r.movimientoId);
  assert.equal(saldo("CAJ-001"), antes, "el pedido no mueve dinero hasta el envío");
  const mov = S.movimientos.get().find((m) => m.id === (r.ok ? r.movimientoId : ""));
  assert.equal(mov?.importe, 1500000);
  assert.equal(mov?.estado, "SOLICITADO");
  assert.ok(!crearPedidoRefuerzo({ solicitanteCajaId: "CAJ-003", aCajaId: "CAJ-003", moneda: "ARS", importe: 1, motivo: "x" }).ok);
});

test("arqueo: el controlador no puede ser responsable, bloquea la caja y no corrige saldos", () => {
  abrir("CAJ-003", "ana-gomez");
  como("tomas-ruiz"); // tesorero, pero no responsable de la caja 1
  const a = iniciarArqueo("CAJ-003", "SORPRESIVO");
  assert.ok(a.ok);
  const id = a.ok ? a.arqueoId : "";
  como("ana-gomez");
  assert.ok(!registrarCierre("CAJ-003", { detalle: contar("ARS", 600000) }).ok, "caja bloqueada durante el arqueo");
  como("tomas-ruiz");
  registrarConteoArqueo(id, contar("ARS", 599000));
  assert.ok(finalizarArqueo(id).ok);
  assert.equal(S.arqueos.get()[0].resultado, "CON_DIFERENCIA");
  assert.equal(saldo("CAJ-003"), 600000, "el arqueo no corrige el saldo");
  como("ana-gomez");
  assert.ok(!iniciarArqueo("CAJ-003", "ORDINARIO").ok, "Ana es responsable y no tiene permiso");
});

test("cambio de turno: relevo con arqueo y aceptación del entrante", () => {
  abrir("CAJ-003", "ana-gomez");
  const s = solicitarCambioTurno("CAJ-003", "luis-pereyra");
  assert.ok(s.ok);
  const id = s.ok ? s.cambioId : "";
  const arq = cargarArqueoRelevo(id, { detalle: contar("ARS", 600000) });
  assert.ok(arq.ok && arq.estado === "PEND_RECEPCION");
  como("ana-gomez");
  assert.ok(!recibirTurno(id, contar("ARS", 600000)).ok, "la recepción la hace el entrante");
  como("luis-pereyra");
  const mal = recibirTurno(id, contar("ARS", 590000));
  assert.ok(mal.ok && mal.estado === "CON_INCIDENCIA");
});

test("ABM: reglas de sucursales y cajas", () => {
  // Una sucursal con cajas activas no se puede suspender.
  assert.ok(errorBajaSucursal(SUCURSALES_INICIALES[1], CAJAS_INICIALES));
  assert.equal(errorBajaSucursal(SUCURSALES_INICIALES[2], CAJAS_INICIALES), undefined);
  // Una caja con saldo no se puede suspender.
  assert.match(errorBajaCaja(CAJAS_INICIALES[2], S.libro.get(), []) ?? "", /saldo/);
  // Un único tesoro central y turnos que no se superponen.
  const central = { ...CAJAS_INICIALES[0], id: "CAJ-099", nombre: "Otro central" };
  assert.ok(erroresCaja(central, CAJAS_INICIALES, SUCURSALES_INICIALES, USUARIOS_CAJA).tipo);
  const solapada = {
    ...CAJAS_INICIALES[2],
    id: "CAJ-098",
    nombre: "Caja 2",
    cajeros: [
      { usuarioId: "ana-gomez", desde: "10:00", hasta: "15:00", estado: "ACTIVO" as const },
      { usuarioId: "luis-pereyra", desde: "14:00", hasta: "18:00", estado: "ACTIVO" as const },
    ],
  };
  assert.match(erroresCaja(solapada, CAJAS_INICIALES, SUCURSALES_INICIALES, USUARIOS_CAJA).cajeros ?? "", /superponer/);
  const fuera = { ...solapada, cajeros: [{ usuarioId: "ana-gomez", desde: "09:00", hasta: "12:00", estado: "ACTIVO" as const }] };
  assert.match(erroresCaja(fuera, CAJAS_INICIALES, SUCURSALES_INICIALES, USUARIOS_CAJA).cajeros ?? "", /horario/);
});
