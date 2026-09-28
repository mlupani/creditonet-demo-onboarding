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
import { evaluarReglas, getMotor, reglaMarcada } from "@/lib/motores";
import { modalidadFirma, requiereChequeoTelefonico } from "@/lib/firma";
import { reglasInstitucionalesCredito } from "@/lib/reglas-institucionales";
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
import type { PantallaPostOfertaId, RiskRule } from "@/lib/types";
import { MOTIVOS_OBSERVACION, MOTIVOS_RECHAZO } from "@/lib/validation";
import { TERMINOS } from "@/lib/terminologia";
import {
  formatARS,
  formatDNI,
  formatPct,
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
import { TarjetaMini } from "../onboarding/postoferta/TarjetaAnimada";
import { HiloObservacion } from "./HiloObservacion";
import { CambioOfertaBloqueadoModal } from "./CambioOfertaBloqueadoModal";
import { BuroMotorModal, CreditosRenovarModal, DatosCamposModal, ReglasMotorModal } from "./ModalesAnalisis";
import { HistorialPagosModal } from "./HistorialPagosModal";
import { DesarrolloPrestamoModal } from "./DesarrolloPrestamoModal";
import { LegajoVirtualModal } from "./LegajoVirtualModal";
import { PersonasVinculadas } from "./PersonasVinculadas";
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
export const PANTALLAS_OBSERVABLES: PantallaPostOfertaId[] = ["referencias", "garantias", "legajo"];

export function AreaTexto({
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
  onEnviarSup,
  onSiguiente,
  onPasarALiq,
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
  // Deriva el caso a un superior desde el modal de observación (estado SUP).
  onEnviarSup?: (motivo: string, nota: string) => void;
  // Crédito aprobado: pasa al paso siguiente (FEL, o LIQ / chequeo si la firma es física).
  onSiguiente?: () => void;
  // Aprobado con firma electrónica: saltea FEL y pasa directo a LIQ (o a chequeo telefónico).
  onPasarALiq?: () => void;
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
    verificarReglaMotor,
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
  const [legajoAbierto, setLegajoAbierto] = useState(false);
  const [reglaObs, setReglaObs] = useState<RiskRule | null>(null);
  const [confirmarSiguiente, setConfirmarSiguiente] = useState<"SIGUIENTE" | "LIQ" | null>(null);
  const [supAprobado, setSupAprobado] = useState<{ nota: string; intentado: boolean } | null>(null);
  const [legajoGarante, setLegajoGarante] = useState<string | null>(null);
  // Legajo abierto desde el modal de Observar: se apila encima sin cerrar la observación.
  const [legajoObservar, setLegajoObservar] = useState(false);
  const [tarjetasAbierto, setTarjetasAbierto] = useState(false);
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
  // Precargados que el vendedor corrigió en la carga post-oferta (Onboarding §3).
  const rectificados = camposRectificados(app);
  const plan = evaluarPlan(app);
  // Reglas no bloqueantes que no pasaron: no frenaron la solicitud y el analista las revisa
  // al final (Motor §10).
  // Reglas de verificación: las marcadas al evaluar más las que marcan hoy las reglas vigentes
  // del motor (los créditos guardados se evaluaron con reglas anteriores). El analista tiene
  // que verlas antes de decidir.
  const enVivo =
    app.riesgo.resultado === "PASA" && app.riesgo.motorId
      ? evaluarReglas(app, getMotor(app.riesgo.motorId), app.riesgo.escenario)
      : [];
  const reglasMotor: RiskRule[] = [
    ...app.riesgo.reglas,
    ...enVivo.filter((r) => reglaMarcada(r) && !app.riesgo.reglas.some((g) => g.nombre === r.nombre)),
  ];
  const marcadas = reglasMotor.filter(reglaMarcada);
  const aRenovar = o.creditosActivos.filter(seCancela);
  // Cambio de datos financieros cuyo recálculo no pasó y que espera la decisión del supervisor.
  const derivacion = app.analista.derivacionCambioFinanciero;
  // Sin tomar el caso no se opera: sólo se muestra el detalle y el botón Tomar análisis.
  // Aprobado (APR) se sigue operando desde el análisis: no hace falta volver a tomarlo.
  const aprobado = app.estado === "APROBADO";
  const puedeOperar = app.analista.tomado || aprobado;
  // Paso siguiente de un aprobado: FEL si la firma es electrónica; con firma física la firma ya
  // está en el legajo y va a LIQ, o a chequeo telefónico si el producto lo pide.
  const conChequeo = requiereChequeoTelefonico(app.configuracion);
  const siguiente =
    modalidadFirma(app.configuracion) === "FISICA"
      ? conChequeo
        ? {
            label: "Pasar a chequeo telefónico",
            detalle:
              "La firma física ya está cargada en el legajo. El producto pide chequeo telefónico: el crédito pasa a la bandeja de chequeo.",
          }
        : {
            label: "Pasar a LIQ",
            detalle: "La firma física ya está cargada en el legajo: el crédito pasa a liquidación (LIQ).",
          }
      : {
          label: "Pasar a FEL",
          detalle: `El crédito pasa a firma electrónica (FEL) y el cliente tiene que firmar. Después de la firma ${
            conChequeo ? "va a chequeo telefónico" : "pasa a liquidación"
          }.`,
        };
  const supAprobadoHecho = !!app.aprobacionSuperior?.aprobadaPor;
  // Atajo desde FEL: directo a LIQ, o a la bandeja de chequeo si el producto lo pide.
  const puedeLiqDirecto = modalidadFirma(app.configuracion) !== "FISICA";
  const liqDirecto = {
    label: "Pasar a LIQ",
    detalle: conChequeo
      ? "Saltea la firma electrónica. El producto pide chequeo telefónico: el crédito pasa directo a la bandeja de chequeo y, con el chequeo correcto, a liquidación."
      : "Saltea la firma electrónica: el crédito pasa directo a liquidación (LIQ).",
  };
  const destino = confirmarSiguiente === "LIQ" ? liqDirecto : siguiente;
  // Una reenviada con correcciones no se opera hasta leer y confirmar la observación
  // (creditonet-75); la confirmación queda guardada en la solicitud y en el historial.
  const requiereLectura =
    app.analista.reenviada &&
    app.analista.observacion !== null &&
    !app.analista.observacionConfirmada;
  const observacionPendiente = puedeOperar && requiereLectura;
  // Reglas de verificación del motor sin revisar: bloquean los cambios de estado.
  const verificadas = app.analista.reglasVerificadas ?? [];
  const verificacionDe = (r: RiskRule) => verificadas.find((v) => v.id === r.id);
  const reglasPendientes = marcadas.filter((r) => !verificacionDe(r));
  const bloqueado = observacionPendiente || (puedeOperar && reglasPendientes.length > 0);
  // Antes de tomar el análisis: hay algo para chequear (reglas del motor u observación reenviada).
  const hayPorVerificar = reglasPendientes.length > 0 || requiereLectura;
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

  // Enviar a SUP desde la observación: pide motivo y nota, no las pantallas a corregir.
  function enviarSup() {
    setIntentado(true);
    if (!motivo || !textoValido || !onEnviarSup) return;
    onEnviarSup(motivo, texto.trim());
    setModal(null);
    onSalir();
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
        <div
          role="alert"
          className={`rounded-xl border-2 p-4 ${
            reglasPendientes.length > 0
              ? "animate-pulse-warning border-warning-400 bg-warning-50"
              : "border-success-200 bg-success-50"
          }`}
        >
          <p
            className={`flex items-center gap-2 text-sm font-bold ${
              reglasPendientes.length > 0 ? "text-warning-700" : "text-success-700"
            }`}
          >
            {reglasPendientes.length > 0 ? (
              <IconAlertTriangle width={18} height={18} />
            ) : (
              <IconCheck width={18} height={18} />
            )}
            {reglasPendientes.length > 0
              ? `${reglasPendientes.length} de ${marcadas.length} regla${marcadas.length === 1 ? "" : "s"} del motor sin verificar`
              : `Reglas del motor verificadas (${marcadas.length})`}
          </p>
          <p className={`mt-1 text-sm ${reglasPendientes.length > 0 ? "text-warning-700" : "text-success-700"}`}>
            {reglasPendientes.length > 0
              ? "No frenaron la solicitud, pero hasta verificarlas no podés cambiar el estado del crédito (aprobar, observar, cambiar la oferta, anular ni rechazar)."
              : "Ya podés decidir sobre la solicitud."}
          </p>
          <ul className="mt-3 space-y-2">
            {marcadas.map((r) => (
              <li
                key={r.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 ${
                  verificacionDe(r) ? "border-success-200" : "border-warning-200"
                }`}
              >
                <span className="text-sm text-ink-800">
                  <span className="font-mono text-xs font-bold text-warning-700">{r.codigo}</span>{" "}
                  <strong>{r.nombre}</strong>
                  <span className="text-ink-500"> · {r.valorEvaluado}</span>
                </span>
                <span className="flex items-center gap-2">
                  {verificacionDe(r) ? (
                    <span className="text-xs font-semibold text-success-700">
                      ✓ Verificada · {verificacionDe(r)!.analista} · {verificacionDe(r)!.fecha}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-danger-600">Sin verificar</span>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setReglaObs(r)}>
                    <IconEye width={14} height={14} />
                    Ver Regla del motor
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
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
                  <Button size="sm" variant="outline" disabled={bloqueado} onClick={() => abrir("observar")}>
                    <IconAlertTriangle width={14} height={14} />
                    Observar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bloqueado}
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
          title={`Motor de riesgo · ${getMotor(app.riesgo.motorId).nombre}`}
          icon={<IconShieldCheck width={16} height={16} />}
          rows={[
            ...reglasMotor.map((r) => ({
              label: `${r.codigo} · ${r.nombre}${r.bloqueante ? "" : " (no bloqueante)"}`,
              // Las de verificación: rojo hasta que se marcan arriba, verde una vez verificadas.
              value:
                r.resultado === "PASA"
                  ? "✓ Pasa"
                  : reglaMarcada(r)
                    ? verificacionDe(r)
                      ? "✓ Verificada"
                      : "✕ Sin verificar"
                    : "✕ No pasa",
              tone:
                r.resultado === "PASA" || (reglaMarcada(r) && verificacionDe(r))
                  ? ("success" as const)
                  : ("danger" as const),
            })),
            {
              label: "Resultado",
              value: app.riesgo.resultado
                ? `${RESULTADO_LABEL[app.riesgo.resultado]}${
                    reglasPendientes.length > 0
                      ? ` · ${reglasPendientes.length} sin verificar`
                      : marcadas.length > 0
                        ? ` · ${marcadas.length} verificada${marcadas.length === 1 ? "" : "s"}`
                        : ""
                  }`
                : "—",
              strong: true,
              tone: reglasPendientes.length > 0 ? ("danger" as const) : ("success" as const),
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
        <SummaryCard title="Reglas institucionales" icon={<IconLandmark width={16} height={16} />}>
          {/* Doble columna: la posición del cliente frente a lo que exige cada regla. */}
          <ul className="divide-y divide-ink-100">
            {reglasInstitucionalesCredito(app).map((r) => (
              <li key={r.codigo} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-ink-800">
                    <span className="font-mono text-xs font-bold text-brand-700">{r.codigo}</span> {r.nombre}
                  </p>
                  <span
                    className={`shrink-0 text-sm font-semibold ${
                      r.resultado === "PASA"
                        ? "text-success-700"
                        : r.resultado === "NO_PASA"
                          ? "text-danger-600"
                          : "text-ink-400"
                    }`}
                  >
                    {r.resultado === "PASA" ? "✓ Pasa" : r.resultado === "NO_PASA" ? "✕ No pasa" : "Esperando datos"}
                  </span>
                </div>
                <dl className="mt-1.5 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="font-semibold uppercase tracking-wider text-ink-400">Posición del cliente</dt>
                    <dd className="mt-0.5 tabular-nums text-ink-800">{r.posicion}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wider text-ink-400">Regla</dt>
                    <dd className="mt-0.5 tabular-nums text-ink-800">{r.regla}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          {app.riesgo.limites && (
            <div className="mt-4 border-t border-ink-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Límites de capital</p>
              <dl className="mt-2 space-y-2">
                {[
                  ...app.riesgo.limites.limites.map((l) => ({
                    label: l.label,
                    value: formatARS(l.monto),
                    aplicado: l.id === app.riesgo.limites!.limiteAplicadoId,
                    strong: false,
                  })),
                  {
                    label: "Capital considerado",
                    value: formatARS(app.riesgo.limites.capitalConsiderado),
                    aplicado: false,
                    strong: true,
                  },
                  {
                    label: "Cuota máxima",
                    value: formatARS(app.riesgo.limites.cuotaMaxima),
                    aplicado: false,
                    strong: false,
                  },
                ].map((f) => (
                  <div key={f.label} className="flex items-baseline justify-between gap-4 text-sm">
                    <dt className={f.strong ? "font-medium text-ink-700" : "text-ink-500"}>
                      {f.label}
                      {f.aplicado && <span className="ml-1.5 text-xs text-brand-600">· aplicado</span>}
                    </dt>
                    <dd className={`font-semibold tabular-nums ${f.aplicado ? "text-brand-700" : "text-ink-900"}`}>
                      {f.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
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
            <div className="mt-3 space-y-4 border-t border-ink-100 pt-3">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-400">Estados</p>
                <ul className="space-y-1.5">
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
              </div>
              {/* Además de los estados, la conversación entre analista y vendedor. */}
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-400">
                  Comentarios del analista y del vendedor
                </p>
                <HiloObservacion />
              </div>
            </div>
          )}
        </SummaryCard>
      </div>

      {/* Detalle expandido: referencias, garantes y créditos (tablas post-oferta) */}
      <div className="grid gap-4">
        <PersonasVinculadas
          titulo="Referencias personales"
          icono={<IconUser width={16} height={16} />}
          tipo="REFERENCIA"
          personas={po.referencias}
          minimo={cfgEfectiva.referencias.minimo}
          maximo={cfgEfectiva.referencias.maximo}
        />

        <PersonasVinculadas
          titulo="Garantes"
          icono={<IconShieldCheck width={16} height={16} />}
          tipo="GARANTE"
          personas={po.garantes}
          minimo={cfgEfectiva.garantes.minimo}
          maximo={cfgEfectiva.garantes.maximo}
          onVerLegajo={setLegajoGarante}
        />

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

      {/* Tarjetas tokenizadas: botón que abre el modal con los plásticos y sus datos (sin CVV) */}
      <div>
        <Button variant="outline" onClick={() => setTarjetasAbierto(true)}>
          <IconEye width={16} height={16} />
          Ver tarjetas tokenizadas
          {po.tarjetas.length > 0 ? ` (${po.tarjetas.length})` : ""}
        </Button>
      </div>

      <Modal
        open={tarjetasAbierto}
        onClose={() => setTarjetasAbierto(false)}
        title="Tarjetas tokenizadas"
        maxWidth="max-w-2xl"
        footer={
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setTarjetasAbierto(false)}>
              Cerrar
            </Button>
          </div>
        }
      >
        {po.tarjetas.length === 0 ? (
          <p className="rounded-xl border border-ink-200 bg-ink-25 px-4 py-3 text-sm text-ink-500">
            Sin tarjetas tokenizadas en esta solicitud.
          </p>
        ) : (
          <ul className="space-y-3">
            {po.tarjetas.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-4 rounded-xl border border-ink-200 bg-white px-4 py-3 sm:flex-row sm:items-center"
              >
                <TarjetaMini
                  marca={t.marca}
                  tipo={t.tipo}
                  nombreTitular={t.nombreTitular}
                  primeros4={t.primeros4}
                  ultimos4={t.ultimos4}
                  vencimiento={t.vencimiento}
                />
                <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-ink-400">Emisor</dt>
                    <dd className="font-semibold text-ink-900">{t.emisor ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400">Tipo</dt>
                    <dd className="font-semibold text-ink-900">
                      {t.tipo === "CREDITO" ? "Crédito" : t.tipo === "DEBITO" ? "Débito" : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400">Estado</dt>
                    <dd className="font-semibold text-ink-900">
                      {t.estado === "TOKENIZADA" ? "Tokenizada" : "Esperando al cliente"}
                      {t.via === "BASE_INTERNA"
                        ? t.verificada
                          ? " · verificada"
                          : " · pendiente de verificación"
                        : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400">Vía</dt>
                    <dd className="font-semibold text-ink-900">
                      {t.via === "WHATSAPP"
                        ? "WhatsApp"
                        : t.via === "PRESENCIAL"
                          ? "Presencial"
                          : "Base interna"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400">Token</dt>
                    <dd className="font-mono text-[13px] font-semibold text-ink-900">{t.token ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400">Fecha de tokenización</dt>
                    <dd className="font-semibold text-ink-900">{t.fechaTokenizacion ?? "—"}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-400">
          Por seguridad el código de verificación (CVV) nunca se muestra.
        </p>
      </Modal>

      <Banner tone="info">
        El motor de riesgo ya filtró la solicitud. El analista controla los datos sensibles y
        decide: <strong>Cambiar oferta</strong> baja el capital o las cuotas desde la grilla y la
        devuelve al canal de venta; <strong>Observar</strong> la devuelve para corregir
        documentación; <strong>Anular</strong> la cierra cuando el cliente desiste;{" "}
        <strong>Rechazar</strong> es definitivo y <strong>Aprobar</strong> la deja en Aprobado
        (APR), desde donde se pasa a firma (FEL/AFEL) y, si el producto lo pide, a chequeo telefónico antes de liquidar.
      </Banner>

      <Card className="space-y-3 p-4 sm:p-5">
        {!puedeOperar ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {hayPorVerificar && (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-warning-700">
                <IconAlertTriangle width={16} height={16} />
                Verificar observaciones pendientes
              </p>
            )}
            <Button
              size="lg"
              onClick={() => {
                if (requiereLectura) {
                  setLecturaAbierta(true);
                  return;
                }
                tomarAnalisis();
                // Con reglas por verificar, sube al aviso para que el analista las vea primero.
                if (reglasPendientes.length > 0) window.scrollTo({ top: 0, behavior: "smooth" });
              }}
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
                disabled={bloqueado}
                onClick={intentarCambiarOferta}
              >
                <IconRefresh width={16} height={16} />
                Cambiar oferta
              </Button>
              <Button variant="outline" disabled={bloqueado} onClick={() => abrir("observar")}>
                <IconAlertTriangle width={16} height={16} />
                Observar
              </Button>
              {/* Aprobado ya no se anula: sigue a firma (FEL) o se rechaza. */}
              {/* {!aprobado && (
                <Button variant="outline" disabled={bloqueado} onClick={() => abrir("anular")}>
                  <IconTrash width={16} height={16} />
                  Anular
                </Button>
              )} */}
              <Button variant="outline" onClick={() => setConsulta("posicion")}>
                <IconUser width={16} height={16} />
                Posición cliente
              </Button>
              <Button variant="outline" onClick={() => setConsulta("comentario")}>
                <IconFileText width={16} height={16} />
                Agregar comentario
              </Button>
              {/* En SUP no se suelta (volvería a PRE sin el superior), ni aprobado (perdería la aprobación). */}
              {app.estado !== "SUPERIOR" && !aprobado && (
                <Button variant="outline" onClick={() => setConsulta("soltar")}>
                  <IconUsers width={16} height={16} />
                  Soltar análisis
                </Button>
              )}
            </div>
            {aprobado && (
              <p className="border-t border-ink-100 pt-3 text-sm text-ink-700">
                <strong className="text-success-700">Crédito aprobado (APR)</strong>
                {app.fechaAprobacion ? ` el ${app.fechaAprobacion}` : ""}
                {app.aprobacionSuperior?.aprobadaPor
                  ? ` · aprobación superior de ${app.aprobacionSuperior.aprobadaPor}`
                  : ""}
                . Elegí el paso siguiente.
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="danger" disabled={bloqueado} onClick={() => abrir("rechazar")}>
                <IconX width={16} height={16} />
                Rechazar
              </Button>
              {aprobado ? (
                <>
                  {onEnviarSup && !supAprobadoHecho && (
                    <Button
                      variant="outline"
                      disabled={bloqueado}
                      onClick={() => setSupAprobado({ nota: "", intentado: false })}
                    >
                      <IconUsers width={16} height={16} />
                      Pasar a SUP
                    </Button>
                  )}
                  {onSiguiente && (
                    <Button variant="success" disabled={bloqueado} onClick={() => setConfirmarSiguiente("SIGUIENTE")}>
                      <IconCheck width={16} height={16} />
                      {siguiente.label}
                    </Button>
                  )}
                  {onPasarALiq && puedeLiqDirecto && (
                    <Button variant="success" disabled={bloqueado} onClick={() => setConfirmarSiguiente("LIQ")}>
                      <IconCheck width={16} height={16} />
                      {liqDirecto.label}
                    </Button>
                  )}
                </>
              ) : (
                <Button variant="success" disabled={bloqueado} onClick={onAprobar}>
                  <IconCheck width={16} height={16} />
                  Aprobar
                </Button>
              )}
            </div>
          </>
        )}
      </Card>

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
      <Modal
        open={reglaObs !== null}
        onClose={() => setReglaObs(null)}
        title={reglaObs ? `Regla para verificar · ${reglaObs.codigo}` : ""}
        maxWidth="max-w-lg"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setReglaObs(null)}>
              Cerrar
            </Button>
            {reglaObs && puedeOperar && !verificacionDe(reglaObs) && (
              <Button
                variant="success"
                onClick={() => {
                  verificarReglaMotor(reglaObs.id, reglaObs.nombre);
                  setReglaObs(null);
                }}
              >
                <IconCheck width={16} height={16} />
                Marcar como verificada
              </Button>
            )}
          </div>
        }
      >
        {reglaObs && (
          <div className="space-y-3 text-sm">
            <p className="text-base font-semibold text-ink-900">{reglaObs.nombre}</p>
            <p className="text-ink-600">{reglaObs.detalle}</p>
            <dl className="space-y-2 rounded-lg border border-ink-200 bg-ink-25 p-3">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                  Se marca cuando se cumple
                </dt>
                <dd className="mt-0.5 font-mono text-ink-800">
                  {reglaObs.condicion.replace(/^Que no se cumpla /, "")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-ink-400">Valores del cliente</dt>
                <dd className="mt-0.5 text-ink-800">{reglaObs.valorEvaluado}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-ink-400">Fuente</dt>
                <dd className="mt-0.5 text-ink-800">{reglaObs.fuente}</dd>
              </div>
            </dl>
            <Banner tone="warning">
              La regla es de verificación: no rechaza el crédito. Contrastá estos datos con el legajo
              y el buró antes de aprobar, observar o rechazar.
            </Banner>
          </div>
        )}
      </Modal>
      <ConfirmationModal
        open={confirmarSiguiente !== null}
        title={`¿${destino.label}?`}
        descripcion={destino.detalle}
        rows={[
          { label: "Crédito", value: app.numeroCredito ?? "—" },
          { label: "Capital", value: formatARS(o.montoSolicitado) },
        ]}
        confirmLabel={destino.label}
        cancelLabel="Volver"
        tone="success"
        onConfirm={() => {
          const elegido = confirmarSiguiente;
          setConfirmarSiguiente(null);
          if (elegido === "LIQ") onPasarALiq?.();
          else onSiguiente?.();
        }}
        onCancel={() => setConfirmarSiguiente(null)}
      />
      <Modal
        open={supAprobado !== null}
        onClose={() => setSupAprobado(null)}
        title="Pasar a SUP"
        maxWidth="max-w-md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setSupAprobado(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!supAprobado) return;
                if (supAprobado.nota.trim().length < 5) {
                  setSupAprobado({ ...supAprobado, intentado: true });
                  return;
                }
                onEnviarSup?.("Pedido de aprobación superior", supAprobado.nota.trim());
                setSupAprobado(null);
                onSalir();
              }}
            >
              Enviar a SUP
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-600">
          El crédito aprobado pasa a la bandeja SUP. Cuando el superior lo aprueba vuelve acá para
          seguir al paso siguiente.
        </p>
        <AreaTexto
          id="nota-sup-aprobado"
          label="Nota para el superior"
          value={supAprobado?.nota ?? ""}
          onChange={(v) => supAprobado && setSupAprobado({ ...supAprobado, nota: v })}
          invalido={!!supAprobado?.intentado && (supAprobado?.nota.trim().length ?? 0) < 5}
          placeholder="Ej.: Monto cercano al tope del plan, pido aprobación superior."
          error="Ingresá al menos 5 caracteres para que el registro sea claro."
        />
      </Modal>
      <LegajoVirtualModal open={legajoAbierto} onClose={() => setLegajoAbierto(false)} />
      <LegajoVirtualModal
        open={legajoGarante !== null}
        garanteId={legajoGarante}
        onClose={() => setLegajoGarante(null)}
      />
      <HistorialPagosModal open={historialAbierto} onClose={() => setHistorialAbierto(false)} />
      <DesarrolloPrestamoModal open={desarrolloAbierto} onClose={() => setDesarrolloAbierto(false)} />

      <Modal
        open={modal !== null}
        onClose={() => {
          if (!legajoObservar) setModal(null);
        }}
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
            {modal === "observar" && onEnviarSup && app.estado !== "SUPERIOR" && (
              <Button variant="outline" className="whitespace-nowrap" onClick={enviarSup}>
                Enviar a SUP
              </Button>
            )}
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
            ? `La solicitud vuelve a la bandeja del vendedor en estado Observado, con tus notas. Tendrá 15 días para corregir y reenviar.${
                onEnviarSup && app.estado !== "SUPERIOR"
                  ? " Si el caso lo tiene que resolver un superior, usá Enviar a SUP: pasa a la bandeja SUP con el motivo y la nota."
                  : ""
              }`
            : modal === "anular"
              ? "Anular no es un rechazo de riesgo: se usa cuando el cliente desiste. La solicitud queda cerrada como Anulada."
              : "El rechazo es definitivo. Se registran el motivo codificado y la observación."}
        </p>
        {modal === "observar" && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-200 bg-ink-25 px-3 py-2.5">
            <p className="text-xs text-ink-600">
              Revisá la documentación del titular, los garantes y las referencias antes de observar.
            </p>
            <Button size="sm" variant="outline" onClick={() => setLegajoObservar(true)}>
              <IconFileText width={14} height={14} />
              Ver legajo virtual
            </Button>
          </div>
        )}
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
              placeholder="Seleccioná pantallas…"
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
      {/* Después del modal de observar para quedar encima de él. */}
      <LegajoVirtualModal open={legajoObservar} onClose={() => setLegajoObservar(false)} />
    </div>
  );
}
