// Operaciones de la Función 6 Proveedores. Cada una valida las reglas del documento funcional, escribe en
// los stores y devuelve { ok } o un error en español para mostrar en pantalla. Actúa el usuario
// seleccionado en el módulo (usuarioActual) en la fecha y hora simuladas de la demo.

import { pagarDesdeCaja, type Res } from "./caja-operaciones";
import { emitirChequePropio } from "./cheques-operaciones";
import { ahoraTexto, auditar, cajaStores, hoy, siguienteId, usuarioActual } from "./caja-store";
import {
  erroresComprobante,
  fechaValida,
  puedeAutorizar,
  saldoComprobante,
  validarCuit,
  type DatosComprobante,
} from "./proveedores-reglas";
import { provStores as P } from "./proveedores-store";
import {
  ESTADO_COMPROBANTE_LABEL,
  type Comprobante,
  type CondicionIva,
  type LoteComprobantes,
  type MedioPago,
  type PagoProveedor,
  type Proveedor,
} from "./proveedores-tipos";

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
  const ordenes = P.comprobantes.get().flatMap((x) => (x.ordenPago ? [x.ordenPago] : []));
  const actualizado: Comprobante = {
    ...c,
    estado: "PARA_LIQUIDAR",
    autorizacion: { usuarioId: usuarioActual().id, fechaHora: ahoraTexto() },
    ordenPago: siguienteId("OP", ordenes, 4),
    rechazo: undefined,
  };
  guardar(actualizado);
  auditar("Comprobante", id, "ESTADO", ESTADO_COMPROBANTE_LABEL[c.estado], `${ESTADO_COMPROBANTE_LABEL.PARA_LIQUIDAR} · ${actualizado.ordenPago}`);
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
  if (c.estado === "PAGADO" || c.estado === "PAGO_PARCIAL" || P.pagos.get().some((p) => p.comprobanteId === id)) {
    return error("El comprobante tiene pagos aplicados: no se puede anular.");
  }
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

// ---------- Pagos ----------

// Registra un pago (total o parcial) de un comprobante Para liquidar o con Pago parcial.
// - Desde una caja: asienta un egreso en su libro. El efectivo exige caja abierta, sin bloqueos, dentro del
//   horario y con saldo; una transferencia o un cheque figuran en el libro sin mover el efectivo.
// - Desde una cuenta bancaria: es un egreso bancario (baja el saldo de la cuenta, que puede quedar en
//   descubierto). Con medio cheque se emite un cheque propio, con chequera opcional.
export function registrarPago(p: {
  comprobanteId: string;
  importe: number;
  medio: MedioPago;
  origenTipo: "CAJA" | "BANCO";
  origenId: string;
  chequeraId?: string;
}): Res<{ pago: PagoProveedor }> {
  const c = comprobantePorId(p.comprobanteId);
  if (!c) return error("No se encontró el comprobante.");
  if (c.estado !== "PARA_LIQUIDAR" && c.estado !== "PAGO_PARCIAL") {
    return error("Sólo se paga un comprobante Para liquidar o con Pago parcial.");
  }
  const tipo = P.tiposComprobante.get().find((t) => t.id === c.tipoId);
  if (tipo?.efecto === "RESTA") return error("Una nota de crédito no se paga: descuenta de la cuenta corriente.");
  const pagos = P.pagos.get();
  const saldo = saldoComprobante(c, pagos);
  if (!(p.importe > 0)) return error("Ingresá el importe del pago.");
  if (p.importe > saldo + 0.001) return error("El importe supera el saldo pendiente del comprobante.");

  if (p.medio === "EFECTIVO" && p.origenTipo !== "CAJA") return error("El efectivo sale de una caja.");

  const proveedor = P.proveedores.get().find((x) => x.id === c.proveedorId);
  const id = siguienteId("PAG", pagos.map((x) => x.id), 4);
  const ordenPago = c.ordenPago ?? "";
  const numeroComp = `${c.prefijo}-${c.numero}`;
  let asientoLibroId: string | undefined;
  let chequeId: string | undefined;

  if (p.origenTipo === "CAJA") {
    const r = pagarDesdeCaja({
      cajaId: p.origenId,
      medio: p.medio,
      importe: p.importe,
      descripcion: `Pago a proveedor ${proveedor?.razonSocial ?? c.proveedorId} · ${ordenPago}`,
      comprobante: numeroComp,
      refId: id,
    });
    if (!r.ok) return r;
    asientoLibroId = r.asientoId;
  } else {
    const cuenta = cajaStores.cuentasBancarias.get().find((x) => x.id === p.origenId);
    if (!cuenta || cuenta.estado !== "ACTIVO") return error("Elegí una cuenta bancaria activa.");
    if (cuenta.moneda !== "ARS") return error("Los pagos a proveedores se hacen en pesos: elegí una cuenta en pesos.");
    if (p.medio === "CHEQUE") {
      const r = emitirChequePropio({
        cuentaId: cuenta.id,
        importe: p.importe,
        beneficiario: proveedor?.razonSocial ?? c.proveedorId,
        fechaPago: hoy(),
        referencia: `${ordenPago} · ${numeroComp}`,
        chequeraId: p.chequeraId || undefined,
      });
      if (!r.ok) return r;
      chequeId = r.cheque.id;
    }
  }

  const pago: PagoProveedor = {
    id,
    ordenPago,
    comprobanteId: c.id,
    proveedorId: c.proveedorId,
    fecha: hoy(),
    medio: p.medio,
    origenTipo: p.origenTipo,
    origenId: p.origenId,
    importe: p.importe,
    usuarioId: usuarioActual().id,
    asiento: siguienteId("AS", pagos.map((x) => x.asiento), 4),
    asientoLibroId,
    chequeId,
  };
  P.pagos.commit([...pagos, pago]);
  const resta = saldoComprobante(c, [...pagos, pago]);
  const estado = resta <= 0.001 ? "PAGADO" : "PAGO_PARCIAL";
  guardar({ ...c, estado });
  auditar("Comprobante", c.id, "ESTADO", ESTADO_COMPROBANTE_LABEL[c.estado], `${ESTADO_COMPROBANTE_LABEL[estado]} · ${pago.id}`);
  return { ok: true, pago };
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
