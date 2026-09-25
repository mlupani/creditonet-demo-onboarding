"use client";

import { useApplication } from "@/lib/application-context";
import { netoAAcreditar } from "@/lib/credit";
import { modalidadFirma, requiereChequeoTelefonico } from "@/lib/firma";
import { formatARS } from "@/lib/format";
import { TERMINOS } from "@/lib/terminologia";
import type { MetodoFirma } from "@/lib/types";
import { ConfirmationModal } from "@/components/ConfirmationModal";

// Modo APR: el analista aprueba y el crédito queda en APROBADO (bandeja APR).
// Modo FIRMA: desde APR se pasa a firma — electrónica → FEL, física → AFEL directo.
export function AprobacionModal({
  open,
  loading,
  modo,
  metodoDestino,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  loading: boolean;
  modo: "APROBADO" | "FIRMA";
  metodoDestino?: MetodoFirma;
  onConfirm: (metodo: MetodoFirma) => void;
  onCancel: () => void;
}) {
  const { app } = useApplication();
  const o = app.oferta;
  const modalidad = modalidadFirma(app.configuracion);
  const metodo: MetodoFirma = metodoDestino ?? "ELECTRONICA";
  const chequeo = requiereChequeoTelefonico(app.configuracion);

  const descripcion =
    modo === "APROBADO"
      ? `Al confirmar, la solicitud queda aprobada (APR). Desde la pestaña Aprobados se la pasa a firma: ${
          modalidad === "FISICA"
            ? "física (AFEL directo)"
            : modalidad === "ELECTRONICA"
              ? "electrónica (FEL)"
              : "electrónica (FEL) o física (AFEL directo)"
        }. ${
          chequeo ? "Con la firma aprobada, pasa por chequeo telefónico y" : "Con la firma aprobada,"
        } queda para liquidar (Tesorería).`
      : metodo === "FISICA"
        ? `Al confirmar, la solicitud pasa de Aprobado a Firma aprobada (AFEL) directo: la firma manual ya está cargada en el legajo. ${
            chequeo ? "Desde AFEL pasa por chequeo telefónico y" : "Desde AFEL,"
          } queda para liquidar (Tesorería).`
        : `Al confirmar, la solicitud pasa de Aprobado a En firma (FEL), a la espera de la firma electrónica del cliente. ${
            chequeo ? "Con la firma aprobada, pasa por chequeo telefónico y" : "Con la firma aprobada,"
          } queda para liquidar (Tesorería).`;

  return (
    <ConfirmationModal
      open={open}
      title={modo === "APROBADO" ? "Confirmar aprobación" : metodo === "FISICA" ? "Pasar a AFEL" : "Pasar a FEL"}
      descripcion={descripcion}
      rows={[
        { label: "ID de Crédito", value: app.numeroCredito ?? "—" },
        { label: "Cliente", value: `${app.cliente?.nombre ?? ""} ${app.cliente?.apellido ?? ""}` },
        { label: "Capital", value: formatARS(o.montoSolicitado) },
        { label: "Cuotas", value: `${o.plazo}` },
        { label: "Valor de cuota", value: formatARS(o.valorCuota) },
        { label: TERMINOS.saldoAcreditacion, value: formatARS(netoAAcreditar(o)) },
        { label: "Chequeo telefónico", value: chequeo ? "Requerido por el producto" : "No requerido" },
        {
          label: "Firma",
          value:
            modo === "APROBADO"
              ? modalidad === "FISICA"
                ? "Física (AFEL directo)"
                : modalidad === "ELECTRONICA"
                  ? "Electrónica (FEL)"
                  : "Ambas (FEL o AFEL)"
              : metodo === "FISICA"
                ? "Física (AFEL directo)"
                : "Electrónica (FEL)",
        },
      ]}
      confirmLabel={modo === "APROBADO" ? "Confirmar aprobación" : metodo === "FISICA" ? "Pasar a AFEL" : "Pasar a FEL"}
      cancelLabel="Cancelar"
      tone="success"
      loading={loading}
      onConfirm={() => onConfirm(metodo)}
      onCancel={onCancel}
    />
  );
}
