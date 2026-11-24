// Módulo Caja y Bancos (v4): control interno. Tipos y catálogos de la llave de autorización (R6), la
// matriz de autorizaciones (7.18) y las alertas por mail simuladas (7.17 y anexo). Todo vive en el
// front: los datos de ejemplo salen de control-datos.ts y el estado se persiste en la sesión
// (control-store.ts).

import type { EstadoAbm, Moneda, RolCaja } from "./caja-tipos";

// ---------- Llave de autorización (R6) ----------

export type ModalidadFirma = "PRESENCIAL" | "REMOTA";

// Registro inalterable de una firma con llave: usuario y clave más un segundo factor personal.
export interface Firma {
  id: string; // FIR-0001
  usuarioId: string;
  rol: RolCaja; // rol con el que firma
  fechaHora: string;
  equipo: string; // equipo simulado
  operacion: string; // qué se autoriza (ver OPERACIONES_FIRMA o texto libre)
  referencia: string; // ID del evento firmado (jornada, arqueo, comprobante, remesa…)
  importe?: number;
  moneda?: Moneda;
  modalidad: ModalidadFirma;
}

// Alta, baja y bloqueo de llaves por usuario (7.18).
export type EstadoLlave = "ACTIVA" | "BLOQUEADA" | "BAJA";
export const ESTADO_LLAVE_LABEL: Record<EstadoLlave, string> = {
  ACTIVA: "Activa",
  BLOQUEADA: "Bloqueada",
  BAJA: "De baja",
};
export interface LlaveUsuario {
  id: string; // id del usuario
  estado: EstadoLlave;
}

// ---------- Matriz de autorizaciones (7.18) ----------

export type TipoOperacionMatriz =
  | "MOVIMIENTO_TESORERIA"
  | "ORDEN_PAGO"
  | "COMPROBANTE"
  | "AJUSTE_DIFERENCIA"
  | "REAPERTURA"
  | "PAGO_PRESTAMO";

export const OPERACION_MATRIZ_LABEL: Record<TipoOperacionMatriz, string> = {
  MOVIMIENTO_TESORERIA: "Remesa o movimiento de tesorería",
  ORDEN_PAGO: "Orden de pago",
  COMPROBANTE: "Comprobante de proveedor",
  AJUSTE_DIFERENCIA: "Ajuste de diferencia de caja",
  REAPERTURA: "Reapertura de caja o sucursal",
  PAGO_PRESTAMO: "Pago de préstamo",
};

// Una fila de la matriz es un escalón: quién carga, quién autoriza y hasta qué importe. Una operación
// tiene varios escalones; el importe decide cuáles aplican. Tope vacío (null) = sin tope.
export interface ReglaMatriz {
  id: string; // MTX-001
  operacion: TipoOperacionMatriz;
  perfilCarga: RolCaja[];
  perfilAutoriza: RolCaja[];
  importeHasta: Record<Moneda, number | null>;
  admiteRemota: boolean; // autorización remota de Casa Central (sucursal con una sola persona)
  dobleAutorizacion: boolean;
  escalaA: RolCaja[]; // superior al que se escala
  estado: EstadoAbm;
  fechaAlta: string;
  usuarioAlta: string;
}

// ---------- Alertas por mail simuladas (7.17 y anexo) ----------

export type EventoAlerta =
  | "DIFERENCIA_SOBRE_TOLERANCIA"
  | "ARQUEO_SORPRESIVO_DIFERENCIA"
  | "ACTA_NO_CONFORME"
  | "INCIDENCIA_RECEPCION"
  | "CAJA_SIN_CERRAR"
  | "SUCURSAL_SIN_CIERRE_DIARIO"
  | "ARQUEO_VENCIDO"
  | "IMPORTE_MAXIMO_SUPERADO"
  | "DIFERENCIA_MEDIOS_ELECTRONICOS"
  | "DIFERENCIA_SALDO_BANCARIO"
  | "ACUERDO_POR_VENCER"
  | "PAGO_FALLIDO_O_PARCIAL"
  | "NEGATIVA_A_FIRMAR"
  | "SOLICITUD_FIRMA_REMOTA"
  | "SOLICITUD_REAPERTURA"
  | "DESEMBOLSO_PRESTAMO_PENDIENTE";

export interface DefEventoAlerta {
  id: EventoAlerta;
  label: string;
  // Destinatarios por defecto, según el anexo de alertas.
  destinatarios: RolCaja[];
  nuevoV4?: boolean;
}

export const EVENTOS_ALERTA: DefEventoAlerta[] = [
  { id: "DIFERENCIA_SOBRE_TOLERANCIA", label: "Diferencia mayor a la tolerancia (apertura, cierre, arqueo, cambio de turno, reemplazo)", destinatarios: ["DIRECTOR", "TESORERO_CENTRAL"] },
  { id: "ARQUEO_SORPRESIVO_DIFERENCIA", label: "Arqueo sorpresivo con diferencia", destinatarios: ["DIRECTOR", "TESORERO_CENTRAL"] },
  { id: "ACTA_NO_CONFORME", label: "Acta firmada No conforme", destinatarios: ["DIRECTOR", "TESORERO_CENTRAL"] },
  { id: "INCIDENCIA_RECEPCION", label: "Incidencia en la recepción de un movimiento o relevo", destinatarios: ["DIRECTOR", "TESORERO_CENTRAL"] },
  { id: "CAJA_SIN_CERRAR", label: "Caja sin cerrar pasada la hora de fin más el margen", destinatarios: ["TESORERO", "SUPERVISOR"] },
  { id: "SUCURSAL_SIN_CIERRE_DIARIO", label: "Sucursal sin cierre diario a la hora límite, o cerrada con pendientes", destinatarios: ["TESORERO_CENTRAL"] },
  { id: "ARQUEO_VENCIDO", label: "Arqueo ordinario vencido", destinatarios: ["TESORERO_CENTRAL"] },
  { id: "IMPORTE_MAXIMO_SUPERADO", label: "Saldo por encima del importe máximo de la caja", destinatarios: ["TESORERO_CENTRAL"] },
  { id: "DIFERENCIA_MEDIOS_ELECTRONICOS", label: "Diferencias en medios electrónicos o en la conciliación", destinatarios: ["TESORERO_CENTRAL", "DIRECTOR"] },
  { id: "DIFERENCIA_SALDO_BANCARIO", label: "Diferencia entre el saldo bancario cargado y el saldo según el sistema", destinatarios: ["TESORERO_CENTRAL"] },
  { id: "ACUERDO_POR_VENCER", label: "Acuerdo bancario próximo a vencer", destinatarios: ["TESORERO_CENTRAL"] },
  { id: "PAGO_FALLIDO_O_PARCIAL", label: "Pago fallido o parcial (orden de pago, préstamo, remesa)", destinatarios: ["TESORERO_CENTRAL"] },
  { id: "NEGATIVA_A_FIRMAR", label: "Negativa a firmar un acta de diferencia", destinatarios: ["TESORERO_CENTRAL"], nuevoV4: true },
  { id: "SOLICITUD_FIRMA_REMOTA", label: "Solicitud de segunda firma remota", destinatarios: ["TESORERO_CENTRAL", "DIRECTOR"], nuevoV4: true },
  { id: "SOLICITUD_REAPERTURA", label: "Solicitud de reapertura", destinatarios: ["TESORERO_CENTRAL", "DIRECTOR"], nuevoV4: true },
  { id: "DESEMBOLSO_PRESTAMO_PENDIENTE", label: "Desembolso de préstamo parcial o pendiente de regularización", destinatarios: ["TESORERO_CENTRAL"], nuevoV4: true },
];

export const EVENTO_ALERTA_LABEL = Object.fromEntries(EVENTOS_ALERTA.map((e) => [e.id, e.label])) as Record<EventoAlerta, string>;

// ABM de destinatarios por evento: una fila por evento. Suspendida = esa alerta no se envía.
export interface ConfigAlerta {
  id: string; // ALC-001
  evento: EventoAlerta;
  destinatarios: RolCaja[];
  estado: EstadoAbm;
  fechaAlta: string;
  usuarioAlta: string;
}

// Plazos y parámetros de control (7.17): un único registro.
export interface PlazosControl {
  id: "plazos";
  diasAvisoAcuerdos: number; // días de aviso de vencimiento de acuerdos
  margenCajaSinCerrarMin: number; // minutos posteriores a la hora de fin
  horaLimiteCierreDiario: string; // HH:MM
  ventanaAjusteHoras: number; // plazo de la ventana de ajuste del cierre diario
  plazoReaperturaDias: number; // plazo máximo de reapertura (días hábiles)
  superiorEscalamiento: RolCaja; // a quien se escala una negativa a firmar
}

export interface DestinatarioAlerta {
  usuarioId: string;
  rol: RolCaja;
}

// Bandeja de salida: el mail que el sistema enviaría. Registro inalterable.
export interface AlertaEnviada {
  id: string; // ALE-0001
  evento: EventoAlerta;
  asunto: string;
  detalle: string;
  destinatarios: DestinatarioAlerta[];
  fechaHora: string;
  referencia?: string;
  sucursalId?: string;
}
