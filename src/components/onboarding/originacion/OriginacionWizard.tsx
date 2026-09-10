"use client";

import { useMemo } from "react";
import { useApplication } from "@/lib/application-context";
import { STEPS_ORIGINACION } from "@/lib/mocks";
import { laboralCompleto } from "@/lib/validation";
import { getPlan, nombreOpcion, ORGANISMOS, PRODUCTOS } from "@/lib/config";
import { formatARS, formatDNI } from "@/lib/format";
import { RESULTADO_LABEL } from "@/lib/credit";
import { Stepper } from "@/components/ui/Stepper";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
import { IconArrowLeft, IconArrowRight, IconUser } from "@/components/icons";

import { PasoIdentificacion } from "./PasoIdentificacion";
import { PasoConfiguracion } from "./PasoConfiguracion";
import { PasoLaboralIngresos } from "./PasoLaboralIngresos";
import { PasoRiesgo } from "./PasoRiesgo";
import { PasoOferta } from "./PasoOferta";

type App = ReturnType<typeof useApplication>["app"];

function gate(paso: number, app: App): { ok: boolean; razon: string | null } {
  switch (paso) {
    case 1:
      if (!app.identificacion.consultado || !app.cliente)
        return { ok: false, razon: "Consultá el DNI o CUIL del cliente para identificarlo." };
      if (!app.identidadVerificada)
        return {
          ok: false,
          razon: "Verificá la identidad comparando la foto archivada con la persona presente.",
        };
      return { ok: true, razon: null };
    case 2:
      return laboralCompleto(app.laboral)
        ? { ok: true, razon: null }
        : {
            ok: false,
            razon: "Completá los datos laborales y financieros mínimos para poder solicitar.",
          };
    case 3:
      if (app.riesgo.estado !== "COMPLETO")
        return {
          ok: false,
          razon: "Presioná Solicitar y esperá el resultado del motor de riesgo.",
        };
      if (app.riesgo.resultado === "RECHAZADO")
        return {
          ok: false,
          razon: "El motor de riesgo rechazó la solicitud. No se puede generar una oferta.",
        };
      if (app.riesgo.resultado === "VERIFICACION_MANUAL")
        return { ok: false, razon: "La solicitud requiere verificación manual del analista." };
      return { ok: true, razon: null };
    default:
      return { ok: true, razon: null };
  }
}

export function OriginacionWizard() {
  const { app, paso, setPaso } = useApplication();
  const total = STEPS_ORIGINACION.length;
  const pasoActual = Math.min(Math.max(paso, 1), total);
  const meta = STEPS_ORIGINACION[pasoActual - 1];
  const g = useMemo(() => gate(pasoActual, app), [pasoActual, app]);
  const progreso = Math.round(((pasoActual - 1) / (total - 1)) * 100);

  function continuar() {
    if (!g.ok) return;
    setPaso(Math.min(pasoActual + 1, total));
  }
  function volver() {
    setPaso(Math.max(pasoActual - 1, 1));
  }

  const cliente = app.cliente;
  const riesgoCompleto = app.riesgo.estado === "COMPLETO" && app.riesgo.resultado;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="animate-fade-in">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
              Solicitar crédito · Pre-oferta
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">
              {meta.tituloPantalla}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">{meta.descripcion}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold tabular-nums text-ink-900">
              Paso {pasoActual} de {total}
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
          <Stepper steps={STEPS_ORIGINACION} current={pasoActual} onStepClick={(n) => setPaso(n)} />
        </div>
      </div>

      {pasoActual === total ? (
        <div className="mt-6">
          <PasoOferta />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div key={meta.id} className="animate-fade-up">
            {pasoActual === 1 && <PasoIdentificacion />}
            {pasoActual === 2 && (
              <div className="space-y-5">
                <PasoConfiguracion />
                <PasoLaboralIngresos />
              </div>
            )}
            {pasoActual === 3 && <PasoRiesgo />}

            <Card className="mt-6 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  variant="ghost"
                  onClick={volver}
                  disabled={pasoActual === 1}
                  className="sm:w-auto"
                >
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
                  ? [{ label: "ID de Cliente", value: app.numeroCliente }]
                  : []),
                ...(cliente ? [{ label: "DNI", value: formatDNI(cliente.dni) }] : []),
                ...(app.numeroCredito
                  ? [{ label: "ID de Crédito", value: app.numeroCredito, tone: "brand" as const }]
                  : []),
                { label: "Producto", value: nombreOpcion(PRODUCTOS, app.configuracion.productoId) },
                {
                  label: "Organismo",
                  value: nombreOpcion(ORGANISMOS, app.configuracion.organismoId),
                },
                { label: "Plan de cuotas", value: getPlan(app.configuracion.organismoId).nombre },
                ...(app.laboral.ingresoNeto > 0
                  ? [{ label: "Ingreso neto", value: formatARS(app.laboral.ingresoNeto) }]
                  : []),
                ...(riesgoCompleto
                  ? [
                      {
                        label: "Motor de riesgo",
                        value: RESULTADO_LABEL[app.riesgo.resultado!],
                        tone:
                          app.riesgo.resultado === "APROBADO"
                            ? ("success" as const)
                            : ("danger" as const),
                      },
                    ]
                  : []),
                ...(riesgoCompleto && app.riesgo.resultado === "APROBADO"
                  ? [
                      {
                        label: "Capital máximo",
                        value: formatARS(app.oferta.capitalMaximoActual),
                        strong: true,
                      },
                    ]
                  : []),
              ]}
            />
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                Próximo paso
              </p>
              <p className="mt-1.5 text-sm font-medium text-ink-800">
                {`${STEPS_ORIGINACION[pasoActual].numero}. ${STEPS_ORIGINACION[pasoActual].titulo}`}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                {g.razon ?? STEPS_ORIGINACION[pasoActual].descripcion}
              </p>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
