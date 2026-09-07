"use client";

import { useApplication } from "@/lib/application-context";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DemoTag } from "@/components/ui/DemoTag";
import {
  IconCheck,
  IconCheckCircle,
  IconScanFace,
  IconUser,
} from "@/components/icons";

function Retrato({ iniciales, etiqueta, live }: { iniciales: string; etiqueta: string; live?: boolean }) {
  return (
    <div className="flex-1">
      <div
        className={`relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl border ${
          live ? "border-brand-200 bg-brand-50" : "border-ink-200 bg-ink-100"
        }`}
      >
        <span
          className={`flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold ${
            live ? "bg-brand-200 text-brand-700" : "bg-ink-300 text-ink-600"
          }`}
        >
          {iniciales}
        </span>
        {live && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-danger-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            En vivo
          </span>
        )}
      </div>
      <p className="mt-1.5 text-center text-xs font-medium text-ink-500">{etiqueta}</p>
    </div>
  );
}

export function PasoVerificacionIdentidad() {
  const { app, verificarIdentidad } = useApplication();
  if (!app.cliente) return null;
  const iniciales = `${app.cliente.nombre.charAt(0)}${app.cliente.apellido.charAt(0)}`;
  const verificada = app.identidadVerificada;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Verificación de identidad"
          description="Cliente existente · cotejo con la imagen archivada."
          icon={<IconScanFace width={18} height={18} />}
          action={
            <DemoTag
              variant="regla"
              detalle="La política de captura biométrica (liveness para cliente nuevo, cotejo para cliente existente) está pendiente de definición. Acá se simula."
            />
          }
        />
        <div className="p-5 sm:p-6">
          <div className="flex gap-4">
            <Retrato iniciales={iniciales} etiqueta="Imagen archivada · 12/03/2022" />
            <Retrato iniciales={iniciales} etiqueta="Persona presente (simulado)" live />
          </div>

          <p className="mt-4 text-sm leading-relaxed text-ink-600">
            Compará la imagen archivada con la persona presente y validá su identidad. Para un
            cliente nuevo, este paso realizaría una captura con prueba de vida.
          </p>

          {verificada ? (
            <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-success-200 bg-success-50 px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success-600 text-white">
                <IconCheck width={16} height={16} strokeWidth={2.6} />
              </span>
              <div>
                <p className="text-sm font-bold text-success-700">Identidad verificada</p>
                <p className="text-xs text-success-700/80">
                  El operador confirmó la coincidencia. Podés continuar con la evaluación.
                </p>
              </div>
            </div>
          ) : (
            <Button className="mt-4" size="lg" onClick={verificarIdentidad}>
              <IconCheckCircle width={17} height={17} />
              Identidad verificada
            </Button>
          )}
        </div>
      </Card>

      <Banner tone="info">
        <span className="flex items-center gap-2">
          <IconUser width={15} height={15} className="shrink-0 text-brand-600" />
          Cliente nuevo → captura y prueba de vida. Cliente existente → imagen archivada y cotejo
          visual. En esta demo no se ejecuta biometría real.
        </span>
      </Banner>
    </div>
  );
}
