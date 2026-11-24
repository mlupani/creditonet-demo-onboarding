"use client";

import { numeroComprobante } from "@/components/proveedores/comunes";
import type { Comprobante } from "@/lib/proveedores-tipos";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { IconChevronDown, IconFileText } from "@/components/icons";

export {
  ENCABEZADO,
  EstadoOrdenBadge,
  Th,
  aNumero,
  cuitTexto,
  nombreProveedor,
  numeroComprobante,
  origenTexto,
  pesos,
} from "@/components/proveedores/comunes";

// El CBU se muestra en dos bloques (entidad y sucursal + cuenta) para poder leerlo.
export const formatearCbu = (cbu: string) => cbu.replace(/^(\d{8})(\d{14})$/, "$1 $2");

// Flecha que abre el detalle de la fila (en cascada).
export function Flecha({ abierto, onClick, etiqueta }: { abierto: boolean; onClick: () => void; etiqueta: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={abierto}
      aria-label={etiqueta}
      className="flex h-7 w-7 items-center justify-center rounded-md text-ink-500 transition hover:bg-ink-100"
    >
      <IconChevronDown width={16} height={16} className={`transition-transform ${abierto ? "rotate-180" : ""}`} />
    </button>
  );
}

// Descarga un texto como archivo (por ejemplo, el lote CSV de transferencias).
export function descargarTexto(nombreArchivo: string, contenido: string, tipo = "text/csv;charset=utf-8") {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Imagen del comprobante: en la demo es una vista simulada del respaldo cargado.
export function ImagenComprobanteModal({ comprobante, proveedor, onClose }: { comprobante: Comprobante; proveedor: string; onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={`Comprobante ${numeroComprobante(comprobante)}`}
      maxWidth="max-w-md"
      footer={
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      }
    >
      <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 bg-ink-25 text-center">
        <IconFileText width={36} height={36} className="text-ink-300" />
        <p className="mt-2 text-sm font-semibold text-ink-700">{proveedor}</p>
        <p className="text-xs text-ink-500">{comprobante.respaldo ? `Respaldo: ${comprobante.respaldo}` : "Sin respaldo adjunto todavía"}</p>
        <p className="mt-2 text-[11px] text-ink-400">Vista simulada de la imagen del comprobante.</p>
      </div>
    </Modal>
  );
}
