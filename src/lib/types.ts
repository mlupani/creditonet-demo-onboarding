// Modelo de datos de la demo CreditoNet — Onboarding en dos etapas.
// Ver docs/superpowers/specs/2026-09-06-onboarding-dos-etapas-design.md

export type EtapaFlujo = "ORIGINACION" | "TRANSICION" | "POST_OFERTA" | "ENVIADA";

export type EstadoCredito =
  | "BORRADOR"
  | "EN_ANALISIS"
  | "ANALISIS_TOMADO"
  | "OBSERVADA"
  | "APROBADO"
  | "RECHAZADO";

export type TipoPersona = "FISICA" | "JURIDICA";
export type TipoCliente = "NUEVO" | "EXISTENTE";
export type OrigenDato = "API pública" | "Base interna" | "Manual";

// --- Motor de riesgo ---

export type RuleOutcome = "CUMPLE" | "ADVERTENCIA" | "NO_CUMPLE";
export type RiskResultado = "GENERAR_OFERTA" | "PASAR_A_ANALISTA" | "RECHAZAR";

export interface RiskRule {
  id: string;
  nombre: string;
  detalle: string;
  valorEvaluado: string;
  condicion: string;
  resultado: RuleOutcome;
}

// --- Cliente ---

export interface ClienteDatos {
  apellido: string;
  nombre: string;
  dni: string;
  cuil: string;
  sexo: string;
  fechaNacimiento: string;
  // datos adicionales (paso 5)
  estadoCivil: string;
  domicilio: string;
  localidad: string;
  provincia: string;
  telefono: string;
  nacionalidad: string;
}

export type OrigenCampos = Partial<Record<keyof ClienteDatos, OrigenDato>>;

// --- Datos laborales e ingresos (etapa 1) ---

export interface LaboralIngresos {
  // obligatorios
  bancoSueldo: string;
  cbu: string;
  ingresoNeto: number;
  ingresoBruto: number;
  fechaInicioLaboral: string;
  // información adicional (configurable por producto)
  email: string;
  cuitEmpleador: string;
  extraccionesFecha: string;
  extraccionesImporte: number;
  transferenciasFecha: string;
  transferenciasImporte: number;
  disponible: number;
  debitosNoRemunerativos: number;
}

export type CampoAdicionalLaboral =
  | "email"
  | "cuitEmpleador"
  | "extracciones"
  | "transferencias"
  | "disponible"
  | "debitosNoRemunerativos";

// --- Oferta ---

export type Plazo = 12 | 18 | 24;

export interface CreditoActivo {
  id: string;
  capitalOriginal: number;
  capitalResidual: number;
  montoCancelacion: number;
  desglose: { capital: number; intereses: number; iva: number; cargos: number };
  cuotasOriginales: number;
  cuotaActual: number;
  precancelar: boolean;
}

export interface Oferta {
  capitalMaximoBase: number;
  capitalMaximoActual: number;
  montoSolicitado: number;
  plazo: Plazo;
  tna: number;
  valorCuota: number;
  totalAPagar: number;
  primeraCuotaVencimiento: string;
  creditosActivos: CreditoActivo[];
  deudaTerceros: { habilitado: boolean; importe: number };
  aceptada: boolean;
}

// --- Post-oferta ---

export interface DatosLaboralesPost {
  domicilioLaboral: string;
  fechaIngresoLaboral: string;
  razonSocial: string;
  rubro: string;
  provincia: string;
  telefonoLaboral: string;
  numeroLegajo: string;
  bancoCobro: string;
  cbu: string;
}

export interface DatosPersonalesPost {
  email: string;
  domicilioCompleto: string;
  telefonoCelular: string;
  nacionalidad: string;
  estadoCivil: string;
  tipoVivienda: string;
  hijosACargo: string;
  tarjetaCredito: string;
}

export type TipoTarjeta = "DEBITO" | "PREPAGA" | "CREDITO";

export interface Tokenizacion {
  tipoTarjeta: TipoTarjeta;
  numero: string;
  vencimiento: string;
  marca: string;
  cvv: string;
  tokenizada: boolean;
  token: string | null;
}

export interface Referencia {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  domicilio: string;
  relacion: string;
}

export interface Garante {
  nombre: string;
  dni: string;
  telefono: string;
  datosLaborales: string;
  ingresos: number;
  lugarTrabajo: string;
}

export interface DocItem {
  id: string;
  nombre: string;
  estado: "PENDIENTE" | "CARGADO";
  archivo?: string;
  detalle?: string;
}

export interface PostOferta {
  laboral: DatosLaboralesPost;
  personales: DatosPersonalesPost;
  tokenizacion: Tokenizacion;
  referencias: Referencia[];
  garante: Garante;
  garanteDocs: DocItem[];
  legajo: DocItem[];
  impresionGenerada: boolean;
}

export type PantallaPostOfertaId =
  | "laboral"
  | "personales"
  | "tokenizacion"
  | "referencias"
  | "garantias"
  | "legajo"
  | "impresion";

// --- Aplicación ---

export interface CreditApplication {
  numeroCredito: string | null;
  numeroCliente: string | null;
  estado: EstadoCredito;
  etapa: EtapaFlujo;

  tipoPersona: TipoPersona | null;

  identificacion: {
    documento: string;
    consultado: boolean;
    tipoCliente: TipoCliente | null;
  };
  cliente: ClienteDatos | null;
  origenCampos: OrigenCampos;
  identidadVerificada: boolean;

  configuracion: {
    productoId: string;
    organismoId: string;
    canalId: string;
    vendedorId: string;
  };

  laboral: LaboralIngresos;

  riesgo: {
    estado: "PENDIENTE" | "EVALUANDO" | "COMPLETO";
    reglas: RiskRule[];
    resultado: RiskResultado | null;
    evaluadoConIngresoNeto: number | null;
    fecha: string | null;
  };

  oferta: Oferta;

  postOferta: PostOferta;
  pantallasVisitadas: PantallaPostOfertaId[];

  analista: {
    tomado: boolean;
    observacion: string | null;
    motivoRechazo: string | null;
  };

  fechaEnvioAnalisis: string | null;
  fechaAprobacion: string | null;
}

// --- Metadata de pasos ---

export interface WizardStepMeta {
  id: string;
  numero: number;
  titulo: string;
  tituloPantalla: string;
  descripcion: string;
}

export type NotificationTone = "info" | "success" | "warning";

export interface AppNotification {
  id: string;
  titulo: string;
  detalle: string;
  hace: string;
  tone: NotificationTone;
  leida: boolean;
}
