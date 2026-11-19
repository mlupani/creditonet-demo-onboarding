// Operaciones del módulo Caja y Bancos. Cada una valida las reglas del documento funcional, escribe en
// los stores y devuelve { ok } o un error en español para mostrar en pantalla. Actúa el usuario
// seleccionado en el módulo (usuarioActual) a la hora simulada de la demo.

import {
  aMinutos,
  cierreVigente,
  diferenciaRecuento,
  disponibleParaAutorizar,
  enHorario,
  enTransito,
  motivoNoOperativo,
  reservado,
  esResponsable,
  excepcionVigente,
  jornadaVigente,
  monedasFueraDeTolerancia,
  puedeAprobar,
  puedeArquear,
  puedeOperarCaja,
  saldoCaja,
  saldosCaja,
  totalRecuento,
  turnoActivoEn,
} from "./caja-reglas";
import { TIPO_REFUERZO_ID } from "./caja-datos";
import {
  ahoraTexto,
  auditar,
  cajaStores as S,
  horaActual,
  hoy,
  nombreUsuario,
  siguienteId,
  usuarioActual,
} from "./caja-store";
import { provStores } from "./proveedores-store";
import {
  TIPO_CUENTA_LABEL,
  esTesoro,
  monedasDe,
  type AjusteDiferencia,
  type Aprobacion,
  type Arqueo,
  type Caja,
  type CambioTurno,
  type DestinoMovimiento,
  type DetalleRecuento,
  type Jornada,
  type MedioMovimiento,
  type Moneda,
  type MovimientoCaja,
  type MovimientoTesoreria,
  type PedidoRefuerzo,
  type Recuento,
  type TipoArqueo,
  type Transportista,
} from "./caja-tipos";

export type Res<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };
const error = (mensaje: string): { ok: false; error: string } => ({ ok: false, error: mensaje });

const cajaPorId = (id: string) => S.cajas.get().find((c) => c.id === id);
export const nombreCaja = (id: string) => cajaPorId(id)?.nombre ?? id;

// ---------- Libro ----------

interface Asiento {
  cajaId: string;
  tipo: string;
  descripcion: string;
  comprobante: string;
  moneda: Moneda;
  ingreso?: number;
  egreso?: number;
  refId?: string;
  diferencia?: boolean;
  incidencia?: boolean;
  nota?: string;
  medio?: MedioMovimiento; // por defecto, efectivo
}

// Agrega una fila al libro. Los asientos no se editan ni se borran.
function asentar(a: Asiento): MovimientoCaja {
  const libro = S.libro.get();
  const jornada = jornadaVigente(S.jornadas.get(), a.cajaId);
  const mov: MovimientoCaja = {
    id: siguienteId("LB", libro.map((m) => m.id), 4),
    cajaId: a.cajaId,
    fecha: hoy(),
    hora: horaActual(),
    turnoUsuarioId: jornada?.turnoUsuarioId ?? usuarioActual().id,
    tipo: a.tipo,
    descripcion: a.descripcion,
    comprobante: a.comprobante,
    moneda: a.moneda,
    ingreso: a.ingreso ?? 0,
    egreso: a.egreso ?? 0,
    medio: a.medio ?? "EFECTIVO",
    responsableId: usuarioActual().id,
    estado: "CONFIRMADO",
    refId: a.refId,
    diferencia: a.diferencia,
    incidencia: a.incidencia,
    nota: a.nota,
  };
  S.libro.commit([...libro, mov]);
  return mov;
}

// Una diferencia aprobada genera un movimiento de ajuste propio; nunca modifica el recuento.
function asentarAjuste(cajaId: string, moneda: Moneda, diferencia: number, comprobante: string, motivoId?: string, nota?: string) {
  if (diferencia === 0) return;
  const motivo = S.motivos.get().find((m) => m.id === motivoId);
  const cuenta = motivo ? (diferencia > 0 ? motivo.cuentaSobrante : motivo.cuentaFaltante) : "";
  asentar({
    cajaId,
    tipo: diferencia > 0 ? "Ajuste por sobrante" : "Ajuste por faltante",
    descripcion: motivo ? `${motivo.descripcion}${cuenta ? ` · cuenta ${cuenta}` : ""}` : "Diferencia dentro de la tolerancia",
    comprobante,
    moneda,
    ingreso: diferencia > 0 ? diferencia : 0,
    egreso: diferencia < 0 ? -diferencia : 0,
    diferencia: true,
    nota,
  });
}

// ---------- Bloqueos ----------

// Un arqueo en curso o un cambio de turno abierto congelan la caja: no se puede operar.
export function bloqueoCaja(cajaId: string): string | undefined {
  const sucursalId = cajaPorId(cajaId)?.sucursalId;
  if (sucursalId && cierreVigente(S.cierresSucursal.get(), sucursalId, hoy()))
    return "La sucursal cerró la fecha operativa: no se puede operar hasta que un supervisor autorice la reapertura.";
  if (S.arqueos.get().some((a) => a.cajaId === cajaId && a.estado === "EN_CURSO"))
    return "La caja está en arqueo: las operaciones están suspendidas hasta que termine.";
  if (S.cambiosTurno.get().some((c) => c.cajaId === cajaId && c.estado !== "COMPLETADO"))
    return "La caja tiene un cambio de turno en curso: las operaciones están suspendidas.";
  return undefined;
}

// Movimientos de tesorería que todavía no se cerraron y tocan la caja.
export function pendientesDeCaja(cajaId: string): MovimientoTesoreria[] {
  return S.movimientos
    .get()
    .filter(
      (m) =>
        !["ACEPTADO", "RECHAZADO"].includes(m.estado) &&
        (m.origenId === cajaId || (m.destino.tipo === "CAJA" && m.destino.cajaId === cajaId))
    );
}

// ---------- Recuento común a apertura, cierre y relevo ----------

interface EntradaRecuento {
  detalle: DetalleRecuento;
  ajustes?: AjusteDiferencia[];
}

// Arma el recuento contra el saldo esperado del libro. `necesitaSupervisor` es true cuando alguna
// moneda se pasa de la tolerancia: entonces cada una de esas monedas exige su motivo.
function armarRecuento(caja: Caja, entrada: EntradaRecuento): Res<{ recuento: Recuento; necesitaSupervisor: boolean }> {
  const denominaciones = S.denominaciones.get();
  const monedas = monedasDe(caja.moneda);
  const contado = totalRecuento(entrada.detalle, denominaciones.filter((d) => monedas.includes(d.moneda)));
  const esperado = saldosCaja(S.libro.get(), caja);
  const diferencia = diferenciaRecuento(contado, esperado, monedas);
  const fuera = monedasFueraDeTolerancia(caja, diferencia);
  const ajustes: AjusteDiferencia[] = [];
  for (const m of fuera) {
    const a = entrada.ajustes?.find((x) => x.moneda === m);
    if (!a?.motivoId) return error(`Elegí el motivo de la diferencia en ${m === "ARS" ? "pesos" : "dólares"}.`);
    ajustes.push({ moneda: m, importe: diferencia[m], motivoId: a.motivoId, nota: a.nota ?? "" });
  }
  return {
    ok: true,
    necesitaSupervisor: fuera.length > 0,
    recuento: { usuarioId: usuarioActual().id, fechaHora: ahoraTexto(), detalle: entrada.detalle, contado, esperado, diferencia, ajustes },
  };
}

// Asienta las diferencias de un recuento: las que pasaron por supervisor con su motivo y las que
// quedaron dentro de la tolerancia (se registran igual).
function asentarDiferencias(caja: Caja, recuento: Recuento, comprobante: string) {
  for (const m of monedasDe(caja.moneda)) {
    const dif = recuento.diferencia[m];
    const ajuste = recuento.ajustes.find((a) => a.moneda === m);
    asentarAjuste(caja.id, m, dif, comprobante, ajuste?.motivoId, ajuste?.nota);
  }
}

function aprobacion(resultado: Aprobacion["resultado"], nota: string): Aprobacion {
  return { supervisorId: usuarioActual().id, fechaHora: ahoraTexto(), resultado, nota };
}

// ---------- Apertura y cierre ----------

function errorPuedeOperar(caja: Caja): string | undefined {
  const u = usuarioActual();
  if (caja.estado !== "ACTIVO") return "La caja no está activa.";
  if (!puedeOperarCaja(u) || !esResponsable(caja, u.id)) return "Sólo un usuario asignado a la caja puede operarla.";
  return bloqueoCaja(caja.id);
}

export function registrarApertura(cajaId: string, entrada: EntradaRecuento): Res<{ jornadaId: string; estado: Jornada["estado"] }> {
  const caja = cajaPorId(cajaId);
  if (!caja) return error("Elegí la caja.");
  const bloqueo = errorPuedeOperar(caja);
  if (bloqueo) return error(bloqueo);
  const hora = horaActual();
  const u = usuarioActual();
  const dentroDeTurno = caja.tesoreroId === u.id ? enHorario(caja, hora) : turnoActivoEn(caja, hora)?.usuarioId === u.id;
  if (!dentroDeTurno && !excepcionVigente(S.excepciones.get(), caja.id, u.id, hoy(), hora))
    return error("La apertura se hace dentro de tu turno y del horario operativo de la caja.");
  const noOperativo = motivoNoOperativo(caja, hoy(), S.feriados.get());
  if (noOperativo && !excepcionVigente(S.excepciones.get(), caja.id, u.id, hoy(), hora)) return error(noOperativo);
  const jornadas = S.jornadas.get();
  if (jornadaVigente(jornadas, caja.id)) return error("La caja ya tiene una apertura activa.");
  if (jornadas.some((j) => j.cajaId === caja.id && j.fecha === hoy())) return error("La caja ya se cerró hoy: el cierre es definitivo.");

  const r = armarRecuento(caja, entrada);
  if (!r.ok) return r;
  const jornada: Jornada = {
    id: siguienteId("JOR", jornadas.map((j) => j.id), 4),
    cajaId: caja.id,
    fecha: hoy(),
    estado: r.necesitaSupervisor ? "PEND_APERTURA" : "ABIERTA",
    apertura: r.recuento,
    turnoUsuarioId: u.id,
    rechazos: [],
  };
  S.jornadas.commit([...jornadas, jornada]);
  if (!r.necesitaSupervisor) asentarDiferencias(caja, r.recuento, jornada.id);
  return { ok: true, jornadaId: jornada.id, estado: jornada.estado };
}

export function resolverApertura(jornadaId: string, aprobar: boolean, nota: string): Res {
  const jornada = S.jornadas.get().find((j) => j.id === jornadaId);
  const caja = jornada && cajaPorId(jornada.cajaId);
  if (!jornada || !caja || jornada.estado !== "PEND_APERTURA") return error("La apertura ya no está pendiente.");
  if (!puedeAprobar(usuarioActual(), jornada.apertura.usuarioId))
    return error("Sólo un supervisor distinto de quien cargó el recuento puede resolverla.");
  if (!aprobar && !nota.trim()) return error("Indicá el motivo del rechazo.");
  const ap = aprobacion(aprobar ? "APROBADA" : "RECHAZADA", nota);
  if (!aprobar) {
    // Se rechaza: se repite el recuento. La jornada se descarta y queda el registro del rechazo.
    S.jornadas.commit(S.jornadas.get().filter((j) => j.id !== jornada.id));
    auditar("Apertura de caja", jornada.id, "ESTADO", `Pendiente de autorización (${caja.nombre})`, `Rechazada por ${nombreUsuario(ap.supervisorId)}: ${nota}`);
    return { ok: true };
  }
  const apertura = { ...jornada.apertura, aprobacion: ap };
  S.jornadas.commit(S.jornadas.get().map((j) => (j.id === jornada.id ? { ...j, estado: "ABIERTA" as const, apertura } : j)));
  asentarDiferencias(caja, apertura, jornada.id);
  return { ok: true };
}

export function registrarCierre(cajaId: string, entrada: EntradaRecuento): Res<{ estado: Jornada["estado"] }> {
  const caja = cajaPorId(cajaId);
  const jornada = caja && jornadaVigente(S.jornadas.get(), caja.id);
  if (!caja) return error("Elegí la caja.");
  if (!jornada || jornada.estado !== "ABIERTA") return error("La caja no tiene una apertura activa para cerrar.");
  const bloqueo = errorPuedeOperar(caja);
  if (bloqueo) return error(bloqueo);
  const r = armarRecuento(caja, entrada);
  if (!r.ok) return r;
  const estado = r.necesitaSupervisor ? "PEND_CIERRE" : "CERRADA";
  S.jornadas.commit(S.jornadas.get().map((j) => (j.id === jornada.id ? { ...j, estado, cierre: r.recuento } : j)));
  if (!r.necesitaSupervisor) asentarDiferencias(caja, r.recuento, `${jornada.id}-C`);
  return { ok: true, estado };
}

export function resolverCierre(jornadaId: string, aprobar: boolean, nota: string): Res {
  const jornada = S.jornadas.get().find((j) => j.id === jornadaId);
  const caja = jornada && cajaPorId(jornada.cajaId);
  if (!jornada?.cierre || !caja || jornada.estado !== "PEND_CIERRE") return error("El cierre ya no está pendiente.");
  if (!puedeAprobar(usuarioActual(), jornada.cierre.usuarioId))
    return error("Sólo un supervisor distinto de quien cargó el recuento puede resolverlo.");
  if (!aprobar && !nota.trim()) return error("Indicá el motivo del rechazo.");
  const ap = aprobacion(aprobar ? "APROBADA" : "RECHAZADA", nota);
  if (!aprobar) {
    // El cierre rechazado vuelve a Abierta: se repite el recuento.
    S.jornadas.commit(
      S.jornadas.get().map((j) =>
        j.id === jornada.id ? { ...j, estado: "ABIERTA" as const, cierre: undefined, rechazos: [...j.rechazos, { etapa: "CIERRE" as const, aprobacion: ap }] } : j
      )
    );
    return { ok: true };
  }
  const cierre = { ...jornada.cierre, aprobacion: ap };
  S.jornadas.commit(S.jornadas.get().map((j) => (j.id === jornada.id ? { ...j, estado: "CERRADA" as const, cierre } : j)));
  asentarDiferencias(caja, cierre, `${jornada.id}-C`);
  return { ok: true };
}

// ---------- Arqueo ----------

// Al arquear un tesoro de sucursal se pueden incluir sus cajas de cajero en el mismo corte: cada caja
// tiene su arqueo y todos comparten corte y grupo.
export function iniciarArqueo(cajaId: string, tipo: TipoArqueo, incluirIds: string[] = []): Res<{ arqueoId: string; arqueoIds: string[] }> {
  const caja = cajaPorId(cajaId);
  const u = usuarioActual();
  if (!caja) return error("Elegí la caja.");
  if (!puedeArquear(u)) return error("Hace falta el permiso Realizar arqueo (Supervisor o Tesorero).");
  if (incluirIds.length > 0 && caja.tipo !== "TESORO_SUCURSAL") return error("Sólo un tesoro de sucursal puede incluir cajas de cajero en el corte.");
  const cajas = [caja, ...incluirIds.map(cajaPorId)];
  for (const c of cajas) {
    if (!c) return error("Una de las cajas elegidas no existe.");
    if (c.id !== caja.id && (c.tipo !== "CAJA_CAJERO" || c.sucursalId !== caja.sucursalId))
      return error(`${c.nombre} no es una caja de cajero de la misma sucursal.`);
    if (esResponsable(c, u.id)) return error(`El controlador no puede ser responsable de la caja arqueada (${c.nombre}).`);
    if (c.estado !== "ACTIVO") return error(`${c.nombre} no está activa.`);
    const bloqueo = bloqueoCaja(c.id);
    if (bloqueo) return error(`${c.nombre}: ${bloqueo}`);
  }
  const arqueos = S.arqueos.get();
  const corte = ahoraTexto();
  const ids: string[] = [];
  const nuevos = (cajas as Caja[]).map((c, i): Arqueo => {
    const id = siguienteId("ARQ", [...arqueos.map((a) => a.id), ...ids], 4);
    ids.push(id);
    return { id, grupoId: cajas.length > 1 ? `GRP-${ids[0]}` : undefined, cajaId: c.id, tipo, controladorId: u.id, corte, estado: "EN_CURSO", conteos: [] };
  });
  S.arqueos.commit([...arqueos, ...nuevos]);
  return { ok: true, arqueoId: ids[0], arqueoIds: ids };
}

// Recuento ciego: el esperado se calcula al registrar el conteo, no antes. Se puede cargar un
// segundo conteo; se conservan ambos con sus responsables.
export function registrarConteoArqueo(arqueoId: string, detalle: DetalleRecuento): Res {
  const arqueo = S.arqueos.get().find((a) => a.id === arqueoId);
  const caja = arqueo && cajaPorId(arqueo.cajaId);
  if (!arqueo || !caja || arqueo.estado !== "EN_CURSO") return error("El arqueo ya no está en curso.");
  if (arqueo.conteos.length >= 2) return error("Ya se cargaron los dos conteos.");
  const monedas = monedasDe(caja.moneda);
  const contado = totalRecuento(detalle, S.denominaciones.get().filter((d) => monedas.includes(d.moneda)));
  // El esperado es el saldo congelado en el corte: lo posterior no modifica la foto del arqueo.
  const esperado = arqueo.conteos[0]?.esperado ?? saldosCaja(S.libro.get(), caja);
  const conteo: Recuento = {
    usuarioId: usuarioActual().id,
    fechaHora: ahoraTexto(),
    detalle,
    contado,
    esperado,
    diferencia: diferenciaRecuento(contado, esperado, monedas),
    ajustes: [],
  };
  S.arqueos.commit(S.arqueos.get().map((a) => (a.id === arqueoId ? { ...a, conteos: [...a.conteos, conteo] } : a)));
  return { ok: true };
}

export function finalizarArqueo(arqueoId: string): Res {
  const arqueo = S.arqueos.get().find((a) => a.id === arqueoId);
  const caja = arqueo && cajaPorId(arqueo.cajaId);
  if (!arqueo || !caja || arqueo.estado !== "EN_CURSO") return error("El arqueo ya no está en curso.");
  const ultimo = arqueo.conteos[arqueo.conteos.length - 1];
  if (!ultimo) return error("Cargá el recuento antes de finalizar el arqueo.");
  const conforme = monedasDe(caja.moneda).every((m) => ultimo.diferencia[m] === 0);
  S.arqueos.commit(
    S.arqueos.get().map((a) =>
      a.id === arqueoId ? { ...a, estado: "FINALIZADO" as const, fin: ahoraTexto(), resultado: conforme ? ("CONFORME" as const) : ("CON_DIFERENCIA" as const) } : a
    )
  );
  return { ok: true };
}

// El arqueo no corrige saldos: la diferencia se regulariza sólo con un ajuste autorizado por un supervisor.
export function ajustarDiferenciaArqueo(arqueoId: string, motivoId: string, nota: string): Res {
  const arqueo = S.arqueos.get().find((a) => a.id === arqueoId);
  const caja = arqueo && cajaPorId(arqueo.cajaId);
  if (!arqueo || !caja || arqueo.estado !== "FINALIZADO" || arqueo.resultado !== "CON_DIFERENCIA" || arqueo.ajusteAprobado)
    return error("El arqueo no tiene una diferencia pendiente de regularizar.");
  if (!puedeAprobar(usuarioActual(), arqueo.controladorId)) return error("Sólo un supervisor distinto del controlador puede autorizar el ajuste.");
  if (!motivoId) return error("Elegí el motivo de la diferencia.");
  const jornada = jornadaVigente(S.jornadas.get(), caja.id);
  if (!jornada || jornada.estado !== "ABIERTA") return error("La caja tiene que estar abierta para registrar el ajuste.");
  const ultimo = arqueo.conteos[arqueo.conteos.length - 1];
  for (const m of monedasDe(caja.moneda)) asentarAjuste(caja.id, m, ultimo.diferencia[m], arqueo.id, motivoId, nota);
  const movimientoId = S.libro.get()[S.libro.get().length - 1].id;
  const ap = aprobacion("APROBADA", nota);
  S.arqueos.commit(S.arqueos.get().map((a) => (a.id === arqueoId ? { ...a, ajusteAprobado: { ...ap, motivoId, movimientoId } } : a)));
  return { ok: true };
}

// ---------- Cambio de turno (relevo con arqueo) ----------

export function solicitarCambioTurno(cajaId: string, entranteId: string): Res<{ cambioId: string }> {
  const caja = cajaPorId(cajaId);
  const jornada = caja && jornadaVigente(S.jornadas.get(), caja.id);
  const u = usuarioActual();
  if (!caja) return error("Elegí la caja.");
  if (!jornada || jornada.estado !== "ABIERTA") return error("La caja tiene que estar abierta para cambiar de turno.");
  if (jornada.turnoUsuarioId !== u.id) return error("Sólo el cajero con el turno en curso puede pedir el relevo.");
  if (entranteId === u.id) return error("El cajero entrante tiene que ser otro usuario.");
  if (!caja.cajeros.some((c) => c.usuarioId === entranteId && c.estado === "ACTIVO"))
    return error("El entrante tiene que estar asignado a la caja en Parámetros.");
  const bloqueo = bloqueoCaja(caja.id);
  if (bloqueo) return error(bloqueo);
  const cambios = S.cambiosTurno.get();
  const cambio: CambioTurno = {
    id: siguienteId("CT", cambios.map((c) => c.id), 4),
    cajaId,
    jornadaId: jornada.id,
    salienteId: u.id,
    entranteId,
    corte: ahoraTexto(),
    estado: "SOLICITADO",
  };
  S.cambiosTurno.commit([...cambios, cambio]);
  return { ok: true, cambioId: cambio.id };
}

const actualizarCambio = (id: string, parche: Partial<CambioTurno>) =>
  S.cambiosTurno.commit(S.cambiosTurno.get().map((c) => (c.id === id ? { ...c, ...parche } : c)));

export function cargarArqueoRelevo(cambioId: string, entrada: EntradaRecuento): Res<{ estado: CambioTurno["estado"] }> {
  const cambio = S.cambiosTurno.get().find((c) => c.id === cambioId);
  const caja = cambio && cajaPorId(cambio.cajaId);
  if (!cambio || !caja || cambio.estado !== "SOLICITADO") return error("El relevo no está esperando el arqueo.");
  if (usuarioActual().id !== cambio.salienteId) return error("El arqueo de relevo lo carga el cajero saliente.");
  const r = armarRecuento(caja, entrada);
  if (!r.ok) return r;
  if (!r.necesitaSupervisor) {
    asentarDiferencias(caja, r.recuento, cambio.id);
    actualizarCambio(cambioId, { arqueo: r.recuento, estado: "PEND_RECEPCION" });
    return { ok: true, estado: "PEND_RECEPCION" };
  }
  actualizarCambio(cambioId, { arqueo: r.recuento, estado: "PEND_AUTORIZACION" });
  return { ok: true, estado: "PEND_AUTORIZACION" };
}

// La diferencia aprobada queda atribuida al cajero saliente.
export function resolverRelevo(cambioId: string, aprobar: boolean, nota: string): Res {
  const cambio = S.cambiosTurno.get().find((c) => c.id === cambioId);
  const caja = cambio && cajaPorId(cambio.cajaId);
  if (!cambio?.arqueo || !caja || cambio.estado !== "PEND_AUTORIZACION") return error("El relevo no está pendiente de autorización.");
  if (!puedeAprobar(usuarioActual(), cambio.salienteId)) return error("Sólo un supervisor distinto del cajero saliente puede resolverlo.");
  if (!aprobar && !nota.trim()) return error("Indicá el motivo del rechazo.");
  const ap = aprobacion(aprobar ? "APROBADA" : "RECHAZADA", nota);
  if (!aprobar) {
    actualizarCambio(cambioId, { estado: "SOLICITADO", arqueo: undefined, resolucion: ap });
    return { ok: true };
  }
  asentarDiferencias(caja, { ...cambio.arqueo, aprobacion: ap }, cambio.id);
  actualizarCambio(cambioId, { estado: "PEND_RECEPCION", arqueo: { ...cambio.arqueo, aprobacion: ap }, resolucion: ap });
  return { ok: true };
}

// El entrante cuenta y acepta el saldo real (ya ajustado). Si no coincide, no acepta y se abre una incidencia.
export function recibirTurno(cambioId: string, detalle: DetalleRecuento): Res<{ estado: CambioTurno["estado"] }> {
  const cambio = S.cambiosTurno.get().find((c) => c.id === cambioId);
  const caja = cambio && cajaPorId(cambio.cajaId);
  if (!cambio || !caja || cambio.estado !== "PEND_RECEPCION") return error("El relevo no está esperando la recepción.");
  if (usuarioActual().id !== cambio.entranteId) return error("La recepción la hace el cajero entrante.");
  const monedas = monedasDe(caja.moneda);
  const contado = totalRecuento(detalle, S.denominaciones.get().filter((d) => monedas.includes(d.moneda)));
  const declarado = saldosCaja(S.libro.get(), caja);
  const coincide = monedas.every((m) => contado[m] === declarado[m]);
  const recepcion = { usuarioId: cambio.entranteId, fechaHora: ahoraTexto(), detalle, contado };
  if (!coincide) {
    actualizarCambio(cambioId, { recepcion, estado: "CON_INCIDENCIA" });
    return { ok: true, estado: "CON_INCIDENCIA" };
  }
  S.jornadas.commit(S.jornadas.get().map((j) => (j.id === cambio.jornadaId ? { ...j, turnoUsuarioId: cambio.entranteId } : j)));
  actualizarCambio(cambioId, { recepcion, estado: "COMPLETADO", fin: ahoraTexto() });
  return { ok: true, estado: "COMPLETADO" };
}

// El supervisor revisa la incidencia y habilita una nueva recepción.
export function resolverIncidenciaRelevo(cambioId: string, nota: string): Res {
  const cambio = S.cambiosTurno.get().find((c) => c.id === cambioId);
  if (!cambio || cambio.estado !== "CON_INCIDENCIA") return error("El relevo no tiene una incidencia abierta.");
  const u = usuarioActual();
  if (!puedeAprobar(u, cambio.salienteId) || u.id === cambio.entranteId) return error("Sólo un supervisor ajeno al relevo puede resolver la incidencia.");
  if (!nota.trim()) return error("Dejá constancia de cómo se resolvió.");
  actualizarCambio(cambioId, { estado: "PEND_RECEPCION", recepcion: undefined, resolucion: aprobacion("APROBADA", nota) });
  return { ok: true };
}

export function cancelarCambioTurno(cambioId: string): Res {
  const cambio = S.cambiosTurno.get().find((c) => c.id === cambioId);
  if (!cambio || cambio.estado === "COMPLETADO") return error("El relevo ya terminó.");
  if (usuarioActual().id !== cambio.salienteId) return error("Sólo el cajero saliente puede cancelar el relevo.");
  S.cambiosTurno.commit(S.cambiosTurno.get().filter((c) => c.id !== cambioId));
  auditar("Cambio de turno", cambio.id, "ESTADO", cambio.estado, "Cancelado por el cajero saliente");
  return { ok: true };
}

// ---------- Movimientos de tesorería ----------

export interface NuevoMovimiento {
  tipoId: string;
  origenId: string;
  destino: DestinoMovimiento;
  moneda: Moneda;
  importe: number;
  motivo: string;
  transportista?: Transportista;
  precinto: string;
  observaciones: string;
}

const destinoCajaId = (m: MovimientoTesoreria) => (m.destino.tipo === "CAJA" ? m.destino.cajaId : undefined);

export function errorNuevoMovimiento(n: NuevoMovimiento): string | undefined {
  const tipo = S.tipos.get().find((t) => t.id === n.tipoId);
  const origen = cajaPorId(n.origenId);
  if (!tipo || tipo.estado !== "ACTIVO") return "Elegí un tipo de movimiento activo.";
  if (!origen) return "Elegí el origen.";
  if (!tipo.origenes.includes(origen.tipo)) return `El tipo "${tipo.descripcion}" no admite como origen a un ${origen.nombre}.`;
  if (origen.estado !== "ACTIVO") return "La caja de origen no está activa.";
  if (!monedasDe(origen.moneda).includes(n.moneda)) return "El origen no opera en esa moneda.";

  if (n.destino.tipo === "BANCO") {
    const cuenta = S.cuentasBancarias.get().find((c) => c.id === (n.destino as { cuentaId: string }).cuentaId);
    if (!tipo.destinos.includes("BANCO")) return `El tipo "${tipo.descripcion}" no admite un banco como destino.`;
    if (!cuenta) return "Elegí la cuenta bancaria de destino.";
    if (cuenta.estado !== "ACTIVO") return "La cuenta bancaria no está activa.";
    if (cuenta.moneda !== n.moneda) return "La cuenta bancaria es de otra moneda.";
  } else {
    const destino = cajaPorId(n.destino.cajaId);
    if (!destino) return "Elegí el destino.";
    if (destino.id === origen.id) return "No se puede hacer un pase de una caja a sí misma.";
    if (!tipo.destinos.includes(destino.tipo)) return `El tipo "${tipo.descripcion}" no admite como destino a ${destino.nombre}.`;
    if (destino.estado !== "ACTIVO") return "La caja de destino no está activa.";
    if (!monedasDe(destino.moneda).includes(n.moneda)) return "El destino no opera en esa moneda.";
  }
  if (!(n.importe > 0)) return "Ingresá un importe mayor a cero.";
  if (n.importe > saldoCaja(S.libro.get(), origen.id, n.moneda) - reservado(S.movimientos.get(), origen.id, n.moneda))
    return "El origen no tiene saldo suficiente (descontado lo ya reservado para otros movimientos autorizados).";
  if (!n.motivo.trim()) return "Ingresá el motivo del movimiento.";
  const entreCajeros = origen.tipo === "CAJA_CAJERO" && n.destino.tipo === "CAJA" && cajaPorId(n.destino.cajaId)?.tipo === "CAJA_CAJERO";
  if (!entreCajeros && (!n.transportista?.nombre.trim() || !n.transportista.documento.trim()))
    return "Cargá el nombre y el documento del responsable del traslado.";
  return undefined;
}

export function crearMovimiento(n: NuevoMovimiento): Res<{ movimientoId: string }> {
  const u = usuarioActual();
  const origen = cajaPorId(n.origenId);
  const tipo = S.tipos.get().find((t) => t.id === n.tipoId);
  if (!puedeOperarCaja(u) || !origen || !esResponsable(origen, u.id)) return error("Sólo un responsable del origen puede cargar el movimiento.");
  const e = errorNuevoMovimiento(n);
  if (e || !tipo) return error(e ?? "Elegí el tipo de movimiento.");
  const lista = S.movimientos.get();
  const mov: MovimientoTesoreria = {
    id: siguienteId("MT", lista.map((m) => m.id), 4),
    ...n,
    estado: tipo.requiereAutorizacion ? "SOLICITADO" : "AUTORIZADO",
    solicitanteId: u.id,
    fechaSolicitud: ahoraTexto(),
  };
  S.movimientos.commit([...lista, mov]);
  return { ok: true, movimientoId: mov.id };
}

const actualizarMovimiento = (id: string, parche: Partial<MovimientoTesoreria>) =>
  S.movimientos.commit(S.movimientos.get().map((m) => (m.id === id ? { ...m, ...parche } : m)));
const movimientoPorId = (id: string) => S.movimientos.get().find((m) => m.id === id);

export function autorizarMovimiento(id: string, aprobar: boolean, nota: string): Res {
  const m = movimientoPorId(id);
  if (!m || m.estado !== "SOLICITADO") return error("El movimiento no está esperando autorización.");
  if (!puedeAprobar(usuarioActual(), m.solicitanteId)) return error("Sólo un supervisor distinto del solicitante puede autorizarlo.");
  if (!aprobar && !nota.trim()) return error("Indicá el motivo del rechazo.");
  // Al autorizar se reserva el importe: no puede dejar al origen por debajo de su mínimo operativo.
  const origen = cajaPorId(m.origenId);
  if (aprobar && origen && m.importe > disponibleParaAutorizar(S.libro.get(), S.movimientos.get(), origen, m.moneda, m.id))
    return error("Al autorizarlo, el origen quedaría por debajo de su mínimo operativo o comprometería fondos ya reservados.");
  actualizarMovimiento(id, { estado: aprobar ? "AUTORIZADO" : "RECHAZADO", autorizacion: aprobacion(aprobar ? "APROBADA" : "RECHAZADA", nota) });
  return { ok: true };
}

// Fuera del horario operativo ningún cajero opera, salvo una excepción habilitada por el Tesorero.
function errorFueraDeHorario(caja: Caja): string | undefined {
  if (enHorario(caja, horaActual()) || excepcionVigente(S.excepciones.get(), caja.id, usuarioActual().id, hoy(), horaActual())) return undefined;
  return "Fuera del horario operativo la caja no admite operaciones: hace falta una excepción habilitada por el Tesorero.";
}

const abierta = (cajaId: string) => jornadaVigente(S.jornadas.get(), cajaId)?.estado === "ABIERTA";

// Envío: el origen entrega con recuento por denominación. El importe pasa a En tránsito (sale del
// libro del origen y todavía no entra en el del destino).
export function enviarMovimiento(id: string, detalle: DetalleRecuento, conformidad: boolean): Res {
  const m = movimientoPorId(id);
  const origen = m && cajaPorId(m.origenId);
  if (!m || !origen || m.estado !== "AUTORIZADO") return error("El movimiento no está autorizado para salir.");
  if (!esResponsable(origen, usuarioActual().id)) return error("Sólo un responsable del origen registra el envío.");
  if (!abierta(origen.id)) return error("El origen no tiene la caja abierta: sin apertura no se puede operar.");
  const bloqueo = bloqueoCaja(origen.id) ?? errorFueraDeHorario(origen);
  if (bloqueo) return error(bloqueo);
  if (!conformidad) return error("El origen tiene que confirmar lo que entrega al transportista.");
  const contado = totalRecuento(detalle, S.denominaciones.get())[m.moneda];
  if (contado !== m.importe) return error("El recuento por denominación no coincide con el importe del movimiento.");
  if (m.importe > saldoCaja(S.libro.get(), origen.id, m.moneda)) return error("El origen no tiene saldo suficiente.");
  const tipo = S.tipos.get().find((t) => t.id === m.tipoId);
  asentar({
    cajaId: origen.id,
    tipo: tipo?.descripcion ?? "Movimiento de tesorería",
    descripcion: `Envío a ${m.destino.tipo === "CAJA" ? nombreCaja(m.destino.cajaId) : bancoTexto(m.destino.cuentaId)}`,
    comprobante: m.id,
    moneda: m.moneda,
    egreso: m.importe,
    refId: m.id,
  });
  actualizarMovimiento(id, { estado: "EN_TRANSITO", envio: { usuarioId: usuarioActual().id, fechaHora: ahoraTexto(), detalle, importe: m.importe, conformidad } });
  return { ok: true };
}

const bancoTexto = (cuentaId: string) => {
  const c = S.cuentasBancarias.get().find((x) => x.id === cuentaId);
  return c ? `${c.banco} · ${TIPO_CUENTA_LABEL[c.tipo]} ${c.numero}` : cuentaId;
};
export { bancoTexto };

// Recepción: el movimiento sólo se completa con la aceptación del receptor. Si el recuento no
// coincide, queda Con incidencia y el dinero no se integra hasta que un supervisor resuelva.
export function recibirMovimiento(id: string, detalle: DetalleRecuento): Res<{ estado: MovimientoTesoreria["estado"] }> {
  const m = movimientoPorId(id);
  const destinoId = m && destinoCajaId(m);
  const destino = destinoId ? cajaPorId(destinoId) : undefined;
  if (!m || !destino || m.estado !== "EN_TRANSITO") return error("No hay nada para recibir en este movimiento.");
  if (!esResponsable(destino, usuarioActual().id)) return error("Sólo un responsable del destino puede aceptarlo.");
  if (!abierta(destino.id)) return error("El destino no tiene la caja abierta: sin apertura no se puede operar.");
  const bloqueo = bloqueoCaja(destino.id) ?? errorFueraDeHorario(destino);
  if (bloqueo) return error(bloqueo);
  const contado = totalRecuento(detalle, S.denominaciones.get())[m.moneda];
  const recepcion = { usuarioId: usuarioActual().id, fechaHora: ahoraTexto(), detalle, importe: contado };
  if (contado !== m.importe) {
    actualizarMovimiento(id, { estado: "CON_INCIDENCIA", recepcion });
    return { ok: true, estado: "CON_INCIDENCIA" };
  }
  const tipo = S.tipos.get().find((t) => t.id === m.tipoId);
  asentar({
    cajaId: destino.id,
    tipo: tipo?.descripcion ?? "Movimiento de tesorería",
    descripcion: `Recepción de ${nombreCaja(m.origenId)}`,
    comprobante: m.id,
    moneda: m.moneda,
    ingreso: contado,
    refId: m.id,
  });
  actualizarMovimiento(id, { estado: "ACEPTADO", recepcion });
  return { ok: true, estado: "ACEPTADO" };
}

// El supervisor decide qué importe se integra al destino; la diferencia con lo enviado queda registrada.
export function resolverIncidenciaMovimiento(id: string, importeAceptado: number, nota: string): Res {
  const m = movimientoPorId(id);
  const destinoId = m && destinoCajaId(m);
  const destino = destinoId ? cajaPorId(destinoId) : undefined;
  const u = usuarioActual();
  if (!m || !destino || m.estado !== "CON_INCIDENCIA" || !m.recepcion) return error("El movimiento no tiene una incidencia abierta.");
  if (!puedeAprobar(u, m.solicitanteId) || u.id === m.recepcion.usuarioId)
    return error("Sólo un supervisor que no cargó ni recibió el movimiento puede resolver la incidencia.");
  if (!(importeAceptado >= 0) || importeAceptado > m.importe) return error("El importe a integrar no puede superar lo enviado.");
  if (!nota.trim()) return error("Dejá constancia de la resolución.");
  if (!abierta(destino.id)) return error("El destino tiene que tener la caja abierta para integrar el importe.");
  if (importeAceptado > 0)
    asentar({
      cajaId: destino.id,
      tipo: "Recepción con incidencia",
      descripcion: `Recepción de ${nombreCaja(m.origenId)} · enviado ${m.importe}, integrado ${importeAceptado}`,
      comprobante: m.id,
      moneda: m.moneda,
      ingreso: importeAceptado,
      refId: m.id,
      incidencia: true,
      nota,
    });
  actualizarMovimiento(id, { estado: "ACEPTADO", resolucion: { ...aprobacion("APROBADA", nota), importeAceptado } });
  return { ok: true };
}

// Depósito en banco: la salida queda En tránsito hasta cargar la boleta de depósito.
export function cargarBoletaDeposito(id: string, boleta: string): Res {
  const m = movimientoPorId(id);
  const origen = m && cajaPorId(m.origenId);
  if (!m || !origen || m.destino.tipo !== "BANCO" || m.estado !== "EN_TRANSITO") return error("El movimiento no es un depósito en tránsito.");
  if (!esResponsable(origen, usuarioActual().id)) return error("Sólo un responsable del origen carga la boleta.");
  if (!boleta.trim()) return error("Ingresá el número de la boleta de depósito.");
  actualizarMovimiento(id, { estado: "ACEPTADO", boletaDeposito: boleta.trim() });
  return { ok: true };
}

// Conciliación: la acreditación del depósito se confirma contra el extracto del banco. Se concilia un
// depósito enviado (en tránsito o con boleta cargada) por el importe exacto acreditado.
export function conciliarDeposito(id: string, importe: number, fechaAcreditacion: string, referencia: string): Res {
  const m = movimientoPorId(id);
  const u = usuarioActual();
  if (!m || m.destino.tipo !== "BANCO" || !["EN_TRANSITO", "ACEPTADO"].includes(m.estado) || !m.envio || m.conciliacion)
    return error("El depósito no está pendiente de conciliar.");
  if (!u.roles.includes("TESORERO")) return error("Sólo el Tesorero concilia las acreditaciones.");
  if (!fechaAcreditacion) return error("Ingresá la fecha de acreditación.");
  if (!referencia.trim()) return error("Ingresá la referencia del extracto bancario.");
  if (importe !== m.importe) return error("El importe acreditado no coincide con el depositado: revisalo con el banco antes de conciliar.");
  actualizarMovimiento(id, {
    estado: "ACEPTADO",
    conciliacion: { usuarioId: u.id, fechaHora: ahoraTexto(), fechaAcreditacion, importe, referencia: referencia.trim() },
  });
  return { ok: true };
}

export interface SaldoBancario {
  cuentaId: string;
  saldoInicial: number; // con el que la cuenta entra al módulo
  conciliado: number; // acreditaciones conciliadas
  pagado: number; // pagos a proveedores con origen en la cuenta (egresos bancarios)
  saldo: number; // saldo inicial + conciliado − pagado
  enTransito: number; // enviado al banco y todavía sin conciliar
}

// Posición de cada cuenta bancaria: saldo inicial, depósitos conciliados menos pagos a proveedores, y lo
// que todavía viaja. El saldo puede quedar negativo (la cuenta puede operar en descubierto o con acuerdo).
export function saldosBancarios(): SaldoBancario[] {
  const pagos = provStores.pagos.get();
  return S.cuentasBancarias.get().map((c) => {
    const deps = S.movimientos.get().filter((m) => m.destino.tipo === "BANCO" && m.destino.cuentaId === c.id && m.envio);
    const conciliado = deps.filter((m) => m.conciliacion).reduce((s, m) => s + m.importe, 0);
    const pagado = pagos.filter((p) => p.origenTipo === "BANCO" && p.origenId === c.id).reduce((s, p) => s + p.importe, 0);
    const saldoInicial = c.saldoInicial ?? 0;
    return {
      cuentaId: c.id,
      saldoInicial,
      conciliado,
      pagado,
      saldo: saldoInicial + conciliado - pagado,
      enTransito: deps.filter((m) => !m.conciliacion).reduce((s, m) => s + m.importe, 0),
    };
  });
}

// Pago a proveedor desde una caja. El efectivo sale del libro y exige lo mismo que cualquier operación de
// caja (responsable, apertura activa, sin bloqueos, dentro del horario y con saldo). Una transferencia o
// un cheque figuran en el libro sin mover el efectivo.
export function pagarDesdeCaja(p: {
  cajaId: string;
  medio: MedioMovimiento;
  importe: number;
  descripcion: string;
  comprobante: string;
  refId?: string;
}): Res<{ asientoId: string }> {
  const caja = cajaPorId(p.cajaId);
  if (!caja || caja.estado !== "ACTIVO") return error("Elegí una caja activa.");
  if (!monedasDe(caja.moneda).includes("ARS")) return error("La caja no opera en pesos.");
  if (p.medio === "EFECTIVO") {
    const u = usuarioActual();
    if (!puedeOperarCaja(u) || !esResponsable(caja, u.id)) return error("Sólo un usuario asignado a la caja puede pagar en efectivo desde ella.");
    if (!abierta(caja.id)) return error("La caja no está abierta: sin apertura no se puede operar.");
    const bloqueo = bloqueoCaja(caja.id) ?? errorFueraDeHorario(caja);
    if (bloqueo) return error(bloqueo);
    if (p.importe > saldoCaja(S.libro.get(), caja.id, "ARS")) return error("La caja no tiene saldo suficiente en pesos.");
  }
  const mov = asentar({
    cajaId: caja.id,
    tipo: "Pago a proveedor",
    descripcion: p.descripcion,
    comprobante: p.comprobante,
    moneda: "ARS",
    egreso: p.importe,
    refId: p.refId,
    medio: p.medio,
  });
  return { ok: true, asientoId: mov.id };
}

// ---------- Pedidos de refuerzo ----------

export function crearPedidoRefuerzo(p: { solicitanteCajaId: string; aCajaId: string; moneda: Moneda; importe: number; motivo: string }): Res<{ pedidoId: string }> {
  const u = usuarioActual();
  const solicitante = cajaPorId(p.solicitanteCajaId);
  const a = cajaPorId(p.aCajaId);
  if (!solicitante || !esResponsable(solicitante, u.id)) return error("Sólo un responsable de la caja puede pedir fondos.");
  if (!a || !esTesoro(a.tipo)) return error("Los fondos se piden al tesoro central o a otro tesoro.");
  if (a.id === solicitante.id) return error("No se puede pedir fondos a la misma caja.");
  if (!monedasDe(solicitante.moneda).includes(p.moneda) || !monedasDe(a.moneda).includes(p.moneda)) return error("Las dos cajas tienen que operar en esa moneda.");
  if (!(p.importe > 0)) return error("Ingresá un importe mayor a cero.");
  if (!p.motivo.trim()) return error("Ingresá el motivo del pedido.");
  const lista = S.pedidos.get();
  const pedido: PedidoRefuerzo = {
    id: siguienteId("PR", lista.map((x) => x.id), 4),
    ...p,
    fecha: hoy(),
    usuarioId: u.id,
    estado: "PENDIENTE",
  };
  S.pedidos.commit([...lista, pedido]);
  return { ok: true, pedidoId: pedido.id };
}

// El tesoro aprueba total o parcialmente, o rechaza. El pedido no mueve dinero: al aprobarlo se genera
// el movimiento de refuerzo, que sigue el circuito general.
export function resolverPedidoRefuerzo(id: string, aprobar: boolean, importeAprobado: number, nota: string): Res<{ movimientoId?: string }> {
  const p = S.pedidos.get().find((x) => x.id === id);
  const aCaja = p && cajaPorId(p.aCajaId);
  const u = usuarioActual();
  if (!p || !aCaja || p.estado !== "PENDIENTE") return error("El pedido ya fue resuelto.");
  if (!esResponsable(aCaja, u.id)) return error("Sólo un responsable del tesoro que recibe el pedido puede resolverlo.");
  if (!aprobar && !nota.trim()) return error("Indicá el motivo del rechazo.");
  const resolucion = { usuarioId: u.id, fechaHora: ahoraTexto(), nota };
  if (!aprobar) {
    S.pedidos.commit(S.pedidos.get().map((x) => (x.id === id ? { ...x, estado: "RECHAZADO" as const, resolucion } : x)));
    return { ok: true };
  }
  if (!(importeAprobado > 0) || importeAprobado > p.importe) return error("El importe aprobado tiene que ser mayor a cero y no superar lo pedido.");
  const nuevo: NuevoMovimiento = {
    tipoId: TIPO_REFUERZO_ID,
    origenId: p.aCajaId,
    destino: { tipo: "CAJA", cajaId: p.solicitanteCajaId },
    moneda: p.moneda,
    importe: importeAprobado,
    motivo: `Pedido de refuerzo ${p.id}: ${p.motivo}`,
    transportista: undefined,
    precinto: "",
    observaciones: "",
  };
  // El transportista se completa en el movimiento: acá se crea sin validar ese dato.
  const tipo = S.tipos.get().find((t) => t.id === TIPO_REFUERZO_ID);
  if (!tipo || tipo.estado !== "ACTIVO") return error("El tipo de movimiento Refuerzo no está activo.");
  if (importeAprobado > saldoCaja(S.libro.get(), p.aCajaId, p.moneda)) return error("El tesoro no tiene saldo suficiente para ese importe.");
  const lista = S.movimientos.get();
  const mov: MovimientoTesoreria = {
    id: siguienteId("MT", lista.map((m) => m.id), 4),
    ...nuevo,
    estado: tipo.requiereAutorizacion ? "SOLICITADO" : "AUTORIZADO",
    solicitanteId: u.id,
    fechaSolicitud: ahoraTexto(),
    pedidoId: p.id,
  };
  S.movimientos.commit([...lista, mov]);
  S.pedidos.commit(
    S.pedidos.get().map((x) => (x.id === id ? { ...x, estado: "APROBADO" as const, importeAprobado, resolucion, movimientoId: mov.id } : x))
  );
  return { ok: true, movimientoId: mov.id };
}

// ---------- Cierre diario de sucursal ----------

// El tesorero confirma que todas las cajas de la sucursal cerraron y que no quedan tránsitos ni
// incidencias abiertas; entonces se bloquea la fecha operativa.
export function cerrarSucursal(sucursalId: string): Res<{ cierreId: string }> {
  const sucursal = S.sucursales.get().find((s) => s.id === sucursalId);
  const u = usuarioActual();
  if (!sucursal) return error("Elegí la sucursal.");
  const cajas = S.cajas.get().filter((c) => c.sucursalId === sucursalId && c.estado === "ACTIVO");
  if (!cajas.some((c) => esTesoro(c.tipo) && c.tesoreroId === u.id)) return error("Sólo el tesorero de la sucursal puede cerrar la fecha operativa.");
  if (cierreVigente(S.cierresSucursal.get(), sucursalId, hoy())) return error("La sucursal ya cerró la fecha operativa.");
  const problemas: string[] = [];
  for (const c of cajas) {
    const j = jornadaVigente(S.jornadas.get(), c.id);
    if (j) problemas.push(`${c.nombre} ${j.estado === "ABIERTA" ? "sigue abierta" : "tiene una apertura o un cierre pendiente de autorización"}.`);
    const bloqueo = bloqueoCaja(c.id);
    if (bloqueo) problemas.push(`${c.nombre}: ${bloqueo}`);
    for (const m of pendientesDeCaja(c.id).filter(enTransito))
      problemas.push(`${m.id} está ${m.estado === "EN_TRANSITO" ? "en tránsito" : "con incidencia"} (${c.nombre}).`);
  }
  if (problemas.length > 0) return error([...new Set(problemas)].join(" "));
  const cierres = S.cierresSucursal.get();
  const cierre = { id: siguienteId("CS", cierres.map((c) => c.id), 4), sucursalId, fecha: hoy(), usuarioId: u.id, fechaHora: ahoraTexto(), estado: "CERRADA" as const };
  S.cierresSucursal.commit([...cierres, cierre]);
  return { ok: true, cierreId: cierre.id };
}

// La reapertura de una fecha cerrada sólo la autoriza un supervisor, con su motivo.
export function reabrirSucursal(cierreId: string, nota: string): Res {
  const cierre = S.cierresSucursal.get().find((c) => c.id === cierreId);
  if (!cierre || cierre.estado !== "CERRADA") return error("La fecha ya está abierta.");
  if (!puedeAprobar(usuarioActual(), cierre.usuarioId)) return error("Sólo un supervisor distinto de quien cerró la fecha puede autorizar la reapertura.");
  if (!nota.trim()) return error("Indicá el motivo de la reapertura.");
  S.cierresSucursal.commit(S.cierresSucursal.get().map((c) => (c.id === cierreId ? { ...c, estado: "REABIERTA" as const, reapertura: aprobacion("APROBADA", nota) } : c)));
  return { ok: true };
}

// ---------- Horario ----------

export function habilitarFueraDeHorario(cajaId: string, usuarioId: string, hastaHora: string, motivo: string): Res {
  const u = usuarioActual();
  if (!u.roles.includes("TESORERO")) return error("Sólo el Tesorero puede habilitar la operación fuera de horario.");
  if (!motivo.trim()) return error("Ingresá el motivo de la excepción.");
  if (aMinutos(hastaHora) <= aMinutos(horaActual())) return error("La hora límite tiene que ser posterior a la hora actual.");
  const lista = S.excepciones.get();
  S.excepciones.commit([
    ...lista,
    { id: siguienteId("EXC", lista.map((e) => e.id), 4), cajaId, usuarioId, fecha: hoy(), hastaHora, motivo, habilitadaPor: u.id, fechaHora: ahoraTexto() },
  ]);
  return { ok: true };
}
