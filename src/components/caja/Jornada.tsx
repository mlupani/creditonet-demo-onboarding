"use client";

import { useState } from "react";
import { aMinutos, esSupervisor, jornadaVigente } from "@/lib/caja-reglas";
import { pendientesDeCaja, registrarApertura, registrarCierre, resolverApertura, resolverCierre, nombreCaja, type Res } from "@/lib/caja-operaciones";
import { actaDe as actaDeEvento } from "@/lib/actas";
import { hoy, nombreUsuario, useActas, useCajaDatos, useCheques, useMotivosDiferencia } from "@/lib/caja-store";
import { ESTADO_JORNADA_LABEL, monedasDe, type Caja, type ConteoValores, type Jornada, type MovimientoCaja } from "@/lib/caja-tipos";
import { registrarConteoValores } from "@/lib/cheques-operaciones";
import { enCustodia, totalPorMoneda } from "@/lib/cheques-reglas";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ActaDatos, ActaFirmas, ActaModal, ActaRecuento } from "./Acta";
import { ActaPanel } from "./ActaPanel";
import { EntregaCierre } from "./EntregaCierre";
import { FlujoRecuento } from "./RecuentoForm";
import { Campo, INPUT_COMPACTO, PanelVentana, Pill, Td, TablaCompacta, type Fase } from "./compacto";
import { ErrorBanner, NotaModal, PaginaCaja, SelectorCaja, cajasPropias, datosDiferencia, dinero } from "./comunes";

const MARGEN_ALERTA_MIN = 30;
export const aError = (r: Res): string | null => (r.ok ? null : r.error);

const FASE_ESTADO: Record<Jornada["estado"], Fase> = {
  ABIERTA: "ok",
  PEND_APERTURA: "espera",
  PEND_CIERRE: "espera",
  CERRADA: "inicial",
};

const textoConteo = (c: ConteoValores) =>
  `${c.declarados} contados de ${c.esperados} en custodia${c.conforme ? " (conforme)" : ` · diferencia: ${c.observacion ?? ""}`}`;

// Cheques y valores en custodia: se cuentan aparte del efectivo y no cambian su diferencia ni bloquean
// la apertura o el cierre. Si lo contado no coincide con el sistema queda la observación en la jornada.
function ValoresEnCustodia({ caja, jornada, etapa }: { caja: Caja; jornada: Jornada | undefined; etapa: "apertura" | "cierre" }) {
  const cheques = useCheques();
  const lista = enCustodia(caja.id, cheques);
  const totales = totalPorMoneda(lista);
  const conteo = etapa === "apertura" ? jornada?.valoresApertura : jornada?.valoresCierre;
  const [declarados, setDeclarados] = useState("");
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const puedeContar = jornada && (etapa === "apertura" || jornada.estado === "ABIERTA" || jornada.estado === "PEND_CIERRE" || jornada.estado === "CERRADA");
  if (lista.length === 0 && !conteo) return null;
  const monedas = monedasDe(caja.moneda).filter((m) => totales[m] > 0);
  const coincide = declarados !== "" && Number(declarados) === lista.length;
  const registrar = () => {
    if (!jornada) return;
    const r = registrarConteoValores(jornada.id, etapa === "apertura" ? "APERTURA" : "CIERRE", Number(declarados), observacion);
    setError(r.ok ? null : r.error);
  };
  return (
    <PanelVentana titulo="Valores en custodia" className="mt-4">
      <p className="text-xs text-ink-500">Se cuentan por separado del efectivo; no cambian su diferencia ni bloquean el {etapa}.</p>
      <p className="mt-2 text-xs font-semibold text-ink-800">
        {lista.length} {lista.length === 1 ? "cheque" : "cheques"}
        {monedas.length > 0 && ` · ${monedas.map((m) => dinero(m, totales[m])).join(" y ")}`}
      </p>
      {lista.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-[11px] text-ink-500">
          {lista.map((c) => (
            <li key={c.id}>
              {c.id} · {c.banco} {c.numero} · {c.parte} · {dinero(c.moneda, c.importe)} · vence {c.fechaPago}
            </li>
          ))}
        </ul>
      )}
      {conteo ? (
        <Banner tone={conteo.conforme ? "success" : "warning"} title={conteo.conforme ? "Conteo conforme" : "Conteo con diferencia"} className="mt-3">
          {textoConteo(conteo)} · {nombreUsuario(conteo.usuarioId)} ({conteo.fechaHora})
        </Banner>
      ) : puedeContar ? (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Campo label="Cheques contados" className="w-32">
            <input
              type="number"
              min={0}
              value={declarados}
              onChange={(e) => setDeclarados(e.target.value)}
              aria-label="Cheques contados"
              className={INPUT_COMPACTO}
            />
          </Campo>
          {declarados !== "" && !coincide && (
            <Campo label="Observación de la diferencia" className="min-w-64 flex-1">
              <input value={observacion} onChange={(e) => setObservacion(e.target.value)} aria-label="Observación de la diferencia" className={INPUT_COMPACTO} />
            </Campo>
          )}
          <Button size="xs" variant="navyOutline" onClick={registrar} disabled={declarados === ""}>
            {coincide ? "Confirmar conteo" : "Registrar conteo"}
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-500">El conteo se confirma una vez registrada la {etapa}.</p>
      )}
      <ErrorBanner error={error} />
    </PanelVentana>
  );
}

function ActaJornada({ jornada, caja, etapa, onClose }: { jornada: Jornada; caja: Caja; etapa: "apertura" | "cierre"; onClose: () => void }) {
  const recuento = etapa === "apertura" ? jornada.apertura : jornada.cierre;
  const valores = etapa === "apertura" ? jornada.valoresApertura : jornada.valoresCierre;
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
          ...(valores ? [["Valores en custodia", textoConteo(valores)] as [string, string]] : []),
        ]}
      />
      <ActaRecuento caja={caja} titulo={etapa === "apertura" ? "Recuento de apertura" : "Recuento de cierre"} recuento={recuento} />
      <ActaFirmas firmas={[`Responsable: ${nombreUsuario(recuento.usuarioId)}`, `Supervisor: ${
        recuento.aprobacion
          ? nombreUsuario(recuento.aprobacion.supervisorId)
          : recuento.ajustes.length > 0
            ? "pendiente de autorización"
            : "no requerido"
      }`]} />
    </ActaModal>
  );
}

function Pendiente({ jornada, etapa }: { jornada: Jornada; etapa: "apertura" | "cierre" }) {
  const { cajas } = useCajaDatos();
  const caja = cajas.find((c) => c.id === jornada.cajaId);
  const recuento = etapa === "apertura" ? jornada.apertura : jornada.cierre;
  const [accion, setAccion] = useState<"aprobar" | "rechazar" | null>(null);
  const actas = useActas();
  const motivos = useMotivosDiferencia();
  const eventoTipo = etapa === "apertura" ? "JORNADA_APERTURA" : "JORNADA_CIERRE";
  const eventoId = etapa === "apertura" ? jornada.id : `${jornada.id}-C`;
  const tieneActa = !!actaDeEvento(eventoTipo, eventoId, actas);
  if (!caja || !recuento) return null;
  const resolver = etapa === "apertura" ? resolverApertura : resolverCierre;
  return (
    <div className="rounded-lg border border-warning-200 bg-warning-50 p-3">
      <p className="text-xs font-bold text-ink-900">
        {caja.nombre} · {etapa === "apertura" ? "Apertura" : "Cierre"} cargada por {nombreUsuario(recuento.usuarioId)} ({recuento.fechaHora})
      </p>
      <ul className="mt-1.5 space-y-0.5 text-xs text-ink-700">
        {monedasDe(caja.moneda).map((m) => {
          const ajuste = recuento.ajustes.find((a) => a.moneda === m);
          return (
            <li key={m}>
              {m}: contado {dinero(m, recuento.contado[m])}, esperado {dinero(m, recuento.esperado[m])}, diferencia {dinero(m, recuento.diferencia[m])}
              {ajuste && ` · motivo ${motivos.find((x) => x.id === ajuste.motivoId)?.descripcion ?? ajuste.motivoId}${ajuste.nota ? ` (${ajuste.nota})` : ""}`}
            </li>
          );
        })}
      </ul>
      {tieneActa ? (
        <ActaPanel
          eventoTipo={eventoTipo}
          eventoId={eventoId}
          diferencia={recuento.diferencia}
          autorizarLabel={etapa === "apertura" ? "Autorizar y abrir la caja" : "Autorizar el ajuste y cerrar"}
          onAutorizar={(nota, firmaId) => aError(resolver(jornada.id, true, nota, firmaId))}
          onRechazar={(nota, firmaId) => aError(resolver(jornada.id, false, nota, firmaId))}
        />
      ) : (
        <div className="mt-3 flex gap-2">
          <Button size="xs" variant="success" onClick={() => setAccion("aprobar")}>
            Aprobar
          </Button>
          <Button size="xs" variant="dangerOutline" onClick={() => setAccion("rechazar")}>
            Rechazar
          </Button>
        </div>
      )}
      <NotaModal
        open={accion !== null}
        titulo={accion === "aprobar" ? "Aprobar la diferencia" : "Rechazar y repetir el recuento"}
        descripcion={accion === "aprobar" ? "La diferencia aprobada genera un movimiento de ajuste en el libro." : "Se repite el recuento."}
        etiquetaNota={accion === "rechazar" ? "Motivo del rechazo" : "Nota (opcional)"}
        requerida={accion === "rechazar"}
        confirmar={accion === "aprobar" ? "Aprobar" : "Rechazar"}
        tono={accion === "aprobar" ? "success" : "danger"}
        llave={
          accion === "aprobar"
            ? { operacion: `Aprobación de diferencia de ${etapa}`, referencia: jornada.id, cargadoPor: recuento.usuarioId, ...datosDiferencia(recuento.diferencia) }
            : undefined
        }
        onClose={() => setAccion(null)}
        onConfirmar={(nota, firmaId) => aError(resolver(jornada.id, accion === "aprobar", nota, firmaId))}
      />
    </div>
  );
}

function ResumenDia({ caja, libro }: { caja: Caja; libro: MovimientoCaja[] }) {
  const delDia = libro.filter((m) => m.cajaId === caja.id && m.fecha === hoy());
  const pendientes = pendientesDeCaja(caja.id);
  return (
    <div className="mb-4 space-y-3">
      <PanelVentana titulo="Movimientos del día">
        {delDia.length === 0 ? (
          <p className="text-xs text-ink-500">Todavía no hay movimientos hoy.</p>
        ) : (
          <TablaCompacta etiqueta="Movimientos del día" minWidth="min-w-0">
            <tbody>
              {delDia.map((m) => (
                <tr key={m.id}>
                  <Td className="tabular-nums text-ink-500">{m.hora}</Td>
                  <Td>{m.tipo} · {m.descripcion}</Td>
                  <Td derecha className="font-semibold text-ink-900">{m.ingreso > 0 ? `+${dinero(m.moneda, m.ingreso)}` : `−${dinero(m.moneda, m.egreso)}`}</Td>
                </tr>
              ))}
            </tbody>
          </TablaCompacta>
        )}
      </PanelVentana>
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
  // Un acta escalada por una negativa a firmar la resuelve el Tesorero central o el Director.
  const verPendientes = supervisa || usuario.roles.includes("TESORERO_CENTRAL") || usuario.roles.includes("DIRECTOR");
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
      {verPendientes && pendientes.length > 0 && (
        <PanelVentana titulo={`${esApertura ? "Aperturas pendientes de autorización" : "Cierres pendientes de autorización"} · quien aprueba no puede ser quien cargó el recuento`} className="mb-4">
          <div className="space-y-3">
            {pendientes.map((j) => (
              <Pendiente key={j.id} jornada={j} etapa={modo} />
            ))}
          </div>
        </PanelVentana>
      )}

      <PanelVentana
        titulo={caja ? `${caja.nombre} · horario operativo ${caja.horarioDesde} a ${caja.horarioHasta}` : "Elegí tu caja"}
        accion={propias.length > 1 ? <SelectorCaja cajas={propias} valor={cajaId} onChange={setElegida} label="Mi caja" /> : undefined}
      >
        <div>
          {!caja ? (
            <Banner tone="info">
              {usuario.nombre} no tiene cajas asignadas en Parámetros. Cambiá el usuario en «Actuar como»{supervisa ? ", o resolvé las autorizaciones pendientes de arriba" : ""}.
            </Banner>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2.5">
                <span className="text-xs text-ink-600">Estado de hoy:</span>
                {jornada ? (
                  <Pill fase={FASE_ESTADO[jornada.estado]}>{ESTADO_JORNADA_LABEL[jornada.estado]}</Pill>
                ) : (
                  <Pill fase="inicial">Sin abrir</Pill>
                )}
                {jornada && (
                  <span className="text-xs text-ink-500">
                    Turno en curso: {nombreUsuario(jornada.turnoUsuarioId)}
                  </span>
                )}
                {jornada && (esApertura || jornada.cierre) && (
                  <Button size="xs" variant="navyOutline" onClick={() => setActaDe({ cajaId, etapa: esApertura ? "apertura" : "cierre" })}>
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
              {jornada && (jornada.estado === "PEND_APERTURA" || jornada.estado === "PEND_CIERRE") && (
                <ActaPanel
                  eventoTipo={jornada.estado === "PEND_APERTURA" ? "JORNADA_APERTURA" : "JORNADA_CIERRE"}
                  eventoId={jornada.estado === "PEND_APERTURA" ? jornada.id : `${jornada.id}-C`}
                  diferencia={(jornada.estado === "PEND_APERTURA" ? jornada.apertura : jornada.cierre)?.diferencia}
                />
              )}

              <ValoresEnCustodia caja={caja} jornada={jornada} etapa={modo} />
            </>
          )}
        </div>
      </PanelVentana>
      {!esApertura && <EntregaCierre cajaId={cajaId} />}
      {acta && jornada && caja && <ActaJornada jornada={jornada} caja={caja} etapa={acta} onClose={() => setActaDe(null)} />}
    </PaginaCaja>
  );
}
