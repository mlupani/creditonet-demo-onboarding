"use client";

import { useApplication } from "@/lib/application-context";
import { configEfectiva } from "@/lib/config";
import {
  esRectificado,
  getCampo,
  obligatorioEfectivo,
  sanitizar,
  validarCampo,
  valorCampo,
  type PantallaConCampos,
} from "@/lib/campos-post-oferta";
import { PaisSelect } from "@/components/ui/PaisSelect";
import { RequiredBadge } from "@/components/ui/RequiredBadge";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
import { OrigenCampoBadge } from "@/components/ui/OrigenBadge";

const control =
  "rounded-lg border bg-white px-3 py-2.5 text-sm text-ink-900 shadow-xs outline-none transition placeholder:text-ink-400";

// Área (país) + Característica + Teléfono en una sola línea.
// Reemplaza los tres campos sueltos del catálogo (ej. telefono.pais / telefono.caracteristica / telefono.numero)
// que antes ocupaban hasta 2 filas del grid y dejaban inputs muy anchos.
export function GrupoTelefonoPostOferta({
  pantalla,
  prefijo,
}: {
  pantalla: PantallaConCampos;
  prefijo: string;
}) {
  const { app, setCampo } = useApplication();

  const paisCampo = getCampo(`${prefijo}.pais`);
  const caracCampo = getCampo(`${prefijo}.caracteristica`);
  const numeroCampo = getCampo(`${prefijo}.numero`);
  if (!paisCampo || !caracCampo || !numeroCampo) return null;

  const obligatorios = configEfectiva(app.configuracion).camposObligatorios;
  const obligatorio = [paisCampo, caracCampo, numeroCampo].some((c) =>
    obligatorioEfectivo(c, obligatorios)
  );

  const valores = app.postOferta[pantalla];
  const valorPais = valorCampo(app, paisCampo);
  const valorCarac = valorCampo(app, caracCampo);
  const valorNumero = valorCampo(app, numeroCampo);

  const bloqueado = numeroCampo.origen === "NO_MODIFICABLE";
  // Para precargados mostramos hint de rectificación si alguno cambió
  const rectificado = [paisCampo, caracCampo, numeroCampo].some((c) => esRectificado(app, c));
  const original = rectificado
    ? [paisCampo, caracCampo, numeroCampo]
        .map((c) => app.postOferta.precarga[c.id])
        .filter(Boolean)
        .join(" ")
    : undefined;

  const errorPais = bloqueado ? undefined : validarCampo(paisCampo, valorPais, obligatorio, valores);
  const errorCarac = bloqueado ? undefined : validarCampo(caracCampo, valorCarac, obligatorio, valores);
  const errorNumero = bloqueado ? undefined : validarCampo(numeroCampo, valorNumero, obligatorio, valores);
  const error = errorPais ?? errorCarac ?? errorNumero ?? undefined;

  // Badge de origen: si los tres comparten origen usamos el del número, si no mostramos el del número
  const badge = <OrigenCampoBadge origen={numeroCampo.origen} rectificado={rectificado} />;
  const hint = bloqueado
    ? "Participó en la generación de la oferta: no se puede cambiar."
    : rectificado && original
      ? `Precargado: ${original}`
      : undefined;

  const label = numeroCampo.label;
  const idBase = `po-${prefijo.replace(/\./g, "-")}`;

  const border = error
    ? "border-danger-400 focus:border-danger-500 focus:ring-2 focus:ring-danger-100"
    : "border-ink-300 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <div className="sm:col-span-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-ink-700">{label}</label>
        {badge}
      </div>
      <div className="relative flex gap-2">
        {obligatorio && !bloqueado && <RequiredBadge />}
        <PaisSelect
          id={`${idBase}-pais`}
          value={valorPais}
          onChange={(v) => setCampo(pantalla, paisCampo.id, sanitizar(paisCampo, v, valores))}
          invalid={!!error}
          disabled={bloqueado}
          className="w-28 shrink-0 sm:w-32"
        />
        <input
          id={`${idBase}-caracteristica`}
          type="text"
          inputMode="tel"
          placeholder="Caract."
          aria-label="Característica"
          value={valorCarac}
          onChange={(e) => setCampo(pantalla, caracCampo.id, sanitizar(caracCampo, e.target.value, valores))}
          disabled={bloqueado}
          aria-invalid={!!error}
          className={`${control} ${border} w-20 shrink-0 sm:w-24 ${bloqueado ? "cursor-not-allowed bg-ink-50 text-ink-500" : ""}`}
        />
        <input
          id={`${idBase}-numero`}
          type="text"
          inputMode="tel"
          placeholder="Número"
          aria-label="Número"
          value={valorNumero}
          onChange={(e) => setCampo(pantalla, numeroCampo.id, sanitizar(numeroCampo, e.target.value, valores))}
          disabled={bloqueado}
          aria-invalid={!!error}
          className={`${control} ${border} min-w-0 flex-1 ${bloqueado ? "cursor-not-allowed bg-ink-50 text-ink-500" : ""}`}
        />
      </div>
      {error ? (
        <ValidationMessage tipo="error">{error}</ValidationMessage>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}
