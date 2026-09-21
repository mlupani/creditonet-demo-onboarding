"use client";

import { useApplication } from "@/lib/application-context";
import { nombreOpcion, ORGANISMOS, PRODUCTOS } from "@/lib/config";
import {
  importeTerceros,
  netoAAcreditar,
  planDeSolicitud,
  seCancela,
  totalPrecancelaciones,
} from "@/lib/credit";
import { formatARS } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function ConfirmarOfertaModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { app } = useApplication();
  const o = app.oferta;
  const precancel = totalPrecancelaciones(o);
  const terceros = importeTerceros(o);
  const cancelados = o.creditosActivos.filter(seCancela);
  const renovados = cancelados.map((c) => c.id);
  const hayMora = cancelados.some((c) => c.enMora);

  const rows: { label: string; value: string; tone?: "success" | "danger" }[] = [
    { label: "ID de Crédito", value: app.numeroCredito ?? "—" },
    { label: "Cliente", value: `${app.cliente?.nombre ?? ""} ${app.cliente?.apellido ?? ""}` },
    {
      label: "Producto / organismo",
      value: `${nombreOpcion(PRODUCTOS, app.configuracion.productoId)} · ${nombreOpcion(
        ORGANISMOS,
        app.configuracion.organismoId
      )}`,
    },
    { label: "Plan de cuotas", value: planDeSolicitud(app).nombre },
    { label: "Capital solicitado", value: formatARS(o.montoSolicitado) },
    ...(precancel > 0
      ? [
          {
            label: `Renovación ${renovados.join(", ")}${hayMora ? " (incluye mora)" : ""}`,
            value: `−${formatARS(precancel)}`,
            tone: "danger" as const,
          },
        ]
      : []),
    ...(terceros > 0
      ? [
          {
            label: `Cancelación ${o.deudaTerceros.entidad}`,
            value: `−${formatARS(terceros)}`,
            tone: "danger" as const,
          },
        ]
      : []),
    { label: "Acreditación neta", value: formatARS(netoAAcreditar(o)), tone: "success" },
    { label: "Plazo", value: `${o.plazo} cuotas` },
    { label: "Valor cuota", value: formatARS(o.valorCuota) },
    { label: "Primer vencimiento", value: o.primeraCuotaVencimiento },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirmá la oferta"
      maxWidth="max-w-md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Volver a modificar
          </Button>
          <Button variant="success" onClick={onConfirm} autoFocus>
            Aceptar oferta
          </Button>
        </div>
      }
    >
      <p className="text-sm text-ink-600">
        Al confirmar, el cliente acepta la oferta y arranca la carga post-oferta. La solicitud
        sigue <strong>En trámite</strong>: queda <strong>preaprobada</strong> recién cuando el
        vendedor termina la carga, y eso la envía al analista. Las condiciones cotizadas se
        conservan por 30 días.
      </p>
      <dl className="mt-4 divide-y divide-ink-100 rounded-xl border border-ink-200 bg-ink-25">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="text-sm text-ink-500">{row.label}</dt>
            <dd
              className={`text-right text-sm font-semibold tabular-nums ${
                row.tone === "success"
                  ? "text-success-700"
                  : row.tone === "danger"
                    ? "text-danger-600"
                    : "text-ink-900"
              }`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
