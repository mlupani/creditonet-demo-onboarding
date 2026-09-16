"use client";

import { useApplication } from "@/lib/application-context";
import { CANALES, ORGANISMOS, PRODUCTOS, nombreOpcion, productoHabilitadoEnCanal } from "@/lib/config";
import { Card, CardHeader } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
// import { VendedorAsignado } from "./VendedorAsignado"; // Sacado de acá a pedido; falta decidir dónde va.
import { IconBuilding } from "@/components/icons";

// Selección comercial (Guía §3.2); la jerarquía de herencia es Producto → Organismo → Plan
// (§2), aunque se eligen en orden Organismo → Producto.
export function PasoConfiguracion() {
  const { app, patchApp } = useApplication();
  const cfg = app.configuracion;
  const setConfig = (patch: Partial<typeof cfg>) =>
    patchApp({ configuracion: { ...cfg, ...patch } });
  // El canal elegido al inicio limita los productos disponibles (Producto §3).
  const canal = nombreOpcion(CANALES, cfg.canalId);
  const noDisponibles = PRODUCTOS.filter((p) => !productoHabilitadoEnCanal(p.id, cfg.canalId));

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Selección comercial"
          description="El producto y el organismo definen las reglas, el plan de cuotas y las pantallas post-oferta."
          icon={<IconBuilding width={18} height={18} />}
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <SelectField
            id="organismo"
            label="Organismo"
            required
            value={cfg.organismoId}
            onChange={(v) => setConfig({ organismoId: v })}
            options={ORGANISMOS.map((o) => ({ value: o.id, label: o.nombre }))}
            hint="Empleador o ente pagador. Sólo parametriza excepciones."
          />
          <SelectField
            id="producto"
            label="Producto"
            required
            value={cfg.productoId}
            onChange={(v) => setConfig({ productoId: v })}
            options={PRODUCTOS.map((p) => {
              const habilitado = productoHabilitadoEnCanal(p.id, cfg.canalId);
              return {
                value: p.id,
                label: habilitado ? p.nombre : `${p.nombre} — no disponible en ${canal}`,
                disabled: !habilitado,
              };
            })}
            hint={
              noDisponibles.length > 0
                ? `Canal ${canal}: ${noDisponibles.map((p) => p.nombre).join(", ")} no se ofrece por este canal.`
                : `Canal ${canal}: todos los productos disponibles.`
            }
          />
        </div>
      </Card>

      {/* <VendedorAsignado /> */}
    </div>
  );
}
