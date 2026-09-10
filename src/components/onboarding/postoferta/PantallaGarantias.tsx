"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { configEfectiva } from "@/lib/config";
import { validarGarante } from "@/lib/validation";
import type { Garante } from "@/lib/types";
import { Banner } from "@/components/ui/Banner";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { DocumentChecklist } from "@/components/DocumentChecklist";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DemoTag } from "@/components/ui/DemoTag";
import { IconShieldCheck } from "@/components/icons";

export function PantallaGarantias() {
  const { app, patchGarante, subirDocumento } = useApplication();
  const config = configEfectiva(app.configuracion);
  const g = app.postOferta.garante;
  const err = validarGarante(g);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const set =
    (campo: keyof Garante) =>
    (valor: string) =>
      patchGarante({ [campo]: valor });

  function subir(id: string) {
    setSubiendo(id);
    window.setTimeout(() => {
      subirDocumento("garante", id);
      setSubiendo(null);
    }, 900);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Datos del garante"
          description="Información y documentación de la persona que garantiza el crédito."
          icon={<IconShieldCheck width={18} height={18} />}
          action={
            config.requiereGarante ? (
              <StatusBadge tone="danger">Requerida</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">Opcional según producto</StatusBadge>
            )
          }
        />
        <div className="grid gap-x-5 gap-y-1 p-5 sm:grid-cols-2 sm:p-6">
          <FormField
            id="gar-nombre"
            label="Nombre completo"
            required
            value={g.nombre}
            onChange={set("nombre")}
            error={err.nombre}
          />
          <FormField
            id="gar-dni"
            label="DNI"
            required
            inputMode="numeric"
            value={g.dni}
            onChange={(v) => patchGarante({ dni: v.replace(/\D/g, "").slice(0, 8) })}
            error={err.dni}
          />
          <FormField
            id="gar-tel"
            label="Teléfono"
            required
            inputMode="tel"
            value={g.telefono}
            onChange={set("telefono")}
            error={err.telefono}
          />
          <FormField
            id="gar-lugar"
            label="Lugar de trabajo"
            required
            value={g.lugarTrabajo}
            onChange={set("lugarTrabajo")}
            error={err.lugarTrabajo}
          />
          <FormField
            id="gar-laboral"
            label="Datos laborales"
            required
            value={g.datosLaborales}
            onChange={set("datosLaborales")}
            error={err.datosLaborales}
            className="sm:col-span-2"
          />
          <MoneyInput
            id="gar-ingresos"
            label="Ingresos"
            required
            value={g.ingresos}
            onChange={(v) => patchGarante({ ingresos: v })}
            error={err.ingresos}
          />
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-ink-900">Documentación del garante</h3>
        <p className="mt-0.5 mb-4 text-xs text-ink-500">
          Recibo de sueldo, DNI y otros documentos que requiera el producto.
        </p>
        <DocumentChecklist docs={app.postOferta.garanteDocs} uploadingId={subiendo} onUpload={subir} />
      </Card>

      <Banner tone={config.requiereGarante ? "info" : "success"}>
        <span className="flex flex-wrap items-center gap-2">
          {config.requiereGarante
            ? "Para este producto el garante es obligatorio. En otros productos esta pantalla puede ser opcional o no mostrarse."
            : "Este producto no exige garante."}
          <DemoTag
            variant="config"
            detalle="Si la pantalla de garantías es obligatoria depende del producto. En la demo se configuró como requerida para mostrar el flujo completo."
          />
        </span>
      </Banner>
    </div>
  );
}
