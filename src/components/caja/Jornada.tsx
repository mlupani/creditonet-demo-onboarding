"use client";

import { useState } from "react";
import { aMinutos, esSupervisor, jornadaVigente } from "@/lib/caja-reglas";
import { pendientesDeCaja, registrarApertura, registrarCierre, resolverApertura, resolverCierre, nombreCaja, type Res } from "@/lib/caja-operaciones";
import { hoy, nombreUsuario, useCajaDatos } from "@/lib/caja-store";
import { ESTADO_JORNADA_LABEL, monedasDe, type Caja, type Jornada, type MovimientoCaja } from "@/lib/caja-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ActaDatos, ActaFirmas, ActaModal, ActaRecuento } from "./Acta";
import { FlujoRecuento } from "./RecuentoForm";
import { NotaModal, PaginaCaja, SelectorCaja, cajasPropias, dinero } from "./comunes";

const MARGEN_ALERTA_MIN = 30;
export const aError = (r: Res): string | null => (r.ok ? null : r.error);

const TONO_ESTADO: Record<Jornada["estado"], "success" | "warning" | "neutral"> = {
  ABIERTA: "success",
  PEND_APERTURA: "warning",
  PEND_CIERRE: "warning",
  CERRADA: "neutral",
};

function ActaJornada({ jornada, caja, etapa, onClose }: { jornada: Jornada; caja: Caja; etapa: "apertura" | "cierre"; onClose: () => void }) {
  const recuento = etapa === "apertura" ? jornada.apertura : jornada.cierre;
  if (!recuento) return null;
  return (
    <ActaModal open onClose={onClose} titulo={`Acta de ${etapa} de caja`}>
      <h1 className="text-lg font-bold">Acta de {etapa} de caja</h1>
      <ActaDatos
        filas={[
          ["Caja", `${caja.nombre} (${caja.id})`],
          ["Fecha", jornada.fecha],
          ["Jornada", jornada.id],
          ["Responsable", nombreUsuario(recuento.usuarioId)],
        ]}
      />
      <ActaRecuento caja={caja} titulo={etapa === "apertura" ? "Recuento de apertura" : "Recuento de cierre"} recuento={recuento} />
      <ActaFirmas firmas={[`Responsable: ${nombreUsuario(recuento.usuarioId)}`, `Supervisor: ${recuento.aprobacion ? nombreUsuario(recuento.aprobacion.supervisorId) : "no requerido"}`]} />
    </ActaModal>
  );
}

function Pendiente({ jornada, etapa }: { jornada: Jornada; etapa: "apertura" | "cierre" }) {
  const { cajas } = useCajaDatos();
  const caja = cajas.find((c) => c.id === jornada.cajaId);
  const recuento = etapa === "apertura" ? jornada.apertura : jornada.cierre;
  const [accion, setAccion] = useState<"aprobar" | "rechazar" | null>(null);
  if (!caja || !recuento) return null;
  const resolver = etapa === "apertura" ? resolverApertura : resolverCierre;
  return (
    <div className="rounded-xl border border-warning-200 bg-warning-50 p-4">
      <p className="text-sm font-semibold text-ink-900">
        {caja.nombre} · {etapa === "apertura" ? "Apertura" : "Cierre"} cargada por {nombreUsuario(recuento.usuarioId)} ({recuento.fechaHora})
      </p>
      <ul className="mt-2 space-y-1 text-sm text-ink-700">
        {monedasDe(caja.moneda).map((m) => {
          const ajuste = recuento.ajustes.find((a) => a.moneda === m);
          return (
            <li key={m}>
              {m}: contado {dinero(m, recuento.contado[m])}, esperado {dinero(m, recuento.esperado[m])}, diferencia {dinero(m, recuento.diferencia[m])}
              {ajuste && ` · motivo ${ajuste.motivoId}${ajuste.nota ? ` (${ajuste.nota})` : ""}`}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="success" onClick={() => setAccion("aprobar")}>
          Aprobar
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAccion("rechazar")}>
          Rechazar
        </Button>
      </div>
      <NotaModal
        open={accion !== null}
        titulo={accion === "aprobar" ? "Aprobar la diferencia" : "Rechazar y repetir el recuento"}
        descripcion={accion === "aprobar" ? "La diferencia aprobada genera un movimiento de ajuste en el libro." : "Se repite el recuento."}
        etiquetaNota={accion === "rechazar" ? "Motivo del rechazo" : "Nota (opcional)"}
        requerida={accion === "rechazar"}
        confirmar={accion === "aprobar" ? "Aprobar" : "Rechazar"}
        tono={accion === "aprobar" ? "success" : "danger"}
        onClose={() => setAccion(null)}
        onConfirmar={(nota) => aError(resolver(jornada.id, accion === "aprobar", nota))}
      />
    </div>
  );
}

function ResumenDia({ caja, libro }: { caja: Caja; libro: MovimientoCaja[] }) {
  const delDia = libro.filter((m) => m.cajaId === caja.id && m.fecha === hoy());
  const pendientes = pendientesDeCaja(caja.id);
  return (
    <div className="mb-5 space-y-3">
      <div className="rounded-xl border border-ink-200 p-4">
        <h3 className="text-sm font-semibold text-ink-900">Movimientos del día</h3>
        {delDia.length === 0 ? (
          <p className="mt-1 text-sm text-ink-500">Todavía no hay movimientos hoy.</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <tbody className="divide-y divide-ink-100">
              {delDia.map((m) => (
                <tr key={m.id}>
                  <td className="py-1.5 pr-3 tabular-nums text-ink-500">{m.hora}</td>
                  <td className="py-1.5 pr-3 text-ink-800">{m.tipo} · {m.descripcion}</td>
                  <td className="py-1.5 text-right tabular-nums text-ink-900">{m.ingreso > 0 ? `+${dinero(m.moneda, m.ingreso)}` : `−${dinero(m.moneda, m.egreso)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {pendientes.length > 0 && (
        <Banner tone="warning" title="Hay movimientos de tesorería sin cerrar">
          {pendientes.map((p) => `${p.id} (${p.estado.toLowerCase().replace("_", " ")})`).join(", ")}. Conviene resolverlos antes del cierre.
        </Banner>
      )}
    </div>
  );
}

export function PantallaJornada({ modo }: { modo: "apertura" | "cierre" }) {
  const { cajas, jornadas, libro, usuario, hora } = useCajaDatos();
  const propias = cajasPropias(cajas, usuario);
  const [elegida, setElegida] = useState("");
  const cajaId = propias.some((c) => c.id === elegida) ? elegida : (propias[0]?.id ?? "");
  const caja = propias.find((c) => c.id === cajaId);
  const [actaDe, setActaDe] = useState<{ cajaId: string; etapa: "apertura" | "cierre" } | null>(null);
  const acta = actaDe?.cajaId === cajaId ? actaDe.etapa : null;

  const jornadaHoy = jornadas.filter((j) => j.cajaId === cajaId && j.fecha === hoy()).at(-1);
  const vigente = jornadaVigente(jornadas, cajaId);
  const jornada = vigente ?? jornadaHoy;
  const supervisa = esSupervisor(usuario);
  const pendientes = jornadas.filter((j) => j.estado === (modo === "apertura" ? "PEND_APERTURA" : "PEND_CIERRE"));
  const sinCerrar = caja && vigente?.estado === "ABIERTA" && aMinutos(hora) > aMinutos(caja.horarioHasta) + MARGEN_ALERTA_MIN;

  const esApertura = modo === "apertura";
  const puedeCargar = esApertura ? !jornada : jornada?.estado === "ABIERTA";

  return (
    <PaginaCaja
      titulo={esApertura ? "Apertura de caja" : "Cierre de caja"}
      descripcion={
        esApertura
          ? "Inicio del día con recuento ciego por denominación y control de diferencias contra el saldo del último cierre."
          : "Cierre definitivo del día con recuento ciego. El saldo esperado es la apertura más los ingresos y menos los egresos del día."
      }
    >
      {supervisa && pendientes.length > 0 && (
        <Card className="mb-6">
          <CardHeader title={esApertura ? "Aperturas pendientes de autorización" : "Cierres pendientes de autorización"} description="Quien aprueba no puede ser quien cargó el recuento." />
          <div className="space-y-3 p-5">
            {pendientes.map((j) => (
              <Pendiente key={j.id} jornada={j} etapa={modo} />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title={caja ? caja.nombre : "Elegí tu caja"} description={caja ? `Horario operativo ${caja.horarioDesde} a ${caja.horarioHasta}` : undefined} action={propias.length > 1 ? <SelectorCaja cajas={propias} valor={cajaId} onChange={setElegida} label="Mi caja" /> : undefined} />
        <div className="p-5">
          {!caja ? (
            <Banner tone="info">
              {usuario.nombre} no tiene cajas asignadas en Parámetros. Cambiá el usuario en «Actuar como»{supervisa ? ", o resolvé las autorizaciones pendientes de arriba" : ""}.
            </Banner>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="text-sm text-ink-600">Estado de hoy:</span>
                {jornada ? (
                  <StatusBadge tone={TONO_ESTADO[jornada.estado]}>{ESTADO_JORNADA_LABEL[jornada.estado]}</StatusBadge>
                ) : (
                  <StatusBadge tone="neutral">Sin abrir</StatusBadge>
                )}
                {jornada && (
                  <span className="text-sm text-ink-500">
                    Turno en curso: {nombreUsuario(jornada.turnoUsuarioId)}
                  </span>
                )}
                {jornada && (esApertura || jornada.cierre) && (
                  <Button size="sm" variant="outline" onClick={() => setActaDe({ cajaId, etapa: esApertura ? "apertura" : "cierre" })}>
                    Ver acta de {modo}
                  </Button>
                )}
              </div>

              {sinCerrar && (
                <Banner tone="warning" title="Caja sin cerrar" className="mb-4">
                  Pasó la hora de fin ({caja.horarioHasta}) más {MARGEN_ALERTA_MIN} minutos y la caja sigue abierta: se avisa al tesorero y al supervisor. Todavía se puede cerrar, pero ya no admite operaciones.
                </Banner>
              )}

              {!esApertura && jornada?.estado === "ABIERTA" && <ResumenDia caja={caja} libro={libro} />}

              {puedeCargar ? (
                <FlujoRecuento
                  key={`${modo}-${cajaId}-${jornada?.id ?? "nueva"}-${jornada?.rechazos.length ?? 0}`}
                  caja={caja}
                  confirmar={esApertura ? "Registrar apertura" : "Registrar cierre"}
                  onConfirmar={(detalle, ajustes) => aError((esApertura ? registrarApertura : registrarCierre)(caja.id, { detalle, ajustes }))}
                />
              ) : jornada ? (
                <Banner tone={jornada.estado === "ABIERTA" ? "success" : "info"} title={ESTADO_JORNADA_LABEL[jornada.estado]}>
                  {esApertura && jornada.estado === "ABIERTA" && "La caja ya está abierta: puede operar."}
                  {esApertura && jornada.estado === "PEND_APERTURA" && "La caja no puede operar hasta que un supervisor apruebe la diferencia."}
                  {!esApertura && jornada.estado === "PEND_CIERRE" && "Esperando que un supervisor apruebe la diferencia de cierre."}
                  {jornada.estado === "CERRADA" && `La caja se cerró hoy (${nombreCaja(jornada.cajaId)}): el cierre es definitivo y se bloquearon los movimientos de la fecha.`}
                </Banner>
              ) : null}
            </>
          )}
        </div>
      </Card>
      {acta && jornada && caja && <ActaJornada jornada={jornada} caja={caja} etapa={acta} onClose={() => setActaDe(null)} />}
    </PaginaCaja>
  );
}
