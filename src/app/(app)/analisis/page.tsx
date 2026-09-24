"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { importeTerceros, netoAAcreditar } from "@/lib/credit";
import { formatARS, sumarDias } from "@/lib/format";
import { bancosDe } from "@/lib/campos-post-oferta";
import { ESTADOS_FIRMA } from "@/lib/firma";
import type { MetodoFirma } from "@/lib/types";
import { FirmaPanel } from "@/components/analisis/FirmaPanel";
import { HistorialCredito } from "@/components/HistorialCredito";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { SuccessScreen } from "@/components/SuccessScreen";
import { BandejaAnalista } from "@/components/analisis/BandejaAnalista";
import { AnalisisCredito } from "@/components/analisis/AnalisisCredito";
import { ListaAnalisis } from "@/components/analisis/ListaAnalisis";
import { AprobacionModal } from "@/components/analisis/AprobacionModal";
import {
  IconAlertTriangle,
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
    tomarAnalisis,
    observarCredito,
    rechazarCredito,
    aprobarCredito,
    reiniciarDemo,
  } = useApplication();
  const [aprobarModal, setAprobarModal] = useState(false);
  const [procesando, setProcesando] = useState(false);
  // La bandeja abre en la lista; "Abrir" entra al detalle de la solicitud.
  const [abierta, setAbierta] = useState(false);

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
    app.estado === "OBSERVADO" ||
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
        {app.estado === "OBSERVADO" && (
          <Card className="animate-fade-up p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-50 text-warning-600">
                <IconAlertTriangle width={20} height={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink-900">
                  {app.numeroCredito} devuelta al canal de venta
                  <EstadoBadge estado="OBSERVADO" />
                </p>
                {app.analista.observacion && (
                  <p className="mt-1 text-sm text-ink-600">
                    <strong>{app.analista.observacion.motivo}:</strong>{" "}
                    {app.analista.observacion.nota}
                  </p>
                )}
                <p className="mt-2 text-xs text-ink-500">
                  Volverá a esta bandeja cuando el vendedor reenvíe las correcciones
                  {app.analista.observacion &&
                    ` (plazo: ${sumarDias(app.analista.observacion.fecha, 15)})`}
                  .
                </p>
                <Button className="mt-4" size="sm" variant="outline" onClick={() => router.push("/")}>
                  Ver en la bandeja del canal de venta
                </Button>
              </div>
            </div>
          </Card>
        )}

        {app.estado === "PREAPROBADO" && <BandejaAnalista onTomar={tomarAnalisis} />}

        {ESTADOS_FIRMA.includes(app.estado) && <FirmaPanel onRechazar={rechazarCredito} />}

        {app.estado === "ANALISIS_TOMADO" && (
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
