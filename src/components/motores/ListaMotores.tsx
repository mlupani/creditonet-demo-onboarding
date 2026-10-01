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
          Nuevo grupo de reglas
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

      {!hidratado ? (
        <p className="mt-5 px-5 py-8 text-center text-sm text-ink-400">Cargando…</p>
      ) : filas.length === 0 ? (
        <Card className="mt-5 px-5 py-8 text-center">
          <p className="text-sm text-ink-400">
            {q
              ? "Ningún grupo coincide con la búsqueda."
              : `No hay grupos ${ESTADO_PRODUCTO_META[estado].grupo.toLowerCase()}.`}
          </p>
          {!q && estado === "ACTIVO" && (
            <Button className="mt-4" onClick={() => router.push("/motor-riesgo/nuevo")}>
              <IconPlus width={16} height={16} />
              Nuevo grupo de reglas
            </Button>
          )}
        </Card>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filas.map((m) => {
            const vencido = vigenciaMotor(m) !== "VIGENTE";
            const siguiente = motores.find((r) => r.id === m.concatenarCon);
            return (
              <li key={m.id}>
                <Card className="h-full transition hover:border-brand-300 hover:shadow-md">
                  <div className="flex h-full cursor-pointer flex-col gap-3 p-4" onClick={() => abrir(m)}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded-md bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold text-brand-700">
                        {m.codigo}
                      </span>
                      <StatusBadge tone={ESTADO_PRODUCTO_META[m.estado].tone}>
                        {ESTADO_PRODUCTO_META[m.estado].label}
                      </StatusBadge>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-ink-900">{m.nombre}</p>
                      <p className="mt-1 text-xs text-ink-500">
                        {m.reglas.length} regla{m.reglas.length === 1 ? "" : "s"} · {m.fuentes.join(", ")}
                        {siguiente && ` · concatena con ${siguiente.codigo} ${siguiente.nombre}`}
                      </p>
                      <p className={`mt-2 text-xs ${vencido ? "font-semibold text-warning-700" : "text-ink-600"}`}>
                        Vigencia: {textoVigenciaMotor(m)}
                      </p>
                      <p className="mt-1 text-xs text-ink-400">
                        Creado por {m.creado?.usuario ?? "—"}
                        {m.creado && ` · ${m.creado.fecha}`}
                        <br />
                        Modificado por {m.modificado?.usuario ?? "—"}
                        {m.modificado && ` · ${m.modificado.fecha}`}
                      </p>
                    </div>
                    <div className="flex gap-1.5 border-t border-ink-100 pt-3" onClick={(e) => e.stopPropagation()}>
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
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
