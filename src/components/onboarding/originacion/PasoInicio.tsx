"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import {
  CANALES,
  PRODUCTOS,
  SESION,
  VENDEDORES,
  nombreOpcion,
  productoHabilitadoEnCanal,
} from "@/lib/config";
import type { TipoPersona } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { SelectField } from "@/components/ui/SelectField";
import {
  IconBuilding,
  IconCheck,
  IconIdCard,
  IconLock,
  IconSparkles,
  IconUser,
  IconUsers,
  IconWallet,
} from "@/components/icons";

type Icono = (props: { width?: number; height?: number }) => React.ReactNode;

function inicialesDe(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

const ICONO_CANAL: Record<string, Icono> = {
  sucursal: IconBuilding,
  digital: IconSparkles,
};

// Canales que se pueden elegir en la demo. El canal digital se muestra pero no es navegable.
const CANALES_HABILITADOS = new Set(["sucursal"]);

const PERSONAS: {
  id: TipoPersona;
  titulo: string;
  documento: string;
  detalle: string;
  icon: Icono;
  navegable: boolean;
}[] = [
  {
    id: "FISICA",
    titulo: "Persona física",
    documento: "Se identifica por DNI",
    detalle: "Empleado, jubilado o monotributista que solicita a título personal.",
    icon: IconUser,
    navegable: true,
  },
  {
    id: "JURIDICA",
    titulo: "Persona jurídica",
    documento: "Se identifica por CUIT",
    detalle: "Empresa o entidad. Requiere datos societarios y del firmante.",
    icon: IconUsers,
    navegable: false,
  },
];

function Opcion({
  seleccionada,
  onClick,
  icon: Icon,
  titulo,
  subtitulo,
  detalle,
  nota,
  disabled = false,
}: {
  seleccionada: boolean;
  onClick: () => void;
  icon: Icono;
  titulo: string;
  subtitulo: string;
  detalle?: string;
  nota?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={seleccionada}
      className={`relative rounded-xl border p-4 text-left transition-all ${
        disabled
          ? "cursor-not-allowed border-ink-200 bg-ink-25 opacity-60"
          : seleccionada
            ? "border-brand-600 bg-brand-50/60 shadow-sm ring-1 ring-brand-600"
            : "border-ink-200 bg-white hover:border-brand-300 hover:bg-brand-50/30"
      }`}
    >
      {seleccionada && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
          <IconCheck width={12} height={12} strokeWidth={3} />
        </span>
      )}
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
          seleccionada ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-500"
        }`}
      >
        <Icon width={20} height={20} />
      </span>
      <p className={`mt-3 text-sm font-bold ${seleccionada ? "text-brand-700" : "text-ink-900"}`}>
        {titulo}
      </p>
      <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
        {subtitulo}
      </p>
      {detalle && <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{detalle}</p>}
      {nota && (
        <span className="mt-2.5 inline-flex rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-400">
          {nota}
        </span>
      )}
    </button>
  );
}

// Primer paso del flujo (Arquitectura §2–§4): canal de entrada, vendedor autenticado y tipo
// de persona.
export function PasoInicio() {
  const { app, patchApp, setTipoPersona, setCanal } = useApplication();
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
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="¿Por dónde llega la solicitud?"
          description="El canal es el primer elemento del flujo y define qué productos se pueden ofrecer."
          icon={<IconWallet width={18} height={18} />}
        />
        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
          {CANALES.map((canal) => {
            const productos = PRODUCTOS.filter((p) => productoHabilitadoEnCanal(p.id, canal.id));
            return (
              <Opcion
                key={canal.id}
                seleccionada={app.configuracion.canalId === canal.id}
                onClick={() => setCanal(canal.id)}
                icon={ICONO_CANAL[canal.id] ?? IconBuilding}
                titulo={canal.nombre}
                subtitulo={`${productos.length} producto${productos.length === 1 ? "" : "s"}`}
                detalle={`${canal.detalle}. Ofrece: ${productos.map((p) => p.nombre).join(", ")}.`}
                disabled={!CANALES_HABILITADOS.has(canal.id)}
                nota={CANALES_HABILITADOS.has(canal.id) ? undefined : "No disponible en la demo"}
              />
            );
          })}
        </div>
        <div className="border-t border-ink-100 px-5 py-4 sm:px-6">
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
            bandejas y devoluciones del analista. Se puede asignar a otro vendedor para el
            crédito cuando corresponda.
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

      <Card>
        <CardHeader
          title="¿Quién solicita el crédito?"
          description="El tipo de persona determina con qué documento se identifica al solicitante."
          icon={<IconIdCard width={18} height={18} />}
        />
        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
          {PERSONAS.map((op) => (
            <Opcion
              key={op.id}
              seleccionada={app.tipoPersona === op.id}
              onClick={() => setTipoPersona(op.id)}
              icon={op.icon}
              titulo={op.titulo}
              subtitulo={op.documento}
              detalle={op.detalle}
              nota={op.navegable ? undefined : "No navegable en la demo"}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
