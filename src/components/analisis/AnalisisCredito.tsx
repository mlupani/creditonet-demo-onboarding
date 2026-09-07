"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import {
  RESULTADO_LABEL,
  importeTerceros,
  netoAAcreditar,
  totalPrecancelaciones,
} from "@/lib/credit";
import { formatARS, formatDNI } from "@/lib/format";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DemoTag } from "@/components/ui/DemoTag";
import {
  IconAlertTriangle,
  IconCheck,
  IconCreditCard,
  IconFileText,
  IconShieldCheck,
  IconUser,
  IconWallet,
  IconX,
} from "@/components/icons";

export function AnalisisCredito({
  onObservar,
  onRechazar,
  onAprobar,
}: {
  onObservar: () => void;
  onRechazar: (motivo: string) => void;
  onAprobar: () => void;
}) {
  const { app } = useApplication();
  const [rechazoModal, setRechazoModal] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [invalido, setInvalido] = useState(false);
  if (!app.cliente) return null;

  const o = app.oferta;
  const precancel = totalPrecancelaciones(o);
  const terceros = importeTerceros(o);
  const docsCargados = app.postOferta.legajo.filter((d) => d.estado === "CARGADO").length;

  function confirmarRechazo() {
    if (motivo.trim().length < 5) {
      setInvalido(true);
      return;
    }
    setRechazoModal(false);
    onRechazar(motivo.trim());
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink-900">Análisis del crédito</h2>
          <p className="text-sm text-ink-500">
            {app.numeroCredito} · {app.cliente.nombre} {app.cliente.apellido}
          </p>
        </div>
        <StatusBadge tone="info">Análisis en curso</StatusBadge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard
          title="Cliente"
          icon={<IconUser width={16} height={16} />}
          rows={[
            { label: "Nombre", value: `${app.cliente.nombre} ${app.cliente.apellido}`, strong: true },
            { label: "DNI", value: formatDNI(app.cliente.dni) },
            { label: "CUIL", value: app.cliente.cuil },
            { label: "Cliente Nº", value: `#${app.numeroCliente}` },
            { label: "Ingreso neto", value: formatARS(app.laboral.ingresoNeto) },
          ]}
        />
        <SummaryCard
          title="Riesgo"
          icon={<IconShieldCheck width={16} height={16} />}
          rows={[
            { label: "Reglas evaluadas", value: `${app.riesgo.reglas.length}` },
            {
              label: "Resultado del motor",
              value: app.riesgo.resultado ? RESULTADO_LABEL[app.riesgo.resultado] : "—",
              tone: "success",
            },
            { label: "Ingreso mínimo", value: `${formatARS(750_000)} ✓` },
            { label: "Situación BCRA", value: "Situación 1" },
            { label: "Evaluado", value: app.riesgo.fecha ?? "—" },
          ]}
        />
        <SummaryCard
          title="Oferta"
          icon={<IconWallet width={16} height={16} />}
          rows={[
            { label: "Capital", value: formatARS(o.montoSolicitado), strong: true },
            { label: "Plazo", value: `${o.plazo} cuotas` },
            { label: "Valor cuota", value: formatARS(o.valorCuota) },
            ...(precancel > 0
              ? [{ label: "Precancelación", value: `−${formatARS(precancel)}`, tone: "danger" as const }]
              : []),
            ...(terceros > 0
              ? [{ label: "Deuda terceros", value: `−${formatARS(terceros)}`, tone: "danger" as const }]
              : []),
            { label: "Neto a acreditar", value: formatARS(netoAAcreditar(o)), tone: "success", big: true },
          ]}
        />
        <SummaryCard
          title="Pagos / historial"
          icon={<IconCreditCard width={16} height={16} />}
          rows={[
            { label: "Crédito activo", value: o.creditosActivos[0]?.id ?? "—" },
            {
              label: "Capital residual",
              value: formatARS(o.creditosActivos[0]?.capitalResidual ?? 0),
            },
            { label: "Comportamiento interno", value: "Score 82 / 100" },
            { label: "Días de mora", value: "0" },
            { label: "Último pago", value: "hace 25 días" },
          ]}
          footer={
            <DemoTag
              variant="config"
              detalle="El historial de pagos y el comportamiento interno son datos simulados para la demo."
            />
          }
        />
      </div>

      <SummaryCard
        title="Documentación"
        icon={<IconFileText width={16} height={16} />}
        rows={[
          { label: "Legajo virtual", value: `${docsCargados} de ${app.postOferta.legajo.length}` },
          {
            label: "Tokenización",
            value: app.postOferta.tokenizacion.tokenizada
              ? app.postOferta.tokenizacion.token ?? "Tokenizada"
              : "No tokenizada",
          },
          {
            label: "Referencias",
            value: `${app.postOferta.referencias.length} cargada${
              app.postOferta.referencias.length === 1 ? "" : "s"
            }`,
          },
          { label: "Garante", value: app.postOferta.garante.nombre || "—" },
          { label: "Legajo impreso", value: app.postOferta.impresionGenerada ? "Sí" : "No" },
        ]}
      />

      <Banner tone="info">
        El motor de riesgo ya evaluó la solicitud. El analista revisa el legajo y decide: puede
        observar, rechazar o aprobar. Al aprobar, el crédito pasa a{" "}
        <strong>Caja y Bancos</strong> para la liquidación.
      </Banner>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button variant="ghost" onClick={onObservar}>
            <IconAlertTriangle width={16} height={16} />
            Observar
          </Button>
          <div className="flex-1" />
          <Button variant="danger" onClick={() => setRechazoModal(true)}>
            <IconX width={16} height={16} />
            Rechazar
          </Button>
          <Button variant="success" onClick={onAprobar}>
            <IconCheck width={16} height={16} />
            Aprobar
          </Button>
        </div>
      </Card>

      <Modal
        open={rechazoModal}
        onClose={() => {
          setRechazoModal(false);
          setInvalido(false);
        }}
        title="¿Rechazar la solicitud?"
        maxWidth="max-w-md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setRechazoModal(false);
                setInvalido(false);
              }}
            >
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmarRechazo}>
              Confirmar rechazo
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-600">
          El vendedor recibirá la notificación con el motivo del rechazo.
        </p>
        <label htmlFor="motivo" className="mb-1.5 mt-4 block text-sm font-medium text-ink-700">
          Motivo del rechazo
        </label>
        <textarea
          id="motivo"
          rows={3}
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value);
            if (invalido) setInvalido(false);
          }}
          placeholder="Ej.: El ingreso declarado no pudo verificarse con el empleador."
          className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm shadow-xs outline-none transition placeholder:text-ink-400 ${
            invalido
              ? "border-danger-400 focus:border-danger-500 focus:ring-2 focus:ring-danger-100"
              : "border-ink-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          }`}
        />
        {invalido && (
          <p className="mt-1.5 text-xs font-medium text-danger-600">
            Ingresá un motivo de al menos 5 caracteres para informar al vendedor.
          </p>
        )}
      </Modal>
    </div>
  );
}
