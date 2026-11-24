// Operaciones del módulo Caja y Bancos. Cada una valida las reglas del documento funcional, escribe en
// los stores y devuelve { ok } o un error en español para mostrar en pantalla. Actúa el usuario
// seleccionado en el módulo (usuarioActual) a la hora simulada de la demo.

import {
  aMinutos,
  cierreVigente,
  diferenciaRecuento,
  disponibleParaAutorizar,
  enHorario,
  motivoNoOperativo,
  esResponsable,
  esSupervisor,
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
import { TIPO_REFUERZO_ID, TIPO_RESTITUCION_ID } from "./caja-datos";
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
import { alcanzaElEstimado, posicionBanco, posicionCaja } from "./saldos-reglas";
import { emitirAlerta } from "./alertas";
import { actaDe, crearActa, firmarActa, vincularAjustes } from "./actas";
import { firmaPorId } from "./llave";
import { puedeAutorizarPorMatriz } from "./matriz";
import {
  TIPO_CUENTA_LABEL,
  esTesoro,
  monedasDe,
  type ActaConformidad,
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
  type UsuarioCaja,
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
export function asentarAjuste(cajaId: string, moneda: Moneda, diferencia: number, comprobante: string, motivoId?: string, nota?: string): MovimientoCaja | undefined {
  if (diferencia === 0) return undefined;
  const motivo = S.motivos.get().find((m) => m.id === motivoId);
  const cuenta = motivo ? (diferencia > 0 ? motivo.cuentaSobrante : motivo.cuentaFaltante) : "";
  return asentar({
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
    return "La sucursal cerró la fecha operativa: no se puede operar hasta que Casa Central autorice la reapertura.";
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
        !["ACEPTADO", "RECHAZADO", "FINALIZADO"].includes(m.estado) &&
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

function aprobacion(resultado: Aprobacion["resultado"], nota: string, firmaId?: string): Aprobacion {
  return { supervisorId: usuarioActual().id, fechaHora: ahoraTexto(), resultado, nota, ...(firmaId ? { firmaId } : {}) };
}

// Mail de alerta (R4) cuando un recuento se pasa de la tolerancia de la caja.
function alertaDiferencia(caja: Caja, momento: string, referencia: string, recuento: Recuento) {
  const detalle = monedasFueraDeTolerancia(caja, recuento.diferencia)
    .map((m) => `${m === "ARS" ? "pesos" : "dólares"}: ${recuento.diferencia[m] > 0 ? "sobrante" : "faltante"} de ${Math.abs(recuento.diferencia[m]).toLocaleString("es-AR")}`)
    .join(" · ");
  emitirAlerta(
    "DIFERENCIA_SOBRE_TOLERANCIA",
    `Diferencia mayor a la tolerancia en ${momento} de ${caja.nombre} (${detalle}). Responsable de los fondos: ${nombreUsuario(recuento.usuarioId)}.`,
    referencia,
    { sucursalId: caja.sucursalId }
  );
}

// Un acta rechazada por el segundo firmante es un acta No conforme: dispara el mail.
function alertaNoConforme(caja: Caja, evento: string, referencia: string, nota: string) {
  emitirAlerta("ACTA_NO_CONFORME", `${evento} de ${caja.nombre} rechazada por ${usuarioActual().nombre}: ${nota}`, referencia, { sucursalId: caja.sucursalId });
}

// ---------- Actas de conformidad y de diferencia (v4) ----------

const motivoTexto = (r: Recuento) =>
  r.ajustes.map((a) => S.motivos.get().find((m) => m.id === a.motivoId)?.descripcion ?? a.motivoId).join(" · ");

// Responsable de los fondos de una caja: el cajero con el turno en curso o, si no hay jornada, quien la custodia.
const responsableDeCaja = (caja: Caja) =>
  jornadaVigente(S.jornadas.get(), caja.id)?.turnoUsuarioId || caja.tesoreroId || caja.cajeros[0]?.usuarioId || "";

// Si el acta anterior del mismo evento quedó rechazada, la nueva la referencia (R1: nada se edita).
const referenciaA = (eventoTipo: string, eventoId: string): string | undefined => {
  const previa = actaDe(eventoTipo, eventoId);
  return previa?.estado === "RECHAZADA" ? previa.id : undefined;
};

// Acta de diferencia: el responsable de los fondos firma primero (conforme o disconforme) y después el
// supervisor autoriza el ajuste o lo rechaza. Toda diferencia, sobrante o faltante, tiene el mismo rigor.
function abrirActaDiferencia(
  caja: Caja,
  eventoTipo: string,
  eventoId: string,
  recuento: Recuento,
  e: { responsableId: string; detectoId: string; descripcion: string; referenciaActaId?: string }
): ActaConformidad | undefined {
  const r = crearActa({
    tipo: "DIFERENCIA",
    sucursalId: caja.sucursalId,
    cajaId: caja.id,
    eventoTipo,
    eventoId,
    firmante1Id: e.responsableId,
    referenciaActaId: e.referenciaActaId ?? referenciaA(eventoTipo, eventoId),
    contenido: {
      moneda: monedasDe(caja.moneda),
      detalle: recuento.detalle,
      contado: recuento.contado,
      esperado: recuento.esperado,
      diferencia: recuento.diferencia,
      responsableFondosId: e.responsableId,
      detectoId: e.detectoId,
      motivoId: recuento.ajustes[0]?.motivoId,
      motivoTexto: motivoTexto(recuento),
      observaciones: recuento.ajustes.map((a) => a.nota).filter(Boolean).join(" · "),
      descripcion: e.descripcion,
    },
  });
  return r.ok ? r.acta : undefined;
}

// Acta de conformidad sin diferencia: dos usuarios distintos dan su conformidad; no traba la operación.
function abrirActaConformidad(
  caja: Caja,
  tipo: "APERTURA" | "ARQUEO" | "RELEVO" | "REEMPLAZO",
  eventoTipo: string,
  eventoId: string,
  recuento: Recuento,
  firmante1Id: string,
  firmante2Id: string | undefined,
  descripcion: string
) {
  crearActa({
    tipo,
    sucursalId: caja.sucursalId,
    cajaId: caja.id,
    eventoTipo,
    eventoId,
    firmante1Id,
    firmante2Id,
    contenido: {
      moneda: monedasDe(caja.moneda),
      detalle: recuento.detalle,
      contado: recuento.contado,
      esperado: recuento.esperado,
      diferencia: recuento.diferencia,
      responsableFondosId: firmante1Id,
      detectoId: recuento.usuarioId,
      descripcion,
    },
  });
}

// Importe de la diferencia más grande (en su moneda): es el que mide la matriz de autorizaciones.
function importeDeDiferencia(d: Record<Moneda, number>): { importe: number; moneda: Moneda } {
  const m = (["ARS", "USD"] as Moneda[]).reduce((a, b) => (Math.abs(d[b]) > Math.abs(d[a]) ? b : a));
  return { importe: Math.abs(d[m]), moneda: m };
}

// La resolución de una diferencia con llave pasa por el acta: sin la firma del responsable (o la
// negativa resuelta por un superior) no se autoriza el ajuste. Sin `firmaId` (uso interno y pruebas)
// no se toca el acta, igual que la llave, que la exige la pantalla y no la función.
interface ResolucionActa {
  error?: string;
  acta?: ActaConformidad;
  porEscalamiento?: boolean;
  registrada?: boolean;
}
function resolverConActa(
  eventoTipo: string,
  eventoId: string,
  aprobar: boolean,
  nota: string,
  firmaId: string | undefined,
  diferencia: Record<Moneda, number>
): ResolucionActa {
  const acta = actaDe(eventoTipo, eventoId);
  if (!acta || acta.tipo !== "DIFERENCIA") return {};
  if (!firmaId) return { acta };
  if (acta.estado === "PEND_FIRMA_1")
    return { error: "Falta la firma del responsable de los fondos (conforme o disconforme), o que un supervisor registre su negativa a firmar." };
  if (acta.estado === "ESCALADA") return { error: "El acta está escalada por una negativa a firmar: la resuelve el Tesorero central o el Director." };
  if (acta.estado === "RESUELTA") {
    if (!aprobar) return { acta };
    if (acta.resolucion?.decision === "AUTORIZAR") return { acta, porEscalamiento: true };
    return { error: "El superior pidió una nueva verificación: rechazá el ajuste y repetí el recuento." };
  }
  if (acta.estado !== "PEND_FIRMA_2") return { acta };
  const firma = firmaPorId(firmaId);
  if (!firma) return { error: "No se encontró la firma con llave." };
  if (aprobar) {
    const { importe, moneda } = importeDeDiferencia(diferencia);
    const motivo = puedeAutorizarPorMatriz(usuarioActual(), "AJUSTE_DIFERENCIA", importe, moneda);
    if (motivo) return { error: motivo };
  }
  const r = firmarActa(acta.id, { paso: 2, firma, conforme: aprobar, observaciones: nota });
  if (!r.ok) return { error: r.error };
  return { acta: r.acta, registrada: true };
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
  if (!r.necesitaSupervisor) {
    asentarDiferencias(caja, r.recuento, jornada.id);
    // Sin diferencia (o dentro de la tolerancia): acta de apertura del cajero y de un Tesorero o Supervisor.
    abrirActaConformidad(caja, "APERTURA", "JORNADA_APERTURA", jornada.id, r.recuento, u.id, undefined, "Apertura de caja");
  } else {
    alertaDiferencia(caja, "la apertura", jornada.id, r.recuento);
    // El que abre es el responsable de los fondos y también quien detectó la diferencia al contar.
    const previa = S.actas.get().filter((a) => a.cajaId === caja.id && a.eventoTipo === "JORNADA_APERTURA" && a.tipo === "DIFERENCIA" && a.estado === "RECHAZADA").at(-1);
    abrirActaDiferencia(caja, "JORNADA_APERTURA", jornada.id, r.recuento, {
      responsableId: u.id,
      detectoId: u.id,
      descripcion: "Diferencia detectada en la apertura",
      referenciaActaId: previa?.id,
    });
  }
  return { ok: true, jornadaId: jornada.id, estado: jornada.estado };
}

// `firmaId` es la firma con llave (R6) que respalda la aprobación; la pantalla la exige.
export function resolverApertura(jornadaId: string, aprobar: boolean, nota: string, firmaId?: string): Res {
  const jornada = S.jornadas.get().find((j) => j.id === jornadaId);
  const caja = jornada && cajaPorId(jornada.cajaId);
  if (!jornada || !caja || jornada.estado !== "PEND_APERTURA") return error("La apertura ya no está pendiente.");
  const previa = actaDe("JORNADA_APERTURA", jornada.id);
  // Un acta escalada la resolvió un superior con su llave: ese superior puede autorizar o rechazar.
  const escalada = previa?.estado === "RESUELTA";
  if (!escalada && !puedeAprobar(usuarioActual(), jornada.apertura.usuarioId))
    return error("Sólo un supervisor distinto de quien cargó el recuento puede resolverla.");
  if (!aprobar && !nota.trim()) return error("Indicá el motivo del rechazo.");
  const acta = resolverConActa("JORNADA_APERTURA", jornada.id, aprobar, nota, firmaId, jornada.apertura.diferencia);
  if (acta.error) return error(acta.error);
  const ap = aprobacion(aprobar ? "APROBADA" : "RECHAZADA", nota, firmaId);
  if (!aprobar) {
    // Se rechaza: se repite el recuento. La jornada se descarta y queda el registro del rechazo.
    S.jornadas.commit(S.jornadas.get().filter((j) => j.id !== jornada.id));
    auditar("Apertura de caja", jornada.id, "ESTADO", `Pendiente de autorización (${caja.nombre})`, `Rechazada por ${nombreUsuario(ap.supervisorId)}: ${nota}`);
    if (!acta.registrada) alertaNoConforme(caja, "La apertura", jornada.id, nota);
    return { ok: true };
  }
  const apertura = { ...jornada.apertura, aprobacion: ap };
  S.jornadas.commit(S.jornadas.get().map((j) => (j.id === jornada.id ? { ...j, estado: "ABIERTA" as const, apertura } : j)));
  const antes = S.libro.get().length;
  asentarDiferencias(caja, apertura, jornada.id);
  if (acta.acta) vincularAjustes(acta.acta.id, S.libro.get().slice(antes).map((m) => m.id));
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
  else {
    alertaDiferencia(caja, "el cierre", `${jornada.id}-C`, r.recuento);
    // Responsable de los fondos: el cajero con la custodia al cerrar (quien cierra la caja).
    abrirActaDiferencia(caja, "JORNADA_CIERRE", `${jornada.id}-C`, r.recuento, {
      responsableId: jornada.turnoUsuarioId || r.recuento.usuarioId,
      detectoId: r.recuento.usuarioId,
      descripcion: "Diferencia detectada en el cierre",
    });
  }
  return { ok: true, estado };
}

export function resolverCierre(jornadaId: string, aprobar: boolean, nota: string, firmaId?: string): Res {
  const jornada = S.jornadas.get().find((j) => j.id === jornadaId);
  const caja = jornada && cajaPorId(jornada.cajaId);
  if (!jornada?.cierre || !caja || jornada.estado !== "PEND_CIERRE") return error("El cierre ya no está pendiente.");
  const previa = actaDe("JORNADA_CIERRE", `${jornada.id}-C`);
  // Un acta escalada la resolvió un superior con su llave: ese superior puede autorizar o rechazar.
  const escalada = previa?.estado === "RESUELTA";
  if (!escalada && !puedeAprobar(usuarioActual(), jornada.cierre.usuarioId))
    return error("Sólo un supervisor distinto de quien cargó el recuento puede resolverlo.");
  if (!aprobar && !nota.trim()) return error("Indicá el motivo del rechazo.");
  const acta = resolverConActa("JORNADA_CIERRE", `${jornada.id}-C`, aprobar, nota, firmaId, jornada.cierre.diferencia);
  if (acta.error) return error(acta.error);
  const ap = aprobacion(aprobar ? "APROBADA" : "RECHAZADA", nota, firmaId);
  if (!aprobar) {
    // El cierre rechazado vuelve a Abierta: se repite el recuento.
    S.jornadas.commit(
      S.jornadas.get().map((j) =>
        j.id === jornada.id ? { ...j, estado: "ABIERTA" as const, cierre: undefined, rechazos: [...j.rechazos, { etapa: "CIERRE" as const, aprobacion: ap }] } : j
      )
    );
    if (!acta.registrada) alertaNoConforme(caja, "El cierre", `${jornada.id}-C`, nota);
    return { ok: true };
  }
  const cierre = { ...jornada.cierre, aprobacion: ap };
  S.jornadas.commit(S.jornadas.get().map((j) => (j.id === jornada.id ? { ...j, estado: "CERRADA" as const, cierre } : j)));
  const antes = S.libro.get().length;
  asentarDiferencias(caja, cierre, `${jornada.id}-C`);
  if (acta.acta) vincularAjustes(acta.acta.id, S.libro.get().slice(antes).map((m) => m.id));
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
  if (!conforme) {
    // Un arqueo sorpresivo avisa ante cualquier diferencia; el ordinario, sólo si pasa la tolerancia.
    if (arqueo.tipo === "SORPRESIVO")
      emitirAlerta(
        "ARQUEO_SORPRESIVO_DIFERENCIA",
        `El arqueo sorpresivo de ${caja.nombre} (controlador ${nombreUsuario(arqueo.controladorId)}) terminó con diferencia.`,
        arqueo.id,
        { sucursalId: caja.sucursalId }
      );
    else if (monedasFueraDeTolerancia(caja, ultimo.diferencia).length > 0) alertaDiferencia(caja, "el arqueo", arqueo.id, ultimo);
  }
  // Acta del arqueo. Sin diferencia es de conformidad (controlador y cajero); con diferencia es de
  // diferencia: el responsable de la caja arqueada firma primero y el supervisor autoriza el ajuste.
  const responsableId = esResponsable(caja, ultimo.usuarioId) ? ultimo.usuarioId : responsableDeCaja(caja);
  const tipoTexto = arqueo.tipo === "SORPRESIVO" ? "sorpresivo" : "ordinario";
  if (conforme) abrirActaConformidad(caja, "ARQUEO", "ARQUEO", arqueo.id, ultimo, arqueo.controladorId, responsableId || undefined, `Arqueo ${tipoTexto} sin diferencia`);
  else {
    const rechazada = S.actas.get().filter((a) => a.cajaId === caja.id && a.eventoTipo === "ARQUEO" && a.tipo === "DIFERENCIA" && a.estado === "RECHAZADA").at(-1);
    abrirActaDiferencia(caja, "ARQUEO", arqueo.id, ultimo, {
      responsableId,
      detectoId: arqueo.controladorId,
      descripcion: `Diferencia detectada en un arqueo ${tipoTexto}`,
      referenciaActaId: rechazada?.id,
    });
  }
  return { ok: true };
}

// El arqueo no corrige saldos: la diferencia se regulariza sólo con un ajuste autorizado por un supervisor.
export function ajustarDiferenciaArqueo(arqueoId: string, motivoId: string, nota: string, firmaId?: string): Res {
  const arqueo = S.arqueos.get().find((a) => a.id === arqueoId);
  const caja = arqueo && cajaPorId(arqueo.cajaId);
  if (!arqueo || !caja || arqueo.estado !== "FINALIZADO" || arqueo.resultado !== "CON_DIFERENCIA" || arqueo.ajusteAprobado || arqueo.ajusteRechazado)
    return error("El arqueo no tiene una diferencia pendiente de regularizar.");
  const previa = actaDe("ARQUEO", arqueo.id);
  // Un acta escalada la resolvió un superior con su llave: ese superior puede autorizar o rechazar.
  const escalada = previa?.estado === "RESUELTA";
  if (!escalada && !puedeAprobar(usuarioActual(), arqueo.controladorId)) return error("Sólo un supervisor distinto del controlador puede autorizar el ajuste.");
  if (!motivoId) return error("Elegí el motivo de la diferencia.");
  const jornada = jornadaVigente(S.jornadas.get(), caja.id);
  if (!jornada || jornada.estado !== "ABIERTA") return error("La caja tiene que estar abierta para registrar el ajuste.");
  const ultimo = arqueo.conteos[arqueo.conteos.length - 1];
  const acta = resolverConActa("ARQUEO", arqueo.id, true, nota, firmaId, ultimo.diferencia);
  if (acta.error) return error(acta.error);
  const antes = S.libro.get().length;
  for (const m of monedasDe(caja.moneda)) asentarAjuste(caja.id, m, ultimo.diferencia[m], arqueo.id, motivoId, nota);
  const nuevos = S.libro.get().slice(antes).map((m) => m.id);
  const movimientoId = S.libro.get()[S.libro.get().length - 1].id;
  if (acta.acta) vincularAjustes(acta.acta.id, nuevos);
  const ap = aprobacion("APROBADA", nota, firmaId);
  S.arqueos.commit(S.arqueos.get().map((a) => (a.id === arqueoId ? { ...a, ajusteAprobado: { ...ap, motivoId, movimientoId } } : a)));
  return { ok: true };
}

// El supervisor no autoriza el ajuste: el acta queda Rechazada y la diferencia se vuelve a verificar con
// un arqueo nuevo (el acta rechazada no se edita; el arqueo nuevo genera un acta que la referencia).
export function rechazarAjusteArqueo(arqueoId: string, nota: string, firmaId?: string): Res {
  const arqueo = S.arqueos.get().find((a) => a.id === arqueoId);
  const caja = arqueo && cajaPorId(arqueo.cajaId);
  if (!arqueo || !caja || arqueo.estado !== "FINALIZADO" || arqueo.resultado !== "CON_DIFERENCIA" || arqueo.ajusteAprobado || arqueo.ajusteRechazado)
    return error("El arqueo no tiene una diferencia pendiente de regularizar.");
  if (!puedeAprobar(usuarioActual(), arqueo.controladorId)) return error("Sólo un supervisor distinto del controlador puede resolverlo.");
  if (!nota.trim()) return error("Indicá el motivo del rechazo.");
  const ultimo = arqueo.conteos[arqueo.conteos.length - 1];
  const acta = resolverConActa("ARQUEO", arqueo.id, false, nota, firmaId, ultimo.diferencia);
  if (acta.error) return error(acta.error);
  if (!acta.registrada) alertaNoConforme(caja, "El ajuste del arqueo", arqueo.id, nota);
  S.arqueos.commit(S.arqueos.get().map((a) => (a.id === arqueoId ? { ...a, ajusteRechazado: aprobacion("RECHAZADA", nota, firmaId) } : a)));
  return { ok: true };
}

// ---------- Cambio de turno (relevo con arqueo) ----------

// Cambio de turno (variante por defecto) o reemplazo por emergencia: mismos pasos, pero con motivo
// obligatorio y, además del saliente, lo puede iniciar el Supervisor de la sucursal.
export function solicitarCambioTurno(
  cajaId: string,
  entranteId: string,
  opciones: { variante?: "TURNO" | "REEMPLAZO"; motivo?: string } = {}
): Res<{ cambioId: string }> {
  const caja = cajaPorId(cajaId);
  const jornada = caja && jornadaVigente(S.jornadas.get(), caja.id);
  const u = usuarioActual();
  const variante = opciones.variante ?? "TURNO";
  if (!caja) return error("Elegí la caja.");
  if (!jornada || jornada.estado !== "ABIERTA") return error("La caja tiene que estar abierta para cambiar de turno.");
  if (variante === "REEMPLAZO") {
    if (!opciones.motivo?.trim()) return error("El reemplazo por emergencia necesita el motivo.");
    if (u.id !== jornada.turnoUsuarioId && !(esSupervisor(u) && u.sucursalId === caja.sucursalId))
      return error("El reemplazo lo inicia el cajero saliente o el Supervisor de la sucursal.");
  } else if (jornada.turnoUsuarioId !== u.id) return error("Sólo el cajero con el turno en curso puede pedir el relevo.");
  if (entranteId === jornada.turnoUsuarioId) return error("El cajero entrante tiene que ser otro usuario.");
  if (!caja.cajeros.some((c) => c.usuarioId === entranteId && c.estado === "ACTIVO"))
    return error("El entrante tiene que estar asignado a la caja en Parámetros.");
  const bloqueo = bloqueoCaja(caja.id);
  if (bloqueo) return error(bloqueo);
  const cambios = S.cambiosTurno.get();
  const cambio: CambioTurno = {
    id: siguienteId("CT", cambios.map((c) => c.id), 4),
    cajaId,
    jornadaId: jornada.id,
    salienteId: jornada.turnoUsuarioId,
    entranteId,
    corte: ahoraTexto(),
    estado: "SOLICITADO",
    variante,
    motivo: opciones.motivo?.trim() || undefined,
    iniciadoPor: u.id,
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
  // En un reemplazo, si el saliente no puede contar ni firmar lo hace el Supervisor que lo inició.
  const enNombre = cambio.variante === "REEMPLAZO" && cambio.iniciadoPor === usuarioActual().id && usuarioActual().id !== cambio.salienteId;
  if (usuarioActual().id !== cambio.salienteId && !enNombre) return error("El arqueo de relevo lo carga el cajero saliente.");
  const r = armarRecuento(caja, entrada);
  if (!r.ok) return r;
  if (!r.necesitaSupervisor) {
    asentarDiferencias(caja, r.recuento, cambio.id);
    actualizarCambio(cambioId, { arqueo: r.recuento, estado: "PEND_RECEPCION" });
    return { ok: true, estado: "PEND_RECEPCION" };
  }
  actualizarCambio(cambioId, { arqueo: r.recuento, estado: "PEND_AUTORIZACION" });
  alertaDiferencia(caja, "el relevo", cambio.id, r.recuento);
  // La diferencia es del saliente (el relevo lo ve así: el entrante recibe la caja resuelta).
  abrirActaDiferencia(caja, "RELEVO", cambio.id, r.recuento, {
    responsableId: cambio.salienteId,
    detectoId: r.recuento.usuarioId,
    descripcion: cambio.variante === "REEMPLAZO" ? `Diferencia detectada en un reemplazo por emergencia: ${cambio.motivo ?? ""}`.trim() : "Diferencia detectada en el cambio de turno",
  });
  return { ok: true, estado: "PEND_AUTORIZACION" };
}

// La diferencia aprobada queda atribuida al cajero saliente.
export function resolverRelevo(cambioId: string, aprobar: boolean, nota: string, firmaId?: string): Res {
  const cambio = S.cambiosTurno.get().find((c) => c.id === cambioId);
  const caja = cambio && cajaPorId(cambio.cajaId);
  if (!cambio?.arqueo || !caja || cambio.estado !== "PEND_AUTORIZACION") return error("El relevo no está pendiente de autorización.");
  const previa = actaDe("RELEVO", cambio.id);
  // Un acta escalada la resolvió un superior con su llave: ese superior puede autorizar o rechazar.
  const escalada = previa?.estado === "RESUELTA";
  if (!escalada && (!puedeAprobar(usuarioActual(), cambio.salienteId) || usuarioActual().id === cambio.arqueo.usuarioId))
    return error("Sólo un supervisor distinto del cajero saliente (y de quien cargó el arqueo) puede resolverlo.");
  if (!aprobar && !nota.trim()) return error("Indicá el motivo del rechazo.");
  const acta = resolverConActa("RELEVO", cambio.id, aprobar, nota, firmaId, cambio.arqueo.diferencia);
  if (acta.error) return error(acta.error);
  const ap = aprobacion(aprobar ? "APROBADA" : "RECHAZADA", nota, firmaId);
  if (!aprobar) {
    actualizarCambio(cambioId, { estado: "SOLICITADO", arqueo: undefined, resolucion: ap });
    if (!acta.registrada) alertaNoConforme(caja, "El arqueo de relevo", cambio.id, nota);
    return { ok: true };
  }
  const antes = S.libro.get().length;
  asentarDiferencias(caja, { ...cambio.arqueo, aprobacion: ap }, cambio.id);
  if (acta.acta) vincularAjustes(acta.acta.id, S.libro.get().slice(antes).map((m) => m.id));
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
    emitirAlerta(
      "INCIDENCIA_RECEPCION",
      `El recuento de ${nombreUsuario(cambio.entranteId)} no coincide con lo declarado por ${nombreUsuario(cambio.salienteId)} en el relevo de ${caja.nombre}.`,
      cambio.id,
      { sucursalId: caja.sucursalId }
    );
    return { ok: true, estado: "CON_INCIDENCIA" };
  }
  S.jornadas.commit(S.jornadas.get().map((j) => (j.id === cambio.jornadaId ? { ...j, turnoUsuarioId: cambio.entranteId } : j)));
  actualizarCambio(cambioId, { recepcion, estado: "COMPLETADO", fin: ahoraTexto() });
  // Acta de relevo (o de reemplazo) firmada por el saliente y el entrante; no traba el nuevo turno.
  if (cambio.arqueo)
    abrirActaConformidad(
      caja,
      cambio.variante === "REEMPLAZO" ? "REEMPLAZO" : "RELEVO",
      "RELEVO_CONFORMIDAD",
      cambio.id,
      cambio.arqueo,
      cambio.salienteId,
      cambio.entranteId,
      cambio.variante === "REEMPLAZO" ? `Reemplazo por emergencia: ${cambio.motivo ?? ""}`.trim() : "Cambio de turno"
    );
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
  if (usuarioActual().id !== cambio.salienteId && usuarioActual().id !== cambio.iniciadoPor)
    return error("Sólo el cajero saliente (o el supervisor que inició el reemplazo) puede cancelar el relevo.");
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
  // Pedido de refuerzo a banco: cuenta de la que se extraen los fondos. `origenId` es el tesoro que los recibe.
  origenBancoId?: string;
  // Restitución de fondo fijo: rendición de gastos contra la que se repone.
  rendicion?: { detalle: string; comprobantes: number; importe: number };
}

const destinoCajaId = (m: MovimientoTesoreria) => (m.destino.tipo === "CAJA" ? m.destino.cajaId : undefined);
const origenTexto = (m: MovimientoTesoreria) => (m.origenBancoId ? bancoTexto(m.origenBancoId) : nombreCaja(m.origenId));
export { origenTexto };

// Pedido de refuerzo a banco: el tesoro (`origenId`) pide fondos de una cuenta. Valida la cuenta contra su
// saldo estimado; el tesoro es también el destino.
function errorPedidoABanco(n: NuevoMovimiento, tipo: { descripcion: string; destinos: string[] }): string | undefined {
  const tesoro = cajaPorId(n.origenId);
  const cuenta = S.cuentasBancarias.get().find((c) => c.id === n.origenBancoId);
  if (!tesoro) return "Elegí el tesoro que recibe los fondos.";
  if (tesoro.estado !== "ACTIVO") return "El tesoro no está activo.";
  if (!tipo.destinos.includes(tesoro.tipo)) return `El tipo "${tipo.descripcion}" no admite como destino a ${tesoro.nombre}.`;
  if (!monedasDe(tesoro.moneda).includes(n.moneda)) return "El tesoro no opera en esa moneda.";
  if (!cuenta) return "Elegí la cuenta bancaria de la que se extraen los fondos.";
  if (cuenta.estado !== "ACTIVO") return "La cuenta bancaria no está activa.";
  if (cuenta.moneda !== n.moneda) return "La cuenta bancaria es de otra moneda.";
  if (!(n.importe > 0)) return "Ingresá un importe mayor a cero.";
  if (!alcanzaElEstimado(posicionDeCuenta(cuenta.id), n.importe)) return "La cuenta no tiene saldo estimado suficiente (descontado lo ya reservado).";
  if (!n.motivo.trim()) return "Ingresá el motivo del pedido.";
  if (!n.transportista?.nombre.trim() || !n.transportista.documento.trim()) return "Cargá el nombre y el documento de quien va a extraer los fondos.";
  return undefined;
}

export function errorNuevoMovimiento(n: NuevoMovimiento): string | undefined {
  const tipo = S.tipos.get().find((t) => t.id === n.tipoId);
  if (!tipo || tipo.estado !== "ACTIVO") return "Elegí un tipo de movimiento activo.";
  if (tipo.origenBanco) return errorPedidoABanco(n, tipo);
  const origen = cajaPorId(n.origenId);
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
  if (!alcanzaElEstimado(posicionDeCaja(origen.id, n.moneda), n.importe))
    return "El origen no tiene saldo estimado suficiente (descontado lo ya reservado y comprometido).";
  if (!n.motivo.trim()) return "Ingresá el motivo del movimiento.";
  if (tipo.id === TIPO_RESTITUCION_ID) {
    const r = n.rendicion;
    if (!r || !r.detalle.trim() || !(r.comprobantes >= 1)) return "Cargá la rendición de gastos del fondo fijo: detalle y comprobantes adjuntos.";
    if (r.importe !== n.importe) return "La restitución tiene que ser por el importe de los gastos rendidos.";
  }
  const entreCajeros = origen.tipo === "CAJA_CAJERO" && n.destino.tipo === "CAJA" && cajaPorId(n.destino.cajaId)?.tipo === "CAJA_CAJERO";
  if (!entreCajeros && (!n.transportista?.nombre.trim() || !n.transportista.documento.trim()))
    return "Cargá el nombre y el documento del responsable del traslado.";
  return undefined;
}

export function crearMovimiento(n: NuevoMovimiento): Res<{ movimientoId: string }> {
  const u = usuarioActual();
  const origen = cajaPorId(n.origenId);
  const tipo = S.tipos.get().find((t) => t.id === n.tipoId);
  if (!puedeOperarCaja(u) || !origen || !esResponsable(origen, u.id))
    return error(tipo?.origenBanco ? "Sólo un responsable del tesoro que recibe los fondos puede pedirlos." : "Sólo un responsable del origen puede cargar el movimiento.");
  const e = errorNuevoMovimiento(n);
  if (e || !tipo) return error(e ?? "Elegí el tipo de movimiento.");
  const lista = S.movimientos.get();
  const mov: MovimientoTesoreria = {
    id: siguienteId("MT", lista.map((m) => m.id), 4),
    ...n,
    // En un pedido a banco el tesoro que pide es también el destino.
    ...(tipo.origenBanco ? { destino: { tipo: "CAJA" as const, cajaId: n.origenId } } : {}),
    ...(tipo.id === TIPO_RESTITUCION_ID ? {} : { rendicion: undefined }),
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

// Quién puede autorizar un movimiento (v4, R6 y 7.18): un usuario distinto del que lo cargó, con un perfil
// que la matriz de autorizaciones habilite para ese importe. Devuelve el motivo si no puede.
export function errorAutorizarMovimiento(m: MovimientoTesoreria, usuario: UsuarioCaja | undefined = usuarioActual()): string | null {
  if (!usuario) return "Elegí el usuario que autoriza.";
  if (usuario.id === m.solicitanteId) return "Nadie autoriza lo que cargó él mismo, tampoco con otro de sus roles.";
  return puedeAutorizarPorMatriz(usuario, "MOVIMIENTO_TESORERIA", m.importe, m.moneda);
}

// Al autorizar se crea la reserva ÚNICA del movimiento en el origen. En una caja la reserva es el propio
// movimiento Autorizado (`reservado`, que `comprometidoCaja` suma sin duplicar); en un pedido a banco es una
// fila de `reservas` sobre la cuenta, que se consume al registrar la extracción.
export function autorizarMovimiento(id: string, aprobar: boolean, nota: string, firmaId?: string): Res {
  const m = movimientoPorId(id);
  if (!m || m.estado !== "SOLICITADO") return error("El movimiento no está esperando autorización.");
  const sinPermiso = errorAutorizarMovimiento(m);
  if (sinPermiso) return error(sinPermiso);
  if (!aprobar && !nota.trim()) return error("Indicá el motivo del rechazo.");
  if (aprobar) {
    if (m.origenBancoId) {
      if (!alcanzaElEstimado(posicionDeCuenta(m.origenBancoId), m.importe))
        return error("Al autorizarlo, el importe supera el saldo estimado de la cuenta (real menos lo ya comprometido).");
    } else {
      // Ningún egreso se autoriza si supera el estimado, ni deja al origen bajo su mínimo operativo.
      const origen = cajaPorId(m.origenId);
      if (origen && m.importe > disponibleParaAutorizar(S.libro.get(), S.movimientos.get(), origen, m.moneda, m.id))
        return error("Al autorizarlo, el origen quedaría por debajo de su mínimo operativo o comprometería fondos ya reservados.");
      if (origen && !alcanzaElEstimado(posicionDeCaja(origen.id, m.moneda), m.importe))
        return error("Al autorizarlo, el importe supera el saldo estimado del origen (real menos lo ya comprometido).");
    }
  }
  if (aprobar && m.origenBancoId) {
    const reservas = S.reservas.get();
    S.reservas.commit([
      ...reservas,
      {
        id: siguienteId("RSV", reservas.map((r) => r.id), 4),
        origenTipo: "BANCO",
        origenId: m.origenBancoId,
        moneda: m.moneda,
        importe: m.importe,
        operacionTipo: "MOVIMIENTO",
        operacionId: m.id,
        estado: "ACTIVA",
        creada: { usuarioId: usuarioActual().id, fechaHora: ahoraTexto() },
      },
    ]);
  }
  actualizarMovimiento(id, { estado: aprobar ? "AUTORIZADO" : "RECHAZADO", autorizacion: aprobacion(aprobar ? "APROBADA" : "RECHAZADA", nota, firmaId) });
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
// `acta` es el acta de entrega al portador: la firma con llave de quien entrega y la conformidad del portador
// (que recibe). La pantalla la exige; sin acta se registra igual, como antes de la v4.
export function enviarMovimiento(id: string, detalle: DetalleRecuento, conformidad: boolean, acta?: { firmaId: string; portadorConforme: boolean }): Res {
  const m = movimientoPorId(id);
  const origen = m && cajaPorId(m.origenId);
  if (!m || !origen || m.estado !== "AUTORIZADO") return error("El movimiento no está autorizado para salir.");
  if (m.origenBancoId) return error("Un pedido a banco no se envía: se registra la extracción con su boleta.");
  if (acta && !acta.portadorConforme) return error("El portador tiene que firmar el acta de entrega.");
  if (!esResponsable(origen, usuarioActual().id)) return error("Sólo un responsable del origen registra el envío.");
  if (!abierta(origen.id)) return error("El origen no tiene la caja abierta: sin apertura no se puede operar.");
  const bloqueo = bloqueoCaja(origen.id) ?? errorFueraDeHorario(origen);
  if (bloqueo) return error(bloqueo);
  if (!conformidad) return error("El origen tiene que confirmar lo que entrega al transportista.");
  const contado = totalRecuento(detalle, S.denominaciones.get())[m.moneda];
  if (contado !== m.importe) return error("El recuento por denominación no coincide con el importe del movimiento.");
  if (m.importe > saldoCaja(S.libro.get(), origen.id, m.moneda)) return error("El origen no tiene saldo suficiente.");
  const tipo = S.tipos.get().find((t) => t.id === m.tipoId);
  const firmaEntrega = acta ? { firmaId: acta.firmaId, portadorConforme: true } : {};
  asentar({
    cajaId: origen.id,
    tipo: tipo?.descripcion ?? "Movimiento de tesorería",
    descripcion: `Envío a ${m.destino.tipo === "CAJA" ? nombreCaja(m.destino.cajaId) : bancoTexto(m.destino.cuentaId)}`,
    comprobante: m.id,
    moneda: m.moneda,
    egreso: m.importe,
    refId: m.id,
  });
  actualizarMovimiento(id, {
    estado: "EN_TRANSITO",
    envio: { usuarioId: usuarioActual().id, fechaHora: ahoraTexto(), detalle, importe: m.importe, conformidad, ...firmaEntrega },
  });
  return { ok: true };
}

// Pedido de refuerzo a banco: alguien va al banco a extraer. Al cargar la boleta de extracción el importe sale
// de la cuenta (baja el real y se consume la reserva) y queda En tránsito hasta que el tesoro lo cuente y acepte.
export function registrarExtraccion(id: string, boleta: string): Res {
  const m = movimientoPorId(id);
  const tesoro = m && cajaPorId(m.origenId);
  if (!m || !tesoro || !m.origenBancoId || m.estado !== "AUTORIZADO") return error("El pedido a banco no está autorizado para extraer.");
  if (!esResponsable(tesoro, usuarioActual().id)) return error("Sólo un responsable del tesoro que recibe los fondos registra la extracción.");
  if (!boleta.trim()) return error("Ingresá el número de la boleta de extracción.");
  const ahora = ahoraTexto();
  S.reservas.commit(
    S.reservas.get().map((r) =>
      r.operacionTipo === "MOVIMIENTO" && r.operacionId === m.id && r.estado === "ACTIVA"
        ? { ...r, estado: "CONSUMIDA" as const, cierre: { usuarioId: usuarioActual().id, fechaHora: ahora, motivo: `Extracción ${boleta.trim()}` } }
        : r
    )
  );
  actualizarMovimiento(id, { estado: "EN_TRANSITO", extraccion: { usuarioId: usuarioActual().id, fechaHora: ahora, importe: m.importe, boleta: boleta.trim() } });
  return { ok: true };
}

// Cierra un movimiento aceptado con su documento: acta de recepción o boleta de depósito o de extracción.
export function finalizarMovimiento(id: string, documento: string, firmaId?: string): Res {
  const m = movimientoPorId(id);
  if (!m || m.estado !== "ACEPTADO") return error("Sólo se finaliza un movimiento aceptado.");
  const u = usuarioActual();
  const destino = destinoCajaId(m) ? cajaPorId(destinoCajaId(m) as string) : undefined;
  const origen = cajaPorId(m.origenId);
  if (!(destino && esResponsable(destino, u.id)) && !(origen && esResponsable(origen, u.id)) && !esSupervisor(u))
    return error("Sólo un responsable del origen o del destino, o un supervisor, documenta el movimiento.");
  if (!documento.trim()) return error("Ingresá el número de acta o de boleta que documenta el movimiento.");
  actualizarMovimiento(id, { estado: "FINALIZADO", finalizacion: { usuarioId: u.id, fechaHora: ahoraTexto(), documento: documento.trim(), ...(firmaId ? { firmaId } : {}) } });
  return { ok: true };
}

const bancoTexto = (cuentaId: string) => {
  const c = S.cuentasBancarias.get().find((x) => x.id === cuentaId);
  return c ? `${c.banco} · ${TIPO_CUENTA_LABEL[c.tipo]} ${c.numero}` : cuentaId;
};
export { bancoTexto };

// Recepción: el movimiento sólo se completa con la aceptación del receptor. Si el recuento no
// coincide, queda Con incidencia y el dinero no se integra hasta que un supervisor resuelva.
// Con `firmaId` (acta de recepción firmada con llave) o con la boleta de extracción cargada, el movimiento queda
// documentado y pasa directo a Finalizado; si no, queda Aceptado hasta documentarlo (`finalizarMovimiento`).
export function recibirMovimiento(id: string, detalle: DetalleRecuento, firmaId?: string): Res<{ estado: MovimientoTesoreria["estado"] }> {
  const m = movimientoPorId(id);
  const destinoId = m && destinoCajaId(m);
  const destino = destinoId ? cajaPorId(destinoId) : undefined;
  if (!m || !destino || m.estado !== "EN_TRANSITO") return error("No hay nada para recibir en este movimiento.");
  if (!esResponsable(destino, usuarioActual().id)) return error("Sólo un responsable del destino puede aceptarlo.");
  if (!abierta(destino.id)) return error("El destino no tiene la caja abierta: sin apertura no se puede operar.");
  const bloqueo = bloqueoCaja(destino.id) ?? errorFueraDeHorario(destino);
  if (bloqueo) return error(bloqueo);
  const contado = totalRecuento(detalle, S.denominaciones.get())[m.moneda];
  const recepcion = { usuarioId: usuarioActual().id, fechaHora: ahoraTexto(), detalle, importe: contado, ...(firmaId ? { firmaId } : {}) };
  if (contado !== m.importe) {
    actualizarMovimiento(id, { estado: "CON_INCIDENCIA", recepcion });
    emitirAlerta(
      "INCIDENCIA_RECEPCION",
      `${destino.nombre} contó ${contado.toLocaleString("es-AR")} y el movimiento ${m.id} enviaba ${m.importe.toLocaleString("es-AR")} (${m.moneda}).`,
      m.id,
      { sucursalId: destino.sucursalId }
    );
    return { ok: true, estado: "CON_INCIDENCIA" };
  }
  const tipo = S.tipos.get().find((t) => t.id === m.tipoId);
  asentar({
    cajaId: destino.id,
    tipo: tipo?.descripcion ?? "Movimiento de tesorería",
    descripcion: `Recepción de ${origenTexto(m)}`,
    comprobante: m.id,
    moneda: m.moneda,
    ingreso: contado,
    refId: m.id,
  });
  const documento = m.extraccion ? `Boleta de extracción ${m.extraccion.boleta}` : firmaId ? `Acta de recepción ${firmaId}` : undefined;
  if (documento) {
    actualizarMovimiento(id, {
      estado: "FINALIZADO",
      recepcion,
      finalizacion: { usuarioId: usuarioActual().id, fechaHora: ahoraTexto(), documento, ...(firmaId ? { firmaId } : {}) },
    });
    return { ok: true, estado: "FINALIZADO" };
  }
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
      descripcion: `Recepción de ${origenTexto(m)} · enviado ${m.importe}, integrado ${importeAceptado}`,
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
  // La boleta de depósito documenta el movimiento: queda Finalizado (la acreditación se concilia aparte).
  actualizarMovimiento(id, {
    estado: "FINALIZADO",
    boletaDeposito: boleta.trim(),
    finalizacion: { usuarioId: usuarioActual().id, fechaHora: ahoraTexto(), documento: `Boleta de depósito ${boleta.trim()}` },
  });
  return { ok: true };
}

// Conciliación: la acreditación del depósito se confirma contra el extracto del banco. Se concilia un
// depósito enviado (en tránsito o con boleta cargada) por el importe exacto acreditado.
export function conciliarDeposito(id: string, importe: number, fechaAcreditacion: string, referencia: string): Res {
  const m = movimientoPorId(id);
  const u = usuarioActual();
  if (!m || m.destino.tipo !== "BANCO" || !["EN_TRANSITO", "ACEPTADO", "FINALIZADO"].includes(m.estado) || !m.envio || m.conciliacion)
    return error("El depósito no está pendiente de conciliar.");
  if (!u.roles.includes("TESORERO")) return error("Sólo el Tesorero concilia las acreditaciones.");
  if (!fechaAcreditacion) return error("Ingresá la fecha de acreditación.");
  if (!referencia.trim()) return error("Ingresá la referencia del extracto bancario.");
  if (importe !== m.importe) return error("El importe acreditado no coincide con el depositado: revisalo con el banco antes de conciliar.");
  // Conciliar contra el extracto también documenta el depósito: si todavía no tenía boleta, queda Finalizado.
  actualizarMovimiento(id, {
    estado: "FINALIZADO",
    conciliacion: { usuarioId: u.id, fechaHora: ahoraTexto(), fechaAcreditacion, importe, referencia: referencia.trim() },
    finalizacion: m.finalizacion ?? { usuarioId: u.id, fechaHora: ahoraTexto(), documento: `Extracto bancario ${referencia.trim()}` },
  });
  return { ok: true };
}

export interface SaldoBancario {
  cuentaId: string;
  saldoInicial: number; // con el que la cuenta entra al módulo
  conciliado: number; // acreditaciones conciliadas
  pagado: number; // egresos que ya bajaron el real: transferencias ejecutadas y cheques debitados
  saldo: number; // = real (se conserva el nombre para quienes ya lo usaban)
  real: number; // saldo inicial + conciliado − pagado
  comprometido: number; // reservas activas (transferencias preparadas, cheques emitidos)
  estimado: number; // real − comprometido: el saldo que manda
  aRecibir: number; // enviado al banco y todavía sin conciliar (informativo)
  enTransito: number; // igual que aRecibir
}

// Posición de cada cuenta bancaria (v4, R3): real, comprometido, estimado y a recibir. Ningún egreso se
// aprueba por encima del estimado, así que la cuenta no queda en descubierto.
export function saldosBancarios(): SaldoBancario[] {
  const pagos = provStores.pagos.get();
  const cheques = S.cheques.get();
  const reservas = S.reservas.get();
  return S.cuentasBancarias.get().map((c) => {
    const p = posicionBanco(c, S.movimientos.get(), pagos, cheques, reservas);
    return {
      cuentaId: c.id,
      saldoInicial: p.saldoInicial,
      conciliado: p.conciliado,
      pagado: p.pagado,
      saldo: p.real,
      real: p.real,
      comprometido: p.comprometido,
      estimado: p.estimado,
      aRecibir: p.aRecibir,
      enTransito: p.aRecibir,
    };
  });
}

// Posición de una cuenta bancaria con los datos actuales (para validar egresos contra el estimado).
export function posicionDeCuenta(cuentaId: string) {
  const cuenta = S.cuentasBancarias.get().find((c) => c.id === cuentaId);
  if (!cuenta) return { real: 0, comprometido: 0, estimado: 0, aRecibir: 0 };
  return posicionBanco(cuenta, S.movimientos.get(), provStores.pagos.get(), S.cheques.get(), S.reservas.get());
}

// Posición (real, comprometido, estimado, a recibir) de una caja en una moneda, con los datos actuales.
export const posicionDeCaja = (cajaId: string, moneda: Moneda) =>
  posicionCaja(S.libro.get(), S.reservas.get(), S.movimientos.get(), cajaId, moneda);

// Pago en efectivo a un proveedor desde una caja. Sale del libro y exige lo mismo que cualquier operación
// de caja (responsable, apertura activa, sin bloqueos, dentro del horario) y que el importe no supere el
// saldo estimado (real menos lo comprometido). Se puede registrar otro medio sin mover el efectivo.
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
    if (p.importe > posicionDeCaja(caja.id, "ARS").estimado + 0.001)
      return error("El importe supera el saldo estimado de la caja en pesos (descontado lo ya reservado).");
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
export function resolverPedidoRefuerzo(id: string, aprobar: boolean, importeAprobado: number, nota: string, firmaId?: string): Res<{ movimientoId?: string }> {
  const p = S.pedidos.get().find((x) => x.id === id);
  const aCaja = p && cajaPorId(p.aCajaId);
  const u = usuarioActual();
  if (!p || !aCaja || p.estado !== "PENDIENTE") return error("El pedido ya fue resuelto.");
  if (!esResponsable(aCaja, u.id)) return error("Sólo un responsable del tesoro que recibe el pedido puede resolverlo.");
  if (!aprobar && !nota.trim()) return error("Indicá el motivo del rechazo.");
  const resolucion = { usuarioId: u.id, fechaHora: ahoraTexto(), nota, ...(firmaId ? { firmaId } : {}) };
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
  if (!alcanzaElEstimado(posicionDeCaja(p.aCajaId, p.moneda), importeAprobado)) return error("El tesoro no tiene saldo estimado suficiente para ese importe.");
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

// El cierre diario (controles, ventana de ajuste, acta con doble firma y reapertura) vive en
// cierre-diario.ts; acá sólo queda el bloqueo de la fecha cerrada (ver `bloqueoCaja`).

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
