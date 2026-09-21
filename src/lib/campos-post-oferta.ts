// Catálogo de campos de las pantallas post-oferta con datos (Onboarding v4 §3–§5).
//
// Cada campo declara su origen (precargado, no modificable o a cargar) y si es obligatorio por
// defecto. El Producto puede cambiar la obligatoriedad y el Organismo excepcionarla
// (Producto §7 bis · Organismo §4 bis): `obligatorioEfectivo` resuelve el valor final.

import type { CreditApplication, OrigenCampo } from "./types";
import { configEfectiva } from "./config";
import { isValidCBU, isValidEmail, maskCuit, maskFecha, onlyDigits, parseFecha } from "./format";
import { PAIS_POR_DEFECTO, sanitizarNumero, validarNumero } from "./telefono";
import {
  BANCOS,
  COMPANIAS_TELEFONICAS,
  ESTADOS_CIVILES,
  GENEROS,
  PROVINCIAS,
  RUBROS,
  TIPOS_VIVIENDA,
  getLocalidad,
  localidadesDe,
} from "./parametros";

export type PantallaConCampos = "personales" | "laboral";

export type TipoCampo =
  | "texto"
  | "numero"
  | "fecha"
  | "email"
  | "dni"
  | "cuit"
  | "cbu"
  | "paisTelefono"
  | "telefono"
  | "codigoPostal"
  | "select"
  | "multiselect";

export type SeccionCampo =
  | "identificacion"
  | "domicilio"
  | "contacto"
  | "empleador"
  | "domicilioLaboral"
  | "telefonoLaboral"
  | "acreditacion";

type Valores = Record<string, string>;

export interface CampoDef {
  id: string;
  pantalla: PantallaConCampos;
  seccion: SeccionCampo;
  label: string;
  origen: OrigenCampo;
  obligatorio: boolean;
  tipo: TipoCampo;
  // Opciones desde Parámetros; pueden depender de otros valores (localidades por provincia).
  opciones?: (valores: Valores) => string[];
  // Campo condicional: sólo se muestra y se valida si se cumple.
  visibleSi?: (valores: Valores) => boolean;
  // No modificables: se leen de los datos que dispararon la oferta, no se copian.
  valorFijo?: (app: CreditApplication) => string;
  ancho?: "completo";
  // Sólo en teléfonos: id del campo que trae el país (área), que define los dígitos del número.
  paisId?: string;
  // Plantilla que se repite una vez por banco elegido (el CBU): `camposDe` la expande.
  porBanco?: boolean;
  // En un campo expandido, id de la plantilla de la que sale (para su obligatoriedad).
  plantilla?: string;
}

export const SECCIONES: Record<SeccionCampo, { titulo: string; descripcion: string }> = {
  identificacion: {
    titulo: "Identificación",
    descripcion: "Datos de identidad y situación personal del cliente.",
  },
  domicilio: {
    titulo: "Domicilio particular",
    descripcion:
      "Provincia y localidad salen de Parámetros; el código postal se completa al elegir la localidad y se puede editar.",
  },
  contacto: {
    titulo: "Datos de contacto",
    descripcion: "Teléfono y email del pedido inicial. El teléfono alternativo es opcional.",
  },
  empleador: {
    titulo: "Datos del empleador",
    descripcion:
      "La fecha de ingreso y la situación laboral participaron en la generación de la oferta y no se pueden cambiar.",
  },
  domicilioLaboral: { titulo: "Domicilio laboral", descripcion: "Dónde trabaja el cliente." },
  telefonoLaboral: {
    titulo: "Teléfono laboral",
    descripcion: "El interno y el horario de contacto se cargan si aplican.",
  },
  acreditacion: {
    titulo: "Cuenta de acreditación",
    descripcion: "Cuenta donde se transfiere el neto del crédito al liquidarlo.",
  },
};

const SI_NO = ["Sí", "No"];

function camposDomicilio(
  pantalla: PantallaConCampos,
  seccion: SeccionCampo,
  origen: OrigenCampo
): CampoDef[] {
  const id = (campo: string) => `${seccion}.${campo}`;
  return [
    { pantalla, seccion, id: id("calle"), label: "Calle", origen, obligatorio: true, tipo: "texto" },
    { pantalla, seccion, id: id("numero"), label: "Número", origen, obligatorio: true, tipo: "numero" },
    { pantalla, seccion, id: id("piso"), label: "Piso", origen, obligatorio: false, tipo: "texto" },
    {
      pantalla,
      seccion,
      id: id("departamento"),
      label: "Departamento",
      origen,
      obligatorio: false,
      tipo: "texto",
    },
    {
      pantalla,
      seccion,
      id: id("barrio"),
      label: "Barrio",
      origen: "A_CARGAR",
      obligatorio: true,
      tipo: "texto",
    },
    {
      pantalla,
      seccion,
      id: id("entreCalles"),
      label: "Entre calles",
      origen: "A_CARGAR",
      obligatorio: false,
      tipo: "texto",
    },
    {
      pantalla,
      seccion,
      id: id("manzanaBloqueLote"),
      label: "Manzana / Bloque / Lote",
      origen: "A_CARGAR",
      obligatorio: false,
      tipo: "texto",
    },
    {
      pantalla,
      seccion,
      id: id("provincia"),
      label: "Provincia",
      origen,
      obligatorio: true,
      tipo: "select",
      opciones: () => PROVINCIAS,
    },
    {
      pantalla,
      seccion,
      id: id("localidad"),
      label: "Localidad",
      origen,
      obligatorio: true,
      tipo: "select",
      opciones: (v) => localidadesDe(v[id("provincia")] ?? "").map((l) => l.nombre),
    },
    {
      pantalla,
      seccion,
      id: id("codigoPostal"),
      label: "Código postal",
      origen,
      obligatorio: true,
      tipo: "codigoPostal",
    },
  ];
}

const condicionLaboral = (app: CreditApplication) => app.laboral.condicionLaboral;

const PERSONALES: CampoDef[] = [
  { pantalla: "personales", seccion: "identificacion", id: "nombre", label: "Nombre", origen: "PRECARGADO", obligatorio: true, tipo: "texto" },
  { pantalla: "personales", seccion: "identificacion", id: "apellido", label: "Apellido", origen: "PRECARGADO", obligatorio: true, tipo: "texto" },
  { pantalla: "personales", seccion: "identificacion", id: "dni", label: "DNI", origen: "PRECARGADO", obligatorio: true, tipo: "dni" },
  { pantalla: "personales", seccion: "identificacion", id: "cuit", label: "CUIT", origen: "PRECARGADO", obligatorio: true, tipo: "cuit" },
  {
    pantalla: "personales",
    seccion: "identificacion",
    id: "fechaNacimiento",
    label: "Fecha de nacimiento",
    origen: "PRECARGADO",
    obligatorio: true,
    tipo: "fecha",
  },
  {
    pantalla: "personales",
    seccion: "identificacion",
    id: "genero",
    label: "Género",
    origen: "PRECARGADO",
    obligatorio: true,
    tipo: "select",
    opciones: () => GENEROS,
  },
  {
    pantalla: "personales",
    seccion: "identificacion",
    id: "situacionLaboral",
    label: "Situación laboral / tipo de empleo",
    origen: "NO_MODIFICABLE",
    obligatorio: true,
    tipo: "texto",
    valorFijo: condicionLaboral,
  },
  {
    pantalla: "personales",
    seccion: "identificacion",
    id: "nacionalidad",
    label: "Nacionalidad",
    origen: "A_CARGAR",
    obligatorio: true,
    tipo: "texto",
  },
  {
    pantalla: "personales",
    seccion: "identificacion",
    id: "estadoCivil",
    label: "Estado civil",
    origen: "A_CARGAR",
    obligatorio: true,
    tipo: "select",
    opciones: () => ESTADOS_CIVILES,
  },
  {
    pantalla: "personales",
    seccion: "identificacion",
    id: "tipoVivienda",
    label: "Tipo de vivienda",
    origen: "A_CARGAR",
    obligatorio: true,
    tipo: "select",
    opciones: () => TIPOS_VIVIENDA,
  },
  {
    pantalla: "personales",
    seccion: "identificacion",
    id: "personasACargo",
    label: "Personas a cargo",
    origen: "A_CARGAR",
    obligatorio: true,
    tipo: "numero",
  },
  {
    pantalla: "personales",
    seccion: "identificacion",
    id: "tieneConyuge",
    label: "¿Tiene cónyuge?",
    origen: "A_CARGAR",
    obligatorio: true,
    tipo: "select",
    opciones: () => SI_NO,
  },
  {
    pantalla: "personales",
    seccion: "identificacion",
    id: "dniConyuge",
    label: "DNI del cónyuge",
    origen: "A_CARGAR",
    obligatorio: true,
    tipo: "dni",
    visibleSi: (v) => v.tieneConyuge === "Sí",
  },
  ...camposDomicilio("personales", "domicilio", "PRECARGADO"),
  {
    pantalla: "personales",
    seccion: "contacto",
    id: "telefono.pais",
    label: "Área (país)",
    origen: "PRECARGADO",
    obligatorio: true,
    tipo: "paisTelefono",
  },
  {
    pantalla: "personales",
    seccion: "contacto",
    id: "telefono.numero",
    label: "Teléfono",
    origen: "PRECARGADO",
    obligatorio: true,
    tipo: "telefono",
    paisId: "telefono.pais",
  },
  {
    pantalla: "personales",
    seccion: "contacto",
    id: "companiaTelefonica",
    label: "Compañía telefónica",
    origen: "PRECARGADO",
    obligatorio: true,
    tipo: "select",
    opciones: () => COMPANIAS_TELEFONICAS,
  },
  {
    pantalla: "personales",
    seccion: "contacto",
    id: "email",
    label: "Email",
    origen: "PRECARGADO",
    obligatorio: true,
    tipo: "email",
  },
  {
    pantalla: "personales",
    seccion: "contacto",
    id: "telefonoAlt.pais",
    label: "Área (país) alternativa",
    origen: "A_CARGAR",
    obligatorio: false,
    tipo: "paisTelefono",
  },
  {
    pantalla: "personales",
    seccion: "contacto",
    id: "telefonoAlt.numero",
    label: "Teléfono alternativo",
    origen: "A_CARGAR",
    obligatorio: false,
    tipo: "telefono",
    paisId: "telefonoAlt.pais",
  },
];

const LABORAL: CampoDef[] = [
  {
    pantalla: "laboral",
    seccion: "empleador",
    id: "fechaIngreso",
    label: "Fecha de ingreso laboral",
    origen: "NO_MODIFICABLE",
    obligatorio: true,
    tipo: "fecha",
    valorFijo: (app) => app.laboral.fechaInicioLaboral,
  },
  {
    pantalla: "laboral",
    seccion: "empleador",
    id: "situacionEmpleo",
    label: "Situación laboral / tipo de empleo",
    origen: "NO_MODIFICABLE",
    obligatorio: true,
    tipo: "texto",
    valorFijo: condicionLaboral,
  },
  { pantalla: "laboral", seccion: "empleador", id: "cuitEmpleador", label: "CUIT del empleador", origen: "A_CARGAR", obligatorio: true, tipo: "cuit" },
  { pantalla: "laboral", seccion: "empleador", id: "razonSocial", label: "Razón social", origen: "A_CARGAR", obligatorio: true, tipo: "texto" },
  {
    pantalla: "laboral",
    seccion: "empleador",
    id: "rubro",
    label: "Rubro de actividad",
    origen: "A_CARGAR",
    obligatorio: true,
    tipo: "select",
    opciones: () => RUBROS,
  },
  { pantalla: "laboral", seccion: "empleador", id: "numeroLegajo", label: "Número de legajo", origen: "A_CARGAR", obligatorio: true, tipo: "texto" },
  { pantalla: "laboral", seccion: "empleador", id: "cargo", label: "Cargo", origen: "A_CARGAR", obligatorio: true, tipo: "texto" },
  { pantalla: "laboral", seccion: "empleador", id: "reparticion", label: "Repartición", origen: "A_CARGAR", obligatorio: false, tipo: "texto" },
  ...camposDomicilio("laboral", "domicilioLaboral", "A_CARGAR"),
  {
    pantalla: "laboral",
    seccion: "telefonoLaboral",
    id: "telefonoLaboral.pais",
    label: "Área (país)",
    origen: "A_CARGAR",
    obligatorio: true,
    tipo: "paisTelefono",
  },
  {
    pantalla: "laboral",
    seccion: "telefonoLaboral",
    id: "telefonoLaboral.numero",
    label: "Teléfono laboral",
    origen: "A_CARGAR",
    obligatorio: true,
    tipo: "telefono",
    paisId: "telefonoLaboral.pais",
  },
  {
    pantalla: "laboral",
    seccion: "telefonoLaboral",
    id: "telefonoLaboral.interno",
    label: "Interno",
    origen: "A_CARGAR",
    obligatorio: false,
    tipo: "numero",
  },
  {
    pantalla: "laboral",
    seccion: "telefonoLaboral",
    id: "telefonoLaboral.horario",
    label: "Horario de contacto",
    origen: "A_CARGAR",
    obligatorio: false,
    tipo: "texto",
  },
  {
    pantalla: "laboral",
    seccion: "acreditacion",
    id: "banco",
    label: "Bancos",
    origen: "PRECARGADO",
    obligatorio: true,
    tipo: "multiselect",
    opciones: () => BANCOS,
    ancho: "completo",
  },
  { pantalla: "laboral", seccion: "acreditacion", id: "cbu", label: "CBU", origen: "A_CARGAR", obligatorio: true, tipo: "cbu", porBanco: true },
];

export const CAMPOS_POST_OFERTA: CampoDef[] = [...PERSONALES, ...LABORAL];

export function getCampo(id: string): CampoDef | undefined {
  return CAMPOS_POST_OFERTA.find((c) => c.id === id);
}

// Los bancos se guardan juntos en un solo valor, en el orden de Parámetros.
const SEPARADOR_BANCOS = "|";

export function bancosDe(valor: string | undefined): string[] {
  return valor ? valor.split(SEPARADOR_BANCOS).filter(Boolean) : [];
}

export function unirBancos(bancos: string[]): string {
  return BANCOS.filter((b) => bancos.includes(b)).join(SEPARADOR_BANCOS);
}

export const idCbu = (banco: string) => `cbu.${banco}`;

// Campos de una pantalla. Con los valores cargados, el CBU se expande en uno por banco elegido.
export function camposDe(
  pantalla: PantallaConCampos,
  seccion?: SeccionCampo,
  valores?: Valores
): CampoDef[] {
  return CAMPOS_POST_OFERTA.filter(
    (c) => c.pantalla === pantalla && (!seccion || c.seccion === seccion)
  ).flatMap((c) => {
    if (!c.porBanco) return [c];
    const bancos = bancosDe(valores?.banco);
    return bancos.map((b) => ({
      ...c,
      id: idCbu(b),
      label: bancos.length > 1 ? `${c.label} · ${b}` : c.label,
      plantilla: c.id,
    }));
  });
}

export function obligatorioEfectivo(
  campo: CampoDef,
  obligatorios: Partial<Record<string, boolean>>
): boolean {
  return obligatorios[campo.plantilla ?? campo.id] ?? campo.obligatorio;
}

export function valorCampo(app: CreditApplication, campo: CampoDef): string {
  if (campo.valorFijo) return campo.valorFijo(app);
  return app.postOferta[campo.pantalla][campo.id] ?? "";
}

// Un campo no se muestra ni se valida si el organismo lo quitó del formulario (excepción sobre
// el producto) o si su condición de visibilidad no se cumple.
export function campoVisible(app: CreditApplication, campo: CampoDef): boolean {
  const quitados = configEfectiva(app.configuracion).camposQuitados;
  if (quitados.includes(campo.plantilla ?? campo.id)) return false;
  return !campo.visibleSi || campo.visibleSi(app.postOferta[campo.pantalla]);
}

const MAX_DIGITOS: Partial<Record<TipoCampo, number>> = {
  dni: 8,
  cbu: 22,
  codigoPostal: 4,
  numero: 6,
};

// País (área) que aplica a un teléfono; sin elegir, el país por defecto.
export function paisDe(campo: CampoDef, valores: Valores): string {
  return (campo.paisId && valores[campo.paisId]) || PAIS_POR_DEFECTO;
}

// Deja sólo dígitos en los campos numéricos y corta en el largo máximo (en los teléfonos, el
// del país elegido).
export function sanitizar(campo: CampoDef, valor: string, valores: Valores): string {
  if (campo.tipo === "telefono") return sanitizarNumero(paisDe(campo, valores), valor);
  if (campo.tipo === "fecha") return maskFecha(valor);
  if (campo.tipo === "cuit") return maskCuit(valor);
  const max = MAX_DIGITOS[campo.tipo];
  return max ? onlyDigits(valor).slice(0, max) : valor;
}

export function validarCampo(
  campo: CampoDef,
  valor: string,
  obligatorio: boolean,
  valores: Valores = {}
): string | null {
  const v = valor.trim();
  if (!v) return obligatorio ? `Completá ${campo.label.toLowerCase()}.` : null;
  const d = onlyDigits(v);
  switch (campo.tipo) {
    case "email":
      return isValidEmail(v) ? null : "El formato del email no es válido. Ej.: nombre@dominio.com";
    case "dni":
      return d.length >= 7 && d.length <= 8 ? null : "El DNI debe tener 7 u 8 dígitos.";
    case "cuit":
      return d.length === 11 ? null : "El CUIT debe tener 11 dígitos.";
    case "cbu":
      return isValidCBU(v) ? null : "El CBU debe tener 22 dígitos.";
    case "telefono":
      return validarNumero(paisDe(campo, valores), v);
    case "codigoPostal":
      return d.length === 4 ? null : "El código postal tiene 4 dígitos.";
    case "numero":
      return /^\d+$/.test(v) ? null : "Ingresá sólo números.";
    case "fecha":
      return parseFecha(v) ? null : "La fecha debe tener el formato dd/mm/aaaa.";
    default:
      return null;
  }
}

export interface ErrorCampo {
  campo: CampoDef;
  error: string;
}

// Errores de los campos visibles y editables de una pantalla, con la obligatoriedad efectiva.
export function erroresPantalla(
  app: CreditApplication,
  pantalla: PantallaConCampos,
  obligatorios: Partial<Record<string, boolean>>
): ErrorCampo[] {
  return camposDe(pantalla, undefined, app.postOferta[pantalla])
    .filter((c) => c.origen !== "NO_MODIFICABLE" && campoVisible(app, c))
    .map((c) => ({
      campo: c,
      error: validarCampo(
        c,
        valorCampo(app, c),
        obligatorioEfectivo(c, obligatorios),
        app.postOferta[pantalla]
      ),
    }))
    .filter((x): x is ErrorCampo => x.error !== null);
}

export interface CampoRectificado {
  campo: CampoDef;
  original: string;
  actual: string;
}

// Precargados cuyo valor ya no coincide con el que se precargó (Onboarding §3: rectificable).
export function camposRectificados(app: CreditApplication): CampoRectificado[] {
  const precarga = app.postOferta.precarga;
  return CAMPOS_POST_OFERTA.filter((c) => c.origen === "PRECARGADO" && c.id in precarga)
    .map((c) => ({ campo: c, original: precarga[c.id], actual: valorCampo(app, c) }))
    .filter((r) => r.original !== r.actual);
}

export function esRectificado(app: CreditApplication, campo: CampoDef): boolean {
  const precarga = app.postOferta.precarga;
  return (
    campo.origen === "PRECARGADO" &&
    campo.id in precarga &&
    precarga[campo.id] !== valorCampo(app, campo)
  );
}

/**
 * Aplica un cambio con sus efectos sobre el domicilio (Onboarding §4): si la provincia ya no
 * corresponde a la localidad elegida se limpia la localidad; al elegir una localidad se
 * completa el código postal, que después se puede editar a mano.
 */
export function aplicarCambioCampo(valores: Valores, campoId: string, valor: string): Valores {
  const siguiente = { ...valores, [campoId]: valor };
  const [seccion, campo] = campoId.split(".");
  if (campo === "pais") {
    const numero = `${seccion}.numero`;
    if (siguiente[numero]) siguiente[numero] = sanitizarNumero(valor, siguiente[numero]);
  }
  if (campoId === "banco") {
    // Al sacar un banco se descarta el CBU que se había cargado para él.
    const elegidos = bancosDe(valor);
    for (const b of BANCOS) if (!elegidos.includes(b)) delete siguiente[idCbu(b)];
  }
  if (campo === "provincia") {
    const localidad = siguiente[`${seccion}.localidad`];
    if (localidad && getLocalidad(localidad)?.provincia !== valor) {
      siguiente[`${seccion}.localidad`] = "";
      siguiente[`${seccion}.codigoPostal`] = "";
    }
  }
  if (campo === "localidad") {
    const l = getLocalidad(valor);
    if (l) siguiente[`${seccion}.codigoPostal`] = l.codigoPostal;
  }
  return siguiente;
}
