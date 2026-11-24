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
  | "EN_ORDEN_PAGO"
  | "RECHAZADO"
  | "PAGO_PARCIAL"
  | "PAGADO"
  | "ANULADO";
export const ESTADOS_COMPROBANTE: { id: EstadoComprobanteId; label: string; significado: string; propuesto?: boolean }[] = [
  { id: "PREAPROBADO", label: "Preaprobado", significado: "Cargado, espera autorización" },
  { id: "PARA_LIQUIDAR", label: "Para liquidar", significado: "Autorizado; disponible para incluirse en una orden de pago" },
  { id: "EN_ORDEN_PAGO", label: "En orden de pago", significado: "Incluido en una orden de pago" },
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
  // Opcional: si falta, el comprobante vence a la vista (el día de su fecha).
  fechaVencimiento?: string;
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
  // Orden de pago vigente que lo incluye (OP-0001). Se asigna al armar la OP y se limpia si la OP se
  // rechaza o se anula (v4: autorizar el comprobante ya no genera número de OP).
  ordenPago?: string;
}

// Orden de pago (v4, 6.2): siempre de un solo proveedor, con una o varias facturas y notas de ese
// proveedor en estado Para liquidar. Se arma y se autoriza en Proveedores; se paga en la Bandeja.
export type EstadoOrdenPago =
  | "BORRADOR"
  | "EMITIDA"
  | "AUTORIZADA"
  | "PENDIENTE_TRANSFERENCIA"
  | "PAGADA"
  | "RECHAZADA"
  | "ANULADA";
export const ESTADO_ORDEN_LABEL: Record<EstadoOrdenPago, string> = {
  BORRADOR: "Borrador",
  EMITIDA: "Emitida",
  AUTORIZADA: "Autorizada · pendiente de pago",
  PENDIENTE_TRANSFERENCIA: "Pendiente de transferencia",
  PAGADA: "Pagada",
  RECHAZADA: "Rechazada",
  ANULADA: "Anulada",
};

// Cada comprobante de la orden: `credito` es lo que se le aplicó de las notas de crédito incluidas (o,
// en la nota, su importe entero) y `aPagar` lo que hay que pagar en dinero (total − crédito).
export interface ItemOrdenPago {
  comprobanteId: string;
  credito: number;
  aPagar: number;
}

export interface EventoOrdenPago {
  fechaHora: string;
  usuarioId: string;
  evento: string;
  detalle?: string;
}

export interface OrdenPago {
  id: string; // OP-0001
  proveedorId: string;
  items: ItemOrdenPago[];
  total: number; // dinero a pagar (facturas − notas de crédito)
  cuentaDestino: string; // CBU de la ficha del proveedor; no se edita en el pago
  estado: EstadoOrdenPago;
  armadaPor: string; // id de usuario
  fechaArmado: string;
  autorizacion?: { usuarioId: string; fechaHora: string; firmaId?: string };
  cierre?: { usuarioId: string; fechaHora: string; motivo: string; tipo: "RECHAZO" | "ANULACION" };
  historial: EventoOrdenPago[];
}

// Pago de una orden (v4, 2.5 y Bandeja). Cada medio tiene sus estados: la transferencia pasa por
// Preparada → Pendiente de ejecución → Ejecutada → Confirmada (o Rechazada); el cheque, por Emitido →
// Entregado → Presentado → Debitado (o Anulado / Rechazado); el efectivo es Ejecutado al instante.
export type MedioPago = "TRANSFERENCIA" | "EFECTIVO" | "CHEQUE";
export const MEDIO_PAGO_LABEL: Record<MedioPago, string> = {
  TRANSFERENCIA: "Transferencia",
  EFECTIVO: "Efectivo",
  CHEQUE: "Cheque",
};

export type EstadoPago =
  | "PREPARADA"
  | "PENDIENTE_EJECUCION"
  | "EJECUTADA"
  | "CONFIRMADA"
  | "RECHAZADA"
  | "EMITIDO"
  | "ENTREGADO"
  | "PRESENTADO"
  | "DEBITADO"
  | "ANULADO"
  | "RECHAZADO";
export const ESTADO_PAGO_LABEL: Record<EstadoPago, string> = {
  PREPARADA: "Preparada",
  PENDIENTE_EJECUCION: "Pendiente de ejecución",
  EJECUTADA: "Ejecutada",
  CONFIRMADA: "Confirmada",
  RECHAZADA: "Rechazada",
  EMITIDO: "Cheque emitido",
  ENTREGADO: "Cheque entregado",
  PRESENTADO: "Cheque presentado",
  DEBITADO: "Cheque debitado",
  ANULADO: "Cheque anulado",
  RECHAZADO: "Cheque rechazado",
};

export interface AplicacionPago {
  comprobanteId: string;
  importe: number;
}

export interface EventoPago {
  estado: EstadoPago;
  usuarioId: string;
  fechaHora: string;
  detalle?: string;
}

export interface PagoProveedor {
  id: string; // PAG-0001
  ordenPago: string; // id de la OP
  proveedorId: string;
  fecha: string; // fecha de pago = fecha contable
  medio: MedioPago;
  origenTipo: "CAJA" | "BANCO"; // efectivo sale de una caja; transferencia y cheque, de una cuenta
  origenId: string; // id de caja o de cuenta bancaria
  importe: number;
  estado: EstadoPago;
  // Cómo se reparte el importe entre los comprobantes de la OP (en orden de vencimiento).
  aplicaciones: AplicacionPago[];
  usuarioId: string;
  asiento: string; // número de asiento contable simulado
  reservaId?: string; // reserva de saldo (transferencia y cheque)
  asientoLibroId?: string; // fila del libro de caja (efectivo)
  chequeId?: string; // cheque propio emitido (medio CHEQUE)
  historial: EventoPago[];
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
