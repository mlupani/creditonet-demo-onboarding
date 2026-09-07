"use client";

import { useApplication } from "@/lib/application-context";
import { CANALES, ORGANISMOS, PRODUCTOS, VENDEDORES, nombreOpcion } from "@/lib/config";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { IconBuilding, IconLock, IconUser, IconWallet } from "@/components/icons";

function CampoParametrizado({
  label,
  valor,
  icon,
  origen,
}: {
  label: string;
  valor: string;
  icon: React.ReactNode;
  origen: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink-700">{label}</span>
        <span className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
          <IconLock width={11} height={11} />
          {origen}
        </span>
      </div>
      <div className="flex items-center gap-2.5 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5">
        <span className="text-ink-400">{icon}</span>
        <span className="text-sm font-semibold text-ink-700">{valor}</span>
      </div>
    </div>
  );
}

export function PasoConfiguracion() {
  const { app, patchApp } = useApplication();
  const cfg = app.configuracion;
  const setConfig = (patch: Partial<typeof cfg>) =>
    patchApp({ configuracion: { ...cfg, ...patch } });

  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="producto"
            label="Producto"
            required
            value={cfg.productoId}
            onChange={(v) => setConfig({ productoId: v })}
            options={PRODUCTOS.map((p) => ({ value: p.id, label: p.nombre }))}
            hint="Define reglas de riesgo, planes de cuotas y pantallas post-oferta."
          />
          <SelectField
            id="organismo"
            label="Organismo"
            required
            value={cfg.organismoId}
            onChange={(v) => setConfig({ organismoId: v })}
            options={ORGANISMOS.map((o) => ({ value: o.id, label: o.nombre }))}
            hint="El organismo puede aplicar excepciones sobre las reglas del producto."
          />
          <CampoParametrizado
            label="Canal de venta"
            valor={nombreOpcion(CANALES, cfg.canalId)}
            icon={<IconWallet width={16} height={16} />}
            origen="Parámetros"
          />
          <CampoParametrizado
            label="Vendedor"
            valor={nombreOpcion(VENDEDORES, cfg.vendedorId)}
            icon={<IconUser width={16} height={16} />}
            origen="Sesión"
          />
        </div>
      </Card>

      <Banner tone="info">
        <span className="flex items-center gap-2">
          <IconBuilding width={15} height={15} className="shrink-0 text-brand-600" />
          Las opciones disponibles dependen de la configuración de CreditoNet. En el sistema real,
          el ABM de productos, organismos, canales y planes vive en el módulo Parámetros.
        </span>
      </Banner>
    </div>
  );
}
