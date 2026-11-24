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
import { CLASE_INPUT, ErrorBanner, NotaModal, PaginaCaja, datosDiferencia, dinero, dineroConSigno } from "./comunes";

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
          ...(arqueo.grupoId ? ([["Corte compartido", `Grupo ${arqueo.grupoId}`]] as [string, string][]) : []),
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
        {arqueo.grupoId && <StatusBadge tone="neutral">Corte compartido</StatusBadge>}
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

// Arqueos en curso del mismo corte: una pestaña por caja, cada una con su recuento y su cierre.
function GrupoEnCurso({ arqueos, cajas, usuarioId }: { arqueos: Arqueo[]; cajas: Caja[]; usuarioId: string }) {
  const [elegido, setElegido] = useState(arqueos[0].id);
  const activo = arqueos.find((a) => a.id === elegido) ?? arqueos[0];
  const caja = cajas.find((c) => c.id === activo.cajaId);
  return (
    <div>
      <p className="mb-2 text-sm text-ink-600">
        Corte único {arqueos[0].corte} · grupo {arqueos[0].grupoId} · {arqueos.length} cajas
      </p>
      <div role="tablist" aria-label="Cajas del arqueo" className="mb-3 flex flex-wrap gap-1 rounded-lg bg-ink-100 p-0.5">
        {arqueos.map((a) => {
          const c = cajas.find((x) => x.id === a.cajaId);
          return (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={a.id === activo.id}
              onClick={() => setElegido(a.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${a.id === activo.id ? "bg-white text-brand-700 shadow-xs" : "text-ink-500 hover:text-ink-800"}`}
            >
              {c?.nombre ?? a.cajaId}
              <span className="ml-1.5 text-[10px] font-medium text-ink-400">{a.conteos.length > 0 ? `${a.conteos.length} conteo${a.conteos.length > 1 ? "s" : ""}` : "sin contar"}</span>
            </button>
          );
        })}
      </div>
      {caja && <ArqueoEnCurso key={activo.id} arqueo={activo} caja={caja} controla={activo.controladorId === usuarioId} />}
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
  const [incluidas, setIncluidas] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [acta, setActa] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState<Arqueo | null>(null);
  const [motivoId, setMotivoId] = useState("");
  const [fCaja, setFCaja] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fResultado, setFResultado] = useState("");

  const cajaElegidaObj = candidatas.find((c) => c.id === cajaId);
  const incluibles =
    cajaElegidaObj?.tipo === "TESORO_SUCURSAL"
      ? cajas.filter((c) => c.tipo === "CAJA_CAJERO" && c.estado === "ACTIVO" && c.sucursalId === cajaElegidaObj.sucursalId)
      : [];
  const incluidasValidas = incluidas.filter((id) => incluibles.some((c) => c.id === id));
  const alternarIncluida = (id: string) => setIncluidas((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  // Los arqueos de un mismo corte se muestran juntos.
  const enCurso = arqueos.filter((a) => a.estado === "EN_CURSO");
  const gruposEnCurso: Arqueo[][] = [];
  for (const a of enCurso) {
    const g = a.grupoId ? gruposEnCurso.find((x) => x[0].grupoId === a.grupoId) : undefined;
    if (g) g.push(a);
    else gruposEnCurso.push([a]);
  }
  const finDeGrupo = (a: Arqueo) =>
    a.grupoId ? arqueos.filter((x) => x.grupoId === a.grupoId).reduce((m, x) => ((x.fin ?? "") > m ? (x.fin ?? "") : m), "") : (a.fin ?? "");
  const historial = arqueos
    .filter((a) => a.estado === "FINALIZADO")
    .filter((a) => (!fCaja || a.cajaId === fCaja) && (!fTipo || a.tipo === fTipo) && (!fResultado || a.resultado === fResultado))
    .sort((a, b) => finDeGrupo(b).localeCompare(finDeGrupo(a)) || (a.grupoId ?? "").localeCompare(b.grupoId ?? "") || a.id.localeCompare(b.id));
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
              <Button
                onClick={() => {
                  const r = iniciarArqueo(cajaId, tipo, incluidasValidas);
                  setError(aError(r));
                  if (r.ok) setIncluidas([]);
                }}
                disabled={!cajaId}
              >
                Iniciar arqueo (corte)
              </Button>
            </div>
          )}
          {puede && incluibles.length > 0 && (
            <fieldset className="mt-4">
              <legend className="text-sm font-semibold text-ink-900">Incluir en el mismo corte</legend>
              <p className="text-xs text-ink-500">Cajas de cajero de la sucursal: se arquean con el mismo corte y cada una tiene su recuento y su acta.</p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
                {incluibles.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm text-ink-700">
                    <input type="checkbox" checked={incluidasValidas.includes(c.id)} onChange={() => alternarIncluida(c.id)} className="h-4 w-4" />
                    {c.nombre}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <ErrorBanner error={error} />
        </div>
      </Card>

      {enCurso.length > 0 && (
        <Card className="mb-6">
          <CardHeader title="Arqueos en curso" />
          <div className="space-y-4 p-5">
            {gruposEnCurso.map((g) => {
              if (g.length > 1) return <GrupoEnCurso key={g[0].grupoId} arqueos={g} cajas={cajas} usuarioId={usuario.id} />;
              const c = cajaDe(g[0].cajaId);
              return c ? <ArqueoEnCurso key={g[0].id} arqueo={g[0]} caja={c} controla={g[0].controladorId === usuario.id} /> : null;
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
                  <tr key={a.id} className={a.grupoId ? "bg-brand-50/30" : undefined}>
                    <td className={`px-4 py-3 font-mono text-xs font-bold text-brand-700 ${a.grupoId ? "border-l-4 border-brand-300" : ""}`}>
                      {a.id}
                      {a.grupoId && <span className="block text-[10px] font-medium text-ink-400">Corte compartido · {a.grupoId}</span>}
                    </td>
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
        llave={
          ajuste
            ? {
                operacion: "Autorización de ajuste por diferencia de arqueo",
                referencia: ajuste.id,
                cargadoPor: ajuste.controladorId,
                ...datosDiferencia(ajuste.conteos[ajuste.conteos.length - 1]?.diferencia ?? { ARS: 0, USD: 0 }),
              }
            : undefined
        }
        onClose={() => setAjuste(null)}
        onConfirmar={(nota, firmaId) => (ajuste ? aError(ajustarDiferenciaArqueo(ajuste.id, motivoId, nota, firmaId)) : null)}
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
