// Campos cuya obligatoriedad se configura por producto (con excepciones del organismo), para las
// pantallas del onboarding (creditonet-117). Cada campo tiene un check; sólo se guardan en
// `camposObligatorios` los que se apartan del valor por defecto.

import { CAMPOS_POST_OFERTA } from "./campos-post-oferta";
import type { PantallaPostOfertaId } from "./types";
import {
  CAMPOS_PERSONA,
  LABEL_PERSONA,
  idCampoPersona,
  type PantallaPersonas,
} from "./validation";

export interface CampoConfigurable {
  id: string;
  label: string;
  porDefecto: boolean;
  // Campo que exige siempre el proveedor o el flujo: se muestra con el check bloqueado.
  fijo?: boolean;
}

export const TITULO_PANTALLA_CAMPOS: Record<PantallaPostOfertaId, string> = {
  personales: "Datos personales",
  laboral: "Datos laborales",
  tokenizacion: "Tokenización de tarjetas",
  referencias: "Referencias personales",
  garantias: "Garantías",
  legajo: "Legajo virtual",
  impresion: "Impresión de legajo",
};

// El formulario de carga presencial lo exige el proveedor de tokenización: no se puede relajar.
const CAMPOS_TARJETA: CampoConfigurable[] = [
  { id: "tarjeta.numero", label: "Número de tarjeta", porDefecto: true, fijo: true },
  { id: "tarjeta.titular", label: "Nombre del titular", porDefecto: true, fijo: true },
  { id: "tarjeta.vencimiento", label: "Vencimiento", porDefecto: true, fijo: true },
  { id: "tarjeta.codigo", label: "Código de seguridad", porDefecto: true, fijo: true },
];

function camposPersona(pantalla: PantallaPersonas): CampoConfigurable[] {
  return CAMPOS_PERSONA.filter((c) => pantalla === "garantias" || !c.soloGarante).map((c) => ({
    id: idCampoPersona(pantalla, c.id),
    label: LABEL_PERSONA[c.id],
    porDefecto: true,
  }));
}

// Los campos modificables de cada pantalla. Legajo (ítems con obligatoriedad y cantidades) e
// impresión (sin campos) no tienen lista: el legajo se configura en su propia sección.
export function camposConfigurablesDe(pantalla: PantallaPostOfertaId): CampoConfigurable[] {
  switch (pantalla) {
    case "personales":
    case "laboral":
      return CAMPOS_POST_OFERTA.filter(
        (c) => c.pantalla === pantalla && c.origen !== "NO_MODIFICABLE"
      ).map((c) => ({ id: c.id, label: c.label, porDefecto: c.obligatorio }));
    case "referencias":
    case "garantias":
      return camposPersona(pantalla);
    case "tokenizacion":
      return CAMPOS_TARJETA;
    default:
      return [];
  }
}

// Campo configurable por id, de cualquier pantalla (para las excepciones del organismo).
export function campoConfigurable(
  id: string
): { campo: CampoConfigurable; pantalla: PantallaPostOfertaId } | undefined {
  for (const pantalla of Object.keys(TITULO_PANTALLA_CAMPOS) as PantallaPostOfertaId[]) {
    const campo = camposConfigurablesDe(pantalla).find((c) => c.id === id);
    if (campo) return { campo, pantalla };
  }
  return undefined;
}

export function esObligatorio(
  campo: CampoConfigurable,
  obligatorios: Partial<Record<string, boolean>>
): boolean {
  return campo.fijo ? campo.porDefecto : (obligatorios[campo.id] ?? campo.porDefecto);
}

// Cambia un campo y deja sólo las diferencias con el valor por defecto.
export function conCampoObligatorio(
  obligatorios: Partial<Record<string, boolean>>,
  campo: CampoConfigurable,
  obligatorio: boolean
): Partial<Record<string, boolean>> {
  const mapa = { ...obligatorios };
  if (obligatorio === campo.porDefecto) delete mapa[campo.id];
  else mapa[campo.id] = obligatorio;
  return mapa;
}
