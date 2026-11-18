// Módulo Caja y Bancos (Avance 01, Función 1: Caja). Tipos y catálogos fijos. Todo vive en el front:
// los datos de ejemplo salen de caja-datos.ts y el estado se persiste en la sesión (caja-store.ts).

export type Moneda = "ARS" | "USD";
export type MonedaCaja = Moneda | "AMBAS";
export const MONEDAS: Moneda[] = ["ARS", "USD"];
export const SIMBOLO: Record<Moneda, string> = { ARS: "$", USD: "US$" };
export const NOMBRE_MONEDA: Record<Moneda, string> = { ARS: "Pesos", USD: "Dólares" };

export type EstadoAbm = "ACTIVO" | "SUSPENDIDO" | "ELIMINADO";
export const ESTADO_ABM_LABEL: Record<EstadoAbm, string> = {
  ACTIVO: "Activo",
  SUSPENDIDO: "Suspendido",
  ELIMINADO: "Eliminado",
};

export type TipoCaja = "TESORO_CENTRAL" | "TESORO_SUCURSAL" | "CAJA_CAJERO" | "FONDO_FIJO";
export const TIPO_CAJA_LABEL: Record<TipoCaja, string> = {
  TESORO_CENTRAL: "Tesoro central",
  TESORO_SUCURSAL: "Tesoro de sucursal",
  CAJA_CAJERO: "Caja de cajero",
  FONDO_FIJO: "Fondo fijo",
};
export const esTesoro = (t: TipoCaja) => t === "TESORO_CENTRAL" || t === "TESORO_SUCURSAL";

// Usuarios y roles (sección Usuarios). Un usuario puede tener más de un rol; el Tesorero incluye las
// facultades del Cajero.
export type RolCaja = "CAJERO" | "TESORERO" | "SUPERVISOR";
export const ROL_CAJA_LABEL: Record<RolCaja, string> = {
  CAJERO: "Cajero",
  TESORERO: "Tesorero",
  SUPERVISOR: "Supervisor",
};
export interface UsuarioCaja {
  id: string;
  nombre: string;
  roles: RolCaja[];
}

export interface Sucursal {
  id: string;
  nombre: string;
  direccion: string;
  localidad: string;
  provincia: string;
  codigoPostal: string;
  telefono: string;
  mail: string;
  estado: EstadoAbm;
  fechaAlta: string;
  usuarioAlta: string;
}

export interface CajeroTurno {
  usuarioId: string;
  desde: string; // HH:MM
  hasta: string; // HH:MM
  estado: "ACTIVO" | "INACTIVO";
}

export type PorMoneda = Record<Moneda, number>;
export type ModalidadRelevo = "DIRECTO" | "POR_TESORO";
export type FrecuenciaArqueo = "SIN_FRECUENCIA" | "SEMANAL" | "QUINCENAL" | "MENSUAL";
export const FRECUENCIA_ARQUEO_DIAS: Record<FrecuenciaArqueo, number> = {
  SIN_FRECUENCIA: 0,
  SEMANAL: 7,
  QUINCENAL: 15,
  MENSUAL: 30,
};

export interface Caja {
  id: string;
  nombre: string;
  sucursalId: string;
  tipo: TipoCaja;
  moneda: MonedaCaja;
  tesoreroId: string; // obligatorio para los tesoros; "" si no aplica
  cajeros: CajeroTurno[];
  horarioDesde: string;
  horarioHasta: string;
  importeMaximo: PorMoneda;
  toleranciaSobrante: PorMoneda;
  toleranciaFaltante: PorMoneda;
  relevo: ModalidadRelevo;
  frecuenciaArqueo: FrecuenciaArqueo;
  cuentaContable: string;
  estado: EstadoAbm;
  fechaAlta: string;
  usuarioAlta: string;
}

export const monedasDe = (m: MonedaCaja): Moneda[] => (m === "AMBAS" ? MONEDAS : [m]);

export interface Denominacion {
  id: string;
  moneda: Moneda;
  tipo: "BILLETE" | "MONEDA";
  valor: number;
  estado: "ACTIVA" | "INACTIVA";
}

export interface MotivoDiferencia {
  id: string;
  descripcion: string;
  cuentaSobrante: string;
  cuentaFaltante: string;
  estado: EstadoAbm;
}

export type PuntaMovimiento = TipoCaja | "BANCO";
export interface TipoMovimientoTesoreria {
  id: string;
  descripcion: string;
  origenes: TipoCaja[];
  destinos: PuntaMovimiento[];
  requiereAutorizacion: boolean;
  cuentaTransito: string;
  estado: EstadoAbm;
}

// Estados del circuito de un movimiento de tesorería (ABM de sólo lectura: los fija el sistema).
export type EstadoMovimiento =
  | "SOLICITADO"
  | "AUTORIZADO"
  | "RECHAZADO"
  | "EN_TRANSITO"
  | "CON_INCIDENCIA"
  | "ACEPTADO";
export const ESTADOS_MOVIMIENTO: { id: EstadoMovimiento; label: string; significado: string }[] = [
  { id: "SOLICITADO", label: "Solicitado", significado: "Cargado, espera autorización" },
  { id: "AUTORIZADO", label: "Autorizado", significado: "Aprobado, todavía no salió" },
  { id: "RECHAZADO", label: "Rechazado", significado: "No aprobado. No mueve dinero." },
  { id: "EN_TRANSITO", label: "En tránsito", significado: "Salió del origen y el destino todavía no lo aceptó" },
  { id: "CON_INCIDENCIA", label: "Con incidencia", significado: "El destino contó un importe distinto. Espera al supervisor." },
  { id: "ACEPTADO", label: "Aceptado", significado: "Estado final: el dinero forma parte de la caja de destino" },
];

export interface CuentaContable {
  codigo: string;
  nombre: string;
}
export interface CuentaBancaria {
  id: string;
  banco: string;
  numero: string;
  moneda: Moneda;
}

// Cantidad de billetes y monedas por id de denominación.
export type DetalleRecuento = Record<string, number>;

export interface AjusteDiferencia {
  moneda: Moneda;
  importe: number; // con signo: positivo = sobrante (acreedora), negativo = faltante (deudora)
  motivoId: string;
  nota: string;
}

export interface Aprobacion {
  supervisorId: string;
  fechaHora: string;
  resultado: "APROBADA" | "RECHAZADA";
  nota: string;
}

export interface Recuento {
  usuarioId: string;
  fechaHora: string;
  detalle: DetalleRecuento;
  contado: PorMoneda;
  esperado: PorMoneda;
  diferencia: PorMoneda; // contado − esperado
  ajustes: AjusteDiferencia[];
  aprobacion?: Aprobacion;
}

export type EstadoJornada = "PEND_APERTURA" | "ABIERTA" | "PEND_CIERRE" | "CERRADA";
export const ESTADO_JORNADA_LABEL: Record<EstadoJornada, string> = {
  PEND_APERTURA: "Apertura pendiente de autorización",
  ABIERTA: "Abierta",
  PEND_CIERRE: "Cierre pendiente de autorización",
  CERRADA: "Cerrada",
};

// Una jornada es la vida de una caja en una fecha: apertura, turnos y cierre definitivo.
export interface Jornada {
  id: string;
  cajaId: string;
  fecha: string; // YYYY-MM-DD
  estado: EstadoJornada;
  apertura: Recuento;
  cierre?: Recuento;
  turnoUsuarioId: string; // cajero con el turno en curso
  rechazos: { etapa: "APERTURA" | "CIERRE"; aprobacion: Aprobacion }[];
}

export type TipoArqueo = "ORDINARIO" | "SORPRESIVO";
export interface Arqueo {
  id: string;
  cajaId: string;
  tipo: TipoArqueo;
  controladorId: string;
  corte: string; // fecha y hora del corte (YYYY-MM-DD HH:MM)
  fin?: string;
  estado: "EN_CURSO" | "FINALIZADO";
  conteos: Recuento[]; // el segundo conteo es opcional
  resultado?: "CONFORME" | "CON_DIFERENCIA";
  ajusteAprobado?: Aprobacion & { motivoId: string; movimientoId: string };
}

export type EstadoCambioTurno =
  | "SOLICITADO"
  | "PEND_AUTORIZACION"
  | "PEND_RECEPCION"
  | "COMPLETADO"
  | "CON_INCIDENCIA";
export interface CambioTurno {
  id: string;
  cajaId: string;
  jornadaId: string;
  salienteId: string;
  entranteId: string;
  corte: string;
  estado: EstadoCambioTurno;
  arqueo?: Recuento; // arqueo de relevo ciego del saliente
  recepcion?: { usuarioId: string; fechaHora: string; detalle: DetalleRecuento; contado: PorMoneda };
  resolucion?: Aprobacion;
  fin?: string;
}

export type MedioMovimiento = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "CHEQUE" | "DEPOSITO_BANCARIO";
export const MEDIO_LABEL: Record<MedioMovimiento, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  CHEQUE: "Cheque",
  DEPOSITO_BANCARIO: "Depósito bancario",
};

// Fila del libro (mayor de caja). Los confirmados no se borran ni se modifican; los anulados quedan
// visibles. Sólo el efectivo mueve el saldo.
export interface MovimientoCaja {
  id: string;
  cajaId: string;
  fecha: string;
  hora: string;
  turnoUsuarioId: string;
  tipo: string;
  descripcion: string;
  comprobante: string;
  moneda: Moneda;
  ingreso: number;
  egreso: number;
  medio: MedioMovimiento;
  responsableId: string;
  estado: "CONFIRMADO" | "ANULADO";
  refId?: string; // ID compartido por la salida y la entrada de un movimiento de tesorería
  diferencia?: boolean;
  incidencia?: boolean;
  nota?: string;
}

export interface Transportista {
  tipo: "EMPLEADO" | "EMPRESA";
  nombre: string;
  documento: string;
}

export type DestinoMovimiento =
  | { tipo: "CAJA"; cajaId: string }
  | { tipo: "BANCO"; cuentaId: string };

export interface MovimientoTesoreria {
  id: string;
  tipoId: string;
  origenId: string;
  destino: DestinoMovimiento;
  moneda: Moneda;
  importe: number;
  motivo: string;
  transportista?: Transportista;
  precinto: string;
  observaciones: string;
  estado: EstadoMovimiento;
  solicitanteId: string;
  fechaSolicitud: string;
  autorizacion?: Aprobacion;
  envio?: { usuarioId: string; fechaHora: string; detalle: DetalleRecuento; importe: number; conformidad: boolean };
  recepcion?: { usuarioId: string; fechaHora: string; detalle: DetalleRecuento; importe: number };
  resolucion?: Aprobacion & { importeAceptado: number };
  boletaDeposito?: string;
  pedidoId?: string;
}

export interface PedidoRefuerzo {
  id: string;
  solicitanteCajaId: string; // quien pide los fondos
  aCajaId: string; // tesoro al que se piden
  moneda: Moneda;
  importe: number;
  motivo: string;
  fecha: string;
  usuarioId: string;
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  importeAprobado?: number;
  resolucion?: { usuarioId: string; fechaHora: string; nota: string };
  movimientoId?: string;
}

export interface RegistroAuditoria {
  id: string;
  entidad: string;
  registroId: string;
  accion: "ALTA" | "MODIFICACION" | "ESTADO";
  usuario: string;
  fechaHora: string;
  antes: string | null;
  despues: string | null;
}

// Excepción para operar fuera de horario, habilitada por el Tesorero.
export interface ExcepcionHorario {
  id: string;
  cajaId: string;
  usuarioId: string;
  fecha: string;
  hastaHora: string;
  motivo: string;
  habilitadaPor: string;
  fechaHora: string;
}
