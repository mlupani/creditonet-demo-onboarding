"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { SESION, VENDEDORES, nombreOpcion } from "@/lib/config";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { SelectField } from "@/components/ui/SelectField";

function inicialesDe(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

// Vendedor autenticado; se puede asignar el crédito a otro vendedor cuando corresponda.
export function VendedorAsignado() {
  const { app, patchApp } = useApplication();
  const vendedor = VENDEDORES.find((v) => v.id === app.configuracion.vendedorId);
  const [reasignando, setReasignando] = useState(
    app.configuracion.vendedorId !== SESION.vendedorId
  );

  function toggleReasignar(activo: boolean) {
    setReasignando(activo);
    if (!activo)
      patchApp({ configuracion: { ...app.configuracion, vendedorId: SESION.vendedorId } });
  }

  return (
    <Card>
      <div className="px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
              {reasignando
                ? inicialesDe(nombreOpcion(VENDEDORES, app.configuracion.vendedorId))
                : SESION.iniciales}
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink-800">
                Vendedor · {nombreOpcion(VENDEDORES, app.configuracion.vendedorId)}
              </span>
              {vendedor?.detalle && (
                <span className="block text-xs text-ink-500">{vendedor.detalle}</span>
              )}
            </span>
          </span>
          <div className="w-auto shrink-0">
            <Checkbox
              checked={reasignando}
              onChange={toggleReasignar}
              label="Asignar a otro vendedor"
            />
          </div>
        </div>
        {reasignando && (
          <div className="mt-3">
            <SelectField
              id="vendedor-asignado"
              label="Vendedor asignado"
              required
              value={app.configuracion.vendedorId}
              onChange={(v) =>
                patchApp({ configuracion: { ...app.configuracion, vendedorId: v } })
              }
              options={VENDEDORES.map((v) => ({ value: v.id, label: v.nombre }))}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
