"use client";

import { useCallback, useState, type ComponentProps, type ReactNode } from "react";
import { useApplication } from "@/lib/application-context";
import { auditar, cambios, useAuditoria } from "@/lib/caja-store";
import { crearXlsx } from "@/lib/xlsx";
import { Banner } from "@/components/ui/Banner";
import { mostrarToast } from "@/lib/toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IconChevronDown, IconClock, IconEye, IconPauseCircle } from "@/components/icons";
import { CrudToolbar } from "@/components/crud/CrudToolbar";
import { DataState } from "@/components/crud/DataState";
import { DeleteConfirmationModal } from "@/components/crud/DeleteConfirmationModal";
import type { ExportFormat } from "@/components/crud/ExportModal";
import { FormModal } from "@/components/crud/FormModal";
import { Table, useTablaPaginada, type TableColumn } from "@/components/crud/Table";

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

// Diálogo de alta o modificación con el diseño estándar de los ABM (`FormModal`): "Agregar" para un
// alta y "Guardar" para una modificación. El modo sale del título ("Modificar …" = edición).
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
    <FormModal
      mode={/^modificar/i.test(titulo) ? "edit" : "create"}
      title={titulo}
      onCancel={onClose}
      onSubmit={onGrabar}
      maxWidth={maxWidth}
    >
      {children}
    </FormModal>
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

const buscable = (r: Base, nombre: string) => `${r.id} ${nombre}`;

const csv = (filas: string[][]) =>
  filas.map((f) => f.map((v) => `"${v.replace(/"/g, '""')}"`).join(";")).join("\r\n");

function descargarTexto(nombreArchivo: string, contenido: string, tipo: string) {
  const blob = new Blob(["﻿", contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Detalle de solo lectura de un registro ("Ver").
function Detalle<T extends Base>({
  titulo,
  columnas,
  registro,
  estado,
  onClose,
}: {
  titulo: string;
  columnas: Columna<T>[];
  registro: T;
  estado: EstadoDef | undefined;
  onClose: () => void;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={titulo}
      maxWidth="max-w-lg"
      variant="alert"
      footer={
        <Button variant="soft" size="lg" className="w-full" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="flex flex-col items-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <IconEye width={30} height={30} />
        </span>
        <h3 className="mt-4 text-lg font-bold text-ink-900">{titulo}</h3>
      </div>
      <dl className="mt-5 divide-y divide-ink-100 rounded-xl border border-ink-200 bg-ink-25 text-sm">
        {columnas.map((c) => (
          <div key={c.clave} className="flex items-start justify-between gap-4 px-4 py-2.5">
            <dt className="text-ink-500">{c.label}</dt>
            <dd className="break-words text-right font-medium text-ink-900">{c.render ? c.render(registro) : c.valor(registro)}</dd>
          </div>
        ))}
        <div className="flex items-start justify-between gap-4 px-4 py-2.5">
          <dt className="text-ink-500">Estado</dt>
          <dd>
            <StatusBadge tone={estado?.tone ?? "neutral"}>{estado?.label ?? registro.estado}</StatusBadge>
          </dd>
        </div>
      </dl>
    </Modal>
  );
}

// ABM estándar de Caja y Bancos, con la misma estructura que los parámetros del front real: barra de
// herramientas (búsqueda con "Buscar"/"Limpiar", "Agregar" y "Exportar"), tabla paginada con la
// columna Estado y acciones por registro solo con ícono (Ver, Editar, Historial, Suspender o
// Reactivar y Eliminar), diálogos de alerta para alta/edición y confirmación, y estados vacío y
// sin resultados. Los eliminados quedan ocultos salvo que se filtre por ese estado.
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
  const [filtro, setFiltro] = useState("");
  const [edicion, setEdicion] = useState<{ registro: T | null } | null>(null);
  const [historial, setHistorial] = useState<T | null>(null);
  const [detalle, setDetalle] = useState<T | null>(null);
  const [pendiente, setPendiente] = useState<{ registro: T; accion: Accion } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const todas: Columna<T>[] = [{ clave: "id", label: "ID", valor: (r) => r.id }, ...columnas];
  const estadoDe = (r: T) => estados.find((e) => e.valor === r.estado);

  const visibles = registros
    .filter((r) => (filtro ? r.estado === filtro : r.estado !== "ELIMINADO"))
    .sort((a, b) => a.id.localeCompare(b.id, "es", { numeric: true }));
  const textoDe = useCallback((r: T) => buscable(r, nombreDe(r)), [nombreDe]);
  const tabla = useTablaPaginada(visibles, textoDe);

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

  const exportar = (formato: ExportFormat) => {
    if (formato === "pdf") {
      mostrarToast("La exportación a PDF todavía no está disponible.");
      return;
    }
    const encabezado = [...todas.map((c) => c.label), "Estado"];
    const filas = registros.map((r) => [...todas.map((c) => String(c.valor(r))), estadoDe(r)?.label ?? r.estado]);
    if (formato === "excel") descargarXlsx(`${archivo}.xlsx`, plural, [encabezado, ...filas]);
    else descargarTexto(`${archivo}.csv`, csv([encabezado, ...filas]), "text/csv;charset=utf-8");
  };

  const columnasTabla: TableColumn<T>[] = [
    ...todas.map((c) => ({
      id: c.clave,
      header: c.label,
      className: c.clave === "id" ? "font-mono text-xs font-bold text-brand-700" : "text-ink-700",
      cell: (r: T) => (c.render ? c.render(r) : c.valor(r)),
    })),
    {
      id: "estado",
      header: "Estado",
      cell: (r) => <StatusBadge tone={estadoDe(r)?.tone ?? "neutral"}>{estadoDe(r)?.label ?? r.estado}</StatusBadge>,
    },
  ];

  // Cada acción de cambio de estado ocupa el hueco que le corresponde: las que llevan a Eliminado
  // son "Eliminar"; las peligrosas, "Suspender" (o su nombre propio) y las demás, "Reactivar".
  const accionesFila = (r: T) => {
    const lista = acciones(r);
    const eliminar = lista.find((a) => a.estado === "ELIMINADO");
    const resto = lista.filter((a) => a !== eliminar);
    const suspender = resto.find((a) => a.peligro);
    const reactivar = resto.find((a) => !a.peligro);
    return {
      itemName: nombreDe(r),
      onView: () => setDetalle(r),
      onEdit: r.estado !== "ELIMINADO" ? () => setEdicion({ registro: r }) : undefined,
      suspended: !suspender && Boolean(reactivar),
      onSuspend: suspender ? () => pedir(r, suspender) : undefined,
      suspendLabel: suspender?.label,
      onReactivate: reactivar ? () => pedir(r, reactivar) : undefined,
      reactivateLabel: reactivar?.label,
      onDelete: eliminar ? () => pedir(r, eliminar) : undefined,
      trailingActions: [
        {
          id: "historial",
          label: "Historial",
          icon: <IconClock width={14} height={14} />,
          onClick: () => setHistorial(r),
        },
      ],
    };
  };

  const hayEliminado = estados.some((e) => e.valor === "ELIMINADO");

  return (
    <div className="space-y-5">
      <CrudToolbar
        searchLabel={`Buscar ${plural}`}
        searchPlaceholder="Buscar por nombre o ID…"
        {...tabla.toolbar}
        onNew={() => setEdicion({ registro: null })}
        newLabel={nuevoLabel}
        onExport={exportar}
      />

      {hayEliminado && (
        <div className="flex items-center gap-2">
          <label htmlFor="abm-estado" className="text-xs text-ink-600">
            Estado
          </label>
          <div className="relative">
            <select
              id="abm-estado"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="h-8 cursor-pointer appearance-none rounded-lg border border-ink-300 bg-white pl-3 pr-8 text-sm text-ink-900 shadow-xs outline-none transition hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="">Activos y suspendidos</option>
              {estados.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.grupo}
                </option>
              ))}
            </select>
            <IconChevronDown
              width={16}
              height={16}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400"
            />
          </div>
        </div>
      )}

      {error && (
        <Banner tone="error" title="Acción no permitida">
          {error}
        </Banner>
      )}

      {!hidratado ? (
        <Card className="overflow-hidden">
          <DataState kind="loading" />
        </Card>
      ) : (
        <Table<T>
          label={plural}
          columns={columnasTabla}
          rows={tabla.rows}
          getRowKey={(r) => r.id}
          page={tabla.page}
          pageSize={tabla.pageSize}
          total={tabla.total}
          onPageChange={tabla.setPage}
          onPageSizeChange={tabla.setPageSize}
          rowActions={accionesFila}
          minWidthClassName="min-w-[52rem]"
          emptyState={
            tabla.buscando ? (
              <DataState kind="no-matches" />
            ) : (
              <DataState kind="empty" message={`Todavía no hay ${plural}.`} />
            )
          }
        />
      )}

      {edicion && formulario({ inicial: edicion.registro, onClose: () => setEdicion(null) })}
      {detalle && (
        <Detalle
          titulo={`${singular.charAt(0).toUpperCase()}${singular.slice(1)} ${nombreDe(detalle)}`}
          columnas={todas}
          registro={detalle}
          estado={estadoDe(detalle)}
          onClose={() => setDetalle(null)}
        />
      )}
      {historial && (
        <Historial entidad={entidad} id={historial.id} nombre={nombreDe(historial)} onClose={() => setHistorial(null)} />
      )}
      <DeleteConfirmationModal
        itemName={pendiente ? `${pendiente.registro.id} · ${nombreDe(pendiente.registro)}` : null}
        title={pendiente ? `${pendiente.accion.label} ${singular}` : ""}
        question={
          pendiente?.accion.estado === "ELIMINADO"
            ? "Deja de estar disponible. Los movimientos y registros ya generados la conservan en el historial."
            : "Deja de estar disponible hasta que se la vuelva a activar."
        }
        icon={pendiente?.accion.estado === "ELIMINADO" ? undefined : <IconPauseCircle width={30} height={30} />}
        confirmLabel={pendiente?.accion.label ?? "Confirmar"}
        onConfirm={() => {
          if (pendiente) aplicar(pendiente.registro, pendiente.accion);
          setPendiente(null);
        }}
        onCancel={() => setPendiente(null)}
      />
    </div>
  );
}
