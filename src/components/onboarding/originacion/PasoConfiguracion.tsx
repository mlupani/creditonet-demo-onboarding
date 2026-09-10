"use client";

import { useApplication } from "@/lib/application-context";
import {
  CANALES,
  ORGANISMOS,
  PRODUCTOS,
  VENDEDORES,
  configEfectiva,
  nombreOpcion,
  resumenConfig,
} from "@/lib/config";
import { formatARS } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { DemoTag } from "@/components/ui/DemoTag";
import {
  IconArrowRight,
  IconBuilding,
  IconCalendar,
  IconLock,
  IconUser,
  IconWallet,
} from "@/components/icons";

function CampoParametrizado({
  label,
  valor,
  detalle,
  icon,
  origen,
}: {
  label: string;
  valor: string;
  detalle?: string;
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
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink-700">{valor}</span>
          {detalle && <span className="block text-xs text-ink-500">{detalle}</span>}
        </span>
      </div>
    </div>
  );
}

// Selección comercial (Guía §3.2) con la jerarquía Producto → Organismo → Plan (§2).
export function PasoConfiguracion() {
  const { app, patchApp } = useApplication();
  const cfg = app.configuracion;
  const setConfig = (patch: Partial<typeof cfg>) =>
    patchApp({ configuracion: { ...cfg, ...patch } });
  const efectiva = configEfectiva(cfg);
  const resumen = resumenConfig(cfg);
  const plan = efectiva.plan;

  return (
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
          options={PRODUCTOS.map((p) => ({ value: p.id, label: p.nombre }))}
          hint="Define reglas globales y pantallas post-oferta."
        />
        <SelectField
          id="organismo"
          label="Organismo"
          required
          value={cfg.organismoId}
          onChange={(v) => setConfig({ organismoId: v })}
          options={ORGANISMOS.map((o) => ({ value: o.id, label: o.nombre }))}
          hint="Empleador o ente pagador. Sólo parametriza excepciones."
        />
        <div className="sm:col-span-2">
          <CampoParametrizado
            label="Plan de cuotas / Línea"
            valor={plan.nombre}
            detalle={`Sistema ${plan.sistema.toLowerCase()} · ${plan.plazos.join(", ")} cuotas · hasta ${formatARS(plan.montoMaximo)}`}
            icon={<IconCalendar width={16} height={16} />}
            origen="Según organismo"
          />
        </div>
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

      <div className="border-t border-ink-100 px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Resolución de la configuración
          </p>
          <DemoTag
            variant="config"
            detalle="Cada propiedad se toma primero del organismo si tiene un valor definido; si es nula, se hereda del producto. Ej.: deshabilitar Referencias personales sólo para el organismo Policía."
          />
        </div>
        <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-stretch">
          {[
            { titulo: "Producto", valor: resumen.producto, detalle: "Reglas globales" },
            { titulo: "Organismo", valor: resumen.organismo, detalle: resumen.herencia },
            { titulo: "Plan de cuotas", valor: plan.nombre, detalle: "Condiciones financieras" },
          ].map((nivel, i, arr) => (
            <div key={nivel.titulo} className="flex flex-1 items-center gap-2">
              <div className="flex-1 rounded-lg border border-ink-200 bg-ink-25 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
                  {nivel.titulo}
                </p>
                <p className="text-sm font-semibold text-ink-900">{nivel.valor}</p>
                <p className="text-xs text-ink-500">{nivel.detalle}</p>
              </div>
              {i < arr.length - 1 && (
                <IconArrowRight
                  width={14}
                  height={14}
                  className="hidden shrink-0 text-ink-300 sm:block"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
