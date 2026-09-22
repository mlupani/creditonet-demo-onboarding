"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { CANALES, ORGANISMOS, PRODUCTOS, SESION_ANALISTA, VENDEDORES, nombreOpcion } from "@/lib/config";
import { coincideCliente, formatARS, formatDNI } from "@/lib/format";
import type { EstadoCredito } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { IconFileStack, IconSearch } from "@/components/icons";

type Pestana = "PEND" | "PRE" | "OBS" | "COFE" | "RECH" | "FEL" | "AFEL" | "LIQ";

// Bandeja del analista — 8 estados de creditonet-34.
const PESTANAS: { id: Pestana; titulo: string; estados: EstadoCredito[]; vacio: string }[] = [
  {
    id: "PEND",
    titulo: "En trámite",
    estados: ["BORRADOR", "EN_TRAMITE"],
    vacio: "No hay solicitudes en trámite.",
  },
  {
    id: "PRE",
    titulo: "Preaprobados",
    estados: ["PREAPROBADO", "ANALISIS_TOMADO"],
    vacio: "No hay solicitudes preaprobadas para analizar.",
  },
  {
    id: "OBS",
    titulo: "Observados",
    estados: ["OBSERVADO"],
    vacio: "No hay solicitudes observadas esperando correcciones.",
  },
  {
    id: "COFE",
    titulo: "Cambio de oferta",
    estados: ["CAMBIO_OFERTA"],
    vacio: "No hay solicitudes con cambio de oferta.",
  },
  {
    id: "RECH",
    titulo: "Rechazados",
    estados: ["RECHAZADO"],
    vacio: "No hay solicitudes rechazadas.",
  },
  {
    id: "FEL",
    titulo: "En firma",
    estados: ["EN_FIRMA"],
    vacio: "No hay solicitudes en firma.",
  },
  {
    id: "AFEL",
    titulo: "Firmados",
    estados: ["FIRMADO"],
    vacio: "No hay solicitudes firmadas.",
  },
  {
    id: "LIQ",
    titulo: "Para liquidar",
    estados: ["PARA_LIQUIDAR"],
    vacio: "No hay solicitudes aprobadas para liquidar.",
  },
];

const COLUMNAS = [
  "Cliente",
  "DNI",
  "ID Cliente",
  "Producto",
  "Organismo",
  "Vendedor",
  "Monto",
  "Monto cuota",
  "Cuotas",
  "Estado",
  "Fecha",
  "Analista",
];

export function ListaAnalisis({ onAbrir }: { onAbrir: () => void }) {
  const { app } = useApplication();
  const [eleccion, setEleccion] = useState<Pestana | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [canal, setCanal] = useState("");

  const cliente = app.cliente;
  const propia = PESTANAS.find((p) => p.estados.includes(app.estado));
  // Sin elección explícita se muestra la pestaña donde está la solicitud.
  const activa = PESTANAS.find((p) => p.id === (eleccion ?? propia?.id ?? "PRE")) ?? PESTANAS[0];

  const visible =
    cliente !== null &&
    app.numeroCredito !== null &&
    propia !== undefined &&
    (!canal || app.configuracion.canalId === canal) &&
    coincideCliente(cliente, busqueda);
  const filas = (p: Pestana) => (visible && propia?.id === p ? 1 : 0);

  const fecha =
    app.estado === "PARA_LIQUIDAR"
      ? app.fechaAprobacion
      : app.estado === "OBSERVADO"
        ? app.analista.observacion?.fecha
        : (app.fechaEnvioAnalisis ?? app.fechaSolicitud);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <IconSearch
            width={15}
            height={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar DNI / apellido"
            aria-label="Buscar por DNI o apellido"
            className="h-10 w-full rounded-lg border border-ink-300 bg-white pl-9 pr-3 text-sm shadow-xs outline-none transition placeholder:text-ink-400 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <select
          value={canal}
          onChange={(e) => setCanal(e.target.value)}
          aria-label="Filtro canal"
          className="h-10 rounded-lg border border-ink-300 bg-white px-3 text-sm text-ink-700 shadow-xs outline-none transition hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        >
          <option value="">Canal: todos</option>
          {CANALES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <div role="tablist" aria-label="Estados" className="flex flex-wrap gap-2">
        {PESTANAS.map((p) => {
          const seleccionada = p.id === activa.id;
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={seleccionada}
              onClick={() => setEleccion(p.id)}
              title={p.titulo}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-bold tracking-wide transition ${
                seleccionada
                  ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                  : "border-ink-300 bg-white text-ink-700 hover:border-ink-400 hover:bg-ink-50"
              }`}
            >
              {p.id}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                  seleccionada ? "bg-white/20 text-white" : "bg-ink-100 text-ink-500"
                }`}
              >
                {filas(p.id)}
              </span>
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        {filas(activa.id) === 0 ? (
          <p className="flex items-center justify-center gap-2 px-5 py-8 text-center text-sm text-ink-400">
            <IconFileStack width={15} height={15} />
            {propia && (busqueda.trim() || canal) && propia.id === activa.id
              ? "Ninguna solicitud coincide con la búsqueda o el filtro."
              : activa.vacio}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[64rem] text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  {COLUMNAS.map((c) => (
                    <th key={c} className="px-3 py-2.5 font-semibold">
                      {c}
                    </th>
                  ))}
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                <tr className="cursor-pointer align-middle transition hover:bg-ink-25" onClick={onAbrir}>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-ink-900">
                      {cliente!.nombre} {cliente!.apellido}
                    </p>
                    <p className="font-mono text-[11px] font-bold text-brand-700">
                      {app.numeroCredito}
                    </p>
                  </td>
                  <td className="px-3 py-3 tabular-nums text-ink-700">{formatDNI(cliente!.dni)}</td>
                  <td className="px-3 py-3 font-mono tabular-nums text-ink-700">
                    {app.numeroCliente ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-ink-700">
                    {nombreOpcion(PRODUCTOS, app.configuracion.productoId)}
                  </td>
                  <td className="px-3 py-3 text-ink-700">
                    {nombreOpcion(ORGANISMOS, app.configuracion.organismoId)}
                  </td>
                  <td className="px-3 py-3 text-ink-700">
                    {nombreOpcion(VENDEDORES, app.configuracion.vendedorId)}
                  </td>
                  <td className="px-3 py-3 font-semibold tabular-nums text-ink-900">
                    {formatARS(app.oferta.montoSolicitado)}
                  </td>
                  <td className="px-3 py-3 font-semibold tabular-nums text-ink-900">
                    {formatARS(app.oferta.valorCuota)}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-ink-700">{app.oferta.plazo}</td>
                  <td className="px-3 py-3">
                    <EstadoBadge estado={app.estado} />
                  </td>
                  <td className="px-3 py-3 text-ink-700">{fecha ?? "—"}</td>
                  <td className="px-3 py-3 text-ink-700">
                    {app.estado === "OBSERVADO" || !app.analista.tomado
                      ? "Sin asignar"
                      : SESION_ANALISTA.nombre}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={onAbrir}>
                      Abrir
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
