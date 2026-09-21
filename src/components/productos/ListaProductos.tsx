"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApplication } from "@/lib/application-context";
import type { EstadoProducto } from "@/lib/config";
import { parseFecha } from "@/lib/format";
import {
  cambiarEstadoProducto,
  estadoVigencia,
  productosACsv,
  textoVigencia,
  useProductos,
  type ProductoAbm,
} from "@/lib/productos";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NuevoProductoModal } from "./NuevoProductoModal";
import { IconArrowDown, IconChevronDown, IconPlus, IconSearch } from "@/components/icons";

type Campo = "codigo" | "nombre" | "estado" | "vigencia";

export const ESTADO_PRODUCTO_META: Record<
  EstadoProducto,
  { label: string; grupo: string; tone: "success" | "warning" | "neutral" }
> = {
  ACTIVO: { label: "Activo", grupo: "Activos", tone: "success" },
  SUSPENDIDO: { label: "Suspendido", grupo: "Suspendidos", tone: "warning" },
  ELIMINADO: { label: "Eliminado", grupo: "Eliminados", tone: "neutral" },
};

const ORDEN_ESTADOS: EstadoProducto[] = ["ACTIVO", "SUSPENDIDO", "ELIMINADO"];

// Anchos fijos para que las columnas queden alineadas entre los tres grupos.
const COLUMNAS: { campo: Campo; label: string; ancho: string }[] = [
  { campo: "codigo", label: "ID", ancho: "w-20" },
  { campo: "nombre", label: "Nombre", ancho: "" },
  { campo: "estado", label: "Estado", ancho: "w-36" },
  { campo: "vigencia", label: "Vigencia", ancho: "w-72" },
];

const sinAcentos = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function comparar(a: ProductoAbm, b: ProductoAbm, campo: Campo): number {
  switch (campo) {
    case "codigo":
      return a.codigo.localeCompare(b.codigo);
    case "nombre":
      return a.config.nombre.localeCompare(b.config.nombre, "es");
    case "estado":
      return ORDEN_ESTADOS.indexOf(a.config.estado) - ORDEN_ESTADOS.indexOf(b.config.estado);
    case "vigencia":
      return (
        (parseFecha(a.config.vigenciaDesde)?.getTime() ?? 0) -
        (parseFecha(b.config.vigenciaDesde)?.getTime() ?? 0)
      );
  }
}

type Accion = { id: string; estado: EstadoProducto };

// Sólo las acciones que piden confirmación: activar y restaurar se aplican directo.
export const TEXTO_ACCION: Partial<
  Record<EstadoProducto, { titulo: string; descripcion: string; boton: string }>
> = {
  SUSPENDIDO: {
    titulo: "¿Suspender el producto?",
    descripcion:
      "Deja de ofrecerse en Solicitar crédito. Las solicitudes que ya lo usan conservan su configuración y podés activarlo de nuevo cuando quieras.",
    boton: "Suspender producto",
  },
  ELIMINADO: {
    titulo: "¿Eliminar el producto?",
    descripcion:
      "Deja de ofrecerse y pasa a Eliminados. Se conserva para rotular las solicitudes históricas y se puede restaurar.",
    boton: "Eliminar producto",
  },
};

export function ListaProductos() {
  const router = useRouter();
  const { hidratado } = useApplication();
  const productos = useProductos();
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<EstadoProducto | "">("");
  const [orden, setOrden] = useState<{ campo: Campo; asc: boolean }>({ campo: "codigo", asc: true });
  const [abiertos, setAbiertos] = useState<Record<EstadoProducto, boolean>>({
    ACTIVO: true,
    SUSPENDIDO: false,
    ELIMINADO: false,
  });
  const [nuevo, setNuevo] = useState(false);
  const [pendiente, setPendiente] = useState<Accion | null>(null);

  const q = sinAcentos(busqueda.trim());
  const coincide = (p: ProductoAbm) =>
    !q ||
    sinAcentos(`${p.codigo} ${p.config.nombre} ${p.extras.categoria} ${p.descripcion}`).includes(q);

  const grupos = ORDEN_ESTADOS.filter((e) => !filtro || filtro === e).map((estado) => {
    const filas = productos
      .filter((p) => p.config.estado === estado && coincide(p))
      .sort((a, b) => (orden.asc ? 1 : -1) * comparar(a, b, orden.campo));
    const total = productos.filter((p) => p.config.estado === estado).length;
    const abierto = abiertos[estado] || filtro === estado || (q !== "" && filas.length > 0);
    return { estado, filas, total, abierto };
  });
  const visibles = grupos.flatMap((g) => g.filas);

  function ordenarPor(campo: Campo) {
    setOrden((o) => ({ campo, asc: o.campo === campo ? !o.asc : true }));
  }

  function exportar() {
    const blob = new Blob([productosACsv(visibles)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "productos.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const abrir = (p: ProductoAbm) => router.push(`/productos/${p.config.id}`);
  const cambiar = (p: ProductoAbm, estado: EstadoProducto) => {
    if (estado === "ACTIVO" || (estado === "SUSPENDIDO" && p.config.estado === "ELIMINADO"))
      cambiarEstadoProducto(p.config.id, estado);
    else setPendiente({ id: p.config.id, estado });
  };
  const productoPendiente = productos.find((p) => p.config.id === pendiente?.id);
  const textoPendiente = pendiente ? (TEXTO_ACCION[pendiente.estado] ?? null) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="animate-fade-in">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
          Módulo Créditos · Parámetros
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">Productos</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          El producto es la configuración general del crédito: lo que define acá lo usan el
          onboarding, el motor y el resto del flujo.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button onClick={() => setNuevo(true)}>
          <IconPlus width={16} height={16} />
          Nuevo producto
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
            placeholder="Buscar por nombre, ID o categoría…"
            aria-label="Buscar productos"
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
          {ORDEN_ESTADOS.map((e) => (
            <option key={e} value={e}>
              {ESTADO_PRODUCTO_META[e].label}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <Button variant="outline" onClick={exportar} disabled={visibles.length === 0}>
          <IconArrowDown width={16} height={16} />
          Exportar Excel
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
                        ? "Ningún producto coincide con la búsqueda."
                        : `No hay productos ${ESTADO_PRODUCTO_META[estado].grupo.toLowerCase()}.`}
                    </p>
                  ) : (
                    <table className="w-full min-w-[62rem] table-fixed text-left text-sm">
                      <thead>
                        <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                          {COLUMNAS.map((c) => (
                            <th
                              key={c.campo}
                              aria-sort={
                                orden.campo === c.campo
                                  ? orden.asc
                                    ? "ascending"
                                    : "descending"
                                  : "none"
                              }
                              className={`px-4 py-2.5 ${c.ancho}`}
                            >
                              <button
                                type="button"
                                onClick={() => ordenarPor(c.campo)}
                                className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-ink-700"
                              >
                                {c.label}
                                {orden.campo === c.campo && (
                                  <span aria-hidden>{orden.asc ? "↑" : "↓"}</span>
                                )}
                              </button>
                            </th>
                          ))}
                          <th className="w-64 px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {filas.map((p) => {
                          const vig = estadoVigencia(p.config);
                          return (
                            <tr
                              key={p.config.id}
                              onClick={() => abrir(p)}
                              className="cursor-pointer transition hover:bg-ink-25"
                            >
                              <td className="px-4 py-3 font-mono text-xs font-bold text-brand-700">
                                {p.codigo}
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-semibold text-ink-900">{p.config.nombre}</p>
                                <p className="text-xs text-ink-500">
                                  {p.extras.categoria}
                                  {p.descripcion && ` · ${p.descripcion}`}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge tone={ESTADO_PRODUCTO_META[p.config.estado].tone}>
                                  {ESTADO_PRODUCTO_META[p.config.estado].label}
                                </StatusBadge>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-ink-700">
                                {textoVigencia(p.config)}
                                {vig !== "VIGENTE" && (
                                  <span className="ml-2 rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-700">
                                    {vig === "VENCIDA" ? "Vencida" : "Por iniciar"}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div
                                  className="flex justify-end gap-1.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button size="sm" variant="outline" onClick={() => abrir(p)}>
                                    Abrir
                                  </Button>
                                  {p.config.estado === "ACTIVO" && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => cambiar(p, "SUSPENDIDO")}
                                    >
                                      Suspender
                                    </Button>
                                  )}
                                  {p.config.estado === "SUSPENDIDO" && (
                                    <Button size="sm" variant="ghost" onClick={() => cambiar(p, "ACTIVO")}>
                                      Activar
                                    </Button>
                                  )}
                                  {p.config.estado === "ELIMINADO" ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => cambiar(p, "SUSPENDIDO")}
                                    >
                                      Restaurar
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => cambiar(p, "ELIMINADO")}
                                    >
                                      Eliminar
                                    </Button>
                                  )}
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

      <NuevoProductoModal open={nuevo} onClose={() => setNuevo(false)} />
      <ConfirmationModal
        open={pendiente !== null && productoPendiente !== undefined}
        title={textoPendiente?.titulo ?? ""}
        descripcion={textoPendiente?.descripcion}
        rows={[
          { label: "Producto", value: productoPendiente?.config.nombre ?? "—" },
          { label: "ID", value: productoPendiente?.codigo ?? "—" },
        ]}
        confirmLabel={textoPendiente?.boton ?? ""}
        cancelLabel="Volver"
        tone="danger"
        onConfirm={() => {
          if (pendiente) cambiarEstadoProducto(pendiente.id, pendiente.estado);
          setPendiente(null);
        }}
        onCancel={() => setPendiente(null)}
      />
    </div>
  );
}
