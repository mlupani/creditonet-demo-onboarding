// Alertas por mail simuladas (R4, 7.17 y anexo). Toda contingencia dispara un mail a los roles
// configurados; en la demo no sale ningún mail real: queda registrado en la bandeja de salida
// (pantalla "Alertas enviadas"). La configuración de destinatarios y plazos se edita en Parámetros.

import { USUARIOS_CAJA } from "./caja-datos";
import { aMinutos, arqueoVencido, cierreVigente, jornadaVigente, saldosCaja } from "./caja-reglas";
import { ahoraTexto, cajaStores as S, horaActual, hoy, siguienteId } from "./caja-store";
import { SIMBOLO, monedasDe } from "./caja-tipos";
import { controlStores, plazosControl } from "./control-store";
import { EVENTO_ALERTA_LABEL, type AlertaEnviada, type DestinatarioAlerta, type EventoAlerta } from "./control-tipos";

const SIEMPRE_GLOBALES = new Set(["DIRECTOR", "TESORERO_CENTRAL"]);

// Usuarios que reciben el evento: los de los roles configurados. Director y Tesorero central reciben
// de todas las sucursales; el resto, los de la sucursal del evento (si ninguno coincide, todos los del rol).
export function destinatariosDe(evento: EventoAlerta, sucursalId?: string): DestinatarioAlerta[] {
  const config = controlStores.alertasConfig.get().find((c) => c.evento === evento && c.estado === "ACTIVO");
  if (!config) return [];
  const resultado: DestinatarioAlerta[] = [];
  for (const rol of config.destinatarios) {
    const delRol = USUARIOS_CAJA.filter((u) => u.roles.includes(rol));
    const locales = !SIEMPRE_GLOBALES.has(rol) && sucursalId ? delRol.filter((u) => u.sucursalId === sucursalId) : delRol;
    for (const u of locales.length > 0 ? locales : delRol)
      if (!resultado.some((d) => d.usuarioId === u.id)) resultado.push({ usuarioId: u.id, rol });
  }
  return resultado;
}

export interface OpcionesAlerta {
  sucursalId?: string;
  // No repite el aviso del mismo evento y referencia en la misma fecha.
  unica?: boolean;
}

// Registra el mail en la bandeja de salida. Devuelve null si la alerta está suspendida en Parámetros o
// ya se había avisado (con `unica`).
export function emitirAlerta(evento: EventoAlerta, detalle: string, referencia?: string, opciones: OpcionesAlerta = {}): AlertaEnviada | null {
  const config = controlStores.alertasConfig.get().find((c) => c.evento === evento);
  if (!config || config.estado !== "ACTIVO") return null;
  const enviadas = controlStores.alertasEnviadas.get();
  const fecha = ahoraTexto().slice(0, 10);
  if (opciones.unica && enviadas.some((a) => a.evento === evento && a.referencia === referencia && a.fechaHora.slice(0, 10) === fecha)) return null;
  const alerta: AlertaEnviada = {
    id: siguienteId("ALE", enviadas.map((a) => a.id), 4),
    evento,
    asunto: `[CreditoNet] ${EVENTO_ALERTA_LABEL[evento]}`,
    detalle,
    destinatarios: destinatariosDe(evento, opciones.sucursalId),
    fechaHora: ahoraTexto(),
    referencia,
    sucursalId: opciones.sucursalId,
  };
  controlStores.alertasEnviadas.commit([...enviadas, alerta]);
  return alerta;
}

const sumarDias = (fecha: string, dias: number) => {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Revisa las condiciones que dependen del tiempo (no de una operación): caja sin cerrar, arqueo vencido,
// importe máximo superado, sucursal sin cierre diario y acuerdos por vencer. Cada aviso se manda una
// sola vez por fecha. Devuelve cuántas alertas nuevas se emitieron.
export function revisarAlertas(): number {
  const fecha = hoy();
  const hora = aMinutos(horaActual());
  const plazos = plazosControl();
  const cajas = S.cajas.get().filter((c) => c.estado === "ACTIVO");
  let n = 0;
  const emitir = (...a: Parameters<typeof emitirAlerta>) => {
    if (emitirAlerta(a[0], a[1], a[2], { ...a[3], unica: true })) n += 1;
  };

  for (const c of cajas) {
    const j = jornadaVigente(S.jornadas.get(), c.id);
    const margen = c.margenAlertaMin ?? plazos.margenCajaSinCerrarMin;
    if (j && (j.fecha < fecha || hora > aMinutos(c.horarioHasta) + margen))
      emitir("CAJA_SIN_CERRAR", `${c.nombre} sigue abierta pasada la hora de fin (${c.horarioHasta}) más ${margen} minutos de margen.`, j.id, { sucursalId: c.sucursalId });
    if (arqueoVencido(c, S.arqueos.get(), fecha))
      emitir("ARQUEO_VENCIDO", `${c.nombre} no tiene un arqueo ordinario dentro de su frecuencia configurada.`, c.id, { sucursalId: c.sucursalId });
    const saldos = saldosCaja(S.libro.get(), c);
    for (const m of monedasDe(c.moneda))
      if (c.importeMaximo[m] > 0 && saldos[m] > c.importeMaximo[m])
        emitir(
          "IMPORTE_MAXIMO_SUPERADO",
          `${c.nombre} supera su importe máximo: saldo ${SIMBOLO[m]} ${saldos[m].toLocaleString("es-AR")} sobre ${SIMBOLO[m]} ${c.importeMaximo[m].toLocaleString("es-AR")}.`,
          `${c.id}-${m}`,
          { sucursalId: c.sucursalId }
        );
  }

  if (hora > aMinutos(plazos.horaLimiteCierreDiario))
    for (const s of S.sucursales.get().filter((x) => x.estado === "ACTIVO")) {
      const tieneCajas = cajas.some((c) => c.sucursalId === s.id);
      if (tieneCajas && !cierreVigente(S.cierresSucursal.get(), s.id, fecha))
        emitir("SUCURSAL_SIN_CIERRE_DIARIO", `${s.nombre} no cerró la fecha operativa ${fecha} a la hora límite (${plazos.horaLimiteCierreDiario}).`, `${s.id}-${fecha}`, { sucursalId: s.id });
    }

  const limite = sumarDias(fecha, plazos.diasAvisoAcuerdos);
  for (const a of S.acuerdos.get())
    if (a.estado === "ACTIVO" && a.vencimiento >= fecha && a.vencimiento <= limite)
      emitir("ACUERDO_POR_VENCER", `El acuerdo ${a.id} vence el ${a.vencimiento} (aviso con ${plazos.diasAvisoAcuerdos} días).`, a.id);

  return n;
}
