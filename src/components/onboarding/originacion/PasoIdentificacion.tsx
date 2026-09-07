"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { DATOS_API_PUBLICA } from "@/lib/mocks";
import { formatDNI, isValidDNI, onlyDigits } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
import { DemoTag } from "@/components/ui/DemoTag";
import { CampoCliente } from "./CampoCliente";
import {
  IconCheck,
  IconCheckCircle,
  IconLoader,
  IconSearch,
  IconUsers,
} from "@/components/icons";

export function PasoIdentificacion() {
  const { app, patchApp, consultarCliente } = useApplication();
  const [dni, setDni] = useState(app.identificacion.documento || app.cliente?.dni || "");
  const [error, setError] = useState<string | null>(null);
  const [consultando, setConsultando] = useState(false);

  const encontrado = app.identificacion.consultado && app.cliente;

  function consultar() {
    if (dni.trim().length === 0) {
      setError("Ingresá el DNI del cliente para consultar la información disponible.");
      return;
    }
    if (!isValidDNI(dni)) {
      setError("El DNI debe contener entre 7 y 8 dígitos.");
      return;
    }
    setError(null);
    setConsultando(true);
    patchApp({ identificacion: { ...app.identificacion, documento: dni } });
    window.setTimeout(() => {
      consultarCliente();
      setConsultando(false);
    }, 800);
  }

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="dni" className="mb-1.5 block text-sm font-medium text-ink-700">
          DNI del cliente
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <input
              id="dni"
              type="text"
              inputMode="numeric"
              value={dni}
              onChange={(e) => {
                setDni(onlyDigits(e.target.value).slice(0, 8));
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") consultar();
              }}
              placeholder="Ej.: 27456890"
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
            Ingresá 7 u 8 dígitos, sin puntos. En la demo cualquier DNI válido devuelve el
            cliente de prueba.
          </p>
        )}
      </div>

      {consultando && (
        <div className="animate-fade-in space-y-3 rounded-xl border border-ink-200 bg-white p-5 shadow-card">
          <p className="flex items-center gap-2 text-sm font-medium text-brand-700">
            <IconLoader width={16} height={16} />
            Consultando información del cliente…
          </p>
          <div className="space-y-2">
            <div className="h-3 w-1/2 animate-pulse rounded bg-ink-100" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-ink-100" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-ink-100" />
          </div>
        </div>
      )}

      {encontrado && !consultando && (
        <div className="animate-fade-up space-y-4">
          <div className="rounded-xl border border-success-200 bg-success-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success-600 text-white">
                  <IconCheck width={16} height={16} strokeWidth={2.6} />
                </span>
                <div>
                  <p className="text-sm font-bold text-success-700">Cliente existente</p>
                  <p className="text-xs text-success-700/80">
                    Encontramos un historial previo para este cliente · Cliente #{app.numeroCliente}
                  </p>
                </div>
              </div>
              <StatusBadge tone="success">Historial interno</StatusBadge>
            </div>
          </div>

          <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <IconUsers width={20} height={20} />
              </span>
              <div>
                <p className="text-base font-bold tracking-tight text-ink-900">
                  {app.cliente!.nombre} {app.cliente!.apellido}
                </p>
                <p className="text-sm text-ink-500">
                  DNI {formatDNI(app.cliente!.dni)} · {app.cliente!.sexo}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-ink-100 bg-ink-25 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                Datos obtenidos automáticamente
              </p>
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {DATOS_API_PUBLICA.map((d) => (
                  <li
                    key={d.campo}
                    className="flex items-center gap-2 text-sm font-medium text-success-700"
                  >
                    <IconCheckCircle width={14} height={14} className="shrink-0" />
                    {d.label} <span className="text-xs font-normal text-ink-400">— API pública</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 grid gap-x-5 gap-y-3 border-t border-ink-100 pt-4 sm:grid-cols-2">
              <CampoCliente id="c-apellido" label="Apellido" campo="apellido" />
              <CampoCliente id="c-nombre" label="Nombre" campo="nombre" />
              <CampoCliente id="c-cuil" label="CUIL" campo="cuil" />
              <CampoCliente id="c-sexo" label="Sexo" campo="sexo" />
              <CampoCliente id="c-fnac" label="Fecha de nacimiento" campo="fechaNacimiento" />
            </div>
          </div>

          <Banner tone="info">
            <span className="flex flex-wrap items-center gap-2">
              Algunos datos pueden requerir carga manual si la fuente consultada no los devuelve.
              Podés editar cualquier campo antes de continuar.
              <DemoTag
                variant="regla"
                detalle="Qué APIs públicas concretas se consultan y qué ocurre si no devuelven un dato son decisiones todavía pendientes en la documentación."
              />
            </span>
          </Banner>
        </div>
      )}
    </div>
  );
}
