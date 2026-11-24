// Operaciones de cheques y valores: alta de cheques de terceros en custodia, emisión de cheques propios
// desde una chequera, cambios de estado con trazabilidad y conteo de valores en apertura y cierre.
// Mismo estilo que caja-operaciones: devuelven `{ ok: true, ... }` o `{ ok: false, error }`.

import { esResponsable, fechaIso } from "./caja-reglas";
import {
  ahoraTexto,
  auditar,
  cajaStores as S,
  hoy,
  siguienteId,
  usuarioActual,
} from "./caja-store";
import { ESTADO_CHEQUE_LABEL, type Cheque, type EstadoCheque, type FormaCheque, type Moneda, type Reserva } from "./caja-tipos";
import { enCustodia, formaDeTipo, proximoNumero, puedeTransicionar } from "./cheques-reglas";
import { cambiarEstadoPago, consumirReserva, crearReserva, liberarReserva, recalcularOrden, reservaDeCheque } from "./pagos-circuito";
import { provStores as P } from "./proveedores-store";
import type { EstadoPago } from "./proveedores-tipos";
import { alcanzaElEstimado, posicionBanco } from "./saldos-reglas";

type Res<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };
const error = (mensaje: string): { ok: false; error: string } => ({ ok: false, error: mensaje });

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const fechaValida = (f: string) => FECHA.test(f) && fechaIso(new Date(`${f}T00:00:00`)) === f;

const chequePorId = (id: string) => S.cheques.get().find((c) => c.id === id);
const actualizar = (id: string, cambio: Partial<Cheque>) =>
  S.cheques.commit(S.cheques.get().map((c) => (c.id === id ? { ...c, ...cambio } : c)));

function cambiarEstado(cheque: Cheque, hacia: EstadoCheque, detalle: string, extra: Partial<Cheque> = {}) {
  actualizar(cheque.id, {
    ...extra,
    estado: hacia,
    traza: [...cheque.traza, { estado: hacia, usuario: usuarioActual().nombre, fechaHora: ahoraTexto(), detalle }],
  });
  auditar("Cheque", cheque.id, "ESTADO", ESTADO_CHEQUE_LABEL[cheque.estado], `${ESTADO_CHEQUE_LABEL[hacia]} · ${detalle}`);
}

// ---------- Cheques propios (desde una chequera) ----------

export interface EntradaChequePropio {
  cuentaId: string;
  importe: number;
  beneficiario: string;
  fechaPago: string;
  referencia: string;
  chequeraId?: string;
  // Operación a la que queda atada la reserva (el pago que lo emite). Sin ella, el propio cheque.
  operacionId?: string;
}

// Emite un cheque propio: toma el próximo número libre de la chequera (dentro del rango, o un correlativo
// propio si es e-cheq sin rango). Sin `chequeraId` usa la primera chequera activa de la cuenta con numeración.
// Emitir crea la reserva del importe en el estimado de la cuenta (v4, 2.5): el saldo real no cambia hasta
// que el cheque se debita, y no se emite por encima del estimado.
export function emitirChequePropio(entrada: EntradaChequePropio): Res<{ cheque: Cheque; reserva: Reserva }> {
  const cuenta = S.cuentasBancarias.get().find((c) => c.id === entrada.cuentaId);
  if (!cuenta || cuenta.estado !== "ACTIVO") return error("Elegí una cuenta bancaria activa.");
  if (!(entrada.importe > 0)) return error("El importe debe ser mayor a cero.");
  if (!entrada.beneficiario.trim()) return error("Ingresá el beneficiario.");
  if (!fechaValida(entrada.fechaPago)) return error("Ingresá una fecha de pago válida.");
  if (entrada.fechaPago < hoy()) return error("La fecha de pago no puede ser anterior a hoy.");

  const tipos = S.tiposChequera.get();
  const cheques = S.cheques.get();
  const posicion = posicionBanco(cuenta, S.movimientos.get(), P.pagos.get(), cheques, S.reservas.get());
  if (!alcanzaElEstimado(posicion, entrada.importe)) return error("El importe supera el saldo estimado de la cuenta (descontado lo ya reservado).");
  const candidatas = S.chequeras
    .get()
    .filter((q) => q.estado === "ACTIVO" && q.cuentaId === cuenta.id && (!entrada.chequeraId || q.id === entrada.chequeraId));
  if (entrada.chequeraId && candidatas.length === 0) return error("La chequera no existe, está inactiva o es de otra cuenta.");
  if (candidatas.length === 0) return error("La cuenta no tiene una chequera activa.");

  for (const chequera of candidatas) {
    const forma: FormaCheque = formaDeTipo(tipos.find((t) => t.id === chequera.tipoId));
    const numero = proximoNumero(chequera, forma, cheques);
    if (!numero) continue;
    const u = usuarioActual();
    const cheque: Cheque = {
      id: siguienteId("CHE", cheques.map((c) => c.id), 4),
      origen: "PROPIO",
      forma,
      banco: cuenta.banco,
      numero,
      importe: entrada.importe,
      moneda: cuenta.moneda,
      parte: entrada.beneficiario.trim(),
      fechaEmision: hoy(),
      fechaPago: entrada.fechaPago,
      cuentaId: cuenta.id,
      chequeraId: chequera.id,
      referencia: entrada.referencia.trim() || undefined,
      estado: "EMITIDO",
      traza: [{ estado: "EMITIDO", usuario: u.nombre, fechaHora: ahoraTexto(), detalle: `Emitido desde chequera ${chequera.id}` }],
      fechaAlta: hoy(),
      usuarioAlta: u.nombre,
    };
    S.cheques.commit([...cheques, cheque]);
    auditar("Cheque", cheque.id, "ALTA", null, `Propio ${cheque.numero} · ${cheque.parte} · ${cheque.importe} ${cheque.moneda}`);
    const reserva = crearReserva({
      origenTipo: "BANCO",
      origenId: cuenta.id,
      moneda: cuenta.moneda,
      importe: entrada.importe,
      operacionId: entrada.operacionId ?? cheque.id,
    });
    return { ok: true, cheque, reserva };
  }
  return error("La chequera no tiene numeración disponible.");
}

// Cambio de estado de un cheque propio (v4, 2.5). Cada estado tiene un único efecto en los saldos: el
// débito baja el real y consume la reserva; la anulación y el rechazo la liberan con su motivo. Si el
// cheque nació de un pago, el pago y su orden acompañan el cambio (entregarlo deja la orden Pagada).
function cambioPropio(id: string, hacia: EstadoCheque, detalle: string): Res {
  const c = chequePorId(id);
  if (!c || c.origen !== "PROPIO") return error("El cheque propio no existe.");
  const u = usuarioActual();
  if (!u.roles.some((r) => r === "TESORERO" || r === "TESORERO_CENTRAL" || r === "SUPERVISOR"))
    return error("Sólo un Tesorero, el Tesorero central o un Supervisor cambia el estado de un cheque propio.");
  if (!puedeTransicionar(c, hacia)) return error(`Un cheque ${ESTADO_CHEQUE_LABEL[c.estado].toLowerCase()} no puede pasar a ${ESTADO_CHEQUE_LABEL[hacia].toLowerCase()}.`);
  cambiarEstado(c, hacia, detalle);

  const reserva = reservaDeCheque(c);
  if (hacia === "DEBITADO") consumirReserva(reserva?.id, `Cheque ${c.numero} debitado`);
  if (hacia === "ANULADO" || hacia === "RECHAZADO") liberarReserva(reserva?.id, detalle);
  const pago = P.pagos.get().find((p) => p.chequeId === c.id);
  if (pago) {
    cambiarEstadoPago(pago.id, hacia as EstadoPago, detalle);
    recalcularOrden(pago.ordenPago);
  }
  return { ok: true };
}

export const entregarChequePropio = (id: string, destinatario: string): Res =>
  destinatario.trim() ? cambioPropio(id, "ENTREGADO", `Entregado a ${destinatario.trim()}`) : error("Indicá a quién se entrega.");
export const presentarChequePropio = (id: string): Res => cambioPropio(id, "PRESENTADO", "Presentado al cobro por el beneficiario");
export const debitarChequePropio = (id: string): Res => cambioPropio(id, "DEBITADO", "Debitado en el extracto");
export function rechazarChequePropio(id: string, motivo: string): Res {
  if (!motivo.trim()) return error("Indicá el motivo del rechazo.");
  return cambioPropio(id, "RECHAZADO", motivo.trim());
}
export function anularChequePropio(id: string, motivo: string): Res {
  if (!motivo.trim()) return error("Indicá el motivo de la anulación.");
  return cambioPropio(id, "ANULADO", motivo.trim());
}

// ---------- Cheques de terceros en custodia de una caja ----------

export interface EntradaChequeTercero {
  cajaId: string;
  forma: FormaCheque;
  banco: string;
  numero: string;
  importe: number;
  moneda: Moneda;
  librador: string;
  fechaEmision: string;
  fechaPago: string;
}

export function recibirChequeTercero(entrada: EntradaChequeTercero): Res<{ cheque: Cheque }> {
  const caja = S.cajas.get().find((c) => c.id === entrada.cajaId);
  const u = usuarioActual();
  if (!caja || caja.estado !== "ACTIVO") return error("Elegí una caja activa.");
  if (!esResponsable(caja, u.id)) return error("Sólo un responsable de la caja recibe valores en custodia.");
  if (caja.moneda !== "AMBAS" && caja.moneda !== entrada.moneda) return error("La caja no opera en esa moneda.");
  if (!entrada.banco.trim()) return error("Ingresá el banco.");
  if (!entrada.numero.trim()) return error("Ingresá el número del cheque.");
  if (!(entrada.importe > 0)) return error("El importe debe ser mayor a cero.");
  if (!entrada.librador.trim()) return error("Ingresá el librador.");
  if (!fechaValida(entrada.fechaEmision) || !fechaValida(entrada.fechaPago)) return error("Ingresá fechas válidas.");
  if (entrada.fechaPago < entrada.fechaEmision) return error("La fecha de pago no puede ser anterior a la de emisión.");
  const cheques = S.cheques.get();
  if (cheques.some((c) => c.origen === "TERCERO" && c.banco.toLowerCase() === entrada.banco.trim().toLowerCase() && c.numero === entrada.numero.trim()))
    return error("Ya se registró un cheque de ese banco con ese número.");
  const cheque: Cheque = {
    id: siguienteId("CHE", cheques.map((c) => c.id), 4),
    origen: "TERCERO",
    forma: entrada.forma,
    banco: entrada.banco.trim(),
    numero: entrada.numero.trim(),
    importe: entrada.importe,
    moneda: entrada.moneda,
    parte: entrada.librador.trim(),
    fechaEmision: entrada.fechaEmision,
    fechaPago: entrada.fechaPago,
    cajaId: caja.id,
    estado: "EN_CUSTODIA",
    traza: [{ estado: "EN_CUSTODIA", usuario: u.nombre, fechaHora: ahoraTexto(), detalle: `Recibido en custodia de ${caja.nombre}` }],
    fechaAlta: hoy(),
    usuarioAlta: u.nombre,
  };
  S.cheques.commit([...cheques, cheque]);
  auditar("Cheque", cheque.id, "ALTA", null, `Tercero ${cheque.numero} · ${cheque.parte} · ${cheque.importe} ${cheque.moneda} · ${caja.nombre}`);
  return { ok: true, cheque };
}

function cambioTercero(id: string, hacia: EstadoCheque, detalle: string, extra: Partial<Cheque> = {}, validar?: (c: Cheque) => string | null): Res {
  const c = chequePorId(id);
  if (!c || c.origen !== "TERCERO") return error("El cheque de terceros no existe.");
  const caja = c.cajaId ? S.cajas.get().find((x) => x.id === c.cajaId) : undefined;
  if (!caja || !esResponsable(caja, usuarioActual().id)) return error("Sólo un responsable de la caja que lo custodia puede operarlo.");
  if (!puedeTransicionar(c, hacia)) return error(`Un cheque ${ESTADO_CHEQUE_LABEL[c.estado].toLowerCase()} no puede pasar a ${ESTADO_CHEQUE_LABEL[hacia].toLowerCase()}.`);
  const e = validar?.(c);
  if (e) return error(e);
  cambiarEstado(c, hacia, detalle, extra);
  return { ok: true };
}

// Depósito en banco: el cheque sale de la custodia con la cuenta y la fecha del depósito. No genera un
// movimiento de tesorería: los valores se cuentan aparte del efectivo y no tocan el libro.
export function depositarCheque(id: string, cuentaId: string, fecha: string): Res {
  const cuenta = S.cuentasBancarias.get().find((c) => c.id === cuentaId);
  if (!cuenta || cuenta.estado !== "ACTIVO") return error("Elegí una cuenta bancaria activa.");
  if (!fechaValida(fecha)) return error("Ingresá la fecha del depósito.");
  return cambioTercero(id, "DEPOSITADO", `Depositado en ${cuenta.banco} ${cuenta.numero} el ${fecha}`, { cuentaId }, (c) =>
    c.moneda !== cuenta.moneda ? "La cuenta debe ser de la misma moneda que el cheque." : null
  );
}

export function rechazarCheque(id: string, motivo: string): Res {
  if (!motivo.trim()) return error("Indicá el motivo del rechazo.");
  return cambioTercero(id, "RECHAZADO", motivo.trim());
}

export function entregarCheque(id: string, destinatario: string): Res {
  if (!destinatario.trim()) return error("Indicá a quién se entrega.");
  return cambioTercero(id, "ENTREGADO", `Entregado a ${destinatario.trim()}`);
}

// ---------- Conteo de valores en apertura y cierre ----------

// Registra el conteo de cheques en custodia, aparte del efectivo. No bloquea la apertura ni el cierre ni
// cambia su diferencia: si no coincide con el sistema queda la observación en la jornada.
export function registrarConteoValores(jornadaId: string, etapa: "APERTURA" | "CIERRE", declarados: number, observacion = ""): Res {
  const jornada = S.jornadas.get().find((j) => j.id === jornadaId);
  const caja = jornada && S.cajas.get().find((c) => c.id === jornada.cajaId);
  const u = usuarioActual();
  if (!jornada || !caja) return error("La jornada no existe.");
  if (!esResponsable(caja, u.id)) return error("Sólo un responsable de la caja cuenta sus valores.");
  if (!Number.isInteger(declarados) || declarados < 0) return error("Ingresá la cantidad de cheques contados.");
  const esperados = enCustodia(caja.id, S.cheques.get()).length;
  const conforme = declarados === esperados;
  if (!conforme && !observacion.trim()) return error("La cantidad no coincide con el sistema: indicá la observación.");
  const conteo = { usuarioId: u.id, fechaHora: ahoraTexto(), esperados, declarados, conforme, observacion: conforme ? undefined : observacion.trim() };
  S.jornadas.commit(
    S.jornadas.get().map((j) => (j.id === jornada.id ? { ...j, [etapa === "APERTURA" ? "valoresApertura" : "valoresCierre"]: conteo } : j))
  );
  auditar(
    "Valores en custodia",
    jornada.id,
    "ESTADO",
    null,
    `${etapa === "APERTURA" ? "Apertura" : "Cierre"}: ${declarados} de ${esperados} cheques${conforme ? " (conforme)" : ` · ${observacion.trim()}`}`
  );
  return { ok: true };
}
