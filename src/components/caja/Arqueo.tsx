"use client";

import { useState } from "react";
import { arqueoVencido, esResponsable, esSupervisor, puedeAprobar, puedeArquear } from "@/lib/caja-reglas";
import { ajustarDiferenciaArqueo, finalizarArqueo, iniciarArqueo, registrarConteoArqueo } from "@/lib/caja-operaciones";
import { hoy, nombreUsuario, useCajaDatos, useMotivosDiferencia } from "@/lib/caja-store";
import { monedasDe, type Arqueo, type Caja, type TipoArqueo } from "@/lib/caja-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ActaDatos, ActaFirmas, ActaModal, ActaRecuento } from "./Acta";
import { aError } from "./Jornada";
import { FlujoRecuento } from "./RecuentoForm";
import { CLASE_INPUT, ErrorBanner, NotaModal, PaginaCaja, dinero, dineroConSigno } from "./comunes";

const TIPO_LABEL: Record<TipoArqueo, string> = { ORDINARIO: "Ordinario", SORPRESIVO: "Sorpresivo" };

function ActaArqueo({ arqueo, caja, onClose }: { arqueo: Arqueo; caja: Caja; onClose: () => void }) {
  const conforme = arqueo.resultado === "CONFORME";
  const titulo = conforme ? "Acta de conformidad de arqueo" : "Acta de diferencia de arqueo";
  return (
    <ActaModal open onClose={onClose} titulo={titulo}>
      <h1 className="text-lg font-bold">{titulo}</h1>
      <ActaDatos
        filas={[
          ["Arqueo", `${arqueo.id} · ${TIPO_LABEL[arqueo.tipo]}`],
          ["Caja", `${caja.nombre} (${caja.id})`],
          ["Controlador", nombreUsuario(arqueo.controladorId)],
          ["Ventana de control", `${arqueo.corte} a ${arqueo.fin ?? "—"}`],
          ["Resultado", conforme ? "Conforme" : "Con diferencia"],
          ...(arqueo.ajusteAprobado
            ? ([["Ajuste autorizado", `${nombreUsuario(arqueo.ajusteAprobado.supervisorId)} · ${arqueo.ajusteAprobado.fechaHora}`]] as [string, string][])
            : []),
        ]}
      />
      {arqueo.conteos.map((c, i) => (
        <ActaRecuento key={i} caja={caja} titulo={`Conteo ${i + 1}`} recuento={c} />
      ))}
      <ActaFirmas firmas={[`Controlador: ${nombreUsuario(arqueo.controladorId)}`, `Cajero: ${nombreUsuario(arqueo.conteos[0]?.usuarioId ?? "")}`]} />
    </ActaModal>
  );
}

function ArqueoEnCurso({ arqueo, caja, controla }: { arqueo: Arqueo; caja: Caja; controla: boolean }) {
  const [segundo, setSegundo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const monedas = monedasDe(caja.moneda);
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-ink-900">
          {arqueo.id} · {caja.nombre}
        </p>
        <StatusBadge tone="info">{TIPO_LABEL[arqueo.tipo]}</StatusBadge>
        <StatusBadge tone="warning">En curso</StatusBadge>
      </div>
      <p className="mt-1 text-sm text-ink-600">
        Corte: {arqueo.corte} · Controlador: {nombreUsuario(arqueo.controladorId)}. Los movimientos están congelados y las operaciones nuevas suspendidas hasta finalizar.
      </p>

      {arqueo.conteos.map((c, i) => (
        <div key={i} className="mt-3 rounded-lg border border-ink-200 bg-white p-3 text-sm">
          <p className="font-semibold text-ink-900">
            Conteo {i + 1} · {nombreUsuario(c.usuarioId)} ({c.fechaHora})
          </p>
          <ul className="mt-1 space-y-0.5 text-ink-700">
            {monedas.map((m) => (
              <li key={m}>
                {m}: contado {dinero(m, c.contado[m])} · esperado {dinero(m, c.esperado[m])} · diferencia {dineroConSigno(m, c.diferencia[m])}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {!controla ? (
        <p className="mt-3 text-sm text-ink-500">Sólo el controlador carga el recuento y finaliza el arqueo.</p>
      ) : arqueo.conteos.length === 0 ? (
        <div className="mt-4">
          <p className="mb-3 text-sm text-ink-600">Recuento ciego: el cajero declara las cantidades sin ver el esperado.</p>
          <FlujoRecuento caja={caja} conMotivos={false} confirmar="Registrar conteo" onConfirmar={(detalle) => aError(registrarConteoArqueo(arqueo.id, detalle))} />
        </div>
      ) : (
        <div className="mt-3">
          {segundo && arqueo.conteos.length < 2 && (
            <div className="mb-4">
              <FlujoRecuento caja={caja} conMotivos={false} confirmar="Registrar segundo conteo" onConfirmar={(detalle) => aError(registrarConteoArqueo(arqueo.id, detalle))} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {arqueo.conteos.length < 2 && !segundo && (
              <Button variant="outline" onClick={() => setSegundo(true)}>
                Cargar segundo conteo (opcional)
              </Button>
            )}
            <Button onClick={() => setError(aError(finalizarArqueo(arqueo.id)))}>Finalizar arqueo y liberar la caja</Button>
          </div>
        </div>
      )}
      <ErrorBanner error={error} />
    </div>
  );
}

export function PantallaArqueo() {
  const { cajas, arqueos, usuario } = useCajaDatos();
  const motivos = useMotivosDiferencia().filter((m) => m.estado === "ACTIVO");
  const puede = puedeArquear(usuario);
  const candidatas = cajas.filter((c) => c.estado === "ACTIVO" && !esResponsable(c, usuario.id));
  const [cajaElegida, setCajaElegida] = useState("");
  const cajaId = candidatas.some((c) => c.id === cajaElegida) ? cajaElegida : (candidatas[0]?.id ?? "");
  const [tipo, setTipo] = useState<TipoArqueo>("SORPRESIVO");
  const [error, setError] = useState<string | null>(null);
  const [acta, setActa] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState<Arqueo | null>(null);
  const [motivoId, setMotivoId] = useState("");
  const [fCaja, setFCaja] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fResultado, setFResultado] = useState("");

  const enCurso = arqueos.filter((a) => a.estado === "EN_CURSO");
  const historial = arqueos
    .filter((a) => a.estado === "FINALIZADO")
    .filter((a) => (!fCaja || a.cajaId === fCaja) && (!fTipo || a.tipo === fTipo) && (!fResultado || a.resultado === fResultado))
    .sort((a, b) => (b.fin ?? "").localeCompare(a.fin ?? ""));
  const vencidas = cajas.filter((c) => c.estado === "ACTIVO" && arqueoVencido(c, arqueos, hoy()));
  const cajaDe = (id: string) => cajas.find((c) => c.id === id);
  const actaArqueo = arqueos.find((a) => a.id === acta);

  return (
    <PaginaCaja titulo="Arqueo de caja" descripcion="Control ordinario o sorpresivo con corte y recuento ciego. El arqueo no corrige saldos: la diferencia se regulariza sólo con un ajuste autorizado por un supervisor.">
      {vencidas.length > 0 && (
        <Banner tone="warning" title="Arqueos ordinarios vencidos" className="mb-6">
          {vencidas.map((c) => `${c.nombre} (cada ${c.frecuenciaArqueo.toLowerCase()})`).join(" · ")}
        </Banner>
      )}

      <Card className="mb-6">
        <CardHeader title="Nuevo arqueo" description="Lo hace un Supervisor o un Tesorero con permiso Realizar arqueo; no puede ser responsable de la caja arqueada." />
        <div className="p-5">
          {!puede ? (
            <Banner tone="info">{usuario.nombre} no tiene el permiso Realizar arqueo. Actuá como Supervisor o Tesorero.</Banner>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-400">Caja a arquear</span>
                <select value={cajaId} onChange={(e) => setCajaElegida(e.target.value)} aria-label="Caja a arquear" className={`${CLASE_INPUT} w-72`}>
                  {candidatas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-400">Tipo</span>
                <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoArqueo)} aria-label="Tipo de arqueo" className={`${CLASE_INPUT} w-44`}>
                  <option value="SORPRESIVO">Sorpresivo</option>
                  <option value="ORDINARIO">Ordinario</option>
                </select>
              </label>
              <Button onClick={() => setError(aError(iniciarArqueo(cajaId, tipo)))} disabled={!cajaId}>
                Iniciar arqueo (corte)
              </Button>
            </div>
          )}
          <ErrorBanner error={error} />
        </div>
      </Card>

      {enCurso.length > 0 && (
        <Card className="mb-6">
          <CardHeader title="Arqueos en curso" />
          <div className="space-y-4 p-5">
            {enCurso.map((a) => {
              const c = cajaDe(a.cajaId);
              return c ? <ArqueoEnCurso key={a.id} arqueo={a} caja={c} controla={a.controladorId === usuario.id} /> : null;
            })}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Historial de arqueos" description="Las actas no se modifican ni se eliminan." />
        <div className="flex flex-wrap gap-2 border-b border-ink-100 px-5 py-3">
          <select value={fCaja} onChange={(e) => setFCaja(e.target.value)} aria-label="Filtrar por caja" className={`${CLASE_INPUT} w-60`}>
            <option value="">Caja: todas</option>
            {cajas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} aria-label="Filtrar por tipo" className={`${CLASE_INPUT} w-44`}>
            <option value="">Tipo: todos</option>
            <option value="ORDINARIO">Ordinario</option>
            <option value="SORPRESIVO">Sorpresivo</option>
          </select>
          <select value={fResultado} onChange={(e) => setFResultado(e.target.value)} aria-label="Filtrar por resultado" className={`${CLASE_INPUT} w-48`}>
            <option value="">Resultado: todos</option>
            <option value="CONFORME">Conforme</option>
            <option value="CON_DIFERENCIA">Con diferencia</option>
          </select>
        </div>
        {historial.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-400">Todavía no hay arqueos finalizados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  <th className="px-4 py-2.5">ID</th>
                  <th className="px-4 py-2.5">Caja</th>
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5">Controlador</th>
                  <th className="px-4 py-2.5">Fin</th>
                  <th className="px-4 py-2.5">Resultado</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {historial.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-brand-700">{a.id}</td>
                    <td className="px-4 py-3">{cajaDe(a.cajaId)?.nombre}</td>
                    <td className="px-4 py-3">{TIPO_LABEL[a.tipo]}</td>
                    <td className="px-4 py-3">{nombreUsuario(a.controladorId)}</td>
                    <td className="px-4 py-3 tabular-nums">{a.fin}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={a.resultado === "CONFORME" ? "success" : a.ajusteAprobado ? "info" : "warning"}>
                        {a.resultado === "CONFORME" ? "Conforme" : a.ajusteAprobado ? "Diferencia ajustada" : "Con diferencia"}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setActa(a.id)}>
                          Ver acta
                        </Button>
                        {a.resultado === "CON_DIFERENCIA" && !a.ajusteAprobado && (esSupervisor(usuario) ? puedeAprobar(usuario, a.controladorId) : false) && (
                          <Button size="sm" variant="ghost" onClick={() => setAjuste(a)}>
                            Autorizar ajuste
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {actaArqueo && cajaDe(actaArqueo.cajaId) && <ActaArqueo arqueo={actaArqueo} caja={cajaDe(actaArqueo.cajaId)!} onClose={() => setActa(null)} />}
      <NotaModal
        open={ajuste !== null}
        titulo="Autorizar ajuste por diferencia de arqueo"
        descripcion="Genera un movimiento de ajuste en el libro de la caja con la cuenta contable del motivo. La caja tiene que estar abierta."
        etiquetaNota="Nota (opcional)"
        confirmar="Autorizar ajuste"
        onClose={() => setAjuste(null)}
        onConfirmar={(nota) => (ajuste ? aError(ajustarDiferenciaArqueo(ajuste.id, motivoId, nota)) : null)}
      >
        <select value={motivoId} onChange={(e) => setMotivoId(e.target.value)} aria-label="Motivo de la diferencia" className={CLASE_INPUT}>
          <option value="">Elegí un motivo…</option>
          {motivos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.descripcion}
            </option>
          ))}
        </select>
      </NotaModal>
    </PaginaCaja>
  );
}
