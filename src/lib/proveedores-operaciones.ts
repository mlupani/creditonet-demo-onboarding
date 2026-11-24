// Operaciones de la Función 6 Proveedores. Cada una valida las reglas del documento funcional, escribe en
// los stores y devuelve { ok } o un error en español para mostrar en pantalla. Actúa el usuario
// seleccionado en el módulo (usuarioActual) en la fecha y hora simuladas de la demo.

import { pagarDesdeCaja, type Res } from "./caja-operaciones";
import { anularChequePropio, emitirChequePropio } from "./cheques-operaciones";
import { ahoraTexto, auditar, cajaStores, hoy, siguienteId, usuarioActual } from "./caja-store";
import {
  cambiarEstadoPago,
  consumirReserva,
  crearReserva,
  eventoDeOrden,
  liberarReserva,
  recalcularOrden,
} from "./pagos-circuito";
import {
  erroresComprobante,
  fechaValida,
  itemsDeOrden,
  pagadoDeOrden,
  pendienteDeOrden,
  puedeArmarOrden,
  puedeAutorizar,
  puedeAutorizarOrden,
  puedePagarOrden,
  repartirPago,
  validarCuit,
  type DatosComprobante,
} from "./proveedores-reglas";
import { provStores as P } from "./proveedores-store";
import {
  ESTADO_COMPROBANTE_LABEL,
  ESTADO_ORDEN_LABEL,
  MEDIO_PAGO_LABEL,
  type Comprobante,
  type CondicionIva,
  type LoteComprobantes,
  type MedioPago,
  type OrdenPago,
  type PagoProveedor,
  type Proveedor,
} from "./proveedores-tipos";
import { alcanzaElEstimado, posicionBanco } from "./saldos-reglas";

const error = (mensaje: string): { ok: false; error: string } => ({ ok: false, error: mensaje });
const primerError = (e: Record<string, string>) => Object.values(e)[0];

const comprobantePorId = (id: string) => P.comprobantes.get().find((c) => c.id === id);

function guardar(c: Comprobante) {
  P.comprobantes.commit(P.comprobantes.get().map((x) => (x.id === c.id ? c : x)));
}

function normalizar(datos: DatosComprobante): DatosComprobante {
  return {
    ...datos,
    prefijo: datos.prefijo.trim().padStart(4, "0"),
    numero: datos.numero.trim().padStart(8, "0"),
  };
}

function contexto(proveedor: Proveedor | undefined, excluirId?: string, extra: Comprobante[] = []) {
  return {
    proveedor,
    tipos: P.tiposComprobante.get(),
    comprobantes: [...P.comprobantes.get(), ...extra],
    excluirId,
    hoy: hoy(),
  };
}

// ---------- Circuito del comprobante ----------

// La carga (manual o masiva) deja el comprobante Preaprobado, a la espera de un autorizador.
export function cargarComprobante(proveedorId: string, datos: DatosComprobante, respaldo?: string): Res<{ comprobante: Comprobante }> {
  const proveedor = P.proveedores.get().find((p) => p.id === proveedorId);
  if (!proveedor) return error("Elegí el proveedor.");
  if (proveedor.estado !== "ACTIVO") return error("El proveedor no está activo.");
  const limpio = normalizar(datos);
  const errores = erroresComprobante(limpio, contexto(proveedor));
  if (Object.keys(errores).length > 0) return error(primerError(errores));
  const comprobante = nuevoComprobante(proveedorId, limpio, respaldo);
  P.comprobantes.commit([...P.comprobantes.get(), comprobante]);
  auditar("Comprobante", comprobante.id, "ALTA", null, `${ESTADO_COMPROBANTE_LABEL.PREAPROBADO} · total ${comprobante.total}`);
  return { ok: true, comprobante };
}

function nuevoComprobante(proveedorId: string, datos: DatosComprobante, respaldo?: string, loteId?: string, ids: string[] = []): Comprobante {
  const todos = [...P.comprobantes.get().map((c) => c.id), ...ids];
  return {
    ...datos,
    id: siguienteId("CMP", todos, 4),
    proveedorId,
    estado: "PREAPROBADO",
    cargadoPor: usuarioActual().id,
    fechaCarga: hoy(),
    respaldo,
    loteId,
  };
}

export function autorizarComprobante(id: string): Res<{ comprobante: Comprobante }> {
  const c = comprobantePorId(id);
  if (!c) return error("No se encontró el comprobante.");
  if (c.estado !== "PREAPROBADO") return error("Sólo se autoriza un comprobante Preaprobado.");
  const denegado = puedeAutorizar(usuarioActual(), c);
  if (denegado) return error(denegado);
  // v4: autorizar deja el comprobante Para liquidar, disponible para incluirse en una orden de pago; el
  // número de orden se genera recién al armarla (6.2).
  const actualizado: Comprobante = {
    ...c,
    estado: "PARA_LIQUIDAR",
    autorizacion: { usuarioId: usuarioActual().id, fechaHora: ahoraTexto() },
    rechazo: undefined,
  };
  guardar(actualizado);
  auditar("Comprobante", id, "ESTADO", ESTADO_COMPROBANTE_LABEL[c.estado], ESTADO_COMPROBANTE_LABEL.PARA_LIQUIDAR);
  return { ok: true, comprobante: actualizado };
}

export function rechazarComprobante(id: string, motivo: string): Res<{ comprobante: Comprobante }> {
  const c = comprobantePorId(id);
  if (!c) return error("No se encontró el comprobante.");
  if (c.estado !== "PREAPROBADO") return error("Sólo se rechaza un comprobante Preaprobado.");
  if (puedeAutorizar(usuarioActual(), c)) return error("Sólo rechaza un Supervisor o un Tesorero que no haya cargado el comprobante.");
  if (!motivo.trim()) return error("Ingresá el motivo del rechazo.");
  const actualizado: Comprobante = {
    ...c,
    estado: "RECHAZADO",
    rechazo: { usuarioId: usuarioActual().id, fechaHora: ahoraTexto(), motivo: motivo.trim() },
  };
  guardar(actualizado);
  auditar("Comprobante", id, "ESTADO", ESTADO_COMPROBANTE_LABEL[c.estado], `${ESTADO_COMPROBANTE_LABEL.RECHAZADO} · ${motivo.trim()}`);
  return { ok: true, comprobante: actualizado };
}

// El operador corrige un comprobante rechazado y vuelve a enviarlo a autorización.
export function corregirComprobante(id: string, datos: DatosComprobante): Res<{ comprobante: Comprobante }> {
  const c = comprobantePorId(id);
  if (!c) return error("No se encontró el comprobante.");
  if (c.estado !== "RECHAZADO") return error("Sólo se corrige un comprobante Rechazado.");
  const proveedor = P.proveedores.get().find((p) => p.id === c.proveedorId);
  const limpio = normalizar(datos);
  const errores = erroresComprobante(limpio, contexto(proveedor, id));
  if (Object.keys(errores).length > 0) return error(primerError(errores));
  const actualizado: Comprobante = {
    ...c,
    ...limpio,
    estado: "PREAPROBADO",
    cargadoPor: usuarioActual().id,
    rechazo: undefined,
  };
  guardar(actualizado);
  auditar("Comprobante", id, "MODIFICACION", ESTADO_COMPROBANTE_LABEL.RECHAZADO, `${ESTADO_COMPROBANTE_LABEL.PREAPROBADO} · corregido`);
  return { ok: true, comprobante: actualizado };
}

export function anularComprobante(id: string, motivo: string): Res<{ comprobante: Comprobante }> {
  const c = comprobantePorId(id);
  if (!c) return error("No se encontró el comprobante.");
  if (c.estado === "ANULADO") return error("El comprobante ya está anulado.");
  if (c.estado === "PAGADO" || c.estado === "PAGO_PARCIAL" || P.pagos.get().some((p) => p.aplicaciones.some((a) => a.comprobanteId === id))) {
    return error("El comprobante tiene pagos aplicados: no se puede anular.");
  }
  if (c.estado === "EN_ORDEN_PAGO") return error(`El comprobante está en la orden de pago ${c.ordenPago ?? ""}: anulá o rechazá la orden primero.`);
  // Un rechazado vuelve al operador, que puede anularlo; el resto requiere permiso.
  const usuario = usuarioActual();
  if (c.estado !== "RECHAZADO" && !usuario.roles.some((r) => r === "SUPERVISOR" || r === "TESORERO")) {
    return error("Sólo un Supervisor o un Tesorero anula un comprobante ya cargado.");
  }
  if (!motivo.trim()) return error("Ingresá el motivo de la anulación.");
  const actualizado: Comprobante = {
    ...c,
    estado: "ANULADO",
    anulacion: { usuarioId: usuario.id, fechaHora: ahoraTexto(), motivo: motivo.trim() },
  };
  guardar(actualizado);
  auditar("Comprobante", id, "ESTADO", ESTADO_COMPROBANTE_LABEL[c.estado], `${ESTADO_COMPROBANTE_LABEL.ANULADO} · ${motivo.trim()}`);
  return { ok: true, comprobante: actualizado };
}

// ---------- Orden de pago (v4, 6.2) ----------

const ordenPorId = (id: string) => P.ordenesPago.get().find((o) => o.id === id);

function guardarOrden(o: OrdenPago) {
  P.ordenesPago.commit(P.ordenesPago.get().map((x) => (x.id === o.id ? o : x)));
}

// Marca los comprobantes de la orden como incluidos (o los libera, si se rechaza o se anula la orden).
function mover(orden: OrdenPago, estado: "EN_ORDEN_PAGO" | "PARA_LIQUIDAR") {
  const ids = orden.items.map((i) => i.comprobanteId);
  P.comprobantes.commit(
    P.comprobantes.get().map((c) =>
      ids.includes(c.id) ? { ...c, estado, ordenPago: estado === "EN_ORDEN_PAGO" ? orden.id : undefined } : c
    )
  );
}

const evento = (evento: string, detalle?: string) => ({ fechaHora: ahoraTexto(), usuarioId: usuarioActual().id, evento, detalle });

// Arma una orden de pago de un solo proveedor con los comprobantes tildados (todos Para liquidar). Queda
// Emitida, o Borrador si se la graba sin cerrar. La cuenta destino es la de la ficha del proveedor.
export function armarOrdenPago(proveedorId: string, comprobanteIds: string[], opciones: { borrador?: boolean } = {}): Res<{ orden: OrdenPago }> {
  const denegado = puedeArmarOrden(usuarioActual());
  if (denegado) return error(denegado);
  const proveedor = P.proveedores.get().find((p) => p.id === proveedorId);
  if (!proveedor) return error("Elegí el proveedor.");
  if (proveedor.estado !== "ACTIVO") return error("El proveedor no está activo.");
  const elegidos = comprobanteIds.map((id) => comprobantePorId(id));
  if (elegidos.some((c) => !c || c.proveedorId !== proveedorId)) return error("Una orden de pago no puede mezclar proveedores.");
  const calculo = itemsDeOrden(elegidos as Comprobante[], P.tiposComprobante.get(), P.pagos.get(), P.ordenesPago.get());
  if (!calculo.ok) return error(calculo.error);

  const ordenes = P.ordenesPago.get();
  const orden: OrdenPago = {
    id: siguienteId("OP", ordenes.map((o) => o.id), 4),
    proveedorId,
    items: calculo.items,
    total: calculo.total,
    cuentaDestino: proveedor.cbu,
    estado: opciones.borrador ? "BORRADOR" : "EMITIDA",
    armadaPor: usuarioActual().id,
    fechaArmado: hoy(),
    historial: [evento(opciones.borrador ? "Borrador" : "Emitida", `${calculo.items.length} comprobantes · ${calculo.total}`)],
  };
  P.ordenesPago.commit([...ordenes, orden]);
  mover(orden, "EN_ORDEN_PAGO");
  auditar("Orden de pago", orden.id, "ALTA", null, `${ESTADO_ORDEN_LABEL[orden.estado]} · ${proveedor.razonSocial} · ${orden.total}`);
  return { ok: true, orden };
}

// Cierra un borrador: queda Emitida y espera la autorización.
export function emitirOrdenPago(id: string): Res<{ orden: OrdenPago }> {
  const o = ordenPorId(id);
  if (!o || o.estado !== "BORRADOR") return error("Sólo se cierra una orden en Borrador.");
  const denegado = puedeArmarOrden(usuarioActual());
  if (denegado) return error(denegado);
  const nueva: OrdenPago = { ...o, estado: "EMITIDA", historial: [...o.historial, evento("Emitida")] };
  guardarOrden(nueva);
  auditar("Orden de pago", id, "ESTADO", ESTADO_ORDEN_LABEL.BORRADOR, ESTADO_ORDEN_LABEL.EMITIDA);
  return { ok: true, orden: nueva };
}

// Autoriza otro usuario (distinto de quien la armó, aunque tenga varios roles). `firmaId` es la llave de
// autorización con la que se firmó, si la pantalla la pidió.
export function autorizarOrdenPago(id: string, firmaId?: string): Res<{ orden: OrdenPago }> {
  const o = ordenPorId(id);
  if (!o) return error("No se encontró la orden de pago.");
  if (o.estado !== "EMITIDA") return error("Sólo se autoriza una orden Emitida.");
  const denegado = puedeAutorizarOrden(usuarioActual(), o);
  if (denegado) return error(denegado);
  const nueva: OrdenPago = {
    ...o,
    estado: "AUTORIZADA",
    autorizacion: { usuarioId: usuarioActual().id, fechaHora: ahoraTexto(), firmaId },
    historial: [...o.historial, evento("Autorizada", firmaId ? `Llave ${firmaId}` : undefined)],
  };
  guardarOrden(nueva);
  auditar("Orden de pago", id, "ESTADO", ESTADO_ORDEN_LABEL.EMITIDA, ESTADO_ORDEN_LABEL.AUTORIZADA);
  return { ok: true, orden: nueva };
}

// Rechazo: el autorizante la devuelve con motivo y los comprobantes vuelven a Para liquidar.
export function rechazarOrdenPago(id: string, motivo: string, firmaId?: string): Res<{ orden: OrdenPago }> {
  const o = ordenPorId(id);
  if (!o) return error("No se encontró la orden de pago.");
  if (o.estado !== "EMITIDA") return error("Sólo se rechaza una orden Emitida.");
  const denegado = puedeAutorizarOrden(usuarioActual(), o);
  if (denegado) return error(denegado);
  if (!motivo.trim()) return error("Ingresá el motivo del rechazo.");
  const nueva: OrdenPago = {
    ...o,
    estado: "RECHAZADA",
    cierre: { usuarioId: usuarioActual().id, fechaHora: ahoraTexto(), motivo: motivo.trim(), tipo: "RECHAZO" },
    historial: [...o.historial, evento("Rechazada", `${motivo.trim()}${firmaId ? ` · llave ${firmaId}` : ""}`)],
  };
  guardarOrden(nueva);
  mover(nueva, "PARA_LIQUIDAR");
  auditar("Orden de pago", id, "ESTADO", ESTADO_ORDEN_LABEL.EMITIDA, `${ESTADO_ORDEN_LABEL.RECHAZADA} · ${motivo.trim()}`);
  return { ok: true, orden: nueva };
}

// Anulación con motivo (desde Borrador hasta antes de pagarse algo): libera los comprobantes y cancela lo que
// esté en curso (las transferencias preparadas se rechazan y los cheques emitidos se anulan, liberando su
// reserva). Con pagos ya hechos no se anula.
export function anularOrdenPago(id: string, motivo: string): Res<{ orden: OrdenPago }> {
  const o = ordenPorId(id);
  if (!o) return error("No se encontró la orden de pago.");
  if (!["BORRADOR", "EMITIDA", "AUTORIZADA", "PENDIENTE_TRANSFERENCIA"].includes(o.estado)) return error("La orden no se puede anular en su estado actual.");
  const u = usuarioActual();
  if (puedeArmarOrden(u) && !u.roles.includes("DIRECTOR")) return error("Sólo el perfil financiero o el Director anula una orden de pago.");
  if (!motivo.trim()) return error("Ingresá el motivo de la anulación.");
  if (pagadoDeOrden(id, P.pagos.get()) > 0.001) return error("La orden ya tiene pagos hechos: no se puede anular.");

  const enCurso = P.pagos.get().filter((p) => p.ordenPago === id && ["PREPARADA", "PENDIENTE_EJECUCION", "EMITIDO"].includes(p.estado));
  const motivoOp = `Orden ${id} anulada: ${motivo.trim()}`;
  for (const p of enCurso) {
    if (p.medio === "CHEQUE" && p.chequeId) {
      const r = anularChequePropio(p.chequeId, motivoOp);
      if (!r.ok) return r;
    } else {
      liberarReserva(p.reservaId, motivoOp);
      cambiarEstadoPago(p.id, "RECHAZADA", motivoOp);
    }
  }
  const nueva: OrdenPago = {
    ...(ordenPorId(id) as OrdenPago),
    estado: "ANULADA",
    cierre: { usuarioId: u.id, fechaHora: ahoraTexto(), motivo: motivo.trim(), tipo: "ANULACION" },
    historial: [...(ordenPorId(id) as OrdenPago).historial, evento("Anulada", motivo.trim())],
  };
  guardarOrden(nueva);
  mover(nueva, "PARA_LIQUIDAR");
  auditar("Orden de pago", id, "ESTADO", ESTADO_ORDEN_LABEL[o.estado], `${ESTADO_ORDEN_LABEL.ANULADA} · ${motivo.trim()}`);
  return { ok: true, orden: nueva };
}

// ---------- Pago de la orden (v4, Bandeja de autorizaciones → Proveedores) ----------

export interface EntradaPago {
  ordenId: string;
  importe: number;
  medio: MedioPago;
  origenTipo: "CAJA" | "BANCO";
  origenId: string;
  chequeraId?: string; // sólo cheque
  fechaPago?: string; // fecha de pago del cheque (por defecto, hoy)
}

// Paga una orden Autorizada eligiendo el medio y el origen (quien paga conoce los saldos):
//  - Efectivo, desde una caja: sale del libro en el momento (baja el real). Valida el estimado de la caja.
//  - Transferencia, desde una cuenta: queda Preparada y crea la reserva (baja el estimado, no el real).
//  - Cheque, desde una cuenta y una chequera: emite el cheque (Emitido, con reserva). La entrega deja el
//    pago hecho (la orden pasa a Pagada); el débito baja el real y consume la reserva.
// Pago parcial: se permite pagar menos que lo pendiente (queda saldo para el siguiente pago y la orden
// sigue Autorizada). Cristian lo pidió en la reunión del 20/11; el documento lo deja como punto abierto.
export function pagarOrdenPago(p: EntradaPago): Res<{ pago: PagoProveedor }> {
  const orden = ordenPorId(p.ordenId);
  if (!orden) return error("No se encontró la orden de pago.");
  if (orden.estado !== "AUTORIZADA" && orden.estado !== "PENDIENTE_TRANSFERENCIA") return error("La orden no está autorizada para pagar.");
  const denegado = puedePagarOrden(usuarioActual());
  if (denegado) return error(denegado);
  const pagos = P.pagos.get();
  const pendiente = pendienteDeOrden(orden, pagos);
  if (!(p.importe > 0)) return error("Ingresá el importe del pago.");
  if (p.importe > pendiente + 0.001) return error(`El importe supera lo que queda por pagar de la orden (${pendiente}).`);
  if (p.medio === "EFECTIVO" && p.origenTipo !== "CAJA") return error("El efectivo sale de una caja.");
  if (p.medio !== "EFECTIVO" && p.origenTipo !== "BANCO") return error("La transferencia y el cheque salen de una cuenta bancaria.");
  if (p.medio === "TRANSFERENCIA" && !orden.cuentaDestino) return error("El proveedor no tiene CBU cargado: no se puede pagar por transferencia.");

  const proveedor = P.proveedores.get().find((x) => x.id === orden.proveedorId);
  const id = siguienteId("PAG", pagos.map((x) => x.id), 4);
  const aplicaciones = repartirPago(orden, P.comprobantes.get(), pagos, p.importe);
  const base = {
    id,
    ordenPago: orden.id,
    proveedorId: orden.proveedorId,
    fecha: hoy(),
    medio: p.medio,
    origenTipo: p.origenTipo,
    origenId: p.origenId,
    importe: p.importe,
    aplicaciones,
    usuarioId: usuarioActual().id,
    asiento: siguienteId("AS", pagos.map((x) => x.asiento), 4),
  };
  let pago: PagoProveedor;

  if (p.origenTipo === "CAJA") {
    const r = pagarDesdeCaja({
      cajaId: p.origenId,
      medio: "EFECTIVO",
      importe: p.importe,
      descripcion: `Pago a proveedor ${proveedor?.razonSocial ?? orden.proveedorId} · ${orden.id}`,
      comprobante: orden.id,
      refId: id,
    });
    if (!r.ok) return r;
    pago = { ...base, estado: "EJECUTADA", asientoLibroId: r.asientoId, historial: [{ estado: "EJECUTADA", usuarioId: base.usuarioId, fechaHora: ahoraTexto(), detalle: "Pago en efectivo" }] };
  } else {
    const cuenta = cajaStores.cuentasBancarias.get().find((x) => x.id === p.origenId);
    if (!cuenta || cuenta.estado !== "ACTIVO") return error("Elegí una cuenta bancaria activa.");
    if (cuenta.moneda !== "ARS") return error("Los pagos a proveedores se hacen en pesos: elegí una cuenta en pesos.");
    const posicion = posicionBanco(cuenta, cajaStores.movimientos.get(), pagos, cajaStores.cheques.get(), cajaStores.reservas.get());
    if (!alcanzaElEstimado(posicion, p.importe)) return error("El importe supera el saldo estimado de la cuenta (descontado lo ya reservado): elegí otra cuenta o pagá menos.");
    if (p.medio === "CHEQUE") {
      const r = emitirChequePropio({
        cuentaId: cuenta.id,
        importe: p.importe,
        beneficiario: proveedor?.razonSocial ?? orden.proveedorId,
        fechaPago: p.fechaPago || hoy(),
        referencia: orden.id,
        chequeraId: p.chequeraId || undefined,
        operacionId: id,
      });
      if (!r.ok) return r;
      pago = { ...base, estado: "EMITIDO", chequeId: r.cheque.id, reservaId: r.reserva.id, historial: [{ estado: "EMITIDO", usuarioId: base.usuarioId, fechaHora: ahoraTexto(), detalle: `Cheque ${r.cheque.numero}` }] };
    } else {
      const reserva = crearReserva({ origenTipo: "BANCO", origenId: cuenta.id, moneda: "ARS", importe: p.importe, operacionId: id });
      pago = { ...base, estado: "PREPARADA", reservaId: reserva.id, historial: [{ estado: "PREPARADA", usuarioId: base.usuarioId, fechaHora: ahoraTexto(), detalle: `Cuenta ${cuenta.banco} ${cuenta.numero}` }] };
    }
  }

  P.pagos.commit([...pagos, pago]);
  auditar("Pago", id, "ALTA", null, `${orden.id} · ${MEDIO_PAGO_LABEL[p.medio]} · ${p.importe}`);
  eventoDeOrden(orden.id, `Pago ${id} (${MEDIO_PAGO_LABEL[p.medio]})`, `${p.importe}`);
  recalcularOrden(orden.id);
  return { ok: true, pago };
}

// Prepara una transferencia: igual que pagar con medio transferencia desde una cuenta.
export const prepararTransferencia = (p: Omit<EntradaPago, "medio" | "origenTipo" | "chequeraId" | "fechaPago">): Res<{ pago: PagoProveedor }> =>
  pagarOrdenPago({ ...p, medio: "TRANSFERENCIA", origenTipo: "BANCO" });

function pagoDeTransferencia(id: string): PagoProveedor | undefined {
  const pago = P.pagos.get().find((x) => x.id === id);
  return pago && pago.medio === "TRANSFERENCIA" ? pago : undefined;
}

// Preparada → Pendiente de ejecución: se envía a quien opera el home banking (o al lote de la API).
export function marcarPendienteEjecucion(pagoId: string): Res<{ pago: PagoProveedor }> {
  const pago = pagoDeTransferencia(pagoId);
  if (!pago) return error("No se encontró la transferencia.");
  const denegado = puedePagarOrden(usuarioActual());
  if (denegado) return error(denegado);
  if (pago.estado !== "PREPARADA") return error("Sólo se envía al operador una transferencia Preparada.");
  const nuevo = cambiarEstadoPago(pagoId, "PENDIENTE_EJECUCION", "Enviada a quien opera el home banking") as PagoProveedor;
  recalcularOrden(pago.ordenPago);
  return { ok: true, pago: nuevo };
}

// Resultado de la transferencia. Ejecutada: se hizo en el banco (exige el comprobante); baja el real y
// consume la reserva. Rechazada (con motivo): antes de ejecutar libera la reserva; si ya estaba ejecutada y
// el banco la devuelve, el real vuelve (contramovimiento) y el importe queda otra vez pendiente en la orden.
export function registrarResultadoTransferencia(
  pagoId: string,
  r: { resultado: "EJECUTADA" | "RECHAZADA"; motivo?: string; comprobante?: string; firmaId?: string }
): Res<{ pago: PagoProveedor }> {
  const pago = pagoDeTransferencia(pagoId);
  if (!pago) return error("No se encontró la transferencia.");
  const denegado = puedePagarOrden(usuarioActual());
  if (denegado) return error(denegado);
  const llave = r.firmaId ? ` · llave ${r.firmaId}` : "";
  let nuevo: PagoProveedor;
  if (r.resultado === "EJECUTADA") {
    if (pago.estado !== "PENDIENTE_EJECUCION") return error("Sólo se registra como ejecutada una transferencia Pendiente de ejecución.");
    if (!r.comprobante?.trim()) return error("Adjuntá el comprobante del banco (número de operación).");
    consumirReserva(pago.reservaId, `Transferencia ${pagoId} ejecutada`);
    nuevo = cambiarEstadoPago(pagoId, "EJECUTADA", `Comprobante ${r.comprobante.trim()}${llave}`) as PagoProveedor;
  } else {
    if (!["PREPARADA", "PENDIENTE_EJECUCION", "EJECUTADA"].includes(pago.estado)) return error("La transferencia ya no se puede rechazar.");
    if (!r.motivo?.trim()) return error("Indicá el motivo (no se pudo pagar o el banco la devolvió).");
    if (pago.estado !== "EJECUTADA") liberarReserva(pago.reservaId, r.motivo.trim());
    nuevo = cambiarEstadoPago(pagoId, "RECHAZADA", `${r.motivo.trim()}${llave}`) as PagoProveedor;
    eventoDeOrden(pago.ordenPago, `Pago ${pagoId} rechazado`, r.motivo.trim());
  }
  recalcularOrden(pago.ordenPago);
  return { ok: true, pago: nuevo };
}

// Ejecutada → Confirmada: verificada contra el extracto o la conciliación (2.3).
export function confirmarTransferencia(pagoId: string): Res<{ pago: PagoProveedor }> {
  const pago = pagoDeTransferencia(pagoId);
  if (!pago) return error("No se encontró la transferencia.");
  const denegado = puedePagarOrden(usuarioActual());
  if (denegado) return error(denegado);
  if (pago.estado !== "EJECUTADA") return error("Sólo se confirma una transferencia Ejecutada.");
  const nuevo = cambiarEstadoPago(pagoId, "CONFIRMADA", "Verificada contra el extracto") as PagoProveedor;
  return { ok: true, pago: nuevo };
}

export interface ItemLoteTransferencia {
  pagoId: string;
  ordenPago: string;
  proveedorId: string;
  proveedor: string;
  cuit: string;
  cbuDestino: string;
  importe: number;
  estado: PagoProveedor["estado"];
}
export interface LoteTransferencia {
  cuentaId: string;
  items: ItemLoteTransferencia[];
  total: number;
}

// Transferencias agrupadas por la cuenta bancaria de origen: lo que hay que ejecutar (Preparada o
// Pendiente de ejecución) y lo ejecutado a la espera de confirmación.
export function lotesTransferencia(): LoteTransferencia[] {
  const proveedores = P.proveedores.get();
  const ordenes = P.ordenesPago.get();
  const porCuenta = new Map<string, ItemLoteTransferencia[]>();
  for (const p of P.pagos.get()) {
    if (p.medio !== "TRANSFERENCIA" || !["PREPARADA", "PENDIENTE_EJECUCION", "EJECUTADA"].includes(p.estado)) continue;
    const prov = proveedores.find((x) => x.id === p.proveedorId);
    const lista = porCuenta.get(p.origenId) ?? [];
    lista.push({
      pagoId: p.id,
      ordenPago: p.ordenPago,
      proveedorId: p.proveedorId,
      proveedor: prov?.razonSocial ?? p.proveedorId,
      cuit: prov?.cuit ?? "",
      cbuDestino: ordenes.find((o) => o.id === p.ordenPago)?.cuentaDestino ?? "",
      importe: p.importe,
      estado: p.estado,
    });
    porCuenta.set(p.origenId, lista);
  }
  return [...porCuenta].map(([cuentaId, items]) => ({ cuentaId, items, total: items.reduce((s, i) => s + i.importe, 0) }));
}

// Archivo (CSV, separado por punto y coma) con el lote a ejecutar en el banco: el formato real depende de
// cada banco y está pendiente de definición.
export function csvLoteTransferencia(cuentaId: string): string {
  const lote = lotesTransferencia().find((l) => l.cuentaId === cuentaId);
  const filas = (lote?.items ?? []).filter((i) => i.estado === "PREPARADA" || i.estado === "PENDIENTE_EJECUCION");
  const encabezado = ["Pago", "Orden de pago", "Proveedor", "CUIT", "CBU destino", "Importe", "Referencia"];
  return [encabezado, ...filas.map((i) => [i.pagoId, i.ordenPago, i.proveedor, i.cuit, i.cbuDestino, String(i.importe), i.ordenPago])]
    .map((f) => f.join(";"))
    .join("\n");
}

// ---------- Carga masiva por Excel ----------

export const COLUMNAS_PLANTILLA: string[] = [
  "CUIT",
  "Tipo de comprobante",
  "Fecha del comprobante",
  "Prefijo",
  "Número",
  "No gravado",
  "Exento",
  "Subtotal gravado",
  "Gravado 10,5%",
  "IVA 10,5%",
  "Gravado 21%",
  "IVA 21%",
  "Gravado 27%",
  "IVA 27%",
  "Percepción de IVA",
  "Percepción IIBB 1",
  "Percepción IIBB 2",
  "Percepción IIBB 3",
  "Percepción municipal 1",
  "Percepción municipal 2",
  "Total",
  "Observaciones",
  "Fecha de vencimiento", // opcional: vacía, vence a la vista
];

export const generarPlantilla = (): string[][] => [COLUMNAS_PLANTILLA];

const sinAcentos = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

function numero(texto: string | undefined): number {
  const t = (texto ?? "").trim();
  if (t === "") return 0;
  const limpio = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return /^-?\d+(\.\d+)?$/.test(limpio) ? Number(limpio) : Number.NaN;
}

function fechaDeFila(texto: string): string {
  const t = texto.trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : t;
}

export interface FilaAceptada {
  fila: number;
  datos: DatosComprobante;
}
export interface FilaRechazada {
  fila: number;
  datos: string[];
  motivo: string;
}

// Valida el archivo fila por fila. `fila` es la posición (desde 1) de la fila en `filas`; si la primera
// es el encabezado de la plantilla se omite, igual que las filas vacías.
export function validarFilasLote(proveedorId: string, filas: string[][]): { aceptadas: FilaAceptada[]; rechazadas: FilaRechazada[] } {
  const proveedor = P.proveedores.get().find((p) => p.id === proveedorId);
  const tipos = P.tiposComprobante.get();
  const aceptadas: FilaAceptada[] = [];
  const rechazadas: FilaRechazada[] = [];

  filas.forEach((f, i) => {
    const celdas = COLUMNAS_PLANTILLA.map((_, k) => (f[k] ?? "").toString());
    if (celdas.every((x) => x.trim() === "")) return;
    if (i === 0 && /cuit/i.test(celdas[0]) && !/\d/.test(celdas[0])) return;
    const rechazar = (motivo: string) => rechazadas.push({ fila: i + 1, datos: celdas, motivo });

    if (!proveedor) return rechazar("Proveedor inexistente.");
    if (celdas[0].trim() !== "" && celdas[0].replace(/\D/g, "") !== proveedor.cuit.replace(/\D/g, "")) {
      return rechazar("El CUIT no corresponde al proveedor elegido.");
    }
    const tipo = tipos.find((t) => sinAcentos(t.descripcion) === sinAcentos(celdas[1]) || t.id === celdas[1].trim());
    if (!tipo) return rechazar("Tipo de comprobante inexistente.");
    const fecha = fechaDeFila(celdas[2]);
    if (!fechaValida(fecha)) return rechazar("Fecha inválida.");

    const vencimiento = celdas[22].trim() === "" ? undefined : fechaDeFila(celdas[22]);
    if (vencimiento !== undefined && !fechaValida(vencimiento)) return rechazar("Fecha de vencimiento inválida.");

    const n = celdas.slice(5, 21).map((x) => numero(x));
    if (n.some((x) => Number.isNaN(x))) return rechazar("Hay importes que no son numéricos.");
    const [noGravado, exento, subtotalGravado, b105, i105, b21, i21, b27, i27, percIva, ib1, ib2, ib3, mu1, mu2, total] = n;
    const datos: DatosComprobante = {
      tipoId: tipo.id,
      fechaComprobante: fecha,
      fechaVencimiento: vencimiento,
      prefijo: celdas[3].trim().padStart(4, "0"),
      numero: celdas[4].trim().padStart(8, "0"),
      noGravado,
      exento,
      subtotalGravado,
      gravados: { "10.5": { base: b105, iva: i105 }, "21": { base: b21, iva: i21 }, "27": { base: b27, iva: i27 } },
      percepcionIva: percIva,
      percepcionesIibb: [ib1, ib2, ib3].filter((x) => x > 0),
      percepcionesMunicipales: [mu1, mu2].filter((x) => x > 0),
      total,
      observaciones: celdas[21].trim(),
    };
    // Los duplicados también se controlan contra las filas ya aceptadas del mismo archivo.
    const previas = aceptadas.map(
      (a, k): Comprobante => ({ ...a.datos, id: `LOTE-${k}`, proveedorId, estado: "PREAPROBADO", cargadoPor: "", fechaCarga: "" })
    );
    const errores = erroresComprobante(datos, contexto(proveedor, undefined, previas));
    if (Object.keys(errores).length > 0) return rechazar(Object.values(errores).join(" "));
    aceptadas.push({ fila: i + 1, datos });
  });
  return { aceptadas, rechazadas };
}

// Graba sólo las filas aceptadas y registra el lote (quién lo subió, cuándo, archivo y cantidades).
export function confirmarLote(
  proveedorId: string,
  archivo: string,
  aceptadas: FilaAceptada[],
  rechazadas = 0
): Res<{ lote: LoteComprobantes; comprobantes: Comprobante[] }> {
  const proveedor = P.proveedores.get().find((p) => p.id === proveedorId);
  if (!proveedor) return error("Elegí el proveedor.");
  if (proveedor.estado !== "ACTIVO") return error("El proveedor no está activo.");
  if (aceptadas.length === 0) return error("No hay filas aceptadas para cargar.");

  const lotes = P.lotes.get();
  const lote: LoteComprobantes = {
    id: siguienteId("LOT", lotes.map((l) => l.id), 4),
    proveedorId,
    archivo,
    usuarioId: usuarioActual().id,
    fechaHora: ahoraTexto(),
    aceptadas: aceptadas.length,
    rechazadas,
  };
  const nuevos: Comprobante[] = [];
  for (const a of aceptadas) {
    const datos = normalizar(a.datos);
    // Se revalida contra lo que hay ahora (y contra lo ya agregado) por si cambió desde la vista previa.
    const errores = erroresComprobante(datos, contexto(proveedor, undefined, nuevos));
    if (Object.keys(errores).length > 0) return error(`Fila ${a.fila}: ${primerError(errores)}`);
    nuevos.push(nuevoComprobante(proveedorId, datos, undefined, lote.id, nuevos.map((c) => c.id)));
  }
  P.comprobantes.commit([...P.comprobantes.get(), ...nuevos]);
  P.lotes.commit([...lotes, lote]);
  auditar("Lote de comprobantes", lote.id, "ALTA", null, `${archivo} · ${aceptadas.length} aceptadas, ${rechazadas} rechazadas`);
  return { ok: true, lote, comprobantes: nuevos };
}

// ---------- Búsqueda de proveedor y padrón ----------

export function buscarProveedorPorCuit(cuit: string, proveedores: Proveedor[]): Proveedor | undefined {
  const d = cuit.replace(/\D/g, "");
  return d.length === 0 ? undefined : proveedores.find((p) => p.estado !== "ELIMINADO" && p.cuit.replace(/\D/g, "") === d);
}

export interface DatosArca {
  razonSocial: string;
  domicilio: string;
  provincia: string;
  codigoPostal: string;
  condicionIva: CondicionIva;
}

// Padrón de ARCA simulado: algunos CUIT conocidos y, para cualquier otro CUIT válido, un contribuyente genérico.
const PADRON: Record<string, DatosArca> = {
  "30714455669": {
    razonSocial: "Mantenimiento Integral Sur S.A.",
    domicilio: "Av. Rivadavia 4520, CABA",
    provincia: "CABA",
    codigoPostal: "C1424",
    condicionIva: "RESPONSABLE_INSCRIPTO",
  },
  "27234567891": {
    razonSocial: "López María Laura",
    domicilio: "Belgrano 215, Mendoza",
    provincia: "Mendoza",
    codigoPostal: "M5500",
    condicionIva: "MONOTRIBUTISTA",
  },
};

export function datosArca(cuit: string): DatosArca | null {
  const d = cuit.replace(/\D/g, "");
  if (!validarCuit(d)) return null;
  const conocido = PADRON[d];
  if (conocido) return conocido;
  const existente = P.proveedores.get().find((p) => p.cuit.replace(/\D/g, "") === d);
  if (existente) {
    return {
      razonSocial: existente.razonSocial,
      domicilio: existente.domicilio,
      provincia: existente.provincia,
      codigoPostal: existente.codigoPostal,
      condicionIva: existente.condicionIva,
    };
  }
  return {
    razonSocial: `Contribuyente ${d}`,
    domicilio: "Domicilio fiscal según padrón",
    provincia: "Buenos Aires",
    codigoPostal: "B1900",
    condicionIva: d.startsWith("30") || d.startsWith("33") ? "RESPONSABLE_INSCRIPTO" : "MONOTRIBUTISTA",
  };
}
