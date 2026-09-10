"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import {
  RESULTADO_LABEL,
  evaluarPlan,
  importeTerceros,
  netoAAcreditar,
  totalPrecancelaciones,
} from "@/lib/credit";
import { MOTIVOS_OBSERVACION, MOTIVOS_RECHAZO } from "@/lib/validation";
import { formatARS, formatDNI, formatPct } from "@/lib/format";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { DemoTag } from "@/components/ui/DemoTag";
import {
  IconAlertTriangle,
  IconCalendar,
  IconCheck,
  IconCreditCard,
  IconFileText,
  IconShieldCheck,
  IconUser,
  IconWallet,
  IconX,
} from "@/components/icons";

function AreaTexto({
  id,
  label,
  value,
  onChange,
  invalido,
  placeholder,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalido: boolean;
  placeholder: string;
  error: string;
}) {
  return (
    <div className="mt-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink-700">
        {label}
        <span className="ml-0.5 text-danger-500">*</span>
      </label>
      <textarea
        id={id}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm shadow-xs outline-none transition placeholder:text-ink-400 ${
          invalido
            ? "border-danger-400 focus:border-danger-500 focus:ring-2 focus:ring-danger-100"
            : "border-ink-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        }`}
      />
      {invalido && <p className="mt-1.5 text-xs font-medium text-danger-600">{error}</p>}
    </div>
  );
}

export function AnalisisCredito({
  onObservar,
  onRechazar,
  onAprobar,
}: {
  onObservar: (motivo: string, nota: string) => void;
  onRechazar: (codigo: string, motivo: string, observacion: string) => void;
  onAprobar: () => void;
}) {
  const { app } = useApplication();
  const [modal, setModal] = useState<"observar" | "rechazar" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [texto, setTexto] = useState("");
  const [intentado, setIntentado] = useState(false);
  if (!app.cliente) return null;

  const o = app.oferta;
  const precancel = totalPrecancelaciones(o);
  const terceros = importeTerceros(o);
  const docsCargados = app.postOferta.legajo.filter((d) => d.estado === "CARGADO").length;
  const plan = evaluarPlan(app);

  function abrir(tipo: "observar" | "rechazar") {
    setMotivo("");
    setTexto("");
    setIntentado(false);
    setModal(tipo);
  }

  const textoValido = texto.trim().length >= 5;

  function confirmar() {
    setIntentado(true);
    if (!motivo || !textoValido) return;
    if (modal === "observar") onObservar(motivo, texto.trim());
    if (modal === "rechazar") {
      const m = MOTIVOS_RECHAZO.find((r) => r.codigo === motivo);
      onRechazar(motivo, m?.label ?? motivo, texto.trim());
    }
    setModal(null);
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
        <EstadoBadge estado={app.estado} />
      </div>

      {app.analista.reenviada && app.analista.observacion && (
        <Banner tone="info" title="Reenviada con correcciones">
          Observación previa: {app.analista.observacion.motivo} — {app.analista.observacion.nota}
        </Banner>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard
          title="Cliente"
          icon={<IconUser width={16} height={16} />}
          rows={[
            {
              label: "Nombre",
              value: `${app.cliente.nombre} ${app.cliente.apellido}`,
              strong: true,
            },
            { label: "ID de Cliente", value: app.numeroCliente ?? "—" },
            { label: "DNI / CUIL", value: `${formatDNI(app.cliente.dni)} · ${app.cliente.cuil}` },
            { label: "Ingreso neto", value: formatARS(app.laboral.ingresoNeto) },
            {
              label: "Extraído el día de cobro",
              value: formatARS(app.laboral.montoExtraidoDiaCobro),
            },
          ]}
        />
        <SummaryCard
          title="Motor de riesgo"
          icon={<IconShieldCheck width={16} height={16} />}
          rows={[
            ...app.riesgo.reglas.map((r) => ({
              label: `${r.codigo} · ${r.nombre}`,
              value: r.resultado === "CUMPLE" ? "✓ Cumple" : "✕ No cumple",
              tone: r.resultado === "CUMPLE" ? ("success" as const) : ("danger" as const),
            })),
            {
              label: "Resultado",
              value: app.riesgo.resultado ? RESULTADO_LABEL[app.riesgo.resultado] : "—",
              strong: true,
              tone: "success" as const,
            },
            { label: "Evaluado", value: app.riesgo.fecha ?? "—" },
          ]}
        />
        <SummaryCard
          title="Plan de cuotas"
          icon={<IconCalendar width={16} height={16} />}
          rows={[
            { label: "Línea", value: plan.plan.nombre },
            {
              label: `RCI (tope ${plan.plan.rciMaxPct} %)`,
              value: formatPct(plan.rciPct),
              tone: plan.cumpleRci ? "success" : "danger",
            },
            {
              label: `Endeudamiento (máx. ${plan.plan.endeudamientoMaxPct} %)`,
              value: formatPct(plan.endeudamientoPct),
              tone: plan.cumpleEndeudamiento ? "success" : "danger",
            },
            {
              label: "SMVM de bolsillo",
              value: formatARS(plan.ingresoBolsillo),
              tone: plan.cumpleSmvm ? "success" : "danger",
            },
            { label: "Capital máximo otorgable", value: formatARS(plan.capitalMaximo) },
          ]}
        />
        <SummaryCard
          title="Oferta"
          icon={<IconWallet width={16} height={16} />}
          rows={[
            { label: "Capital solicitado", value: formatARS(o.montoSolicitado), strong: true },
            { label: "Plazo", value: `${o.plazo} cuotas` },
            { label: "Valor cuota", value: formatARS(o.valorCuota) },
            ...(precancel > 0
              ? [
                  {
                    label: "Renovación créditos propios",
                    value: `−${formatARS(precancel)}`,
                    tone: "danger" as const,
                  },
                ]
              : []),
            ...(terceros > 0
              ? [
                  {
                    label: `Terceros · ${o.deudaTerceros.entidad}`,
                    value: `−${formatARS(terceros)}`,
                    tone: "danger" as const,
                  },
                ]
              : []),
            {
              label: "Acreditación neta",
              value: formatARS(netoAAcreditar(o)),
              tone: "success",
              big: true,
            },
          ]}
        />
        <SummaryCard
          title="Pagos / historial"
          icon={<IconCreditCard width={16} height={16} />}
          rows={[
            { label: "Crédito propio", value: o.creditosActivos[0]?.id ?? "—" },
            {
              label: "Cuotas abonadas",
              value: o.creditosActivos[0]
                ? `${o.creditosActivos[0].cuotasAbonadas} de ${o.creditosActivos[0].cuotasOriginales}`
                : "—",
            },
            { label: "Vector de mora interna", value: "0 días de atraso" },
            { label: "Situación BCRA", value: "Situación 1" },
            { label: "Último pago", value: "hace 25 días" },
          ]}
          footer={
            <DemoTag
              variant="config"
              detalle="El historial de pagos y el comportamiento interno son datos simulados para la demo."
            />
          }
        />
        <SummaryCard
          title="Documentación"
          icon={<IconFileText width={16} height={16} />}
          rows={[
            {
              label: "Legajo virtual",
              value: `${docsCargados} de ${app.postOferta.legajo.length}`,
            },
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
      </div>

      <Banner tone="info">
        El motor de riesgo ya filtró la solicitud. El analista revisa el legajo virtual y decide:{" "}
        <strong>Observar</strong> la devuelve al canal de venta, <strong>Rechazar</strong> es
        definitivo y <strong>Aprobar</strong> la envía a la Bandeja de Liquidación.
      </Banner>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button variant="outline" onClick={() => abrir("observar")}>
            <IconAlertTriangle width={16} height={16} />
            Observar
          </Button>
          <div className="flex-1" />
          <Button variant="danger" onClick={() => abrir("rechazar")}>
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
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "observar" ? "Observar la solicitud" : "Rechazar la solicitud"}
        maxWidth="max-w-md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button variant={modal === "observar" ? "primary" : "danger"} onClick={confirmar}>
              {modal === "observar" ? "Devolver al canal de venta" : "Confirmar rechazo"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-600">
          {modal === "observar"
            ? "La solicitud vuelve a la bandeja del vendedor en estado Observado, con tus notas. Tendrá 15 días para corregir y reenviar."
            : "El rechazo es definitivo. Se registran el motivo codificado y la observación."}
        </p>
        <div className="mt-4">
          <SelectField
            id="motivo-analista"
            label={modal === "observar" ? "Motivo" : "Motivo codificado"}
            required
            value={motivo}
            onChange={setMotivo}
            options={
              modal === "observar"
                ? MOTIVOS_OBSERVACION.map((m) => ({ value: m, label: m }))
                : MOTIVOS_RECHAZO.map((m) => ({ value: m.codigo, label: `${m.codigo} · ${m.label}` }))
            }
            error={intentado && !motivo ? "Seleccioná un motivo." : undefined}
          />
        </div>
        <AreaTexto
          id="texto-analista"
          label={modal === "observar" ? "Nota para el vendedor" : "Observación"}
          value={texto}
          onChange={setTexto}
          invalido={intentado && !textoValido}
          placeholder={
            modal === "observar"
              ? "Ej.: El recibo de sueldo está cortado. Adjuntá una copia legible."
              : "Ej.: El ingreso declarado no pudo verificarse con el empleador."
          }
          error="Ingresá al menos 5 caracteres para que el registro sea claro."
        />
      </Modal>
    </div>
  );
}
