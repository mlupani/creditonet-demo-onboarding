"use client";

import { useApplication } from "@/lib/application-context";
import { RELACIONES_REFERENCIA, validarReferencia } from "@/lib/validation";
import type { Referencia } from "@/lib/types";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { IconCheckCircle, IconPlus, IconTrash } from "@/components/icons";

export function PantallaReferencias() {
  const { app, setReferencias } = useApplication();
  const refs = app.postOferta.referencias;

  function actualizar(id: string, patch: Partial<Referencia>) {
    setReferencias(refs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function agregar() {
    if (refs.length >= 2) return;
    setReferencias([
      ...refs,
      { id: `ref-${Date.now()}`, nombre: "", telefono: "", email: "", domicilio: "", relacion: "" },
    ]);
  }
  function quitar(id: string) {
    if (refs.length <= 1) return;
    setReferencias(refs.filter((r) => r.id !== id));
  }

  const cargadas = refs.filter((r) => Object.keys(validarReferencia(r)).length === 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-600">
          <span className="font-bold text-ink-900">{cargadas} de 2</span> referencias cargadas
          <span className="ml-2 text-xs text-ink-400">Mínimo 1 · máximo 2</span>
        </p>
        {refs.length < 2 && (
          <Button size="sm" variant="outline" onClick={agregar}>
            <IconPlus width={14} height={14} />
            Agregar referencia
          </Button>
        )}
      </div>

      {refs.map((ref, i) => {
        const err = validarReferencia(ref);
        return (
          <Card key={ref.id} className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">
                  {i + 1}
                </span>
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                    Referencia {i + 1}
                    {Object.keys(err).length === 0 && (
                      <IconCheckCircle width={14} height={14} className="text-success-600" />
                    )}
                  </h3>
                  <p className="text-xs text-ink-500">Persona de contacto para verificación.</p>
                </div>
              </div>
              {refs.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => quitar(ref.id)}>
                  <IconTrash width={14} height={14} />
                  Quitar
                </Button>
              )}
            </div>
            <div className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
              <FormField
                id={`ref-${ref.id}-nombre`}
                label="Nombre completo"
                required
                value={ref.nombre}
                onChange={(v) => actualizar(ref.id, { nombre: v })}
                error={err.nombre}
              />
              <FormField
                id={`ref-${ref.id}-tel`}
                label="Teléfono"
                required
                inputMode="tel"
                value={ref.telefono}
                onChange={(v) => actualizar(ref.id, { telefono: v })}
                error={err.telefono}
              />
              <FormField
                id={`ref-${ref.id}-email`}
                label="Email"
                required
                type="email"
                value={ref.email}
                onChange={(v) => actualizar(ref.id, { email: v })}
                error={err.email}
              />
              <FormField
                id={`ref-${ref.id}-domicilio`}
                label="Domicilio"
                required
                value={ref.domicilio}
                onChange={(v) => actualizar(ref.id, { domicilio: v })}
                error={err.domicilio}
              />
              <SelectField
                id={`ref-${ref.id}-relacion`}
                label="Relación"
                required
                value={ref.relacion}
                onChange={(v) => actualizar(ref.id, { relacion: v })}
                options={RELACIONES_REFERENCIA.map((r) => ({ value: r, label: r }))}
                error={err.relacion}
                className="sm:col-span-2"
              />
            </div>
          </Card>
        );
      })}

      {cargadas >= 1 ? (
        <Banner tone="success">
          {cargadas === refs.length
            ? "Referencias completas."
            : "Ya hay una referencia completa (el mínimo). Podés cargar la segunda o continuar."}
        </Banner>
      ) : (
        <Banner tone="warning">Completá al menos una referencia para poder finalizar la carga.</Banner>
      )}
    </div>
  );
}
