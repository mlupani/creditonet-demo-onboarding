"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import {
  RESULTADO_LABEL,
  evaluarPlan,
  importeTerceros,
  netoAAcreditar,
  seCancela,
  totalPrecancelaciones,
} from "@/lib/credit";
import { getMotor, reglaMarcada } from "@/lib/motores";
import {
  CANALES,
  ORGANISMOS,
  PRODUCTOS,
  SESION_ANALISTA,
  SESION_SUPERVISOR,
  VENDEDORES,
  configEfectiva,
  nombreOpcion,
  pantallasVisibles,
} from "@/lib/config";
import { camposRectificados } from "@/lib/campos-post-oferta";
import type { PantallaPostOfertaId } from "@/lib/types";
import { MOTIVOS_OBSERVACION, MOTIVOS_RECHAZO, tarjetaValida } from "@/lib/validation";
import { formatARS, formatDNI, formatPct, nombreApellido } from "@/lib/format";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { MultiSelectField } from "@/components/ui/MultiSelectField";
import { SelectField } from "@/components/ui/SelectField";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import {
  ComentarioModal,
  ListaComentarios,
  PosicionClienteModal,
} from "@/components/bandeja/ModalesBandeja";
import { CambiarOfertaModal } from "./CambiarOfertaModal";
import { BuroMotorModal, CreditosRenovarModal } from "./ModalesAnalisis";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBuilding,
  IconCalendar,
  IconCheck,
  IconCreditCard,
  IconFileText,
  IconLandmark,
  IconRefresh,
  IconShieldCheck,
  IconTrash,
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
  onSalir,
}: {
  onObservar: (motivo: string, nota: string, pantallas: PantallaPostOfertaId[]) => void;
  onRechazar: (codigo: string, motivo: string, observacion: string) => void;
  onAprobar: () => void;
  // Vuelve a la lista cuando la solicitud deja el análisis (al soltarla).
  onSalir: () => void;
}) {
  const {
    app,
    proponerCambioOferta,
    refrendarCambioOferta,
    rechazarCambioOferta,
    anularCredito,
    soltarAnalisis,
  } = useApplication();
  const [modal, setModal] = useState<"observar" | "rechazar" | "anular" | null>(null);
  const [consulta, setConsulta] = useState<
    "posicion" | "buro" | "renovar" | "comentario" | "soltar" | null
  >(null);
  const [pantallas, setPantallas] = useState<PantallaPostOfertaId[]>([]);
  const [cambioAbierto, setCambioAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [texto, setTexto] = useState("");
  const [intentado, setIntentado] = useState(false);
  if (!app.cliente) return null;

  const o = app.oferta;
  const precancel = totalPrecancelaciones(o);
  const terceros = importeTerceros(o);
  const po = app.postOferta;
  const docsObligatorios = configEfectiva(app.configuracion).documentos.filter(
    (d) => d.obligatorio
  );
  const docsCargados = docsObligatorios.filter((d) => (po.legajo[d.tipoId]?.length ?? 0) > 0)
    .length;
  const tokenizadas = po.tarjetas.filter(tarjetaValida);
  // Precargados que el vendedor corrigió en la carga post-oferta (Onboarding §3).
  const rectificados = camposRectificados(app);
  const plan = evaluarPlan(app);
  // Reglas no bloqueantes que no pasaron: no frenaron la solicitud y el analista las revisa
  // al final (Motor §10).
  const marcadas = app.riesgo.reglas.filter(reglaMarcada);
  const aRenovar = o.creditosActivos.filter(seCancela);
  // Cambio de oferta propuesto que espera la refrendación del supervisor.
  const cambioPendiente = app.analista.cambioOfertaPendiente;

  function abrir(tipo: "observar" | "rechazar" | "anular") {
    setMotivo("");
    setTexto("");
    setPantallas([]);
    setIntentado(false);
    setModal(tipo);
  }

  const textoValido = texto.trim().length >= 5;

  function confirmar() {
    setIntentado(true);
    // Anular sólo necesita el detalle: no es una decisión de riesgo.
    if (modal === "anular") {
      if (!textoValido) return;
      anularCredito(texto.trim());
      setModal(null);
      return;
    }
    if (!motivo || !textoValido) return;
    // Corrección puntual: hay que indicar qué pantallas se corrigen, el resto se bloquea.
    if (modal === "observar" && pantallas.length === 0) return;
    if (modal === "observar") onObservar(motivo, texto.trim(), pantallas);
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
          {app.analista.observacion.pantallas.length > 0 &&
            ` Pantallas corregidas: ${pantallasVisibles(app.configuracion)
              .filter((pv) => app.analista.observacion!.pantallas.includes(pv.id))
              .map((pv) => pv.label)
              .join(", ")}.`}
        </Banner>
      )}

      {cambioPendiente && (
        <div className="rounded-xl border border-warning-300 bg-warning-50 p-4">
          <p className="text-sm font-bold text-warning-700">
            Cambio de oferta pendiente de refrendación del supervisor
          </p>
          <p className="mt-1 text-sm text-warning-700/90">
            {formatARS(o.montoSolicitado)} en {o.plazo} cuotas →{" "}
            <strong>
              {formatARS(cambioPendiente.montoSolicitado)} en {cambioPendiente.plazo} cuotas
            </strong>
            {" · "}
            neto {formatARS(cambioPendiente.ingresoNeto)}. Propuesto por{" "}
            {cambioPendiente.solicitadoPor} ({cambioPendiente.fecha}). No rige y la solicitud no
            vuelve al vendedor hasta que lo refrende {SESION_SUPERVISOR.nombre}.
          </p>
          <p className="mt-1 text-xs text-warning-700/80">Nota: {cambioPendiente.nota}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="success" onClick={refrendarCambioOferta}>
              Refrendar como supervisor
            </Button>
            <Button size="sm" variant="outline" onClick={rechazarCambioOferta}>
              Rechazar cambio
            </Button>
            <span className="text-[11px] text-warning-700/80">
              Simulación de la demo: en producción lo hace el supervisor desde su sesión.
            </span>
          </div>
        </div>
      )}

      {marcadas.length > 0 && (
        <Banner
          tone="warning"
          title={`${marcadas.length} regla${marcadas.length === 1 ? "" : "s"} no bloqueante${
            marcadas.length === 1 ? "" : "s"
          } para revisar`}
        >
          No pasaron pero no frenaron la solicitud: quedaron marcadas para tu revisión.{" "}
          {marcadas.map((r) => `${r.codigo} · ${r.nombre}: ${r.valorEvaluado}`).join(" · ")}
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
          ]}
        />
        <SummaryCard
          title="Producto y organismo"
          icon={<IconBuilding width={16} height={16} />}
          rows={[
            { label: "Producto", value: nombreOpcion(PRODUCTOS, app.configuracion.productoId) },
            { label: "Organismo", value: nombreOpcion(ORGANISMOS, app.configuracion.organismoId) },
            { label: "Canal", value: nombreOpcion(CANALES, app.configuracion.canalId) },
            { label: "Vendedor", value: nombreOpcion(VENDEDORES, app.configuracion.vendedorId) },
          ]}
        />
        <SummaryCard
          title="Reglas institucionales"
          icon={<IconLandmark width={16} height={16} />}
          rows={app.riesgo.institucionales.map((r) => ({
            label: `${r.codigo} · ${r.nombre}`,
            value:
              r.resultado === "PASA"
                ? "✓ Pasa"
                : r.resultado === "NO_PASA"
                  ? "✕ No pasa"
                  : "Esperando datos",
            tone:
              r.resultado === "PASA"
                ? ("success" as const)
                : r.resultado === "NO_PASA"
                  ? ("danger" as const)
                  : ("muted" as const),
          }))}
        />
        <SummaryCard
          title={`Motor de riesgo · ${getMotor(app.riesgo.motorId).nombre}`}
          icon={<IconShieldCheck width={16} height={16} />}
          rows={[
            ...app.riesgo.reglas.map((r) => ({
              label: `${r.codigo} · ${r.nombre}${r.bloqueante ? "" : " (no bloqueante)"}`,
              value:
                r.resultado === "PASA"
                  ? "✓ Pasa"
                  : reglaMarcada(r)
                    ? "! Marcada · revisar"
                    : "✕ No pasa",
              tone:
                r.resultado === "PASA"
                  ? ("success" as const)
                  : reglaMarcada(r)
                    ? ("warning" as const)
                    : ("danger" as const),
            })),
            {
              label: "Resultado",
              value: app.riesgo.resultado
                ? `${RESULTADO_LABEL[app.riesgo.resultado]}${
                    marcadas.length > 0
                      ? ` · ${marcadas.length} marcada${marcadas.length === 1 ? "" : "s"}`
                      : ""
                  }`
                : "—",
              strong: true,
              tone: marcadas.length > 0 ? ("warning" as const) : ("success" as const),
            },
            { label: "Evaluado", value: app.riesgo.fecha ?? "—" },
          ]}
        />
        {app.riesgo.limites && (
          <SummaryCard
            title="Límites aplicados"
            icon={<IconWallet width={16} height={16} />}
            rows={[
              ...app.riesgo.limites.limites.map((l) => ({
                label: l.label,
                value: formatARS(l.monto),
                tone:
                  l.id === app.riesgo.limites!.limiteAplicadoId
                    ? ("brand" as const)
                    : undefined,
              })),
              {
                label: "Capital considerado",
                value: formatARS(app.riesgo.limites.capitalConsiderado),
                strong: true,
              },
              { label: "Cuota máxima", value: formatARS(app.riesgo.limites.cuotaMaxima) },
            ]}
          />
        )}
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
          title="Buró / historial"
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
            {
              label: "Situación BCRA",
              value: app.situaciones ? `Situación ${app.situaciones.bcra}` : "—",
            },
            { label: "Último pago", value: "hace 25 días" },
          ]}
        />
        <SummaryCard
          title="Documentación"
          icon={<IconFileText width={16} height={16} />}
          rows={[
            {
              label: "Legajo virtual",
              value: `${docsCargados} de ${docsObligatorios.length} obligatorios`,
            },
            ...(app.identificacion.tipoCliente === "NUEVO"
              ? [
                  {
                    label: "Registro de firma",
                    value: app.identificacion.firmaRegistrada ? (
                      <span className="inline-flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element -- dibujo del cliente, sólo en memoria del navegador */}
                        <img
                          src={app.identificacion.firmaRegistrada.imagen}
                          alt="Firma registrada del cliente"
                          className="h-8 w-16 rounded border border-ink-200 bg-white object-contain"
                        />
                        Referencia para el legajo
                      </span>
                    ) : (
                      "No registrada"
                    ),
                  },
                ]
              : []),
            {
              label: "Tarjetas tokenizadas",
              value:
                tokenizadas.length > 0
                  ? tokenizadas.map((t) => `${t.marca} •••• ${t.ultimos4}`).join(" · ")
                  : "Sin tarjetas",
            },
            {
              label: "Referencias",
              value: `${po.referencias.length} cargada${po.referencias.length === 1 ? "" : "s"}`,
            },
            {
              label: "Garantes",
              value: po.garantes.map(nombreApellido).filter(Boolean).join(", ") || "—",
            },
            {
              label: "Legajo",
              value: po.impresion
                ? `${po.impresion.accion === "IMPRESO" ? "Impreso" : "Visualizado"} · ${po.impresion.fecha}`
                : "Sin imprimir",
            },
          ]}
        />
        <SummaryCard
          title="Renovaciones"
          icon={<IconRefresh width={16} height={16} />}
          rows={
            aRenovar.length === 0
              ? [{ label: "Créditos a renovar", value: "Ninguno", tone: "muted" as const }]
              : [
                  ...aRenovar.map((c) => ({
                    label: c.id,
                    value: formatARS(c.montoCancelacion),
                    tone: c.enMora ? ("danger" as const) : undefined,
                  })),
                  { label: "Total a cancelar", value: formatARS(precancel), strong: true },
                ]
          }
        />
        {rectificados.length > 0 && (
          <SummaryCard
            title="Datos rectificados en el onboarding"
            icon={<IconRefresh width={16} height={16} />}
            rows={rectificados.map((r) => ({
              label: r.campo.label,
              value: `${r.original || "vacío"} → ${r.actual || "vacío"}`,
              tone: "warning" as const,
            }))}
          />
        )}
      </div>

      {app.comentarios.length > 0 && (
        <Card className="px-5 pb-5 pt-1">
          <ListaComentarios titulo="Comentarios" />
        </Card>
      )}

      <Banner tone="info">
        El motor de riesgo ya filtró la solicitud. El analista controla los datos sensibles y
        decide: <strong>Cambiar oferta</strong> corrige el capital, el plazo o los sueldos y la
        devuelve al canal de venta; <strong>Observar</strong> la devuelve para corregir
        documentación; <strong>Anular</strong> la cierra cuando el cliente desiste;{" "}
        <strong>Rechazar</strong> es definitivo y <strong>Aprobar</strong> la envía a la Bandeja
        de Liquidación.
      </Banner>

      <Card className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button size="sm" variant="subtle" onClick={() => setConsulta("posicion")}>
            <IconUser width={14} height={14} />
            Posición cliente
          </Button>
          <Button size="sm" variant="subtle" onClick={() => setConsulta("buro")}>
            <IconShieldCheck width={14} height={14} />
            Ver buró / motor
          </Button>
          <Button size="sm" variant="subtle" onClick={() => setConsulta("renovar")}>
            <IconRefresh width={14} height={14} />
            Ver créditos a renovar
          </Button>
          <Button size="sm" variant="subtle" onClick={() => setConsulta("comentario")}>
            <IconFileText width={14} height={14} />
            Comentario
          </Button>
        </div>
        <div className="flex flex-col gap-2 border-t border-ink-100 pt-3 sm:flex-row sm:flex-wrap">
          <Button
            variant="outline"
            disabled={cambioPendiente !== null}
            onClick={() => setCambioAbierto(true)}
          >
            <IconRefresh width={16} height={16} />
            Cambiar oferta
          </Button>
          <Button variant="outline" onClick={() => abrir("observar")}>
            <IconAlertTriangle width={16} height={16} />
            Observar
          </Button>
          <Button variant="outline" onClick={() => setConsulta("soltar")}>
            <IconArrowLeft width={16} height={16} />
            Soltar análisis
          </Button>
          <Button variant="ghost" onClick={() => abrir("anular")}>
            <IconTrash width={16} height={16} />
            Anular
          </Button>
          <div className="flex-1" />
          <Button variant="danger" onClick={() => abrir("rechazar")}>
            <IconX width={16} height={16} />
            Rechazar
          </Button>
          <Button variant="success" disabled={cambioPendiente !== null} onClick={onAprobar}>
            <IconCheck width={16} height={16} />
            Aprobar
          </Button>
        </div>
      </Card>

      <PosicionClienteModal open={consulta === "posicion"} onClose={() => setConsulta(null)} />
      <BuroMotorModal open={consulta === "buro"} onClose={() => setConsulta(null)} />
      <CreditosRenovarModal open={consulta === "renovar"} onClose={() => setConsulta(null)} />
      <ComentarioModal
        open={consulta === "comentario"}
        onClose={() => setConsulta(null)}
        autor={SESION_ANALISTA.nombre}
        paraQuien="el canal de venta"
      />
      <ConfirmationModal
        open={consulta === "soltar"}
        title="¿Soltar el análisis?"
        descripcion="La solicitud vuelve a Preaprobado y queda disponible para que otro analista la tome."
        rows={[
          { label: "Crédito", value: app.numeroCredito ?? "—" },
          { label: "Estado", value: <EstadoBadge estado={app.estado} /> },
        ]}
        confirmLabel="Soltar análisis"
        cancelLabel="Volver"
        onConfirm={() => {
          setConsulta(null);
          soltarAnalisis();
          onSalir();
        }}
        onCancel={() => setConsulta(null)}
      />

      <CambiarOfertaModal
        open={cambioAbierto}
        onClose={() => setCambioAbierto(false)}
        onConfirmar={(cambio) => {
          setCambioAbierto(false);
          proponerCambioOferta(cambio);
        }}
      />

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={
          modal === "observar"
            ? "Observar la solicitud"
            : modal === "anular"
              ? "Anular la solicitud"
              : "Rechazar la solicitud"
        }
        maxWidth="max-w-md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button variant={modal === "rechazar" ? "danger" : "primary"} onClick={confirmar}>
              {modal === "observar"
                ? "Devolver al canal de venta"
                : modal === "anular"
                  ? "Confirmar anulación"
                  : "Confirmar rechazo"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-600">
          {modal === "observar"
            ? "La solicitud vuelve a la bandeja del vendedor en estado Observado, con tus notas. Tendrá 15 días para corregir y reenviar."
            : modal === "anular"
              ? "Anular no es un rechazo de riesgo: se usa cuando el cliente desiste. La solicitud queda cerrada como Anulada."
              : "El rechazo es definitivo. Se registran el motivo codificado y la observación."}
        </p>
        {modal !== "anular" && (
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
                  : MOTIVOS_RECHAZO.map((m) => ({
                      value: m.codigo,
                      label: `${m.codigo} · ${m.label}`,
                    }))
              }
              error={intentado && !motivo ? "Seleccioná un motivo." : undefined}
            />
          </div>
        )}
        {modal === "observar" && (
          <div className="mt-4">
            <MultiSelectField
              id="pantallas-observadas"
              label="Pantallas a corregir"
              required
              values={pantallasVisibles(app.configuracion)
                .filter((pv) => pantallas.includes(pv.id))
                .map((pv) => pv.label)}
              onChange={(labels) =>
                setPantallas(
                  pantallasVisibles(app.configuracion)
                    .filter((pv) => labels.includes(pv.label))
                    .map((pv) => pv.id)
                )
              }
              options={pantallasVisibles(app.configuracion).map((pv) => pv.label)}
              error={
                intentado && pantallas.length === 0
                  ? "Seleccioná al menos una pantalla a corregir."
                  : undefined
              }
              hint="Corrección puntual: el vendedor sólo puede editar estas pantallas. El resto de la carga queda bloqueada hasta que reenvíe."
            />
          </div>
        )}
        <AreaTexto
          id="texto-analista"
          label={
            modal === "observar"
              ? "Nota para el vendedor"
              : modal === "anular"
                ? "Motivo de la anulación"
                : "Observación"
          }
          value={texto}
          onChange={setTexto}
          invalido={intentado && !textoValido}
          placeholder={
            modal === "observar"
              ? "Ej.: El recibo de sueldo está cortado. Adjuntá una copia legible."
              : modal === "anular"
                ? "Ej.: El cliente desistió de la operación."
                : "Ej.: El ingreso declarado no pudo verificarse con el empleador."
          }
          error="Ingresá al menos 5 caracteres para que el registro sea claro."
        />
      </Modal>
    </div>
  );
}
