"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { DATOS_API_PUBLICA } from "@/lib/mocks";
import { CONDICIONES_LABORALES, GENEROS, validarLaboral } from "@/lib/validation";
import { evaluarInstitucionales, institucionalesBloquean } from "@/lib/reglas-institucionales";
import { formatDNI, onlyDigits } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { Card, CardHeader } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
import { DemoTag } from "@/components/ui/DemoTag";
import { CampoCliente } from "./CampoCliente";
import { VerificacionPresencial } from "./VerificacionPresencial";
import { InstitucionalesPanel } from "../evaluacion/InstitucionalesPanel";
import {
  IconCheck,
  IconCheckCircle,
  IconLoader,
  IconSearch,
  IconUsers,
} from "@/components/icons";

function validarDocumento(valor: string): string | null {
  const d = onlyDigits(valor);
  if (d.length === 0) return "Ingresá el DNI o CUIL del cliente para consultar sus datos.";
  if (d.length === 7 || d.length === 8 || d.length === 11) return null;
  return "Ingresá un DNI (7 u 8 dígitos) o un CUIL (11 dígitos), sin puntos ni guiones.";
}

export function PasoIdentificacion() {
  const { app, patchApp, patchLaboral, consultarCliente } = useApplication();
  const [documento, setDocumento] = useState(
    app.identificacion.documento || app.cliente?.dni || ""
  );
  const [error, setError] = useState<string | null>(null);
  const [consultando, setConsultando] = useState(false);

  const encontrado = app.identificacion.consultado && app.cliente;
  // Las reglas institucionales que ya tienen sus datos se evalúan acá, en vivo: si el
  // vendedor rectifica un dato de la API, la regla se vuelve a evaluar (Motor §6 y §11).
  const institucionales = evaluarInstitucionales(app, "IDENTIFICACION");
  const descartada = institucionalesBloquean(institucionales);
  const erroresLaboral = validarLaboral(app.laboral);

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
      <div>
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
      </div>

      {consultando && (
        <div className="animate-fade-in space-y-3 rounded-xl border border-ink-200 bg-white p-5 shadow-card">
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

      {encontrado && !consultando && (
        <div className="animate-fade-up space-y-5">
          <div className="rounded-xl border border-success-200 bg-success-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success-600 text-white">
                  <IconCheck width={16} height={16} strokeWidth={2.6} />
                </span>
                <div>
                  <p className="text-sm font-bold text-success-700">Cliente existente</p>
                  <p className="text-xs text-success-700/80">
                    Se recuperó su ID de Cliente permanente y el historial previo.
                  </p>
                </div>
              </div>
              <StatusBadge tone="success">ID de Cliente {app.numeroCliente}</StatusBadge>
            </div>
          </div>

          {app.situaciones && (
            <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                  Situación traída con el documento
                </p>
                <DemoTag
                  variant="regla"
                  detalle="Se consulta junto con el DNI, antes de evaluar. Con la condición laboral son los tres limitantes que determinan qué línea aplica; si ninguna la acepta, la solicitud se rechaza sin llegar al motor."
                />
              </div>
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-ink-200 bg-ink-25 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                    Situación BCRA
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-ink-800">
                    Situación {app.situaciones.bcra}
                  </p>
                </div>
                <div className="rounded-lg border border-ink-200 bg-ink-25 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                    Buró interno
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-ink-800">
                    Situación {app.situaciones.interna}
                  </p>
                </div>
              </div>
              <SelectField
                id="condicion-laboral"
                label="Condición laboral"
                required
                value={app.laboral.condicionLaboral}
                onChange={(v) => patchLaboral({ condicionLaboral: v })}
                options={CONDICIONES_LABORALES.map((c) => ({ value: c, label: c }))}
                error={erroresLaboral.condicionLaboral}
                hint="El tercer limitante, junto con la situación BCRA y el buró interno, que determina qué línea aplica. Participa en la generación de la oferta y no se puede modificar después."
                className="mt-3"
              />
            </div>
          )}

          <Card>
            <CardHeader
              title={`${app.cliente!.nombre} ${app.cliente!.apellido}`}
              description={`DNI ${formatDNI(app.cliente!.dni)} · CUIL ${app.cliente!.cuil}`}
              icon={<IconUsers width={18} height={18} />}
            />
            <div className="p-5 sm:p-6">
              <div className="rounded-lg border border-ink-100 bg-ink-25 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  Autocompletado desde la API
                </p>
                <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {DATOS_API_PUBLICA.map((d) => (
                    <li
                      key={d.campo}
                      className="flex items-center gap-2 text-sm font-medium text-success-700"
                    >
                      <IconCheckCircle width={14} height={14} className="shrink-0" />
                      {d.label}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2">
                <CampoCliente id="c-nombre" label="Nombre" campo="nombre" />
                <CampoCliente id="c-apellido" label="Apellido" campo="apellido" />
                <CampoCliente id="c-fnac" label="Fecha de nacimiento" campo="fechaNacimiento" />
                <CampoCliente
                  id="c-genero"
                  label="Género"
                  campo="genero"
                  as="select"
                  options={GENEROS}
                />
                <div className="sm:col-span-2">
                  <CampoCliente id="c-domicilio" label="Domicilio" campo="domicilio" />
                </div>
                <CampoCliente id="c-email" label="Email" campo="email" />
              </div>
            </div>
          </Card>

          <InstitucionalesPanel reglas={institucionales} />

          {descartada ? (
            <Banner tone="error" title="Solicitud descartada por una regla institucional">
              <span className="flex flex-wrap items-center gap-2">
                Con estos datos no se puede continuar: no se genera ID de Crédito ni se ejecuta el
                motor. Si un dato vino mal de la API, corregilo arriba y la regla se vuelve a
                evaluar.
                <DemoTag
                  variant="regla"
                  detalle="Para mostrar el descarte temprano cambiá la fecha de nacimiento a 14/05/1955. Con 14/05/1982 la regla vuelve a pasar."
                />
              </span>
            </Banner>
          ) : (
            <VerificacionPresencial />
          )}

          <Banner tone="info">
            <span className="flex flex-wrap items-center gap-2">
              Los datos son editables: al modificar uno, su origen pasa a carga manual. Para un
              cliente nuevo se asigna un ID de Cliente interno permanente.
              <DemoTag
                variant="regla"
                detalle="Qué servicios de datos públicos/privados se consultan y qué ocurre si no devuelven un dato son definiciones pendientes."
              />
            </span>
          </Banner>
        </div>
      )}
    </div>
  );
}
