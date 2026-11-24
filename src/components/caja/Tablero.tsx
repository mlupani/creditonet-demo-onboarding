"use client";

import { Fragment, useState } from "react";
import {
  ESTADO_TABLERO,
  TIPO_ALERTA_LABEL,
  alertasPara,
  calcularAlertas,
  resumenPosicion,
  tablero,
  type DatosPosicion,
  type DiferenciaCaja,
} from "@/lib/caja-posicion";
import { USUARIOS_CAJA } from "@/lib/caja-datos";
import { esResponsable, estadoCierreDiario, estadoCustodia, puedeArquear, veTodo } from "@/lib/caja-reglas";
import { useCajaDatos } from "@/lib/caja-store";
import { ESTADO_CIERRE_DIARIO_LABEL, ESTADO_CUSTODIA_LABEL, MONEDAS, TIPO_CAJA_LABEL, esTesoro, type Moneda, type PorMoneda } from "@/lib/caja-tipos";
import { ordenarArqueoSorpresivo } from "@/lib/cierre-diario";
import { plazosControl, usePlazos } from "@/lib/control-store";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IconChevronDown } from "@/components/icons";
import { ExcepcionesHorario } from "./ExcepcionesHorario";
import { ErrorBanner, PaginaCaja, descargarXlsx, dinero, nombreRoles, quien } from "./comunes";

const TONO_CIERRE = {
  ABIERTA: "neutral",
  EN_CONTROLES: "info",
  EN_VENTANA: "info",
  CERRADA_OK: "success",
  CERRADA_CON_PENDIENTES: "warning",
  NO_CERRADA: "danger",
  REABIERTA: "warning",
} as const;

// Casa Central ordena un arqueo sorpresivo de una caja y designa al controlador (sin aviso previo al cajero).
function OrdenarArqueo({ onClose }: { onClose: () => void }) {
  const { cajas, usuario } = useCajaDatos();
  const activas = cajas.filter((c) => c.estado === "ACTIVO");
  const [cajaId, setCajaId] = useState("");
  const [controladorId, setControladorId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const caja = activas.find((c) => c.id === (cajaId || activas[0]?.id));
  const controladores = USUARIOS_CAJA.filter((u) => puedeArquear(u) && !veTodo(u) && !(caja && esResponsable(caja, u.id)));
  const controlador = controladores.find((u) => u.id === (controladorId || controladores[0]?.id));
  return (
    <Modal
      open
      onClose={onClose}
      title="Ordenar arqueo sorpresivo"
      maxWidth="max-w-lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            {hecho ? "Cerrar" : "Cancelar"}
          </Button>
          {!hecho && (
            <Button
              onClick={() => {
                if (!caja || !controlador) return setError("Elegí la caja y el controlador.");
                const r = ordenarArqueoSorpresivo(caja.id, controlador.id);
                if (r.ok) setHecho(`Arqueo ${r.arqueoId} ordenado: ${caja.nombre} queda congelada y controla ${controlador.nombre}.`);
                else setError(r.error);
              }}
            >
              Ordenar el arqueo
            </Button>
          )}
        </div>
      }
    >
      <p className="mb-3 text-sm text-ink-600">
        {usuario.nombre} ordena el corte de forma remota. La caja se congela y el controlador hace el recuento ciego desde Arqueo de caja; el cajero no recibe aviso previo.
      </p>
      <div className="space-y-3">
        <SelectField id="oa-caja" label="Caja" value={caja?.id ?? ""} onChange={setCajaId} options={activas.map((c) => ({ value: c.id, label: c.nombre }))} />
        <SelectField
          id="oa-controlador"
          label="Controlador"
          value={controlador?.id ?? ""}
          onChange={setControladorId}
          hint="Un Supervisor o Tesorero con permiso Realizar arqueo que no sea responsable de la caja."
          options={controladores.map((u) => ({ value: u.id, label: u.nombre }))}
        />
      </div>
      {hecho && <p className="mt-3 rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-sm text-success-700">{hecho}</p>}
      <ErrorBanner error={error} />
    </Modal>
  );
}

const PUNTO = { success: "bg-success-600", warning: "bg-warning-500", danger: "bg-danger-600" } as const;

function Tarjeta({ titulo, valor, detalle, tono }: { titulo: string; valor: string; detalle?: string; tono?: "warning" | "danger" }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{titulo}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${tono === "danger" ? "text-danger-700" : tono === "warning" ? "text-warning-700" : "text-ink-900"}`}>
        {valor}
      </p>
      {detalle && <p className="mt-1 text-xs text-ink-500">{detalle}</p>}
    </Card>
  );
}

const porMoneda = (v: PorMoneda, monedas: Moneda[] = MONEDAS) =>
  monedas
    .filter((m) => v[m] !== 0)
    .map((m) => dinero(m, v[m]))
    .join(" · ") || "—";

function Diferencias({ d, monedas }: { d: DiferenciaCaja; monedas: Moneda[] }) {
  const hay = monedas.some((m) => d.favor[m] !== 0 || d.contra[m] !== 0);
  if (!hay) return <span className="text-ink-400">—</span>;
  return (
    <div className="space-y-0.5 text-xs tabular-nums">
      {monedas.map((m) => (
        <p key={m}>
          <span className="text-success-700">+ {dinero(m, d.favor[m])}</span> /{" "}
          <span className="text-danger-700">− {dinero(m, d.contra[m])}</span>
        </p>
      ))}
    </div>
  );
}

export function PantallaTablero() {
  const d = useCajaDatos();
  const [verTodas, setVerTodas] = useState(false);
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});
  const [ordenando, setOrdenando] = useState(false);
  usePlazos();
  const limite = plazosControl().horaLimiteCierreDiario;
  // Cierre diario de la sucursal (sólo en las filas de tesoro) y estado del efectivo de cada caja al cerrar.
  const cierreDe = (cajaId: string) => {
    const caja = d.cajas.find((c) => c.id === cajaId);
    if (!caja || !esTesoro(caja.tipo)) return undefined;
    return { sucursalId: caja.sucursalId, ...estadoCierreDiario(d.cierresSucursal, caja.sucursalId, d.fecha, d.hora, limite) };
  };
  const efectivoDe = (cajaId: string) => {
    const j = d.jornadas.filter((x) => x.cajaId === cajaId && x.fecha === d.fecha).at(-1);
    const e = j && estadoCustodia(j);
    return e ? ESTADO_CUSTODIA_LABEL[e] : undefined;
  };

  const datos: DatosPosicion = {
    cajas: d.cajas,
    sucursales: d.sucursales,
    libro: d.libro,
    jornadas: d.jornadas,
    arqueos: d.arqueos,
    cambiosTurno: d.cambiosTurno,
    movimientos: d.movimientos,
    fecha: d.fecha,
    hora: d.hora,
  };
  const filas = tablero(datos);
  const resumen = resumenPosicion(datos);
  const todas = calcularAlertas(datos);
  const propias = alertasPara(todas, d.usuario.roles);
  const otras = todas.filter((a) => !propias.includes(a));
  const visibles = verTodas ? [...propias, ...otras] : propias;

  const exportar = () =>
    descargarXlsx("tablero-de-tesoros.xlsx", "Tablero de tesoros", [
      ["Caja", "Sucursal", "Tipo", "Estado", "Responsable del turno", "Saldo en pesos", "Saldo en dólares", "Diferencias a favor", "Diferencias en contra", "Efectivo al cierre", "Cierre diario", "Responsable del cierre"],
      ...filas.map((f) => {
        const cd = cierreDe(f.cajaId);
        return [
          f.nombre,
          f.sucursal,
          TIPO_CAJA_LABEL[f.tipo],
          ESTADO_TABLERO[f.estado].label,
          quien(f.responsableId),
          f.monedas.includes("ARS") ? String(f.saldos.ARS) : "",
          f.monedas.includes("USD") ? String(f.saldos.USD) : "",
          porMoneda(f.diferencias.favor, f.monedas),
          porMoneda(f.diferencias.contra, f.monedas),
          efectivoDe(f.cajaId) ?? "",
          cd ? ESTADO_CIERRE_DIARIO_LABEL[cd.estado] : "",
          cd?.cierre ? quien(cd.cierre.usuarioId) : "",
        ];
      }),
      ["Total efectivo", "", "", "", "", String(resumen.efectivoTotal.ARS), String(resumen.efectivoTotal.USD), "", "", "", "", ""],
    ]);

  const p = resumen.pendientes;
  return (
    <PaginaCaja
      seccion="Posición de caja y bancos"
      titulo="Tablero de tesoros"
      descripcion="Una fila por caja con su estado, responsable del turno y saldo según el sistema; diferencias a favor y en contra, fondos en tránsito y alertas."
    >
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-700">Alertas</h2>
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-500">
            {propias.length} para {nombreRoles(d.usuario)}
            {otras.length > 0 && ` · ${otras.length} para otros roles`}
          </span>
          {otras.length > 0 && (
            <label className="ml-auto flex items-center gap-2 text-xs font-medium text-ink-600">
              <input type="checkbox" checked={verTodas} onChange={(e) => setVerTodas(e.target.checked)} />
              Ver todas
            </label>
          )}
        </div>
        {visibles.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-ink-200 px-4 py-4 text-center text-sm text-ink-400">
            No hay alertas para vos en este momento.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-100">
            {visibles.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <StatusBadge tone={a.tipo === "ARQUEO_VENCIDO" ? "info" : "warning"}>{TIPO_ALERTA_LABEL[a.tipo]}</StatusBadge>
                <span className="min-w-60 flex-1 text-sm text-ink-700">{a.mensaje}</span>
                <span className="text-[11px] text-ink-400">Avisa a {a.destinatarios.map((r) => (r === "TESORERO" ? "Tesorero" : r === "SUPERVISOR" ? "Supervisor" : "Cajero")).join(" y ")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta
          titulo="Pendientes de autorización"
          valor={String(p.total)}
          tono={p.total > 0 ? "warning" : undefined}
          detalle={`${p.movimientos} movimientos · ${p.jornadas} aperturas o cierres · ${p.relevos} relevos · ${p.incidencias} incidencias`}
        />
        <Tarjeta titulo="Fondos en tránsito" valor={porMoneda(resumen.enTransito)} detalle="Salieron del origen y el destino todavía no los aceptó." />
        <Tarjeta
          titulo="Cajas sobre el máximo"
          valor={String(resumen.sobreMaximo.length)}
          tono={resumen.sobreMaximo.length > 0 ? "danger" : undefined}
          detalle={resumen.sobreMaximo.length > 0 ? "Conviene un retiro de excedente." : "Ninguna supera su importe máximo."}
        />
        <Tarjeta
          titulo="Diferencias de caja"
          valor={`+ ${porMoneda(resumen.diferencias.favor)}`}
          detalle={`En contra: ${porMoneda(resumen.diferencias.contra)}`}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-700">Tablero de tesoros</h2>
        <div className="ml-auto flex flex-wrap gap-2">
          {veTodo(d.usuario) && (
            <Button variant="outline" onClick={() => setOrdenando(true)}>
              Ordenar arqueo sorpresivo
            </Button>
          )}
          <Button variant="outline" onClick={exportar}>
            Exportar a Excel
          </Button>
        </div>
      </div>
      <Card className="mt-3 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[78rem] text-left text-sm">
            <thead>
              <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                <th className="px-3 py-2.5">Caja</th>
                <th className="px-3 py-2.5">Sucursal</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5">Responsable del turno</th>
                <th className="px-3 py-2.5 text-right">Saldo en pesos</th>
                <th className="px-3 py-2.5 text-right">Saldo en dólares</th>
                <th className="px-3 py-2.5">A favor / en contra</th>
                <th className="px-3 py-2.5">Efectivo al cierre</th>
                <th className="px-3 py-2.5">Cierre diario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filas.map((f) => {
                const abierta = abiertas[f.cajaId];
                const puedeExpandir = f.porTurno.length > 0;
                return (
                  <Fragment key={f.cajaId}>
                    <tr>
                      <td className="px-3 py-3 font-semibold text-ink-900">
                        <div className="flex items-center gap-2">
                          {puedeExpandir ? (
                            <button
                              type="button"
                              aria-expanded={abierta}
                              aria-label={`Desglose por turno de ${f.nombre}`}
                              onClick={() => setAbiertas((a) => ({ ...a, [f.cajaId]: !a[f.cajaId] }))}
                              className="text-ink-400 hover:text-ink-700"
                            >
                              <IconChevronDown width={14} height={14} className={`transition-transform ${abierta ? "" : "-rotate-90"}`} />
                            </button>
                          ) : (
                            <span className="w-3.5" />
                          )}
                          {f.nombre}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-ink-700">{f.sucursal}</td>
                      <td className="px-3 py-3 text-ink-700">{TIPO_CAJA_LABEL[f.tipo]}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-2 text-ink-700">
                          <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${PUNTO[f.tono]}`} />
                          {ESTADO_TABLERO[f.estado].label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-ink-700">{quien(f.responsableId)}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink-900">
                        {f.monedas.includes("ARS") ? dinero("ARS", f.saldos.ARS) : <span className="font-normal text-ink-400">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink-900">
                        {f.monedas.includes("USD") ? dinero("USD", f.saldos.USD) : <span className="font-normal text-ink-400">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <Diferencias d={f.diferencias} monedas={f.monedas} />
                      </td>
                      <td className="px-3 py-3">
                        {efectivoDe(f.cajaId) ? (
                          <StatusBadge tone={efectivoDe(f.cajaId) === ESTADO_CUSTODIA_LABEL.CUSTODIA ? "success" : "warning"}>{efectivoDe(f.cajaId)}</StatusBadge>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {(() => {
                          const cd = cierreDe(f.cajaId);
                          if (!cd) return <span className="text-ink-400">—</span>;
                          return (
                            <>
                              <StatusBadge tone={TONO_CIERRE[cd.estado]}>{ESTADO_CIERRE_DIARIO_LABEL[cd.estado]}</StatusBadge>
                              {cd.cierre && <span className="mt-1 block text-xs text-ink-500">Responsable: {quien(cd.cierre.usuarioId)}</span>}
                            </>
                          );
                        })()}
                      </td>
                    </tr>
                    {abierta && puedeExpandir && (
                      <tr className="bg-ink-25">
                        <td colSpan={10} className="px-3 py-3">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Diferencias por turno</p>
                          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {f.porTurno.map((t) => (
                              <li key={t.turnoUsuarioId} className="rounded-lg border border-ink-200 bg-white px-3 py-2">
                                <p className="text-sm font-medium text-ink-900">Turno de {quien(t.turnoUsuarioId)}</p>
                                <Diferencias d={t.diferencia} monedas={f.monedas} />
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink-200 bg-ink-25 font-semibold text-ink-900">
                <td className="px-3 py-3" colSpan={5}>
                  Total de efectivo en cajas y tesoros
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{dinero("ARS", resumen.efectivoTotal.ARS)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{dinero("USD", resumen.efectivoTotal.USD)}</td>
                <td className="px-3 py-3 text-xs font-normal text-ink-500" colSpan={3}>
                  Suma simple de los saldos de arriba
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="mt-8">
        <ExcepcionesHorario />
      </div>
      {ordenando && <OrdenarArqueo onClose={() => setOrdenando(false)} />}
    </PaginaCaja>
  );
}
