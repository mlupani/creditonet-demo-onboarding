"use client";

import type { ReactNode } from "react";
import {
  camposDe,
  SECCIONES,
  type PantallaConCampos,
  type SeccionCampo,
} from "@/lib/campos-post-oferta";
import { useApplication } from "@/lib/application-context";
import { Card, CardHeader } from "@/components/ui/Card";
import { CampoPostOferta } from "./CampoPostOferta";
import { GrupoTelefonoPostOferta } from "./GrupoTelefonoPostOferta";

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
  const { app } = useApplication();
  const meta = SECCIONES[seccion];
  const campos = camposDe(pantalla, seccion, app.postOferta[pantalla]);

  // Agrupa Área + Característica + Número en un único control de una línea
  // para evitar 3 inputs sueltos que ocupan toda la grilla y quedan muy anchos.
  const telefonoPrefijos = new Set<string>();
  for (const c of campos) {
    if (c.tipo === "paisTelefono" && c.id.endsWith(".pais")) {
      const prefijo = c.id.slice(0, -5);
      const tieneCarac = campos.some((x) => x.id === `${prefijo}.caracteristica`);
      const tieneNum = campos.some((x) => x.id === `${prefijo}.numero`);
      if (tieneCarac && tieneNum) telefonoPrefijos.add(prefijo);
    }
  }
  const idsAgrupados = new Set<string>();
  for (const p of telefonoPrefijos) {
    idsAgrupados.add(`${p}.pais`);
    idsAgrupados.add(`${p}.caracteristica`);
    idsAgrupados.add(`${p}.numero`);
  }

  return (
    <Card>
      <CardHeader title={meta.titulo} description={meta.descripcion} icon={icon} action={action} />
      <div className="grid gap-x-5 gap-y-3 p-5 sm:grid-cols-2 sm:p-6">
        {campos.map((campo) => {
          if (campo.tipo === "paisTelefono" && telefonoPrefijos.has(campo.id.slice(0, -5))) {
            const prefijo = campo.id.slice(0, -5);
            return <GrupoTelefonoPostOferta key={prefijo} pantalla={pantalla} prefijo={prefijo} />;
          }
          if (idsAgrupados.has(campo.id)) return null;
          return <CampoPostOferta key={campo.id} campo={campo} />;
        })}
      </div>
    </Card>
  );
}
