"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { onlyDigits } from "@/lib/format";
import type { TipoPersona } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
import {
  IconCheck,
  IconIdCard,
  IconLoader,
  IconSearch,
  IconUser,
  IconUsers,
} from "@/components/icons";

type Icono = (props: { width?: number; height?: number }) => React.ReactNode;

function validarDocumento(valor: string): string | null {
  const d = onlyDigits(valor);
  if (d.length === 0) return "Ingresá el DNI o CUIL del cliente para consultar sus datos.";
  if (d.length === 7 || d.length === 8 || d.length === 11) return null;
  return "Ingresá un DNI (7 u 8 dígitos) o un CUIL (11 dígitos), sin puntos ni guiones.";
}

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

// Primer paso del flujo: tipo de persona e identificación del cliente por DNI/CUIL.
export function PasoInicio() {
  const { app, patchApp, setTipoPersona, consultarCliente } = useApplication();
  const [documento, setDocumento] = useState(
    app.identificacion.documento || app.cliente?.dni || ""
  );
  const [error, setError] = useState<string | null>(null);
  const [consultando, setConsultando] = useState(false);
  const encontrado = app.identificacion.consultado && app.cliente;

  function consultar() {
    const err = validarDocumento(documento);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setConsultando(true);
    patchApp({ identificacion: { ...app.identificacion, documento } });
    window.setTimeout(() => {
      consultarCliente();
      setConsultando(false);
    }, 800);
  }

  return (
    <div className="space-y-5">
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

        <div className="border-t border-ink-100 px-5 py-4 sm:px-6">
          <label htmlFor="documento" className="mb-1.5 block text-sm font-medium text-ink-700">
            DNI o CUIL del cliente
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <input
                id="documento"
                type="text"
                inputMode="numeric"
                value={documento}
                onChange={(e) => {
                  setDocumento(onlyDigits(e.target.value).slice(0, 11));
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") consultar();
                }}
                placeholder="Ej.: 27456890 o 27274568904"
                disabled={consultando}
                aria-invalid={!!error}
                className={`w-full rounded-lg border bg-white px-3.5 py-2.5 pr-11 text-sm tabular-nums shadow-xs outline-none transition placeholder:text-ink-400 ${
                  error
                    ? "border-danger-400 focus:border-danger-500 focus:ring-2 focus:ring-danger-100"
                    : "border-ink-300 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                } ${consultando ? "cursor-wait" : ""}`}
              />
              {encontrado && !error && (
                <IconCheck
                  width={16}
                  height={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-success-600"
                />
              )}
            </div>
            <Button onClick={consultar} loading={consultando} className="sm:w-auto">
              {!consultando && <IconSearch width={16} height={16} />}
              Consultar cliente
            </Button>
          </div>
          {error ? (
            <ValidationMessage tipo="error">{error}</ValidationMessage>
          ) : (
            <p className="mt-1.5 text-xs text-ink-500">
              DNI de 7 u 8 dígitos o CUIL de 11, sin puntos ni guiones. En la demo cualquier
              documento válido devuelve el cliente de prueba.
            </p>
          )}

          {consultando && (
            <div className="animate-fade-in mt-3 space-y-3 rounded-xl border border-ink-200 bg-white p-5 shadow-card">
              <p className="flex items-center gap-2 text-sm font-medium text-brand-700">
                <IconLoader width={16} height={16} />
                Consultando servicios de datos externos…
              </p>
              <div className="space-y-2">
                <div className="h-3 w-1/2 animate-pulse rounded bg-ink-100" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-ink-100" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-ink-100" />
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
