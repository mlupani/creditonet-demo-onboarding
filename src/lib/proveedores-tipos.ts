// Módulo Caja y Bancos (v2, Función 6: Proveedores). Tipos y catálogos fijos. Todo vive en el front:
// los datos de ejemplo salen de proveedores-datos.ts y el estado se persiste en la sesión
// (proveedores-store.ts).

import type { EstadoAbm } from "./caja-tipos";

export type CondicionIva =
  | "RESPONSABLE_INSCRIPTO"
  | "MONOTRIBUTISTA"
  | "EXENTO"
  | "CONSUMIDOR_FINAL";
export const CONDICION_IVA_LABEL: Record<CondicionIva, string> = {
  RESPONSABLE_INSCRIPTO: "Responsable inscripto",
  MONOTRIBUTISTA: "Monotributista",
  EXENTO: "Exento",
  CONSUMIDOR_FINAL: "Consumidor final",
};

// ABM de Proveedores (v2, 7.11).
export interface Proveedor {
  id: string;
  cuit: string; // 11 dígitos, sin guiones
  razonSocial: string;
  fantasia: string;
  domicilio: string;
  provincia: string;
  codigoPostal: string;
  tipoComprobanteId: string; // habitual: se propone por defecto en la carga
  condicionIva: CondicionIva;
  iibb: string;
  cbu: string;
  telefono: string;
  mail: string;
  cuentaPasivo: string; // ej.: Facturas a pagar
  cuentaPerdida: string; // ej.: Gastos de oficina (imputación)
  estado: EstadoAbm;
  fechaAlta: string;
  usuarioAlta: string;
}

// ABM de Tipos de comprobante (v2, 7.12). `efecto` indica cómo impacta en la cuenta corriente:
// facturas y notas de débito suman deuda; las notas de crédito la descuentan.
export type EfectoComprobante = "SUMA" | "RESTA";
export interface TipoComprobante {
  id: string;
  descripcion: string;
  efecto: EfectoComprobante;
  estado: EstadoAbm;
  fechaAlta: string;
  usuarioAlta: string;
}

// Estados del comprobante (v2, 7.13). Los fija el sistema: se muestran como referencia.
export type EstadoComprobanteId =
  | "PREAPROBADO"
  | "PARA_LIQUIDAR"
  | "RECHAZADO"
  | "PAGO_PARCIAL"
  | "PAGADO"
  | "ANULADO";
export const ESTADOS_COMPROBANTE: { id: EstadoComprobanteId; label: string; significado: string; propuesto?: boolean }[] = [
  { id: "PREAPROBADO", label: "Preaprobado", significado: "Cargado, espera autorización" },
  { id: "PARA_LIQUIDAR", label: "Para liquidar", significado: "Autorizado; tiene número de orden de pago" },
  { id: "RECHAZADO", label: "Rechazado", significado: "No autorizado; vuelve al operador" },
  { id: "PAGO_PARCIAL", label: "Pago parcial", significado: "Propuesto", propuesto: true },
  { id: "PAGADO", label: "Pagado", significado: "Propuesto", propuesto: true },
  { id: "ANULADO", label: "Anulado", significado: "Propuesto", propuesto: true },
];
export const ESTADO_COMPROBANTE_LABEL = Object.fromEntries(
  ESTADOS_COMPROBANTE.map((e) => [e.id, e.label])
) as Record<EstadoComprobanteId, string>;

export type AlicuotaIva = "10.5" | "21" | "27";
export const ALICUOTAS_IVA: AlicuotaIva[] = ["10.5", "21", "27"];

export interface GravadoIva {
  base: number;
  iva: number;
}

export interface DecisionComprobante {
  usuarioId: string;
  fechaHora: string;
  motivo?: string;
}

// Comprobante de proveedor (v2, 6.1). No se cargan cuentas contables (salen del proveedor) ni fecha
// contable (es la fecha de pago).
export interface Comprobante {
  id: string; // CMP-0001
  proveedorId: string;
  tipoId: string;
  fechaComprobante: string; // fecha real de emisión
  prefijo: string; // punto de venta
  numero: string;
  noGravado: number;
  exento: number;
  subtotalGravado: number;
  gravados: Record<AlicuotaIva, GravadoIva>;
  percepcionIva: number;
  percepcionesIibb: number[]; // hasta 3
  percepcionesMunicipales: number[]; // hasta 2
  total: number;
  observaciones: string;
  respaldo?: string; // nombre del archivo, QR leído o foto vinculada
  estado: EstadoComprobanteId;
  cargadoPor: string; // id de usuario
  fechaCarga: string;
  loteId?: string;
  autorizacion?: DecisionComprobante; // quien autorizó (distinto del que cargó)
  rechazo?: DecisionComprobante;
  anulacion?: DecisionComprobante;
  ordenPago?: string; // se asigna al autorizar (OP-0001)
}

// Pago aplicado a un comprobante a través de su orden de pago (v2, 6.3 y 6.4).
export type MedioPago = "TRANSFERENCIA" | "EFECTIVO" | "CHEQUE";
export const MEDIO_PAGO_LABEL: Record<MedioPago, string> = {
  TRANSFERENCIA: "Transferencia",
  EFECTIVO: "Efectivo",
  CHEQUE: "Cheque",
};
export interface PagoProveedor {
  id: string; // PAG-0001
  ordenPago: string;
  comprobanteId: string;
  proveedorId: string;
  fecha: string; // fecha de pago = fecha contable
  medio: MedioPago;
  origenTipo: "CAJA" | "BANCO";
  origenId: string; // id de caja o de cuenta bancaria
  importe: number;
  usuarioId: string;
  asiento: string; // número de asiento contable simulado
}

// Lote de carga masiva por Excel: queda registrado quién lo subió, cuándo y qué se aceptó.
export interface LoteComprobantes {
  id: string; // LOT-0001
  proveedorId: string;
  archivo: string;
  usuarioId: string;
  fechaHora: string;
  aceptadas: number;
  rechazadas: number;
}
