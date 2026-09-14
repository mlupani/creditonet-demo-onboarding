"use client";

import { useApplication } from "@/lib/application-context";
import { configEfectiva } from "@/lib/config";
import {
  campoVisible,
  esRectificado,
  obligatorioEfectivo,
  sanitizar,
  validarCampo,
  valorCampo,
  type CampoDef,
} from "@/lib/campos-post-oferta";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { OrigenCampoBadge } from "@/components/ui/OrigenBadge";

const INPUT_MODE: Partial<Record<CampoDef["tipo"], "numeric" | "email" | "tel">> = {
  numero: "numeric",
  dni: "numeric",
  cuit: "numeric",
  cbu: "numeric",
  codigoPostal: "numeric",
  caracteristica: "tel",
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
  const error = bloqueado ? undefined : (validarCampo(campo, valor, obligatorio) ?? undefined);
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
  const onChange = (v: string) => setCampo(campo.pantalla, campo.id, sanitizar(campo.tipo, v));

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
      className={className}
    />
  );
}
