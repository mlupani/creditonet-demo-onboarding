"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApplication } from "@/lib/application-context";
import { cambiosOfertaDe, importeTerceros, netoAAcreditar, ofertaAnalistaDe } from "@/lib/credit";
import { TERMINOS } from "@/lib/terminologia";
import { formatARS } from "@/lib/format";
import { bancosDe } from "@/lib/campos-post-oferta";
import { ESTADOS_FIRMA, firmaAprobada, modalidadFirma } from "@/lib/firma";
import type { MetodoFirma } from "@/lib/types";
import { FirmaPanel } from "@/components/analisis/FirmaPanel";
import { HiloObservacion } from "@/components/analisis/HiloObservacion";
import { LegajoVirtualModal } from "@/components/analisis/LegajoVirtualModal";
import { ListaComentarios } from "@/components/bandeja/ModalesBandeja";
import { HistorialCredito } from "@/components/HistorialCredito";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { MOTIVO_RECHAZO_OFERTA } from "@/lib/validation";
import { SuccessScreen } from "@/components/SuccessScreen";
import { AnalisisCredito } from "@/components/analisis/AnalisisCredito";
import { ListaAnalisis } from "@/components/analisis/ListaAnalisis";
import { AprobacionModal } from "@/components/analisis/AprobacionModal";
import { ObservarOfertaModal } from "@/components/analisis/ObservarOfertaModal";
import {
  IconArrowLeft,
  IconClock,
  IconLandmark,
  IconLoader,
  IconX,
} from "@/components/icons";

function ultimos(cbu: string) {
  return cbu ? `CBU ···${cbu.slice(-4)}` : "CBU —";
}

export default function AnalisisPage() {
  const router = useRouter();
  const {
    app,
    hidratado,
    observarCredito,
    rechazarCredito,
    aprobarCredito,
    dejarAprobado,
    enviarCofeASuperior,
    enviarAnalisisASuperior,
    reiniciarDemo,
  } = useApplication();
  const [aprobarModal, setAprobarModal] = useState(false);
  const [supAbierto, setSupAbierto] = useState(false);
  const [observarOferta, setObservarOferta] = useState(false);
  // Pantalla APR: comentarios y conversación completa vendedor-analista.
  const [verAprobado, setVerAprobado] = useState<"comentarios" | "mensajes" | null>(null);
  const [rechazoOferta, setRechazoOferta] = useState<{ nota: string; intentado: boolean } | null>(null);
  const [legajoAbierto, setLegajoAbierto] = useState(false);
  // El modal de observaciones se abre solo al entrar a Confirmar oferta; se guarda para
  // qué crédito se descartó para no reabrirlo, y el botón lo vuelve a abrir.
  const [obsCerradoPara, setObsCerradoPara] = useState<string | null>(null);
  const [obsReabierto, setObsReabierto] = useState(false);
  const [destinoFirma, setDestinoFirma] = useState<MetodoFirma>("ELECTRONICA");
  const [procesando, setProcesando] = useState(false);
  // La bandeja abre en la lista; "Abrir" entra al detalle de la solicitud.
  const [abierta, setAbierta] = useState(false);

  // La oferta la cambió el analista (oferta o datos financieros): la tiene que ver
  // el vendedor, así que se redirige a su bandeja en vez de quedarse en la del analista.
  const ofertaCambiada = ofertaAnalistaDe(app) !== null;
  useEffect(() => {
    if (hidratado && ofertaCambiada) router.push("/");
  }, [hidratado, ofertaCambiada, router]);

  if (!hidratado) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-ink-400">
        <IconLoader width={24} height={24} />
      </div>
    );
  }

  // Un rechazo del motor nunca llega al analista (Guía §7.2).
  // El rechazo del chequeador también se puede ver (sólo lectura).
  const rechazoAnalista =
    app.estado === "RECHAZADO" &&
    (app.rechazo?.origen === "ANALISTA" ||
      app.rechazo?.origen === "CHEQUEADOR" ||
      app.rechazo?.origen === "SUPERIOR");
  const enBandeja =
    app.estado === "PREAPROBADO" ||
    app.estado === "ANALISIS_TOMADO" ||
    app.estado === "CAMBIO_OFERTA" ||
    app.estado === "APROBADO" ||
    ESTADOS_FIRMA.includes(app.estado) ||
    app.estado === "PARA_LIQUIDAR" ||
    rechazoAnalista;

  const volver = (
    <Button variant="ghost" size="sm" onClick={() => setAbierta(false)} className="mb-3">
      <IconArrowLeft width={15} height={15} />
      Volver a la bandeja de análisis
    </Button>
  );

  if (!abierta || !enBandeja || !app.cliente || !app.numeroCredito) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="animate-fade-in flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
              Analista de riesgo
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">
              Bandeja de análisis
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              Las solicitudes que el canal de venta termina de cargar llegan acá. Las que el motor
              rechazó nunca llegan.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push("/")}>
            Bandeja del canal de venta
          </Button>
        </div>
        <div className="mt-6">
          <ListaAnalisis onAbrir={() => setAbierta(true)} />
        </div>
      </div>
    );
  }

  // Aprobar deja el crédito en APROBADO (bandeja APR); desde APR se pasa a FEL/AFEL.
  function aprobarAprobado() {
    setAprobarModal(false);
    setProcesando(true);
    window.setTimeout(() => {
      dejarAprobado();
      setProcesando(false);
    }, 1200);
  }

  // Desde APR se pasa a firma: electrónica → FEL, física → AFEL directo.
  function avanzarAFirma(metodo: MetodoFirma) {
    setAprobarModal(false);
    setProcesando(true);
    window.setTimeout(() => {
      aprobarCredito(metodo);
      setProcesando(false);
    }, 1200);
  }

  // Caso especial que el analista no puede resolver: lo toma un superior.
  function enviarSup() {
    setSupAbierto(false);
    setProcesando(true);
    window.setTimeout(() => {
      enviarCofeASuperior();
      setProcesando(false);
    }, 1200);
  }

  if (procesando) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <Card className="animate-fade-up p-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <IconLoader width={26} height={26} />
          </span>
          <h1 className="mt-5 text-lg font-bold tracking-tight text-ink-900">
            Procesando…
          </h1>
          <p className="mt-1.5 text-sm text-ink-500">
            La solicitud avanza al siguiente tramo.
          </p>
        </Card>
      </div>
    );
  }

  // Origen COFE en manos del superior: sin firma aprobada, confirma igual que el analista.
  // Enviada a SUP desde la observación del análisis: el superior la resuelve en el análisis.
  const supAnalisis = app.estado === "SUPERIOR" && app.aprobacionSuperior?.origen === "ANALISIS";
  const cofeSuperior = app.estado === "SUPERIOR" && !firmaAprobada(app.firmas) && !supAnalisis;

  if (app.estado === "CAMBIO_OFERTA" || cofeSuperior) {
    // Confirmar oferta: el vendedor aceptó la del analista o eligió una menor. Confirmar
    // deja el crédito en APROBADO (bandeja APR); desde ahí se pasa a firma (FEL/AFEL).
    // La inicial es la anterior al cambio (historial); ofertaAnalista guarda la nueva.
    const ultimoCambio = cambiosOfertaDe(app).at(-1) ?? null;
    const o = app.oferta;
    const obsAuto = obsCerradoPara !== app.numeroCredito;
    const cerrarObs = () => {
      setObsCerradoPara(app.numeroCredito);
      setObsReabierto(false);
    };
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {volver}
        <div className="animate-fade-in flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
              {cofeSuperior ? "Superior de riesgo" : "Analista de riesgo"}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">
              Confirmar oferta · Crédito {app.numeroCredito}
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              {cofeSuperior && app.aprobacionSuperior
                ? `Caso especial tomado por el superior (pedido por ${app.aprobacionSuperior.enviadaPor} el ${app.aprobacionSuperior.fechaEnvio}). Al confirmar, el crédito queda aprobado (APR) y desde ahí se pasa a firma.`
                : "El canal de venta respondió al cambio de oferta. Al confirmar, el crédito queda aprobado (APR) y desde ahí se pasa a firma."}
            </p>
          </div>
          <EstadoBadge estado={app.estado} />
        </div>

        <div className="mt-6 space-y-5">
          {/* Los comentarios van primero: dan el contexto antes de comparar las ofertas. */}
          {app.comentarios.length > 0 && (
            <Card className="px-5 pb-5 pt-1">
              <ListaComentarios titulo="Comentarios" />
            </Card>
          )}

          <Card className="p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-warning-200 bg-warning-50/50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-warning-700">
                  Oferta inicial
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-ink-900">
                  {ultimoCambio?.montoAnterior != null ? formatARS(ultimoCambio.montoAnterior) : "—"}
                </p>
                <p className="text-sm text-ink-500">
                  {ultimoCambio?.plazoAnterior != null ? `${ultimoCambio.plazoAnterior} cuotas` : "Sin dato previo"}
                </p>
              </div>
              <div className="rounded-xl border border-success-200 bg-success-50/50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-success-700">
                  Oferta propuesta aceptada
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-ink-900">
                  {formatARS(o.montoSolicitado)}
                </p>
                <p className="text-sm text-ink-500">
                  {o.plazo} cuotas de {formatARS(o.valorCuota)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => setObsReabierto(true)}>
                  Ver observaciones
                </Button>
                <Button variant="outline" onClick={() => setLegajoAbierto(true)}>
                  Ver legajo virtual
                </Button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => setObservarOferta(true)}>
                  Observar
                </Button>
                {!cofeSuperior && (
                  <Button variant="outline" onClick={() => setSupAbierto(true)}>
                    Enviar a SUP
                  </Button>
                )}
                <Button
                  size="lg"
                  variant="danger"
                  onClick={() => setRechazoOferta({ nota: "", intentado: false })}
                >
                  Rechazar oferta
                </Button>
                <Button size="lg" variant="success" onClick={() => setAprobarModal(true)}>
                  Confirmar oferta
                </Button>
              </div>
            </div>
          </Card>

        </div>

        <AprobacionModal
          open={aprobarModal}
          loading={false}
          modo="APROBADO"
          onConfirm={aprobarAprobado}
          onCancel={() => setAprobarModal(false)}
        />
        <AprobacionModal
          open={supAbierto}
          loading={false}
          modo="SUP"
          onConfirm={() => enviarSup()}
          onCancel={() => setSupAbierto(false)}
        />
        <Modal
          open={obsAuto || obsReabierto}
          onClose={cerrarObs}
          title="Observaciones de la solicitud"
          maxWidth="max-w-2xl"
          footer={
            <div className="flex justify-end">
              <Button variant="outline" onClick={cerrarObs}>
                Cerrar
              </Button>
            </div>
          }
        >
          <HiloObservacion />
        </Modal>
        <LegajoVirtualModal open={legajoAbierto} onClose={() => setLegajoAbierto(false)} />
        <ObservarOfertaModal open={observarOferta} onClose={() => setObservarOferta(false)} />
        <Modal
          open={rechazoOferta !== null}
          onClose={() => setRechazoOferta(null)}
          title="Rechazar la oferta"
          maxWidth="max-w-md"
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setRechazoOferta(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (!rechazoOferta) return;
                  const nota = rechazoOferta.nota.trim();
                  if (nota.length < 5) {
                    setRechazoOferta({ ...rechazoOferta, intentado: true });
                    return;
                  }
                  rechazarCredito(MOTIVO_RECHAZO_OFERTA.codigo, MOTIVO_RECHAZO_OFERTA.label, nota);
                  setRechazoOferta(null);
                }}
              >
                Rechazar y dar de baja
              </Button>
            </div>
          }
        >
          <p className="text-sm text-ink-600">
            El crédito se da de baja: queda <strong>Rechazado</strong> ({MOTIVO_RECHAZO_OFERTA.codigo} ·{" "}
            {MOTIVO_RECHAZO_OFERTA.label}) y no sigue a firma. No se puede deshacer.
          </p>
          <label htmlFor="nota-rechazo-oferta" className="mt-4 block text-sm font-medium text-ink-700">
            Observación <span className="text-danger-500">*</span>
          </label>
          <textarea
            id="nota-rechazo-oferta"
            rows={3}
            value={rechazoOferta?.nota ?? ""}
            onChange={(e) => rechazoOferta && setRechazoOferta({ ...rechazoOferta, nota: e.target.value })}
            placeholder="Ej.: El cliente no acepta el monto reducido de la oferta."
            className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm shadow-xs outline-none transition ${
              rechazoOferta?.intentado && rechazoOferta.nota.trim().length < 5
                ? "border-danger-400 focus:ring-2 focus:ring-danger-100"
                : "border-ink-300 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            }`}
          />
          {rechazoOferta?.intentado && rechazoOferta.nota.trim().length < 5 && (
            <p className="mt-1.5 text-sm text-danger-600">
              Ingresá al menos 5 caracteres para que el registro sea claro.
            </p>
          )}
        </Modal>
      </div>
    );
  }

  if (app.estado === "APROBADO") {
    const o = app.oferta;
    const modalidad = modalidadFirma(app.configuracion);
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {volver}
        <div className="animate-fade-in flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
              Analista de riesgo
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">
              Crédito aprobado · {app.numeroCredito}
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              El crédito está aprobado y espera pasar a firma: electrónica (FEL) o física
              (AFEL directo), según la modalidad del producto.
            </p>
          </div>
          <EstadoBadge estado={app.estado} />
        </div>
        <Card className="mt-6 space-y-4 p-4 sm:p-5">
          <p className="text-sm text-ink-700">
            {app.cliente.nombre} {app.cliente.apellido} · <strong>{formatARS(o.montoSolicitado)}</strong>{" "}
            en {o.plazo} cuotas de {formatARS(o.valorCuota)}
          </p>
          <p className="text-xs text-ink-500">
            Modalidad del producto:{" "}
            {modalidad === "FISICA"
              ? "física (AFEL directo)"
              : modalidad === "ELECTRONICA"
                ? "electrónica (FEL)"
                : "ambas (FEL o AFEL)"}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setVerAprobado("comentarios")}>
                Ver comentarios{app.comentarios.length > 0 ? ` (${app.comentarios.length})` : ""}
              </Button>
              {/* <Button variant="outline" onClick={() => setVerAprobado("mensajes")}>
                Ver observaciones
              </Button> */}
            </div>
            {(modalidad === "ELECTRONICA" || modalidad === "AMBAS") && (
              <Button
                size="lg"
                variant="success"
                onClick={() => {
                  setDestinoFirma("ELECTRONICA");
                  setAprobarModal(true);
                }}
              >
                Pasar a FEL
              </Button>
            )}
          </div>
        </Card>
        <HistorialCredito className="mt-5" />
        <Modal
          open={verAprobado !== null}
          onClose={() => setVerAprobado(null)}
          title={verAprobado === "mensajes" ? "Mensajes entre vendedor y analista" : "Comentarios"}
          maxWidth="max-w-2xl"
          footer={
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setVerAprobado(null)}>
                Cerrar
              </Button>
            </div>
          }
        >
          {verAprobado === "mensajes" ? (
            <HiloObservacion />
          ) : app.comentarios.length > 0 ? (
            <ListaComentarios titulo="Comentarios" />
          ) : (
            <p className="text-sm text-ink-500">La solicitud no tiene comentarios.</p>
          )}
        </Modal>
        <AprobacionModal
          open={aprobarModal}
          loading={false}
          modo="FIRMA"
          metodoDestino={destinoFirma}
          onConfirm={avanzarAFirma}
          onCancel={() => setAprobarModal(false)}
        />
      </div>
    );
  }

  if (app.estado === "PARA_LIQUIDAR") {
    const o = app.oferta;
    const terceros = importeTerceros(o);
    const operaciones = [
      {
        titulo: TERMINOS.saldoAcreditacion,
        detalle:
          bancosDe(app.postOferta.laboral.banco)
            .map((b) => `${b} · ${ultimos(app.postOferta.laboral[`cbu.${b}`] ?? "")}`)
            .join(" / ") || "—",
        monto: netoAAcreditar(o),
      },
      ...(terceros > 0
        ? [
            {
              titulo: "Orden de pago a terceros",
              detalle: `${o.deudaTerceros.entidad} · ${ultimos(o.deudaTerceros.cbu)}`,
              monto: terceros,
            },
          ]
        : []),
      ...o.creditosActivos
        .filter((c) => c.precancelar)
        .map((c) => ({
          titulo: "Cancelación de crédito propio renovado",
          detalle: c.id,
          monto: c.montoCancelacion,
        })),
    ];

    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {volver}
        <SuccessScreen
          variant="aprobado"
          numero={app.numeroCredito}
          capital={o.montoSolicitado}
          neto={netoAAcreditar(o)}
          cuotas={o.plazo}
          valorCuota={o.valorCuota}
          timeline={[
            { label: "Solicitud", estado: "done" },
            { label: "Motor de riesgo", estado: "done" },
            { label: "Oferta", estado: "done" },
            { label: "Carga post-oferta", estado: "done" },
            { label: "Análisis", estado: "done" },
            { label: "Para liquidar", estado: "current" },
            { label: "Activo", estado: "pending" },
          ]}
          primaryAction={{ label: "Ir a la bandeja del canal de venta", onClick: () => router.push("/") }}
          secondaryAction={{
            label: "Iniciar nueva demo",
            onClick: () => {
              reiniciarDemo();
              router.push("/");
            },
          }}
        >
          <div className="mt-6 rounded-xl border border-ink-200 bg-white">
            <div className="flex items-center gap-2.5 border-b border-ink-100 px-5 py-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <IconLandmark width={16} height={16} />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  Próximo paso · Bandeja de Liquidación (Tesorería)
                </p>
                <p className="text-xs text-ink-500">
                  Al confirmar el desembolso, la solicitud pasa a estado Activo.
                </p>
              </div>
            </div>
            <ul className="divide-y divide-ink-100">
              {operaciones.map((op) => (
                <li
                  key={`${op.titulo}-${op.detalle}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-800">{op.titulo}</p>
                    <p className="text-xs text-ink-500">{op.detalle}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums text-ink-900">
                      {formatARS(op.monto)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                      <IconClock width={11} height={11} />
                      Pendiente
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <HistorialCredito className="mt-5" />
          <p className="mt-3 text-center text-xs text-ink-400">
            La operatoria de Tesorería queda fuera del alcance de esta demo.
          </p>
        </SuccessScreen>
      </div>
    );
  }

  if (rechazoAnalista && app.rechazo) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        {volver}
        <Card className="animate-fade-up overflow-hidden">
          <div className="bg-danger-50 px-6 py-10 text-center">
            <span className="mx-auto flex h-14 w-14 animate-pop items-center justify-center rounded-full bg-danger-600 text-white shadow-sm">
              <IconX width={26} height={26} strokeWidth={2.6} />
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-danger-700">
              Solicitud rechazada
            </h1>
            <p className="mx-auto mt-2 flex max-w-md flex-wrap items-center justify-center gap-2 text-sm text-danger-600">
              {app.numeroCredito} ·{" "}
              {app.rechazo.origen === "CHEQUEADOR"
                ? "rechazo en el chequeo telefónico"
                : app.rechazo.origen === "SUPERIOR"
                  ? "rechazo del superior de riesgo"
                  : "rechazo manual del analista de riesgo"}
              <EstadoBadge estado="RECHAZADO" />
            </p>
          </div>
          <div className="p-6">
            <Banner tone="error" title={`${app.rechazo.codigos.join(", ")} · ${app.rechazo.motivo}`}>
              {app.rechazo.observacion}
            </Banner>
            <HistorialCredito className="mt-5 text-left" />
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Button onClick={() => router.push("/")}>Ir a la bandeja del canal de venta</Button>
              <Button
                variant="outline"
                onClick={() => {
                  reiniciarDemo();
                  router.push("/");
                }}
              >
                Iniciar nueva demo
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {volver}
      <div className="animate-fade-in flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
            {supAnalisis ? "Superior de riesgo" : "Analista de riesgo"}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">
            Crédito {app.numeroCredito}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            El analista revisa toda solicitud que el canal de venta termina de cargar.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push("/")}>
          Bandeja del canal de venta
        </Button>
      </div>

      <div className="mt-6 space-y-5">
        {ESTADOS_FIRMA.includes(app.estado) && !supAnalisis && (
          <FirmaPanel onRechazar={rechazarCredito} />
        )}

        {supAnalisis && app.aprobacionSuperior && (
          <Banner tone="info" title="Enviada a SUP desde el análisis">
            {app.aprobacionSuperior.enviadaPor} la derivó el {app.aprobacionSuperior.fechaEnvio}
            {app.aprobacionSuperior.motivo ? ` · Motivo: ${app.aprobacionSuperior.motivo}` : ""}
            {app.aprobacionSuperior.nota ? ` — ${app.aprobacionSuperior.nota.replace(/\.+$/, "")}` : ""}. El superior
            puede aprobarla, observarla o rechazarla.
          </Banner>
        )}

        {(app.estado === "ANALISIS_TOMADO" || app.estado === "PREAPROBADO" || supAnalisis) && (
          <AnalisisCredito
            onObservar={observarCredito}
            onRechazar={rechazarCredito}
            onAprobar={() => setAprobarModal(true)}
            onSalir={() => setAbierta(false)}
            onEnviarSup={enviarAnalisisASuperior}
          />
        )}
      </div>

      <AprobacionModal
        open={aprobarModal}
        loading={false}
        modo="APROBADO"
        onConfirm={aprobarAprobado}
        onCancel={() => setAprobarModal(false)}
      />
    </div>
  );
}
