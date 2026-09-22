"use client";

import type { ArchivoLegajo } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { IconEye, IconFileText } from "@/components/icons";

export function DocumentoPreviewModal({
  open,
  onClose,
  archivo,
  tipoLabel,
}: {
  open: boolean;
  onClose: () => void;
  archivo: ArchivoLegajo | null;
  tipoLabel?: string;
}) {
  if (!archivo) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tipoLabel ? `${tipoLabel} · ${archivo.nombre}` : archivo.nombre}
      maxWidth="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {/* En demo no hay descarga real: link simulado */}
          <Button variant="ghost" onClick={onClose}>
            <IconFileText width={14} height={14} />
            Descargar (demo)
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-ink-500">
          <IconEye width={14} height={14} />
          Vista previa simulada — en producción se abriría el archivo real.
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 bg-ink-50 px-6 py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-ink-400 shadow-xs">
            <IconFileText width={28} height={28} />
          </span>
          <p className="mt-3 text-sm font-semibold text-ink-900">{archivo.nombre}</p>
          <p className="text-xs text-ink-500">{archivo.detalle}</p>
          {tipoLabel && <p className="mt-1 text-xs text-ink-400">{tipoLabel}</p>}
          <p className="mt-4 max-w-xs text-xs leading-relaxed text-ink-400">
            Previsualización no disponible para este archivo de demostración. El documento se guardó
            correctamente y el analista lo puede abrir desde el legajo.
          </p>
        </div>
        {/* Placeholder imagen simulada */}
        <div className="rounded-lg bg-ink-900 p-3">
          <div className="flex h-40 items-center justify-center rounded bg-white/10 text-xs font-medium tracking-wide text-white/60">
            {archivo.nombre} — preview.jpg
          </div>
        </div>
      </div>
    </Modal>
  );
}
