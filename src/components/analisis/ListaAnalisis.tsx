"use client";

import { useEffect, useState } from "react";
import { useApplication } from "@/lib/application-context";
import { fechaVisibleAnalista, ordenarPorFechaVisibleAnalista } from "@/lib/creditos-db";
import { CANALES, ORGANISMOS, PRODUCTOS, SESION_ANALISTA, VENDEDORES, nombreOpcion } from "@/lib/config";
import { coincideCliente, formatARS, formatDNI } from "@/lib/format";
import type { EstadoCredito } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { IconChevronDown, IconFileStack, IconRows, IconSearch, IconTable } from "@/components/icons";
import { FilaCreditoCollapse } from "./FilaCreditoCollapse";

type Vista = "tabla" | "lista";

type Pestana = "TODOS" | "PRE" | "OBS" | "COFE" | "RECH" | "APR" | "FEL" | "AFEL" | "SUP" | "CHEQ" | "LIQ";

// Bandeja del analista — 7 estados (desde preaprobado en adelante) de creditonet-34.
// Las observadas pendientes del vendedor no figuran (las ve él en su bandeja); OBS muestra
// las que ya corrigió y reenvió: entran a OBS, no a PRE. PRE = para tomar o ya tomadas por un analista.
type DefPestana = { id: Pestana; titulo: string; estados: EstadoCredito[]; vacio: string; reenviadas?: boolean };

const PESTANAS_ESTADO: DefPestana[] = [
  {
    id: "PRE",
    titulo: "Preaprobados",
    estados: ["PREAPROBADO", "ANALISIS_TOMADO"],
    vacio: "No hay solicitudes preaprobadas para tomar.",
    reenviadas: false,
  },
  {
    id: "OBS",
    titulo: "Observadas reenviadas",
    estados: ["PREAPROBADO", "ANALISIS_TOMADO"],
    vacio: "No hay observadas corregidas y reenviadas por el vendedor.",
    reenviadas: true,
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
    id: "APR",
    titulo: "Aprobados",
    estados: ["APROBADO"],
    vacio: "No hay solicitudes aprobadas pendientes de pasar a firma.",
  },
  {
    id: "FEL",
    titulo: "En firma",
    estados: ["EN_FIRMA"],
    vacio: "No hay solicitudes en firma.",
  },
  {
    id: "AFEL",
    titulo: "Firma aprobada",
    estados: ["FIRMADO"],
    vacio: "No hay firmas aprobadas.",
  },
  {
    id: "CHEQ",
    titulo: "Chequeo telefónico",
    estados: ["CHEQUEO_TELEFONICO"],
    vacio: "No hay solicitudes en chequeo telefónico.",
  },
  {
    id: "LIQ",
    titulo: "Para liquidar",
    estados: ["PARA_LIQUIDAR"],
    vacio: "No hay solicitudes aprobadas para liquidar.",
  },
  {
    id: "SUP",
    titulo: "Aprobación superior",
    estados: ["SUPERIOR"],
    vacio: "No hay solicitudes pendientes de aprobación de un superior.",
  },
];

// "Todos": une los estados de las demás pestañas.
const PESTANAS: DefPestana[] = [
  {
    id: "TODOS",
    titulo: "Todos",
    estados: PESTANAS_ESTADO.flatMap((p) => p.estados),
    vacio: "No hay solicitudes para analizar.",
  },
  ...PESTANAS_ESTADO,
];

// Filtro de perfil: qué créditos ve el analista. Un crédito está asignado a quien lo tomó; las
// observadas y las que nadie tomó figuran "Sin asignar" (misma regla que la columna Analista).
type PerfilAnalista = "" | "MIOS" | "SIN_ASIGNAR";
const asignadoAlAnalista = (c: { estado: EstadoCredito; analista: { tomado: boolean } }) =>
  c.estado !== "OBSERVADO" && c.analista.tomado;
const coincidePerfil = (
  perfil: PerfilAnalista,
  c: { estado: EstadoCredito; analista: { tomado: boolean } }
) => !perfil || (perfil === "MIOS") === asignadoAlAnalista(c);

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
  const { app, creditosDB, cargarCreditoDeDB } = useApplication();
  const [eleccion, setEleccion] = useState<Pestana | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [canal, setCanal] = useState("");
  const [perfil, setPerfil] = useState<PerfilAnalista>("");
  const [colapsado, setColapsado] = useState(false);
  const [vista, setVista] = useState<Vista>("tabla");
  const [pagina, setPagina] = useState<Record<Pestana, number>>({
    TODOS: 1,
    PRE: 1,
    OBS: 1,
    COFE: 1,
    RECH: 1,
    APR: 1,
    FEL: 1,
    AFEL: 1,
    CHEQ: 1,
    LIQ: 1,
    SUP: 1,
  });
  const POR_PAGINA = 5;

  const cliente = app.cliente;
  const propia = PESTANAS_ESTADO.find((p) => p.estados.includes(app.estado));
  // Sin elección explícita se muestra la pestaña donde está la solicitud; si no hay solicitud, default PRE.
  const activa = PESTANAS.find((p) => p.id === (eleccion ?? propia?.id ?? "PRE")) ?? PESTANAS[0];

  // DB simulada: créditos filtrados por pestaña, canal y búsqueda, ordenados por la misma
  // fecha que se muestra en la columna "Fecha" de esa pestaña (creditonet-67).
  function creditosDBEnPestana(p: Pestana) {
    const def = PESTANAS.find((x) => x.id === p)!;
    const filtrados = creditosDB.filter((c) => {
      if (!def.estados.includes(c.estado)) return false;
      // PRE = primeras (excluye reenviadas); OBS = sólo reenviadas.
      if (def.reenviadas !== undefined && c.analista.reenviada !== def.reenviadas) return false;
      if (canal && c.configuracion.canalId !== canal) return false;
      if (!coincidePerfil(perfil, c)) return false;
      if (busqueda.trim() && c.cliente && !coincideCliente(c.cliente, busqueda)) return false;
      if (busqueda.trim() && !c.cliente) return false;
      return true;
    });
    return ordenarPorFechaVisibleAnalista(filtrados);
  }

  // La solicitud en curso también aparece en "Todos".
  const propiaEn = (p: Pestana) => propia !== undefined && (p === "TODOS" || propia.id === p);

  const visible =
    cliente !== null &&
    app.numeroCredito !== null &&
    propia !== undefined &&
    (!canal || app.configuracion.canalId === canal) &&
    coincidePerfil(perfil, app) &&
    coincideCliente(cliente, busqueda);

  // Filas = DB + solicitud en curso (si coincide y no está ya en DB)
  const filas = (p: Pestana) => {
    const dbCount = creditosDBEnPestana(p).length;
    const extra = visible && propiaEn(p) && !creditosDB.some((c) => c.numeroCredito === app.numeroCredito) ? 1 : 0;
    return dbCount + extra;
  };

  const listaActiva = creditosDBEnPestana(activa.id);
  const totalPaginas = Math.ceil(listaActiva.length / POR_PAGINA) || 1;
  const paginaActual = Math.min(pagina[activa.id] ?? 1, totalPaginas);
  const inicio = (paginaActual - 1) * POR_PAGINA;
  const paginados = listaActiva.slice(inicio, inicio + POR_PAGINA);

  // Reset paginación al cambiar filtros o pestaña
  const resetPagina = (p: Pestana) => setPagina((prev) => ({ ...prev, [p]: 1 }));

  const fechaApp = fechaVisibleAnalista(app);

  useEffect(() => {
    setPagina((prev) => ({ ...prev, [activa.id]: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, canal, perfil, activa.id]);

  useEffect(() => {
    setColapsado(false);
  }, [activa.id]);

  function cargarCreditoDB(c: (typeof creditosDB)[number]) {
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
        <select
          value={perfil}
          onChange={(e) => setPerfil(e.target.value as PerfilAnalista)}
          aria-label="Filtro perfil"
          className="h-10 rounded-lg border border-ink-300 bg-white px-3 text-sm text-ink-700 shadow-xs outline-none transition hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        >
          <option value="">Perfil: todos</option>
          <option value="MIOS">Mis créditos</option>
          <option value="SIN_ASIGNAR">Sin asignar</option>
        </select>
        <div role="group" aria-label="Vista" className="ml-auto inline-flex rounded-lg border border-ink-300 bg-white p-0.5 shadow-xs">
          {(
            [
              { id: "tabla", titulo: "Tabla", Icono: IconTable },
              { id: "lista", titulo: "Lista", Icono: IconRows },
            ] as const
          ).map(({ id, titulo, Icono }) => (
            <button
              key={id}
              type="button"
              aria-pressed={vista === id}
              onClick={() => setVista(id)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition ${
                vista === id ? "bg-brand-600 text-white shadow-sm" : "text-ink-600 hover:bg-ink-50"
              }`}
            >
              <Icono width={15} height={15} />
              {titulo}
            </button>
          ))}
        </div>
      </div>

      <div role="tablist" aria-label="Estados" className="flex flex-wrap gap-2">
        {PESTANAS.map((p) => {
          const seleccionada = p.id === activa.id;
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={seleccionada}
              onClick={() => {
                setEleccion(p.id);
                setColapsado(false);
              }}
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

      <div className="flex items-center justify-between gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2">
        <button onClick={() => setColapsado((v) => !v)} className="flex items-center gap-2 text-left">
          <IconChevronDown width={16} height={16} className={`text-ink-500 transition-transform ${colapsado ? "-rotate-90" : ""}`} />
          <span className="text-xs font-bold uppercase tracking-widest text-ink-700">{activa.titulo}</span>
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-500">
            {filas(activa.id)}
          </span>
          {listaActiva.length > POR_PAGINA && !colapsado && (
            <span className="hidden text-[11px] text-ink-400 sm:inline">
              · pág. {paginaActual}/{totalPaginas} · 5 por página
            </span>
          )}
        </button>
        <button
          onClick={() => setColapsado((v) => !v)}
          aria-label={colapsado ? "Expandir" : "Colapsar"}
          className="rounded p-1 hover:bg-ink-100 transition"
        >
          <IconChevronDown width={16} height={16} className={`text-ink-400 transition-transform ${colapsado ? "-rotate-180" : ""}`} />
        </button>
      </div>

      {!colapsado && (
        <Card className="overflow-hidden">
          {filas(activa.id) === 0 ? (
            <p className="flex items-center justify-center gap-2 px-5 py-8 text-center text-sm text-ink-400">
              <IconFileStack width={15} height={15} />
              {propiaEn(activa.id) && (busqueda.trim() || canal || perfil)
                ? "Ninguna solicitud coincide con la búsqueda o el filtro."
                : activa.vacio}
            </p>
          ) : (
            <>
              {vista === "lista" && (
                <div className="space-y-3 bg-ink-25 p-3">
                  {paginados.map((c) => (
                    <FilaCreditoCollapse
                      // La pestaña y la página en la key: al cambiarlas las filas vuelven a colapsarse.
                      key={`${activa.id}-${paginaActual}-${c.numeroCredito ?? c.cliente!.dni}`}
                      credito={c}
                      onAbrir={() => cargarCreditoDB(c)}
                    />
                  ))}
                  {visible && propiaEn(activa.id) && !creditosDB.some((c) => c.numeroCredito === app.numeroCredito) && paginaActual === 1 && (
                    <FilaCreditoCollapse key={`${activa.id}-en-curso`} credito={app} onAbrir={onAbrir} enCurso />
                  )}
                </div>
              )}
              <div className={`overflow-x-auto ${vista === "lista" ? "hidden" : ""}`}>
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
                    {paginados.map((c) => {
                      const cli = c.cliente!;
                      const fecha = fechaVisibleAnalista(c);
                      // Reenviada sin tomar: en esta bandeja se lee "Observado", no "Preaprobado".
                      const estadoVisible =
                        c.analista.reenviada && c.estado === "PREAPROBADO" ? "OBSERVADO" : c.estado;
                      return (
                        <tr
                          key={c.numeroCredito ?? cli.dni}
                          className="cursor-pointer align-middle transition hover:bg-ink-25"
                          onClick={() => cargarCreditoDB(c)}
                          title={c._descripcion}
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
                          <td className="px-3 py-3 font-mono tabular-nums text-ink-700">{c.numeroCliente ?? "—"}</td>
                          <td className="px-3 py-3 text-ink-700">{nombreOpcion(PRODUCTOS, c.configuracion.productoId)}</td>
                          <td className="px-3 py-3 text-ink-700">{nombreOpcion(ORGANISMOS, c.configuracion.organismoId)}</td>
                          <td className="px-3 py-3 text-ink-700">{nombreOpcion(VENDEDORES, c.configuracion.vendedorId)}</td>
                          <td className="px-3 py-3 font-semibold tabular-nums text-ink-900">{formatARS(c.oferta.montoSolicitado)}</td>
                          <td className="px-3 py-3 font-semibold tabular-nums text-ink-900">{formatARS(c.oferta.valorCuota)}</td>
                          <td className="px-3 py-3 tabular-nums text-ink-700">{c.oferta.plazo}</td>
                          <td className="px-3 py-3">
                            <EstadoBadge estado={estadoVisible} conCodigo />
                          </td>
                          <td className="px-3 py-3 text-ink-700">{fecha ?? "—"}</td>
                          <td className="px-3 py-3 text-ink-700">
                            {c.estado === "OBSERVADO" || !c.analista.tomado ? "Sin asignar" : SESION_ANALISTA.nombre}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <Button size="sm" variant="outline" onClick={() => cargarCreditoDB(c)}>
                              Abrir
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {visible && propiaEn(activa.id) && !creditosDB.some((c) => c.numeroCredito === app.numeroCredito) && cliente && paginaActual === 1 && (
                      <tr className="cursor-pointer align-middle bg-brand-50/50 transition hover:bg-ink-25" onClick={onAbrir}>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-ink-900">
                            {cliente.nombre} {cliente.apellido} <span className="ml-1 rounded bg-brand-600 px-1.5 py-0.5 text-[10px] text-white">En curso</span>
                          </p>
                          <p className="font-mono text-[11px] font-bold text-brand-700">{app.numeroCredito}</p>
                        </td>
                        <td className="px-3 py-3 tabular-nums text-ink-700">{formatDNI(cliente.dni)}</td>
                        <td className="px-3 py-3 font-mono tabular-nums text-ink-700">{app.numeroCliente ?? "—"}</td>
                        <td className="px-3 py-3 text-ink-700">{nombreOpcion(PRODUCTOS, app.configuracion.productoId)}</td>
                        <td className="px-3 py-3 text-ink-700">{nombreOpcion(ORGANISMOS, app.configuracion.organismoId)}</td>
                        <td className="px-3 py-3 text-ink-700">{nombreOpcion(VENDEDORES, app.configuracion.vendedorId)}</td>
                        <td className="px-3 py-3 font-semibold tabular-nums text-ink-900">{formatARS(app.oferta.montoSolicitado)}</td>
                        <td className="px-3 py-3 font-semibold tabular-nums text-ink-900">{formatARS(app.oferta.valorCuota)}</td>
                        <td className="px-3 py-3 tabular-nums text-ink-700">{app.oferta.plazo}</td>
                        <td className="px-3 py-3">
                          <EstadoBadge
                            estado={
                              app.analista.reenviada && app.estado === "PREAPROBADO"
                                ? "OBSERVADO"
                                : app.estado
                            }
                            conCodigo
                          />
                        </td>
                        <td className="px-3 py-3 text-ink-700">{fechaApp ?? "—"}</td>
                        <td className="px-3 py-3 text-ink-700">
                          {app.estado === "OBSERVADO" || !app.analista.tomado ? "Sin asignar" : SESION_ANALISTA.nombre}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Button size="sm" variant="outline" onClick={onAbrir}>
                            Abrir
                          </Button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {listaActiva.length > POR_PAGINA && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 bg-ink-25 px-5 py-3">
                  <p className="text-xs text-ink-500">
                    Mostrando {inicio + 1}–{Math.min(inicio + POR_PAGINA, listaActiva.length)} de {listaActiva.length} · 5 por página
                  </p>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" disabled={paginaActual <= 1} onClick={() => setPagina((p) => ({ ...p, [activa.id]: paginaActual - 1 }))}>
                      Anterior
                    </Button>
                    {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        onClick={() => setPagina((p) => ({ ...p, [activa.id]: n }))}
                        className={`min-w-8 rounded-lg px-2.5 py-1.5 text-xs font-bold ${n === paginaActual ? "bg-brand-600 text-white shadow-sm" : "bg-white text-ink-700 hover:bg-ink-100 border border-ink-200"}`}
                      >
                        {n}
                      </button>
                    ))}
                    <Button size="sm" variant="ghost" disabled={paginaActual >= totalPaginas} onClick={() => setPagina((p) => ({ ...p, [activa.id]: paginaActual + 1 }))}>
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}
      <p className="text-center text-[11px] text-ink-400">
        DB simulada: {creditosDB.length} préstamos · {creditosDB.filter((c) => c._bandeja === "vendedor").length} vendedor /{" "}
        {creditosDB.filter((c) => c._bandeja === "analista").length} analista · <code className="rounded bg-ink-100 px-1">src/data/creditos.json</code>
      </p>
    </div>
  );
}
