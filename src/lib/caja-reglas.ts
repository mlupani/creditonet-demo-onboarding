// Reglas puras del módulo Caja y Bancos: saldos, recuentos, tolerancias, validaciones de los ABM y
// permisos. No leen stores ni React, así que se prueban solas (caja-reglas.test.ts).

import {
  DIAS_SEMANA,
  FRECUENCIA_ARQUEO_DIAS,
  MONEDAS,
  esTesoro,
  monedasDe,
  type Arqueo,
  type Caja,
  type CierreSucursal,
  type DetalleRecuento,
  type Denominacion,
  type ExcepcionHorario,
  type Feriado,
  type Jornada,
  type Moneda,
  type MovimientoCaja,
  type MovimientoTesoreria,
  type PorMoneda,
  type RolCaja,
  type Sucursal,
  type UsuarioCaja,
} from "./caja-tipos";

export const cero = (): PorMoneda => ({ ARS: 0, USD: 0 });

// ---------- Fechas y horas (formato ISO local, sin zona) ----------

const dos = (n: number) => String(n).padStart(2, "0");
export const fechaIso = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
export const fechaHoraIso = (d: Date, hora?: string) => `${fechaIso(d)} ${hora ?? `${dos(d.getHours())}:${dos(d.getMinutes())}`}`;
export const aMinutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

// ---------- Saldos ----------

// Sólo el efectivo confirmado mueve el saldo; tarjeta y transferencia figuran en el libro sin tocarlo.
export function saldoCaja(libro: MovimientoCaja[], cajaId: string, moneda: Moneda): number {
  return libro
    .filter((m) => m.cajaId === cajaId && m.moneda === moneda && m.medio === "EFECTIVO" && m.estado === "CONFIRMADO")
    .reduce((s, m) => s + m.ingreso - m.egreso, 0);
}

export function saldosCaja(libro: MovimientoCaja[], caja: Caja): PorMoneda {
  const r = cero();
  for (const m of monedasDe(caja.moneda)) r[m] = saldoCaja(libro, caja.id, m);
  return r;
}

// ---------- Recuento ----------

export function totalRecuento(detalle: DetalleRecuento, denominaciones: Denominacion[]): PorMoneda {
  const r = cero();
  for (const d of denominaciones) r[d.moneda] += (detalle[d.id] ?? 0) * d.valor;
  return r;
}

// Sólo las denominaciones activas aparecen en los recuentos.
export const denominacionesDe = (denominaciones: Denominacion[], moneda: Moneda) =>
  denominaciones.filter((d) => d.moneda === moneda && d.estado === "ACTIVA").sort((a, b) => b.valor - a.valor);

// Ayuda de la demo: arma el recuento exacto de un importe con las denominaciones activas.
export function recuentoSugerido(denominaciones: Denominacion[], moneda: Moneda, importe: number): DetalleRecuento {
  const detalle: DetalleRecuento = {};
  let resto = Math.max(0, Math.round(importe));
  for (const d of denominacionesDe(denominaciones, moneda)) {
    const n = Math.floor(resto / d.valor);
    if (n > 0) {
      detalle[d.id] = n;
      resto -= n * d.valor;
    }
  }
  return detalle;
}

export function diferenciaRecuento(contado: PorMoneda, esperado: PorMoneda, monedas: Moneda[]): PorMoneda {
  const r = cero();
  for (const m of monedas) r[m] = contado[m] - esperado[m];
  return r;
}

// Positiva = sobrante (acreedora). Negativa = faltante (deudora). Cada moneda se evalúa por separado.
export function fueraDeTolerancia(caja: Caja, moneda: Moneda, diferencia: number): boolean {
  if (diferencia > 0) return diferencia > caja.toleranciaSobrante[moneda];
  if (diferencia < 0) return -diferencia > caja.toleranciaFaltante[moneda];
  return false;
}

export const monedasFueraDeTolerancia = (caja: Caja, diferencia: PorMoneda): Moneda[] =>
  monedasDe(caja.moneda).filter((m) => fueraDeTolerancia(caja, m, diferencia[m]));

// ---------- Horarios y turnos ----------

export const enHorario = (caja: Caja, hora: string) =>
  aMinutos(hora) >= aMinutos(caja.horarioDesde) && aMinutos(hora) < aMinutos(caja.horarioHasta);

export function turnoActivoEn(caja: Caja, hora: string) {
  return caja.cajeros.find(
    (c) => c.estado === "ACTIVO" && aMinutos(hora) >= aMinutos(c.desde) && aMinutos(hora) < aMinutos(c.hasta)
  );
}

export const excepcionVigente = (
  excepciones: ExcepcionHorario[],
  cajaId: string,
  usuarioId: string,
  fecha: string,
  hora: string
) =>
  excepciones.find(
    (e) =>
      e.cajaId === cajaId &&
      e.usuarioId === usuarioId &&
      e.fecha === fecha &&
      aMinutos(hora) <= aMinutos(e.hastaHora)
  );

export const esResponsable = (caja: Caja, usuarioId: string) =>
  caja.tesoreroId === usuarioId || caja.cajeros.some((c) => c.usuarioId === usuarioId && c.estado === "ACTIVO");

// ---------- Días operativos y feriados ----------

export const esFeriado = (feriados: Feriado[], fecha: string) =>
  feriados.some((f) => f.estado === "ACTIVO" && f.fecha === fecha);

export const diaDeSemana = (fecha: string) => new Date(`${fecha}T12:00:00`).getDay();

// En feriado, o un día que la caja no opera, la caja no opera salvo excepción.
export function motivoNoOperativo(caja: Caja, fecha: string, feriados: Feriado[]): string | undefined {
  const feriado = feriados.find((f) => f.estado === "ACTIVO" && f.fecha === fecha);
  if (feriado) return `Hoy es feriado (${feriado.descripcion}) y la caja no opera.`;
  if (!caja.diasOperativos.includes(diaDeSemana(fecha))) return `La caja no opera los ${DIAS_SEMANA[diaDeSemana(fecha)].toLowerCase()}.`;
  return undefined;
}

// ---------- Cierre diario de sucursal ----------

export const cierreVigente = (cierres: CierreSucursal[], sucursalId: string, fecha: string) =>
  cierres.find((c) => c.sucursalId === sucursalId && c.fecha === fecha && c.estado === "CERRADA");

// ---------- Reserva y mínimo operativo ----------

// Importe aprobado que espera su envío: queda reservado y no se puede comprometer en otro movimiento.
export function reservado(movimientos: MovimientoTesoreria[], cajaId: string, moneda: Moneda, ignorarId?: string): number {
  return movimientos
    // Un pedido de refuerzo a banco no reserva en el tesoro (`origenId` es quien recibe): reserva en la cuenta.
    .filter((m) => m.origenId === cajaId && !m.origenBancoId && m.moneda === moneda && m.estado === "AUTORIZADO" && m.id !== ignorarId)
    .reduce((s, m) => s + m.importe, 0);
}

// Lo que se puede comprometer: saldo menos lo reservado y menos el mínimo operativo de la caja.
export function disponibleParaAutorizar(libro: MovimientoCaja[], movimientos: MovimientoTesoreria[], caja: Caja, moneda: Moneda, ignorarId?: string): number {
  return saldoCaja(libro, caja.id, moneda) - reservado(movimientos, caja.id, moneda, ignorarId) - (caja.minimoOperativo?.[moneda] ?? 0);
}

// ---------- Roles y permisos ----------

export const tieneRol = (u: UsuarioCaja | undefined, rol: RolCaja) => !!u?.roles.includes(rol);
// El Tesorero incluye las facultades del Cajero.
export const puedeOperarCaja = (u: UsuarioCaja | undefined) => tieneRol(u, "CAJERO") || tieneRol(u, "TESORERO");
export const esSupervisor = (u: UsuarioCaja | undefined) => tieneRol(u, "SUPERVISOR");
// Permiso especial "Realizar arqueo": Supervisor y Tesorero.
export const puedeArquear = (u: UsuarioCaja | undefined) => tieneRol(u, "SUPERVISOR") || tieneRol(u, "TESORERO");
// Nadie aprueba una operación que cargó él mismo.
export const puedeAprobar = (u: UsuarioCaja | undefined, cargoId: string) => esSupervisor(u) && u?.id !== cargoId;

// ---------- Validaciones de los ABM ----------

const normalizar = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
export const nombreRepetido = (nombre: string, otros: { id: string; nombre: string }[], ignorarId?: string) =>
  otros.some((o) => o.id !== ignorarId && normalizar(o.nombre) === normalizar(nombre));

export const cajasActivasDe = (cajas: Caja[], sucursalId: string) =>
  cajas.filter((c) => c.sucursalId === sucursalId && c.estado === "ACTIVO");

// No se puede suspender ni eliminar una sucursal con cajas activas.
export function errorBajaSucursal(sucursal: Sucursal, cajas: Caja[]): string | undefined {
  const n = cajasActivasDe(cajas, sucursal.id).length;
  return n > 0 ? `La sucursal tiene ${n} ${n === 1 ? "caja activa" : "cajas activas"}. Suspendé o eliminá primero las cajas.` : undefined;
}

export const jornadaVigente = (jornadas: Jornada[], cajaId: string): Jornada | undefined =>
  jornadas.find((j) => j.cajaId === cajaId && j.estado !== "CERRADA");

// No se puede suspender ni eliminar una caja con saldo o abierta, ni cambiar responsables con la caja abierta.
export function errorBajaCaja(caja: Caja, libro: MovimientoCaja[], jornadas: Jornada[]): string | undefined {
  if (jornadaVigente(jornadas, caja.id)) return "La caja está abierta. Cerrala antes de suspenderla o eliminarla.";
  const saldos = saldosCaja(libro, caja);
  const conSaldo = MONEDAS.filter((m) => saldos[m] !== 0);
  if (conSaldo.length > 0) return "La caja tiene saldo. Retirá los fondos con un movimiento de tesorería (fondo de cierre).";
  return undefined;
}

export function errorCambioResponsables(antes: Caja, despues: Caja, jornadas: Jornada[]): string | undefined {
  if (!jornadaVigente(jornadas, antes.id)) return undefined;
  const firma = (c: Caja) =>
    JSON.stringify([c.tesoreroId, c.cajeros.map((x) => [x.usuarioId, x.desde, x.hasta, x.estado])]);
  return firma(antes) !== firma(despues) ? "No se pueden cambiar los responsables con la caja abierta." : undefined;
}

// Valida una caja contra el resto de las cajas, las sucursales y los usuarios. Devuelve un error por campo.
export function erroresCaja(
  caja: Caja,
  cajas: Caja[],
  sucursales: Sucursal[],
  usuarios: UsuarioCaja[]
): Record<string, string> {
  const e: Record<string, string> = {};
  const otras = cajas.filter((c) => c.id !== caja.id && c.estado !== "ELIMINADO");
  if (!caja.nombre.trim()) e.nombre = "Ingresá el nombre de la caja.";
  else if (nombreRepetido(caja.nombre, otras)) e.nombre = "Ya existe una caja con ese nombre.";
  if (!caja.sucursalId) e.sucursalId = "Elegí la sucursal.";
  else if (!sucursales.some((s) => s.id === caja.sucursalId && s.estado === "ACTIVO")) e.sucursalId = "La sucursal tiene que estar activa.";

  if (caja.tipo === "TESORO_CENTRAL" && otras.some((c) => c.tipo === "TESORO_CENTRAL"))
    e.tipo = "Ya existe el Tesoro central: es único en toda la empresa.";
  if (caja.tipo === "TESORO_SUCURSAL" && otras.some((c) => c.tipo === "TESORO_SUCURSAL" && c.sucursalId === caja.sucursalId))
    e.tipo = "La sucursal ya tiene su Tesoro de sucursal: como máximo hay uno por sucursal.";
  if (caja.tipo === "CAJA_CAJERO" && caja.sucursalId && !otras.some((c) => c.tipo === "TESORO_SUCURSAL" && c.sucursalId === caja.sucursalId && c.estado === "ACTIVO"))
    e.tipo = "Una caja de cajero depende del tesoro de su sucursal: creá primero ese tesoro.";

  if (esTesoro(caja.tipo)) {
    if (!caja.tesoreroId) e.tesoreroId = "El tesorero es obligatorio para los tesoros.";
    else if (!usuarios.find((u) => u.id === caja.tesoreroId)?.roles.includes("TESORERO")) e.tesoreroId = "El usuario tiene que tener el rol Tesorero.";
  }

  if (aMinutos(caja.horarioDesde) >= aMinutos(caja.horarioHasta)) e.horario = "La hora de inicio tiene que ser anterior a la de fin.";

  const activos = caja.cajeros.filter((c) => c.estado === "ACTIVO");
  if (activos.length === 0 && !caja.tesoreroId) e.cajeros = "Cada caja necesita al menos un responsable.";
  for (const c of caja.cajeros) {
    const u = usuarios.find((x) => x.id === c.usuarioId);
    if (!u || !(u.roles.includes("CAJERO") || u.roles.includes("TESORERO"))) e.cajeros = "Cada responsable tiene que ser un usuario con rol Cajero o Tesorero.";
    else if (aMinutos(c.desde) >= aMinutos(c.hasta)) e.cajeros = "En cada turno, la hora desde tiene que ser anterior a la hora hasta.";
    else if (aMinutos(c.desde) < aMinutos(caja.horarioDesde) || aMinutos(c.hasta) > aMinutos(caja.horarioHasta))
      e.cajeros = "Los turnos tienen que quedar dentro del horario operativo.";
  }
  if (!e.cajeros) {
    const orden = [...activos].sort((a, b) => aMinutos(a.desde) - aMinutos(b.desde));
    for (let i = 1; i < orden.length; i++)
      if (aMinutos(orden[i].desde) < aMinutos(orden[i - 1].hasta)) e.cajeros = "Los turnos de los cajeros no pueden superponerse.";
  }

  if (!caja.cuentaContable) e.cuentaContable = "Elegí la cuenta contable.";
  for (const m of monedasDe(caja.moneda)) {
    if (caja.importeMaximo[m] < 0 || caja.toleranciaSobrante[m] < 0 || caja.toleranciaFaltante[m] < 0 || caja.minimoOperativo[m] < 0)
      e.importes = "Los importes no pueden ser negativos.";
    else if (caja.importeMaximo[m] > 0 && caja.minimoOperativo[m] > caja.importeMaximo[m])
      e.importes = "El mínimo operativo no puede superar el importe máximo.";
  }
  if (caja.diasOperativos.length === 0) e.diasOperativos = "Elegí al menos un día operativo.";
  if (!(caja.margenAlertaMin >= 0)) e.margenAlertaMin = "El margen no puede ser negativo.";
  return e;
}

// ---------- Arqueos ----------

export function arqueoVencido(caja: Caja, arqueos: Arqueo[], hoy: string): boolean {
  const dias = FRECUENCIA_ARQUEO_DIAS[caja.frecuenciaArqueo];
  if (dias === 0) return false;
  const ultimo = arqueos
    .filter((a) => a.cajaId === caja.id && a.estado === "FINALIZADO" && a.fin)
    .map((a) => a.fin!.slice(0, 10))
    .sort()
    .pop();
  if (!ultimo) return true;
  const diff = (new Date(`${hoy}T00:00:00`).getTime() - new Date(`${ultimo}T00:00:00`).getTime()) / 86400000;
  return diff > dias;
}

// ---------- Movimientos de tesorería ----------

// Importe en tránsito de un movimiento: salió del origen y todavía no figura en el destino.
export const enTransito = (m: MovimientoTesoreria) => m.estado === "EN_TRANSITO" || m.estado === "CON_INCIDENCIA";

// ---------- Visibilidad por rol (R5 y 1.5) ----------

// Sólo el Director y el Tesorero central ven todas las cajas y sucursales.
export const veTodo = (u: UsuarioCaja | undefined) => tieneRol(u, "DIRECTOR") || tieneRol(u, "TESORERO_CENTRAL");

// Tesorero y Supervisor de caja ven las cajas de su sucursal; el Cajero, sólo la suya.
export function cajasVisibles(u: UsuarioCaja | undefined, cajas: Caja[]): Caja[] {
  if (!u) return [];
  if (veTodo(u)) return cajas;
  const deSucursal = tieneRol(u, "TESORERO") || tieneRol(u, "SUPERVISOR");
  return cajas.filter((c) => (deSucursal && !!u.sucursalId && c.sucursalId === u.sucursalId) || esResponsable(c, u.id));
}

export function sucursalesVisibles(u: UsuarioCaja | undefined, sucursales: Sucursal[], cajas: Caja[]): Sucursal[] {
  if (!u) return [];
  if (veTodo(u)) return sucursales;
  const ids = new Set(cajasVisibles(u, cajas).map((c) => c.sucursalId));
  return sucursales.filter((s) => ids.has(s.id));
}
