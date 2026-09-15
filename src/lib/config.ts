// Configuración parametrizada (simula provenir del Módulo Créditos / Parámetros de CreditoNet).
// Producto (configuración general) → Organismo (sólo excepciones; lo que no define hereda del
// producto) → Plan de cuotas (condiciones financieras).
// Acá se define de forma fija para la demo, pero el objeto es real y maneja el flujo
// (stepper post-oferta, gates, cantidades, documentos, obligatoriedad de campos).

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
  {
    id: "credito-judicial",
    nombre: "Crédito judicial",
    detalle: "Adelanto sobre sentencia u honorarios con cesión de cobro.",
  },
];

// Arquitectura §3: el canal es el primer elemento del flujo y puede condicionar qué
// productos se ofrecen. No es el vendedor, que se toma de la sesión.
export const CANALES: OpcionCatalogo[] = [
  { id: "sucursal", nombre: "Sucursal", detalle: "Atención presencial en el punto de venta" },
  { id: "digital", nombre: "Canal digital", detalle: "Solicitud iniciada desde la web o la app" },
];

export const VENDEDORES: OpcionCatalogo[] = [
  { id: "juan-perez", nombre: "Juan Pérez", detalle: "Legajo V-118 · CreditoNet Casa Central" },
  { id: "ana-torres", nombre: "Ana Torres", detalle: "Legajo V-142 · CreditoNet Casa Central" },
  { id: "carlos-ruiz", nombre: "Carlos Ruiz", detalle: "Legajo V-097 · Sucursal Nueva Córdoba" },
];

// --- Plan de cuotas / Línea (§2.3) ---

export interface PlanCuotas {
  id: string;
  nombre: string;
  sistema: string;
  plazos: Plazo[];
  montoMaximo: number;
  // Tope habilitado cuando la operación renueva un crédito propio vigente.
  montoMaximoRenovacion: number;
  rciMaxPct: number;
  endeudamientoMaxPct: number;
  smvmBolsillo: number;
  renovacionMinCuotasPct: number;
  // Limitantes que habilitan la línea (reunión 11/09, 02:20 y 02:35). Si ninguna línea
  // del organismo acepta la combinación del cliente, la solicitud se rechaza sin motor.
  situacionesBcra: number[];
  situacionesInternas: number[];
  condicionesLaborales: string[];
  // Recortes porcentuales sobre el capital ya calculado (02:48). Si aplican varios,
  // manda el mayor. 0 significa que la condición no recorta nada.
  limitantes: {
    clienteNuevoPct: number;
    clienteExistentePct: number;
    condicionLaboralPct: Partial<Record<string, number>>;
    situacionBcraDistintaDeUnoPct: number;
  };
  // Parámetros del cálculo financiero (Plan de Cuotas §6). Valores de demo.
  periodoGraciaDias: number;
  ivaPct: number;
  sellosPct: number;
  cargoOtorgamientoPct: number;
}

export const PLANES_CUOTAS: Record<string, PlanCuotas> = {
  "linea-salud-2026": {
    id: "linea-salud-2026",
    nombre: "Línea Salud 2026",
    sistema: "Francés",
    plazos: [12, 18, 24, 36],
    montoMaximo: 2_500_000,
    montoMaximoRenovacion: 2_850_000,
    rciMaxPct: 40,
    endeudamientoMaxPct: 50,
    smvmBolsillo: 350_000,
    renovacionMinCuotasPct: 50,
    situacionesBcra: [1, 2],
    situacionesInternas: [1, 2],
    condicionesLaborales: ["Empleado fijo", "Contratado"],
    limitantes: {
      clienteNuevoPct: 50,
      clienteExistentePct: 0,
      condicionLaboralPct: { Contratado: 30 },
      situacionBcraDistintaDeUnoPct: 25,
    },
    periodoGraciaDias: 30,
    ivaPct: 21,
    sellosPct: 1.2,
    cargoOtorgamientoPct: 3,
  },
  "linea-seguridad-2026": {
    id: "linea-seguridad-2026",
    nombre: "Línea Fuerzas de Seguridad 2026",
    sistema: "Francés",
    plazos: [12, 24, 36],
    montoMaximo: 3_200_000,
    montoMaximoRenovacion: 3_600_000,
    rciMaxPct: 35,
    endeudamientoMaxPct: 45,
    smvmBolsillo: 400_000,
    renovacionMinCuotasPct: 50,
    situacionesBcra: [1, 2, 3],
    situacionesInternas: [1, 2],
    condicionesLaborales: ["Empleado fijo", "Contratado"],
    limitantes: {
      clienteNuevoPct: 40,
      clienteExistentePct: 0,
      condicionLaboralPct: { Contratado: 50 },
      situacionBcraDistintaDeUnoPct: 30,
    },
    periodoGraciaDias: 30,
    ivaPct: 21,
    sellosPct: 1.2,
    cargoOtorgamientoPct: 2.5,
  },
  "linea-pasivos-2026": {
    id: "linea-pasivos-2026",
    nombre: "Línea Pasivos 2026",
    sistema: "Francés",
    plazos: [12, 18, 24],
    montoMaximo: 1_600_000,
    montoMaximoRenovacion: 1_800_000,
    rciMaxPct: 30,
    endeudamientoMaxPct: 40,
    smvmBolsillo: 300_000,
    renovacionMinCuotasPct: 60,
    situacionesBcra: [1, 2],
    situacionesInternas: [1],
    condicionesLaborales: ["Jubilado / Pensionado"],
    limitantes: {
      clienteNuevoPct: 50,
      clienteExistentePct: 0,
      condicionLaboralPct: {},
      situacionBcraDistintaDeUnoPct: 40,
    },
    periodoGraciaDias: 45,
    ivaPct: 21,
    sellosPct: 1.2,
    cargoOtorgamientoPct: 3.5,
  },
};

// --- Onboarding post-oferta (Producto §7 bis · Onboarding §11) ---

export interface PantallaPostOfertaConfig {
  id: PantallaPostOfertaId;
  label: string;
  descripcion: string;
  orden: number;
  obligatoria: boolean;
  visible: boolean;
}

export interface CantidadConfig {
  minimo: number;
  maximo: number;
}

export interface DocumentoConfig {
  // Tipo de documento definido en Parámetros.
  tipoId: string;
  obligatorio: boolean;
  // Si el concepto admite una o varias imágenes.
  multiple: boolean;
}

export interface OnboardingConfig {
  pantallas: PantallaPostOfertaConfig[];
  // Pisa la obligatoriedad por defecto del catálogo de campos.
  camposObligatorios: Partial<Record<string, boolean>>;
  referencias: CantidadConfig;
  garantes: CantidadConfig;
  tokenizacion: { maximoTarjetas: number; proveedorId: string };
  documentos: DocumentoConfig[];
}

type CambiosPantalla = Partial<Record<PantallaPostOfertaId, { visible?: boolean; obligatoria?: boolean }>>;

// Onboarding §3: las 7 pantallas disponibles, en el orden de la documentación.
const PANTALLAS_BASE: PantallaPostOfertaConfig[] = [
  {
    id: "personales",
    label: "Datos personales",
    descripcion: "Identificación, domicilio particular y contacto.",
    orden: 1,
    obligatoria: true,
    visible: true,
  },
  {
    id: "laboral",
    label: "Datos laborales",
    descripcion: "Empleador, domicilio y teléfono laboral.",
    orden: 2,
    obligatoria: true,
    visible: true,
  },
  {
    id: "tokenizacion",
    label: "Tokenización de tarjetas",
    descripcion: "Una o varias tarjetas, por link de WhatsApp o carga presencial.",
    orden: 3,
    obligatoria: false,
    visible: true,
  },
  {
    id: "referencias",
    label: "Referencias personales",
    descripcion: "Una o varias referencias con DNI autocompletable.",
    orden: 4,
    obligatoria: true,
    visible: true,
  },
  {
    id: "garantias",
    label: "Garantías",
    descripcion: "Uno o varios garantes que firman el préstamo y el pagaré.",
    orden: 5,
    obligatoria: true,
    visible: true,
  },
  {
    id: "legajo",
    label: "Legajo virtual",
    descripcion: "Documentos definidos en Parámetros.",
    orden: 6,
    obligatoria: true,
    visible: true,
  },
  {
    id: "impresion",
    label: "Impresión de legajo",
    descripcion: "Imprimir o visualizar el PDF completo del legajo.",
    orden: 7,
    obligatoria: false,
    visible: true,
  },
];

function pantallas(cambios: CambiosPantalla = {}): PantallaPostOfertaConfig[] {
  return PANTALLAS_BASE.map((p) => ({ ...p, ...(cambios[p.id] ?? {}) }));
}

// --- Producto (entidad padre) ---

export interface ProductoConfig {
  id: string;
  nombre: string;
  permiteDeudaTerceros: boolean;
  // Premisa general del producto (Producto §4): tope de capital antes de aplicar
  // los límites del riesgo, del plan y del salario.
  capitalMaximo: number;
  // Canales en los que se ofrece el producto (Producto §3).
  canales: string[];
  onboarding: OnboardingConfig;
}

export const PRODUCTOS_CONFIG: Record<string, ProductoConfig> = {
  "prestamo-personal": {
    id: "prestamo-personal",
    nombre: "Préstamo personal",
    permiteDeudaTerceros: true,
    capitalMaximo: 4_000_000,
    canales: ["sucursal", "digital"],
    onboarding: {
      pantallas: pantallas(),
      camposObligatorios: {},
      referencias: { minimo: 1, maximo: 2 },
      garantes: { minimo: 1, maximo: 2 },
      tokenizacion: { maximoTarjetas: 2, proveedorId: "proveedor-a" },
      documentos: [
        { tipoId: "dni-frente", obligatorio: true, multiple: false },
        { tipoId: "dni-dorso", obligatorio: true, multiple: false },
        { tipoId: "recibo-sueldo", obligatorio: true, multiple: true },
        { tipoId: "comprobante-servicio", obligatorio: true, multiple: false },
        { tipoId: "otros", obligatorio: false, multiple: true },
      ],
    },
  },
  "credito-judicial": {
    id: "credito-judicial",
    nombre: "Crédito judicial",
    permiteDeudaTerceros: false,
    capitalMaximo: 6_000_000,
    // Requiere presentar la sentencia y firmar la cesión de cobro en persona.
    canales: ["sucursal"],
    onboarding: {
      pantallas: pantallas({
        tokenizacion: { visible: false },
        garantias: { visible: false, obligatoria: false },
      }),
      camposObligatorios: {},
      referencias: { minimo: 1, maximo: 2 },
      garantes: { minimo: 0, maximo: 0 },
      tokenizacion: { maximoTarjetas: 1, proveedorId: "proveedor-b" },
      documentos: [
        { tipoId: "dni-frente", obligatorio: true, multiple: false },
        { tipoId: "dni-dorso", obligatorio: true, multiple: false },
        { tipoId: "sentencia", obligatorio: true, multiple: true },
        { tipoId: "comprobante-servicio", obligatorio: true, multiple: false },
      ],
    },
  },
};

// --- Organismo (excepciones sobre el producto) ---

export interface OrganismoConfig extends OpcionCatalogo {
  planId: string;
  // Condición laboral del colectivo: participa en la selección del motor (Motor §9).
  condicionLaboral: string;
  // Sólo se definen las excepciones explícitas. Lo que no está, hereda del producto
  // (Organismo §4 bis).
  overrides: {
    permiteDeudaTerceros?: boolean;
    capitalMaximo?: number;
    pantallas?: CambiosPantalla;
    camposObligatorios?: Partial<Record<string, boolean>>;
    referencias?: Partial<CantidadConfig>;
    garantes?: Partial<CantidadConfig>;
    tokenizacion?: Partial<OnboardingConfig["tokenizacion"]>;
    // Documentación propia del organismo: reemplaza la lista del producto.
    documentos?: DocumentoConfig[];
  };
}

export const ORGANISMOS: OrganismoConfig[] = [
  {
    id: "empleados-salud",
    nombre: "Empleados de salud",
    detalle: "Sector salud · Convenio provincial",
    condicionLaboral: "Empleado en relación de dependencia",
    planId: "linea-salud-2026",
    overrides: {},
  },
  {
    id: "policia-provincial",
    nombre: "Policía de la Provincia",
    detalle: "Fuerzas de seguridad · Descuento por haberes",
    condicionLaboral: "Personal de fuerzas de seguridad",
    planId: "linea-seguridad-2026",
    overrides: {
      pantallas: {
        referencias: { obligatoria: false },
        garantias: { visible: false, obligatoria: false },
      },
      // La repartición identifica la dependencia policial del cliente.
      camposObligatorios: { reparticion: true },
    },
  },
  {
    id: "jubilados-provincial",
    nombre: "Jubilados y pensionados",
    detalle: "Caja de jubilaciones · Haber previsional",
    condicionLaboral: "Pasivo / haber previsional",
    planId: "linea-pasivos-2026",
    overrides: {
      permiteDeudaTerceros: false,
      capitalMaximo: 2_000_000,
      pantallas: {
        tokenizacion: { obligatoria: true },
      },
      tokenizacion: { maximoTarjetas: 1 },
      // Un pasivo no tiene cargo ni legajo de empleado.
      camposObligatorios: { cargo: false, numeroLegajo: false },
      documentos: [
        { tipoId: "dni-frente", obligatorio: true, multiple: false },
        { tipoId: "dni-dorso", obligatorio: true, multiple: false },
        { tipoId: "recibo-haberes", obligatorio: true, multiple: false },
        { tipoId: "comprobante-servicio", obligatorio: true, multiple: false },
      ],
    },
  },
];

// --- Resolución de configuración efectiva ---

type Seleccion = { productoId: string; organismoId: string };

export function getProductoConfig(productoId: string): ProductoConfig {
  return PRODUCTOS_CONFIG[productoId] ?? PRODUCTOS_CONFIG["prestamo-personal"];
}

export function productoHabilitadoEnCanal(productoId: string, canalId: string): boolean {
  return getProductoConfig(productoId).canales.includes(canalId);
}

export function primerProductoDelCanal(canalId: string): string {
  return PRODUCTOS.find((p) => productoHabilitadoEnCanal(p.id, canalId))?.id ?? PRODUCTOS[0].id;
}

export function getOrganismo(organismoId: string): OrganismoConfig {
  return ORGANISMOS.find((o) => o.id === organismoId) ?? ORGANISMOS[0];
}

export function getPlan(organismoId: string): PlanCuotas {
  return PLANES_CUOTAS[getOrganismo(organismoId).planId] ?? PLANES_CUOTAS["linea-salud-2026"];
}

// Condición del cliente que habilita (o no) una línea.
export interface ContextoLinea {
  situacionBcra: number;
  situacionInterna: number;
  condicionLaboral: string;
}

export interface ResultadoLinea {
  plan: PlanCuotas | null;
  // Qué limitante dejó afuera al plan, para poder explicar el rechazo.
  motivo: string | null;
}

/**
 * Busca la línea aplicable dentro del organismo (reunión 11/09, 02:28–02:35).
 *
 * Se corre DESPUÉS del motor y ANTES del cálculo. Si ninguna línea acepta la combinación
 * situación BCRA + buró interno + condición laboral, la solicitud se rechaza: es un rechazo
 * que no pertenece al motor y que no llega al analista.
 */
export function seleccionarLinea(organismoId: string, ctx: ContextoLinea): ResultadoLinea {
  const plan = getPlan(organismoId);
  if (!plan.situacionesBcra.includes(ctx.situacionBcra))
    return {
      plan: null,
      motivo: `${plan.nombre} no opera con situación BCRA ${ctx.situacionBcra}`,
    };
  if (!plan.situacionesInternas.includes(ctx.situacionInterna))
    return {
      plan: null,
      motivo: `${plan.nombre} no opera con situación de buró interno ${ctx.situacionInterna}`,
    };
  if (!plan.condicionesLaborales.includes(ctx.condicionLaboral))
    return {
      plan: null,
      motivo: ctx.condicionLaboral
        ? `${plan.nombre} no admite la condición laboral “${ctx.condicionLaboral}”`
        : `${plan.nombre} requiere una condición laboral declarada`,
    };
  return { plan, motivo: null };
}

export function configEfectiva({ productoId, organismoId }: Seleccion) {
  const producto = getProductoConfig(productoId);
  const organismo = getOrganismo(organismoId);
  const o = organismo.overrides;
  const base = producto.onboarding;
  const pantallasEfectivas = base.pantallas.map((p) => ({
    ...p,
    ...(o.pantallas?.[p.id] ?? {}),
  }));
  const cantidadExcepciones =
    (o.permiteDeudaTerceros !== undefined ? 1 : 0) +
    (o.capitalMaximo !== undefined ? 1 : 0) +
    Object.keys(o.pantallas ?? {}).length +
    Object.keys(o.camposObligatorios ?? {}).length +
    (o.referencias ? 1 : 0) +
    (o.garantes ? 1 : 0) +
    (o.tokenizacion ? 1 : 0) +
    (o.documentos ? 1 : 0);
  return {
    producto,
    organismo,
    plan: getPlan(organismoId),
    permiteDeudaTerceros: o.permiteDeudaTerceros ?? producto.permiteDeudaTerceros,
    capitalMaximo: o.capitalMaximo ?? producto.capitalMaximo,
    pantallas: pantallasEfectivas,
    camposObligatorios: { ...base.camposObligatorios, ...(o.camposObligatorios ?? {}) },
    referencias: { ...base.referencias, ...(o.referencias ?? {}) },
    garantes: { ...base.garantes, ...(o.garantes ?? {}) },
    tokenizacion: { ...base.tokenizacion, ...(o.tokenizacion ?? {}) },
    documentos: o.documentos ?? base.documentos,
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
