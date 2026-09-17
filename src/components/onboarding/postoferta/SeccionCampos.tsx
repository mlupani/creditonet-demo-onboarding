"use client";

import type { ReactNode } from "react";
import {
  camposDe,
  SECCIONES,
  type PantallaConCampos,
  type SeccionCampo,
} from "@/lib/campos-post-oferta";
import { Card, CardHeader } from "@/components/ui/Card";
import { CampoPostOferta } from "./CampoPostOferta";

// Una tarjeta con los campos de una sección del catálogo.
export function SeccionCampos({
  pantalla,
  seccion,
  icon,
  action,
}: {
  pantalla: PantallaConCampos;
  seccion: SeccionCampo;
  icon: ReactNode;
  action?: ReactNode;
}) {
  const meta = SECCIONES[seccion];
  return (
    <Card>
      <CardHeader title={meta.titulo} description={meta.descripcion} icon={icon} action={action} />
      <div className="grid gap-x-5 gap-y-3 p-5 sm:grid-cols-2 sm:p-6">
        {camposDe(pantalla, seccion).map((campo) => (
          <CampoPostOferta key={campo.id} campo={campo} />
        ))}
      </div>
    </Card>
  );
}
