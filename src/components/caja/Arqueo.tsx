"use client";

import { useState } from "react";
import { arqueoVencido, esResponsable, puedeArquear } from "@/lib/caja-reglas";
import { ajustarDiferenciaArqueo, finalizarArqueo, iniciarArqueo, rechazarAjusteArqueo, registrarConteoArqueo } from "@/lib/caja-operaciones";
import { hoy, nombreUsuario, useCajaDatos, useMotivosDiferencia } from "@/lib/caja-store";
import { monedasDe, type Arqueo, type Caja, type TipoArqueo } from "@/lib/caja-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ActaDatos, ActaFirmas, ActaModal, ActaRecuento } from "./Acta";
import { ActaPanel } from "./ActaPanel";
import { aError } from "./Jornada";
import { FlujoRecuento } from "./RecuentoForm";
import { Campo, INPUT_COMPACTO, PanelVentana, Pill, TablaCompacta, Td, Th } from "./compacto";
import { ErrorBanner, PaginaCaja, dinero, dineroConSigno } from "./comunes";

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
    <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-bold text-ink-900">
          {arqueo.id} · {caja.nombre}
        </p>
        <Pill fase="proceso">{TIPO_LABEL[arqueo.tipo]}</Pill>
        <Pill fase="espera">En curso</Pill>
        {arqueo.grupoId && <Pill fase="inicial">Corte compartido</Pill>}
      </div>
      <p className="mt-1 text-xs text-ink-600">
        Corte: {arqueo.corte} · Controlador: {nombreUsuario(arqueo.controladorId)}. Los movimientos están congelados y las operaciones nuevas suspendidas hasta finalizar.
      </p>

      {arqueo.conteos.map((c, i) => (
        <div key={i} className="mt-2 rounded-lg border border-ink-300 bg-white p-2.5 text-xs">
          <p className="font-bold text-ink-900">
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
        <p className="mt-3 text-xs text-ink-500">Sólo el controlador carga el recuento y finaliza el arqueo.</p>
      ) : arqueo.conteos.length === 0 ? (
        <div className="mt-3">
          <p className="mb-2 text-xs text-ink-600">Recuento ciego: el cajero declara las cantidades sin ver el esperado.</p>
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
              <Button size="sm" variant="navyOutline" onClick={() => setSegundo(true)}>
                Cargar segundo conteo (opcional)
              </Button>
            )}
            <Button size="sm" variant="success" onClick={() => setError(aError(finalizarArqueo(arqueo.id)))}>Finalizar arqueo y liberar la caja</Button>
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
      <p className="mb-2 text-xs text-ink-600">
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
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${a.id === activo.id ? "bg-white text-brand-700 shadow-xs" : "text-ink-500 hover:text-ink-800"}`}
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
  const [ajusteId, setAjuste] = useState<string | null>(null);
  const ajuste = arqueos.find((x) => x.id === ajusteId) ?? null;
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
        <Banner tone="warning" title="Arqueos ordinarios vencidos" className="mb-4">
          {vencidas.map((c) => `${c.nombre} (cada ${c.frecuenciaArqueo.toLowerCase()})`).join(" · ")}
        </Banner>
      )}

      <PanelVentana titulo="Nuevo arqueo · lo hace un Supervisor o un Tesorero con permiso Realizar arqueo; no puede ser responsable de la caja arqueada" className="mb-4">
        <div>
          {!puede ? (
            <Banner tone="info">{usuario.nombre} no tiene el permiso Realizar arqueo. Actuá como Supervisor o Tesorero.</Banner>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <Campo label="Caja a arquear" className="w-72">
                <select value={cajaId} onChange={(e) => setCajaElegida(e.target.value)} aria-label="Caja a arquear" className={INPUT_COMPACTO}>
                  {candidatas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Tipo" className="w-44">
                <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoArqueo)} aria-label="Tipo de arqueo" className={INPUT_COMPACTO}>
                  <option value="SORPRESIVO">Sorpresivo</option>
                  <option value="ORDINARIO">Ordinario</option>
                </select>
              </Campo>
              <Button
                size="sm"
                variant="success"
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
            <fieldset className="mt-3">
              <legend className="text-xs font-bold text-ink-900">Incluir en el mismo corte</legend>
              <p className="text-[11px] text-ink-500">Cajas de cajero de la sucursal: se arquean con el mismo corte y cada una tiene su recuento y su acta.</p>
              <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
                {incluibles.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-xs text-ink-700">
                    <input type="checkbox" checked={incluidasValidas.includes(c.id)} onChange={() => alternarIncluida(c.id)} className="h-3.5 w-3.5" />
                    {c.nombre}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <ErrorBanner error={error} />
        </div>
      </PanelVentana>

      {enCurso.length > 0 && (
        <PanelVentana titulo="Arqueos en curso" className="mb-4">
          <div className="space-y-3">
            {gruposEnCurso.map((g) => {
              if (g.length > 1) return <GrupoEnCurso key={g[0].grupoId} arqueos={g} cajas={cajas} usuarioId={usuario.id} />;
              const c = cajaDe(g[0].cajaId);
              return c ? <ArqueoEnCurso key={g[0].id} arqueo={g[0]} caja={c} controla={g[0].controladorId === usuario.id} /> : null;
            })}
          </div>
        </PanelVentana>
      )}

      <PanelVentana titulo="Historial de arqueos · las actas no se modifican ni se eliminan">
        <div className="mb-3 flex flex-wrap gap-2">
          <select value={fCaja} onChange={(e) => setFCaja(e.target.value)} aria-label="Filtrar por caja" className={`${INPUT_COMPACTO} w-60`}>
            <option value="">Caja: todas</option>
            {cajas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} aria-label="Filtrar por tipo" className={`${INPUT_COMPACTO} w-44`}>
            <option value="">Tipo: todos</option>
            <option value="ORDINARIO">Ordinario</option>
            <option value="SORPRESIVO">Sorpresivo</option>
          </select>
          <select value={fResultado} onChange={(e) => setFResultado(e.target.value)} aria-label="Filtrar por resultado" className={`${INPUT_COMPACTO} w-48`}>
            <option value="">Resultado: todos</option>
            <option value="CONFORME">Conforme</option>
            <option value="CON_DIFERENCIA">Con diferencia</option>
          </select>
        </div>
        {historial.length === 0 ? (
          <p className="py-4 text-center text-xs text-ink-400">Todavía no hay arqueos finalizados.</p>
        ) : (
          <TablaCompacta etiqueta="Historial de arqueos" minWidth="min-w-[44rem]">
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Caja</Th>
                <Th>Tipo</Th>
                <Th>Controlador</Th>
                <Th>Fin</Th>
                <Th>Resultado</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {historial.map((a) => (
                <tr key={a.id} className={a.grupoId ? "bg-brand-50/30" : undefined}>
                  <Td className={`font-mono font-bold text-brand-700 ${a.grupoId ? "border-l-4 border-l-brand-300" : ""}`}>
                    {a.id}
                    {a.grupoId && <span className="block text-[10px] font-medium text-ink-400">Corte compartido · {a.grupoId}</span>}
                  </Td>
                  <Td>{cajaDe(a.cajaId)?.nombre}</Td>
                  <Td>{TIPO_LABEL[a.tipo]}</Td>
                  <Td>{nombreUsuario(a.controladorId)}</Td>
                  <Td className="tabular-nums">{a.fin}</Td>
                  <Td>
                    <Pill fase={a.resultado === "CONFORME" ? "ok" : a.ajusteAprobado ? "proceso" : a.ajusteRechazado ? "rechazo" : "espera"}>
                      {a.resultado === "CONFORME" ? "Conforme" : a.ajusteAprobado ? "Diferencia ajustada" : a.ajusteRechazado ? "Ajuste rechazado" : "Con diferencia"}
                    </Pill>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      <Button size="xs" variant="navyOutline" onClick={() => setActa(a.id)}>
                        Ver acta
                      </Button>
                      {a.resultado === "CON_DIFERENCIA" && (
                        <Button size="xs" variant="brandOutline" onClick={() => setAjuste(ajusteId === a.id ? null : a.id)}>
                          Acta de diferencia
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TablaCompacta>
        )}
      </PanelVentana>

      {actaArqueo && cajaDe(actaArqueo.cajaId) && <ActaArqueo arqueo={actaArqueo} caja={cajaDe(actaArqueo.cajaId)!} onClose={() => setActa(null)} />}
      {ajuste && (
        <PanelVentana
          titulo={`Acta de diferencia del arqueo ${ajuste.id}`}
          className="mt-4"
        >
          <p className="mb-3 text-xs text-ink-500">
            El responsable de la caja firma conforme o disconforme; después un supervisor distinto del controlador autoriza el ajuste o lo rechaza. La diferencia no desaparece: el ajuste es un movimiento propio.
          </p>
          <div>
            {!ajuste.ajusteAprobado && !ajuste.ajusteRechazado && (
              <Campo label="Motivo de la diferencia (para autorizar el ajuste)" className="mb-3 max-w-md">
                <select value={motivoId} onChange={(e) => setMotivoId(e.target.value)} aria-label="Motivo de la diferencia" className={INPUT_COMPACTO}>
                  <option value="">Elegí un motivo…</option>
                  {motivos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.descripcion}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
            {ajuste.ajusteAprobado && <Banner tone="success">Ajuste autorizado por {nombreUsuario(ajuste.ajusteAprobado.supervisorId)} · {ajuste.ajusteAprobado.fechaHora}.</Banner>}
            {ajuste.ajusteRechazado && (
              <Banner tone="warning" title="Ajuste rechazado">
                {nombreUsuario(ajuste.ajusteRechazado.supervisorId)}: {ajuste.ajusteRechazado.nota}. Hay que repetir la verificación con un arqueo nuevo.
              </Banner>
            )}
            <ActaPanel
              eventoTipo="ARQUEO"
              eventoId={ajuste.id}
              diferencia={ajuste.conteos[ajuste.conteos.length - 1]?.diferencia}
              autorizarLabel="Autorizar el ajuste"
              rechazarLabel="Rechazar el ajuste"
              onAutorizar={(nota, firmaId) => aError(ajustarDiferenciaArqueo(ajuste.id, motivoId, nota, firmaId))}
              onRechazar={(nota, firmaId) => aError(rechazarAjusteArqueo(ajuste.id, nota, firmaId))}
            />
          </div>
        </PanelVentana>
      )}
    </PaginaCaja>
  );
}
