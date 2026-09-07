"use client";

import { useRouter } from "next/navigation";
import { useApplication } from "@/lib/application-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { SuccessScreen } from "@/components/SuccessScreen";
import { formatARS } from "@/lib/format";
import { netoAAcreditar } from "@/lib/credit";
import { IconFileStack } from "@/components/icons";

export function SolicitudEnviada() {
  const router = useRouter();
  const { app, reiniciarDemo } = useApplication();

  if (app.estado === "APROBADO" || app.estado === "RECHAZADO") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center sm:px-6">
        <Card className="animate-fade-up p-8">
          <h1 className="text-lg font-bold tracking-tight text-ink-900">
            La solicitud {app.numeroCredito} ya fue {app.estado === "APROBADO" ? "aprobada" : "rechazada"}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">
            Podés ver el detalle en la bandeja de análisis o iniciar una nueva demo.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={() => router.push("/analisis")}>Ver bandeja de análisis</Button>
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
        timeline={[
          { label: "Solicitud", estado: "done" },
          { label: "Riesgo", estado: "done" },
          { label: "Oferta", estado: "done" },
          { label: "Onboarding", estado: "done" },
          { label: "Análisis", estado: "current" },
        ]}
        primaryAction={{
          label: "Ir a la bandeja de análisis",
          onClick: () => router.push("/analisis"),
        }}
        secondaryAction={{
          label: "Volver al inicio",
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
              <dt className="text-[11px] font-medium text-ink-500">Capital</dt>
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
              <dt className="text-[11px] font-medium text-ink-500">Neto a acreditar</dt>
              <dd className="text-sm font-semibold tabular-nums text-success-700">
                {formatARS(netoAAcreditar(app.oferta))}
              </dd>
            </div>
          </dl>
        </div>
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-500">
          <IconFileStack width={14} height={14} />
          El crédito ya no aparece en la bandeja del vendedor.
        </p>
      </SuccessScreen>
    </div>
  );
}
