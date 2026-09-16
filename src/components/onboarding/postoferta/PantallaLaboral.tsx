"use client";

import { useApplication } from "@/lib/application-context";
import { configEfectiva } from "@/lib/config";
import { erroresPantalla } from "@/lib/campos-post-oferta";
import { Banner } from "@/components/ui/Banner";
import { DemoTag } from "@/components/ui/DemoTag";
import { IconBriefcase, IconClock, IconLandmark, IconMapPin } from "@/components/icons";
import { LeyendaOrigen, SeccionCampos } from "./SeccionCampos";

// Pantalla 2 · Datos laborales (Onboarding §5): empleo actual. La fecha de ingreso y la
// situación laboral vienen del pedido inicial y no se modifican porque dispararon la oferta.
export function PantallaLaboral() {
  const { app } = useApplication();
  const errores = erroresPantalla(
    app,
    "laboral",
    configEfectiva(app.configuracion).camposObligatorios
  );

  return (
    <div className="space-y-5">
      <LeyendaOrigen />
      <SeccionCampos
        pantalla="laboral"
        seccion="empleador"
        icon={<IconBriefcase width={18} height={18} />}
        action={
          <DemoTag
            variant="config"
            detalle="La obligatoriedad de cada campo se configura por producto, con excepciones del organismo. Ej.: la repartición es obligatoria para Policía de la Provincia."
          />
        }
      />
      <SeccionCampos
        pantalla="laboral"
        seccion="domicilioLaboral"
        icon={<IconMapPin width={18} height={18} />}
      />
      <SeccionCampos
        pantalla="laboral"
        seccion="telefonoLaboral"
        icon={<IconClock width={18} height={18} />}
      />
      <SeccionCampos
        pantalla="laboral"
        seccion="acreditacion"
        icon={<IconLandmark width={18} height={18} />}
      />
      {errores.length === 0 ? (
        <Banner tone="success">Datos laborales completos.</Banner>
      ) : (
        <Banner tone="info">
          Falta completar o corregir: {errores.map((e) => e.campo.label).join(", ")}.
        </Banner>
      )}
    </div>
  );
}
