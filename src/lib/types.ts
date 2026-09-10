// Modelo de datos de la demo CreditoNet — Onboarding en dos etapas.
// Ver docs/superpowers/specs/2026-09-10-onboarding-alineacion-doc-final-design.md

export type EtapaFlujo = "ORIGINACION" | "TRANSICION" | "POST_OFERTA" | "ENVIADA";

// Máquina de estados de la solicitud (Guía Definitiva §8). "Expirado" y "Activo" no se
// simulan en la demo. ANALISIS_TOMADO es un sub-estado visual de "En análisis".
export type EstadoCredito =
  | "BORRADOR"
  | "EN_TRAMITE"
  | "EN_ANALISIS"
  | "ANALISIS_TOMADO"
  | "OBSERVADO"
  | "RECHAZADO"
  | "PARA_LIQUIDAR";

export type TipoCliente = "NUEVO" | "EXISTENTE";
export type OrigenDato = "API pública" | "Base interna" | "Manual";

// --- Motor de riesgo ---

export type RuleOutcome = "CUMPLE" | "ADVERTENCIA" | "NO_CUMPLE";
export type RiskResultado = "APROBADO" | "VERIFICACION_MANUAL" | "RECHAZADO";

export interface RiskRule {
  id: string;
  codigo: string;
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
  genero: string;
  fechaNacimiento: string;
  domicilio: string;
}

export type OrigenCampos = Partial<Record<keyof ClienteDatos, OrigenDato>>;

// --- Datos laborales y financieros mínimos (pre-oferta) ---

export interface LaboralIngresos {
  fechaInicioLaboral: string;
  bancoCobro: string;
  ingresoBruto: number;
  ingresoNeto: number;
  montoExtraidoDiaCobro: number;
}

// --- Oferta ---

export type Plazo = 12 | 18 | 24 | 36;

export interface CreditoActivo {
  id: string;
  capitalOriginal: number;
  capitalResidual: number;
  montoCancelacion: number;
  desglose: {
    capitalResidual: number;
    interesesAVencer: number;
    iva: number;
    cargosCancelacion: number;
    punitorios: number;
  };
  cuotasOriginales: number;
  cuotasAbonadas: number;
  valorCuota: number;
  precancelar: boolean;
}

export interface DeudaTerceros {
  habilitado: boolean;
  entidad: string;
  importe: number;
  cbu: string;
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
  deudaTerceros: DeudaTerceros;
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
  domicilioReal: string;
  telefonoCelular: string;
  nacionalidad: string;
  estadoCivil: string;
  tipoVivienda: string;
  hijosACargo: string;
  tarjetaCredito: string;
}

export type TipoTarjeta = "DEBITO" | "CREDITO";

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
  categoria?: string;
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

// --- Análisis ---

export interface Observacion {
  motivo: string;
  nota: string;
  fecha: string;
}

export interface Rechazo {
  origen: "MOTOR" | "ANALISTA";
  codigos: string[];
  motivo: string;
  observacion: string;
  fecha: string;
}

// --- Aplicación ---

export interface CreditApplication {
  numeroCredito: string | null;
  numeroCliente: string | null;
  estado: EstadoCredito;
  etapa: EtapaFlujo;

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
    // Datos con los que se evaluó, para detectar cambios posteriores.
    evaluadoCon: { ingresoNeto: number; fechaNacimiento: string } | null;
    fecha: string | null;
  };

  oferta: Oferta;

  postOferta: PostOferta;
  pantallasVisitadas: PantallaPostOfertaId[];

  analista: {
    tomado: boolean;
    observacion: Observacion | null;
    reenviada: boolean;
  };
  rechazo: Rechazo | null;

  fechaSolicitud: string | null;
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
