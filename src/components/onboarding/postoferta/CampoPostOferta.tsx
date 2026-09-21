"use client";

import { useApplication } from "@/lib/application-context";
import { configEfectiva } from "@/lib/config";
import {
  bancosDe,
  campoVisible,
  esRectificado,
  obligatorioEfectivo,
  sanitizar,
  unirBancos,
  validarCampo,
  valorCampo,
  type CampoDef,
} from "@/lib/campos-post-oferta";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { OrigenCampoBadge } from "@/components/ui/OrigenBadge";
import { MultiSelectField } from "@/components/ui/MultiSelectField";
import { PaisSelect } from "@/components/ui/PaisSelect";
import { ValidationMessage } from "@/components/ui/ValidationMessage";

const INPUT_MODE: Partial<Record<CampoDef["tipo"], "numeric" | "email" | "tel">> = {
  numero: "numeric",
  dni: "numeric",
  cuit: "numeric",
  cbu: "numeric",
  codigoPostal: "numeric",
  telefono: "tel",
  email: "email",
};

// Un campo del catálogo con su origen (Onboarding §3) —precargado y rectificable, no
// modificable o a cargar— y la obligatoriedad que resulta de Producto + Organismo.
export function CampoPostOferta({ campo }: { campo: CampoDef }) {
  const { app, setCampo } = useApplication();
  if (!campoVisible(app, campo)) return null;

  const obligatorio = obligatorioEfectivo(campo, configEfectiva(app.configuracion).camposObligatorios);
  const valor = valorCampo(app, campo);
  const bloqueado = campo.origen === "NO_MODIFICABLE";
  const rectificado = esRectificado(app, campo);
  const valores = app.postOferta[campo.pantalla];
  const error = bloqueado
    ? undefined
    : (validarCampo(campo, valor, obligatorio, valores) ?? undefined);
  const badge = <OrigenCampoBadge origen={campo.origen} rectificado={rectificado} />;
  const hint = bloqueado
    ? "Participó en la generación de la oferta: no se puede cambiar."
    : rectificado
      ? `Precargado: ${app.postOferta.precarga[campo.id] || "vacío"}`
      : campo.tipo === "fecha"
        ? "dd/mm/aaaa"
        : undefined;
  const id = `po-${campo.id.replace(/\./g, "-")}`;
  const className = campo.ancho === "completo" ? "sm:col-span-2" : undefined;
  const onChange = (v: string) => setCampo(campo.pantalla, campo.id, sanitizar(campo, v, valores));

  if (campo.tipo === "multiselect") {
    return (
      <MultiSelectField
        id={id}
        label={campo.label}
        required={obligatorio}
        values={bancosDe(valor)}
        onChange={(v) => setCampo(campo.pantalla, campo.id, unirBancos(v))}
        options={campo.opciones?.(valores) ?? []}
        badge={badge}
        error={error}
        hint={hint ?? "Podés elegir más de uno: se pide un CBU por cada banco."}
        className={className}
      />
    );
  }

  if (campo.tipo === "paisTelefono") {
    return (
      <div className={className}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label htmlFor={id} className="text-sm font-medium text-ink-700">
            {campo.label}
            {obligatorio && <span className="ml-0.5 text-danger-500">*</span>}
          </label>
          {badge}
        </div>
        <PaisSelect id={id} value={valor} onChange={onChange} invalid={!!error} />
        {error && <ValidationMessage tipo="error">{error}</ValidationMessage>}
      </div>
    );
  }

  if (campo.tipo === "select" && !bloqueado) {
    const opciones = campo.opciones?.(app.postOferta[campo.pantalla]) ?? [];
    return (
      <SelectField
        id={id}
        label={campo.label}
        required={obligatorio}
        value={valor}
        onChange={onChange}
        options={opciones.map((o) => ({ value: o, label: o }))}
        badge={badge}
        error={error}
        hint={hint}
        className={className}
      />
    );
  }

  return (
    <FormField
      id={id}
      label={campo.label}
      required={obligatorio && !bloqueado}
      value={valor}
      onChange={onChange}
      disabled={bloqueado}
      badge={badge}
      error={error}
      hint={hint}
      type={campo.tipo === "email" ? "email" : "text"}
      inputMode={INPUT_MODE[campo.tipo]}
      placeholder={campo.tipo === "cuit" ? "xx-xxxxxxxx-x" : undefined}
      className={className}
    />
  );
}
