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
export type RolCaja = "CAJERO" | "TESORERO" | "SUPERVISOR" | "DIRECTOR" | "TESORERO_CENTRAL";
export const ROL_CAJA_LABEL: Record<RolCaja, string> = {
  CAJERO: "Cajero",
  TESORERO: "Tesorero",
  SUPERVISOR: "Supervisor de caja",
  DIRECTOR: "Director",
  TESORERO_CENTRAL: "Tesorero central",
};
export interface UsuarioCaja {
  id: string;
  nombre: string;
  roles: RolCaja[];
  // Sucursal donde trabaja. Sin sucursal (Director y Tesorero central) ve todas las cajas.
  sucursalId?: string;
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
  // Días en que opera (0 = domingo … 6 = sábado). En feriado no opera, salvo excepción.
  diasOperativos: number[];
  // Piso que protege al tesoro de origen al autorizar un movimiento (uno por moneda).
  minimoOperativo: PorMoneda;
  // Minutos posteriores a la hora de fin a partir de los cuales una caja abierta dispara alerta.
  margenAlertaMin: number;
  cuentaContable: string;
  estado: EstadoAbm;
  fechaAlta: string;
  usuarioAlta: string;
}

export const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export interface Feriado {
  id: string;
  fecha: string; // YYYY-MM-DD
  descripcion: string;
  estado: EstadoAbm;
}

// Cierre diario de sucursal: el tesorero confirma que todas sus cajas cerraron y se bloquea la fecha
// operativa. La reapertura requiere autorización de un supervisor.
export interface CierreSucursal {
  id: string;
  sucursalId: string;
  fecha: string;
  usuarioId: string;
  fechaHora: string;
  estado: "CERRADA" | "REABIERTA";
  reapertura?: Aprobacion;
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
  // El dinero sale de una cuenta bancaria (pedido de refuerzo a banco, v4): el origen no es una caja.
  origenBanco?: boolean;
  estado: EstadoAbm;
}

// Estados del circuito de un movimiento de tesorería (ABM de sólo lectura: los fija el sistema).
export type EstadoMovimiento =
  | "SOLICITADO"
  | "AUTORIZADO"
  | "RECHAZADO"
  | "EN_TRANSITO"
  | "CON_INCIDENCIA"
  | "ACEPTADO"
  | "FINALIZADO";
export const ESTADOS_MOVIMIENTO: { id: EstadoMovimiento; label: string; significado: string }[] = [
  { id: "SOLICITADO", label: "Solicitado", significado: "Cargado, espera autorización" },
  { id: "AUTORIZADO", label: "Autorizado", significado: "Aprobado, todavía no salió" },
  { id: "RECHAZADO", label: "Rechazado", significado: "No aprobado. No mueve dinero." },
  { id: "EN_TRANSITO", label: "En tránsito", significado: "Salió del origen y el destino todavía no lo aceptó" },
  { id: "CON_INCIDENCIA", label: "Con incidencia", significado: "El destino contó un importe distinto. Espera al supervisor." },
  { id: "ACEPTADO", label: "Aceptado", significado: "El destino aceptó: el dinero forma parte de la caja de destino. Falta documentarlo." },
  {
    id: "FINALIZADO",
    label: "Finalizado",
    significado: "Estado final: movimiento cerrado y documentado (acta o boleta de depósito o de extracción). Pasa al histórico.",
  },
];

export interface CuentaContable {
  codigo: string;
  nombre: string;
}
export interface CuentaBancaria {
  id: string;
  banco: string;
  tipo: "CUENTA_CORRIENTE" | "CAJA_AHORRO";
  numero: string;
  cbu: string;
  moneda: Moneda;
  cuentaContable: string;
  // Datos del ABM de Bancos (v2): la sucursal del banco, el oficial de cuenta y la apertura.
  alias?: string;
  sucursalBanco?: string;
  direccionBanco?: string;
  oficialNombre?: string;
  oficialTelefono?: string;
  oficialMail?: string;
  mailSucursal?: string;
  fechaApertura?: string;
  // Saldo con el que la cuenta entra al módulo (antes de los depósitos conciliados y de los pagos).
  saldoInicial?: number;
  estado: EstadoAbm;
  fechaAlta: string;
  usuarioAlta: string;
}
export const TIPO_CUENTA_LABEL: Record<CuentaBancaria["tipo"], string> = {
  CUENTA_CORRIENTE: "Cuenta corriente",
  CAJA_AHORRO: "Caja de ahorro",
};

// Alta de acuerdos bancarios (v2, 2.1): línea otorgada a una cuenta, con tasa y vencimiento.
export interface AcuerdoBancario {
  id: string;
  cuentaId: string;
  fecha: string;
  importe: number;
  tasa: number; // porcentaje
  vencimiento: string;
  estado: EstadoAbm;
  fechaAlta: string;
  usuarioAlta: string;
}

// ABM de Tipos de chequera (v2, 7.9): física o e-cheq.
export interface TipoChequera {
  id: string;
  descripcion: string;
  estado: EstadoAbm;
  fechaAlta: string;
  usuarioAlta: string;
}

// Alta de chequeras (v2, 2.2). Para e-cheq el rango de numeración es opcional (punto abierto 8).
export interface Chequera {
  id: string;
  tipoId: string;
  cuentaId: string;
  fecha: string;
  desde: string;
  hasta: string;
  estado: EstadoAbm;
  fechaAlta: string;
  usuarioAlta: string;
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
  // Firma con llave de autorización (R6) que respalda la aprobación.
  firmaId?: string;
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
  // Conteo de cheques y valores en custodia, aparte del efectivo (no cambia su diferencia).
  valoresApertura?: ConteoValores;
  valoresCierre?: ConteoValores;
}

// Conteo de valores en custodia declarado al abrir o cerrar la caja.
export interface ConteoValores {
  usuarioId: string;
  fechaHora: string;
  esperados: number; // cheques en custodia según el sistema
  declarados: number;
  conforme: boolean;
  observacion?: string; // sólo si no coincide
}

// Cheques y valores (v2: 1.1/1.2 "se cuentan por separado del efectivo", 2.2 chequeras).
export type OrigenCheque = "TERCERO" | "PROPIO";
export type FormaCheque = "FISICO" | "ECHEQ";
// Terceros: EN_CUSTODIA → DEPOSITADO | RECHAZADO | ENTREGADO. Propios (v4, 2.5): EMITIDO → ENTREGADO →
// PRESENTADO → DEBITADO, con ANULADO (antes de entregar) y RECHAZADO (por el banco, ya presentado).
export type EstadoCheque =
  | "EN_CUSTODIA"
  | "DEPOSITADO"
  | "RECHAZADO"
  | "ENTREGADO"
  | "EMITIDO"
  | "PRESENTADO"
  | "DEBITADO"
  | "ANULADO";
export const ESTADO_CHEQUE_LABEL: Record<EstadoCheque, string> = {
  EN_CUSTODIA: "En custodia",
  DEPOSITADO: "Depositado",
  RECHAZADO: "Rechazado",
  ENTREGADO: "Entregado",
  EMITIDO: "Emitido",
  PRESENTADO: "Presentado",
  DEBITADO: "Debitado",
  ANULADO: "Anulado",
};

// Reserva de saldo (v4, R3 y 4.1): una sola por operación autorizada. El comprometido de una caja o de
// una cuenta es la suma de sus reservas activas; el estimado es el real menos el comprometido. Los
// movimientos de tesorería autorizados ya reservan por derivación (`reservado` en caja-reglas) y no
// crean filas acá: `MOVIMIENTO` queda previsto para cuando se unifiquen.
export type EstadoReserva = "ACTIVA" | "CONSUMIDA" | "LIBERADA";
export interface Reserva {
  id: string; // RSV-0001
  origenTipo: "CAJA" | "BANCO";
  origenId: string; // id de caja o de cuenta bancaria
  moneda: Moneda;
  importe: number;
  operacionTipo: "PAGO" | "MOVIMIENTO";
  operacionId: string; // id del pago (PAG-0001) o del movimiento
  estado: EstadoReserva;
  creada: { usuarioId: string; fechaHora: string };
  cierre?: { usuarioId: string; fechaHora: string; motivo: string };
}
export const FORMA_CHEQUE_LABEL: Record<FormaCheque, string> = { FISICO: "Físico", ECHEQ: "E-cheq" };

export interface TrazaCheque {
  estado: EstadoCheque;
  usuario: string;
  fechaHora: string;
  detalle: string;
}

export interface Cheque {
  id: string; // CHE-0001
  origen: OrigenCheque;
  forma: FormaCheque;
  banco: string;
  numero: string;
  importe: number;
  moneda: Moneda;
  // Terceros: quien lo libró. Propios: el beneficiario.
  parte: string;
  fechaEmision: string;
  fechaPago: string; // vencimiento
  cajaId?: string; // custodia (sólo terceros)
  cuentaId?: string; // propios: cuenta librada; terceros depositados: cuenta destino
  chequeraId?: string; // propios
  referencia?: string;
  estado: EstadoCheque;
  traza: TrazaCheque[];
  fechaAlta: string;
  usuarioAlta: string;
}

export type TipoArqueo = "ORDINARIO" | "SORPRESIVO";
export interface Arqueo {
  id: string;
  // Arqueos hechos en el mismo corte (un tesoro de sucursal con sus cajas de cajero).
  grupoId?: string;
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
  // Entrega de la remesa al portador: acta firmada por quien entrega (llave) y conformidad del portador.
  envio?: { usuarioId: string; fechaHora: string; detalle: DetalleRecuento; importe: number; conformidad: boolean; firmaId?: string; portadorConforme?: boolean };
  // Recepción: el destino cuenta y firma el acta con su llave.
  recepcion?: { usuarioId: string; fechaHora: string; detalle: DetalleRecuento; importe: number; firmaId?: string };
  resolucion?: Aprobacion & { importeAceptado: number };
  boletaDeposito?: string;
  // Pedido de refuerzo a banco: cuenta de la que se extraen los fondos. `origenId` es el tesoro que los recibe.
  origenBancoId?: string;
  extraccion?: { usuarioId: string; fechaHora: string; importe: number; boleta: string };
  // Restitución de fondo fijo: rendición de gastos (simplificada) contra la que se repone.
  rendicion?: { detalle: string; comprobantes: number; importe: number };
  // Cierre documentado del movimiento: número de acta o boleta de depósito o de extracción.
  finalizacion?: { usuarioId: string; fechaHora: string; documento: string; firmaId?: string };
  // Conciliación de un depósito: la acreditación se confirma contra el extracto del banco.
  conciliacion?: { usuarioId: string; fechaHora: string; fechaAcreditacion: string; importe: number; referencia: string };
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
  resolucion?: { usuarioId: string; fechaHora: string; nota: string; firmaId?: string };
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
