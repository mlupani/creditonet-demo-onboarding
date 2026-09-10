// Configuración parametrizada (simula provenir del módulo Parámetros de CreditoNet).
// Jerarquía de la Guía Definitiva §2: Producto (reglas globales) → Organismo (sólo
// excepciones; lo nulo hereda del producto) → Plan de cuotas (condiciones financieras).
// Acá se define de forma fija para la demo, pero el objeto es real y maneja el flujo
// (stepper post-oferta, gates, visibilidad de secciones).

import type { PantallaPostOfertaId, Plazo } from "./types";

export interface OpcionCatalogo {
  id: string;
  nombre: string;
  detalle?: string;
}

export const PRODUCTOS: OpcionCatalogo[] = [
  {
    id: "prestamo-personal",
    nombre: "Préstamo personal",
    detalle: "Crédito en efectivo con descuento por haberes o débito automático.",
  },
];

export const CANALES: OpcionCatalogo[] = [
  { id: "venta-directa", nombre: "Venta directa", detalle: "Vendedor en punto de atención" },
];

export const VENDEDORES: OpcionCatalogo[] = [
  { id: "juan-perez", nombre: "Juan Pérez", detalle: "Legajo V-118 · CreditoNet Casa Central" },
];

// --- Plan de cuotas / Línea (§2.3) ---

export interface PlanCuotas {
  id: string;
  nombre: string;
  sistema: string;
  plazos: Plazo[];
  montoMaximo: number;
  rciMaxPct: number;
  endeudamientoMaxPct: number;
  smvmBolsillo: number;
  renovacionMinCuotasPct: number;
}

export const PLANES_CUOTAS: Record<string, PlanCuotas> = {
  "linea-salud-2026": {
    id: "linea-salud-2026",
    nombre: "Línea Salud 2026",
    sistema: "Francés",
    plazos: [12, 18, 24, 36],
    montoMaximo: 2_500_000,
    rciMaxPct: 40,
    endeudamientoMaxPct: 50,
    smvmBolsillo: 350_000,
    renovacionMinCuotasPct: 50,
  },
};

// --- Producto (entidad padre) ---

export interface PantallaPostOfertaConfig {
  id: PantallaPostOfertaId;
  label: string;
  descripcion: string;
  orden: number;
  obligatoria: boolean;
  visible: boolean;
}

export interface ProductoConfig {
  id: string;
  nombre: string;
  permiteDeudaTerceros: boolean;
  requiereGarante: boolean;
  pantallasPostOferta: PantallaPostOfertaConfig[];
}

export const PRODUCTOS_CONFIG: Record<string, ProductoConfig> = {
  "prestamo-personal": {
    id: "prestamo-personal",
    nombre: "Préstamo personal",
    permiteDeudaTerceros: true,
    requiereGarante: true,
    pantallasPostOferta: [
      {
        id: "laboral",
        label: "Datos laborales",
        descripcion: "Legajo, domicilio laboral, teléfono, fecha de ingreso y rubro.",
        orden: 1,
        obligatoria: true,
        visible: true,
      },
      {
        id: "personales",
        label: "Datos personales",
        descripcion: "Email, teléfono celular y domicilio real.",
        orden: 2,
        obligatoria: true,
        visible: true,
      },
      {
        id: "tokenizacion",
        label: "Tokenización de tarjeta",
        descripcion: "Tarjeta de débito o crédito para cobro automático.",
        orden: 3,
        obligatoria: false,
        visible: true,
      },
      {
        id: "referencias",
        label: "Referencias personales",
        descripcion: "Contactos de verificación (entre 1 y 2).",
        orden: 4,
        obligatoria: true,
        visible: true,
      },
      {
        id: "garantias",
        label: "Garantías",
        descripcion: "Fiadores o garantías si el producto lo requiere.",
        orden: 5,
        obligatoria: true,
        visible: true,
      },
      {
        id: "legajo",
        label: "Legajo virtual",
        descripcion: "Documentación digitalizada: DNI, recibo de sueldo y servicio.",
        orden: 6,
        obligatoria: true,
        visible: true,
      },
      {
        id: "impresion",
        label: "Impresión de legajo",
        descripcion: "Documento unificado para lectura y firma del cliente.",
        orden: 7,
        obligatoria: false,
        visible: true,
      },
    ],
  },
};

// --- Organismo (excepciones sobre el producto) ---

export interface OrganismoConfig extends OpcionCatalogo {
  planId: string;
  // Sólo se definen las excepciones explícitas. Lo que no está, hereda del producto.
  overrides: {
    permiteDeudaTerceros?: boolean;
    requiereGarante?: boolean;
    pantallas?: Partial<Record<PantallaPostOfertaId, { visible?: boolean; obligatoria?: boolean }>>;
  };
}

export const ORGANISMOS: OrganismoConfig[] = [
  {
    id: "empleados-salud",
    nombre: "Empleados de salud",
    detalle: "Sector salud · Convenio provincial",
    planId: "linea-salud-2026",
    overrides: {},
  },
];

// --- Resolución de configuración efectiva ---

type Seleccion = { productoId: string; organismoId: string };

export function getProductoConfig(productoId: string): ProductoConfig {
  return PRODUCTOS_CONFIG[productoId] ?? PRODUCTOS_CONFIG["prestamo-personal"];
}

export function getOrganismo(organismoId: string): OrganismoConfig {
  return ORGANISMOS.find((o) => o.id === organismoId) ?? ORGANISMOS[0];
}

export function getPlan(organismoId: string): PlanCuotas {
  return PLANES_CUOTAS[getOrganismo(organismoId).planId] ?? PLANES_CUOTAS["linea-salud-2026"];
}

export function configEfectiva({ productoId, organismoId }: Seleccion) {
  const producto = getProductoConfig(productoId);
  const organismo = getOrganismo(organismoId);
  const o = organismo.overrides;
  const pantallas = producto.pantallasPostOferta.map((p) => ({
    ...p,
    ...(o.pantallas?.[p.id] ?? {}),
  }));
  const cantidadExcepciones =
    (o.permiteDeudaTerceros !== undefined ? 1 : 0) +
    (o.requiereGarante !== undefined ? 1 : 0) +
    Object.keys(o.pantallas ?? {}).length;
  return {
    producto,
    organismo,
    plan: getPlan(organismoId),
    permiteDeudaTerceros: o.permiteDeudaTerceros ?? producto.permiteDeudaTerceros,
    requiereGarante: o.requiereGarante ?? producto.requiereGarante,
    pantallas,
    cantidadExcepciones,
  };
}

export function pantallasVisibles(sel: Seleccion): PantallaPostOfertaConfig[] {
  return configEfectiva(sel)
    .pantallas.filter((p) => p.visible)
    .sort((a, b) => a.orden - b.orden);
}

export function resumenConfig(sel: Seleccion) {
  const cfg = configEfectiva(sel);
  const visibles = pantallasVisibles(sel);
  const obligatorias = visibles.filter((p) => p.obligatoria).length;
  return {
    producto: cfg.producto.nombre,
    organismo: cfg.organismo.nombre,
    herencia:
      cfg.cantidadExcepciones === 0
        ? "Hereda 100 % del producto"
        : `${cfg.cantidadExcepciones} excepción${cfg.cantidadExcepciones === 1 ? "" : "es"} del organismo`,
    total: visibles.length,
    obligatorias,
    opcionales: visibles.length - obligatorias,
  };
}

export function nombreOpcion(catalogo: OpcionCatalogo[], id: string): string {
  return catalogo.find((o) => o.id === id)?.nombre ?? "—";
}

// Usuarios de la sesión según la bandeja (roles de la Guía Definitiva §1).
export const SESION = {
  vendedorId: "juan-perez",
  nombre: "Juan Pérez",
  iniciales: "JP",
  rol: "Canal de venta",
  organizacion: "CreditoNet · Casa Central",
};

export const SESION_ANALISTA = {
  nombre: "Lucía Martínez",
  iniciales: "LM",
  rol: "Analista de riesgo",
  organizacion: "CreditoNet · Análisis de riesgo",
};
