"use client";

import { useApplication } from "@/lib/application-context";
import {
  CANALES,
  ORGANISMOS,
  PRODUCTOS,
  configEfectiva,
  nombreOpcion,
  productoHabilitadoEnCanal,
  resumenConfig,
} from "@/lib/config";
import { seleccionarMotor } from "@/lib/motores";
import { getCampo } from "@/lib/campos-post-oferta";
import { getTipoDocumento, nombreProveedor } from "@/lib/parametros";
import { formatARS } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { DemoTag } from "@/components/ui/DemoTag";
import {
  IconArrowRight,
  IconBuilding,
  IconCalendar,
  IconLock,
  IconShieldCheck,
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
  const { motor, criterio } = seleccionarMotor(cfg, app.laboral.condicionLaboral);
  // El canal elegido al inicio limita los productos disponibles (Producto §3).
  const canal = nombreOpcion(CANALES, cfg.canalId);
  const noDisponibles = PRODUCTOS.filter((p) => !productoHabilitadoEnCanal(p.id, cfg.canalId));

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
        <SelectField
          id="organismo"
          label="Organismo"
          required
          value={cfg.organismoId}
          onChange={(v) => setConfig({ organismoId: v })}
          options={ORGANISMOS.map((o) => ({ value: o.id, label: o.nombre }))}
          hint="Empleador o ente pagador. Sólo parametriza excepciones."
        />
        <CampoParametrizado
          label="Motor de riesgo que corresponde"
          valor={motor.nombre}
          detalle={criterio}
          icon={<IconShieldCheck width={16} height={16} />}
          origen="Se ejecuta al solicitar"
        />
        <CampoParametrizado
          label="Plan de cuotas / Línea"
          valor={plan.nombre}
          detalle={`Sistema ${plan.sistema.toLowerCase()} · ${plan.plazos.join(", ")} cuotas · hasta ${formatARS(plan.montoMaximo)}`}
          icon={<IconCalendar width={16} height={16} />}
          origen="Según organismo"
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

        {efectiva.cantidadExcepciones > 0 && (
          <div className="mt-3 rounded-lg border border-warning-200 bg-warning-50/60 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-warning-700">
              Excepciones que aplica {efectiva.organismo.nombre}
            </p>
            <ul className="mt-1.5 space-y-1">
              {excepcionesLegibles(efectiva).map((e) => (
                <li key={e} className="flex items-start gap-1.5 text-xs text-ink-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning-500" />
                  {e}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-ink-500">
              El resto de la configuración se hereda del producto sin duplicarlo.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

// Traduce los overrides del organismo a frases legibles para la demo.
function excepcionesLegibles(efectiva: ReturnType<typeof configEfectiva>): string[] {
  const o = efectiva.organismo.overrides;
  const items: string[] = [];
  if (o.permiteDeudaTerceros !== undefined)
    items.push(
      o.permiteDeudaTerceros
        ? "Habilita la cancelación de deuda con terceros"
        : "No habilita la cancelación de deuda con terceros"
    );
  if (o.capitalMaximo !== undefined)
    items.push(`Capital máximo propio: ${formatARS(o.capitalMaximo)}`);
  Object.entries(o.pantallas ?? {}).forEach(([id, cambio]) => {
    const pantalla = efectiva.pantallas.find((p) => p.id === id);
    const label = pantalla?.label ?? id;
    if (cambio?.visible === false) items.push(`Oculta la pantalla “${label}”`);
    else if (cambio?.visible === true) items.push(`Habilita la pantalla “${label}”`);
    if (cambio?.obligatoria === false) items.push(`“${label}” deja de ser obligatoria`);
    else if (cambio?.obligatoria === true) items.push(`“${label}” pasa a ser obligatoria`);
  });
  Object.entries(o.camposObligatorios ?? {}).forEach(([id, obligatorio]) => {
    const label = getCampo(id)?.label ?? id;
    items.push(`Campo “${label}” ${obligatorio ? "obligatorio" : "opcional"}`);
  });
  if (o.referencias)
    items.push(
      `Referencias: mínimo ${efectiva.referencias.minimo}, máximo ${efectiva.referencias.maximo}`
    );
  if (o.garantes)
    items.push(`Garantes: mínimo ${efectiva.garantes.minimo}, máximo ${efectiva.garantes.maximo}`);
  if (o.tokenizacion?.maximoTarjetas !== undefined) {
    const n = o.tokenizacion.maximoTarjetas;
    items.push(`Hasta ${n} tarjeta${n === 1 ? "" : "s"} tokenizada${n === 1 ? "" : "s"}`);
  }
  if (o.tokenizacion?.proveedorId)
    items.push(`Proveedor de tokenización: ${nombreProveedor(o.tokenizacion.proveedorId)}`);
  if (o.documentos)
    items.push(
      `Documentación propia: ${o.documentos.map((d) => getTipoDocumento(d.tipoId).nombre).join(", ")}`
    );
  return items;
}
