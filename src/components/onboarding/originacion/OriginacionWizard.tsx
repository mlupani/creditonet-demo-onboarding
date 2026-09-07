"use client";

import { useMemo } from "react";
import { useApplication } from "@/lib/application-context";
import { STEPS_ORIGINACION } from "@/lib/mocks";
import { laboralCompleto } from "@/lib/validation";
import { nombreOpcion, ORGANISMOS, PRODUCTOS } from "@/lib/config";
import { formatARS, formatDNI } from "@/lib/format";
import { netoAAcreditar } from "@/lib/credit";
import { Stepper } from "@/components/ui/Stepper";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
import { IconArrowLeft, IconArrowRight, IconCheckCircle, IconUser } from "@/components/icons";

import { PasoTipoPersona } from "./PasoTipoPersona";
import { PasoIdentificacion } from "./PasoIdentificacion";
import { PasoConfiguracion } from "./PasoConfiguracion";
import { PasoLaboralIngresos } from "./PasoLaboralIngresos";
import { PasoDatosAdicionales } from "./PasoDatosAdicionales";
import { PasoVerificacionIdentidad } from "./PasoVerificacionIdentidad";
import { PasoRiesgo } from "./PasoRiesgo";
import { PasoOferta } from "./PasoOferta";

type App = ReturnType<typeof useApplication>["app"];

function gate(paso: number, app: App): { ok: boolean; razon: string | null } {
  switch (paso) {
    case 1:
      if (app.tipoPersona === "FISICA") return { ok: true, razon: null };
      if (app.tipoPersona === "JURIDICA")
        return {
          ok: false,
          razon: "El flujo de persona jurídica estará disponible en una versión futura de la demo. Elegí persona física para continuar.",
        };
      return { ok: false, razon: "Elegí el tipo de persona para continuar." };
    case 2:
      return app.identificacion.consultado && app.cliente
        ? { ok: true, razon: null }
        : { ok: false, razon: "Consultá el DNI del cliente para identificarlo antes de continuar." };
    case 3:
      return { ok: true, razon: null };
    case 4:
      return laboralCompleto(app.laboral, app.configuracion.productoId)
        ? { ok: true, razon: null }
        : {
            ok: false,
            razon: "Completá los campos obligatorios de datos laborales e ingresos para continuar.",
          };
    case 5:
      return app.cliente &&
        app.cliente.domicilio.trim() &&
        app.cliente.telefono.trim()
        ? { ok: true, razon: null }
        : { ok: false, razon: "Completá el domicilio y el teléfono del cliente." };
    case 6:
      return app.identidadVerificada
        ? { ok: true, razon: null }
        : { ok: false, razon: "Confirmá la verificación de identidad para continuar." };
    case 7:
      if (app.riesgo.estado !== "COMPLETO")
        return { ok: false, razon: "Ejecutá el motor de riesgo y esperá a que finalice la evaluación." };
      if (app.riesgo.resultado !== "GENERAR_OFERTA")
        return {
          ok: false,
          razon: "La evaluación de riesgo no habilita la generación de una oferta.",
        };
      return { ok: true, razon: null };
    default:
      return { ok: true, razon: null };
  }
}

export function OriginacionWizard() {
  const { app, paso, setPaso } = useApplication();
  const total = STEPS_ORIGINACION.length;
  const meta = STEPS_ORIGINACION[Math.min(paso, total) - 1];
  const g = useMemo(() => gate(paso, app), [paso, app]);
  const progreso = Math.round(((paso - 1) / (total - 1)) * 100);

  function continuar() {
    if (!g.ok) return;
    setPaso(Math.min(paso + 1, total));
  }
  function volver() {
    setPaso(Math.max(paso - 1, 1));
  }

  const cliente = app.cliente;
  const ofertaCargada = app.oferta.valorCuota > 0 && app.riesgo.estado === "COMPLETO";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="animate-fade-in">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
              Originación · Solicitud inicial
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">
              {meta.tituloPantalla}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">{meta.descripcion}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold tabular-nums text-ink-900">
              Paso {paso} de {total}
            </p>
            <p className="text-xs text-ink-400">Etapa 1 de 2</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-500"
            style={{ width: `${Math.max(progreso, 4)}%` }}
          />
        </div>
        <div className="mt-4">
          <Stepper steps={STEPS_ORIGINACION} current={paso} onStepClick={(n) => setPaso(n)} />
        </div>
      </div>

      {paso === 8 ? (
        <div className="mt-6">
          <PasoOferta />
        </div>
      ) : (
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div key={meta.id} className="animate-fade-up">
          {paso === 1 && <PasoTipoPersona />}
          {paso === 2 && <PasoIdentificacion />}
          {paso === 3 && <PasoConfiguracion />}
          {paso === 4 && <PasoLaboralIngresos />}
          {paso === 5 && <PasoDatosAdicionales />}
          {paso === 6 && <PasoVerificacionIdentidad />}
          {paso === 7 && <PasoRiesgo />}

          <Card className="mt-6 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="ghost" onClick={volver} disabled={paso === 1} className="sm:w-auto">
                <IconArrowLeft width={16} height={16} />
                Atrás
              </Button>
              <div className="min-w-0 flex-1 sm:mx-4">
                {!g.ok && (
                  <ValidationMessage tipo="info" className="!mt-0 justify-start">
                    {g.razon}
                  </ValidationMessage>
                )}
              </div>
              <Button onClick={continuar} disabled={!g.ok} size="lg" className="sm:w-auto">
                Continuar
                <IconArrowRight width={16} height={16} />
              </Button>
            </div>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <SummaryCard
            title="Resumen de la solicitud"
            icon={<IconUser width={16} height={16} />}
            rows={[
              { label: "Estado", value: <EstadoBadge estado={app.estado} /> },
              {
                label: "Cliente",
                value: cliente ? `${cliente.nombre} ${cliente.apellido}` : "Sin identificar",
                strong: true,
              },
              ...(app.numeroCliente
                ? [{ label: "Cliente Nº", value: `#${app.numeroCliente}` }]
                : []),
              ...(cliente ? [{ label: "DNI", value: formatDNI(cliente.dni) }] : []),
              { label: "Producto", value: nombreOpcion(PRODUCTOS, app.configuracion.productoId) },
              { label: "Organismo", value: nombreOpcion(ORGANISMOS, app.configuracion.organismoId) },
              ...(app.laboral.ingresoNeto > 0
                ? [{ label: "Ingreso neto", value: formatARS(app.laboral.ingresoNeto) }]
                : []),
              ...(app.riesgo.estado === "COMPLETO"
                ? [
                    {
                      label: "Riesgo",
                      value: (
                        <span className="inline-flex items-center gap-1 text-success-700">
                          <IconCheckCircle width={13} height={13} />
                          {app.riesgo.resultado === "GENERAR_OFERTA" ? "Aprobado" : "Revisar"}
                        </span>
                      ),
                    },
                  ]
                : []),
              ...(ofertaCargada
                ? [
                    { label: "Capital solicitado", value: formatARS(app.oferta.montoSolicitado) },
                    {
                      label: `Cuota (${app.oferta.plazo}x)`,
                      value: formatARS(app.oferta.valorCuota),
                    },
                    {
                      label: "Neto a acreditar",
                      value: formatARS(netoAAcreditar(app.oferta)),
                      tone: "success" as const,
                    },
                  ]
                : []),
            ]}
          />
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
              {paso < total ? "Próximo paso" : "Al aceptar la oferta"}
            </p>
            <p className="mt-1.5 text-sm font-medium text-ink-800">
              {paso < total
                ? `${STEPS_ORIGINACION[paso].numero}. ${STEPS_ORIGINACION[paso].titulo}`
                : "Comienza la carga post-oferta"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              {g.razon ??
                (paso < total
                  ? STEPS_ORIGINACION[paso].descripcion
                  : "Se confirman importe, cuotas y valor de cuota, y comienza la etapa 2.")}
            </p>
          </Card>
        </aside>
      </div>
      )}
    </div>
  );
}
