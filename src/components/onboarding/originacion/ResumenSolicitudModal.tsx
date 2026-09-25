"use client";

import { useApplication } from "@/lib/application-context";
import { CANALES, nombreOpcion, ORGANISMOS, PRODUCTOS, VENDEDORES } from "@/lib/config";
import { reglaMarcada, seleccionarMotor } from "@/lib/motores";
import { formatARS, formatDNI } from "@/lib/format";
import { RESULTADO_LABEL, planDeSolicitud } from "@/lib/credit";
import { TERMINOS } from "@/lib/terminologia";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { IconArrowRight } from "@/components/icons";

// Checkpoint antes de mostrar la oferta: repasa lo cargado en los pasos previos.
export function ResumenSolicitudModal({
  open,
  onClose,
  onContinuar,
}: {
  open: boolean;
  onClose: () => void;
  onContinuar: () => void;
}) {
  const { app } = useApplication();
  const cliente = app.cliente;
  const riesgoCompleto = app.riesgo.estado === "COMPLETO";
  const marcadas = app.riesgo.reglas.filter(reglaMarcada).length;
  const { motor } = seleccionarMotor(
      app.configuracion,
      app.laboral.condicionLaboral,
      app.identificacion.tipoCliente,
      app.situaciones
    );

  const l = app.laboral;

  const rows: { label: string; value: string; tone?: "success" | "danger" | "warning" }[] = [
    { label: "Canal", value: nombreOpcion(CANALES, app.configuracion.canalId) },
    { label: "Vendedor", value: nombreOpcion(VENDEDORES, app.configuracion.vendedorId) },
    {
      label: "Tipo de persona",
      value: app.tipoPersona === "FISICA" ? "Persona física" : "Persona jurídica",
    },
    { label: "Cliente", value: cliente ? `${cliente.nombre} ${cliente.apellido}` : "Sin identificar" },
    ...(app.numeroCliente ? [{ label: "ID de Cliente", value: app.numeroCliente }] : []),
    ...(cliente ? [{ label: "DNI", value: formatDNI(cliente.dni) }] : []),
    { label: "Producto", value: nombreOpcion(PRODUCTOS, app.configuracion.productoId) },
    { label: "Organismo", value: nombreOpcion(ORGANISMOS, app.configuracion.organismoId) },
    {
      label: "Plan de cuotas",
      // El plan se elige al evaluar, según el perfil del cliente.
      value: app.riesgo.planId ? planDeSolicitud(app).nombre : "Se asigna al evaluar",
    },
    ...(riesgoCompleto && app.riesgo.resultado
      ? [
          {
            label: "Resultado del motor",
            value: `${RESULTADO_LABEL[app.riesgo.resultado]}${
              marcadas > 0 ? ` · ${marcadas} marcada${marcadas === 1 ? "" : "s"}` : ""
            }`,
            tone:
              app.riesgo.resultado === "NO_PASA"
                ? ("danger" as const)
                : marcadas > 0
                  ? ("warning" as const)
                  : ("success" as const),
          },
        ]
      : []),
  ];

  const financieros: { label: string; value: string }[] = [
    { label: "Ingreso bruto", value: formatARS(l.ingresoBruto) },
    { label: "Ingreso neto", value: formatARS(l.ingresoNeto) },
    { label: TERMINOS.disponible, value: formatARS(l.disponible) },
    { label: TERMINOS.saldoDiaAcreditacion, value: formatARS(l.extraccionesImporte) },
    { label: TERMINOS.transferenciasExtracciones, value: formatARS(l.transferenciasImporte) },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Resumen de la solicitud"
      maxWidth="max-w-lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Volver
          </Button>
          <Button variant="primary" onClick={onContinuar} autoFocus>
            Ver la oferta
            <IconArrowRight width={16} height={16} />
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex items-center gap-2.5">
        <EstadoBadge estado={app.estado} />
        {app.numeroCredito && (
          <span className="text-sm font-semibold text-brand-700">ID {app.numeroCredito}</span>
        )}
      </div>
      <dl className="divide-y divide-ink-100 rounded-xl border border-ink-200 bg-ink-25">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="text-sm text-ink-500">{row.label}</dt>
            <dd
              className={`text-right text-sm font-semibold tabular-nums ${
                row.tone === "success"
                  ? "text-success-700"
                  : row.tone === "danger"
                    ? "text-danger-600"
                    : row.tone === "warning"
                      ? "text-warning-700"
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
            <dd className="text-right text-sm font-semibold tabular-nums text-ink-900">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
