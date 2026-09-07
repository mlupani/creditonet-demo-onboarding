"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { STEPS_ORIGINACION } from "@/lib/mocks";
import {
  IconArrowRight,
  IconClipboardPlus,
  IconClock,
  IconFileStack,
  IconLandmark,
  IconWallet,
} from "@/components/icons";

interface Accion {
  id: string;
  titulo: string;
  descripcion: string;
  icon: (props: { width?: number; height?: number }) => React.ReactNode;
  disponible: boolean;
}

const ACCIONES: Accion[] = [
  {
    id: "solicitar",
    titulo: "Solicitar crédito",
    descripcion:
      "Iniciá una solicitud: identificación del cliente, evaluación de riesgo, oferta y carga post-oferta.",
    icon: IconClipboardPlus,
    disponible: true,
  },
  {
    id: "precancelaciones",
    titulo: "Precancelaciones",
    descripcion: "Gestión de cancelaciones anticipadas de créditos vigentes.",
    icon: IconWallet,
    disponible: false,
  },
  {
    id: "mora",
    titulo: "Gestión de mora",
    descripcion: "Seguimiento y regularización de créditos con atraso.",
    icon: IconLandmark,
    disponible: false,
  },
];

export default function ModuloOnboardingPage() {
  const router = useRouter();
  const { app, paso, reiniciarDemo } = useApplication();
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);

  const enviada = app.estado !== "BORRADOR";
  const enCurso =
    !enviada && (app.tipoPersona !== null || app.identificacion.consultado || paso > 1);

  function nuevaSolicitud() {
    reiniciarDemo();
    router.push("/onboarding");
  }

  function continuar() {
    if (enviada) router.push("/analisis");
    else router.push("/onboarding");
  }

  const pasoMeta = STEPS_ORIGINACION[Math.min(paso, STEPS_ORIGINACION.length) - 1];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="animate-fade-up">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
          CreditoNet · Módulo Onboarding
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
          ¿Qué querés hacer?
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-500 sm:text-base">
          El módulo Onboarding es el punto de entrada de una operación de crédito. En esta demo
          solo la solicitud de crédito es navegable.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {ACCIONES.map((accion) => (
          <Card
            key={accion.id}
            className={`flex flex-col p-5 transition ${
              accion.disponible ? "hover:border-brand-300 hover:shadow-lift" : "opacity-80"
            }`}
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                accion.disponible
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-ink-100 text-ink-400"
              }`}
            >
              <accion.icon width={21} height={21} />
            </span>
            <h2 className="mt-4 text-base font-bold tracking-tight text-ink-900">
              {accion.titulo}
            </h2>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-500">
              {accion.descripcion}
            </p>
            <div className="mt-4">
              {accion.disponible ? (
                <Button onClick={continuar} className="w-full">
                  {enCurso ? "Continuar solicitud" : "Comenzar"}
                  <IconArrowRight width={16} height={16} />
                </Button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-xs font-semibold text-ink-400">
                  <IconClock width={13} height={13} />
                  Disponible próximamente
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>

      {(enCurso || enviada) && (
        <Card className="animate-fade-up mt-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    enviada ? "bg-brand-500" : "bg-warning-500"
                  }`}
                />
                <p className="text-xs font-bold uppercase tracking-wider text-ink-500">
                  {enviada ? "Última solicitud" : "Solicitud en curso"}
                </p>
                {app.numeroCredito && (
                  <span className="font-mono text-xs font-semibold text-brand-700">
                    {app.numeroCredito}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm font-semibold text-ink-900">
                {app.cliente
                  ? `${app.cliente.nombre} ${app.cliente.apellido}`
                  : "Sin cliente identificado"}
              </p>
              <p className="mt-0.5 text-xs text-ink-500">
                {enviada ? (
                  <span className="inline-flex items-center gap-1.5">
                    <EstadoBadge estado={app.estado} />
                  </span>
                ) : app.etapa === "POST_OFERTA" || app.etapa === "TRANSICION" ? (
                  "Etapa 2 · Carga post-oferta"
                ) : (
                  `Etapa 1 · Paso ${paso} de ${STEPS_ORIGINACION.length} · ${pasoMeta.titulo}`
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={continuar}>
                {enviada ? "Ver en análisis" : "Continuar"}
                <IconArrowRight width={15} height={15} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmarDescarte(true)}>
                {enviada ? "Nueva demo" : "Descartar"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-6">
        <p className="text-xs text-ink-400">
          Ambiente de demostración · datos simulados · sin conexión a sistemas reales.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/analisis")}>
            <IconFileStack width={15} height={15} />
            Bandeja de análisis
          </Button>
          <Button variant="ghost" size="sm" onClick={nuevaSolicitud}>
            Reiniciar demo
          </Button>
        </div>
      </div>

      <ConfirmationModal
        open={confirmarDescarte}
        title={enviada ? "¿Iniciar una nueva demo?" : "¿Descartar la solicitud en curso?"}
        descripcion={
          enviada
            ? "Se reinicia la demo desde el principio."
            : "Se perderán los datos cargados hasta el momento. Esta acción no se puede deshacer."
        }
        rows={[
          {
            label: "Cliente",
            value: app.cliente ? `${app.cliente.nombre} ${app.cliente.apellido}` : "—",
          },
          {
            label: "Estado",
            value: enviada ? <EstadoBadge estado={app.estado} /> : `Paso ${paso}`,
          },
        ]}
        confirmLabel={enviada ? "Iniciar nueva demo" : "Descartar solicitud"}
        cancelLabel="Volver"
        tone="danger"
        onConfirm={() => {
          setConfirmarDescarte(false);
          nuevaSolicitud();
        }}
        onCancel={() => setConfirmarDescarte(false)}
      />
    </div>
  );
}
