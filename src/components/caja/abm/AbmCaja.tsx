"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { useApplication } from "@/lib/application-context";
import { auditar, cambios, useAuditoria } from "@/lib/caja-store";
import { crearXlsx } from "@/lib/xlsx";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IconChevronDown, IconPlus, IconSearch } from "@/components/icons";

type Tono = ComponentProps<typeof StatusBadge>["tone"];

interface Base {
  id: string;
  estado: string;
}

interface Almacen<T> {
  get: () => T[];
  commit: (lista: T[]) => void;
}

export interface EstadoDef {
  valor: string;
  label: string;
  grupo: string;
  tone: Tono;
  abierto: boolean;
}

export interface Columna<T> {
  clave: string;
  label: string;
  ancho?: string;
  valor: (r: T) => string | number;
  render?: (r: T) => ReactNode;
}

export interface Accion {
  estado: string;
  label: string;
  peligro?: boolean;
}

export const ESTADOS_TRES: EstadoDef[] = [
  { valor: "ACTIVO", label: "Activo", grupo: "Activos", tone: "success", abierto: true },
  { valor: "SUSPENDIDO", label: "Suspendido", grupo: "Suspendidos", tone: "warning", abierto: false },
  { valor: "ELIMINADO", label: "Eliminado", grupo: "Eliminados", tone: "neutral", abierto: false },
];

export const accionesTres = (r: Base): Accion[] =>
  r.estado === "ACTIVO"
    ? [
        { estado: "SUSPENDIDO", label: "Suspender", peligro: true },
        { estado: "ELIMINADO", label: "Eliminar", peligro: true },
      ]
    : r.estado === "SUSPENDIDO"
      ? [
          { estado: "ACTIVO", label: "Activar" },
          { estado: "ELIMINADO", label: "Eliminar", peligro: true },
        ]
      : [{ estado: "SUSPENDIDO", label: "Restaurar" }];

type Plano = Record<string, unknown>;

// Graba un alta o una modificación y la audita (usuario, fecha y hora, valor anterior y nuevo).
export function persistir<T extends Base>(store: Almacen<T>, entidad: string, antes: T | null, despues: T) {
  const lista = store.get();
  store.commit(antes ? lista.map((r) => (r.id === despues.id ? despues : r)) : [...lista, despues]);
  const c = cambios(antes as Plano | null, despues as Plano);
  auditar(entidad, despues.id, antes ? "MODIFICACION" : "ALTA", c.antes, c.despues);
}

function cambiarEstado<T extends Base>(store: Almacen<T>, entidad: string, r: T, estado: string) {
  store.commit(store.get().map((x) => (x.id === r.id ? { ...x, estado } : x)));
  auditar(entidad, r.id, "ESTADO", r.estado, estado);
}

export const sinAcentos = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function descargarXlsx(nombreArchivo: string, hoja: string, filas: string[][]) {
  const blob = new Blob([crearXlsx(hoja, filas) as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Modal de alta o modificación: Grabar / Cancelar.
export function ModalFormulario({
  titulo,
  onClose,
  onGrabar,
  maxWidth = "max-w-2xl",
  children,
}: {
  titulo: string;
  onClose: () => void;
  onGrabar: () => void;
  maxWidth?: string;
  children: ReactNode;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={titulo}
      maxWidth={maxWidth}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onGrabar}>Grabar</Button>
        </div>
      }
    >
      {children}
    </Modal>
  );
}

function Historial({ entidad, id, nombre, onClose }: { entidad: string; id: string; nombre: string; onClose: () => void }) {
  const filas = useAuditoria()
    .filter((a) => a.entidad === entidad && a.registroId === id)
    .reverse();
  return (
    <Modal
      open
      onClose={onClose}
      title={`Historial · ${nombre}`}
      maxWidth="max-w-3xl"
      footer={
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Retornar
          </Button>
        </div>
      }
    >
      {filas.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-400">
          Todavía no hay cambios registrados. El historial muestra las altas, modificaciones y cambios de estado
          hechos desde esta sesión.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                <th className="px-2 py-2">Fecha y hora</th>
                <th className="px-2 py-2">Usuario</th>
                <th className="px-2 py-2">Acción</th>
                <th className="px-2 py-2">Valor anterior</th>
                <th className="px-2 py-2">Valor nuevo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 align-top">
              {filas.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap px-2 py-2 text-ink-700">{a.fechaHora}</td>
                  <td className="px-2 py-2 text-ink-700">{a.usuario}</td>
                  <td className="px-2 py-2 text-ink-700">
                    {a.accion === "ALTA" ? "Alta" : a.accion === "MODIFICACION" ? "Modificación" : "Cambio de estado"}
                  </td>
                  <td className="px-2 py-2 text-xs text-ink-500">{a.antes ?? "—"}</td>
                  <td className="px-2 py-2 text-xs text-ink-700">{a.despues ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

interface Props<T extends Base> {
  entidad: string;
  archivo: string;
  singular: string;
  plural: string;
  nuevoLabel: string;
  registros: T[];
  store: Almacen<T>;
  columnas: Columna<T>[];
  estados: EstadoDef[];
  nombreDe: (r: T) => string;
  acciones?: (r: T) => Accion[];
  errorAccion?: (r: T, a: Accion) => string | undefined;
  formulario: (p: { inicial: T | null; onClose: () => void }) => ReactNode;
}

const buscable = (r: Base, nombre: string) => sinAcentos(`${r.id} ${nombre}`);

export function AbmCaja<T extends Base>({
  entidad,
  archivo,
  singular,
  plural,
  nuevoLabel,
  registros,
  store,
  columnas,
  estados,
  nombreDe,
  acciones = accionesTres,
  errorAccion,
  formulario,
}: Props<T>) {
  const { hidratado } = useApplication();
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("");
  const [orden, setOrden] = useState<{ clave: string; asc: boolean }>({ clave: "id", asc: true });
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>(
    Object.fromEntries(estados.map((e) => [e.valor, e.abierto]))
  );
  const [edicion, setEdicion] = useState<{ registro: T | null } | null>(null);
  const [historial, setHistorial] = useState<T | null>(null);
  const [pendiente, setPendiente] = useState<{ registro: T; accion: Accion } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const todas: Columna<T>[] = [{ clave: "id", label: "ID", ancho: "w-24", valor: (r) => r.id }, ...columnas];
  const q = sinAcentos(busqueda.trim());
  const filtrando = q !== "";

  const grupos = estados
    .filter((e) => !filtro || filtro === e.valor)
    .map((estado) => {
      const col = todas.find((c) => c.clave === orden.clave) ?? todas[0];
      const filas = registros
        .filter((r) => r.estado === estado.valor && (!q || buscable(r, nombreDe(r)).includes(q)))
        .sort((a, b) => {
          const x = col.valor(a);
          const y = col.valor(b);
          const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es");
          return orden.asc ? c : -c;
        });
      const total = registros.filter((r) => r.estado === estado.valor).length;
      const abierto = abiertos[estado.valor] || filtro === estado.valor || (filtrando && filas.length > 0);
      return { estado, filas, total, abierto };
    });

  const aplicar = (r: T, a: Accion) => {
    cambiarEstado(store, entidad, r, a.estado);
    setError(null);
  };
  const pedir = (r: T, a: Accion) => {
    const impedimento = errorAccion?.(r, a);
    if (impedimento) {
      setError(`No se pudo ${a.label.toLowerCase()} ${nombreDe(r)}: ${impedimento}`);
      return;
    }
    if (a.peligro) setPendiente({ registro: r, accion: a });
    else aplicar(r, a);
  };

  const exportar = () => {
    const encabezado = [...todas.map((c) => c.label), "Estado"];
    const filas = registros.map((r) => [
      ...todas.map((c) => String(c.valor(r))),
      estados.find((e) => e.valor === r.estado)?.label ?? r.estado,
    ]);
    descargarXlsx(`${archivo}.xlsx`, plural, [encabezado, ...filas]);
  };

  const campoInput =
    "h-10 rounded-lg border border-ink-300 bg-white px-3 text-sm text-ink-700 shadow-xs outline-none transition hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setEdicion({ registro: null })}>
          <IconPlus width={16} height={16} />
          {nuevoLabel}
        </Button>
        <Button variant="outline" onClick={exportar}>
          Exportar a Excel
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
            placeholder="Buscar por nombre o ID…"
            aria-label={`Buscar ${plural}`}
            className={`${campoInput} w-full pl-9 placeholder:text-ink-400`}
          />
        </div>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar por estado" className={campoInput}>
          <option value="">Estado: todos</option>
          {estados.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mt-4">
          <Banner tone="error" title="Acción no permitida">
            {error}
          </Banner>
        </div>
      )}

      <div className="mt-5 space-y-4">
        {!hidratado ? (
          <Card className="px-5 py-8 text-center text-sm text-ink-400">Cargando…</Card>
        ) : (
          grupos.map(({ estado, filas, total, abierto }) => (
            <Card key={estado.valor} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setAbiertos((a) => ({ ...a, [estado.valor]: !a[estado.valor] }))}
                aria-expanded={abierto}
                className="flex w-full items-center gap-2 px-5 py-3.5 text-left transition hover:bg-ink-25"
              >
                <IconChevronDown
                  width={16}
                  height={16}
                  className={`text-ink-400 transition-transform ${abierto ? "" : "-rotate-90"}`}
                />
                <h3 className="text-xs font-bold uppercase tracking-widest text-ink-700">{estado.grupo}</h3>
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-500">
                  {filtrando || filtro ? `${filas.length} de ${total}` : total}
                </span>
              </button>
              {abierto && (
                <div className="overflow-x-auto border-t border-ink-100">
                  {filas.length === 0 ? (
                    <p className="px-5 py-6 text-center text-sm text-ink-400">
                      {filtrando
                        ? "Ningún registro coincide con la búsqueda."
                        :`No hay ${plural} ${estado.grupo.toLowerCase()}.`}
                    </p>
                  ) : (
                    <table className="w-full min-w-[52rem] text-left text-sm">
                      <thead>
                        <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                          {todas.map((c) => (
                            <th
                              key={c.clave}
                              aria-sort={orden.clave === c.clave ? (orden.asc ? "ascending" : "descending") : "none"}
                              className={`px-3 py-2.5 ${c.ancho ?? ""}`}
                            >
                              <button
                                type="button"
                                onClick={() => setOrden((o) => ({ clave: c.clave, asc: o.clave === c.clave ? !o.asc : true }))}
                                className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-ink-700"
                              >
                                {c.label}
                                {orden.clave === c.clave && <span aria-hidden>{orden.asc ? "↑" : "↓"}</span>}
                              </button>
                            </th>
                          ))}
                          <th className="w-28 px-3 py-2.5">Estado</th>
                          <th className="px-3 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {filas.map((r) => (
                          <tr key={r.id} className="transition hover:bg-ink-25">
                            {todas.map((c) => (
                              <td
                                key={c.clave}
                                className={
                                  c.clave === "id"
                                    ? "px-3 py-3 font-mono text-xs font-bold text-brand-700"
                                    : "px-3 py-3 text-ink-700"
                                }
                              >
                                {c.render ? c.render(r) : c.valor(r)}
                              </td>
                            ))}
                            <td className="px-3 py-3">
                              <StatusBadge tone={estado.tone}>{estado.label}</StatusBadge>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap justify-end gap-1.5">
                                {r.estado !== "ELIMINADO" && (
                                  <Button size="sm" variant="outline" onClick={() => setEdicion({ registro: r })}>
                                    Modificar
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => setHistorial(r)}>
                                  Historial
                                </Button>
                                {acciones(r).map((a) => (
                                  <Button key={a.estado} size="sm" variant="ghost" onClick={() => pedir(r, a)}>
                                    {a.label}
                                  </Button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {edicion && formulario({ inicial: edicion.registro, onClose: () => setEdicion(null) })}
      {historial && (
        <Historial entidad={entidad} id={historial.id} nombre={nombreDe(historial)} onClose={() => setHistorial(null)} />
      )}
      <ConfirmationModal
        open={pendiente !== null}
        title={pendiente ? `${pendiente.accion.label} ${singular}` : ""}
        descripcion={
          pendiente?.accion.estado === "ELIMINADO"
            ? "Deja de estar disponible. Los movimientos y registros ya generados la conservan en el historial."
            : "Deja de estar disponible hasta que se la vuelva a activar."
        }
        rows={[
          { label: "ID", value: pendiente?.registro.id ?? "—" },
          { label: "Nombre", value: pendiente ? nombreDe(pendiente.registro) : "—" },
        ]}
        confirmLabel={pendiente?.accion.label ?? ""}
        cancelLabel="Volver"
        tone="danger"
        onConfirm={() => {
          if (pendiente) aplicar(pendiente.registro, pendiente.accion);
          setPendiente(null);
        }}
        onCancel={() => setPendiente(null)}
      />
    </div>
  );
}
