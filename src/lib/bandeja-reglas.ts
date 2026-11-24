// Bandeja de autorizaciones (v4 y documento de la Bandeja): vistas por rol, tarjetas con cantidad e
// importe, filtros y contingencias. Funciones puras sobre los datos del módulo: no leen stores ni React.

import { cajasVisibles, veTodo } from "./caja-reglas";
import type { Caja, Moneda, MovimientoTesoreria, PorMoneda, UsuarioCaja } from "./caja-tipos";
import type { LoteTransferencia } from "./proveedores-operaciones";
import { pagadoDeOrden, pendienteDeOrden } from "./proveedores-reglas";
import type { OrdenPago, PagoProveedor, Proveedor } from "./proveedores-tipos";

export type VistaBandeja = "proveedores" | "transferencias" | "remesas" | "pendientes";

export const VISTAS: { id: VistaBandeja; label: string; descripcion: string }[] = [
  { id: "proveedores", label: "Proveedores", descripcion: "Órdenes de pago por autorizar y autorizadas para pagar" },
  { id: "transferencias", label: "Transferencias", descripcion: "Lotes por banco: preparar, ejecutar, confirmar" },
  { id: "remesas", label: "Remesas", descripcion: "Movimientos de tesorería: refuerzos, remesas, depósitos y pases" },
  { id: "pendientes", label: "Pendientes", descripcion: "Contingencias: pagos rechazados, parciales e incidencias" },
];

export const esVistaBandeja = (v: string | null | undefined): v is VistaBandeja => VISTAS.some((x) => x.id === v);

const CENTRAL: VistaBandeja[] = ["proveedores", "transferencias", "remesas", "pendientes"];

// Qué botones ve cada rol. Director y Tesorero central ven todo; el Tesorero de sucursal y el Supervisor,
// lo de su sucursal (remesas y contingencias); el Cajero, sus remesas.
export function vistasDe(usuario: UsuarioCaja | undefined): VistaBandeja[] {
  if (!usuario) return [];
  if (veTodo(usuario)) return CENTRAL;
  if (usuario.roles.includes("TESORERO") || usuario.roles.includes("SUPERVISOR")) return ["remesas", "pendientes"];
  if (usuario.roles.includes("CAJERO")) return ["remesas"];
  return [];
}

// El bloque "Operar como cobrador" es del Cajero y del Tesorero de sucursal (Bandeja p. 1-2); el Tesorero
// central lo tiene como opcional y el Director no lo usa.
export const esCobrador = (usuario: UsuarioCaja | undefined) =>
  !!usuario && (usuario.roles.includes("CAJERO") || usuario.roles.includes("TESORERO"));

export interface FiltrosBandeja {
  busqueda: string;
  sucursalId: string; // "" = todas
  moneda: "" | Moneda;
  fechaDesde: string; // "" = sin límite (AAAA-MM-DD)
  fechaHasta: string;
}
export const SIN_FILTROS: FiltrosBandeja = { busqueda: "", sucursalId: "", moneda: "", fechaDesde: "", fechaHasta: "" };

// Filtro de fecha: se compara el día (los primeros 10 caracteres). Un ítem sin fecha no se filtra.
export function enRangoDeFechas(fecha: string | undefined, filtros: Pick<FiltrosBandeja, "fechaDesde" | "fechaHasta">): boolean {
  if (!fecha) return true;
  const dia = fecha.slice(0, 10);
  if (filtros.fechaDesde && dia < filtros.fechaDesde) return false;
  if (filtros.fechaHasta && dia > filtros.fechaHasta) return false;
  return true;
}

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const coincide = (busqueda: string, ...textos: (string | number | undefined)[]) => {
  const q = normalizar(busqueda.trim());
  if (!q) return true;
  return textos.some((t) => normalizar(String(t ?? "")).includes(q));
};

const ceros = (): PorMoneda => ({ ARS: 0, USD: 0 });

export interface TarjetaBandeja {
  cantidad: number;
  importe: PorMoneda;
}
export type ResumenBandeja = Record<VistaBandeja, TarjetaBandeja>;

export interface DatosBandeja {
  usuario: UsuarioCaja;
  ordenes: OrdenPago[];
  pagos: PagoProveedor[];
  proveedores: Proveedor[];
  lotes: LoteTransferencia[];
  movimientos: MovimientoTesoreria[];
  cajas: Caja[];
}

// ---------- Proveedores ----------

export type FaseOrden = "AUTORIZAR" | "PAGAR";
export interface FilaOrden {
  orden: OrdenPago;
  proveedor: Proveedor | undefined;
  fase: FaseOrden;
  // Lo que queda por pagar (en una orden por autorizar, el total).
  pendiente: number;
}

// Órdenes emitidas (esperan autorización) y autorizadas con saldo por pagar. Las que ya tienen todo el
// importe en transferencias en curso se trabajan en la vista Transferencias. Las órdenes se pagan en pesos.
export function ordenesDeBandeja(
  ordenes: OrdenPago[],
  pagos: PagoProveedor[],
  proveedores: Proveedor[],
  filtros: FiltrosBandeja = SIN_FILTROS
): FilaOrden[] {
  if (filtros.moneda === "USD") return [];
  const filas: FilaOrden[] = [];
  for (const orden of ordenes) {
    let fase: FaseOrden;
    let pendiente: number;
    if (orden.estado === "EMITIDA") {
      fase = "AUTORIZAR";
      pendiente = orden.total;
    } else if (orden.estado === "AUTORIZADA") {
      fase = "PAGAR";
      pendiente = pendienteDeOrden(orden, pagos);
      if (pendiente <= 0.001) continue;
    } else continue;
    if (!enRangoDeFechas(orden.fechaArmado, filtros)) continue;
    const proveedor = proveedores.find((p) => p.id === orden.proveedorId);
    if (!coincide(filtros.busqueda, orden.id, proveedor?.razonSocial, proveedor?.fantasia, proveedor?.cuit, proveedor?.id)) continue;
    filas.push({ orden, proveedor, fase, pendiente });
  }
  return filas.sort((a, b) => (a.fase === b.fase ? a.orden.id.localeCompare(b.orden.id) : a.fase === "AUTORIZAR" ? -1 : 1));
}

// ---------- Transferencias ----------

// Lotes con los ítems que coinciden con la búsqueda y el rango de fechas (la fecha es la del pago, por eso
// hace falta la lista de pagos); los lotes que quedan vacíos se omiten.
export function lotesDeBandeja(lotes: LoteTransferencia[], filtros: FiltrosBandeja = SIN_FILTROS, pagos: PagoProveedor[] = []): LoteTransferencia[] {
  if (filtros.moneda === "USD") return [];
  return lotes
    .map((l) => {
      const items = l.items.filter((i) => enRangoDeFechas(pagos.find((p) => p.id === i.pagoId)?.fecha, filtros) && coincide(filtros.busqueda, i.pagoId, i.ordenPago, i.proveedor, i.cuit, i.cbuDestino, i.importe));
      return { ...l, items, total: items.reduce((s, i) => s + i.importe, 0) };
    })
    .filter((l) => l.items.length > 0);
}

// ---------- Remesas ----------

const ESTADOS_ACTIVOS: MovimientoTesoreria["estado"][] = ["SOLICITADO", "AUTORIZADO", "EN_TRANSITO", "CON_INCIDENCIA"];

const sucursalDe = (cajas: Caja[], cajaId: string) => cajas.find((c) => c.id === cajaId)?.sucursalId;

// Movimientos de tesorería que están por resolverse y tocan alguna caja que el usuario ve.
export function remesasDeBandeja(
  movimientos: MovimientoTesoreria[],
  cajas: Caja[],
  usuario: UsuarioCaja,
  filtros: FiltrosBandeja = SIN_FILTROS
): MovimientoTesoreria[] {
  const ids = new Set(cajasVisibles(usuario, cajas).map((c) => c.id));
  return movimientos.filter((m) => {
    if (!ESTADOS_ACTIVOS.includes(m.estado)) return false;
    const destinoCaja = m.destino.tipo === "CAJA" ? m.destino.cajaId : undefined;
    if (!ids.has(m.origenId) && !(destinoCaja && ids.has(destinoCaja))) return false;
    if (filtros.moneda && m.moneda !== filtros.moneda) return false;
    if (!enRangoDeFechas(m.fechaSolicitud, filtros)) return false;
    if (filtros.sucursalId) {
      const s = sucursalDe(cajas, m.origenId);
      const d = destinoCaja ? sucursalDe(cajas, destinoCaja) : undefined;
      if (s !== filtros.sucursalId && d !== filtros.sucursalId) return false;
    }
    return coincide(filtros.busqueda, m.id, m.origenId, destinoCaja, m.motivo, m.importe);
  });
}

// ---------- Pendientes (contingencias) ----------

export type TipoPendiente = "PAGO_RECHAZADO" | "CHEQUE" | "PARCIAL" | "INCIDENCIA";
export const TIPO_PENDIENTE_LABEL: Record<TipoPendiente, string> = {
  PAGO_RECHAZADO: "Transferencia rechazada",
  CHEQUE: "Cheque rechazado o anulado",
  PARCIAL: "Pago parcial",
  INCIDENCIA: "Remesa con incidencia",
};

export interface Pendiente {
  clave: string;
  tipo: TipoPendiente;
  titulo: string;
  detalle: string;
  referencia: string;
  vista: VistaBandeja; // dónde se resuelve
  busqueda: string; // qué buscar al saltar a esa vista
  importe: number;
  moneda: Moneda;
  fecha?: string; // día del hecho (pago, orden o solicitud), para el filtro de fechas
}

const motivoDe = (p: PagoProveedor, estado: PagoProveedor["estado"]) =>
  [...p.historial].reverse().find((e) => e.estado === estado)?.detalle ?? "sin motivo registrado";

export function pendientesDeBandeja(d: DatosBandeja, filtros: FiltrosBandeja = SIN_FILTROS): Pendiente[] {
  const lista: Pendiente[] = [];
  const vistas = vistasDe(d.usuario);
  const nombre = (id: string) => d.proveedores.find((p) => p.id === id)?.razonSocial ?? id;

  if (vistas.includes("proveedores") && filtros.moneda !== "USD") {
    for (const p of d.pagos) {
      const orden = d.ordenes.find((o) => o.id === p.ordenPago);
      if (!orden || orden.estado === "PAGADA" || orden.estado === "ANULADA") continue;
      if (p.estado === "RECHAZADA") {
        lista.push({
          clave: `pago-${p.id}`,
          tipo: "PAGO_RECHAZADO",
          titulo: `${p.id} · ${nombre(p.proveedorId)}`,
          detalle: `La transferencia fue rechazada: ${motivoDe(p, "RECHAZADA")}. La orden ${orden.id} volvió a Autorizada y el importe queda pendiente.`,
          referencia: orden.id,
          vista: "proveedores",
          busqueda: orden.id,
          importe: p.importe,
          moneda: "ARS",
          fecha: p.fecha,
        });
      } else if (p.estado === "RECHAZADO" || p.estado === "ANULADO") {
        lista.push({
          clave: `cheque-${p.id}`,
          tipo: "CHEQUE",
          titulo: `${p.id} · ${nombre(p.proveedorId)}`,
          detalle: `El cheque quedó ${p.estado === "ANULADO" ? "anulado" : "rechazado"}: ${motivoDe(p, p.estado)}. La orden ${orden.id} vuelve a tener ese importe por pagar.`,
          referencia: orden.id,
          vista: "proveedores",
          busqueda: orden.id,
          importe: p.importe,
          moneda: "ARS",
          fecha: p.fecha,
        });
      }
    }
    for (const o of d.ordenes) {
      if (o.estado !== "AUTORIZADA") continue;
      const pagado = pagadoDeOrden(o.id, d.pagos);
      const pendiente = pendienteDeOrden(o, d.pagos);
      if (pagado > 0 && pendiente > 0.001) {
        lista.push({
          clave: `parcial-${o.id}`,
          tipo: "PARCIAL",
          titulo: `${o.id} · ${nombre(o.proveedorId)}`,
          detalle: `Se pagó $ ${pagado.toLocaleString("es-AR")} de $ ${o.total.toLocaleString("es-AR")}. Queda por pagar $ ${pendiente.toLocaleString("es-AR")}.`,
          referencia: o.id,
          vista: "proveedores",
          busqueda: o.id,
          importe: pendiente,
          moneda: "ARS",
          fecha: o.fechaArmado,
        });
      }
    }
  }

  if (vistas.includes("remesas")) {
    const ids = new Set(cajasVisibles(d.usuario, d.cajas).map((c) => c.id));
    for (const m of d.movimientos) {
      if (m.estado !== "CON_INCIDENCIA") continue;
      const destinoCaja = m.destino.tipo === "CAJA" ? m.destino.cajaId : undefined;
      if (!ids.has(m.origenId) && !(destinoCaja && ids.has(destinoCaja))) continue;
      if (filtros.moneda && m.moneda !== filtros.moneda) continue;
      if (filtros.sucursalId) {
        const s = sucursalDe(d.cajas, m.origenId);
        const dest = destinoCaja ? sucursalDe(d.cajas, destinoCaja) : undefined;
        if (s !== filtros.sucursalId && dest !== filtros.sucursalId) continue;
      }
      lista.push({
        clave: `mov-${m.id}`,
        tipo: "INCIDENCIA",
        titulo: m.id,
        detalle: `El destino contó un importe distinto de lo enviado: el dinero no se integra hasta que un supervisor resuelva.`,
        referencia: m.id,
        vista: "remesas",
        busqueda: m.id,
        importe: m.importe,
        moneda: m.moneda,
        fecha: m.fechaSolicitud,
      });
    }
  }
  return lista.filter((p) => enRangoDeFechas(p.fecha, filtros) && coincide(filtros.busqueda, p.referencia, p.titulo, p.detalle));
}

// ---------- Tarjetas ----------

export function resumenBandeja(d: DatosBandeja, filtros: FiltrosBandeja = SIN_FILTROS): ResumenBandeja {
  const r: ResumenBandeja = {
    proveedores: { cantidad: 0, importe: ceros() },
    transferencias: { cantidad: 0, importe: ceros() },
    remesas: { cantidad: 0, importe: ceros() },
    pendientes: { cantidad: 0, importe: ceros() },
  };
  const vistas = vistasDe(d.usuario);

  if (vistas.includes("proveedores")) {
    const filas = ordenesDeBandeja(d.ordenes, d.pagos, d.proveedores, filtros);
    r.proveedores.cantidad = filas.length;
    r.proveedores.importe.ARS = filas.reduce((s, f) => s + f.pendiente, 0);
  }
  if (vistas.includes("transferencias")) {
    const items = lotesDeBandeja(d.lotes, filtros, d.pagos).flatMap((l) => l.items);
    r.transferencias.cantidad = items.length;
    r.transferencias.importe.ARS = items.reduce((s, i) => s + i.importe, 0);
  }
  if (vistas.includes("remesas")) {
    const movs = remesasDeBandeja(d.movimientos, d.cajas, d.usuario, filtros);
    r.remesas.cantidad = movs.length;
    for (const m of movs) r.remesas.importe[m.moneda] += m.importe;
  }
  if (vistas.includes("pendientes")) {
    const ps = pendientesDeBandeja(d, filtros);
    r.pendientes.cantidad = ps.length;
    for (const p of ps) r.pendientes.importe[p.moneda] += p.importe;
  }
  return r;
}

export const totalBandeja = (r: ResumenBandeja, vistas: VistaBandeja[] = CENTRAL): TarjetaBandeja => {
  const total = { cantidad: 0, importe: ceros() };
  for (const v of vistas) {
    total.cantidad += r[v].cantidad;
    total.importe.ARS += r[v].importe.ARS;
    total.importe.USD += r[v].importe.USD;
  }
  return total;
};
