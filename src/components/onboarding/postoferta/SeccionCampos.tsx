"use client";

import type { ReactNode } from "react";
import {
  camposDe,
  SECCIONES,
  type PantallaConCampos,
  type SeccionCampo,
} from "@/lib/campos-post-oferta";
import { Card, CardHeader } from "@/components/ui/Card";
import { OrigenCampoBadge } from "@/components/ui/OrigenBadge";
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

// Referencia de los tres orígenes del dato (Onboarding §3).
export function LeyendaOrigen() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-ink-200 bg-white px-4 py-3 text-xs text-ink-500">
      <span className="flex items-center gap-1.5">
        <OrigenCampoBadge origen="PRECARGADO" />
        del pedido inicial o de una API; se puede rectificar
      </span>
      <span className="flex items-center gap-1.5">
        <OrigenCampoBadge origen="NO_MODIFICABLE" />
        disparó la oferta
      </span>
      <span>
        <span className="font-semibold text-ink-600">Sin marca:</span> dato a cargar ·{" "}
        <span className="font-semibold text-danger-500">*</span> obligatorio
      </span>
    </div>
  );
}
