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

  const l = app.laboral;

  const rows: { label: string; value: string; tone?: "success" | "danger" }[] = [
    { label: "ID de Crédito", value: app.numeroCredito ?? "—" },
    { label: "Cliente", value: `${app.cliente?.nombre ?? ""} ${app.cliente?.apellido ?? ""}`.trim() || "—" },
    { label: "Producto", value: nombreOpcion(PRODUCTOS, app.configuracion.productoId) },
    { label: "Organismo", value: nombreOpcion(ORGANISMOS, app.configuracion.organismoId) },
    { label: "Plan de cuotas", value: planDeSolicitud(app).nombre },
    { label: "Capital solicitado (bruto)", value: formatARS(o.montoSolicitado) },
    { label: "Capital máximo disponible", value: formatARS(o.capitalMaximoActual) },
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
    { label: "TNA", value: `${o.tna} %` },
    { label: "Total a pagar", value: formatARS(o.totalAPagar) },
    { label: "Primer vencimiento", value: o.primeraCuotaVencimiento },
  ];

  const financieros: { label: string; value: string }[] = [
    { label: "Ingreso bruto", value: formatARS(l.ingresoBruto) },
    { label: "Ingreso neto", value: formatARS(l.ingresoNeto) },
    { label: "Disponible", value: formatARS(l.disponible) },
    { label: "Saldo - Fecha de acreditacion", value: l.extraccionesFecha || "—" },
    { label: "Extracciones / Transferencias - Fecha de acreditación", value: l.transferenciasFecha || "—" },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirmá la oferta"
      maxWidth="max-w-lg"
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

      <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-ink-500">
        Detalle de la oferta
      </p>
      <dl className="mt-1.5 divide-y divide-ink-100 rounded-xl border border-ink-200 bg-ink-25">
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

      <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-ink-500">
        Datos financieros
      </p>
      <dl className="mt-1.5 divide-y divide-ink-100 rounded-xl border border-ink-200 bg-ink-25">
        {financieros.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="text-sm text-ink-500">{row.label}</dt>
            <dd className="text-right text-sm font-semibold tabular-nums text-ink-900">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
