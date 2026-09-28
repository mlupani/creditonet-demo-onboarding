"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApplication } from "@/lib/application-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { SuccessScreen } from "@/components/SuccessScreen";
import { formatARS } from "@/lib/format";
import { netoAAcreditar } from "@/lib/credit";
import { ESTADOS_FIRMA } from "@/lib/firma";
import { TERMINOS } from "@/lib/terminologia";
import { textoChequeo } from "@/lib/historial";
import { HistorialCredito } from "@/components/HistorialCredito";
import { IconFileStack, IconLoader } from "@/components/icons";

function RetomarObservada({ onRetomar }: { onRetomar: () => void }) {
  useEffect(() => {
    onRetomar();
  }, [onRetomar]);
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-ink-400">
      <IconLoader width={24} height={24} />
    </div>
  );
}

export function SolicitudEnviada() {
  const router = useRouter();
  const { app, reiniciarDemo, retomarObservada } = useApplication();

  // Observada: sin pantalla intermedia, va directo a corregir o a la nueva oferta del
  // analista. La observación ya se lee en la bandeja ("Ver observación") y en el flujo.
  if (app.estado === "OBSERVADO") return <RetomarObservada onRetomar={retomarObservada} />;

  // Firma y chequeo telefónico: el canal de venta sólo puede ver en qué etapa está el crédito.
  if (app.estado === "APROBADO" || ESTADOS_FIRMA.includes(app.estado)) {
    const info = {
      APROBADO: {
        titulo: "aprobada, a la espera de pasar a firma",
        quien: "el analista de riesgo",
      },
      EN_FIRMA: {
        titulo: "esperando la firma del cliente (FEL)",
        quien: "el cliente",
      },
      FIRMADO: {
        titulo: "con la firma aprobada (AFEL): el analista define el paso siguiente",
        quien: "el analista de riesgo",
      },
      SUPERIOR: {
        titulo: "esperando la aprobación de un superior (SUP)",
        quien: "el superior de riesgo",
      },
      CHEQUEO_TELEFONICO: {
        titulo: "en chequeo telefónico",
        quien: "el chequeador telefónico",
      },
    } as const;
    const etapa = info[app.estado as keyof typeof info];
    return (
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-12 sm:px-6">
        <Card className="animate-fade-up p-8 text-center">
          <div className="flex justify-center">
            <EstadoBadge estado={app.estado} />
          </div>
          <h1 className="mt-3 text-lg font-bold tracking-tight text-ink-900">
            La solicitud {app.numeroCredito} está {etapa.titulo}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
            Sólo lectura: en esta etapa el crédito lo gestiona {etapa.quien}. El canal de venta no
            puede operarlo hasta que avance.
          </p>
          {app.chequeoTelefonico && (
            <p className="mt-3 text-sm text-ink-700">
              Chequeo telefónico: <strong>{textoChequeo(app.chequeoTelefonico)}</strong>
            </p>
          )}
          <div className="mt-6 flex justify-center">
            <Button onClick={() => router.push("/")}>Volver a la bandeja</Button>
          </div>
        </Card>
        <HistorialCredito className="text-left" />
      </div>
    );
  }

  if (app.estado === "PARA_LIQUIDAR" || app.estado === "RECHAZADO") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center sm:px-6">
        <Card className="animate-fade-up p-8">
          <div className="flex justify-center">
            <EstadoBadge estado={app.estado} />
          </div>
          <h1 className="mt-3 text-lg font-bold tracking-tight text-ink-900">
            La solicitud {app.numeroCredito} ya fue{" "}
            {app.estado === "PARA_LIQUIDAR" ? "aprobada" : "rechazada"}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">
            Podés ver el detalle en la bandeja del analista o iniciar una nueva demo.
          </p>
          <HistorialCredito className="mt-5 text-left" />
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={() => router.push("/analisis")}>Ver bandeja del analista</Button>
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
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <SuccessScreen
        variant="enviada"
        titulo={app.analista.reenviada ? "Correcciones reenviadas a análisis" : undefined}
        timeline={[
          { label: "Solicitud", estado: "done" },
          { label: "Motor de riesgo", estado: "done" },
          { label: "Oferta", estado: "done" },
          { label: "Carga post-oferta", estado: "done" },
          { label: "Análisis", estado: "current" },
          { label: "Liquidación", estado: "pending" },
        ]}
        primaryAction={{
          label: "Ir a la bandeja del analista",
          onClick: () => router.push("/analisis"),
        }}
        secondaryAction={{
          label: "Volver a la bandeja",
          onClick: () => router.push("/"),
        }}
      >
        <div className="mt-2 rounded-xl border border-ink-200 bg-ink-25 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-sm font-bold text-brand-700">{app.numeroCredito}</p>
              <p className="mt-0.5 text-sm text-ink-600">
                {app.cliente?.nombre} {app.cliente?.apellido}
              </p>
            </div>
            <EstadoBadge estado={app.estado} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4 sm:grid-cols-3">
            <div>
              <dt className="text-[11px] font-medium text-ink-500">Capital solicitado</dt>
              <dd className="text-sm font-semibold tabular-nums text-ink-900">
                {formatARS(app.oferta.montoSolicitado)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-ink-500">Plazo</dt>
              <dd className="text-sm font-semibold tabular-nums text-ink-900">
                {app.oferta.plazo} cuotas
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-ink-500">{TERMINOS.saldoAcreditacion}</dt>
              <dd className="text-sm font-semibold tabular-nums text-success-700">
                {formatARS(netoAAcreditar(app.oferta))}
              </dd>
            </div>
          </dl>
        </div>
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-500">
          <IconFileStack width={14} height={14} />
          Podés seguir su estado desde la bandeja del canal de venta.
        </p>
      </SuccessScreen>
    </div>
  );
}
