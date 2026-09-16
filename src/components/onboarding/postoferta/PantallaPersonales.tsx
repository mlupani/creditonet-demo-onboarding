"use client";

import { useApplication } from "@/lib/application-context";
import { configEfectiva } from "@/lib/config";
import { erroresPantalla } from "@/lib/campos-post-oferta";
import { Banner } from "@/components/ui/Banner";
import { DemoTag } from "@/components/ui/DemoTag";
import { IconIdCard, IconMapPin, IconSend } from "@/components/icons";
import { LeyendaOrigen, SeccionCampos } from "./SeccionCampos";

// Pantalla 1 · Datos personales (Onboarding §4): identificación, domicilio y contacto.
export function PantallaPersonales() {
  const { app } = useApplication();
  const errores = erroresPantalla(
    app,
    "personales",
    configEfectiva(app.configuracion).camposObligatorios
  );

  return (
    <div className="space-y-5">
      <LeyendaOrigen />
      <SeccionCampos
        pantalla="personales"
        seccion="identificacion"
        icon={<IconIdCard width={18} height={18} />}
      />
      <SeccionCampos
        pantalla="personales"
        seccion="domicilio"
        icon={<IconMapPin width={18} height={18} />}
        action={
          <DemoTag
            variant="config"
            detalle="Provincias, localidades, tipo de vivienda y estado civil salen del Módulo Parámetros."
          />
        }
      />
      <SeccionCampos
        pantalla="personales"
        seccion="contacto"
        icon={<IconSend width={18} height={18} />}
      />
      {errores.length === 0 ? (
        <Banner tone="success">Datos personales completos.</Banner>
      ) : (
        <Banner tone="info">
          Falta completar o corregir: {errores.map((e) => e.campo.label).join(", ")}.
        </Banner>
      )}
    </div>
  );
}
