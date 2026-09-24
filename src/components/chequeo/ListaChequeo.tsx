"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { CANALES, ORGANISMOS, PRODUCTOS, nombreOpcion } from "@/lib/config";
import { intentoActual } from "@/lib/firma";
import { coincideCliente, formatARS, formatDNI } from "@/lib/format";
import type { CreditoDB } from "@/lib/creditos-db";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { IconFileStack, IconSearch } from "@/components/icons";

type Pestana = "PEND" | "CURSO" | "FIN";

const PESTANAS: {
  id: Pestana;
  titulo: string;
  vacio: string;
  incluye: (c: CreditoDB) => boolean;
}[] = [
  {
    id: "PEND",
    titulo: "Pendientes",
    vacio: "No hay créditos pendientes de chequeo telefónico.",
    incluye: (c) => c.estado === "CHEQUEO_TELEFONICO" && c.chequeoTelefonico?.tomado !== true,
  },
  {
    id: "CURSO",
    titulo: "En chequeo",
    vacio: "No hay chequeos tomados en curso.",
    incluye: (c) => c.estado === "CHEQUEO_TELEFONICO" && c.chequeoTelefonico?.tomado === true,
  },
  {
    id: "FIN",
    titulo: "Finalizados",
    vacio: "Todavía no hay chequeos finalizados.",
    incluye: (c) => c.chequeoTelefonico?.resultado != null,
  },
];

const COLUMNAS = [
  "Cliente",
  "DNI",
  "Producto",
  "Organismo",
  "Monto",
  "Cuotas",
  "Firma verificada",
  "Estado",
  "Resultado",
];

export function ListaChequeo({ onAbrir }: { onAbrir: () => void }) {
  const { creditosDB, cargarCreditoDeDB } = useApplication();
  const [pestana, setPestana] = useState<Pestana>("PEND");
  const [busqueda, setBusqueda] = useState("");
  const [canal, setCanal] = useState("");

  const enPestana = (p: (typeof PESTANAS)[number]) =>
    creditosDB.filter((c) => {
      if (!p.incluye(c)) return false;
      if (canal && c.configuracion.canalId !== canal) return false;
      if (busqueda.trim() && !(c.cliente && coincideCliente(c.cliente, busqueda))) return false;
      return true;
    });

  const activa = PESTANAS.find((p) => p.id === pestana)!;
  const lista = enPestana(activa);

  function abrir(c: CreditoDB) {
    cargarCreditoDeDB(c._id);
    onAbrir();
  }

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

      <div role="tablist" aria-label="Estados del chequeo" className="flex flex-wrap gap-2">
        {PESTANAS.map((p) => {
          const seleccionada = p.id === pestana;
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={seleccionada}
              onClick={() => setPestana(p.id)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-bold tracking-wide transition ${
                seleccionada
                  ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                  : "border-ink-300 bg-white text-ink-700 hover:border-ink-400 hover:bg-ink-50"
              }`}
            >
              {p.titulo}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                  seleccionada ? "bg-white/20 text-white" : "bg-ink-100 text-ink-500"
                }`}
              >
                {enPestana(p).length}
              </span>
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        {lista.length === 0 ? (
          <p className="flex items-center justify-center gap-2 px-5 py-8 text-center text-sm text-ink-400">
            <IconFileStack width={15} height={15} />
            {busqueda.trim() || canal ? "Ningún crédito coincide con la búsqueda o el filtro." : activa.vacio}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-left text-[13px]">
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
                {lista.map((c) => {
                  const cli = c.cliente!;
                  const resultado = c.chequeoTelefonico?.resultado;
                  return (
                    <tr
                      key={c._id}
                      className="cursor-pointer align-middle transition hover:bg-ink-25"
                      onClick={() => abrir(c)}
                    >
                      <td className="px-3 py-3">
                        <p className="font-semibold text-ink-900">
                          {cli.nombre} {cli.apellido}
                        </p>
                        <p className="font-mono text-[11px] font-bold text-brand-700">
                          {c.numeroCredito ?? "Sin ID"}
                        </p>
                      </td>
                      <td className="px-3 py-3 tabular-nums text-ink-700">{formatDNI(cli.dni)}</td>
                      <td className="px-3 py-3 text-ink-700">
                        {nombreOpcion(PRODUCTOS, c.configuracion.productoId)}
                      </td>
                      <td className="px-3 py-3 text-ink-700">
                        {nombreOpcion(ORGANISMOS, c.configuracion.organismoId)}
                      </td>
                      <td className="px-3 py-3 font-semibold tabular-nums text-ink-900">
                        {formatARS(c.oferta.montoSolicitado)}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-ink-700">{c.oferta.plazo}</td>
                      <td className="px-3 py-3 text-ink-700">
                        {intentoActual(c.firmas)?.fechaResultado ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        <EstadoBadge estado={c.estado} />
                      </td>
                      <td className="px-3 py-3 text-ink-700">
                        {resultado === "OK"
                          ? "Correcto"
                          : resultado === "NO_OK"
                            ? "No correcto"
                            : c.chequeoTelefonico?.observacion
                              ? "Observado"
                              : "—"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => abrir(c)}>
                          Abrir
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
