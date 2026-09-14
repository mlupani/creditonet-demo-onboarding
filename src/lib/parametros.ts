// Catálogos del Módulo Parámetros que consume el onboarding (Onboarding v4 §14).
// En la demo son datos fijos: no hay una pantalla para administrarlos.

export const GENEROS = ["Femenino", "Masculino", "No binario"];

export const ESTADOS_CIVILES = [
  "Casada/o",
  "Soltera/o",
  "Divorciada/o",
  "Viuda/o",
  "Unión convivencial",
];

export const TIPOS_VIVIENDA = ["Propietario", "Inquilino", "Prestado por familiar/amigo"];

export const PROVINCIAS = ["Buenos Aires", "CABA", "Córdoba", "Mendoza", "Santa Fe", "Tucumán"];

export interface Localidad {
  nombre: string;
  provincia: string;
  codigoPostal: string;
}

export const LOCALIDADES: Localidad[] = [
  { nombre: "Córdoba", provincia: "Córdoba", codigoPostal: "5000" },
  { nombre: "Villa Carlos Paz", provincia: "Córdoba", codigoPostal: "5152" },
  { nombre: "Río Cuarto", provincia: "Córdoba", codigoPostal: "5800" },
  { nombre: "Villa María", provincia: "Córdoba", codigoPostal: "5900" },
  { nombre: "La Plata", provincia: "Buenos Aires", codigoPostal: "1900" },
  { nombre: "Mar del Plata", provincia: "Buenos Aires", codigoPostal: "7600" },
  { nombre: "Ciudad Autónoma de Buenos Aires", provincia: "CABA", codigoPostal: "1000" },
  { nombre: "Rosario", provincia: "Santa Fe", codigoPostal: "2000" },
  { nombre: "Santa Fe", provincia: "Santa Fe", codigoPostal: "3000" },
  { nombre: "Mendoza", provincia: "Mendoza", codigoPostal: "5500" },
  { nombre: "San Miguel de Tucumán", provincia: "Tucumán", codigoPostal: "4000" },
];

export function localidadesDe(provincia: string): Localidad[] {
  return LOCALIDADES.filter((l) => l.provincia === provincia);
}

export function getLocalidad(nombre: string): Localidad | undefined {
  return LOCALIDADES.find((l) => l.nombre === nombre);
}

export const VINCULOS_REFERENCIA = [
  "Familiar directo",
  "Amigo",
  "Compañero de trabajo",
  "Vecino",
  "Otro",
];

export const VINCULOS_GARANTE = [
  "Cónyuge",
  "Familiar directo",
  "Amigo",
  "Compañero de trabajo",
  "Otro",
];

export interface TipoDocumento {
  id: string;
  nombre: string;
  categoria: string;
}

export const TIPOS_DOCUMENTO: TipoDocumento[] = [
  { id: "dni-frente", nombre: "DNI frente", categoria: "Identidad" },
  { id: "dni-dorso", nombre: "DNI dorso", categoria: "Identidad" },
  { id: "recibo-sueldo", nombre: "Recibo de sueldo", categoria: "Ingresos" },
  { id: "recibo-haberes", nombre: "Recibo de haberes", categoria: "Ingresos" },
  { id: "sentencia", nombre: "Sentencia u honorarios regulados", categoria: "Judicial" },
  { id: "comprobante-servicio", nombre: "Comprobante de servicio", categoria: "Domicilio" },
  { id: "otros", nombre: "Otros", categoria: "Otros" },
];

export function getTipoDocumento(id: string): TipoDocumento {
  return TIPOS_DOCUMENTO.find((t) => t.id === id) ?? { id, nombre: id, categoria: "Otros" };
}

export const RUBROS = [
  "Salud - Servicios sanatoriales",
  "Salud - Atención primaria",
  "Administración pública",
  "Seguridad",
  "Comercio",
  "Industria",
  "Educación",
];

export const COMPANIAS_TELEFONICAS = ["Claro", "Movistar", "Personal", "Otra"];

export const BANCOS = [
  "Banco Galicia",
  "Banco Nación",
  "Banco de Córdoba",
  "Banco Macro",
  "Banco Santander",
  "Banco BBVA",
];

export const MARCAS_TARJETA = ["Visa", "Mastercard", "American Express", "Cabal"];

export const PROVEEDORES_TOKENIZACION = [
  { id: "proveedor-a", nombre: "Proveedor de tokenización A" },
  { id: "proveedor-b", nombre: "Proveedor de tokenización B" },
];

export function nombreProveedor(id: string): string {
  return PROVEEDORES_TOKENIZACION.find((p) => p.id === id)?.nombre ?? id;
}
