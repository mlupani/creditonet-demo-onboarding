"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApplication } from "@/lib/application-context";
import type { EstadoProducto } from "@/lib/config";
import {
  motoresACsv,
  textoVigenciaMotor,
  useMotores,
  vigenciaMotor,
  type MotorRiesgo,
} from "@/lib/motores";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ESTADO_PRODUCTO_META } from "@/components/productos/ListaProductos";
import { IconArrowDown, IconPlus, IconSearch } from "@/components/icons";

const ESTADOS: EstadoProducto[] = ["ACTIVO", "SUSPENDIDO", "ELIMINADO"];

const sinAcentos = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Motor de Riesgo v1 §1: inventario de grupos de reglas con filtro por estado, búsqueda por ID
// o nombre, alta, copia y exportación.
export function ListaMotores() {
  const router = useRouter();
  const { hidratado } = useApplication();
  const motores = useMotores();
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoProducto>("ACTIVO");

  const q = sinAcentos(busqueda.trim());
  const filas = motores
    .filter((m) => m.estado === estado && (!q || sinAcentos(`${m.codigo} ${m.nombre}`).includes(q)))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));

  function exportar() {
    const blob = new Blob([motoresACsv(motores)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "motor-riesgo-grupos.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const abrir = (m: MotorRiesgo, editar = false) =>
    router.push(`/motor-riesgo/${m.id}${editar ? "?editar=1" : ""}`);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="animate-fade-in">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
          Módulo Motor de Riesgo · Función 1
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">
          Motor de riesgo interno
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Grupos de reglas que CreditoNet ejecuta al evaluar una solicitud. Cada regla combina
          variables de la base interna, el BCRA y el buró externo, y rechaza el crédito o lo marca
          para verificar. Los grupos se pueden concatenar y copiar.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button onClick={() => router.push("/motor-riesgo/nuevo")}>
          <IconPlus width={16} height={16} />
          Nuevo
        </Button>
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
            placeholder="Buscar por ID o nombre…"
            aria-label="Buscar grupos de reglas"
            className="h-10 w-full rounded-lg border border-ink-300 bg-white pl-9 pr-3 text-sm shadow-xs outline-none transition placeholder:text-ink-400 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div role="tablist" aria-label="Filtrar por estado" className="flex rounded-lg border border-ink-200 bg-ink-50 p-0.5">
          {ESTADOS.map((e) => {
            const total = motores.filter((m) => m.estado === e).length;
            return (
              <button
                key={e}
                type="button"
                role="tab"
                aria-selected={estado === e}
                onClick={() => setEstado(e)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  estado === e ? "bg-white text-ink-900 shadow-xs" : "text-ink-500 hover:text-ink-800"
                }`}
              >
                {ESTADO_PRODUCTO_META[e].grupo}
                <span className="ml-1.5 text-xs tabular-nums text-ink-400">{total}</span>
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <Button variant="outline" onClick={exportar} disabled={motores.length === 0}>
          <IconArrowDown width={16} height={16} />
          Exportar a Excel
        </Button>
      </div>

      <Card className="mt-5 overflow-hidden">
        {!hidratado ? (
          <p className="px-5 py-8 text-center text-sm text-ink-400">Cargando…</p>
        ) : filas.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-400">
            {q
              ? "Ningún grupo coincide con la búsqueda."
              : `No hay grupos ${ESTADO_PRODUCTO_META[estado].grupo.toLowerCase()}.`}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] table-fixed text-left text-sm">
              <thead>
                <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  <th className="w-16 px-3 py-2.5">ID</th>
                  <th className="px-3 py-2.5">Descripción</th>
                  <th className="w-56 px-3 py-2.5">Vigencia</th>
                  <th className="w-28 px-3 py-2.5">Estado</th>
                  <th className="w-48 px-3 py-2.5">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filas.map((m) => {
                  const vencido = vigenciaMotor(m) !== "VIGENTE";
                  const siguiente = motores.find((r) => r.id === m.concatenarCon);
                  return (
                    <tr key={m.id} onClick={() => abrir(m)} className="cursor-pointer transition hover:bg-ink-25">
                      <td className="px-3 py-3 font-mono text-xs font-bold text-brand-700">{m.codigo}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-ink-900">{m.nombre}</p>
                        <p className="text-xs text-ink-500">
                          {m.reglas.length} regla{m.reglas.length === 1 ? "" : "s"} ·{" "}
                          {m.fuentes.join(", ")}
                          {siguiente && ` · concatena con ${siguiente.codigo} ${siguiente.nombre}`}
                        </p>
                      </td>
                      <td className={`px-3 py-3 ${vencido ? "font-semibold text-warning-700" : "text-ink-700"}`}>
                        {textoVigenciaMotor(m)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge tone={ESTADO_PRODUCTO_META[m.estado].tone}>
                          {ESTADO_PRODUCTO_META[m.estado].label}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="outline" onClick={() => abrir(m, true)}>
                            Modificar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/motor-riesgo/nuevo?de=${m.id}`)}
                          >
                            Copiar
                          </Button>
                        </div>
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
