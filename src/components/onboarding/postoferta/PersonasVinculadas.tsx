"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { configEfectiva } from "@/lib/config";
import { VINCULOS_GARANTE, VINCULOS_REFERENCIA } from "@/lib/parametros";
import { isValidDNI, maskDNI } from "@/lib/format";
import { CONDICIONES_LABORALES, validarPersona } from "@/lib/validation";
import type { TipoPersonaVinculada } from "@/lib/types";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { SelectField } from "@/components/ui/SelectField";
import { TelefonoField } from "@/components/ui/TelefonoField";
import {
  IconCheck,
  IconCheckCircle,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
} from "@/components/icons";

const TEXTOS: Record<
  TipoPersonaVinculada,
  { titulo: string; plural: string; descripcion: string; vinculos: string[] }
> = {
  referencia: {
    titulo: "Referencia",
    plural: "referencias",
    descripcion: "Persona de contacto para verificación.",
    vinculos: VINCULOS_REFERENCIA,
  },
  garante: {
    titulo: "Garante",
    plural: "garantes",
    descripcion: "Firma la documentación del préstamo y el pagaré.",
    vinculos: VINCULOS_GARANTE,
  },
};

// Pantallas 4 y 5 · Referencias y Garantías (Onboarding §7–§8): misma estructura; cantidad y
// obligatoriedad configurables por producto, con excepciones del organismo.
export function PersonasVinculadas({ tipo }: { tipo: TipoPersonaVinculada }) {
  const {
    app,
    agregarPersona,
    actualizarPersona,
    buscarPersonaPorDni,
    quitarPersona,
    adjuntarReciboSueldo,
    quitarReciboSueldo,
  } = useApplication();
  const [buscando, setBuscando] = useState<string | null>(null);
  const [subiendoRecibo, setSubiendoRecibo] = useState<string | null>(null);

  const cfg = configEfectiva(app.configuracion);
  const t = TEXTOS[tipo];
  const lista = tipo === "referencia" ? app.postOferta.referencias : app.postOferta.garantes;
  const { minimo, maximo } = tipo === "referencia" ? cfg.referencias : cfg.garantes;
  const validas = lista.filter((p) => Object.keys(validarPersona(p, tipo)).length === 0).length;
  const faltan = Math.max(minimo - lista.length, 0);

  function buscar(id: string) {
    setBuscando(id);
    window.setTimeout(() => {
      buscarPersonaPorDni(tipo, id);
      setBuscando(null);
    }, 800);
  }

  function subirRecibo(id: string) {
    setSubiendoRecibo(id);
    window.setTimeout(() => {
      adjuntarReciboSueldo(tipo, id);
      setSubiendoRecibo(null);
    }, 900);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-600">
          <span>
            <span className="font-bold text-ink-900">
              {validas} de {lista.length}
            </span>{" "}
            con datos completos
          </span>
          <span className="text-xs text-ink-400">
            Mínimo {minimo} · máximo {maximo}
          </span>
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => agregarPersona(tipo)}
          disabled={lista.length >= maximo}
        >
          <IconPlus width={14} height={14} />
          Agregar {t.titulo.toLowerCase()}
        </Button>
      </div>

      {lista.map((p, i) => {
        const err = validarPersona(p, tipo);
        const completa = Object.keys(err).length === 0;
        return (
          <Card key={p.id} className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">
                  {i + 1}
                </span>
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                    {t.titulo} {i + 1}
                    {completa && (
                      <IconCheckCircle width={14} height={14} className="text-success-600" />
                    )}
                  </h3>
                  <p className="text-xs text-ink-500">{t.descripcion}</p>
                </div>
              </div>
              {lista.length > minimo && (
                <Button size="sm" variant="ghost" onClick={() => quitarPersona(tipo, p.id)}>
                  <IconTrash width={14} height={14} />
                  Quitar
                </Button>
              )}
            </div>
            <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
              <SelectField
                id={`${p.id}-vinculo`}
                label="Vínculo con el cliente"
                required
                value={p.vinculo}
                onChange={(v) => actualizarPersona(tipo, p.id, { vinculo: v })}
                options={t.vinculos.map((v) => ({ value: v, label: v }))}
                hint="Desplegable del Módulo Parámetros."
              />
              <div>
                <FormField
                  id={`${p.id}-dni`}
                  label="DNI"
                  required
                  inputMode="numeric"
                  value={p.dni}
                  onChange={(v) =>
                    actualizarPersona(tipo, p.id, {
                      dni: maskDNI(v),
                      autocompletado: false,
                    })
                  }
                  error={err.dni}
                />
                <Button
                  className="mt-2"
                  size="sm"
                  variant="outline"
                  onClick={() => buscar(p.id)}
                  disabled={!isValidDNI(p.dni) || buscando !== null}
                  loading={buscando === p.id}
                >
                  {buscando !== p.id && <IconSearch width={14} height={14} />}
                  Buscar por DNI
                </Button>
              </div>
              <FormField
                id={`${p.id}-nombre`}
                label="Nombre"
                required
                value={p.nombre}
                onChange={(v) => actualizarPersona(tipo, p.id, { nombre: v })}
                error={err.nombre}
              />
              <FormField
                id={`${p.id}-apellido`}
                label="Apellido"
                required
                value={p.apellido}
                onChange={(v) => actualizarPersona(tipo, p.id, { apellido: v })}
                error={err.apellido}
              />
              <FormField
                id={`${p.id}-email`}
                label="Email de contacto"
                required
                type="email"
                inputMode="email"
                value={p.email}
                onChange={(v) => actualizarPersona(tipo, p.id, { email: v })}
                error={err.email}
              />
              <TelefonoField
                id={`${p.id}-telefono`}
                label="Teléfono de contacto"
                required
                value={p.telefono}
                onChange={(v) => actualizarPersona(tipo, p.id, { telefono: v })}
                error={err.telefono}
              />
              <FormField
                id={`${p.id}-domicilio`}
                label="Domicilio completo"
                required
                value={p.domicilio}
                onChange={(v) => actualizarPersona(tipo, p.id, { domicilio: v })}
                error={err.domicilio}
                className="sm:col-span-2"
              />
            </div>

            {tipo === "garante" && (
              <div className="mt-4 border-t border-ink-100 pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
                  Ingresos y datos laborales · demuestran capacidad de pago
                </p>
                <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
                  <SelectField
                    id={`${p.id}-condicion-laboral`}
                    label="Condición laboral"
                    required
                    value={p.condicionLaboral}
                    onChange={(v) => actualizarPersona(tipo, p.id, { condicionLaboral: v })}
                    options={CONDICIONES_LABORALES.map((c) => ({ value: c, label: c }))}
                    error={err.condicionLaboral}
                    className="sm:col-span-2"
                  />
                  <MoneyInput
                    id={`${p.id}-ingreso-bruto`}
                    label="Ingreso bruto"
                    required
                    value={p.ingresoBruto}
                    onChange={(v) => actualizarPersona(tipo, p.id, { ingresoBruto: v })}
                    error={err.ingresoBruto}
                  />
                  <MoneyInput
                    id={`${p.id}-ingreso-neto`}
                    label="Ingreso neto"
                    required
                    value={p.ingresoNeto}
                    onChange={(v) => actualizarPersona(tipo, p.id, { ingresoNeto: v })}
                    error={err.ingresoNeto}
                  />
                  <FormField
                    id={`${p.id}-empleador-calle`}
                    label="Calle del empleador"
                    required
                    value={p.empleadorCalle}
                    onChange={(v) => actualizarPersona(tipo, p.id, { empleadorCalle: v })}
                    error={err.empleadorCalle}
                  />
                  <FormField
                    id={`${p.id}-empleador-localidad`}
                    label="Localidad del empleador"
                    required
                    value={p.empleadorLocalidad}
                    onChange={(v) => actualizarPersona(tipo, p.id, { empleadorLocalidad: v })}
                    error={err.empleadorLocalidad}
                  />
                  <TelefonoField
                    id={`${p.id}-empleador-telefono`}
                    label="Teléfono del empleador"
                    required
                    value={p.empleadorTelefono}
                    onChange={(v) => actualizarPersona(tipo, p.id, { empleadorTelefono: v })}
                    error={err.empleadorTelefono}
                  />
                </div>

                <div className="mt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-ink-700">
                        Recibo de sueldo <span className="text-danger-500">*</span>
                      </p>
                      <p className="text-xs text-ink-500">
                        {p.reciboSueldo.length > 0
                          ? `${p.reciboSueldo.length} archivo${p.reciboSueldo.length === 1 ? "" : "s"} adjunto${p.reciboSueldo.length === 1 ? "" : "s"}`
                          : "Sin adjuntar todavía."}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => subirRecibo(p.id)}
                      disabled={subiendoRecibo !== null}
                      loading={subiendoRecibo === p.id}
                    >
                      {subiendoRecibo !== p.id && <IconUpload width={14} height={14} />}
                      {p.reciboSueldo.length > 0 ? "Agregar otro" : "Adjuntar recibo"}
                    </Button>
                  </div>
                  {err.reciboSueldo && (
                    <p className="mt-1.5 text-xs font-medium text-danger-600">
                      {err.reciboSueldo}
                    </p>
                  )}
                  {p.reciboSueldo.length > 0 && (
                    <ul className="mt-2 space-y-1 rounded-lg border border-success-200 bg-success-50/60 p-2">
                      {p.reciboSueldo.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="flex items-center gap-1.5 truncate font-medium text-success-700">
                            <IconCheck width={13} height={13} strokeWidth={2.6} />
                            {a.nombre} · {a.detalle}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => quitarReciboSueldo(tipo, p.id, a.id)}
                          >
                            <IconTrash width={13} height={13} />
                            Quitar
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </Card>
        );
      })}

      {lista.length === 0 && (
        <Card className="p-6 text-center text-sm text-ink-500">
          Sin {t.plural} por ahora. Usá “Agregar {t.titulo.toLowerCase()}”.
        </Card>
      )}

      {tipo === "garante" && (
        <Banner tone="info">
          El garante debe firmar la documentación del préstamo y el pagaré.
        </Banner>
      )}

      {faltan > 0 ? (
        <Banner tone="warning">
          Agregá {faltan} {faltan === 1 ? t.titulo.toLowerCase() : t.plural} más para llegar al
          mínimo configurado.
        </Banner>
      ) : lista.length > 0 && validas === lista.length ? (
        <Banner tone="success">Todos los datos de {t.plural} están completos.</Banner>
      ) : lista.length > 0 ? (
        <Banner tone="info">Completá los datos marcados para poder finalizar la carga.</Banner>
      ) : null}
    </div>
  );
}
