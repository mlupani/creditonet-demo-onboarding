"use client";

import { useApplication } from "@/lib/application-context";
import { ESTADOS_CIVILES, PROVINCIAS } from "@/lib/validation";
import { Banner } from "@/components/ui/Banner";
import { Card, CardHeader } from "@/components/ui/Card";
import { DemoTag } from "@/components/ui/DemoTag";
import { CampoCliente } from "./CampoCliente";
import { IconInfo, IconUser } from "@/components/icons";

export function PasoDatosAdicionales() {
  const { app } = useApplication();
  if (!app.cliente) return null;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Datos adicionales del cliente"
          description="Información complementaria para el legajo y el análisis."
          icon={<IconUser width={18} height={18} />}
          action={
            <DemoTag
              variant="regla"
              detalle="El comportamiento cuando la fuente consultada no devuelve un dato es una decisión pendiente. Para un cliente existente, estos datos se toman de la base interna."
            />
          }
        />
        <div className="grid gap-x-5 gap-y-1 p-5 sm:grid-cols-2 sm:p-6">
          <CampoCliente
            id="a-estado-civil"
            label="Estado civil"
            campo="estadoCivil"
            as="select"
            options={ESTADOS_CIVILES}
          />
          <CampoCliente id="a-nacionalidad" label="Nacionalidad" campo="nacionalidad" />
          <CampoCliente id="a-domicilio" label="Domicilio" campo="domicilio" />
          <CampoCliente id="a-localidad" label="Localidad" campo="localidad" />
          <CampoCliente
            id="a-provincia"
            label="Provincia"
            campo="provincia"
            as="select"
            options={PROVINCIAS}
          />
          <CampoCliente id="a-telefono" label="Teléfono de contacto" campo="telefono" />
        </div>
      </Card>

      <Banner tone="info">
        <span className="flex items-center gap-2">
          <IconInfo width={15} height={15} className="shrink-0 text-brand-600" />
          Los datos marcados como <strong>Base interna</strong> provienen del historial del
          cliente. Revisalos y editá lo que haga falta antes de continuar.
        </span>
      </Banner>
    </div>
  );
}
