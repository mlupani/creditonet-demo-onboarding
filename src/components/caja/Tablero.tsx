"use client";

import Link from "next/link";
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
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { IconChevronDown } from "@/components/icons";
import { Cifra, PanelVentana, Pill, Punto, TablaCompacta, Td, Th } from "./compacto";
import { ExcepcionesHorario } from "./ExcepcionesHorario";
import { ErrorBanner, PaginaCaja, descargarXlsx, dinero, nombreRoles, quien } from "./comunes";

const FASE_CIERRE = {
  ABIERTA: "inicial",
  EN_CONTROLES: "proceso",
  EN_VENTANA: "proceso",
  CERRADA_OK: "ok",
  CERRADA_CON_PENDIENTES: "espera",
  NO_CERRADA: "rechazo",
  REABIERTA: "espera",
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

const FASE_TONO = { success: "ok", warning: "espera", danger: "rechazo" } as const;

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
          <span className="font-semibold text-danger-700">− {dinero(m, d.contra[m])}</span>
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
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra label="Pendientes de autorización" tono={p.total > 0 ? "malo" : "neutro"}>
          {p.total}
          <span className="mt-0.5 block text-[11px] font-normal text-ink-500">
            {p.movimientos} movimientos · {p.jornadas} aperturas o cierres · {p.relevos} relevos · {p.incidencias} incidencias
          </span>
        </Cifra>
        <Cifra label="Fondos en tránsito">
          {porMoneda(resumen.enTransito)}
          <span className="mt-0.5 block text-[11px] font-normal text-ink-500">Salieron del origen y el destino todavía no los aceptó.</span>
        </Cifra>
        <Cifra label="Cajas sobre el máximo" tono={resumen.sobreMaximo.length > 0 ? "malo" : "neutro"}>
          {resumen.sobreMaximo.length}
          <span className="mt-0.5 block text-[11px] font-normal text-ink-500">
            {resumen.sobreMaximo.length > 0 ? "Conviene un retiro de excedente." : "Ninguna supera su importe máximo."}
          </span>
        </Cifra>
        <Cifra label="Diferencias de caja">
          {`+ ${porMoneda(resumen.diferencias.favor)}`}
          <span className="mt-0.5 block text-[11px] font-normal text-danger-700">{`En contra: ${porMoneda(resumen.diferencias.contra)}`}</span>
        </Cifra>
      </div>

      <PanelVentana
        className="mt-4"
        titulo={
          <>
            Alertas{" "}
            <span className="ml-1 font-normal text-ink-500">
              · {propias.length} para {nombreRoles(d.usuario)}
              {otras.length > 0 && ` · ${otras.length} para otros roles`}
            </span>
          </>
        }
        accion={
          otras.length > 0 ? (
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-ink-600">
              <input type="checkbox" checked={verTodas} onChange={(e) => setVerTodas(e.target.checked)} />
              Ver todas
            </label>
          ) : undefined
        }
      >
        {visibles.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink-200 px-3 py-3 text-center text-xs text-ink-400">No hay alertas para vos en este momento.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {visibles.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2.5 py-1.5">
                <Pill fase={a.tipo === "ARQUEO_VENCIDO" ? "proceso" : "espera"}>{TIPO_ALERTA_LABEL[a.tipo]}</Pill>
                <span className="min-w-60 flex-1 text-xs text-ink-700">{a.mensaje}</span>
                <span className="text-[11px] text-ink-400">Avisa a {a.destinatarios.map((r) => (r === "TESORERO" ? "Tesorero" : r === "SUPERVISOR" ? "Supervisor" : "Cajero")).join(" y ")}</span>
              </li>
            ))}
          </ul>
        )}
      </PanelVentana>

      <PanelVentana
        className="mt-4"
        titulo="Tablero de tesoros"
        accion={
          <span className="flex flex-wrap gap-1.5">
            {veTodo(d.usuario) && (
              <Button size="xs" variant="dangerOutline" onClick={() => setOrdenando(true)}>
                Ordenar arqueo sorpresivo
              </Button>
            )}
            <Link href="/caja/actas" className="inline-flex h-7 items-center rounded-md border border-navy-800 bg-white px-2.5 text-[11px] font-semibold text-navy-800 hover:bg-ink-100">
              Ver actas
            </Link>
            <Button size="xs" variant="navyOutline" onClick={exportar}>
              Exportar a Excel
            </Button>
          </span>
        }
      >
        <TablaCompacta etiqueta="Tablero de tesoros" minWidth="min-w-[70rem]">
          <thead>
            <tr>
              <Th>Sucursal / Caja</Th>
              <Th>Tipo</Th>
              <Th>Estado</Th>
              <Th>Responsable del turno</Th>
              <Th derecha>Saldo en pesos</Th>
              <Th derecha>Saldo en dólares</Th>
              <Th>Diferencias (a favor / en contra)</Th>
              <Th>Efectivo al cierre</Th>
              <Th>Cierre diario</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const abierta = abiertas[f.cajaId];
              const puedeExpandir = f.porTurno.length > 0;
              const cd = cierreDe(f.cajaId);
              return (
                <Fragment key={f.cajaId}>
                  <tr>
                    <Td className="font-semibold text-ink-900">
                      <div className="flex items-center gap-1.5">
                        {puedeExpandir ? (
                          <button
                            type="button"
                            aria-expanded={abierta}
                            aria-label={`Desglose por turno de ${f.nombre}`}
                            onClick={() => setAbiertas((a) => ({ ...a, [f.cajaId]: !a[f.cajaId] }))}
                            className="text-ink-400 hover:text-ink-700"
                          >
                            <IconChevronDown width={13} height={13} className={`transition-transform ${abierta ? "" : "-rotate-90"}`} />
                          </button>
                        ) : (
                          <span className="w-3" />
                        )}
                        <span>
                          {f.nombre}
                          <span className="block text-[11px] font-normal text-ink-500">{f.sucursal}</span>
                        </span>
                      </div>
                    </Td>
                    <Td>{TIPO_CAJA_LABEL[f.tipo]}</Td>
                    <Td>
                      <Punto fase={FASE_TONO[f.tono]}>{ESTADO_TABLERO[f.estado].label}</Punto>
                    </Td>
                    <Td>{quien(f.responsableId)}</Td>
                    <Td derecha className="font-semibold text-ink-900">
                      {f.monedas.includes("ARS") ? dinero("ARS", f.saldos.ARS) : <span className="font-normal text-ink-400">—</span>}
                    </Td>
                    <Td derecha className="font-semibold text-ink-900">
                      {f.monedas.includes("USD") ? dinero("USD", f.saldos.USD) : <span className="font-normal text-ink-400">—</span>}
                    </Td>
                    <Td>
                      <Diferencias d={f.diferencias} monedas={f.monedas} />
                    </Td>
                    <Td>
                      {efectivoDe(f.cajaId) ? (
                        <Pill fase={efectivoDe(f.cajaId) === ESTADO_CUSTODIA_LABEL.CUSTODIA ? "ok" : "espera"}>{efectivoDe(f.cajaId)}</Pill>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </Td>
                    <Td>
                      {!cd ? (
                        <span className="text-ink-400">—</span>
                      ) : (
                        <>
                          <Punto fase={FASE_CIERRE[cd.estado]}>{ESTADO_CIERRE_DIARIO_LABEL[cd.estado]}</Punto>
                          {cd.cierre && <span className="mt-0.5 block text-[11px] text-ink-500">Responsable: {quien(cd.cierre.usuarioId)}</span>}
                        </>
                      )}
                    </Td>
                  </tr>
                  {abierta && puedeExpandir && (
                    <tr className="bg-ink-25">
                      <Td colSpan={9}>
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-500">Diferencias por turno</p>
                        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {f.porTurno.map((t) => (
                            <li key={t.turnoUsuarioId} className="rounded-md border border-ink-200 bg-white px-2.5 py-1.5">
                              <p className="text-xs font-semibold text-ink-900">Turno de {quien(t.turnoUsuarioId)}</p>
                              <Diferencias d={t.diferencia} monedas={f.monedas} />
                            </li>
                          ))}
                        </ul>
                      </Td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-ink-25 font-semibold text-ink-900">
              <Td colSpan={4}>Total de efectivo en cajas y tesoros</Td>
              <Td derecha>{dinero("ARS", resumen.efectivoTotal.ARS)}</Td>
              <Td derecha>{dinero("USD", resumen.efectivoTotal.USD)}</Td>
              <Td colSpan={3} className="text-[11px] font-normal text-ink-500">
                Suma simple de los saldos de arriba
              </Td>
            </tr>
          </tfoot>
        </TablaCompacta>
      </PanelVentana>

      <div className="mt-5">
        <ExcepcionesHorario />
      </div>
      {ordenando && <OrdenarArqueo onClose={() => setOrdenando(false)} />}
    </PaginaCaja>
  );
}
