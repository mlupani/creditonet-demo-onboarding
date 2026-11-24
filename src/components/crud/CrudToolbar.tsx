"use client";

import { useState } from "react";
import { IconDownload, IconPlus, IconSearch, IconX } from "@/components/icons";
import { ActionButton } from "./ActionButton";
import { ExportModal, type ExportFormat } from "./ExportModal";

export interface CrudToolbarProps {
  searchLabel?: string;
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (v: string) => void;
  /** Aplica la búsqueda (botón "Buscar" o Enter). */
  onSearchSubmit: () => void;
  /** Quita la búsqueda aplicada; pasarlo solo mientras hay una aplicada. */
  onSearchClear?: () => void;
  onNew?: () => void;
  newLabel?: string;
  onExport?: (format: ExportFormat) => void;
  disabled?: boolean;
}

// Barra de herramientas de los ABM: caja de búsqueda con "Buscar" (y "Limpiar" una vez aplicada),
// "Agregar" y "Exportar" (abre el selector de formato).
export function CrudToolbar({
  searchLabel = "Buscar",
  searchPlaceholder = "Buscar…",
  searchValue,
  onSearchChange,
  onSearchSubmit,
  onSearchClear,
  onNew,
  newLabel = "Agregar",
  onExport,
  disabled = false,
}: CrudToolbarProps) {
  const [exportando, setExportando] = useState(false);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <form
        role="search"
        className="flex min-w-0 flex-1 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSearchSubmit();
        }}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="crud-busqueda" className="sr-only">
            {searchLabel}
          </label>
          <div className="relative">
            <IconSearch
              width={16}
              height={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <input
              id="crud-busqueda"
              type="search"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              autoComplete="off"
              className="h-10 w-full rounded-lg border border-ink-300 bg-white pl-9 pr-3 text-sm text-ink-900 shadow-xs outline-none transition placeholder:text-ink-400 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>
        <ActionButton type="submit" icon={<IconSearch width={16} height={16} />} label="Buscar" disabled={disabled} />
        {onSearchClear && (
          <ActionButton
            icon={<IconX width={16} height={16} />}
            label="Limpiar"
            iconOnlyOnMobile
            onClick={onSearchClear}
            disabled={disabled}
          />
        )}
      </form>
      {(onNew || onExport) && (
        <div className="flex flex-wrap items-center gap-2">
          {onNew && <ActionButton icon={<IconPlus width={16} height={16} />} label={newLabel} onClick={onNew} disabled={disabled} />}
          {onExport && (
            <ActionButton
              icon={<IconDownload width={16} height={16} />}
              label="Exportar"
              onClick={() => setExportando(true)}
              disabled={disabled}
            />
          )}
        </div>
      )}
      {onExport && <ExportModal open={exportando} onSelect={onExport} onClose={() => setExportando(false)} />}
    </div>
  );
}
