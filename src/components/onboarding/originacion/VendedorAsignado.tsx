"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { SESION, VENDEDORES, nombreOpcion } from "@/lib/config";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { SelectField } from "@/components/ui/SelectField";
import { IconLock, IconUsers } from "@/components/icons";

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
      <CardHeader
        title="Vendedor"
        description="Se toma de la sesión; se puede asignar el crédito a otro vendedor."
        icon={<IconUsers width={18} height={18} />}
      />
      <div className="px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-2.5">
          <span className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
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
          {!reasignando && (
            <span className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
              <IconLock width={11} height={11} />
              Tomado de la sesión
            </span>
          )}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-500">
          Por defecto la solicitud guarda el ID del vendedor autenticado para trazabilidad,
          bandejas y devoluciones del analista. Se puede asignar a otro vendedor para el crédito
          cuando corresponda.
        </p>
        <div className="mt-3">
          <Checkbox
            checked={reasignando}
            onChange={toggleReasignar}
            label="Asignar a otro vendedor"
            description="El crédito queda a nombre del vendedor elegido en vez del de la sesión."
          />
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
