"use client";

import { useApplication } from "@/lib/application-context";
import { netoAAcreditar } from "@/lib/credit";
import { metodoPorDefecto, modalidadFirma, requiereChequeoTelefonico } from "@/lib/firma";
import { formatARS } from "@/lib/format";
import type { MetodoFirma } from "@/lib/types";
import { ConfirmationModal } from "@/components/ConfirmationModal";

export function AprobacionModal({
  open,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  loading: boolean;
  onConfirm: (metodo: MetodoFirma) => void;
  onCancel: () => void;
}) {
  const { app } = useApplication();
  const o = app.oferta;
  const modalidad = modalidadFirma(app.configuracion);
  // Pasa directo a FEL: el método lo dicta el producto (en "Ambas", electrónica).
  const metodo = metodoPorDefecto(modalidad);
  const chequeo = requiereChequeoTelefonico(app.configuracion);

  return (
    <ConfirmationModal
      open={open}
      title="Confirmar aprobación"
      descripcion={`Al confirmar, la solicitud pasa de En análisis a En firma (FEL), a la espera de la firma del cliente. ${
        chequeo ? "Con la firma aprobada, pasa por chequeo telefónico y" : "Con la firma aprobada,"
      } queda para liquidar (Tesorería).`}
      rows={[
        { label: "ID de Crédito", value: app.numeroCredito ?? "—" },
        { label: "Cliente", value: `${app.cliente?.nombre ?? ""} ${app.cliente?.apellido ?? ""}` },
        { label: "Capital", value: formatARS(o.montoSolicitado) },
        { label: "Cuotas", value: `${o.plazo}` },
        { label: "Valor de cuota", value: formatARS(o.valorCuota) },
        { label: "Acreditación neta", value: formatARS(netoAAcreditar(o)) },
        { label: "Chequeo telefónico", value: chequeo ? "Requerido por el producto" : "No requerido" },
        { label: "Firma electrónica", value: metodo === "ELECTRONICA" ? "Requerido" : "No requerido" },
      ]}
      confirmLabel="Confirmar aprobación"
      cancelLabel="Cancelar"
      tone="success"
      loading={loading}
      onConfirm={() => onConfirm(metodo)}
      onCancel={onCancel}
    />
  );
}
