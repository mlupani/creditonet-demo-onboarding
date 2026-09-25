"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import {
  RESULTADO_LABEL,
  MAX_CAMBIOS_OFERTA,
  cambioOfertaPermitido,
  cambiosOfertaDe,
  evaluarPlan,
  importeTerceros,
  netoAAcreditar,
  seCancela,
  totalPrecancelaciones,
} from "@/lib/credit";
import { getMotor, reglaMarcada } from "@/lib/motores";
import {
  SESION_ANALISTA,
  SESION_SUPERVISOR,
  configEfectiva,
  pantallasVisibles,
} from "@/lib/config";
import {
  camposDe,
  camposRectificados,
  camposSeleccionablesDe,
  campoVisible,
  valorCampo,
  valorCampoDisplay,
  type PantallaConCampos,
} from "@/lib/campos-post-oferta";
import type { PantallaPostOfertaId } from "@/lib/types";
import { MOTIVOS_OBSERVACION, MOTIVOS_RECHAZO } from "@/lib/validation";
import { TERMINOS } from "@/lib/terminologia";
import {
  formatARS,
  formatDNI,
  formatPct,
  nombreApellido,
} from "@/lib/format";
import { textoUltimoPago, vectorPago } from "@/lib/historial-pagos";
import { historialCredito } from "@/lib/historial";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { MultiSelectField } from "@/components/ui/MultiSelectField";
import { RequiredBadge } from "@/components/ui/RequiredBadge";
import { SelectField } from "@/components/ui/SelectField";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import {
  ComentarioModal,
  ListaComentarios,
  PosicionClienteModal,
} from "@/components/bandeja/ModalesBandeja";
import { CambiarOfertaModal } from "./CambiarOfertaModal";
import { HiloObservacion } from "./HiloObservacion";
import { CambioOfertaBloqueadoModal } from "./CambioOfertaBloqueadoModal";
import { BuroMotorModal, CreditosRenovarModal, DatosCamposModal, ReglasMotorModal } from "./ModalesAnalisis";
import { HistorialPagosModal } from "./HistorialPagosModal";
import { DesarrolloPrestamoModal } from "./DesarrolloPrestamoModal";
import { LegajoVirtualModal } from "./LegajoVirtualModal";
import {
  IconAlertTriangle,
  IconBuilding,
  IconCalendar,
  IconCheck,
  IconEye,
  IconFileText,
  IconLandmark,
  IconRefresh,
  IconShieldCheck,
  IconTrash,
  IconUser,
  IconUsers,
  IconWallet,
  IconX,
} from "@/components/icons";

// Pantallas del catálogo de campos (Onboarding §3–§4): las únicas donde la corrección puntual
// puede acotarse a campos específicos. El resto de las pantallas (tokenización, referencias,
// garantes, legajo, impresión) no tienen catálogo y se corrigen completas, como antes.
const PANTALLAS_CON_CAMPOS: PantallaConCampos[] = ["personales", "laboral"];
function tieneCatalogoCampos(id: PantallaPostOfertaId): id is PantallaConCampos {
  return (PANTALLAS_CON_CAMPOS as PantallaPostOfertaId[]).includes(id);
}

// Por ahora el analista sólo puede observar estas pantallas (las demás se ocultan del selector).
const PANTALLAS_OBSERVABLES: PantallaPostOfertaId[] = ["referencias", "garantias", "legajo"];

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
      </label>
      <div className="relative">
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
        <RequiredBadge />
      </div>
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
  onObservar: (
    motivo: string,
    nota: string,
    pantallas: PantallaPostOfertaId[],
    campos: Partial<Record<PantallaPostOfertaId, string[]>>
  ) => void;
  onRechazar: (codigo: string, motivo: string, observacion: string) => void;
  onAprobar: () => void;
  // Vuelve a la lista cuando la solicitud deja el análisis (al soltarla).
  onSalir: () => void;
}) {
  const {
    app,
    aplicarCambioOferta,
    autorizarExcepcionCambioOferta,
    aplicarCambioDatosFinancieros,
    derivarCambioDatosFinancieros,
    resolverDerivacionCambioFinanciero,
    anularCredito,
    soltarAnalisis,
    tomarAnalisis,
    dejarAprobado,
    confirmarObservacion,
  } = useApplication();
  const router = useRouter();
  const [modal, setModal] = useState<"observar" | "rechazar" | "anular" | null>(null);
  const [consulta, setConsulta] = useState<
    "posicion" | "buro" | "renovar" | "reglas" | "personales" | "laborales" | "comentario" | "soltar" | null
  >(null);
  const [pantallas, setPantallas] = useState<PantallaPostOfertaId[]>([]);
  // Corrección puntual por campo (creditonet-61): campos con problema por pantalla, sólo para
  // las pantallas con catálogo (personales/laboral). El resto queda bloqueado al reenviar.
  const [camposPorPantalla, setCamposPorPantalla] = useState<
    Partial<Record<PantallaPostOfertaId, string[]>>
  >({});
  const [cambioAbierto, setCambioAbierto] = useState(false);
  const [cambioBloqueadoAbierto, setCambioBloqueadoAbierto] = useState(false);
  const [dejarAprobadoAbierto, setDejarAprobadoAbierto] = useState(false);
  const [legajoAbierto, setLegajoAbierto] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [desarrolloAbierto, setDesarrolloAbierto] = useState(false);
  const [logAbierto, setLogAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [texto, setTexto] = useState("");
  const [intentado, setIntentado] = useState(false);
  // Modal obligatorio al tomar una solicitud reenviada: hay que leer la observación primero.
  const [lecturaAbierta, setLecturaAbierta] = useState(false);
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
  const totalLegajoArchivos =
    Object.values(po.legajo).reduce((acc, arr) => acc + arr.length, 0) +
    po.garantes.reduce(
      (acc, g) => acc + (g.reciboSueldo?.length ?? 0) + (g.otrosDocumentos?.length ?? 0),
      0
    );
  // Precargados que el vendedor corrigió en la carga post-oferta (Onboarding §3).
  const rectificados = camposRectificados(app);
  const plan = evaluarPlan(app);
  // Reglas no bloqueantes que no pasaron: no frenaron la solicitud y el analista las revisa
  // al final (Motor §10).
  const marcadas = app.riesgo.reglas.filter(reglaMarcada);
  const aRenovar = o.creditosActivos.filter(seCancela);
  // Cambio de datos financieros cuyo recálculo no pasó y que espera la decisión del supervisor.
  const derivacion = app.analista.derivacionCambioFinanciero;
  // Sin tomar el caso no se opera: sólo se muestra el detalle y el botón Tomar análisis.
  const puedeOperar = app.analista.tomado;
  // Una reenviada con correcciones no se opera hasta leer y confirmar la observación
  // (creditonet-75); la confirmación queda guardada en la solicitud y en el historial.
  const requiereLectura =
    app.analista.reenviada &&
    app.analista.observacion !== null &&
    !app.analista.observacionConfirmada;
  const observacionPendiente = puedeOperar && requiereLectura;
  const cfgEfectiva = configEfectiva(app.configuracion);
  // Oferta: renovaciones de créditos al día vs. precancelaciones obligatorias de créditos en mora.
  const sumaCancelacion = (cs: typeof aRenovar) => cs.reduce((t, c) => t + c.montoCancelacion, 0);
  const totalRenovaciones = sumaCancelacion(aRenovar.filter((c) => !c.enMora));
  const totalPrecancelacionesMora = sumaCancelacion(aRenovar.filter((c) => c.enMora));
  // Sueldo neto recalculado: neto declarado menos los conceptos no remunerativos.
  const sueldoNetoRecalculado = app.laboral.ingresoNeto - app.laboral.debitosNoRemunerativos;
  const vector = vectorPago(o.creditosActivos);
  const creditoConPagos = o.creditosActivos.find((c) => c.cuotasAbonadas > 0);
  const logEstados = historialCredito(app).map((e) => ({ estado: e.etiqueta, fecha: e.fecha }));
  // Campos post-oferta visibles para el analista (respeta excepciones por organismo).
  const personalesVisibles = camposDe("personales", undefined, po.personales).filter((c) =>
    campoVisible(app, c)
  );
  const laboralVisibles = camposDe("laboral", undefined, po.laboral).filter((c) =>
    campoVisible(app, c)
  );

  function valorOPresentacion(v: string): string {
    const t = v?.trim();
    return t ? t : "—";
  }

  function filasCampos(campos: typeof personalesVisibles) {
    return campos.map((c) => ({
      label: c.label,
      value: valorOPresentacion(valorCampoDisplay(app, c) || valorCampo(app, c)),
    }));
  }

  function domicilioCompleto(d: {
    calle: string;
    numero: string;
    piso: string;
    departamento: string;
    provincia: string;
    localidad: string;
    codigoPostal: string;
  }): string {
    const base = `${d.calle} ${d.numero}`.trim();
    const piso = d.piso ? ` piso ${d.piso}` : "";
    const depto = d.departamento ? ` dpto ${d.departamento}` : "";
    const loc = [d.localidad, d.provincia].filter(Boolean).join(", ");
    const cp = d.codigoPostal ? ` (CP ${d.codigoPostal})` : "";
    if (!base && !loc) return "—";
    return `${base}${piso}${depto}${loc ? ` · ${loc}` : ""}${cp}`.trim() || "—";
  }

  // Hasta MAX_CAMBIOS_OFERTA cambios por solicitud: superado el límite se muestra el historial
  // y el supervisor puede autorizar una excepción.
  function intentarCambiarOferta() {
    if (cambioOfertaPermitido(app)) setCambioAbierto(true);
    else setCambioBloqueadoAbierto(true);
  }

  function abrir(tipo: "observar" | "rechazar" | "anular") {
    setMotivo("");
    setTexto("");
    setPantallas([]);
    setCamposPorPantalla({});
    setIntentado(false);
    setModal(tipo);
  }

  const textoValido = texto.trim().length >= 5;
  // Pantallas con catálogo elegidas para corregir, sin ningún campo puntual marcado todavía.
  const pantallasConCampoPendiente = pantallas
    .filter(tieneCatalogoCampos)
    .filter((p) => (camposPorPantalla[p]?.length ?? 0) === 0);

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
    // Y en las pantallas con catálogo, qué campos puntuales tienen el problema.
    if (modal === "observar" && pantallasConCampoPendiente.length > 0) return;
    if (modal === "observar") onObservar(motivo, texto.trim(), pantallas, camposPorPantalla);
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
        <Banner
          tone={observacionPendiente ? "warning" : "info"}
          title={observacionPendiente ? "Observación por comprobar" : "Reenviada con correcciones"}
        >
          Observación previa: {app.analista.observacion.motivo} — {app.analista.observacion.nota}
          {app.analista.observacion.pantallas.length > 0 &&
            ` Pantallas corregidas: ${pantallasVisibles(app.configuracion)
              .filter((pv) => app.analista.observacion!.pantallas.includes(pv.id))
              .map((pv) => pv.label)
              .join(", ")}.`}
          {observacionPendiente && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-ink-600">
                Revisá las correcciones del vendedor y confirmá que la observación quedó resuelta:
                hasta entonces no se habilitan las acciones sobre la solicitud.
              </p>
              <Button
                size="sm"
                variant="success"
                onClick={confirmarObservacion}
              >
                <IconCheck width={14} height={14} />
                Confirmar observación resuelta
              </Button>
            </div>
          )}
        </Banner>
      )}

      {derivacion && (
        <div className="rounded-xl border border-warning-300 bg-warning-50 p-4">
          <p className="text-sm font-bold text-warning-700">
            Cambio de datos financieros derivado al supervisor
          </p>
          <p className="mt-1 text-sm text-warning-700/90">
            El recálculo del Motor de Riesgo con los datos corregidos no pasa: {derivacion.motivo}{" "}
            Nada rige todavía: la solicitud sigue con los datos originales hasta que{" "}
            {SESION_SUPERVISOR.nombre} confirme el rechazo o la devuelva al analista. Derivado por{" "}
            {derivacion.derivadoPor} ({derivacion.fecha}).
          </p>
          {derivacion.datos.map((d) => (
            <p key={d.campo} className="mt-1 text-xs tabular-nums text-warning-700/80">
              {d.campo}: {formatARS(d.antes)} → <strong>{formatARS(d.despues)}</strong>
            </p>
          ))}
          <p className="mt-1 text-xs text-warning-700/80">Nota: {derivacion.nota}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="danger"
              onClick={() => resolverDerivacionCambioFinanciero("RECHAZAR")}
            >
              Confirmar rechazo como supervisor
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => resolverDerivacionCambioFinanciero("DEVOLVER")}
            >
              Devolver al analista
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
            {
              label: "Tipo persona / Cliente",
              value: `${app.tipoPersona === "JURIDICA" ? "Jurídica" : "Física"} · ${app.identificacion.tipoCliente === "NUEVO" ? "Nuevo" : app.identificacion.tipoCliente === "EXISTENTE" ? "Existente" : "—"}`,
            },
            {
              label: "Identidad verificada",
              value: app.identidadVerificada ? "✓ Verificada" : "No verificada",
              tone: app.identidadVerificada ? "success" : "warning",
            },
          ]}
          footer={
            puedeOperar ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setConsulta("personales")}>
                  <IconUser width={14} height={14} />
                  Ver datos personales
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConsulta("laborales")}>
                  <IconBuilding width={14} height={14} />
                  Ver datos laborales
                </Button>
              </div>
            ) : undefined
          }
        />
        <SummaryCard
          title="Datos financieros"
          icon={<IconWallet width={16} height={16} />}
          rows={[
            { label: "Ingreso bruto", value: formatARS(app.laboral.ingresoBruto) },
            { label: "Ingreso neto", value: formatARS(app.laboral.ingresoNeto) },
            { label: TERMINOS.disponible, value: formatARS(app.laboral.disponible) },
            { label: TERMINOS.saldoDiaAcreditacion, value: formatARS(app.laboral.extraccionesImporte) },
            { label: TERMINOS.transferenciasExtracciones, value: formatARS(app.laboral.transferenciasImporte) },
            {
              label: "Sueldo neto recalculado",
              value: formatARS(sueldoNetoRecalculado),
              strong: true,
              tone: "brand",
            },
          ]}
          footer={
            puedeOperar ? (
              <div className="space-y-2">
                <p className="text-xs text-ink-500">
                  Contrastá los importes declarados con el recibo de sueldo del legajo.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setLegajoAbierto(true)}>
                    <IconEye width={14} height={14} />
                    Ver legajo virtual
                  </Button>
                  <Button size="sm" variant="outline" disabled={observacionPendiente} onClick={() => abrir("observar")}>
                    <IconAlertTriangle width={14} height={14} />
                    Observar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={observacionPendiente}
                    onClick={intentarCambiarOferta}
                  >
                    <IconRefresh width={14} height={14} />
                    Cambiar oferta
                  </Button>
                </div>
              </div>
            ) : undefined
          }
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
          footer={
            puedeOperar ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDesarrolloAbierto(true)}
                aria-label="Ver desarrollo del préstamo"
              >
                <IconWallet width={14} height={14} />
                Ver desarrollo del préstamo
              </Button>
            ) : undefined
          }
        />
        <SummaryCard
          title="Oferta"
          icon={<IconWallet width={16} height={16} />}
          rows={[
            { label: "Capital solicitado", value: formatARS(o.montoSolicitado), strong: true },
            {
              label: "− Renovaciones",
              value: totalRenovaciones > 0 ? `−${formatARS(totalRenovaciones)}` : "—",
              tone: totalRenovaciones > 0 ? "danger" : "muted",
            },
            {
              label: "− Precancelaciones de crédito en mora",
              value:
                totalPrecancelacionesMora > 0 ? `−${formatARS(totalPrecancelacionesMora)}` : "—",
              tone: totalPrecancelacionesMora > 0 ? "danger" : "muted",
            },
            {
              label: `− ${TERMINOS.cancelacionTerceros}`,
              value:
                terceros > 0
                  ? `−${formatARS(terceros)} · ${valorOPresentacion(o.deudaTerceros.entidad)} · CBU ${valorOPresentacion(o.deudaTerceros.cbu)}`
                  : "—",
              tone: terceros > 0 ? "danger" : "muted",
            },
            {
              label: TERMINOS.saldoAcreditacion,
              value: formatARS(netoAAcreditar(o)),
              tone: "success",
              big: true,
            },
          ]}
        >
          <dl className="mt-4 space-y-2.5 border-t border-ink-100 pt-4">
            {[
              ["Plazo", `${o.plazo} cuotas`],
              ["Tasa", `${o.tna} % TNA`],
              ["Valor de cuota", formatARS(o.valorCuota)],
              ["Total a pagar por el cliente", formatARS(o.totalAPagar)],
              ["Primer vencimiento", valorOPresentacion(o.primeraCuotaVencimiento)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-ink-500">{label}</dt>
                <dd className="text-right text-sm font-semibold tabular-nums text-ink-900">{value}</dd>
              </div>
            ))}
          </dl>
        </SummaryCard>
        <SummaryCard
          title="Situación y comportamiento de pago"
          icon={<IconShieldCheck width={16} height={16} />}
          rows={[
            { label: "Situación BCRA", value: app.situaciones ? `${app.situaciones.bcra}` : "—" },
            {
              label: "Situación Buró interno",
              value: app.situaciones ? `${app.situaciones.interna}` : "—",
            },
            { label: "Vector de pago", value: vector ?? "Sin historial" },
            {
              label: "Último pago",
              value: creditoConPagos ? textoUltimoPago(creditoConPagos) : "Sin pagos registrados",
            },
          ]}
          footer={
            puedeOperar ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={o.creditosActivos.length > 0 ? "outline" : "ghost"}
                  onClick={() => setHistorialAbierto(true)}
                  aria-label="Ver historial de pagos"
                >
                  <IconEye width={14} height={14} />
                  Ver historial de pagos
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  aria-expanded={logAbierto}
                  onClick={() => setLogAbierto((v) => !v)}
                >
                  <IconCalendar width={14} height={14} />
                  {logAbierto ? "Ocultar log de estados" : "Ver log de estados"}
                </Button>
              </div>
            ) : undefined
          }
        >
          {logAbierto && (
            <ul className="mt-3 space-y-1.5 border-t border-ink-100 pt-3">
              {logEstados.length === 0 ? (
                <li className="text-sm text-ink-500">Sin movimientos registrados.</li>
              ) : (
                logEstados.map((e) => (
                  <li key={e.estado} className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="text-ink-500">{e.estado}</span>
                    <span className="font-semibold tabular-nums text-ink-900">{e.fecha}</span>
                  </li>
                ))
              )}
            </ul>
          )}
        </SummaryCard>
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
          footer={
            puedeOperar ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setConsulta("reglas")}>
                  <IconShieldCheck width={14} height={14} />
                  Visualizar reglas
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConsulta("buro")}>
                  <IconLandmark width={14} height={14} />
                  Ver buró
                </Button>
              </div>
            ) : undefined
          }
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
          footer={
            puedeOperar ? (
              <Button
                size="sm"
                variant="outline"
                disabled={aRenovar.length === 0}
                onClick={() => setConsulta("renovar")}
              >
                <IconEye width={14} height={14} />
                Ver desarrollo del crédito
              </Button>
            ) : undefined
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

      {/* Detalle expandido: referencias, garantes y créditos (tablas post-oferta) */}
      <div className="grid gap-4">
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <IconUser width={16} height={16} />
            </span>
            Referencias personales (post-oferta)
          </h3>
          {po.referencias.length === 0 ? (
            <p className="mt-3 rounded-xl border border-ink-200 bg-ink-25 px-4 py-3 text-sm text-ink-500">
              Sin referencias cargadas.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {po.referencias.map((r, idx) => (
                <li key={r.id} className="rounded-xl border border-ink-200 px-4 py-3">
                  <p className="text-sm font-semibold text-ink-900">
                    {idx + 1}. {valorOPresentacion(r.vinculo) || "Sin vínculo"} · {nombreApellido(r) || "Sin nombre"} · DNI {valorOPresentacion(r.dni)}
                    {r.autocompletado && <span className="ml-2 text-xs font-medium text-success-700">autocompletado por DNI</span>}
                  </p>
                  <div className="mt-2 grid gap-1 text-xs text-ink-600 sm:grid-cols-2">
                    <span>Domicilio: {domicilioCompleto(r.domicilio)}</span>
                    <span>Email: {valorOPresentacion(r.email)}</span>
                    <span>Teléfono: {valorOPresentacion(r.telefono)}</span>
                    <span>Condición laboral: {valorOPresentacion(r.condicionLaboral)}</span>
                    <span>Banco / CBU: {valorOPresentacion(r.banco)} {valorOPresentacion(r.cbu) !== "—" ? `· ${r.cbu}` : ""}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <IconShieldCheck width={16} height={16} />
            </span>
            Garantes (post-oferta)
          </h3>
          {po.garantes.length === 0 ? (
            <p className="mt-3 rounded-xl border border-ink-200 bg-ink-25 px-4 py-3 text-sm text-ink-500">
              Sin garantes cargados{cfgEfectiva.garantes.minimo > 0 ? ` (mínimo requerido: ${cfgEfectiva.garantes.minimo})` : ""}.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {po.garantes.map((g, idx) => (
                <li key={g.id} className="rounded-xl border border-ink-200 px-4 py-3">
                  <p className="text-sm font-semibold text-ink-900">
                    {idx + 1}. {valorOPresentacion(g.vinculo) || "Sin vínculo"} · {nombreApellido(g) || "Sin nombre"} · DNI {valorOPresentacion(g.dni)}
                    {g.autocompletado && <span className="ml-2 text-xs font-medium text-success-700">autocompletado</span>}
                  </p>
                  <div className="mt-2 grid gap-1 text-xs text-ink-600 sm:grid-cols-2">
                    <span>Domicilio: {domicilioCompleto(g.domicilio)}</span>
                    <span>Email: {valorOPresentacion(g.email)}</span>
                    <span>Teléfono: {valorOPresentacion(g.telefono)}</span>
                    <span>Condición laboral: {valorOPresentacion(g.condicionLaboral)} · Bruto {formatARS(g.ingresoBruto)} / Neto {formatARS(g.ingresoNeto)}</span>
                    <span>Empleador: {valorOPresentacion(g.empleadorCalle)} · {valorOPresentacion(g.empleadorLocalidad)} · {valorOPresentacion(g.empleadorCompaniaTelefonica)} {valorOPresentacion(g.empleadorTelefono)}</span>
                    <span>Banco / CBU: {valorOPresentacion(g.banco)} {valorOPresentacion(g.cbu) !== "—" ? `· ${g.cbu}` : ""}</span>
                    <span>Recibos sueldo: {g.reciboSueldo.length > 0 ? g.reciboSueldo.map((a) => a.nombre).join(", ") : "—"}</span>
                    <span>Otros docs garante: {g.otrosDocumentos.length > 0 ? g.otrosDocumentos.map((a) => a.nombre).join(", ") : "—"}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <IconRefresh width={16} height={16} />
            </span>
            Créditos vigentes y detalle de precancelación
          </h3>
          {o.creditosActivos.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">Sin créditos vigentes.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-ink-50 text-[11px] uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Cuotas</th>
                    <th className="px-3 py-2">Cuota</th>
                    <th className="px-3 py-2">Residual</th>
                    <th className="px-3 py-2">Cancelación</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {o.creditosActivos.map((c) => (
                    <tr key={c.id} className={c.enMora ? "bg-danger-50/40" : ""}>
                      <td className="px-3 py-2 font-mono font-semibold text-brand-700">{c.id}</td>
                      <td className="px-3 py-2">{c.cuotasAbonadas}/{c.cuotasOriginales} ({Math.round((c.cuotasAbonadas/c.cuotasOriginales)*100)} %)</td>
                      <td className="px-3 py-2">{formatARS(c.valorCuota)}</td>
                      <td className="px-3 py-2">{formatARS(c.capitalResidual)}</td>
                      <td className="px-3 py-2">
                        {formatARS(c.montoCancelacion)}
                        <span className="ml-1 text-[11px] text-ink-400">rest {formatARS(c.desglose.capitalResidual)} + int {formatARS(c.desglose.interesesAVencer)} + IVA {formatARS(c.desglose.iva)} + cargos {formatARS(c.desglose.cargosCancelacion)} {c.desglose.punitorios ? `+ punitorios ${formatARS(c.desglose.punitorios)}` : ""}</span>
                      </td>
                      <td className="px-3 py-2">{seCancela(c) ? (c.enMora ? "En mora · a cancelar" : "A renovar") : "Vigente"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {app.comentarios.length > 0 && (
        <Card className="px-5 pb-5 pt-1">
          <ListaComentarios titulo="Comentarios" />
        </Card>
      )}

      {/* Acceso rápido al legajo al final del resumen — pedido: botón para abrir documentos en el resumen del analista */}
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <IconFileText width={18} height={18} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-ink-900">Legajo virtual — documentos adjuntos</h3>
            <p className="text-xs text-ink-500">
              {totalLegajoArchivos > 0
                ? `${totalLegajoArchivos} archivo${totalLegajoArchivos === 1 ? "" : "s"} para revisar · ${docsCargados} de ${docsObligatorios.length} obligatorios`
                : "Aún sin archivos — el vendedor carga la documentación en el paso Legajo."}
              {po.impresion ? ` · ${po.impresion.accion === "IMPRESO" ? "Impreso" : "Visualizado"} ${po.impresion.fecha}` : ""}
            </p>
          </div>
        </div>
        {puedeOperar && (
          <Button variant={totalLegajoArchivos > 0 ? "primary" : "outline"} onClick={() => setLegajoAbierto(true)}>
            <IconEye width={16} height={16} />
            Ver documentos del legajo
          </Button>
        )}
      </Card>

      <Banner tone="info">
        El motor de riesgo ya filtró la solicitud. El analista controla los datos sensibles y
        decide: <strong>Cambiar oferta</strong> baja el capital o las cuotas desde la grilla y la
        devuelve al canal de venta; <strong>Observar</strong> la devuelve para corregir
        documentación; <strong>Anular</strong> la cierra cuando el cliente desiste;{" "}
        <strong>Rechazar</strong> es definitivo y <strong>Aprobar</strong> la pasa a firma (FEL/AFEL)
        y, si el producto lo pide, a chequeo telefónico antes de liquidar.
      </Banner>

      <Card className="space-y-3 p-4 sm:p-5">
        {!puedeOperar ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              size="lg"
              onClick={() => (requiereLectura ? setLecturaAbierta(true) : tomarAnalisis())}
            >
              Tomar análisis
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-ink-500">
              Cambios de oferta: {cambiosOfertaDe(app).length} de {MAX_CAMBIOS_OFERTA}
              {app.analista.excepcionCambioOferta &&
                ` · excepción autorizada por ${app.analista.excepcionCambioOferta.autorizadoPor}`}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                variant="outline"
                disabled={observacionPendiente}
                onClick={intentarCambiarOferta}
              >
                <IconRefresh width={16} height={16} />
                Cambiar oferta
              </Button>
              <Button variant="outline" disabled={observacionPendiente} onClick={() => abrir("observar")}>
                <IconAlertTriangle width={16} height={16} />
                Observar
              </Button>
              <Button variant="outline" disabled={observacionPendiente} onClick={() => abrir("anular")}>
                <IconTrash width={16} height={16} />
                Anular
              </Button>
              <Button variant="outline" onClick={() => setConsulta("posicion")}>
                <IconUser width={16} height={16} />
                Posición cliente
              </Button>
              <Button variant="outline" onClick={() => setConsulta("comentario")}>
                <IconFileText width={16} height={16} />
                Agregar comentario
              </Button>
              <Button variant="outline" onClick={() => setConsulta("soltar")}>
                <IconUsers width={16} height={16} />
                Soltar análisis
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="danger" disabled={observacionPendiente} onClick={() => abrir("rechazar")}>
                <IconX width={16} height={16} />
                Rechazar
              </Button>
              <Button
                variant="outline"
                disabled={observacionPendiente}
                onClick={() => setDejarAprobadoAbierto(true)}
              >
                <IconCheck width={16} height={16} />
                Dejar en Aprobado
              </Button>
              <Button variant="success" disabled={observacionPendiente} onClick={onAprobar}>
                <IconCheck width={16} height={16} />
                Aprobar
              </Button>
            </div>
          </>
        )}
      </Card>

      <ConfirmationModal
        open={dejarAprobadoAbierto}
        title="Dejar en Aprobado"
        descripcion="La solicitud queda aprobada y no pasa todavía a firma: la retomás desde la pestaña Aprobados cuando corresponda."
        rows={[
          { label: "ID de Crédito", value: app.numeroCredito ?? "—" },
          { label: "Cliente", value: `${app.cliente.nombre} ${app.cliente.apellido}` },
          { label: "Capital", value: formatARS(o.montoSolicitado) },
          { label: "Cuotas", value: `${o.plazo}` },
        ]}
        confirmLabel="Dejar en Aprobado"
        tone="success"
        onConfirm={() => {
          setDejarAprobadoAbierto(false);
          dejarAprobado();
        }}
        onCancel={() => setDejarAprobadoAbierto(false)}
      />
      <Modal
        open={lecturaAbierta}
        onClose={() => setLecturaAbierta(false)}
        title="Observación previa de la solicitud"
        maxWidth="max-w-2xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLecturaAbierta(false)}>
              Cancelar
            </Button>
            <Button
              variant="success"
              onClick={() => {
                setLecturaAbierta(false);
                tomarAnalisis();
                confirmarObservacion();
              }}
            >
              <IconCheck width={14} height={14} />
              Leí la observación y tomo el análisis
            </Button>
          </div>
        }
      >
        {app.analista.observacion && (
          <div className="space-y-3 text-sm text-ink-700">
            <p>
              Esta solicitud volvió del canal de venta con correcciones. Para tomarla tenés que leer
              la conversación con el canal de venta y confirmarla.
            </p>
            <HiloObservacion />
          </div>
        )}
      </Modal>

      <PosicionClienteModal open={consulta === "posicion"} onClose={() => setConsulta(null)} />
      <BuroMotorModal open={consulta === "buro"} onClose={() => setConsulta(null)} />
      <CreditosRenovarModal open={consulta === "renovar"} onClose={() => setConsulta(null)} />
      <ReglasMotorModal open={consulta === "reglas"} onClose={() => setConsulta(null)} />
      <DatosCamposModal
        open={consulta === "personales"}
        onClose={() => setConsulta(null)}
        titulo="Datos personales"
        filas={filasCampos(personalesVisibles)}
      />
      <DatosCamposModal
        open={consulta === "laborales"}
        onClose={() => setConsulta(null)}
        titulo="Datos laborales"
        filas={filasCampos(laboralVisibles)}
      />
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

      <CambioOfertaBloqueadoModal
        open={cambioBloqueadoAbierto}
        onClose={() => setCambioBloqueadoAbierto(false)}
        onExcepcion={() => {
          autorizarExcepcionCambioOferta();
          setCambioBloqueadoAbierto(false);
          setCambioAbierto(true);
        }}
      />
      <CambiarOfertaModal
        open={cambioAbierto}
        onClose={() => setCambioAbierto(false)}
        onConfirmar={(cambio) => {
          setCambioAbierto(false);
          aplicarCambioOferta(cambio);
          // El cambio ya es del vendedor: se lo ve en su bandeja, no en la del analista.
          router.push("/");
        }}
        onConfirmarDatosFinancieros={(cambio) => {
          setCambioAbierto(false);
          aplicarCambioDatosFinancieros(cambio);
        }}
        onDerivarDatosFinancieros={(cambio, motivo) => {
          setCambioAbierto(false);
          derivarCambioDatosFinancieros(cambio, motivo);
        }}
      />
      <LegajoVirtualModal open={legajoAbierto} onClose={() => setLegajoAbierto(false)} />
      <HistorialPagosModal open={historialAbierto} onClose={() => setHistorialAbierto(false)} />
      <DesarrolloPrestamoModal open={desarrolloAbierto} onClose={() => setDesarrolloAbierto(false)} />

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
                .filter((pv) => PANTALLAS_OBSERVABLES.includes(pv.id))
                .filter((pv) => pantallas.includes(pv.id))
                .map((pv) => pv.label)}
              onChange={(labels) => {
                const nuevas = pantallasVisibles(app.configuracion)
                  .filter((pv) => PANTALLAS_OBSERVABLES.includes(pv.id))
                  .filter((pv) => labels.includes(pv.label))
                  .map((pv) => pv.id);
                setPantallas(nuevas);
                setCamposPorPantalla((prev) => {
                  const siguiente: typeof prev = {};
                  for (const id of nuevas) if (prev[id]) siguiente[id] = prev[id];
                  return siguiente;
                });
              }}
              options={pantallasVisibles(app.configuracion)
                .filter((pv) => PANTALLAS_OBSERVABLES.includes(pv.id))
                .map((pv) => pv.label)}
              error={
                intentado && pantallas.length === 0
                  ? "Seleccioná al menos una pantalla a corregir."
                  : undefined
              }
              hint="Corrección puntual: el vendedor sólo puede editar estas pantallas. El resto de la carga queda bloqueada hasta que reenvíe."
            />
          </div>
        )}
        {modal === "observar" &&
          pantallas.filter(tieneCatalogoCampos).map((pantallaId) => {
            const opciones = camposSeleccionablesDe(app, pantallaId);
            const seleccionados = camposPorPantalla[pantallaId] ?? [];
            const labelPantalla = pantallasVisibles(app.configuracion).find(
              (pv) => pv.id === pantallaId
            )?.label;
            return (
              <div className="mt-4" key={pantallaId}>
                <MultiSelectField
                  id={`campos-observados-${pantallaId}`}
                  label={`Campos a corregir · ${labelPantalla ?? pantallaId}`}
                  required
                  values={opciones
                    .filter((c) => seleccionados.includes(c.id))
                    .map((c) => c.label)}
                  onChange={(labels) =>
                    setCamposPorPantalla((prev) => ({
                      ...prev,
                      [pantallaId]: opciones
                        .filter((c) => labels.includes(c.label))
                        .map((c) => c.id),
                    }))
                  }
                  options={opciones.map((c) => c.label)}
                  error={
                    intentado && seleccionados.length === 0
                      ? "Seleccioná al menos un campo con el problema."
                      : undefined
                  }
                  hint="Sólo estos campos quedan editables en esta pantalla; el resto se bloquea hasta que reenvíe."
                />
              </div>
            );
          })}
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
