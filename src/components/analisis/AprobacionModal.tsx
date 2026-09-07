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
      descripcion="Al confirmar, el crédito queda aprobado y pasa a Caja y Bancos para la liquidación."
      rows={[
        { label: "Cliente", value: `${app.cliente?.nombre ?? ""} ${app.cliente?.apellido ?? ""}` },
        { label: "Capital", value: formatARS(o.montoSolicitado) },
        { label: "Cuotas", value: `${o.plazo}` },
        { label: "Cuota", value: formatARS(o.valorCuota) },
        { label: "Neto a acreditar", value: formatARS(netoAAcreditar(o)) },
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
