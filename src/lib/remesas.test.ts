import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import { DENOMINACIONES_INICIALES } from "./caja-datos";
import {
  autorizarMovimiento,
  crearMovimiento,
  enviarMovimiento,
  errorAutorizarMovimiento,
  finalizarMovimiento,
  posicionDeCaja,
  recibirMovimiento,
  registrarApertura,
  registrarExtraccion,
  resolverPedidoRefuerzo,
  saldosBancarios,
  type NuevoMovimiento,
} from "./caja-operaciones";
import { seriesDe } from "./caja-posicion";
import { recuentoSugerido, saldoCaja } from "./caja-reglas";
import { cajaStores as S, fijarFechaDemo, fijarUsuarioActual as como, reiniciarCaja, usuarioPorId } from "./caja-store";
import { ESTADOS_MOVIMIENTO } from "./caja-tipos";
import { reiniciarControl } from "./control-store";
import { reiniciarProveedores } from "./proveedores-store";

const contar = (importe: number) => recuentoSugerido(DENOMINACIONES_INICIALES, "ARS", importe);
const saldo = (cajaId: string) => saldoCaja(S.libro.get(), cajaId, "ARS");
const transporte = { tipo: "EMPLEADO" as const, nombre: "A", documento: "1" };

// Abre la caja contando exacto el saldo esperado de cada moneda en la que opera.
function abrir(cajaId: string, usuario: string) {
  como(usuario);
  const usd = saldoCaja(S.libro.get(), cajaId, "USD");
  const detalle = { ...contar(saldo(cajaId)), ...(usd > 0 ? recuentoSugerido(DENOMINACIONES_INICIALES, "USD", usd) : {}) };
  const r = registrarApertura(cajaId, { detalle });
  assert.ok(r.ok, r.ok ? "" : r.error);
}

// Remesa del tesoro de Bariloche al central (carga Tomás, que es responsable de CAJ-002).
const remesa = (importe: number): NuevoMovimiento => ({
  tipoId: "TMT-005",
  origenId: "CAJ-002",
  destino: { tipo: "CAJA", cajaId: "CAJ-001" },
  moneda: "ARS",
  importe,
  motivo: "Remesa",
  transportista: transporte,
  precinto: "",
  observaciones: "",
});

const pedidoABanco = (importe: number): NuevoMovimiento => ({
  tipoId: "TMT-010",
  origenId: "CAJ-002",
  origenBancoId: "CB-001",
  destino: { tipo: "CAJA", cajaId: "CAJ-002" },
  moneda: "ARS",
  importe,
  motivo: "Reponer efectivo del tesoro",
  transportista: transporte,
  precinto: "",
  observaciones: "",
});

const idDe = (r: { ok: boolean; movimientoId?: string }) => {
  assert.ok(r.ok && r.movimientoId);
  return r.movimientoId as string;
};
const mov = (id: string) => S.movimientos.get().find((m) => m.id === id);

beforeEach(() => {
  reiniciarCaja();
  reiniciarControl();
  reiniciarProveedores();
  fijarFechaDemo("2026-11-18");
});

test("la matriz decide quién autoriza según el importe y nadie autoriza lo que cargó", () => {
  como("tomas-ruiz");
  const chica = idDe(crearMovimiento(remesa(1000000)));
  const grande = idDe(crearMovimiento(remesa(7000000)));
  const marta = usuarioPorId("marta-diaz");
  const ricardo = usuarioPorId("ricardo-pena");
  assert.equal(errorAutorizarMovimiento(mov(chica)!, marta), null, "el supervisor llega hasta $ 5.000.000");
  assert.match(errorAutorizarMovimiento(mov(grande)!, marta) ?? "", /Tesorero central/, "por encima del tope autoriza el Tesorero central");
  assert.equal(errorAutorizarMovimiento(mov(grande)!, ricardo), null);
  assert.match(errorAutorizarMovimiento(mov(chica)!, usuarioPorId("tomas-ruiz")) ?? "", /cargó/, "nadie autoriza lo propio");
  assert.ok(errorAutorizarMovimiento(mov(chica)!, usuarioPorId("ana-gomez")) !== null, "un cajero no autoriza");
  como("marta-diaz");
  assert.ok(!autorizarMovimiento(grande, true, "").ok);
  como("ricardo-pena");
  assert.ok(autorizarMovimiento(grande, true, "", "FIR-0001").ok);
  assert.equal(mov(grande)?.autorizacion?.firmaId, "FIR-0001", "la autorización guarda la firma con llave");
});

test("al autorizar se crea una única reserva en el origen y baja el estimado", () => {
  como("tomas-ruiz");
  const id = idDe(crearMovimiento(remesa(2000000)));
  const antes = posicionDeCaja("CAJ-002", "ARS");
  assert.equal(antes.comprometido, 0);
  como("marta-diaz");
  assert.ok(autorizarMovimiento(id, true, "").ok);
  const despues = posicionDeCaja("CAJ-002", "ARS");
  assert.equal(despues.comprometido, 2000000, "se suma una sola vez (no se duplica con la tabla de reservas)");
  assert.equal(despues.estimado, antes.estimado - 2000000);
  assert.equal(despues.real, antes.real, "reservar no mueve el real");
  assert.equal(S.reservas.get().filter((r) => r.operacionId === id).length, 0, "en una caja la reserva es el propio movimiento autorizado");
});

test("no se autoriza un movimiento que supere el estimado, aunque el real alcance", () => {
  como("tomas-ruiz");
  const id = idDe(crearMovimiento(remesa(1000000)));
  // Después de cargarlo, otra operación (por ejemplo un pago) reserva casi todo el saldo del tesoro de Bariloche.
  S.reservas.commit([
    ...S.reservas.get(),
    {
      id: "RSV-9001",
      origenTipo: "CAJA",
      origenId: "CAJ-002",
      moneda: "ARS",
      importe: 7400000,
      operacionTipo: "PAGO",
      operacionId: "PAG-9001",
      estado: "ACTIVA",
      creada: { usuarioId: "tomas-ruiz", fechaHora: "2026-11-18 10:00" },
    },
  ]);
  como("marta-diaz");
  const r = autorizarMovimiento(id, true, "");
  assert.ok(!r.ok && /estimado/.test(r.error), "el real alcanza pero el estimado (600.000) no");
  assert.equal(mov(id)?.estado, "SOLICITADO");
});

test("la solicitud valida contra el saldo estimado del origen", () => {
  S.reservas.commit([
    ...S.reservas.get(),
    {
      id: "RSV-9001",
      origenTipo: "CAJA",
      origenId: "CAJ-002",
      moneda: "ARS",
      importe: 7400000,
      operacionTipo: "PAGO",
      operacionId: "PAG-9001",
      estado: "ACTIVA",
      creada: { usuarioId: "tomas-ruiz", fechaHora: "2026-11-18 10:00" },
    },
  ]);
  como("tomas-ruiz");
  const r = crearMovimiento(remesa(1000000));
  assert.ok(!r.ok && /estimado/.test(r.error), "el estimado es 600.000: no alcanza para 1.000.000");
  assert.ok(crearMovimiento(remesa(500000)).ok);
});

test("entrega con acta del portador y recepción con acta: el movimiento queda Finalizado", () => {
  abrir("CAJ-002", "tomas-ruiz");
  abrir("CAJ-001", "carlos-ibarra");
  como("tomas-ruiz");
  const id = idDe(crearMovimiento(remesa(1000000)));
  como("marta-diaz");
  assert.ok(autorizarMovimiento(id, true, "", "FIR-0002").ok);
  como("tomas-ruiz");
  const sinPortador = enviarMovimiento(id, contar(1000000), true, { firmaId: "FIR-0003", portadorConforme: false });
  assert.ok(!sinPortador.ok && /portador/.test(sinPortador.error), "el portador tiene que firmar el acta de entrega");
  assert.ok(enviarMovimiento(id, contar(1000000), true, { firmaId: "FIR-0003", portadorConforme: true }).ok);
  assert.equal(mov(id)?.envio?.firmaId, "FIR-0003");
  assert.equal(mov(id)?.envio?.portadorConforme, true);
  como("carlos-ibarra");
  const r = recibirMovimiento(id, contar(1000000), "FIR-0004");
  assert.ok(r.ok && r.estado === "FINALIZADO");
  assert.equal(mov(id)?.recepcion?.firmaId, "FIR-0004");
  assert.match(mov(id)?.finalizacion?.documento ?? "", /FIR-0004/);
});

test("sin acta la recepción queda Aceptada y se finaliza al documentarla", () => {
  abrir("CAJ-002", "tomas-ruiz");
  abrir("CAJ-001", "carlos-ibarra");
  como("tomas-ruiz");
  const id = idDe(crearMovimiento(remesa(1000000)));
  como("marta-diaz");
  autorizarMovimiento(id, true, "");
  como("tomas-ruiz");
  enviarMovimiento(id, contar(1000000), true);
  como("carlos-ibarra");
  const r = recibirMovimiento(id, contar(1000000));
  assert.ok(r.ok && r.estado === "ACEPTADO");
  assert.ok(!finalizarMovimiento(id, " ").ok, "hace falta el número del acta o de la boleta");
  como("ana-gomez");
  assert.ok(!finalizarMovimiento(id, "ACT-1").ok, "una cajera ajena no lo documenta");
  como("carlos-ibarra");
  assert.ok(finalizarMovimiento(id, "ACT-0001").ok);
  assert.equal(mov(id)?.estado, "FINALIZADO");
  assert.ok(!finalizarMovimiento(id, "ACT-0002").ok, "un movimiento finalizado no se documenta de nuevo");
});

test("el estado Finalizado figura entre los estados de movimiento", () => {
  const f = ESTADOS_MOVIMIENTO.find((e) => e.id === "FINALIZADO");
  assert.ok(f);
  assert.match(f.significado, /acta|boleta/i);
});

test("pedido de refuerzo a banco: se reserva en la cuenta, la extracción baja el real y el tesoro lo cuenta", () => {
  abrir("CAJ-002", "tomas-ruiz");
  como("tomas-ruiz");
  const antesCuenta = saldosBancarios().find((s) => s.cuentaId === "CB-001")!;
  const antesCaja = saldo("CAJ-002");
  const id = idDe(crearMovimiento(pedidoABanco(1000000)));
  assert.equal(mov(id)?.estado, "SOLICITADO");
  assert.equal(mov(id)?.origenBancoId, "CB-001");
  assert.deepEqual(mov(id)?.destino, { tipo: "CAJA", cajaId: "CAJ-002" });

  como("marta-diaz");
  assert.ok(autorizarMovimiento(id, true, "").ok);
  const reserva = S.reservas.get().find((r) => r.operacionId === id);
  assert.equal(reserva?.origenTipo, "BANCO");
  assert.equal(reserva?.estado, "ACTIVA");
  const reservada = saldosBancarios().find((s) => s.cuentaId === "CB-001")!;
  assert.equal(reservada.comprometido, antesCuenta.comprometido + 1000000);
  assert.equal(reservada.real, antesCuenta.real, "autorizar no mueve el real del banco");
  assert.equal(posicionDeCaja("CAJ-002", "ARS").comprometido, 0, "no reserva en el tesoro que recibe");

  como("tomas-ruiz");
  assert.ok(!enviarMovimiento(id, contar(1000000), true).ok, "un pedido a banco no se envía: se extrae");
  assert.ok(!registrarExtraccion(id, " ").ok, "falta la boleta de extracción");
  assert.ok(registrarExtraccion(id, "EXT-001").ok);
  const extraido = saldosBancarios().find((s) => s.cuentaId === "CB-001")!;
  assert.equal(extraido.real, antesCuenta.real - 1000000, "la extracción baja el real de la cuenta");
  assert.equal(extraido.comprometido, antesCuenta.comprometido, "la reserva se consume");
  assert.equal(S.reservas.get().find((r) => r.operacionId === id)?.estado, "CONSUMIDA");
  assert.equal(mov(id)?.estado, "EN_TRANSITO");
  assert.equal(saldo("CAJ-002"), antesCaja, "todavía no entró al tesoro");

  const r = recibirMovimiento(id, contar(1000000));
  assert.ok(r.ok && r.estado === "FINALIZADO", "la boleta de extracción documenta el movimiento");
  assert.equal(saldo("CAJ-002"), antesCaja + 1000000);
  assert.match(mov(id)?.finalizacion?.documento ?? "", /EXT-001/);
});

test("el histórico de saldos descuenta la extracción del banco el día de la boleta", () => {
  abrir("CAJ-002", "tomas-ruiz");
  como("tomas-ruiz");
  const id = idDe(crearMovimiento(pedidoABanco(1000000)));
  como("marta-diaz");
  autorizarMovimiento(id, true, "");
  como("tomas-ruiz");
  registrarExtraccion(id, "EXT-009");
  const cuenta = S.cuentasBancarias.get().find((c) => c.id === "CB-001")!;
  const serie = seriesDe({ cajas: S.cajas.get(), cuentas: [cuenta], libro: S.libro.get(), movimientos: S.movimientos.get() }, [], ["CB-001"], "ARS")[0];
  const fila = serie.movimientos.find((m) => m.comprobante === "EXT-009");
  assert.equal(fila?.egreso, 1000000);
  assert.equal(fila?.fecha, "2026-11-18");
});

test("pedido de refuerzo a banco: valida la cuenta contra su estimado y quién lo pide", () => {
  como("tomas-ruiz");
  const r = crearMovimiento(pedidoABanco(999999999));
  assert.ok(!r.ok && /estimado/.test(r.error));
  assert.ok(!crearMovimiento({ ...pedidoABanco(1000), origenBancoId: "CB-003" }).ok, "la cuenta en dólares no sirve para un pedido en pesos");
  como("ana-gomez");
  assert.ok(!crearMovimiento(pedidoABanco(1000)).ok, "sólo un responsable del tesoro pide los fondos");
});

test("restitución de fondo fijo: se repone contra la rendición de gastos", () => {
  como("tomas-ruiz");
  const base: NuevoMovimiento = {
    tipoId: "TMT-008",
    origenId: "CAJ-002",
    destino: { tipo: "CAJA", cajaId: "CAJ-004" },
    moneda: "ARS",
    importe: 50000,
    motivo: "Restitución del fondo fijo",
    transportista: transporte,
    precinto: "",
    observaciones: "",
  };
  const sin = crearMovimiento(base);
  assert.ok(!sin.ok && /rendición/i.test(sin.error), "sin rendición no se repone");
  const distinta = crearMovimiento({ ...base, rendicion: { detalle: "Limpieza", comprobantes: 2, importe: 40000 } });
  assert.ok(!distinta.ok && /importe/.test(distinta.error), "se repone por lo rendido");
  const ok = crearMovimiento({ ...base, rendicion: { detalle: "Limpieza y librería", comprobantes: 3, importe: 50000 } });
  assert.ok(ok.ok);
  assert.equal(mov(idDe(ok))?.rendicion?.comprobantes, 3);
});

test("el pedido de refuerzo a tesoro se aprueba con firma y valida el estimado del tesoro", () => {
  como("carlos-ibarra");
  const r = resolverPedidoRefuerzo("PR-0001", true, 1500000, "parcial", "FIR-0005");
  assert.ok(r.ok);
  const pedido = S.pedidos.get().find((p) => p.id === "PR-0001");
  assert.equal(pedido?.resolucion?.firmaId, "FIR-0005");
  S.reservas.commit([
    ...S.reservas.get(),
    {
      id: "RSV-9002",
      origenTipo: "CAJA",
      origenId: "CAJ-001",
      moneda: "ARS",
      importe: 59000000,
      operacionTipo: "PAGO",
      operacionId: "PAG-9002",
      estado: "ACTIVA",
      creada: { usuarioId: "carlos-ibarra", fechaHora: "2026-11-18 10:00" },
    },
  ]);
  S.pedidos.commit(S.pedidos.get().map((p) => (p.id === "PR-0001" ? { ...p, estado: "PENDIENTE" as const, resolucion: undefined, movimientoId: undefined } : p)));
  const sinEstimado = resolverPedidoRefuerzo("PR-0001", true, 2000000, "");
  assert.ok(!sinEstimado.ok && /estimado/.test(sinEstimado.error));
});
