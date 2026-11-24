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
  type EstadoCierreDiario,
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

// La fecha queda bloqueada con el cierre definitivo (Cerrada OK o con pendientes).
export const estaCerrado = (c: CierreSucursal) => c.estado === "CERRADA_OK" || c.estado === "CERRADA_CON_PENDIENTES";
export const cierreVigente = (cierres: CierreSucursal[], sucursalId: string, fecha: string) =>
  cierres.find((c) => c.sucursalId === sucursalId && c.fecha === fecha && estaCerrado(c));
// Cierre diario en marcha (controles o ventana de ajuste) de la sucursal y la fecha.
export const cierreEnCurso = (cierres: CierreSucursal[], sucursalId: string, fecha: string) =>
  cierres.find((c) => c.sucursalId === sucursalId && c.fecha === fecha && (c.estado === "EN_CONTROLES" || c.estado === "EN_VENTANA"));

// Estado que ve Casa Central: Abierta, la que ya pasó la hora límite sin iniciar el cierre es "No cerrada".
export function estadoCierreDiario(
  cierres: CierreSucursal[],
  sucursalId: string,
  fecha: string,
  hora: string,
  horaLimite: string
): { estado: EstadoCierreDiario | "NO_CERRADA" | "ABIERTA"; cierre?: CierreSucursal } {
  const delDia = cierres.filter((c) => c.sucursalId === sucursalId && c.fecha === fecha).sort((a, b) => a.id.localeCompare(b.id));
  const ultimo = delDia.at(-1);
  if (ultimo) return { estado: ultimo.estado, cierre: ultimo };
  return { estado: aMinutos(hora) > aMinutos(horaLimite) ? "NO_CERRADA" : "ABIERTA" };
}

// ---------- Ventana de ajuste y reapertura ----------

export const sumarMinutos = (fecha: string, hora: string, minutos: number): string => {
  const d = new Date(`${fecha}T${hora}:00`);
  d.setMinutes(d.getMinutes() + minutos);
  return fechaHoraIso(d);
};

// Minutos que le quedan a la ventana de ajuste a la fecha y hora de la demo (negativo si ya venció).
export function minutosDeVentana(ventanaHasta: string | undefined, fecha: string, hora: string): number | undefined {
  if (!ventanaHasta) return undefined;
  const ms = new Date(`${ventanaHasta.replace(" ", "T")}:00`).getTime() - new Date(`${fecha}T${hora}:00`).getTime();
  return Math.round(ms / 60000);
}

export const ventanaVigente = (c: CierreSucursal, fecha: string, hora: string) =>
  c.estado === "EN_VENTANA" && (c.ventanaHasta === undefined || (minutosDeVentana(c.ventanaHasta, fecha, hora) ?? 0) > 0);

// Días hábiles transcurridos entre dos fechas (excluye sábados, domingos y feriados; no cuenta el día de partida).
export function diasHabilesEntre(desde: string, hasta: string, feriados: Feriado[]): number {
  let n = 0;
  const d = new Date(`${desde}T12:00:00`);
  const fin = new Date(`${hasta}T12:00:00`);
  while (d < fin) {
    d.setDate(d.getDate() + 1);
    const f = fechaIso(d);
    if (d.getDay() !== 0 && d.getDay() !== 6 && !esFeriado(feriados, f)) n += 1;
  }
  return n;
}

// ---------- Entrega y recepción del efectivo al cerrar (1.2) ----------

export const estadoCustodia = (j: Jornada): "SISTEMA" | "CUSTODIA" | undefined =>
  j.estado !== "CERRADA" ? undefined : j.custodia ? "CUSTODIA" : "SISTEMA";

// Quién puede recibir el efectivo de la caja: el tesorero o un supervisor de la sucursal, distinto de quien
// entrega. Si no hay otro usuario en la sucursal (una sola persona), recibe de forma remota Casa Central.
export function receptoresDeEntrega(caja: Caja, entregaId: string, usuarios: UsuarioCaja[]): { fisicos: UsuarioCaja[]; remotos: UsuarioCaja[] } {
  const delLugar = usuarios.filter(
    (u) => u.id !== entregaId && u.sucursalId === caja.sucursalId && (u.roles.includes("TESORERO") || u.roles.includes("SUPERVISOR"))
  );
  const remotos = usuarios.filter((u) => u.id !== entregaId && (u.roles.includes("DIRECTOR") || u.roles.includes("TESORERO_CENTRAL")));
  return { fisicos: delLugar, remotos };
}

// ---------- Controles automáticos del cierre diario (1.6) ----------

export type IdControl = "CAJAS" | "RENDICIONES" | "REMESAS" | "PENDIENTES" | "MEDIOS" | "DIFERENCIAS";
export interface ControlCierre {
  id: IdControl;
  label: string;
  verifica: string;
  ok: boolean;
  // Pendientes que bloquean: no se puede cerrar sin resolverlos.
  bloqueantes: string[];
  // Pendientes que se pueden cerrar si el tesorero los justifica (queda "Cerrada con pendientes").
  justificables: string[];
  informativo?: boolean;
}

export interface DatosControles {
  sucursalId: string;
  fecha: string;
  cajas: Caja[];
  jornadas: Jornada[];
  movimientos: MovimientoTesoreria[];
  arqueos: Arqueo[];
  cambiosTurno: { cajaId: string; estado: string }[];
  ajustes: { cierreId: string; estado: string }[];
  cierreId?: string;
  // Indica si un evento (jornada o arqueo) tiene su acta firmada o resuelta; undefined si no hay acta.
  actaFirmada: (eventoTipo: string, eventoId: string) => boolean | undefined;
}

export function controlesCierreDiario(d: DatosControles): ControlCierre[] {
  const cajas = d.cajas.filter((c) => c.sucursalId === d.sucursalId && c.estado === "ACTIVO");
  const ids = new Set(cajas.map((c) => c.id));
  const jornadasDia = d.jornadas.filter((j) => ids.has(j.cajaId) && j.fecha === d.fecha);
  const nombre = (id: string) => cajas.find((c) => c.id === id)?.nombre ?? id;

  const sinCerrar: string[] = [];
  const sinCustodia: string[] = [];
  const remotas: string[] = [];
  const difSinActa: string[] = [];
  for (const c of cajas) {
    const del = jornadasDia.filter((j) => j.cajaId === c.id);
    const vigente = del.find((j) => j.estado !== "CERRADA");
    if (vigente) sinCerrar.push(`${nombre(c.id)}: ${vigente.estado === "ABIERTA" ? "sigue abierta" : "tiene una apertura o un cierre pendiente de autorización"}.`);
    const cerrada = del.find((j) => j.estado === "CERRADA");
    if (cerrada && !cerrada.custodia) sinCustodia.push(`${nombre(c.id)}: el efectivo todavía no fue recibido por el tesorero (falta firmar la entrega y recepción).`);
    if (cerrada?.custodia?.remota) remotas.push(`${nombre(c.id)}: recepción por firma remota de Casa Central, sin verificación física.`);
    for (const j of del)
      for (const [etapa, r] of [["apertura", j.apertura], ["cierre", j.cierre]] as const) {
        if (!r || r.ajustes.length === 0) continue;
        const aprobada = r.aprobacion?.resultado === "APROBADA";
        // El acta de la diferencia de cierre cuelga de `${jornada}-C` (ver caja-operaciones.ts).
        const acta = etapa === "apertura" ? d.actaFirmada("JORNADA_APERTURA", j.id) : d.actaFirmada("JORNADA_CIERRE", `${j.id}-C`);
        if (!aprobada || acta === false) difSinActa.push(`${nombre(c.id)}: diferencia de ${etapa} sin ${aprobada ? "acta firmada" : "resolver"}.`);
      }
  }
  for (const a of d.arqueos.filter((x) => ids.has(x.cajaId) && x.corte.slice(0, 10) === d.fecha)) {
    if (a.estado === "EN_CURSO") sinCerrar.push(`${nombre(a.cajaId)}: arqueo en curso.`);
    else if (a.resultado === "CON_DIFERENCIA" && !a.ajusteAprobado) difSinActa.push(`${nombre(a.cajaId)}: arqueo ${a.id} con diferencia sin ajuste autorizado.`);
  }
  for (const t of d.cambiosTurno.filter((x) => ids.has(x.cajaId) && x.estado !== "COMPLETADO")) sinCerrar.push(`${nombre(t.cajaId)}: cambio de turno sin completar.`);

  const tocan = (m: MovimientoTesoreria) => ids.has(m.origenId) || (m.destino.tipo === "CAJA" && ids.has(m.destino.cajaId));
  const abiertos = d.movimientos.filter((m) => tocan(m) && !["ACEPTADO", "RECHAZADO", "FINALIZADO"].includes(m.estado));
  const remesas = abiertos.filter((m) => enTransito(m)).map((m) => `${m.id} ${m.estado === "EN_TRANSITO" ? "en tránsito" : "con incidencia"}.`);
  const pendientes = abiertos.filter((m) => !enTransito(m)).map((m) => `${m.id} ${m.estado === "SOLICITADO" ? "espera autorización" : "autorizado sin enviar"}.`);
  const ajustesSinResolver = d.ajustes.filter((a) => a.cierreId === d.cierreId && a.estado === "PENDIENTE").map(() => "Hay ajustes de la ventana sin autorizar.");

  const mk = (id: IdControl, label: string, verifica: string, bloqueantes: string[], justificables: string[], informativo = false): ControlCierre => ({
    id,
    label,
    verifica,
    bloqueantes,
    justificables,
    informativo,
    ok: bloqueantes.length === 0 && justificables.length === 0,
  });
  return [
    mk("CAJAS", "Cajas", "Todas las cajas del día en Cerrada en sistema", sinCerrar, []),
    mk("RENDICIONES", "Rendiciones y efectivo recibido", "Todas firmadas por el Tesorero (Efectivo en custodia)", sinCustodia, remotas),
    mk("REMESAS", "Remesas", "Aceptadas o finalizadas; las que siguen en tránsito, justificadas", [], remesas),
    mk("PENDIENTES", "Movimientos pendientes e incidencias", "Sin pendientes, o justificados", [], pendientes),
    mk("MEDIOS", "Medios electrónicos", "Cierre de lotes y cruce de QR y transferencias hecho (1.7)", [], [], true),
    mk("DIFERENCIAS", "Diferencias", "Todas con acta firmada", difSinActa, ajustesSinResolver),
  ];
}

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
