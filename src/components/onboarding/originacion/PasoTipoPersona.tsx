"use client";

import { useApplication } from "@/lib/application-context";
import { Banner } from "@/components/ui/Banner";
import { DemoTag } from "@/components/ui/DemoTag";
import { IconCheckCircle, IconIdCard, IconLandmark } from "@/components/icons";

const OPCIONES = [
  {
    id: "FISICA" as const,
    titulo: "Persona física",
    doc: "Se identifica con DNI",
    icon: IconIdCard,
  },
  {
    id: "JURIDICA" as const,
    titulo: "Persona jurídica",
    doc: "Se identifica con CUIT",
    icon: IconLandmark,
  },
];

export function PasoTipoPersona() {
  const { app, setTipoPersona } = useApplication();

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {OPCIONES.map((op) => {
          const seleccionada = app.tipoPersona === op.id;
          return (
            <button
              key={op.id}
              type="button"
              onClick={() => setTipoPersona(op.id)}
              className={`relative rounded-2xl border p-5 text-left transition-all ${
                seleccionada
                  ? "border-brand-600 bg-brand-50/60 shadow-sm ring-1 ring-brand-600"
                  : "border-ink-200 bg-white hover:border-brand-300 hover:bg-brand-50/30"
              }`}
            >
              {seleccionada && (
                <span className="absolute right-4 top-4 text-brand-600">
                  <IconCheckCircle width={18} height={18} />
                </span>
              )}
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                  seleccionada ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-500"
                }`}
              >
                <op.icon width={21} height={21} />
              </span>
              <p className="mt-3 text-base font-bold tracking-tight text-ink-900">{op.titulo}</p>
              <p className="mt-0.5 text-sm text-ink-500">{op.doc}</p>
            </button>
          );
        })}
      </div>

      {app.tipoPersona === "FISICA" && (
        <Banner tone="success" title="Persona física seleccionada">
          En el próximo paso vas a poder consultar el cliente por su DNI.
        </Banner>
      )}

      {app.tipoPersona === "JURIDICA" && (
        <div className="space-y-3">
          <div>
            <label htmlFor="cuit-juridica" className="mb-1.5 block text-sm font-medium text-ink-700">
              CUIT
            </label>
            <input
              id="cuit-juridica"
              type="text"
              placeholder="30-12345678-9"
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-ink-300 bg-ink-50 px-3.5 py-2.5 text-sm text-ink-500 shadow-xs outline-none"
            />
          </div>
          <Banner tone="warning" title="Flujo no disponible en la demo">
            <span className="flex flex-wrap items-center gap-2">
              El flujo de persona jurídica estará disponible en la versión futura de la demo.
              Seleccioná <strong>persona física</strong> para continuar.
              <DemoTag
                variant="config"
                detalle="La demo implementa únicamente el flujo de persona física. La documentación contempla persona jurídica pero su alcance está pendiente."
              />
            </span>
          </Banner>
        </div>
      )}

      <p className="text-xs text-ink-400">
        Para la demo, el flujo principal utiliza persona física.
      </p>
    </div>
  );
}
