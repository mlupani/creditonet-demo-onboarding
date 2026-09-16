"use client";

import { useEffect, useMemo, useState } from "react";
import { useApplication } from "@/lib/application-context";
import { STEPS_ORIGINACION } from "@/lib/mocks";
import { laboralCompleto } from "@/lib/validation";
import { ORGANISMOS, PRODUCTOS, nombreOpcion, productoHabilitadoEnCanal } from "@/lib/config";
import { evaluarInstitucionales, institucionalesBloquean } from "@/lib/reglas-institucionales";
import { formatDNI } from "@/lib/format";
import type { Rechazo } from "@/lib/types";
import { Stepper } from "@/components/ui/Stepper";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
import { IconArrowLeft, IconArrowRight, IconUser } from "@/components/icons";

import { PasoInicio } from "./PasoInicio";
import { PasoIdentificacion } from "./PasoIdentificacion";
import { PasoConfiguracion } from "./PasoConfiguracion";
import { PasoLaboralIngresos } from "./PasoLaboralIngresos";
import { PasoEvaluacion } from "./PasoEvaluacion";
import { PasoOferta } from "./PasoOferta";
import { ResumenSolicitudModal } from "./ResumenSolicitudModal";

type App = ReturnType<typeof useApplication>["app"];

const RAZON_RECHAZO: Record<Rechazo["origen"], string> = {
  INSTITUCIONAL: "Una regla institucional rechazó la solicitud. No se puede construir una oferta.",
  MOTOR: "El motor de riesgo no pasó. No se puede construir una oferta.",
  SIN_LINEA: "No hay línea disponible para este cliente. No se puede construir una oferta.",
  ANALISTA: "La solicitud fue rechazada.",
};

function gate(paso: number, app: App): { ok: boolean; razon: string | null } {
  switch (paso) {
    case 1:
      if (app.tipoPersona === "JURIDICA")
        return {
          ok: false,
          razon:
            "El flujo de persona jurídica (identificación por CUIT y datos societarios) no es navegable en esta demo.",
        };
      if (!app.identificacion.consultado || !app.cliente)
        return { ok: false, razon: "Consultá el DNI o CUIL del cliente para identificarlo." };
      return { ok: true, razon: null };
    case 2:
      return productoHabilitadoEnCanal(app.configuracion.productoId, app.configuracion.canalId)
        ? { ok: true, razon: null }
        : { ok: false, razon: "El producto elegido no se ofrece en el canal de la solicitud." };
    case 3:
      if (institucionalesBloquean(evaluarInstitucionales(app, "IDENTIFICACION")))
        return {
          ok: false,
          razon: "Una regla institucional descarta la solicitud: no se puede continuar.",
        };
      if (!app.identidadVerificada)
        return {
          ok: false,
          razon:
            "Verificá la identidad comparando la foto archivada con la persona presente.",
        };
      return { ok: true, razon: null };
    case 4:
      return laboralCompleto(app.laboral)
        ? { ok: true, razon: null }
        : {
            ok: false,
            razon: "Completá los datos mínimos y adjuntá el recibo para poder solicitar.",
          };
    case 5:
      if (app.riesgo.estado !== "COMPLETO")
        return {
          ok: false,
          razon: "Presioná Solicitar y esperá el resultado de la evaluación.",
        };
      if (app.rechazo) return { ok: false, razon: RAZON_RECHAZO[app.rechazo.origen] };
      return { ok: true, razon: null };
    default:
      return { ok: true, razon: null };
  }
}

export function OriginacionWizard() {
  const { app, paso, pasoMaximo, setPaso } = useApplication();
  const total = STEPS_ORIGINACION.length;
  const pasoActual = Math.min(Math.max(paso, 1), total);
  const meta = STEPS_ORIGINACION[pasoActual - 1];
  const g = useMemo(() => gate(pasoActual, app), [pasoActual, app]);
  const avance = Math.max(pasoMaximo, pasoActual);
  const progreso = Math.round(((avance - 1) / (total - 1)) * 100);
  const [resumenAbierto, setResumenAbierto] = useState(false);

  // El cambio de paso no navega: sin esto la página queda scrolleada donde estaba el paso
  // anterior (ej. al pasar de Evaluación, que es larga, a Oferta).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pasoActual]);

  function continuar() {
    if (!g.ok) return;
    // Antes de mostrar la oferta, se repasa el resumen de la solicitud (checkpoint).
    if (pasoActual === total - 1) {
      setResumenAbierto(true);
      return;
    }
    setPaso(Math.min(pasoActual + 1, total));
  }
  function volver() {
    setPaso(Math.max(pasoActual - 1, 1));
  }

  // Volver atrás no destruye nada: si más adelante ya hay datos, se puede retomar el flujo
  // donde estaba sin recorrer los pasos intermedios de nuevo.
  const puedeRetomar = pasoMaximo > pasoActual;

  // Contexto de la solicitud que se arrastra en el encabezado de todos los pasos.
  const cliente = app.cliente;
  const contexto = [
    cliente ? `${cliente.nombre} ${cliente.apellido}` : null,
    cliente ? `DNI ${formatDNI(cliente.dni)}` : null,
    app.numeroCliente ? `ID de Cliente ${app.numeroCliente}` : null,
    nombreOpcion(PRODUCTOS, app.configuracion.productoId),
    nombreOpcion(ORGANISMOS, app.configuracion.organismoId),
  ].filter((v): v is string => Boolean(v));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="animate-fade-in">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
              Solicitar crédito · Originación
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">
              {meta.tituloPantalla}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">
              {meta.descripcion}
            </p>
            {contexto.length > 0 && (
              <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800">
                <IconUser width={16} height={16} className="shrink-0 text-brand-600" />
                <span>{contexto.join(" · ")}</span>
              </div>
            )}
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
          <Stepper
            steps={STEPS_ORIGINACION}
            current={pasoActual}
            maxAlcanzado={pasoMaximo}
            onStepClick={(n) => setPaso(n)}
          />
        </div>
        {puedeRetomar && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50/60 px-3.5 py-2">
            <p className="text-xs text-brand-700">
              Estás revisando un paso anterior. Los pasos siguientes conservan sus datos.
            </p>
            <Button size="sm" variant="ghost" onClick={() => setPaso(pasoMaximo)}>
              Volver al paso {pasoMaximo}: {STEPS_ORIGINACION[pasoMaximo - 1].titulo}
              <IconArrowRight width={14} height={14} />
            </Button>
          </div>
        )}
      </div>

      {pasoActual === total ? (
        <div className="mt-6">
          <PasoOferta />
        </div>
      ) : (
        <div key={meta.id} className="mt-6 animate-fade-up">
          {pasoActual === 1 && <PasoInicio />}
          {pasoActual === 2 && <PasoConfiguracion />}
          {pasoActual === 3 && <PasoIdentificacion />}
          {pasoActual === 4 && <PasoLaboralIngresos />}
          {pasoActual === 5 && <PasoEvaluacion />}

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
                {!g.ok ? (
                  <ValidationMessage tipo="info" className="!mt-0 justify-start">
                    {g.razon}
                  </ValidationMessage>
                ) : (
                  <p className="text-xs text-ink-500">
                    <span className="font-semibold text-ink-700">
                      Próximo: {STEPS_ORIGINACION[pasoActual].numero}.{" "}
                      {STEPS_ORIGINACION[pasoActual].titulo}
                    </span>{" "}
                    — {STEPS_ORIGINACION[pasoActual].descripcion}
                  </p>
                )}
              </div>
              <Button onClick={continuar} disabled={!g.ok} size="lg" className="sm:w-auto">
                Continuar
                <IconArrowRight width={16} height={16} />
              </Button>
            </div>
          </Card>
        </div>
      )}

      <ResumenSolicitudModal
        open={resumenAbierto}
        onClose={() => setResumenAbierto(false)}
        onContinuar={() => {
          setResumenAbierto(false);
          setPaso(Math.min(pasoActual + 1, total));
        }}
      />
    </div>
  );
}
