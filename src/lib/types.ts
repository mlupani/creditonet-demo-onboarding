// Modelo de datos de la demo CreditoNet — Onboarding en dos etapas.
// Ver docs/superpowers/specs/2026-09-10-onboarding-alineacion-doc-final-design.md

export type EtapaFlujo = "ORIGINACION" | "TRANSICION" | "POST_OFERTA" | "ENVIADA";

// Máquina de estados de la solicitud. "Expirado" y "Activo" no se simulan en la demo.
//
// Reunión 11/09 (13:15, 01:03:29): la carga transcurre EN_TRAMITE; al finalizarla la
// solicitud pasa a PREAPROBADO y *eso* es lo que la manda a la bandeja del analista.
// ANALISIS_TOMADO es el sub-estado de una preaprobada que un analista ya tomó.
export type EstadoCredito =
  | "BORRADOR"
  | "EN_TRAMITE"
  | "PREAPROBADO"
  | "ANALISIS_TOMADO"
  | "OBSERVADO"
  | "RECHAZADO"
  // Anulado: el cliente desistió. Lo puede anular el vendedor o el analista, y es distinto
  // de rechazado, que es una decisión de riesgo (reunión 11/09, 01:19).
  | "ANULADO"
  | "PARA_LIQUIDAR";

export type TipoCliente = "NUEVO" | "EXISTENTE";

// Situaciones que se traen con el DNI antes de evaluar (reunión 11/09, 02:30). Junto con
// la condición laboral son los tres limitantes que determinan qué línea aplica.
export interface SituacionesCliente {
  bcra: number;
  interna: number;
}

export type OrigenDato = "API pública" | "Base interna" | "Manual";

// Módulo Onboarding §4: la primera selección determina cómo se identifica al solicitante.
export type TipoPersona = "FISICA" | "JURIDICA";

// --- Reglas: motor de riesgo y reglas institucionales ---

// Motor §4: cada regla se configura como bloqueante o no bloqueante. Si una bloqueante no
// pasa, el motor no pasa. Si no pasa una no bloqueante, la solicitud continúa y la regla
// queda marcada para que la revise el analista al final.
export type ResultadoRegla = "PASA" | "NO_PASA";

// Motor §5: el resultado principal del motor es PASA / NO PASA.
export type RiskResultado = "PASA" | "NO_PASA";

// Control exclusivo de la demo para mostrar los tres caminos en una presentación.
export type EscenarioMotor = "PASA" | "PASA_CON_MARCADAS" | "NO_PASA";

export interface RiskRule {
  id: string;
  codigo: string;
  nombre: string;
  detalle: string;
  fuente: string;
  valorEvaluado: string;
  condicion: string;
  bloqueante: boolean;
  resultado: ResultadoRegla;
}

// Motor §6 y §11: las reglas universales / institucionales son transversales al negocio y
// se evalúan cuando existen los datos que necesitan, no en un único momento.
export type MomentoRegla = "IDENTIFICACION" | "EVALUACION";

export interface ReglaInstitucional extends Omit<RiskRule, "resultado"> {
  momento: MomentoRegla;
  resultado: ResultadoRegla | "ESPERANDO_DATOS";
}

// --- Límites de capital (Plan de Cuotas §3.3 · Flujos Integrados §13) ---

export interface LimiteCapital {
  id: string;
  label: string;
  detalle: string;
  monto: number;
}

// Reglas que compiten por definir la cuota máxima. Gana la menor (02:47).
export interface LimiteCuota {
  id: string;
  label: string;
  detalle: string;
  monto: number;
}

// Recorte porcentual sobre el capital ya calculado (02:48-02:50). Si aplican varios,
// gana el mayor recorte.
export interface LimitanteOferta {
  id: string;
  label: string;
  detalle: string;
  recortePct: number;
  aplica: boolean;
}

export interface ResultadoLimites {
  capitalSolicitado: number;
  // Cuotas de créditos propios que siguen pesando y las que libera la cancelación.
  cuotasVigentes: number;
  cuotasLiberadas: number;
  limites: LimiteCapital[];
  limiteAplicadoId: string;
  // Capital que resulta del límite más restrictivo, antes de los limitantes.
  capitalPorLimites: number;
  limitantes: LimitanteOferta[];
  recorteAplicadoPct: number;
  // Capital final: el de los límites con el recorte del limitante más fuerte.
  capitalConsiderado: number;
  limitesCuota: LimiteCuota[];
  limiteCuotaAplicadoId: string;
  cuotaMaxima: number;
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
  email: string;
}

export type OrigenCampos = Partial<Record<keyof ClienteDatos, OrigenDato>>;

// --- Datos laborales y financieros mínimos (pre-oferta) ---

export interface LaboralIngresos {
  // Fijo, contratado, monotributista… Determina la línea y el motor aplicables.
  condicionLaboral: string;
  fechaInicioLaboral: string;
  bancoCobro: string;
  ingresoBruto: number;
  ingresoNeto: number;
  montoExtraidoDiaCobro: number;
  cuitEmpleador: string;
  // Información adicional: no bloquea continuar (Onboarding §4.4).
  disponible: number;
  debitosNoRemunerativos: number;
  extraccionesFecha: string;
  extraccionesImporte: number;
  transferenciasFecha: string;
  transferenciasImporte: number;
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
  // Capital habilitado cuando se renueva un crédito propio: el crédito renovado deja de
  // computar en la exposición y el plan admite un tope mayor.
  capitalMaximoRenovacion: number;
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

// --- Post-oferta (Onboarding v4 §3–§10) ---

// Onboarding §3: precargado (del pedido inicial o de una API, rectificable), no modificable
// (disparó la oferta) o a cargar (dato nuevo que ingresa el vendedor).
export type OrigenCampo = "PRECARGADO" | "NO_MODIFICABLE" | "A_CARGAR";

export type PantallaPostOfertaId =
  | "personales"
  | "laboral"
  | "tokenizacion"
  | "referencias"
  | "garantias"
  | "legajo"
  | "impresion";

export type TipoTarjeta = "DEBITO" | "CREDITO";

// Onboarding §6: una o varias tarjetas, por link de WhatsApp o carga presencial. El número
// completo y el código de seguridad nunca se guardan: sólo lo que devuelve el proveedor.
export interface TarjetaTokenizada {
  id: string;
  via: "WHATSAPP" | "PRESENCIAL";
  estado: "ESPERANDO_CLIENTE" | "TOKENIZADA";
  enviadoA: string | null;
  tipo: TipoTarjeta | null;
  marca: string | null;
  ultimos4: string | null;
  token: string | null;
}

// Onboarding §7–§8: referencias y garantes comparten estructura.
export type TipoPersonaVinculada = "referencia" | "garante";

export interface PersonaVinculada {
  id: string;
  vinculo: string;
  dni: string;
  nombreCompleto: string;
  domicilio: string;
  email: string;
  autocompletado: boolean;
}

export interface ArchivoLegajo {
  id: string;
  nombre: string;
  detalle: string;
}

export type AccionLegajo = "IMPRESO" | "VISUALIZADO";

export interface PostOferta {
  // Valores precargados al comenzar la carga: permiten detectar qué dato se rectificó.
  // Vacío mientras la carga no comenzó.
  precarga: Record<string, string>;
  // Campos de las pantallas de datos, por id de catálogo (ver campos-post-oferta.ts).
  personales: Record<string, string>;
  laboral: Record<string, string>;
  tarjetas: TarjetaTokenizada[];
  referencias: PersonaVinculada[];
  garantes: PersonaVinculada[];
  // Archivos adjuntados por tipo de documento de Parámetros.
  legajo: Record<string, ArchivoLegajo[]>;
  impresion: { accion: AccionLegajo; fecha: string } | null;
}

// --- Análisis ---

export interface Observacion {
  motivo: string;
  nota: string;
  fecha: string;
  // Pantalla que el vendedor tiene que corregir: se resalta al retomar la carga (01:09).
  pantalla: PantallaPostOfertaId | null;
}

export interface Rechazo {
  // SIN_LINEA: no hay plan de cuotas para la combinación situación BCRA + buró interno +
  // condición laboral. No es un rechazo del motor y no llega al analista (02:28).
  // INSTITUCIONAL: una regla institucional bloqueante no pasó; el motor no llega a ejecutarse.
  origen: "INSTITUCIONAL" | "MOTOR" | "SIN_LINEA" | "ANALISTA";
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

  tipoPersona: TipoPersona;

  identificacion: {
    documento: string;
    consultado: boolean;
    tipoCliente: TipoCliente | null;
  };
  cliente: ClienteDatos | null;
  situaciones: SituacionesCliente | null;
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
    // Motor que corresponde ejecutar según Producto + Organismo + condiciones (Motor §9).
    motorId: string | null;
    // Escenario forzado para poder mostrar los tres caminos durante la demo.
    escenario: EscenarioMotor;
    reglas: RiskRule[];
    // Reglas institucionales tal como quedaron al solicitar (Motor §6).
    institucionales: ReglaInstitucional[];
    // null si una regla institucional descartó la solicitud antes de ejecutar el motor.
    resultado: RiskResultado | null;
    // Línea que resultó aplicable, o null si no había ninguna para el caso.
    planId: string | null;
    limites: ResultadoLimites | null;
    // Datos con los que se evaluó, para detectar cambios posteriores.
    evaluadoCon: { ingresoNeto: number; fechaNacimiento: string; genero: string } | null;
    fecha: string | null;
  };

  oferta: Oferta;

  postOferta: PostOferta;
  pantallasVisitadas: PantallaPostOfertaId[];

  // El analista interviene siempre al final del flujo, cuando el vendedor termina la
  // carga post-oferta. Una operación que el motor rechaza nunca llega a su bandeja.
  analista: {
    tomado: boolean;
    observacion: Observacion | null;
    reenviada: boolean;
  };
  rechazo: Rechazo | null;

  fechaSolicitud: string | null;
  fechaPreaprobacion: string | null;
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
