"use client";

import { useState } from "react";
import { actaPorId, estadoActaTexto } from "@/lib/actas";
import {
  cierreEnCurso,
  estaCerrado,
  estadoCierreDiario,
  minutosDeVentana,
  sucursalesVisibles,
  veTodo,
} from "@/lib/caja-reglas";
import { nombreUsuario, useActas, useAjustesCierre, useCajaDatos } from "@/lib/caja-store";
import {
  ESTADO_CIERRE_DIARIO_LABEL,
  esTesoro,
  monedasDe,
  type AjusteCierre,
  type CierreSucursal,
  type Moneda,
} from "@/lib/caja-tipos";
import {
  abrirVentanaDeAjuste,
  autorizarReaperturaCierre,
  cargarAjusteCierre,
  confirmarCierreDiario,
  controlesDeSucursal,
  iniciarCierreDiario,
  permiteFirmaRemota,
  resolverAjusteCierre,
  solicitarReaperturaCierre,
} from "@/lib/cierre-diario";
import { plazosControl, usePlazos } from "@/lib/control-store";
import type { Firma } from "@/lib/control-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { aError } from "./Jornada";
import { LlaveModal } from "./LlaveModal";
import { Campo, INPUT_COMPACTO, PanelVentana, Pill, TablaCompacta, Td, Th, type Fase } from "./compacto";
import { ErrorBanner, NotaModal, PaginaCaja, dinero, quien } from "./comunes";

type EstadoVisible = keyof typeof ESTADO_CIERRE_DIARIO_LABEL;
const FASE: Record<EstadoVisible, Fase> = {
  ABIERTA: "inicial",
  EN_CONTROLES: "proceso",
  EN_VENTANA: "proceso",
  CERRADA_OK: "ok",
  CERRADA_CON_PENDIENTES: "espera",
  NO_CERRADA: "rechazo",
  REABIERTA: "espera",
};

const textoVentana = (min: number) => (min <= 0 ? "vencida" : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`);

// ---------- Ajustes de la ventana ----------

function AjusteForm({ cierre, onError }: { cierre: CierreSucursal; onError: (e: string | null) => void }) {
  const { cajas, motivos } = useCajaDatos();
  const cajasSuc = cajas.filter((c) => c.sucursalId === cierre.sucursalId && c.estado === "ACTIVO");
  const [cajaId, setCajaId] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("ARS");
  const [importe, setImporte] = useState("");
  const [motivoId, setMotivoId] = useState("");
  const [nota, setNota] = useState("");
  const caja = cajasSuc.find((c) => c.id === (cajaId || cajasSuc[0]?.id));
  const monedas = caja ? monedasDe(caja.moneda) : [];
  const monedaOk = monedas.includes(moneda) ? moneda : (monedas[0] ?? "ARS");
  const activos = motivos.filter((m) => m.estado === "ACTIVO");

  const cargar = () => {
    if (!caja) return onError("Elegí la caja.");
    const e = aError(cargarAjusteCierre({ cierreId: cierre.id, cajaId: caja.id, moneda: monedaOk, importe: Number(importe.replace(",", ".")), motivoId, nota }));
    onError(e);
    if (!e) {
      setImporte("");
      setNota("");
    }
  };

  return (
    <PanelVentana titulo="Cargar un ajuste" className="mt-4">
      <p className="text-xs text-ink-500">
        Un ajuste asienta un movimiento propio en el libro (positivo ingresa a la caja, negativo egresa); nunca edita un movimiento confirmado. Lo autoriza un supervisor con su llave.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField id="aj-caja" label="Caja" value={caja?.id ?? ""} onChange={setCajaId} options={cajasSuc.map((c) => ({ value: c.id, label: c.nombre }))} />
        <SelectField
          id="aj-moneda"
          label="Moneda"
          value={monedaOk}
          onChange={(v) => setMoneda(v as Moneda)}
          options={monedas.map((m) => ({ value: m, label: m === "ARS" ? "Pesos" : "Dólares" }))}
        />
        <Campo label="Importe (con signo)">
          <input
            value={importe}
            onChange={(e) => setImporte(e.target.value.replace(/[^\d.,-]/g, ""))}
            inputMode="decimal"
            aria-label="Importe del ajuste"
            placeholder="-2000"
            className={INPUT_COMPACTO}
          />
        </Campo>
        <SelectField
          id="aj-motivo"
          label="Motivo"
          value={motivoId}
          onChange={setMotivoId}
          placeholder="Elegí el motivo"
          options={activos.map((m) => ({ value: m.id, label: m.descripcion }))}
        />
      </div>
      <FormField id="aj-nota" label="Detalle" value={nota} onChange={setNota} className="mt-3" />
      <div className="mt-3">
        <Button size="sm" variant="navyOutline" onClick={cargar}>
          Cargar el ajuste
        </Button>
      </div>
    </PanelVentana>
  );
}

const FASE_AJUSTE: Record<AjusteCierre["estado"], Fase> = { PENDIENTE: "espera", AUTORIZADO: "ok", RECHAZADO: "rechazo" };

function ListaAjustes({ ajustes, puedeResolver }: { ajustes: AjusteCierre[]; puedeResolver: boolean }) {
  const { cajas, motivos } = useCajaDatos();
  const [resolviendo, setResolviendo] = useState<{ ajuste: AjusteCierre; aprobar: boolean } | null>(null);
  if (ajustes.length === 0) return <p className="text-xs text-ink-500">Todavía no se cargaron ajustes.</p>;
  return (
    <>
      <ul className="divide-y divide-ink-100 rounded-lg border border-ink-300">
        {ajustes.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2.5 px-3 py-2 text-xs">
            <span className="font-mono font-bold text-brand-700">{a.id}</span>
            <span className="text-ink-700">
              {cajas.find((c) => c.id === a.cajaId)?.nombre ?? a.cajaId} · {a.importe > 0 ? "+" : ""}
              {dinero(a.moneda, a.importe)} · {motivos.find((m) => m.id === a.motivoId)?.descripcion ?? a.motivoId}
              {a.nota && ` (${a.nota})`}
            </span>
            <span className="text-ink-500">Cargó {quien(a.cargadoPor)}</span>
            <Pill fase={FASE_AJUSTE[a.estado]}>{a.estado === "PENDIENTE" ? "Pendiente" : a.estado === "AUTORIZADO" ? "Autorizado" : "Rechazado"}</Pill>
            {a.autorizacion && (
              <span className="text-ink-500">
                {quien(a.autorizacion.supervisorId)} · {a.autorizacion.fechaHora}
                {a.libroId && ` · ${a.libroId}`}
              </span>
            )}
            {a.estado === "PENDIENTE" && puedeResolver && (
              <span className="ml-auto flex gap-2">
                <Button size="xs" variant="success" onClick={() => setResolviendo({ ajuste: a, aprobar: true })}>
                  Autorizar
                </Button>
                <Button size="xs" variant="dangerOutline" onClick={() => setResolviendo({ ajuste: a, aprobar: false })}>
                  Rechazar
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <NotaModal
        open={!!resolviendo}
        titulo={resolviendo?.aprobar ? "Autorizar el ajuste" : "Rechazar el ajuste"}
        descripcion={resolviendo?.aprobar ? "Se asienta un movimiento de ajuste en el libro. Firmás con tu llave." : "El ajuste queda sin efecto, con su motivo."}
        etiquetaNota={resolviendo?.aprobar ? "Nota (opcional)" : "Motivo del rechazo"}
        requerida={!resolviendo?.aprobar}
        confirmar={resolviendo?.aprobar ? "Autorizar" : "Rechazar"}
        tono={resolviendo?.aprobar ? "success" : "danger"}
        llave={
          resolviendo?.aprobar
            ? { operacion: "Autorización de ajuste de cierre diario", referencia: resolviendo.ajuste.id, cargadoPor: resolviendo.ajuste.cargadoPor, importe: Math.abs(resolviendo.ajuste.importe), moneda: resolviendo.ajuste.moneda }
            : undefined
        }
        onClose={() => setResolviendo(null)}
        onConfirmar={(nota, firmaId) => (resolviendo ? aError(resolverAjusteCierre(resolviendo.ajuste.id, resolviendo.aprobar, nota, firmaId)) : null)}
      />
    </>
  );
}

// ---------- Acta con doble firma ----------

function ConfirmarCierre({ cierre, justificables }: { cierre: CierreSucursal; justificables: { id: string; label: string; detalle: string }[] }) {
  const [just, setJust] = useState<Record<string, string>>({});
  const [firma1, setFirma1] = useState<Firma | null>(null);
  const [fase, setFase] = useState<"firma1" | "firma2" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const remota = permiteFirmaRemota(cierre.sucursalId, cierre.usuarioId);
  const faltan = justificables.filter((j) => !(just[j.id] ?? "").trim());
  const cerrar = () => {
    setFase(null);
    setFirma1(null);
  };

  return (
    <PanelVentana titulo="Acta de cierre diario" className="mt-4">
      <p className="text-xs text-ink-500">
        Doble firma con llave: el tesorero y un supervisor de la sucursal{remota ? " (la sucursal no tiene otro usuario: la segunda firma es remota, de Casa Central)" : ""}. Con pendientes justificados la fecha queda «Cerrada con pendientes».
      </p>
      {justificables.length > 0 && (
        <div className="mt-3 space-y-3">
          {justificables.map((j) => (
            <FormField
              key={j.id}
              id={`just-${j.id}`}
              label={`Justificación · ${j.label}`}
              required
              value={just[j.id] ?? ""}
              onChange={(v) => setJust((x) => ({ ...x, [j.id]: v }))}
              hint={j.detalle}
            />
          ))}
        </div>
      )}
      <div className="mt-3">
        <Button
          size="sm"
          variant="success"
          onClick={() => {
            if (faltan.length > 0) return setError(`Justificá los pendientes de «${faltan[0].label}».`);
            setError(null);
            setFase("firma1");
          }}
        >
          Firmar el acta y cerrar la fecha
        </Button>
      </div>
      <ErrorBanner error={error} />

      <LlaveModal
        open={fase === "firma1"}
        titulo="Primera firma: tesorero"
        descripcion="El tesorero firma el acta de cierre diario con su llave."
        datos={{ operacion: "Acta de cierre diario (firma del tesorero)", referencia: cierre.id }}
        usuarioId={cierre.usuarioId}
        confirmar="Firmar"
        onFirmada={(f) => {
          setFirma1(f);
          setFase("firma2");
        }}
        onClose={cerrar}
      />
      <LlaveModal
        open={fase === "firma2"}
        titulo={remota ? "Segunda firma remota de Casa Central" : "Segunda firma: supervisor"}
        descripcion={remota ? "Autorización remota — sin verificación física. Queda marcada así en el acta." : "El supervisor de la sucursal firma el acta con su llave."}
        datos={{ operacion: "Acta de cierre diario (segunda firma)", referencia: cierre.id, cargadoPor: cierre.usuarioId, remota }}
        confirmar="Firmar y cerrar la fecha"
        onFirmada={(f2) => {
          if (!firma1) return "Falta la primera firma.";
          const e = aError(confirmarCierreDiario(cierre.id, { justificaciones: just, firma1Id: firma1.id, firma2Id: f2.id }));
          if (e) return e;
          cerrar();
          return null;
        }}
        onClose={cerrar}
      />
    </PanelVentana>
  );
}

// ---------- Pantalla ----------

export function PantallaCierreSucursal() {
  const { sucursales, cajas, cierresSucursal, usuario, fecha, hora } = useCajaDatos();
  const ajustes = useAjustesCierre();
  const actas = useActas();
  usePlazos();
  const plazos = plazosControl();

  const visibles = sucursalesVisibles(usuario, sucursales.filter((s) => s.estado === "ACTIVO"), cajas);
  const [elegida, setElegida] = useState("");
  const sucursalId = visibles.some((s) => s.id === elegida) ? elegida : (visibles[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pidiendo, setPidiendo] = useState<CierreSucursal | null>(null);
  const [autorizando, setAutorizando] = useState<CierreSucursal | null>(null);

  const cajasSuc = cajas.filter((c) => c.sucursalId === sucursalId && c.estado === "ACTIVO");
  const esTesoreroDeLaSucursal = cajasSuc.some((c) => esTesoro(c.tipo) && c.tesoreroId === usuario.id);
  const supervisaLaSucursal = usuario.roles.includes("SUPERVISOR") && (veTodo(usuario) || usuario.sucursalId === sucursalId);
  const { estado, cierre } = estadoCierreDiario(cierresSucursal, sucursalId, fecha, hora, plazos.horaLimiteCierreDiario);
  const enCurso = cierreEnCurso(cierresSucursal, sucursalId, fecha);
  const controles = sucursalId ? controlesDeSucursal(sucursalId, fecha, enCurso?.id) : [];
  const bloqueantes = controles.flatMap((c) => c.bloqueantes);
  const justificables = controles.filter((c) => c.justificables.length > 0).map((c) => ({ id: c.id, label: c.label, detalle: c.justificables.join(" ") }));
  const historial = cierresSucursal.filter((c) => c.sucursalId === sucursalId).sort((a, b) => b.id.localeCompare(a.id));
  const ajustesDe = (id: string) => ajustes.filter((a) => a.cierreId === id);
  const minutos = enCurso?.estado === "EN_VENTANA" ? minutosDeVentana(enCurso.ventanaHasta, fecha, hora) : undefined;
  const actaDe = (c: CierreSucursal) => actaPorId(c.actaId) ?? actas.find((a) => a.id === c.actaId);

  return (
    <PaginaCaja
      titulo="Cierre diario de sucursal"
      descripcion="Cierre integral y obligatorio del local: el sistema revisa seis controles, se da una ventana para registrar faltantes o ajustes, el tesorero y un supervisor firman el acta y la fecha queda bloqueada. Casa Central ve el estado y el responsable en el Tablero de tesoros."
    >
      {visibles.length === 0 ? (
        <PanelVentana titulo="Cierre diario">
          <p className="py-4 text-center text-xs text-ink-400">Tu usuario no tiene sucursales a cargo para el cierre diario.</p>
        </PanelVentana>
      ) : (
        <>
          <div className="max-w-xs">
            <SelectField
              id="cs-sucursal"
              label="Sucursal"
              value={sucursalId}
              onChange={(v) => {
                setElegida(v);
                setError(null);
              }}
              options={visibles.map((s) => ({ value: s.id, label: s.nombre }))}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <span className="text-xs text-ink-600">Estado de la fecha {fecha}:</span>
            <Pill fase={FASE[estado]}>{ESTADO_CIERRE_DIARIO_LABEL[estado]}</Pill>
            {cierre && <span className="text-xs text-ink-500">Responsable del cierre: {quien(cierre.usuarioId)}</span>}
          </div>

          {estado === "NO_CERRADA" && (
            <Banner tone="error" title="La sucursal no cerró la fecha a la hora límite" className="mt-4">
              Pasó la hora límite ({plazos.horaLimiteCierreDiario}) y el cierre diario no se inició: se avisa al Tesorero central. El tesorero todavía puede iniciarlo.
            </Banner>
          )}
          {estado === "EN_VENTANA" && enCurso && (
            <Banner tone="info" title="Ventana de ajuste abierta" className="mt-4">
              {enCurso.reabreDeId
                ? `Cierre abierto por una reapertura autorizada (referencia ${enCurso.reabreDeId}): sólo admite ajustes y contramovimientos, sin plazo.`
                : `Quedan ${textoVentana(minutos ?? 0)} (hasta ${enCurso.ventanaHasta}). Si vence sin cerrar, la fecha queda bloqueada.`}
            </Banner>
          )}
          {cierre && estaCerrado(cierre) && (
            <Banner tone={cierre.estado === "CERRADA_OK" ? "success" : "warning"} title={`Fecha operativa ${cierre.fecha}: ${ESTADO_CIERRE_DIARIO_LABEL[cierre.estado].toLowerCase()}`} className="mt-4">
              Cerró {quien(cierre.usuarioId)} el {cierre.cerradaEn ?? cierre.fechaHora}. No se puede operar en las cajas de la sucursal hasta que Casa Central autorice una reapertura.
            </Banner>
          )}

          <h2 className="mb-1.5 mt-5 text-[11px] font-bold uppercase tracking-wide text-ink-700">Controles automáticos</h2>
          <TablaCompacta etiqueta="Controles automáticos" minWidth="min-w-[44rem]">
            <thead>
              <tr>
                <Th>Control</Th>
                <Th>Qué verifica el sistema</Th>
                <Th>Resultado</Th>
              </tr>
            </thead>
            <tbody>
              {controles.map((c) => (
                <tr key={c.id}>
                  <Td className="font-bold text-ink-900">{c.label}</Td>
                  <Td className="text-ink-600">{c.verifica}</Td>
                  <Td>
                    {c.informativo ? (
                      <Pill fase="inicial">No aplica en la demo (1.7 pendiente)</Pill>
                    ) : c.ok ? (
                      <Pill fase="ok">✔ Cumple</Pill>
                    ) : (
                      <div className="space-y-1">
                        {c.bloqueantes.map((p) => (
                          <p key={p} className="flex gap-1.5 text-[11px] text-danger-700">
                            <span aria-hidden>✘</span>
                            {p}
                          </p>
                        ))}
                        {c.justificables.map((p) => (
                          <p key={p} className="flex gap-1.5 text-[11px] text-warning-700">
                            <span aria-hidden>!</span>
                            {p} <span className="text-ink-400">(se puede justificar)</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TablaCompacta>

          {!enCurso && !(cierre && estaCerrado(cierre)) && (
            <div className="mt-3">
              <Button
                size="sm"
                variant="success"
                onClick={() => setError(aError(iniciarCierreDiario(sucursalId)))}
                disabled={!esTesoreroDeLaSucursal}
                title={esTesoreroDeLaSucursal ? undefined : "Sólo el tesorero de la sucursal inicia el cierre diario."}
              >
                Iniciar el cierre diario
              </Button>
              <ErrorBanner error={error} />
            </div>
          )}

          {enCurso?.estado === "EN_CONTROLES" && (
            <div className="mt-3">
              <Button
                size="sm"
                variant="success"
                onClick={() => setError(aError(abrirVentanaDeAjuste(enCurso.id)))}
                disabled={bloqueantes.length > 0 || enCurso.usuarioId !== usuario.id}
                title={bloqueantes.length > 0 ? "Resolvé los controles marcados con ✘." : enCurso.usuarioId !== usuario.id ? "Sigue el tesorero que inició el cierre." : undefined}
              >
                Pasar a la ventana de ajuste
              </Button>
              <p className="mt-2 text-xs text-ink-500">Los controles marcados con ✘ hay que resolverlos (cerrar cajas, firmar la entrega del efectivo, autorizar diferencias).</p>
              <ErrorBanner error={error} />
            </div>
          )}

          {enCurso?.estado === "EN_VENTANA" && (
            <PanelVentana titulo="Ventana de ajuste" className="mt-4">
              <p className="mb-3 text-xs text-ink-500">
                El tesorero registra faltantes o ajustes y el supervisor los autoriza con su llave; las correcciones nunca editan un movimiento confirmado (R7).
              </p>
              <div>
                <ListaAjustes ajustes={ajustesDe(enCurso.id)} puedeResolver={supervisaLaSucursal} />
                {esTesoreroDeLaSucursal && enCurso.usuarioId === usuario.id && (ventanaAbierta(enCurso, minutos)) && <AjusteForm cierre={enCurso} onError={setError} />}
                {enCurso.usuarioId === usuario.id && <ConfirmarCierre cierre={enCurso} justificables={justificables} />}
                <ErrorBanner error={error} />
              </div>
            </PanelVentana>
          )}

          <h2 className="mb-1.5 mt-6 text-[11px] font-bold uppercase tracking-wide text-ink-700">Historial de cierres</h2>
          {historial.length === 0 ? (
            <PanelVentana titulo="Historial de cierres">
              <p className="py-3 text-center text-xs text-ink-400">Esta sucursal todavía no cerró ninguna fecha.</p>
            </PanelVentana>
          ) : (
            <TablaCompacta etiqueta="Historial de cierres" minWidth="min-w-[52rem]">
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Responsable</Th>
                  <Th>Estado</Th>
                  <Th>Acta</Th>
                  <Th>Reapertura</Th>
                  <Th derecha>Acción</Th>
                </tr>
              </thead>
              <tbody>
                {historial.map((c) => {
                  const acta = actaDe(c);
                  const pendiente = c.reapertura && !c.reapertura.autorizadaPor;
                  return (
                    <tr key={c.id}>
                      <Td className="tabular-nums font-semibold text-ink-900">
                        {c.fecha}
                        <span className="block text-[11px] font-normal text-ink-400">{c.id}{c.reabreDeId && ` · reabre ${c.reabreDeId}`}</span>
                      </Td>
                      <Td>
                        {quien(c.usuarioId)}
                        <span className="block text-[11px] text-ink-400">{c.cerradaEn ?? c.fechaHora}</span>
                      </Td>
                      <Td>
                        <Pill fase={FASE[c.estado]}>{ESTADO_CIERRE_DIARIO_LABEL[c.estado]}</Pill>
                        {c.pendientes && c.pendientes.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-[11px] text-ink-500">
                            {c.pendientes.map((p) => (
                              <li key={p.control}>
                                {p.control}: {p.justificacion}
                              </li>
                            ))}
                          </ul>
                        )}
                      </Td>
                      <Td className="text-ink-600">
                        {acta ? (
                          <>
                            {acta.id} · {estadoActaTexto(acta)}
                            <span className="block text-ink-400">
                              {quien(acta.firma1?.usuarioId)} + {quien(acta.firma2?.usuarioId)}
                              {acta.remota && " · autorización remota, sin verificación física"}
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="text-ink-600">
                        {c.reapertura
                          ? `${quien(c.reapertura.solicitadaPor)}: ${c.reapertura.motivo}${c.reapertura.autorizadaPor ? ` · autorizó ${nombreUsuario(c.reapertura.autorizadaPor)} (${c.reapertura.fechaHoraAutorizacion})` : " · espera la autorización de Casa Central"}`
                          : "—"}
                      </Td>
                      <Td derecha>
                        {estaCerrado(c) && !c.reapertura && (
                          <Button
                            size="xs"
                            variant="navyOutline"
                            disabled={!esTesoreroDeLaSucursal}
                            title={esTesoreroDeLaSucursal ? undefined : "Pide la reapertura el tesorero de la sucursal."}
                            onClick={() => setPidiendo(c)}
                          >
                            Pedir reapertura
                          </Button>
                        )}
                        {estaCerrado(c) && pendiente && (
                          <Button size="xs" variant="success" onClick={() => setAutorizando(c)} disabled={!veTodo(usuario)} title={veTodo(usuario) ? undefined : "Autoriza el Tesorero central o el Director."}>
                            Autorizar reapertura
                          </Button>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TablaCompacta>
          )}
        </>
      )}

      <NotaModal
        open={!!pidiendo}
        titulo="Pedir la reapertura de la fecha"
        descripcion="Casa Central recibe un aviso y la autoriza con su llave. Reabierta, la fecha sólo admite ajustes y contramovimientos."
        etiquetaNota="Motivo de la reapertura"
        requerida
        confirmar="Pedir la reapertura"
        onClose={() => setPidiendo(null)}
        onConfirmar={(nota) => (pidiendo ? aError(solicitarReaperturaCierre(pidiendo.id, nota)) : null)}
      />
      <LlaveModal
        open={!!autorizando}
        titulo="Autorizar la reapertura"
        descripcion={autorizando ? `Fecha ${autorizando.fecha} · pidió ${nombreUsuario(autorizando.reapertura?.solicitadaPor ?? "")}: ${autorizando.reapertura?.motivo ?? ""}. Autoriza el Tesorero central o el Director; vencido el plazo (${plazos.plazoReaperturaDias} días hábiles), sólo el Director.` : undefined}
        datos={{ operacion: "Reapertura del cierre diario", referencia: autorizando?.id ?? "", cargadoPor: autorizando?.reapertura?.solicitadaPor }}
        confirmar="Autorizar la reapertura"
        onFirmada={(f) => (autorizando ? aError(autorizarReaperturaCierre(autorizando.id, f.id)) : "Falta el cierre.")}
        onClose={() => setAutorizando(null)}
      />
    </PaginaCaja>
  );
}

// La ventana admite ajustes mientras no venza (una reapertura autorizada no tiene plazo).
const ventanaAbierta = (c: CierreSucursal, minutos: number | undefined) => c.ventanaHasta === undefined || (minutos ?? 0) > 0;
