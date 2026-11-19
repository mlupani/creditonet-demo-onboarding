// Posición de caja y bancos: tablero de tesoros, resumen y alertas. Funciones puras sobre los datos del
// módulo (sin React ni stores): la pantalla les pasa el estado y la fecha y hora operativas.

import { aMinutos, arqueoVencido, cero, enTransito, jornadaVigente, saldosCaja } from "./caja-reglas";
import {
  MONEDAS,
  NOMBRE_MONEDA,
  SIMBOLO,
  monedasDe,
  type Arqueo,
  type Caja,
  type CambioTurno,
  type CuentaBancaria,
  type Jornada,
  type Moneda,
  type MovimientoCaja,
  type MovimientoTesoreria,
  type PorMoneda,
  type RolCaja,
  type Sucursal,
  type TipoCaja,
} from "./caja-tipos";

export interface DatosPosicion {
  cajas: Caja[];
  sucursales: Sucursal[];
  libro: MovimientoCaja[];
  jornadas: Jornada[];
  arqueos: Arqueo[];
  cambiosTurno: CambioTurno[];
  movimientos: MovimientoTesoreria[];
  fecha: string;
  hora: string;
}

export type EstadoTablero = "ABIERTA" | "PENDIENTE" | "CERRADA" | "SIN_ABRIR";
export type TonoTablero = "success" | "warning" | "danger";

export const ESTADO_TABLERO: Record<EstadoTablero, { label: string; tono: TonoTablero }> = {
  ABIERTA: { label: "Abierta", tono: "success" },
  PENDIENTE: { label: "Pendiente de autorización", tono: "warning" },
  CERRADA: { label: "Cerrada", tono: "danger" },
  SIN_ABRIR: { label: "Sin abrir hoy", tono: "danger" },
};

export interface DiferenciaCaja {
  favor: PorMoneda; // sobrantes
  contra: PorMoneda; // faltantes
}

export interface FilaTablero {
  cajaId: string;
  nombre: string;
  sucursal: string;
  tipo: TipoCaja;
  responsableId: string;
  estado: EstadoTablero;
  tono: TonoTablero;
  saldos: PorMoneda;
  monedas: Moneda[];
  diferencias: DiferenciaCaja;
  // Sólo con más de un turno con diferencias: el desglose por cajero del turno.
  porTurno: { turnoUsuarioId: string; diferencia: DiferenciaCaja }[];
}

const sinDiferencia = (): DiferenciaCaja => ({ favor: cero(), contra: cero() });

// Una diferencia aprobada o dentro de la tolerancia es una fila del libro con `diferencia`: el
// ingreso es un sobrante (a favor) y el egreso un faltante (en contra).
export function diferenciasDeCaja(libro: MovimientoCaja[], cajaId: string): { total: DiferenciaCaja; porTurno: Map<string, DiferenciaCaja> } {
  const total = sinDiferencia();
  const porTurno = new Map<string, DiferenciaCaja>();
  for (const m of libro) {
    if (m.cajaId !== cajaId || !m.diferencia || m.estado !== "CONFIRMADO") continue;
    const turno = porTurno.get(m.turnoUsuarioId) ?? sinDiferencia();
    turno.favor[m.moneda] += m.ingreso;
    turno.contra[m.moneda] += m.egreso;
    porTurno.set(m.turnoUsuarioId, turno);
    total.favor[m.moneda] += m.ingreso;
    total.contra[m.moneda] += m.egreso;
  }
  return { total, porTurno };
}

export function estadoTablero(caja: Caja, jornadas: Jornada[], fecha: string): EstadoTablero {
  const vigente = jornadaVigente(jornadas, caja.id);
  if (vigente) return vigente.estado === "ABIERTA" ? "ABIERTA" : "PENDIENTE";
  return jornadas.some((j) => j.cajaId === caja.id && j.fecha === fecha && j.estado === "CERRADA") ? "CERRADA" : "SIN_ABRIR";
}

export function filaTablero(caja: Caja, datos: DatosPosicion): FilaTablero {
  const vigente = jornadaVigente(datos.jornadas, caja.id);
  const estado = estadoTablero(caja, datos.jornadas, datos.fecha);
  const { total, porTurno } = diferenciasDeCaja(datos.libro, caja.id);
  const responsableId =
    vigente?.turnoUsuarioId ?? (caja.tesoreroId || caja.cajeros.find((c) => c.estado === "ACTIVO")?.usuarioId || "");
  return {
    cajaId: caja.id,
    nombre: caja.nombre,
    sucursal: datos.sucursales.find((s) => s.id === caja.sucursalId)?.nombre ?? caja.sucursalId,
    tipo: caja.tipo,
    responsableId,
    estado,
    tono: ESTADO_TABLERO[estado].tono,
    saldos: saldosCaja(datos.libro, caja),
    monedas: monedasDe(caja.moneda),
    diferencias: total,
    porTurno: porTurno.size > 1 ? [...porTurno].map(([turnoUsuarioId, diferencia]) => ({ turnoUsuarioId, diferencia })) : [],
  };
}

export const cajasActivas = (cajas: Caja[]) => cajas.filter((c) => c.estado === "ACTIVO");

export const tablero = (datos: DatosPosicion): FilaTablero[] => cajasActivas(datos.cajas).map((c) => filaTablero(c, datos));

export interface SobreMaximo {
  cajaId: string;
  moneda: Moneda;
  saldo: number;
  maximo: number;
}

export function cajasSobreMaximo(datos: DatosPosicion): SobreMaximo[] {
  const r: SobreMaximo[] = [];
  for (const caja of cajasActivas(datos.cajas)) {
    const saldos = saldosCaja(datos.libro, caja);
    for (const m of monedasDe(caja.moneda)) {
      const maximo = caja.importeMaximo[m];
      if (maximo > 0 && saldos[m] > maximo) r.push({ cajaId: caja.id, moneda: m, saldo: saldos[m], maximo });
    }
  }
  return r;
}

export interface ResumenPosicion {
  pendientes: { movimientos: number; jornadas: number; relevos: number; incidencias: number; total: number };
  enTransito: PorMoneda;
  sobreMaximo: SobreMaximo[];
  diferencias: DiferenciaCaja;
  efectivoTotal: PorMoneda;
}

export function resumenPosicion(datos: DatosPosicion): ResumenPosicion {
  const movimientos = datos.movimientos.filter((m) => m.estado === "SOLICITADO").length;
  const jornadas = datos.jornadas.filter((j) => j.estado === "PEND_APERTURA" || j.estado === "PEND_CIERRE").length;
  const relevos = datos.cambiosTurno.filter((c) => c.estado === "PEND_AUTORIZACION").length;
  const incidencias =
    datos.movimientos.filter((m) => m.estado === "CON_INCIDENCIA").length +
    datos.cambiosTurno.filter((c) => c.estado === "CON_INCIDENCIA").length;
  const transito = cero();
  for (const m of datos.movimientos) if (enTransito(m)) transito[m.moneda] += m.importe;
  const filas = tablero(datos);
  const diferencias = sinDiferencia();
  const efectivoTotal = cero();
  for (const f of filas) {
    for (const m of MONEDAS) {
      diferencias.favor[m] += f.diferencias.favor[m];
      diferencias.contra[m] += f.diferencias.contra[m];
      efectivoTotal[m] += f.saldos[m];
    }
  }
  return {
    pendientes: { movimientos, jornadas, relevos, incidencias, total: movimientos + jornadas + relevos + incidencias },
    enTransito: transito,
    sobreMaximo: cajasSobreMaximo(datos),
    diferencias,
    efectivoTotal,
  };
}

// ---------- Alertas ----------

export type TipoAlerta = "IMPORTE_MAXIMO" | "CAJA_SIN_CERRAR" | "ARQUEO_VENCIDO";

export const TIPO_ALERTA_LABEL: Record<TipoAlerta, string> = {
  IMPORTE_MAXIMO: "Importe máximo superado",
  CAJA_SIN_CERRAR: "Caja sin cerrar",
  ARQUEO_VENCIDO: "Arqueo vencido",
};

export interface Alerta {
  id: string;
  tipo: TipoAlerta;
  cajaId: string;
  mensaje: string;
  destinatarios: RolCaja[];
}

const importe = (moneda: Moneda, valor: number) => `${SIMBOLO[moneda]} ${new Intl.NumberFormat("es-AR").format(valor)}`;

export function calcularAlertas(datos: DatosPosicion): Alerta[] {
  const alertas: Alerta[] = [];

  for (const s of cajasSobreMaximo(datos)) {
    const caja = datos.cajas.find((c) => c.id === s.cajaId);
    alertas.push({
      id: `IMPORTE_MAXIMO:${s.cajaId}:${s.moneda}`,
      tipo: "IMPORTE_MAXIMO",
      cajaId: s.cajaId,
      mensaje: `${caja?.nombre}: el saldo en ${NOMBRE_MONEDA[s.moneda].toLowerCase()} (${importe(s.moneda, s.saldo)}) supera el importe máximo (${importe(s.moneda, s.maximo)}). Conviene un retiro de excedente.`,
      destinatarios: ["TESORERO", "SUPERVISOR"],
    });
  }

  for (const caja of cajasActivas(datos.cajas)) {
    const abierta = datos.jornadas.find((j) => j.cajaId === caja.id && j.estado === "ABIERTA");
    if (abierta) {
      const margen = caja.margenAlertaMin ?? 30;
      const limite = aMinutos(caja.horarioHasta) + margen;
      const deOtroDia = abierta.fecha < datos.fecha;
      if (deOtroDia || (abierta.fecha === datos.fecha && aMinutos(datos.hora) > limite)) {
        alertas.push({
          id: `CAJA_SIN_CERRAR:${caja.id}`,
          tipo: "CAJA_SIN_CERRAR",
          cajaId: caja.id,
          mensaje: deOtroDia
            ? `${caja.nombre} sigue abierta desde el ${abierta.fecha}: nunca se cerró.`
            : `${caja.nombre} sigue abierta pasadas las ${caja.horarioHasta} (más un margen de ${margen} min).`,
          destinatarios: ["TESORERO", "SUPERVISOR"],
        });
      }
    }
    if (arqueoVencido(caja, datos.arqueos, datos.fecha)) {
      alertas.push({
        id: `ARQUEO_VENCIDO:${caja.id}`,
        tipo: "ARQUEO_VENCIDO",
        cajaId: caja.id,
        mensaje: `${caja.nombre}: el arqueo ordinario está vencido (frecuencia ${caja.frecuenciaArqueo.toLowerCase().replace("_", " ")}).`,
        destinatarios: ["SUPERVISOR", "TESORERO"],
      });
    }
  }
  return alertas;
}

export const alertasPara = (alertas: Alerta[], roles: RolCaja[]) =>
  alertas.filter((a) => a.destinatarios.some((r) => roles.includes(r)));

// ---------- Histórico de saldos (v2, 4.3) ----------
//
// Reporte de la evolución de saldos por caja y por cuenta bancaria. Una "serie" es una caja en una
// moneda o una cuenta bancaria. Supuestos:
//  - Caja: saldo = ingresos − egresos del libro, sólo CONFIRMADO y en EFECTIVO (igual que `saldoCaja`).
//  - Banco: saldo = depósitos conciliados (igual que `saldosBancarios`: "acreditado y conciliado"),
//    fechados el día de la acreditación. Lo que está en tránsito o sin conciliar no es saldo. El
//    modelo no registra egresos bancarios, así que el banco sólo tiene ingresos.

export type Periodicidad = "DIARIA" | "MENSUAL";

export interface MovSerie {
  fecha: string;
  hora: string;
  descripcion: string;
  comprobante: string;
  ingreso: number;
  egreso: number;
}

export interface Serie {
  clave: string;
  tipo: "CAJA" | "BANCO";
  id: string;
  nombre: string;
  moneda: Moneda;
  movimientos: MovSerie[];
}

export interface DatosHistorico {
  cajas: Caja[];
  cuentas: CuentaBancaria[];
  libro: MovimientoCaja[];
  movimientos: MovimientoTesoreria[];
}

export function seriesDe(datos: DatosHistorico, cajaIds: string[], cuentaIds: string[], moneda: Moneda | ""): Serie[] {
  const series: Serie[] = [];
  for (const caja of datos.cajas.filter((c) => cajaIds.includes(c.id))) {
    for (const m of monedasDe(caja.moneda)) {
      if (moneda && m !== moneda) continue;
      series.push({
        clave: `CAJA:${caja.id}:${m}`,
        tipo: "CAJA",
        id: caja.id,
        nombre: caja.nombre,
        moneda: m,
        movimientos: datos.libro
          .filter((x) => x.cajaId === caja.id && x.moneda === m && x.estado === "CONFIRMADO" && x.medio === "EFECTIVO")
          .map((x) => ({ fecha: x.fecha, hora: x.hora, descripcion: x.descripcion, comprobante: x.comprobante, ingreso: x.ingreso, egreso: x.egreso })),
      });
    }
  }
  for (const cuenta of datos.cuentas.filter((c) => cuentaIds.includes(c.id))) {
    if (moneda && cuenta.moneda !== moneda) continue;
    series.push({
      clave: `BANCO:${cuenta.id}`,
      tipo: "BANCO",
      id: cuenta.id,
      nombre: `${cuenta.banco} ${cuenta.numero}`,
      moneda: cuenta.moneda,
      movimientos: datos.movimientos
        .filter((x) => x.destino.tipo === "BANCO" && x.destino.cuentaId === cuenta.id && x.envio && x.conciliacion)
        .map((x) => ({
          fecha: x.conciliacion!.fechaAcreditacion,
          hora: "",
          descripcion: `Depósito ${x.id} acreditado`,
          comprobante: x.conciliacion!.referencia || x.boletaDeposito || x.id,
          ingreso: x.importe,
          egreso: 0,
        })),
    });
  }
  return series;
}

const neto = (movs: MovSerie[]) => movs.reduce((s, m) => s + m.ingreso - m.egreso, 0);

export interface FiltroHistorico {
  desde: string; // "" = sin límite
  hasta: string;
  periodicidad: Periodicidad;
}

export interface FilaHistorico {
  periodo: string; // YYYY-MM-DD (diaria) o YYYY-MM (mensual)
  inicial: number;
  ingresos: number;
  egresos: number;
  final: number;
}

export interface BloqueHistorico {
  serie: Serie;
  filas: FilaHistorico[];
}

export interface ConsolidadoHistorico extends FilaHistorico {
  moneda: Moneda;
  series: number;
}

const ultimoDia = (periodoMes: string) => {
  const [a, m] = periodoMes.split("-").map(Number);
  return `${periodoMes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
};

// Ventana (inicio y fin, ya recortada al rango del filtro) de un período.
export function ventanaPeriodo(periodo: string, f: Pick<FiltroHistorico, "desde" | "hasta">): { desde: string; hasta: string } {
  const ini = periodo.length === 7 ? `${periodo}-01` : periodo;
  const fin = periodo.length === 7 ? ultimoDia(periodo) : periodo;
  return { desde: f.desde && f.desde > ini ? f.desde : ini, hasta: f.hasta && f.hasta < fin ? f.hasta : fin };
}

export const periodoDe = (fecha: string, p: Periodicidad) => (p === "MENSUAL" ? fecha.slice(0, 7) : fecha);

// Un bloque por serie y un consolidado por período y moneda. Todos los bloques comparten los mismos
// períodos (los que tuvieron movimiento en alguna serie) para que el consolidado sume saldos completos.
export function historicoSaldos(series: Serie[], f: FiltroHistorico): { bloques: BloqueHistorico[]; consolidado: ConsolidadoHistorico[] } {
  const enRango = (fecha: string) => (!f.desde || fecha >= f.desde) && (!f.hasta || fecha <= f.hasta);
  const periodos = new Set<string>();
  for (const s of series) for (const m of s.movimientos) if (enRango(m.fecha)) periodos.add(periodoDe(m.fecha, f.periodicidad));
  if (periodos.size === 0 && f.hasta && series.length > 0) periodos.add(periodoDe(f.hasta, f.periodicidad));
  const orden = [...periodos].sort();

  const bloques = series.map((serie): BloqueHistorico => ({
    serie,
    filas: orden.map((periodo) => {
      const v = ventanaPeriodo(periodo, f);
      const dentro = serie.movimientos.filter((m) => m.fecha >= v.desde && m.fecha <= v.hasta);
      const inicial = neto(serie.movimientos.filter((m) => m.fecha < v.desde));
      const ingresos = dentro.reduce((s, m) => s + m.ingreso, 0);
      const egresos = dentro.reduce((s, m) => s + m.egreso, 0);
      return { periodo, inicial, ingresos, egresos, final: inicial + ingresos - egresos };
    }),
  }));

  const consolidado: ConsolidadoHistorico[] = [];
  for (const moneda of MONEDAS) {
    const delasMoneda = bloques.filter((b) => b.serie.moneda === moneda);
    if (delasMoneda.length < 2) continue;
    for (const periodo of orden) {
      const filas = delasMoneda.map((b) => b.filas.find((x) => x.periodo === periodo)!);
      consolidado.push({
        periodo,
        moneda,
        series: filas.length,
        inicial: filas.reduce((s, x) => s + x.inicial, 0),
        ingresos: filas.reduce((s, x) => s + x.ingresos, 0),
        egresos: filas.reduce((s, x) => s + x.egresos, 0),
        final: filas.reduce((s, x) => s + x.final, 0),
      });
    }
  }
  return { bloques, consolidado };
}

// Saldo a una fecha: la foto de todas las series al cierre de ese día.
export function saldosAFecha(series: Serie[], fecha: string): { serie: Serie; saldo: number }[] {
  return series.map((serie) => ({ serie, saldo: neto(serie.movimientos.filter((m) => m.fecha <= fecha)) }));
}

// Movimientos de una serie en un período (para abrir el detalle de una fila del histórico).
export function detallePeriodo(serie: Serie, periodo: string, f: Pick<FiltroHistorico, "desde" | "hasta">): MovSerie[] {
  const v = ventanaPeriodo(periodo, f);
  return serie.movimientos
    .filter((m) => m.fecha >= v.desde && m.fecha <= v.hasta)
    .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));
}
