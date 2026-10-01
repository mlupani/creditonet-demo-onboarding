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
import { IconArrowDown, IconChevronDown, IconPlus, IconSearch } from "@/components/icons";

type Campo = "codigo" | "nombre" | "estado" | "reglas";

const ESTADOS: EstadoProducto[] = ["ACTIVO", "SUSPENDIDO", "ELIMINADO"];

// Anchos fijos para que las columnas queden alineadas entre los grupos.
const COLUMNAS: { campo: Campo | null; label: string; ancho: string }[] = [
  { campo: "codigo", label: "ID", ancho: "w-20" },
  { campo: "nombre", label: "Nombre", ancho: "" },
  { campo: "estado", label: "Estado", ancho: "w-28" },
  { campo: "reglas", label: "Reglas", ancho: "w-20" },
  { campo: null, label: "Vigencia", ancho: "w-56" },
];

const sinAcentos = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function comparar(a: MotorRiesgo, b: MotorRiesgo, campo: Campo): number {
  switch (campo) {
    case "codigo":
      return a.codigo.localeCompare(b.codigo);
    case "nombre":
      return a.nombre.localeCompare(b.nombre, "es");
    case "estado":
      return ESTADOS.indexOf(a.estado) - ESTADOS.indexOf(b.estado);
    case "reglas":
      return a.reglas.length - b.reglas.length;
  }
}

// Motor de Riesgo v1 §1: inventario de grupos de reglas agrupado por estado, con búsqueda por ID
// o nombre, alta, copia y exportación.
export function ListaMotores() {
  const router = useRouter();
  const { hidratado } = useApplication();
  const motores = useMotores();
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<EstadoProducto | "">("");
  const [orden, setOrden] = useState<{ campo: Campo; asc: boolean }>({ campo: "codigo", asc: true });
  const [abiertos, setAbiertos] = useState<Record<EstadoProducto, boolean>>({
    ACTIVO: true,
    SUSPENDIDO: false,
    ELIMINADO: false,
  });

  const q = sinAcentos(busqueda.trim());
  const coincide = (m: MotorRiesgo) => !q || sinAcentos(`${m.codigo} ${m.nombre}`).includes(q);

  const grupos = ESTADOS.filter((e) => !filtro || filtro === e).map((estado) => {
    const filas = motores
      .filter((m) => m.estado === estado && coincide(m))
      .sort((a, b) => (orden.asc ? 1 : -1) * comparar(a, b, orden.campo));
    const total = motores.filter((m) => m.estado === estado).length;
    const abierto = abiertos[estado] || filtro === estado || (q !== "" && filas.length > 0);
    return { estado, filas, total, abierto };
  });
  const visibles = grupos.flatMap((g) => g.filas);

  function ordenarPor(campo: Campo) {
    setOrden((o) => ({ campo, asc: o.campo === campo ? !o.asc : true }));
  }

  function exportar() {
    const blob = new Blob([motoresACsv(visibles)], { type: "text/csv;charset=utf-8" });
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
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as EstadoProducto | "")}
          aria-label="Filtrar por estado"
          className="h-10 rounded-lg border border-ink-300 bg-white px-3 text-sm text-ink-700 shadow-xs outline-none transition hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        >
          <option value="">Estado: todos</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {ESTADO_PRODUCTO_META[e].label}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <Button variant="outline" onClick={exportar} disabled={visibles.length === 0}>
          <IconArrowDown width={16} height={16} />
          Exportar a Excel
        </Button>
      </div>

      <div className="mt-5 space-y-4">
        {!hidratado ? (
          <Card className="px-5 py-8 text-center text-sm text-ink-400">Cargando…</Card>
        ) : (
          grupos.map(({ estado, filas, total, abierto }) => (
            <Card key={estado} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setAbiertos((a) => ({ ...a, [estado]: !a[estado] }))}
                aria-expanded={abierto}
                className="flex w-full items-center gap-2 px-5 py-3.5 text-left transition hover:bg-ink-25"
              >
                <IconChevronDown
                  width={16}
                  height={16}
                  className={`text-ink-400 transition-transform ${abierto ? "" : "-rotate-90"}`}
                />
                <h2 className="text-xs font-bold uppercase tracking-widest text-ink-700">
                  {ESTADO_PRODUCTO_META[estado].grupo}
                </h2>
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-500">
                  {q || filtro ? `${filas.length} de ${total}` : total}
                </span>
              </button>
              {abierto && (
                <div className="overflow-x-auto border-t border-ink-100">
                  {filas.length === 0 ? (
                    <p className="px-5 py-6 text-center text-sm text-ink-400">
                      {q
                        ? "Ningún grupo coincide con la búsqueda."
                        : `No hay grupos ${ESTADO_PRODUCTO_META[estado].grupo.toLowerCase()}.`}
                    </p>
                  ) : (
                    <table className="w-full min-w-[56rem] table-fixed text-left text-sm">
                      <thead>
                        <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                          {COLUMNAS.map((c) => (
                            <th
                              key={c.label}
                              aria-sort={
                                c.campo && orden.campo === c.campo
                                  ? orden.asc
                                    ? "ascending"
                                    : "descending"
                                  : "none"
                              }
                              className={`px-4 py-2.5 ${c.ancho}`}
                            >
                              {c.campo ? (
                                <button
                                  type="button"
                                  onClick={() => ordenarPor(c.campo!)}
                                  className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-ink-700"
                                >
                                  {c.label}
                                  {orden.campo === c.campo && (
                                    <span aria-hidden>{orden.asc ? "↑" : "↓"}</span>
                                  )}
                                </button>
                              ) : (
                                c.label
                              )}
                            </th>
                          ))}
                          <th className="w-48 px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {filas.map((m) => {
                          const vencido = vigenciaMotor(m) !== "VIGENTE";
                          const siguiente = motores.find((r) => r.id === m.concatenarCon);
                          return (
                            <tr
                              key={m.id}
                              onClick={() => abrir(m)}
                              className="cursor-pointer transition hover:bg-ink-25"
                            >
                              <td className="px-4 py-3 font-mono text-xs font-bold text-brand-700">
                                {m.codigo}
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-semibold text-ink-900">{m.nombre}</p>
                                <p className="text-xs text-ink-500">
                                  {m.fuentes.join(", ")}
                                  {siguiente && ` · concatena con ${siguiente.codigo} ${siguiente.nombre}`}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge tone={ESTADO_PRODUCTO_META[m.estado].tone}>
                                  {ESTADO_PRODUCTO_META[m.estado].label}
                                </StatusBadge>
                              </td>
                              <td className="px-4 py-3 tabular-nums text-ink-700">{m.reglas.length}</td>
                              <td
                                className={`whitespace-nowrap px-4 py-3 ${
                                  vencido ? "font-semibold text-warning-700" : "text-ink-700"
                                }`}
                              >
                                {textoVigenciaMotor(m)}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <Button size="sm" variant="outline" onClick={() => abrir(m)}>
                                    Abrir
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => abrir(m, true)}>
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
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
