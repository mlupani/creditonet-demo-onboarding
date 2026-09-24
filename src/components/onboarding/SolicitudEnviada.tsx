"use client";

import { useRouter } from "next/navigation";
import { useApplication } from "@/lib/application-context";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { SuccessScreen } from "@/components/SuccessScreen";
import { formatARS, sumarDias } from "@/lib/format";
import {
  SUBESTADO_OBSERVADO,
  cambiosOfertaDe,
  netoAAcreditar,
  ofertaAnalistaDe,
  subestadoObservado,
} from "@/lib/credit";
import { ESTADOS_FIRMA } from "@/lib/firma";
import { textoChequeo } from "@/lib/historial";
import { HistorialCredito } from "@/components/HistorialCredito";
import { IconAlertTriangle, IconFileStack } from "@/components/icons";

export function SolicitudEnviada() {
  const router = useRouter();
  const { app, reiniciarDemo, retomarObservada } = useApplication();

  if (app.estado === "OBSERVADO") {
    const obs = app.analista.observacion;
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <Card className="animate-fade-up overflow-hidden">
          <div className="bg-warning-50 px-6 py-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning-500 text-white shadow-sm">
              <IconAlertTriangle width={26} height={26} />
            </span>
            <h1 className="mt-4 text-xl font-bold tracking-tight text-warning-700">
              La solicitud {app.numeroCredito} fue observada
            </h1>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-warning-700/80">
              El analista de riesgo la devolvió al canal de venta con correcciones requeridas.
            </p>
          </div>
          <div className="space-y-5 p-6">
            {obs && (
              <Banner tone="warning" title={obs.motivo}>
                <strong>{SUBESTADO_OBSERVADO[subestadoObservado(app) ?? "OBS"].etiqueta}</strong> ·{" "}
                {SUBESTADO_OBSERVADO[subestadoObservado(app) ?? "OBS"].origen}. {obs.nota} Corregí antes del <strong>{sumarDias(obs.fecha, 15)}</strong> (15 días)
                para que no expire.
                {ofertaAnalistaDe(app) &&
                  (cambiosOfertaDe(app).at(-1)?.tipo === "OFERTA"
                    ? " Tenés que aceptar la nueva oferta o declinarla: el resto de la carga queda bloqueada."
                    : " Podés aceptar la nueva oferta o elegir otra menor en la grilla. Después sólo queda habilitado el legajo virtual: ver el legajo, imprimir el formulario y subir más documentación.")}
                {obs.pantallas.length > 0 && !ofertaAnalistaDe(app) &&
                  " Es una corrección puntual: sólo se puede editar lo observado y el resto de la carga queda bloqueada."}
              </Banner>
            )}
            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <Button onClick={retomarObservada}>
                {ofertaAnalistaDe(app) ? "Ver la nueva oferta" : "Corregir y reenviar"}
              </Button>
              <Button variant="outline" onClick={() => router.push("/")}>
                Volver a la bandeja
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

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
              <dt className="text-[11px] font-medium text-ink-500">Acreditación neta</dt>
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
