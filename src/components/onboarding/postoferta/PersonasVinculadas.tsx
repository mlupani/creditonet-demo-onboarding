"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { configEfectiva } from "@/lib/config";
import { VINCULOS_GARANTE, VINCULOS_REFERENCIA } from "@/lib/parametros";
import { isValidDNI } from "@/lib/format";
import { validarPersona } from "@/lib/validation";
import type { TipoPersonaVinculada } from "@/lib/types";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { AutocompletadoBadge } from "@/components/ui/OrigenBadge";
import { DemoTag } from "@/components/ui/DemoTag";
import { IconCheckCircle, IconPlus, IconSearch, IconTrash } from "@/components/icons";

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
  const { app, agregarPersona, actualizarPersona, buscarPersonaPorDni, quitarPersona } =
    useApplication();
  const [buscando, setBuscando] = useState<string | null>(null);

  const cfg = configEfectiva(app.configuracion);
  const t = TEXTOS[tipo];
  const lista = tipo === "referencia" ? app.postOferta.referencias : app.postOferta.garantes;
  const { minimo, maximo } = tipo === "referencia" ? cfg.referencias : cfg.garantes;
  const validas = lista.filter((p) => Object.keys(validarPersona(p)).length === 0).length;
  const faltan = Math.max(minimo - lista.length, 0);

  function buscar(id: string) {
    setBuscando(id);
    window.setTimeout(() => {
      buscarPersonaPorDni(tipo, id);
      setBuscando(null);
    }, 800);
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
          <DemoTag
            variant="config"
            detalle={`La cantidad y la obligatoriedad de ${t.plural} se configuran por producto, con excepciones del organismo.`}
          />
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
        const err = validarPersona(p);
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
                      dni: v.replace(/\D/g, "").slice(0, 8),
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
                label="Nombre completo"
                required
                value={p.nombreCompleto}
                badge={p.autocompletado ? <AutocompletadoBadge /> : undefined}
                onChange={(v) => actualizarPersona(tipo, p.id, { nombreCompleto: v })}
                error={err.nombreCompleto}
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
              <FormField
                id={`${p.id}-domicilio`}
                label="Domicilio completo"
                required
                value={p.domicilio}
                badge={p.autocompletado ? <AutocompletadoBadge /> : undefined}
                onChange={(v) => actualizarPersona(tipo, p.id, { domicilio: v })}
                error={err.domicilio}
                className="sm:col-span-2"
              />
            </div>
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
          <span className="flex flex-wrap items-center gap-2">
            El garante debe firmar la documentación del préstamo y el pagaré.
            <DemoTag
              variant="regla"
              detalle="El circuito de firma se define en la Función 9 — Firma electrónica. No forma parte de esta demo."
            />
          </span>
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
