// Impuestos por provincia: alícuota de sellado (%). El IVA es nacional: está en Parámetros › Impositivos.
//
// Es un parámetro editable (alta, edición y baja desde /parametros). El estado vive acá y se
// persiste en la sesión. Los valores iniciales son de ejemplo: la definitiva la carga el negocio.

import { crearStoreAbm } from "./store-abm";

export interface ProvinciaImpuestos {
  id: string;
  provincia: string;
  sellado: number;
}

// Las 24 jurisdicciones, en el orden en que se ofrecen en el selector.
export const PROVINCIAS_ARGENTINA = [
  "Buenos Aires",
  "CABA",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

// Sellado de ejemplo por provincia (%).
const SELLADO_INICIAL: Record<string, number> = {
  "Buenos Aires": 1.2,
  CABA: 1,
  Catamarca: 1,
  Chaco: 1.2,
  Chubut: 1,
  Córdoba: 1.2,
  Corrientes: 1,
  "Entre Ríos": 1.5,
  Formosa: 1,
  Jujuy: 1,
  "La Pampa": 1,
  "La Rioja": 1,
  Mendoza: 1.5,
  Misiones: 1,
  Neuquén: 1,
  "Río Negro": 1,
  Salta: 1,
  "San Juan": 1,
  "San Luis": 1,
  "Santa Cruz": 1,
  "Santa Fe": 1.2,
  "Santiago del Estero": 1,
  "Tierra del Fuego": 1,
  Tucumán: 1.2,
};

const store = crearStoreAbm<ProvinciaImpuestos>({
  clave: "creditonet.provincias-impuestos.v1",
  inicial: PROVINCIAS_ARGENTINA.map((provincia, i) => ({
    id: `pi-${i + 1}`,
    provincia,
    sellado: SELLADO_INICIAL[provincia] ?? 1,
  })),
  valido: (r) =>
    typeof r?.id === "string" &&
    typeof r?.provincia === "string" &&
    typeof r?.sellado === "number",
  aplicar: () => {},
});

export const useProvinciasImpuestos = store.useLista;
export const hidratarProvinciasImpuestos = store.hidratar;

export function getImpuestosProvincia(provincia: string): ProvinciaImpuestos | undefined {
  return store.get().find((p) => p.provincia === provincia);
}

// Provincias que todavía no tienen valores cargados (las que ofrece el selector del alta).
export function provinciasSinCargar(): string[] {
  const cargadas = new Set(store.get().map((p) => p.provincia));
  return PROVINCIAS_ARGENTINA.filter((p) => !cargadas.has(p));
}

// Acepta "21", "1,5" o "1.5". Devuelve null si no es un porcentaje entre 0 y 100.
export function parsearPorcentaje(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  if (!t || !/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return n <= 100 ? n : null;
}

export function errorPorcentaje(texto: string, nombre: string): string | undefined {
  return parsearPorcentaje(texto) === null
    ? `Ingresá ${nombre} como un porcentaje entre 0 y 100.`
    : undefined;
}

export function crearProvinciasImpuestos(provincias: string[], sellado: number) {
  const actuales = store.get();
  const usados = actuales.map((p) => Number(p.id.replace("pi-", "")) || 0);
  let n = Math.max(0, ...usados);
  const nuevas = PROVINCIAS_ARGENTINA.filter((p) => provincias.includes(p)).map((provincia) => ({
    id: `pi-${++n}`,
    provincia,
    sellado,
  }));
  store.commit([...actuales, ...nuevas]);
}

export function editarProvinciaImpuestos(id: string, sellado: number) {
  store.commit(store.get().map((p) => (p.id === id ? { ...p, sellado } : p)));
}

export function eliminarProvinciaImpuestos(id: string) {
  store.commit(store.get().filter((p) => p.id !== id));
}
