"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApplication } from "@/lib/application-context";
import { importeTerceros, netoAAcreditar, ofertaAnalistaDe } from "@/lib/credit";
import { formatARS } from "@/lib/format";
import { bancosDe } from "@/lib/campos-post-oferta";
import { ESTADOS_FIRMA } from "@/lib/firma";
import type { MetodoFirma } from "@/lib/types";
import { FirmaPanel } from "@/components/analisis/FirmaPanel";
import { ListaComentarios } from "@/components/bandeja/ModalesBandeja";
import { HistorialCredito } from "@/components/HistorialCredito";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { SuccessScreen } from "@/components/SuccessScreen";
import { AnalisisCredito } from "@/components/analisis/AnalisisCredito";
import { ListaAnalisis } from "@/components/analisis/ListaAnalisis";
import { AprobacionModal } from "@/components/analisis/AprobacionModal";
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
    reiniciarDemo,
  } = useApplication();
  const [aprobarModal, setAprobarModal] = useState(false);
  const [procesando, setProcesando] = useState(false);
  // La bandeja abre en la lista; "Abrir" entra al detalle de la solicitud.
  const [abierta, setAbierta] = useState(false);

  // La oferta la cambió el analista (refrendada o por datos financieros): la tiene que ver
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
    (app.rechazo?.origen === "ANALISTA" || app.rechazo?.origen === "CHEQUEADOR");
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

  function aprobar(metodo: MetodoFirma) {
    setAprobarModal(false);
    setProcesando(true);
    window.setTimeout(() => {
      aprobarCredito(metodo);
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
            Procesando aprobación…
          </h1>
          <p className="mt-1.5 text-sm text-ink-500">
            La solicitud pasa al tramo de firma antes de liquidarse.
          </p>
        </Card>
      </div>
    );
  }

  if (app.estado === "CAMBIO_OFERTA") {
    // Confirmar oferta: el vendedor aceptó la del analista o eligió una menor. Confirmar
    // es aprobar directo: se reutiliza el modal de método de firma y aprobarCredito.
    // ofertaAnalistaDe() sólo responde en OBSERVADO: acá se lee la oferta conservada al reenviar.
    const inicial = app.analista.ofertaAnalista ?? null;
    const o = app.oferta;
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {volver}
        <div className="animate-fade-in flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
              Analista de riesgo
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">
              Confirmar oferta · Crédito {app.numeroCredito}
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              El canal de venta respondió al cambio de oferta. Al confirmar, el crédito queda
              aprobado y sigue el tramo de firma.
            </p>
          </div>
          <EstadoBadge estado={app.estado} />
        </div>

        <div className="mt-6 space-y-5">
          <Card className="p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-warning-200 bg-warning-50/50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-warning-700">
                  Oferta inicial
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-ink-900">
                  {inicial ? formatARS(inicial.montoSolicitado) : "—"}
                </p>
                <p className="text-sm text-ink-500">
                  {inicial ? `${inicial.plazo} cuotas` : ""} {inicial?.nota ? `· ${inicial.nota}` : ""}
                </p>
              </div>
              <div className="rounded-xl border border-success-200 bg-success-50/50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-success-700">
                  Oferta final
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-ink-900">
                  {formatARS(o.montoSolicitado)}
                </p>
                <p className="text-sm text-ink-500">
                  {o.plazo} cuotas de {formatARS(o.valorCuota)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button size="lg" variant="success" onClick={() => setAprobarModal(true)}>
                Confirmar oferta
              </Button>
            </div>
          </Card>

          {app.comentarios.length > 0 && (
            <Card className="px-5 pb-5 pt-1">
              <ListaComentarios titulo="Comentarios" />
            </Card>
          )}
        </div>

        <AprobacionModal
          open={aprobarModal}
          loading={false}
          onConfirm={aprobar}
          onCancel={() => setAprobarModal(false)}
        />
      </div>
    );
  }

  if (app.estado === "APROBADO") {
    const o = app.oferta;
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
              El crédito está aprobado y espera pasar a firma. Al pasarlo a firma queda en FEL, a
              la espera de la firma del cliente.
            </p>
          </div>
          <EstadoBadge estado={app.estado} />
        </div>
        <Card className="mt-6 space-y-4 p-4 sm:p-5">
          <p className="text-sm text-ink-700">
            {app.cliente.nombre} {app.cliente.apellido} · <strong>{formatARS(o.montoSolicitado)}</strong>{" "}
            en {o.plazo} cuotas de {formatARS(o.valorCuota)}
          </p>
          <div className="flex justify-end">
            <Button size="lg" variant="success" onClick={() => setAprobarModal(true)}>
              Pasar a firma
            </Button>
          </div>
        </Card>
        <HistorialCredito className="mt-5" />
        <AprobacionModal
          open={aprobarModal}
          loading={false}
          onConfirm={aprobar}
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
        titulo: "Transferencia neta al cliente",
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
            Analista de riesgo
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
        {ESTADOS_FIRMA.includes(app.estado) && <FirmaPanel onRechazar={rechazarCredito} />}

        {(app.estado === "ANALISIS_TOMADO" || app.estado === "PREAPROBADO") && (
          <AnalisisCredito
            onObservar={observarCredito}
            onRechazar={rechazarCredito}
            onAprobar={() => setAprobarModal(true)}
            onSalir={() => setAbierta(false)}
          />
        )}
      </div>

      <AprobacionModal
        open={aprobarModal}
        loading={false}
        onConfirm={aprobar}
        onCancel={() => setAprobarModal(false)}
      />
    </div>
  );
}
