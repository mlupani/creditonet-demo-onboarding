// Reglas puras de la Función 6 Proveedores: CUIT, validación y totales del comprobante, saldos y cuenta
// corriente. No leen stores ni React, así que se prueban solas.

import { fechaIso } from "./caja-reglas";
import type { UsuarioCaja } from "./caja-tipos";
import {
  ALICUOTAS_IVA,
  type AplicacionPago,
  type Comprobante,
  type EstadoPago,
  type ItemOrdenPago,
  type OrdenPago,
  type PagoProveedor,
  type Proveedor,
  type TipoComprobante,
} from "./proveedores-tipos";

const redondear = (n: number) => Math.round(n * 100) / 100;
const IGUALES = 0.01;
const casiIguales = (a: number, b: number) => Math.abs(a - b) <= IGUALES;

// ---------- CUIT ----------

const soloDigitos = (s: string) => s.replace(/\D/g, "");

export function validarCuit(cuit: string): boolean {
  const d = soloDigitos(cuit);
  if (d.length !== 11) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((s, p, i) => s + p * Number(d[i]), 0);
  const resto = 11 - (suma % 11);
  if (resto === 10) return false;
  return (resto === 11 ? 0 : resto) === Number(d[10]);
}

export function formatearCuit(cuit: string): string {
  const d = soloDigitos(cuit);
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : cuit;
}

// ---------- Comprobante ----------

export type DatosComprobante = Pick<
  Comprobante,
  | "tipoId"
  | "fechaComprobante"
  | "fechaVencimiento"
  | "prefijo"
  | "numero"
  | "noGravado"
  | "exento"
  | "subtotalGravado"
  | "gravados"
  | "percepcionIva"
  | "percepcionesIibb"
  | "percepcionesMunicipales"
  | "total"
  | "observaciones"
>;

const suma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

export function calcularTotal(c: DatosComprobante): number {
  return redondear(
    c.noGravado +
      c.exento +
      c.subtotalGravado +
      suma(ALICUOTAS_IVA.map((a) => c.gravados[a].iva)) +
      c.percepcionIva +
      suma(c.percepcionesIibb) +
      suma(c.percepcionesMunicipales)
  );
}

export const fechaValida = (f: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const [a, m, d] = f.split("-").map(Number);
  const fecha = new Date(a, m - 1, d);
  return fecha.getFullYear() === a && fecha.getMonth() === m - 1 && fecha.getDate() === d;
};

export interface ContextoComprobante {
  proveedor: Proveedor | undefined;
  tipos: TipoComprobante[];
  comprobantes: Comprobante[];
  // Si se está corrigiendo un comprobante, se excluye del control de duplicados.
  excluirId?: string;
  // Fecha operativa (para que la fecha del comprobante no sea futura); por defecto, la real.
  hoy?: string;
}

export function erroresComprobante(datos: DatosComprobante, ctx: ContextoComprobante): Record<string, string> {
  const e: Record<string, string> = {};
  const tipo = ctx.tipos.find((t) => t.id === datos.tipoId);
  if (!ctx.proveedor) e.proveedor = "Elegí el proveedor.";
  if (!tipo) e.tipoId = "Elegí un tipo de comprobante.";
  else if (tipo.estado !== "ACTIVO") e.tipoId = "El tipo de comprobante no está activo.";

  if (!fechaValida(datos.fechaComprobante)) e.fechaComprobante = "Ingresá una fecha válida.";
  else if (datos.fechaComprobante > (ctx.hoy ?? fechaIso(new Date()))) e.fechaComprobante = "La fecha no puede ser futura.";

  if (datos.fechaVencimiento) {
    if (!fechaValida(datos.fechaVencimiento)) e.fechaVencimiento = "Ingresá una fecha de vencimiento válida.";
    else if (fechaValida(datos.fechaComprobante) && datos.fechaVencimiento < datos.fechaComprobante)
      e.fechaVencimiento = "El vencimiento no puede ser anterior a la fecha del comprobante.";
  }

  if (!/^\d{1,5}$/.test(datos.prefijo.trim())) e.prefijo = "El prefijo (punto de venta) tiene hasta 5 dígitos.";
  if (!/^\d{1,8}$/.test(datos.numero.trim())) e.numero = "El número tiene hasta 8 dígitos.";

  const importes = [
    datos.noGravado,
    datos.exento,
    datos.subtotalGravado,
    datos.percepcionIva,
    ...ALICUOTAS_IVA.flatMap((a) => [datos.gravados[a].base, datos.gravados[a].iva]),
    ...datos.percepcionesIibb,
    ...datos.percepcionesMunicipales,
  ];
  if (importes.some((x) => !Number.isFinite(x) || x < 0)) e.importes = "Los importes no pueden ser negativos.";

  for (const a of ALICUOTAS_IVA) {
    const { base, iva } = datos.gravados[a];
    if (!casiIguales(redondear((base * Number(a)) / 100), iva)) {
      e[`iva${a}`] = `El IVA ${a.replace(".", ",")} % no es el ${a.replace(".", ",")} % de la base.`;
    }
  }
  if (!casiIguales(suma(ALICUOTAS_IVA.map((a) => datos.gravados[a].base)), datos.subtotalGravado)) {
    e.subtotalGravado = "El subtotal gravado no coincide con la suma de las bases por alícuota.";
  }
  if (datos.percepcionesIibb.length > 3) e.percepcionesIibb = "Hasta 3 percepciones de IIBB.";
  if (datos.percepcionesMunicipales.length > 2) e.percepcionesMunicipales = "Hasta 2 percepciones municipales.";

  if (!(datos.total > 0)) e.total = "El total debe ser mayor a cero.";
  else if (!e.importes && !casiIguales(calcularTotal(datos), datos.total)) e.total = "Los totales no cierran.";

  // Control de duplicados: mismo CUIT, tipo, prefijo y número.
  if (ctx.proveedor && tipo) {
    const cuit = soloDigitos(ctx.proveedor.cuit);
    const dup = ctx.comprobantes.find((c) => {
      if (c.id === ctx.excluirId) return false;
      const p = ctx.proveedor?.id === c.proveedorId ? ctx.proveedor : undefined;
      return (
        p !== undefined &&
        soloDigitos(p.cuit) === cuit &&
        c.tipoId === datos.tipoId &&
        Number(c.prefijo) === Number(datos.prefijo) &&
        Number(c.numero) === Number(datos.numero)
      );
    });
    if (dup) e.duplicado = `Ya está cargado (${dup.id}): mismo CUIT, tipo, prefijo y número.`;
  }
  return e;
}

// ---------- Estados de los pagos (v4, 2.5) ----------

// Un pago "hecho" baja el saldo del proveedor: la transferencia desde que se ejecuta, el cheque desde que
// se entrega (la OP queda Pagada con la entrega, aunque el banco todavía no lo debite) y el efectivo al
// instante. Un pago "en curso" ya reservó el saldo pero todavía no se hizo.
const PAGO_HECHO: EstadoPago[] = ["EJECUTADA", "CONFIRMADA", "ENTREGADO", "PRESENTADO", "DEBITADO"];
const PAGO_EN_CURSO: EstadoPago[] = ["PREPARADA", "PENDIENTE_EJECUCION", "EMITIDO"];

export const pagoHecho = (p: Pick<PagoProveedor, "estado">) => PAGO_HECHO.includes(p.estado);
export const pagoEnCurso = (p: Pick<PagoProveedor, "estado">) => PAGO_EN_CURSO.includes(p.estado);
// Hecho o en curso: cuenta contra lo que queda por pagar de la orden.
export const pagoVigente = (p: Pick<PagoProveedor, "estado">) => pagoHecho(p) || pagoEnCurso(p);

// ---------- Saldos ----------

export const pagadoDe = (comprobanteId: string, pagos: PagoProveedor[]): number =>
  redondear(
    suma(
      pagos
        .filter(pagoHecho)
        .flatMap((p) => p.aplicaciones.filter((a) => a.comprobanteId === comprobanteId).map((a) => a.importe))
    )
  );

const ORDEN_VIGENTE = (o: OrdenPago) => o.estado !== "RECHAZADA" && o.estado !== "ANULADA";

// Crédito de notas de crédito aplicado al comprobante en una orden vigente (en la nota, su importe entero).
export const creditoDe = (comprobanteId: string, ordenes: OrdenPago[]): number =>
  redondear(suma(ordenes.filter(ORDEN_VIGENTE).flatMap((o) => o.items.filter((i) => i.comprobanteId === comprobanteId).map((i) => i.credito))));

export const saldoComprobante = (c: Comprobante, pagos: PagoProveedor[], ordenes: OrdenPago[] = []): number =>
  redondear(c.total - pagadoDe(c.id, pagos) - creditoDe(c.id, ordenes));

// Sólo impactan en la cuenta corriente los comprobantes autorizados o posteriores.
const IMPACTAN = ["PARA_LIQUIDAR", "EN_ORDEN_PAGO", "PAGO_PARCIAL", "PAGADO"];

export interface FilaCuentaCorriente {
  clave: string;
  tipoFila: "COMPROBANTE" | "PAGO";
  id: string; // id del comprobante o del pago
  comprobanteId: string;
  fechaCarga: string; // en los pagos, la fecha de pago
  fechaComprobante: string; // vacía en los pagos
  vencimiento: string; // vacío en los pagos
  tipoDescripcion: string; // en los pagos, "Pago"
  numero: string; // en los pagos, la orden de pago
  importe: number; // con signo: positivo suma deuda, negativo la descuenta
  pagosAplicados: number; // sólo en filas de comprobante
  saldoPendiente: number; // sólo en filas de comprobante
  saldoAcumulado: number;
}

export function cuentaCorriente(
  proveedorId: string,
  comprobantes: Comprobante[],
  pagos: PagoProveedor[],
  tipos: TipoComprobante[],
  rango: { desde?: string; hasta?: string } = {},
  ordenes: OrdenPago[] = []
): { saldoInicial: number; filas: FilaCuentaCorriente[]; saldoActual: number } {
  const efecto = (c: Comprobante) => (tipos.find((t) => t.id === c.tipoId)?.efecto === "RESTA" ? -1 : 1);
  type Mov = Omit<FilaCuentaCorriente, "saldoAcumulado"> & { orden: number };
  const movs: Mov[] = [];

  for (const c of comprobantes.filter((x) => x.proveedorId === proveedorId && IMPACTAN.includes(x.estado))) {
    const tipo = tipos.find((t) => t.id === c.tipoId);
    movs.push({
      clave: c.id,
      tipoFila: "COMPROBANTE",
      id: c.id,
      comprobanteId: c.id,
      fechaCarga: c.fechaCarga,
      fechaComprobante: c.fechaComprobante,
      vencimiento: vencimientoDe(c),
      tipoDescripcion: tipo?.descripcion ?? c.tipoId,
      numero: `${c.prefijo}-${c.numero}`,
      importe: efecto(c) * c.total,
      pagosAplicados: redondear(pagadoDe(c.id, pagos) + creditoDe(c.id, ordenes)),
      saldoPendiente: saldoComprobante(c, pagos, ordenes),
      orden: 0,
    });
  }
  // Sólo los pagos hechos son un movimiento de la cuenta corriente (las notas de crédito ya figuran).
  for (const p of pagos.filter((x) => x.proveedorId === proveedorId && pagoHecho(x))) {
    movs.push({
      clave: p.id,
      tipoFila: "PAGO",
      id: p.id,
      comprobanteId: p.aplicaciones[0]?.comprobanteId ?? "",
      fechaCarga: p.fecha,
      fechaComprobante: "",
      vencimiento: "",
      tipoDescripcion: "Pago",
      numero: p.ordenPago,
      importe: -p.importe,
      pagosAplicados: 0,
      saldoPendiente: 0,
      orden: 1,
    });
  }
  movs.sort((a, b) => a.fechaCarga.localeCompare(b.fechaCarga) || a.orden - b.orden || a.clave.localeCompare(b.clave));

  const saldoInicial = redondear(
    suma(movs.filter((m) => rango.desde && m.fechaCarga < rango.desde).map((m) => m.importe))
  );
  let acumulado = saldoInicial;
  const filas: FilaCuentaCorriente[] = [];
  for (const m of movs) {
    if (rango.desde && m.fechaCarga < rango.desde) continue;
    if (rango.hasta && m.fechaCarga > rango.hasta) continue;
    acumulado = redondear(acumulado + m.importe);
    const { orden: _orden, ...fila } = m;
    void _orden;
    filas.push({ ...fila, saldoAcumulado: acumulado });
  }
  return { saldoInicial, filas, saldoActual: acumulado };
}

export const saldoProveedor = (
  proveedorId: string,
  comprobantes: Comprobante[],
  pagos: PagoProveedor[],
  tipos: TipoComprobante[],
  ordenes: OrdenPago[] = []
): number => cuentaCorriente(proveedorId, comprobantes, pagos, tipos, {}, ordenes).saldoActual;

// ---------- Vencimientos y antigüedad de deuda ----------

// Sin fecha de vencimiento el comprobante vence a la vista: el día de su fecha.
export const vencimientoDe = (c: Pick<Comprobante, "fechaVencimiento" | "fechaComprobante">): string =>
  c.fechaVencimiento || c.fechaComprobante;

const aDias = (fecha: string) => {
  const [a, m, d] = fecha.split("-").map(Number);
  return Math.round(Date.UTC(a, m - 1, d) / 86400000);
};

// Días de atraso a la fecha de corte: positivo si ya venció, 0 o negativo si todavía no.
export const diasDeAtraso = (vencimiento: string, fechaCorte: string): number => aDias(fechaCorte) - aDias(vencimiento);

export type TramoDeuda = "NO_VENCIDO" | "D1_30" | "D31_60" | "D61_90" | "MAS_90";
export const TRAMOS_DEUDA: { id: TramoDeuda; label: string }[] = [
  { id: "NO_VENCIDO", label: "No vencido" },
  { id: "D1_30", label: "1–30" },
  { id: "D31_60", label: "31–60" },
  { id: "D61_90", label: "61–90" },
  { id: "MAS_90", label: "Más de 90" },
];

export const tramoDeAtraso = (dias: number): TramoDeuda =>
  dias <= 0 ? "NO_VENCIDO" : dias <= 30 ? "D1_30" : dias <= 60 ? "D31_60" : dias <= 90 ? "D61_90" : "MAS_90";

export type DeudaPorTramo = Record<TramoDeuda, number> & { total: number };
const deudaVacia = (): DeudaPorTramo => ({ NO_VENCIDO: 0, D1_30: 0, D31_60: 0, D61_90: 0, MAS_90: 0, total: 0 });

// Deuda con cada proveedor por antigüedad: sólo comprobantes que impactan en la cuenta corriente, de
// efecto suma y con saldo pendiente. Los tramos cuentan los días vencidos a la fecha de corte.
export function antiguedadDeuda(
  comprobantes: Comprobante[],
  pagos: PagoProveedor[],
  tipos: TipoComprobante[],
  fechaCorte: string,
  proveedorId?: string,
  ordenes: OrdenPago[] = []
): { porProveedor: ({ proveedorId: string } & DeudaPorTramo)[]; total: DeudaPorTramo } {
  const porProveedor = new Map<string, DeudaPorTramo>();
  const total = deudaVacia();
  for (const c of comprobantes) {
    if (!IMPACTAN.includes(c.estado) || (proveedorId && c.proveedorId !== proveedorId)) continue;
    if (tipos.find((t) => t.id === c.tipoId)?.efecto === "RESTA") continue;
    const saldo = saldoComprobante(c, pagos, ordenes);
    if (!(saldo > 0)) continue;
    const tramo = tramoDeAtraso(diasDeAtraso(vencimientoDe(c), fechaCorte));
    const fila = porProveedor.get(c.proveedorId) ?? deudaVacia();
    for (const destino of [fila, total]) {
      destino[tramo] = redondear(destino[tramo] + saldo);
      destino.total = redondear(destino.total + saldo);
    }
    porProveedor.set(c.proveedorId, fila);
  }
  return { porProveedor: [...porProveedor].map(([id, f]) => ({ proveedorId: id, ...f })), total };
}

// ---------- Permisos ----------

// Autoriza un Supervisor o un Tesorero, y nunca quien cargó el comprobante.
export function puedeAutorizar(usuario: UsuarioCaja, comprobante: Comprobante): string | null {
  if (!usuario.roles.some((r) => r === "SUPERVISOR" || r === "TESORERO")) {
    return "Sólo un Supervisor o un Tesorero autoriza comprobantes.";
  }
  if (comprobante.cargadoPor === usuario.id) return "No podés autorizar un comprobante que cargaste vos.";
  return null;
}


// ---------- Órdenes de pago (v4, 6.2) ----------

const tieneAlgunRol = (u: UsuarioCaja, roles: string[]) => u.roles.some((r) => roles.includes(r));

// Perfil financiero: arma la orden de pago.
export function puedeArmarOrden(usuario: UsuarioCaja): string | null {
  return tieneAlgunRol(usuario, ["TESORERO", "TESORERO_CENTRAL", "SUPERVISOR"])
    ? null
    : "Sólo el perfil financiero (Tesorero, Tesorero central o Supervisor) arma órdenes de pago.";
}

// Autoriza otro usuario (nunca quien la armó, aunque tenga varios roles), con perfil de Casa Central o Supervisor.
export function puedeAutorizarOrden(usuario: UsuarioCaja, orden: Pick<OrdenPago, "armadaPor">): string | null {
  if (!tieneAlgunRol(usuario, ["TESORERO_CENTRAL", "DIRECTOR", "SUPERVISOR"]))
    return "Sólo el Tesorero central, el Director o un Supervisor autoriza órdenes de pago.";
  if (orden.armadaPor === usuario.id) return "No podés autorizar una orden de pago que armaste vos.";
  return null;
}

// Paga el Tesoro central; el Tesorero de una sucursal sólo cuando Casa Central le deriva la orden.
export function puedePagarOrden(usuario: UsuarioCaja): string | null {
  return tieneAlgunRol(usuario, ["TESORERO_CENTRAL", "TESORERO"])
    ? null
    : "Sólo el Tesorero central (o un Tesorero al que se derive la orden) paga órdenes de pago.";
}

export const importeDeOrden = (o: Pick<OrdenPago, "items">): number => redondear(suma(o.items.map((i) => i.aPagar)));

// Lo pagado de la orden (pagos hechos) y lo que todavía no está comprometido en un pago.
export const pagadoDeOrden = (ordenId: string, pagos: PagoProveedor[]): number =>
  redondear(suma(pagos.filter((p) => p.ordenPago === ordenId && pagoHecho(p)).map((p) => p.importe)));
export const comprometidoDeOrden = (ordenId: string, pagos: PagoProveedor[]): number =>
  redondear(suma(pagos.filter((p) => p.ordenPago === ordenId && pagoEnCurso(p)).map((p) => p.importe)));
// Pendiente de pagar: ni hecho ni en curso (un pago parcial deja saldo para el siguiente).
export const pendienteDeOrden = (orden: Pick<OrdenPago, "id" | "total">, pagos: PagoProveedor[]): number =>
  redondear(orden.total - pagadoDeOrden(orden.id, pagos) - comprometidoDeOrden(orden.id, pagos));

const vencimientoOrden = (c: Comprobante | undefined) => (c ? vencimientoDe(c) : "9999-12-31");

// Arma los renglones de una orden con los comprobantes elegidos: un solo proveedor, todos Para liquidar,
// al menos una factura o nota de débito. Las notas de crédito restan: su importe se aplica, en orden de
// vencimiento, a las facturas de la orden (no puede superarlas).
export function itemsDeOrden(
  seleccion: Comprobante[],
  tipos: TipoComprobante[],
  pagos: PagoProveedor[],
  ordenes: OrdenPago[]
): { ok: true; items: ItemOrdenPago[]; total: number; proveedorId: string } | { ok: false; error: string } {
  if (seleccion.length === 0) return { ok: false, error: "Tildá al menos un comprobante." };
  const proveedorId = seleccion[0].proveedorId;
  if (seleccion.some((c) => c.proveedorId !== proveedorId)) return { ok: false, error: "Una orden de pago no puede mezclar proveedores." };
  if (seleccion.some((c) => c.estado !== "PARA_LIQUIDAR")) return { ok: false, error: "Sólo se pueden incluir comprobantes en estado Para liquidar." };
  const esNota = (c: Comprobante) => tipos.find((t) => t.id === c.tipoId)?.efecto === "RESTA";
  const facturas = seleccion.filter((c) => !esNota(c)).sort((a, b) => vencimientoOrden(a).localeCompare(vencimientoOrden(b)) || a.id.localeCompare(b.id));
  const notas = seleccion.filter(esNota);
  if (facturas.length === 0) return { ok: false, error: "Incluí al menos una factura o nota de débito: una nota de crédito sola no se paga." };
  let pool = redondear(suma(notas.map((n) => saldoComprobante(n, pagos, ordenes))));
  const items: ItemOrdenPago[] = [];
  for (const f of facturas) {
    const saldo = saldoComprobante(f, pagos, ordenes);
    const credito = redondear(Math.min(pool, saldo));
    pool = redondear(pool - credito);
    items.push({ comprobanteId: f.id, credito, aPagar: redondear(saldo - credito) });
  }
  if (pool > 0.001) return { ok: false, error: "Las notas de crédito superan el importe de las facturas de la orden." };
  for (const n of notas) items.push({ comprobanteId: n.id, credito: saldoComprobante(n, pagos, ordenes), aPagar: 0 });
  const total = importeDeOrden({ items });
  if (!(total > 0)) return { ok: false, error: "La orden de pago no puede ser de importe cero." };
  return { ok: true, items, total, proveedorId };
}

// Reparte un pago entre los comprobantes de la orden, en orden de vencimiento, sobre lo que a cada uno
// le falta pagar (sin contar lo ya pagado ni lo comprometido en otros pagos vigentes).
export function repartirPago(
  orden: Pick<OrdenPago, "id" | "items">,
  comprobantes: Comprobante[],
  pagos: PagoProveedor[],
  importe: number
): AplicacionPago[] {
  const vigentes = pagos.filter((p) => p.ordenPago === orden.id && pagoVigente(p));
  const yaAplicado = (id: string) => suma(vigentes.flatMap((p) => p.aplicaciones.filter((a) => a.comprobanteId === id).map((a) => a.importe)));
  const orden_ = [...orden.items]
    .filter((i) => i.aPagar > 0)
    .sort((a, b) => vencimientoOrden(comprobantes.find((c) => c.id === a.comprobanteId)).localeCompare(vencimientoOrden(comprobantes.find((c) => c.id === b.comprobanteId))));
  const aplicaciones: AplicacionPago[] = [];
  let resto = importe;
  for (const i of orden_) {
    if (resto <= 0.001) break;
    const falta = redondear(i.aPagar - yaAplicado(i.comprobanteId));
    if (falta <= 0.001) continue;
    const parte = redondear(Math.min(falta, resto));
    aplicaciones.push({ comprobanteId: i.comprobanteId, importe: parte });
    resto = redondear(resto - parte);
  }
  return aplicaciones;
}
