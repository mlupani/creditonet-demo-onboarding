"use client";

import { useApplication } from "@/lib/application-context";
import { ORGANISMOS, nombreOpcion, productosDelOrganismo } from "@/lib/config";
import { Card, CardHeader } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { VendedorAsignado } from "./VendedorAsignado";
import { IconBuilding } from "@/components/icons";

// Selección comercial (Guía §3.2); la jerarquía de herencia es Producto → Organismo → Plan
// (§2), aunque se eligen en orden Organismo → Producto. Cada organismo ofrece su propio
// subconjunto de productos (Producto §3 bis).
export function PasoConfiguracion() {
  const { app, patchApp } = useApplication();
  const cfg = app.configuracion;
  const setConfig = (patch: Partial<typeof cfg>) =>
    patchApp({ configuracion: { ...cfg, ...patch } });
  const organismo = nombreOpcion(ORGANISMOS, cfg.organismoId);
  const disponibles = productosDelOrganismo(cfg.organismoId);

  // Cambiar de organismo puede dejar afuera al producto elegido: si pasa, se toma el
  // primero que ese organismo ofrece.
  function elegirOrganismo(organismoId: string) {
    const productos = productosDelOrganismo(organismoId);
    const sigueDisponible = productos.some((p) => p.id === cfg.productoId);
    setConfig({
      organismoId,
      productoId: sigueDisponible ? cfg.productoId : (productos[0]?.id ?? cfg.productoId),
    });
  }

  return (
    <div className="space-y-5">
      <VendedorAsignado />

      <Card>
        <CardHeader
          title="Selección comercial"
          description="El producto y el organismo definen las reglas, el plan de cuotas y las pantallas post-oferta."
          icon={<IconBuilding width={18} height={18} />}
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <SelectField
            id="producto"
            label="Producto"
            required
            value={cfg.productoId}
            onChange={(v) => setConfig({ productoId: v })}
            options={disponibles.map((p) => ({ value: p.id, label: p.nombre }))}
            hint={`Productos que ofrece ${organismo}.`}
          />
          <SelectField
            id="organismo"
            label="Organismo"
            required
            value={cfg.organismoId}
            onChange={elegirOrganismo}
            options={ORGANISMOS.filter((o) => o.estado === "ACTIVO").map((o) => ({
              value: o.id,
              label: o.nombre,
            }))}
            hint="Empleador o ente pagador. Define qué productos ofrece y parametriza excepciones."
          />
        </div>
      </Card>
    </div>
  );
}
