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
