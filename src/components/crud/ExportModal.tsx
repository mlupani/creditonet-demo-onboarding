"use client";

import type { ReactNode } from "react";
import { IconFileCsv, IconFileSpreadsheet, IconFileText } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export type ExportFormat = "pdf" | "csv" | "excel";

const FORMATOS: readonly { format: ExportFormat; label: string; icon: ReactNode }[] = [
  { format: "pdf", label: "PDF", icon: <IconFileText width={22} height={22} /> },
  { format: "csv", label: "CSV", icon: <IconFileCsv width={22} height={22} /> },
  { format: "excel", label: "Excel", icon: <IconFileSpreadsheet width={22} height={22} /> },
];

export const nombreFormato = (f: ExportFormat) => FORMATOS.find((x) => x.format === f)?.label ?? f;

// Selector de formato de exportación: PDF, CSV o Excel. Solo informa el formato elegido; generar
// el archivo es cosa de la sección.
export function ExportModal({
  open,
  onSelect,
  onClose,
}: {
  open: boolean;
  onSelect: (format: ExportFormat) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Exportar"
      maxWidth="max-w-md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      }
    >
      <p className="text-sm text-ink-600">¿En qué formato desea exportar?</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {FORMATOS.map(({ format, label, icon }) => (
          <button
            key={format}
            type="button"
            onClick={() => {
              onSelect(format);
              onClose();
            }}
            className="flex min-h-20 flex-col items-center justify-center gap-2 break-words rounded-xl border border-ink-200 bg-ink-25 px-4 py-2.5 text-sm font-semibold text-ink-900 transition hover:border-ink-300 hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
