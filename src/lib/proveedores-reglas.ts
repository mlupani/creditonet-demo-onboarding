// Reglas puras de la Función 6 Proveedores: CUIT, validación y totales del comprobante, saldos y cuenta
// corriente. No leen stores ni React, así que se prueban solas.

import { fechaIso } from "./caja-reglas";
import type { UsuarioCaja } from "./caja-tipos";
import {
  ALICUOTAS_IVA,
  type Comprobante,
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

// ---------- Saldos ----------

export const pagadoDe = (comprobanteId: string, pagos: PagoProveedor[]): number =>
  redondear(suma(pagos.filter((p) => p.comprobanteId === comprobanteId).map((p) => p.importe)));

export const saldoComprobante = (c: Comprobante, pagos: PagoProveedor[]): number =>
  redondear(c.total - pagadoDe(c.id, pagos));

// Sólo impactan en la cuenta corriente los comprobantes autorizados o posteriores.
const IMPACTAN = ["PARA_LIQUIDAR", "PAGO_PARCIAL", "PAGADO"];

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
  rango: { desde?: string; hasta?: string } = {}
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
      pagosAplicados: pagadoDe(c.id, pagos),
      saldoPendiente: saldoComprobante(c, pagos),
      orden: 0,
    });
  }
  for (const p of pagos.filter((x) => x.proveedorId === proveedorId)) {
    movs.push({
      clave: p.id,
      tipoFila: "PAGO",
      id: p.id,
      comprobanteId: p.comprobanteId,
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
  tipos: TipoComprobante[]
): number => cuentaCorriente(proveedorId, comprobantes, pagos, tipos).saldoActual;

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
  proveedorId?: string
): { porProveedor: ({ proveedorId: string } & DeudaPorTramo)[]; total: DeudaPorTramo } {
  const porProveedor = new Map<string, DeudaPorTramo>();
  const total = deudaVacia();
  for (const c of comprobantes) {
    if (!IMPACTAN.includes(c.estado) || (proveedorId && c.proveedorId !== proveedorId)) continue;
    if (tipos.find((t) => t.id === c.tipoId)?.efecto === "RESTA") continue;
    const saldo = saldoComprobante(c, pagos);
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
