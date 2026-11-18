"use client";

import { useState } from "react";
import { esSupervisor, jornadaVigente, puedeAprobar } from "@/lib/caja-reglas";
import {
  cancelarCambioTurno,
  cargarArqueoRelevo,
  recibirTurno,
  resolverIncidenciaRelevo,
  resolverRelevo,
  solicitarCambioTurno,
} from "@/lib/caja-operaciones";
import { hoy, nombreUsuario, useCajaDatos } from "@/lib/caja-store";
import { monedasDe, type CambioTurno, type Caja, type DetalleRecuento, type Jornada, type UsuarioCaja } from "@/lib/caja-tipos";
import { saldosCaja } from "@/lib/caja-reglas";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { aError } from "./Jornada";
import { FlujoRecuento, RecuentoForm } from "./RecuentoForm";
import { CLASE_INPUT, ErrorBanner, NotaModal, PaginaCaja, SelectorCaja, dinero, dineroConSigno } from "./comunes";

const PASOS = ["Solicitud y corte", "Arqueo de relevo", "Autorización", "Recepción", "Completado"];

function pasoActual(c: CambioTurno): number {
  switch (c.estado) {
    case "SOLICITADO":
      return 1;
    case "PEND_AUTORIZACION":
      return 2;
    case "PEND_RECEPCION":
    case "CON_INCIDENCIA":
      return 3;
    case "COMPLETADO":
      return 4;
  }
}

function Pasos({ cambio }: { cambio: CambioTurno }) {
  const actual = pasoActual(cambio);
  const sinAutorizacion = !cambio.resolucion && cambio.estado !== "PEND_AUTORIZACION";
  return (
    <ol className="flex flex-wrap gap-2">
      {PASOS.map((p, i) => (
        <li
          key={p}
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            i < actual
              ? "border-success-200 bg-success-50 text-success-700"
              : i === actual
                ? "border-brand-300 bg-brand-50 text-brand-700"
                : "border-ink-200 text-ink-400"
          } ${i === 2 && sinAutorizacion && i < actual ? "opacity-60" : ""}`}
        >
          {i + 1}. {p}
          {i === 2 && sinAutorizacion && i < actual ? " (no hizo falta)" : ""}
        </li>
      ))}
    </ol>
  );
}

function Relevo({ cambio, caja, usuario }: { cambio: CambioTurno; caja: Caja; usuario: UsuarioCaja }) {
  const { libro } = useCajaDatos();
  const [detalle, setDetalle] = useState<DetalleRecuento>({});
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [accion, setAccion] = useState<"aprobar" | "rechazar" | "incidencia" | null>(null);
  const saliente = usuario.id === cambio.salienteId;
  const entrante = usuario.id === cambio.entranteId;
  const monedas = monedasDe(caja.moneda);

  return (
    <div className="space-y-4">
      <Pasos cambio={cambio} />
      <p className="text-sm text-ink-600">
        Saliente: <strong>{nombreUsuario(cambio.salienteId)}</strong> · Entrante: <strong>{nombreUsuario(cambio.entranteId)}</strong> · Corte: {cambio.corte}. La caja está bloqueada hasta completar el relevo.
      </p>

      {cambio.arqueo && (
        <div className="rounded-lg border border-ink-200 p-3 text-sm">
          <p className="font-semibold text-ink-900">Arqueo de relevo ({cambio.arqueo.fechaHora})</p>
          <ul className="mt-1 text-ink-700">
            {monedas.map((m) => (
              <li key={m}>
                {m}: contado {dinero(m, cambio.arqueo!.contado[m])} · esperado {dinero(m, cambio.arqueo!.esperado[m])} · diferencia {dineroConSigno(m, cambio.arqueo!.diferencia[m])}
                {cambio.arqueo!.ajustes.find((a) => a.moneda === m) && " · atribuida al cajero saliente"}
              </li>
            ))}
          </ul>
        </div>
      )}

      {cambio.estado === "SOLICITADO" &&
        (saliente ? (
          <div>
            <p className="mb-3 text-sm text-ink-600">Arqueo de relevo ciego por moneda y denominación, contra el saldo esperado del turno.</p>
            <FlujoRecuento key={`${cambio.id}-${cambio.resolucion?.fechaHora ?? ""}`} caja={caja} confirmar="Registrar arqueo de relevo" onConfirmar={(d, a) => aError(cargarArqueoRelevo(cambio.id, { detalle: d, ajustes: a }))} />
          </div>
        ) : (
          <Banner tone="info">Esperando el arqueo de relevo de {nombreUsuario(cambio.salienteId)}.</Banner>
        ))}

      {cambio.estado === "SOLICITADO" && cambio.resolucion?.resultado === "RECHAZADA" && (
        <Banner tone="warning" title="El supervisor rechazó el arqueo">
          {cambio.resolucion.nota} — se repite el arqueo de relevo.
        </Banner>
      )}

      {cambio.estado === "PEND_AUTORIZACION" &&
        (esSupervisor(usuario) && puedeAprobar(usuario, cambio.salienteId) ? (
          <div className="flex gap-2">
            <Button variant="success" onClick={() => setAccion("aprobar")}>
              Aprobar diferencia
            </Button>
            <Button variant="outline" onClick={() => setAccion("rechazar")}>
              Rechazar
            </Button>
          </div>
        ) : (
          <Banner tone="warning">Hay una diferencia mayor a la tolerancia: la tiene que aprobar un supervisor distinto del cajero saliente.</Banner>
        ))}

      {cambio.estado === "PEND_RECEPCION" &&
        (entrante ? (
          <div>
            <p className="mb-3 text-sm text-ink-600">
              Contá el saldo real ya ajustado y aceptá. Si tu recuento no coincide con lo declarado por el saliente, no se acepta y se abre una incidencia.
            </p>
            <RecuentoForm monedas={monedas} detalle={detalle} onChange={setDetalle} ayuda={Object.fromEntries(monedas.map((m) => [m, saldosCaja(libro, caja)[m]]))} />
            <Button
              className="mt-4"
              onClick={() => {
                const r = recibirTurno(cambio.id, detalle);
                setError(aError(r));
                setMensaje(r.ok && r.estado === "CON_INCIDENCIA" ? "Tu recuento no coincide con lo declarado: se abrió una incidencia para el supervisor." : null);
                if (r.ok) setDetalle({});
              }}
            >
              Contar y aceptar el saldo
            </Button>
          </div>
        ) : (
          <Banner tone="info">Esperando que {nombreUsuario(cambio.entranteId)} cuente y acepte el saldo.</Banner>
        ))}

      {cambio.estado === "CON_INCIDENCIA" && (
        <Banner tone="error" title="Incidencia en la recepción">
          El recuento del entrante no coincide con lo declarado por el saliente.{" "}
          {esSupervisor(usuario) && puedeAprobar(usuario, cambio.salienteId) && usuario.id !== cambio.entranteId ? (
            <Button size="sm" className="ml-2" onClick={() => setAccion("incidencia")}>
              Resolver incidencia
            </Button>
          ) : (
            "La resuelve un supervisor ajeno al relevo."
          )}
        </Banner>
      )}

      {saliente && (
        <Button variant="ghost" onClick={() => setError(aError(cancelarCambioTurno(cambio.id)))}>
          Cancelar el relevo
        </Button>
      )}
      {mensaje && <Banner tone="warning">{mensaje}</Banner>}
      <ErrorBanner error={error} />

      <NotaModal
        open={accion === "aprobar" || accion === "rechazar"}
        titulo={accion === "aprobar" ? "Aprobar la diferencia" : "Rechazar el arqueo de relevo"}
        descripcion={accion === "aprobar" ? "La diferencia queda atribuida al cajero saliente." : "El saliente repite el arqueo."}
        etiquetaNota={accion === "rechazar" ? "Motivo del rechazo" : "Nota (opcional)"}
        requerida={accion === "rechazar"}
        confirmar={accion === "aprobar" ? "Aprobar" : "Rechazar"}
        tono={accion === "aprobar" ? "success" : "danger"}
        onClose={() => setAccion(null)}
        onConfirmar={(nota) => aError(resolverRelevo(cambio.id, accion === "aprobar", nota))}
      />
      <NotaModal
        open={accion === "incidencia"}
        titulo="Resolver la incidencia"
        descripcion="Dejá constancia de la revisión: el entrante vuelve a contar y aceptar."
        etiquetaNota="Resolución"
        requerida
        confirmar="Resolver"
        onClose={() => setAccion(null)}
        onConfirmar={(nota) => aError(resolverIncidenciaRelevo(cambio.id, nota))}
      />
    </div>
  );
}

function NuevoRelevo({ caja, jornada, usuario }: { caja: Caja; jornada: Jornada; usuario: UsuarioCaja }) {
  const posibles = caja.cajeros.filter((c) => c.estado === "ACTIVO" && c.usuarioId !== usuario.id);
  const [entrante, setEntrante] = useState("");
  const [error, setError] = useState<string | null>(null);
  const elegido = posibles.some((p) => p.usuarioId === entrante) ? entrante : (posibles[0]?.usuarioId ?? "");
  if (jornada.turnoUsuarioId !== usuario.id)
    return <Banner tone="info">El turno en curso es de {nombreUsuario(jornada.turnoUsuarioId)}: sólo ese cajero puede pedir el relevo.</Banner>;
  if (posibles.length === 0) return <Banner tone="warning">La caja no tiene otro cajero asignado para recibir el turno.</Banner>;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-400">Cajero entrante</span>
        <select value={elegido} onChange={(e) => setEntrante(e.target.value)} aria-label="Cajero entrante" className={`${CLASE_INPUT} w-64`}>
          {posibles.map((p) => (
            <option key={p.usuarioId} value={p.usuarioId}>
              {nombreUsuario(p.usuarioId)} · {p.desde} a {p.hasta}
            </option>
          ))}
        </select>
      </label>
      <Button onClick={() => setError(aError(solicitarCambioTurno(caja.id, elegido)))}>Solicitar cambio de turno</Button>
      <ErrorBanner error={error} />
    </div>
  );
}

export function PantallaTurno() {
  const { cajas, jornadas, cambiosTurno, usuario } = useCajaDatos();
  const abiertas = cajas.filter((c) => c.estado === "ACTIVO" && (jornadaVigente(jornadas, c.id) || cambiosTurno.some((t) => t.cajaId === c.id && t.estado !== "COMPLETADO")));
  const visibles = esSupervisor(usuario) ? abiertas : abiertas.filter((c) => c.tesoreroId === usuario.id || c.cajeros.some((x) => x.usuarioId === usuario.id));
  const [elegida, setElegida] = useState("");
  const cajaId = visibles.some((c) => c.id === elegida) ? elegida : (visibles[0]?.id ?? "");
  const caja = visibles.find((c) => c.id === cajaId);
  const jornada = caja ? jornadaVigente(jornadas, caja.id) : undefined;
  const cambio = cambiosTurno.find((t) => t.cajaId === cajaId && t.estado !== "COMPLETADO");
  const historial = cambiosTurno.filter((t) => t.cajaId === cajaId && t.estado === "COMPLETADO" && t.fin?.startsWith(hoy()));

  return (
    <PaginaCaja titulo="Cambio de turno" descripcion="Relevo entre cajeros con arqueo de corte. Cada cajero responde por su turno y la caja sigue abierta hasta el cierre definitivo.">
      <Card>
        <CardHeader title={caja ? caja.nombre : "Cambio de turno"} action={visibles.length > 1 ? <SelectorCaja cajas={visibles} valor={cajaId} onChange={setElegida} /> : undefined} />
        <div className="space-y-5 p-5">
          {!caja || !jornada ? (
            <Banner tone="info">No hay cajas abiertas visibles para {usuario.nombre}. Abrí una caja desde «Apertura de caja» o cambiá el usuario en «Actuar como».</Banner>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm text-ink-700">
                <StatusBadge tone="success">Abierta</StatusBadge>
                Turno en curso: <strong>{nombreUsuario(jornada.turnoUsuarioId)}</strong> · Modalidad de relevo: {caja.relevo === "DIRECTO" ? "directo, con doble confirmación" : "por tesoro"}
              </div>
              {cambio ? <Relevo key={cambio.id} cambio={cambio} caja={caja} usuario={usuario} /> : <NuevoRelevo caja={caja} jornada={jornada} usuario={usuario} />}
            </>
          )}
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Relevos de hoy" />
        {historial.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-ink-400">Todavía no hubo relevos completados hoy en esta caja.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {historial.map((t) => (
              <li key={t.id} className="px-5 py-3 text-sm text-ink-700">
                <span className="font-mono text-xs font-bold text-brand-700">{t.id}</span> · {nombreUsuario(t.salienteId)} → {nombreUsuario(t.entranteId)} · corte {t.corte}, fin {t.fin}
                {t.resolucion && ` · aprobado por ${nombreUsuario(t.resolucion.supervisorId)}`}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PaginaCaja>
  );
}
