"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RowActions, type RowActionsProps } from "./RowActions";

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export interface TableColumn<T> {
  id: string;
  header: string;
  hideHeader?: boolean;
  align?: "start" | "end";
  /** Oculta la columna completa por debajo de `sm` (cuando su contenido se repite en otra celda). */
  hideOnMobile?: boolean;
  cell: (row: T) => ReactNode;
  className?: string;
}

const diseno = ({ align, hideOnMobile }: Pick<TableColumn<unknown>, "align" | "hideOnMobile">) =>
  `${align === "end" ? " text-right" : ""}${hideOnMobile ? " hidden sm:table-cell" : ""}`;

const sinAcentos = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Búsqueda y paginación en el navegador con el mismo contrato que el listado real: lo tipeado solo
// se aplica con "Buscar" (o Enter), "Limpiar" quita la búsqueda aplicada y cambiar la búsqueda o el
// tamaño vuelve a la página 1.
export function useTablaPaginada<T>(items: readonly T[], textoDe: (r: T) => string) {
  const [tipeado, setTipeado] = useState("");
  const [aplicada, setAplicada] = useState("");
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState<PageSize>(25);

  const filtrados = useMemo(() => {
    const q = sinAcentos(aplicada.trim());
    return q ? items.filter((r) => sinAcentos(textoDe(r)).includes(q)) : items;
  }, [items, aplicada, textoDe]);

  const paginas = Math.max(1, Math.ceil(filtrados.length / pageSize));
  const actual = Math.min(page, paginas);
  const rows = filtrados.slice((actual - 1) * pageSize, actual * pageSize);

  return {
    rows,
    total: filtrados.length,
    page: actual,
    pageSize,
    buscando: aplicada.trim() !== "",
    setPage: setPageState,
    setPageSize: (n: PageSize) => {
      setPageSizeState(n);
      setPageState(1);
    },
    toolbar: {
      searchValue: tipeado,
      onSearchChange: setTipeado,
      onSearchSubmit: () => {
        setAplicada(tipeado);
        setPageState(1);
      },
      onSearchClear:
        aplicada.trim() !== ""
          ? () => {
              setTipeado("");
              setAplicada("");
              setPageState(1);
            }
          : undefined,
    },
  };
}

function PageButton({ label, icon, disabled, onClick }: { label: string; icon: ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="cursor-pointer"
    >
      {icon}
    </Button>
  );
}

function TablePagination({ page, pageCount, onPageChange }: { page: number; pageCount: number; onPageChange: (p: number) => void }) {
  const alInicio = page <= 1;
  const alFinal = page >= pageCount;
  return (
    <nav aria-label="Paginación" className="flex items-center gap-1">
      <PageButton label="Primera página" icon={<IconChevronsLeft width={16} height={16} />} disabled={alInicio} onClick={() => onPageChange(1)} />
      <PageButton label="Página anterior" icon={<IconChevronLeft width={16} height={16} />} disabled={alInicio} onClick={() => onPageChange(page - 1)} />
      <span className="whitespace-nowrap px-2 text-xs text-ink-600">{`Página ${page} de ${pageCount}`}</span>
      <PageButton label="Página siguiente" icon={<IconChevronRight width={16} height={16} />} disabled={alFinal} onClick={() => onPageChange(page + 1)} />
      <PageButton label="Última página" icon={<IconChevronsRight width={16} height={16} />} disabled={alFinal} onClick={() => onPageChange(pageCount)} />
    </nav>
  );
}

export interface TableProps<T> {
  label: string;
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  page: number;
  pageSize: PageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
  emptyState?: ReactNode;
  rowActions?: (row: T) => RowActionsProps;
  minWidthClassName?: string;
}

// Tabla paginada: selector de registros por página arriba a la derecha, la grilla con borde (con
// una última columna "Acciones" de botones con ícono) y, abajo, la cantidad de registros y el
// paginador. Sin filas muestra solo el contenedor con `emptyState`.
export function Table<T>({
  label,
  columns,
  rows,
  getRowKey,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  emptyState = null,
  rowActions,
  minWidthClassName = "min-w-[40rem]",
}: TableProps<T>) {
  const pageSizeId = useId();

  if (rows.length === 0) return <Card className="overflow-hidden">{emptyState}</Card>;

  return (
    <div className="space-y-3 pt-4">
      <div className="flex items-center justify-end gap-2">
        <label htmlFor={pageSizeId} className="text-xs text-ink-600">
          Registros por página
        </label>
        <div className="relative">
          <select
            id={pageSizeId}
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
            className="h-8 cursor-pointer appearance-none rounded-lg border border-ink-300 bg-white pl-3 pr-8 text-sm text-ink-900 shadow-xs outline-none transition hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            {PAGE_SIZE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
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

      <Card className="relative overflow-x-auto">
        <table aria-label={label} className={`w-full text-left text-sm ${minWidthClassName}`}>
          <thead className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
            <tr>
              {columns.map((c) => (
                <th key={c.id} scope="col" className={`px-4 py-2.5${diseno(c)}`}>
                  {c.hideHeader ? <span className="sr-only">{c.header}</span> : c.header}
                </th>
              ))}
              {rowActions && (
                <th scope="col" className="px-4 py-2.5 text-right">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((row) => (
              <tr key={getRowKey(row)} className="align-top">
                {columns.map((c) => (
                  <td key={c.id} className={`px-4 py-3${diseno(c)} ${c.className ?? ""}`}>
                    {c.cell(row)}
                  </td>
                ))}
                {rowActions && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <RowActions {...rowActions(row)} />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" className="text-xs text-ink-600">
          {`Cantidad de registros: ${rows.length}`}
        </p>
        <TablePagination page={page} pageCount={Math.max(1, Math.ceil(total / pageSize))} onPageChange={onPageChange} />
      </div>
    </div>
  );
}
