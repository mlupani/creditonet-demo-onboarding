"use client";

import { useApplication } from "@/lib/application-context";
import { netoAAcreditar } from "@/lib/credit";
import { formatARS } from "@/lib/format";
import { ConfirmationModal } from "@/components/ConfirmationModal";

export function AprobacionModal({
  open,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { app } = useApplication();
  const o = app.oferta;

  return (
    <ConfirmationModal
      open={open}
      title="Confirmar aprobación"
      descripcion="Al confirmar, la solicitud pasa de En análisis a Para liquidar y se envía a la Bandeja de Liquidación (Tesorería)."
      rows={[
        { label: "ID de Crédito", value: app.numeroCredito ?? "—" },
        { label: "Cliente", value: `${app.cliente?.nombre ?? ""} ${app.cliente?.apellido ?? ""}` },
        { label: "Capital", value: formatARS(o.montoSolicitado) },
        { label: "Cuotas", value: `${o.plazo}` },
        { label: "Cuota", value: formatARS(o.valorCuota) },
        { label: "Acreditación neta", value: formatARS(netoAAcreditar(o)) },
      ]}
      confirmLabel="Confirmar aprobación"
      cancelLabel="Cancelar"
      tone="success"
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
