"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApplication } from "@/lib/application-context";
import type { EstadoProducto } from "@/lib/config";
import { estadoVigencia } from "@/lib/productos";
import {
  cambiarEstadoOrganismo,
  productosConExcepciones,
  totalExcepciones,
  useOrganismos,
  type OrganismoAbm,
} from "@/lib/organismos";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ESTADO_PRODUCTO_META } from "@/components/productos/ListaProductos";
import { NuevoOrganismoModal } from "./NuevoOrganismoModal";
import { TEXTO_ACCION_ORG } from "./DetalleOrganismo";
import { IconChevronDown, IconPlus, IconSearch } from "@/components/icons";

type Campo = "codigo" | "nombre" | "estado" | "vigencia" | "productos" | "excepciones";

const ORDEN_ESTADOS: EstadoProducto[] = ["ACTIVO", "SUSPENDIDO", "ELIMINADO"];

// Anchos fijos para que las columnas queden alineadas entre los tres grupos.
const COLUMNAS: { campo: Campo; label: string; ancho: string }[] = [
  { campo: "codigo", label: "ID", ancho: "w-16" },
  { campo: "nombre", label: "Nombre", ancho: "" },
  { campo: "estado", label: "Estado", ancho: "w-28" },
  { campo: "vigencia", label: "Vigencia", ancho: "w-44" },
  { campo: "productos", label: "Prod.", ancho: "w-20" },
  { campo: "excepciones", label: "Excepciones", ancho: "w-48" },
];

const sinAcentos = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function comparar(a: OrganismoAbm, b: OrganismoAbm, campo: Campo): number {
  switch (campo) {
    case "codigo":
      return a.codigo.localeCompare(b.codigo);
    case "nombre":
      return a.config.nombre.localeCompare(b.config.nombre, "es");
    case "estado":
      return ORDEN_ESTADOS.indexOf(a.config.estado) - ORDEN_ESTADOS.indexOf(b.config.estado);
    case "vigencia":
      return a.config.vigenciaDesde.split("/").reverse().join("").localeCompare(
        b.config.vigenciaDesde.split("/").reverse().join("")
      );
    case "productos":
      return a.config.productos.length - b.config.productos.length;
    case "excepciones":
      return totalExcepciones(a) - totalExcepciones(b);
  }
}

export function ListaOrganismos() {
  const router = useRouter();
  const { hidratado } = useApplication();
  const organismos = useOrganismos();
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<EstadoProducto | "">("");
  const [orden, setOrden] = useState<{ campo: Campo; asc: boolean }>({ campo: "codigo", asc: true });
  const [abiertos, setAbiertos] = useState<Record<EstadoProducto, boolean>>({
    ACTIVO: true,
    SUSPENDIDO: false,
    ELIMINADO: false,
  });
  const [nuevo, setNuevo] = useState(false);
  const [pendiente, setPendiente] = useState<{ id: string; estado: EstadoProducto } | null>(null);

  const q = sinAcentos(busqueda.trim());
  const coincide = (o: OrganismoAbm) =>
    !q ||
    sinAcentos(`${o.codigo} ${o.config.nombre} ${o.config.detalle ?? ""} ${o.extras.rubro}`).includes(q);

  const grupos = ORDEN_ESTADOS.filter((e) => !filtro || filtro === e).map((estado) => {
    const filas = organismos
      .filter((o) => o.config.estado === estado && coincide(o))
      .sort((a, b) => (orden.asc ? 1 : -1) * comparar(a, b, orden.campo));
    const total = organismos.filter((o) => o.config.estado === estado).length;
    const abierto = abiertos[estado] || filtro === estado || (q !== "" && filas.length > 0);
    return { estado, filas, total, abierto };
  });

  const abrir = (o: OrganismoAbm) => router.push(`/organismos/${o.config.id}`);
  const cambiar = (o: OrganismoAbm, estado: EstadoProducto) => {
    if (estado === "ACTIVO" || (estado === "SUSPENDIDO" && o.config.estado === "ELIMINADO"))
      cambiarEstadoOrganismo(o.config.id, estado);
    else setPendiente({ id: o.config.id, estado });
  };
  const organismoPendiente = organismos.find((o) => o.config.id === pendiente?.id);
  const textoPendiente = pendiente ? (TEXTO_ACCION_ORG[pendiente.estado] ?? null) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="animate-fade-in">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
          Módulo Créditos · Parámetros
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">Organismos</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          El organismo no define su configuración completa: hereda la del producto y sólo guarda
          las excepciones. Abrí uno para ver qué hereda y qué pisa.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button onClick={() => setNuevo(true)}>
          <IconPlus width={16} height={16} />
          Nuevo organismo
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
            placeholder="Buscar por nombre, ID o rubro…"
            aria-label="Buscar organismos"
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
                        ? "Ningún organismo coincide con la búsqueda."
                        : `No hay organismos ${ESTADO_PRODUCTO_META[estado].grupo.toLowerCase()}.`}
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
                              className={`px-3 py-2.5 ${c.ancho}`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setOrden((o) => ({
                                    campo: c.campo,
                                    asc: o.campo === c.campo ? !o.asc : true,
                                  }))
                                }
                                className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-ink-700"
                              >
                                {c.label}
                                {orden.campo === c.campo && (
                                  <span aria-hidden>{orden.asc ? "↑" : "↓"}</span>
                                )}
                              </button>
                            </th>
                          ))}
                          <th className="w-56 px-3 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {filas.map((o) => {
                          const excepciones = totalExcepciones(o);
                          return (
                            <tr
                              key={o.config.id}
                              onClick={() => abrir(o)}
                              className="cursor-pointer transition hover:bg-ink-25"
                            >
                              <td className="px-3 py-3 font-mono text-xs font-bold text-brand-700">
                                {o.codigo}
                              </td>
                              <td className="px-3 py-3">
                                <p className="font-semibold text-ink-900">{o.config.nombre}</p>
                                <p className="text-xs text-ink-500">{o.config.detalle}</p>
                              </td>
                              <td className="px-3 py-3">
                                <StatusBadge tone={ESTADO_PRODUCTO_META[o.config.estado].tone}>
                                  {ESTADO_PRODUCTO_META[o.config.estado].label}
                                </StatusBadge>
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-ink-700">
                                {o.config.vigenciaHasta
                                  ? `${o.config.vigenciaDesde} al ${o.config.vigenciaHasta}`
                                  : `Desde ${o.config.vigenciaDesde}`}
                                {estadoVigencia(o.config) !== "VIGENTE" && (
                                  <span className="ml-2 rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-700">
                                    {estadoVigencia(o.config) === "VENCIDA" ? "Vencida" : "Por iniciar"}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 tabular-nums text-ink-700">
                                {o.config.productos.length}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex flex-col items-start gap-1">
                                  {excepciones === 0 ? (
                                    <span className="text-xs text-ink-400">Hereda todo</span>
                                  ) : (
                                    <span
                                      title={`${excepciones} excepciones en total`}
                                      className="whitespace-nowrap rounded-full border border-warning-300 bg-warning-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-warning-700"
                                    >
                                      En {productosConExcepciones(o)} de {o.config.productos.length}{" "}
                                      productos
                                    </span>
                                  )}
                                  {o.pendiente && (
                                    <span className="whitespace-nowrap rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                                      Pendiente de refrendación
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <div
                                  className="flex justify-end gap-1.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button size="sm" variant="outline" onClick={() => abrir(o)}>
                                    Abrir
                                  </Button>
                                  {o.config.estado === "ACTIVO" && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => cambiar(o, "SUSPENDIDO")}
                                    >
                                      Suspender
                                    </Button>
                                  )}
                                  {o.config.estado === "SUSPENDIDO" && (
                                    <Button size="sm" variant="ghost" onClick={() => cambiar(o, "ACTIVO")}>
                                      Activar
                                    </Button>
                                  )}
                                  {o.config.estado === "ELIMINADO" ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => cambiar(o, "SUSPENDIDO")}
                                    >
                                      Restaurar
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => cambiar(o, "ELIMINADO")}
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

      <NuevoOrganismoModal open={nuevo} onClose={() => setNuevo(false)} />
      <ConfirmationModal
        open={pendiente !== null && organismoPendiente !== undefined}
        title={textoPendiente?.titulo ?? ""}
        descripcion={textoPendiente?.descripcion}
        rows={[
          { label: "Organismo", value: organismoPendiente?.config.nombre ?? "—" },
          { label: "ID", value: organismoPendiente?.codigo ?? "—" },
        ]}
        confirmLabel={textoPendiente?.boton ?? ""}
        cancelLabel="Volver"
        tone="danger"
        onConfirm={() => {
          if (pendiente) cambiarEstadoOrganismo(pendiente.id, pendiente.estado);
          setPendiente(null);
        }}
        onCancel={() => setPendiente(null)}
      />
    </div>
  );
}
