"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { netoAAcreditar } from "@/lib/credit";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SuccessScreen } from "@/components/SuccessScreen";
import { BandejaAnalista } from "@/components/analisis/BandejaAnalista";
import { AnalisisCredito } from "@/components/analisis/AnalisisCredito";
import { AprobacionModal } from "@/components/analisis/AprobacionModal";
import { IconFileText, IconLoader, IconRefresh, IconX } from "@/components/icons";

export default function AnalisisPage() {
  const router = useRouter();
  const {
    app,
    hidratado,
    tomarAnalisis,
    observarCredito,
    rechazarCredito,
    aprobarCredito,
    reanudarAnalisis,
    reiniciarDemo,
  } = useApplication();
  const [aprobarModal, setAprobarModal] = useState(false);
  const [procesando, setProcesando] = useState(false);

  if (!hidratado) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-ink-400">
        <IconLoader width={24} height={24} />
      </div>
    );
  }

  const enBandeja =
    app.estado === "EN_ANALISIS" ||
    app.estado === "ANALISIS_TOMADO" ||
    app.estado === "OBSERVADA" ||
    app.estado === "APROBADO" ||
    app.estado === "RECHAZADO";

  if (!enBandeja || !app.cliente || !app.numeroCredito) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <Card className="animate-fade-up p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-400">
            <IconFileText width={22} height={22} />
          </span>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-ink-900">
            La bandeja de análisis está vacía
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
            Cuando finalices la carga de una solicitud desde el onboarding, aparecerá acá para su
            revisión y aprobación.
          </p>
          <div className="mt-6">
            <Button onClick={() => router.push("/")}>Ir al inicio</Button>
          </div>
        </Card>
      </div>
    );
  }

  function aprobar() {
    setAprobarModal(false);
    setProcesando(true);
    window.setTimeout(() => {
      aprobarCredito();
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
            Se genera el comprobante y la orden de acreditación para Caja y Bancos.
          </p>
        </Card>
      </div>
    );
  }

  if (app.estado === "APROBADO") {
    const o = app.oferta;
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <SuccessScreen
          variant="aprobado"
          numero={app.numeroCredito}
          capital={o.montoSolicitado}
          neto={netoAAcreditar(o)}
          cuotas={o.plazo}
          valorCuota={o.valorCuota}
          timeline={[
            { label: "Solicitud", estado: "done" },
            { label: "Riesgo", estado: "done" },
            { label: "Oferta", estado: "done" },
            { label: "Onboarding", estado: "done" },
            { label: "Análisis", estado: "done" },
            { label: "Aprobación", estado: "done" },
            { label: "Caja y Bancos", estado: "pending" },
          ]}
          primaryAction={{ label: "Volver al inicio", onClick: () => router.push("/") }}
          secondaryAction={{
            label: "Iniciar nueva demo",
            onClick: () => {
              reiniciarDemo();
              router.push("/");
            },
          }}
        >
          <p className="mt-4 text-center text-sm text-ink-500">
            Tras la aprobación, el crédito pasa a <strong>Caja y Bancos</strong> para la
            liquidación (fuera del alcance de esta demo).
          </p>
        </SuccessScreen>
      </div>
    );
  }

  if (app.estado === "RECHAZADO") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <Card className="animate-fade-up overflow-hidden">
          <div className="bg-danger-50 px-6 py-10 text-center">
            <span className="mx-auto flex h-14 w-14 animate-pop items-center justify-center rounded-full bg-danger-600 text-white shadow-sm">
              <IconX width={26} height={26} strokeWidth={2.6} />
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-danger-700">
              Solicitud rechazada
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-danger-600">
              La solicitud {app.numeroCredito} fue rechazada por el analista.
            </p>
          </div>
          <div className="p-6">
            <Banner tone="error" title="Motivo del rechazo">
              {app.analista.motivoRechazo}
            </Banner>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Button onClick={() => router.push("/")}>Volver al inicio</Button>
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
      <div className="animate-fade-in flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
            Equipo de análisis
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">
            Bandeja de análisis
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Solicitudes enviadas por los vendedores esperando revisión.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push("/")}>
          Volver al inicio
        </Button>
      </div>

      <div className="mt-6 space-y-5">
        {app.estado === "OBSERVADA" && (
          <Banner tone="warning" title="Solicitud observada">
            <span>
              {app.analista.observacion ??
                "La solicitud quedó marcada para revisión posterior."}{" "}
              En el sistema real volvería al vendedor para subsanar las observaciones.
            </span>
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={reanudarAnalisis}>
                <IconRefresh width={14} height={14} />
                Reanudar análisis
              </Button>
            </div>
          </Banner>
        )}

        {app.estado === "EN_ANALISIS" && <BandejaAnalista onTomar={tomarAnalisis} />}

        {(app.estado === "ANALISIS_TOMADO" || app.estado === "OBSERVADA") && (
          <AnalisisCredito
            onObservar={() =>
              observarCredito("Solicitud observada por el analista para revisión posterior.")
            }
            onRechazar={(motivo) => rechazarCredito(motivo)}
            onAprobar={() => setAprobarModal(true)}
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
