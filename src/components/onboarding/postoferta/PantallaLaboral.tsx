"use client";

import { useApplication } from "@/lib/application-context";
import { configEfectiva } from "@/lib/config";
import { erroresPantalla } from "@/lib/campos-post-oferta";
import { Banner } from "@/components/ui/Banner";
import { IconBriefcase, IconClock, IconLandmark, IconMapPin } from "@/components/icons";
import { SeccionCampos } from "./SeccionCampos";

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
      <SeccionCampos
        pantalla="laboral"
        seccion="empleador"
        icon={<IconBriefcase width={18} height={18} />}
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
