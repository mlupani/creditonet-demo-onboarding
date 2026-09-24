"use client";

import { useApplication } from "@/lib/application-context";
import { cambiosOfertaDe } from "@/lib/credit";
import { formatARS } from "@/lib/format";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

const TIPO = { OFERTA: "Cambio de oferta", DATOS_FINANCIEROS: "Cambio de datos financieros" } as const;

/**
 * Se muestra cuando el analista quiere cambiar la oferta por segunda vez: sólo se permite un
 * cambio por solicitud, así que se le explica y se le deja ver el historial de los ya hechos.
 */
export function CambioOfertaBloqueadoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { app } = useApplication();
  const cambios = cambiosOfertaDe(app);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ya hubo un cambio de oferta"
      maxWidth="max-w-lg"
      footer={
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Entendido
          </Button>
        </div>
      }
    >
      <Banner tone="warning">
        Esta solicitud ya tuvo un cambio de oferta. El analista no puede hacer un segundo cambio:
        podés aprobarla, observarla o rechazarla con la oferta vigente.
      </Banner>

      <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-ink-500">
        Historial de cambios de oferta
      </p>
      <ol className="mt-1.5 space-y-2">
        {cambios.map((c, i) => (
          <li key={`${c.fecha}-${i}`} className="rounded-xl border border-ink-200 bg-ink-25 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink-900">{TIPO[c.tipo]}</span>
              <span className="text-xs text-ink-500">{c.fecha}</span>
            </div>
            <p className="mt-1.5 text-sm tabular-nums text-ink-700">
              {c.montoAnterior !== null && c.plazoAnterior !== null
                ? `${formatARS(c.montoAnterior)} en ${c.plazoAnterior} cuotas → `
                : "Nueva oferta: "}
              <strong>
                {formatARS(c.montoNuevo)} en {c.plazoNuevo} cuotas
              </strong>
            </p>
            {c.nota && <p className="mt-1 text-xs text-ink-500">Nota: {c.nota}</p>}
            <p className="mt-1 text-[11px] text-ink-400">
              Por {c.autor}
              {c.refrendadoPor ? ` · refrendado por ${c.refrendadoPor}` : ""}
            </p>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
