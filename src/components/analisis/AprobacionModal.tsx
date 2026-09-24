"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { netoAAcreditar } from "@/lib/credit";
import { metodoPorDefecto, modalidadFirma, requiereChequeoTelefonico } from "@/lib/firma";
import { formatARS } from "@/lib/format";
import type { MetodoFirma } from "@/lib/types";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { SelectField } from "@/components/ui/SelectField";

const OPCIONES_METODO = [
  { value: "ELECTRONICA", label: "Electrónica (FEL) · el cliente firma en línea" },
  { value: "FISICA", label: "Manual (AFEL) · firma física ya cargada" },
];

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
  // En "Ambas" el analista elige; en los demás casos lo dicta el producto.
  const [eleccion, setEleccion] = useState<MetodoFirma>("ELECTRONICA");
  const metodo = modalidad === "AMBAS" ? eleccion : metodoPorDefecto(modalidad);
  const siguiente = metodo === "FISICA" ? "Firma a verificar (AFEL)" : "En firma (FEL)";
  const chequeo = requiereChequeoTelefonico(app.configuracion);

  return (
    <ConfirmationModal
      open={open}
      title="Confirmar aprobación"
      descripcion={`Al confirmar, la solicitud pasa de En análisis a ${siguiente}. ${
        chequeo ? "Después de la firma, pasa por chequeo telefónico y" : "Una vez verificada la firma,"
      } queda para liquidar (Tesorería).`}
      rows={[
        { label: "ID de Crédito", value: app.numeroCredito ?? "—" },
        { label: "Cliente", value: `${app.cliente?.nombre ?? ""} ${app.cliente?.apellido ?? ""}` },
        { label: "Capital", value: formatARS(o.montoSolicitado) },
        { label: "Cuotas", value: `${o.plazo}` },
        { label: "Cuota", value: formatARS(o.valorCuota) },
        { label: "Acreditación neta", value: formatARS(netoAAcreditar(o)) },
        { label: "Chequeo telefónico", value: chequeo ? "Requerido por el producto" : "No requerido" },
      ]}
      confirmLabel="Confirmar aprobación"
      cancelLabel="Cancelar"
      tone="success"
      loading={loading}
      onConfirm={() => onConfirm(metodo)}
      onCancel={onCancel}
    >
      {modalidad === "AMBAS" && (
        <SelectField
          id="metodo-firma"
          label="Método de firma"
          value={eleccion}
          onChange={(v) => setEleccion(v as MetodoFirma)}
          options={OPCIONES_METODO}
        />
      )}
    </ConfirmationModal>
  );
}
