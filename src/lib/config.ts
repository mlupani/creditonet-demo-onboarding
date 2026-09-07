// Configuración parametrizada (simula provenir del módulo Parámetros de CreditoNet).
// En el sistema real, el ABM de productos, organismos, canales y planes vive en
// Parámetros. Acá se define de forma fija para la demo, pero el objeto es real y
// maneja el flujo (stepper post-oferta, gates, visibilidad de secciones).

import type { CampoAdicionalLaboral, PantallaPostOfertaId } from "./types";

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

export const ORGANISMOS: OpcionCatalogo[] = [
  {
    id: "empleados-salud",
    nombre: "Empleados de salud",
    detalle: "Sector salud · Convenio provincial",
  },
];

export const CANALES: OpcionCatalogo[] = [
  { id: "venta-directa", nombre: "Venta directa", detalle: "Vendedor en punto de atención" },
];

export const VENDEDORES: OpcionCatalogo[] = [
  { id: "juan-perez", nombre: "Juan Pérez", detalle: "Legajo V-118 · CreditoNet Casa Central" },
];

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
  camposAdicionalesObligatorios: CampoAdicionalLaboral[];
  pantallasPostOferta: PantallaPostOfertaConfig[];
}

export const PRODUCTOS_CONFIG: Record<string, ProductoConfig> = {
  "prestamo-personal": {
    id: "prestamo-personal",
    nombre: "Préstamo personal",
    permiteDeudaTerceros: true,
    requiereGarante: true,
    camposAdicionalesObligatorios: ["email", "cuitEmpleador"],
    pantallasPostOferta: [
      {
        id: "laboral",
        label: "Datos laborales",
        descripcion: "Domicilio, empleador y datos de acreditación.",
        orden: 1,
        obligatoria: true,
        visible: true,
      },
      {
        id: "personales",
        label: "Datos personales",
        descripcion: "Contacto, domicilio y situación personal.",
        orden: 2,
        obligatoria: true,
        visible: true,
      },
      {
        id: "tokenizacion",
        label: "Tokenización de tarjeta",
        descripcion: "Medio de pago tokenizado por el proveedor configurado.",
        orden: 3,
        obligatoria: false,
        visible: true,
      },
      {
        id: "referencias",
        label: "Referencias personales",
        descripcion: "Entre 1 y 2 personas de contacto.",
        orden: 4,
        obligatoria: true,
        visible: true,
      },
      {
        id: "garantias",
        label: "Garantías",
        descripcion: "Datos y documentación del garante.",
        orden: 5,
        obligatoria: true,
        visible: true,
      },
      {
        id: "legajo",
        label: "Legajo virtual",
        descripcion: "Documentación respaldatoria de la solicitud.",
        orden: 6,
        obligatoria: true,
        visible: true,
      },
      {
        id: "impresion",
        label: "Impresión de legajo",
        descripcion: "Generación del legajo para firma.",
        orden: 7,
        obligatoria: false,
        visible: true,
      },
    ],
  },
};

export function getProductoConfig(productoId: string): ProductoConfig {
  return PRODUCTOS_CONFIG[productoId] ?? PRODUCTOS_CONFIG["prestamo-personal"];
}

export function pantallasVisibles(productoId: string): PantallaPostOfertaConfig[] {
  return getProductoConfig(productoId)
    .pantallasPostOferta.filter((p) => p.visible)
    .sort((a, b) => a.orden - b.orden);
}

export function resumenConfigProducto(productoId: string) {
  const visibles = pantallasVisibles(productoId);
  const obligatorias = visibles.filter((p) => p.obligatoria).length;
  return {
    nombre: getProductoConfig(productoId).nombre,
    total: visibles.length,
    obligatorias,
    opcionales: visibles.length - obligatorias,
  };
}

export function nombreOpcion(catalogo: OpcionCatalogo[], id: string): string {
  return catalogo.find((o) => o.id === id)?.nombre ?? "—";
}

// Datos de la sesión (vendedor logueado).
export const SESION = {
  vendedorId: "juan-perez",
  nombre: "Juan Pérez",
  iniciales: "JP",
  rol: "Vendedor",
  organizacion: "CreditoNet · Casa Central",
};
