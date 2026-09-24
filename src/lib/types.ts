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
  | "CAMBIO_OFERTA"
  | "RECHAZADO"
  // Anulado: el cliente desistió. Lo puede anular el vendedor o el analista, y es distinto
  // de rechazado, que es una decisión de riesgo (reunión 11/09, 01:19).
  | "ANULADO"
  // FEL: esperando la firma del cliente. AFEL: firma recibida, la verifica el analista.
  // Después, si el producto lo pide, chequeo telefónico y recién ahí liquidación.
  // Aprobado (creditonet-87): estado intermedio opcional. El analista puede aprobar directo a FEL
  // o dejar el crédito acá y pasarlo a firma más tarde.
  | "APROBADO"
  | "EN_FIRMA"
  | "FIRMADO"
  // SUP (creditonet-90): aprobación de un superior. Opcional: el analista la pide desde AFEL y,
  // con el visto bueno, el crédito sigue al chequeo telefónico o a liquidación.
  | "SUPERIOR"
  | "CHEQUEO_TELEFONICO"
  | "PARA_LIQUIDAR";

export type MetodoFirma = "ELECTRONICA" | "FISICA";
export type ResultadoFirma = "PENDIENTE" | "APROBADA" | "REFIRMA_SOLICITADA" | "RECHAZADA";

// Una instancia de firma. Se permiten como máximo dos: la original y una única refirma.
export interface IntentoFirma {
  n: 1 | 2;
  metodo: MetodoFirma;
  // null mientras el cliente todavía no firmó (FEL).
  fechaFirma: string | null;
  resultado: ResultadoFirma;
  // Decisión del analista sobre esta firma (null mientras está pendiente).
  fechaResultado: string | null;
}

export const MAX_INTENTOS_FIRMA = 2;

export type ResultadoChequeo = "OK" | "NO_OK";

// Lo lleva el chequeador: toma el crédito, llama al cliente y registra el resultado. Con OK el
// crédito pasa solo a liquidación; con NO_OK se rechaza.
export interface ChequeoTelefonico {
  tomado: boolean;
  resultado: ResultadoChequeo | null;
  comentario: string;
  // Cuándo el crédito entró a chequeo (firma verificada).
  fechaInicio: string | null;
  // Fecha en que el chequeador finalizó el chequeo (null mientras está pendiente o en curso).
  fecha: string | null;
  // Subestado de observación: el chequeo sigue abierto pero no se pudo completar (por ejemplo,
  // el cliente no atendió). Lo ve el canal de venta.
  observacion?: { nota: string; fecha: string } | null;
  // Registro de cada intento que no se pudo completar (creditonet-82). El chequeador no rechaza:
  // deja el intento asentado y el crédito sigue en su bandeja; el rechazo lo decide el analista.
  intentos?: { nota: string; fecha: string }[];
}

export const CHEQUEO_PENDIENTE: ChequeoTelefonico = {
  tomado: false,
  resultado: null,
  comentario: "",
  fechaInicio: null,
  fecha: null,
  observacion: null,
};

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
  calle: string;
  numero: string;
  localidad: string;
  provincia: string;
  email: string;
  telefono: string;
}

export type OrigenCampos = Partial<Record<keyof ClienteDatos, OrigenDato>>;

// Un empleador con su banco de cobro, CUIT y razón social (pluriempleo: varios).
export interface Empleador {
  banco: string;
  cuit: string;
  razonSocial: string;
}

// --- Datos laborales y financieros mínimos (pre-oferta) ---

export interface LaboralIngresos {
  // Fijo, contratado, monotributista… Determina la línea y el motor aplicables.
  condicionLaboral: string;
  fechaInicioLaboral: string;
  // Uno por empleador: banco donde cobra, CUIT y razón social. Agregables uno abajo del otro.
  empleadores: Empleador[];
  ingresoBruto: number;
  ingresoNeto: number;
  // Información adicional: no bloquea continuar (Onboarding §4.4).
  disponible: number;
  debitosNoRemunerativos: number;
  extraccionesImporte: number;
  transferenciasImporte: number;
}

// --- Oferta ---

export type Plazo = 12 | 18 | 24 | 36 | 48 | 60 | 72 | 84 | 96 | 120;

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
  enMora?: boolean;
}

export interface DeudaTerceros {
  habilitado: boolean;
  entidad: string;
  importe: number;
  cbu: string;
}

export interface Oferta {
  // Plan de cuotas con el que se armó la oferta (null hasta que la evaluación elige uno).
  planId: string | null;
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

// Onboarding §6: una o varias tarjetas, por link de WhatsApp, carga presencial o ya guardada
// de un trámite anterior (cliente recurrente). El número completo y el código de seguridad
// nunca se guardan: sólo lo que devuelve el proveedor.
export interface TarjetaTokenizada {
  id: string;
  via: "WHATSAPP" | "PRESENCIAL" | "BASE_INTERNA";
  estado: "ESPERANDO_CLIENTE" | "TOKENIZADA";
  // Sólo aplica a via "BASE_INTERNA": el vendedor tiene que comprobar que la tarjeta
  // precargada del cliente recurrente sigue siendo correcta antes de que cuente como válida.
  verificada?: boolean;
  enviadoA: string | null;
  tipo: TipoTarjeta | null;
  marca: string | null;
  nombreTitular: string | null;
  primeros4: string | null;
  ultimos4: string | null;
  vencimiento: string | null;
  emisor: string | null;
  fechaTokenizacion: string | null;
  token: string | null;
  // Sólo demo: número completo y CVV para "Ver Datos". En prod nunca se guardan.
  numeroCompleto: string | null;
  cvv: string | null;
}

// Onboarding §7–§8: referencias y garantes comparten estructura.
export type TipoPersonaVinculada = "referencia" | "garante";

// Domicilio desglosado (Onboarding §4/§7-§8): mismos campos que Datos personales, provincia
// y localidad salen de Parámetros y el código postal se autocompleta al elegir la localidad.
export interface Domicilio {
  calle: string;
  numero: string;
  piso: string;
  departamento: string;
  provincia: string;
  localidad: string;
  codigoPostal: string;
}

export interface PersonaVinculada {
  id: string;
  vinculo: string;
  dni: string;
  nombre: string;
  apellido: string;
  domicilio: Domicilio;
  email: string;
  telefono: string;
  autocompletado: boolean;
  // Sólo se piden y validan para garantes (Onboarding §8): deben demostrar capacidad de
  // pago para firmar la documentación del préstamo.
  condicionLaboral: string;
  ingresoBruto: number;
  ingresoNeto: number;
  reciboSueldo: ArchivoLegajo[];
  // Otros documentos del garante (opcionales, se cargan en Legajo virtual junto al recibo).
  otrosDocumentos: ArchivoLegajo[];
  // Empleador del garante: calle, localidad, compañía telefónica y teléfono (con área, como
  // "+54 3514228890").
  empleadorCalle: string;
  empleadorLocalidad: string;
  empleadorCompaniaTelefonica: string;
  empleadorTelefono: string;
  // Cuenta del garante, para eventuales débitos si el firmante tiene que responder.
  banco: string;
  cbu: string;
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
  // Pantallas que el vendedor tiene que corregir. Corrección puntual: es lo único que puede
  // editar, el resto de la carga queda bloqueada hasta que se reenvíe. Vacío = sin bloqueo.
  pantallas: PantallaPostOfertaId[];
  // Corrección puntual por campo (creditonet-61): dentro de una pantalla observada, los ids de
  // campo del catálogo (ver campos-post-oferta.ts) que tienen el problema y el vendedor puede
  // tocar. Sin entrada para la pantalla = sin restricción de campo, se edita toda la pantalla
  // (compatibilidad con observaciones previas a esta funcionalidad).
  campos?: Partial<Record<PantallaPostOfertaId, string[]>>;
}

export interface Rechazo {
  // SIN_LINEA: no hay plan de cuotas que admita la condición laboral. No es un rechazo del
  // motor y no llega al analista (02:28).
  // INSTITUCIONAL: una regla institucional bloqueante no pasó; el motor no llega a ejecutarse.
  // CHEQUEADOR: el chequeo telefónico posterior a la firma no fue correcto.
  // SUPERIOR: el superior no aprobó el crédito enviado a SUP.
  origen: "INSTITUCIONAL" | "MOTOR" | "SIN_LINEA" | "ANALISTA" | "CHEQUEADOR" | "SUPERIOR";
  codigos: string[];
  motivo: string;
  observacion: string;
  fecha: string;
}

// Cambio de oferta que el analista propuso y que todavía espera la refrendación del supervisor.
// Hasta entonces no rige: la solicitud sigue En análisis con la oferta original.
export interface CambioOfertaPropuesto {
  montoSolicitado: number;
  plazo: Plazo;
  nota: string;
  fecha: string;
  solicitadoPor: string;
}

// Oferta que dejó el analista al cambiarla (ya refrendada). Es el tope del vendedor: puede
// aceptarla o elegir otra celda de la grilla, pero nunca con más capital ni más cuotas.
export interface OfertaAnalista {
  montoSolicitado: number;
  plazo: Plazo;
  nota: string;
  // El vendedor ya aceptó una oferta dentro del tope: sólo le queda revisar y finalizar.
  aceptada?: boolean;
}

// Cambio de oferta que el analista ya hizo sobre la solicitud. Se permiten hasta
// MAX_CAMBIOS_OFERTA; superado el límite, un nuevo cambio se bloquea salvo excepción del supervisor.
export interface CambioOfertaRegistro {
  tipo: "OFERTA" | "DATOS_FINANCIEROS";
  fecha: string;
  // Sin dato en los registros reconstruidos de la DB simulada.
  montoAnterior: number | null;
  plazoAnterior: Plazo | null;
  montoNuevo: number;
  plazoNuevo: Plazo;
  nota: string;
  autor: string;
  refrendadoPor?: string;
  // Cambio de datos financieros (creditonet-80): cada dato corregido, con el valor anterior y el nuevo.
  datos?: DatoFinancieroCorregido[];
}

export interface DatoFinancieroCorregido {
  campo: string;
  antes: number;
  despues: number;
}

// Comentario que el canal de venta agrega a una solicitud En análisis para el analista.
export interface ComentarioSolicitud {
  id: string;
  autor: string;
  texto: string;
  fecha: string;
}

// Aprobación de un superior (SUP): quién la pidió y, cuando llega, quién la dio.
export interface AprobacionSuperior {
  enviadaPor: string;
  fechaEnvio: string;
  aprobadaPor: string | null;
  fechaAprobacion: string | null;
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
    // Cliente nuevo: firma manuscrita tomada al identificarlo. No es la firma electrónica del
    // crédito: es una referencia para comparar después la firma física cargada al legajo.
    firmaRegistrada: { imagen: string; fecha: string } | null;
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
    // Pantallas observadas que el vendedor ya corrigió y guardó; con todas guardadas puede
    // enviar nuevamente.
    pantallasCorregidas: PantallaPostOfertaId[];
    // Cambio de oferta pendiente de refrendación del supervisor (o null).
    cambioOfertaPendiente: CambioOfertaPropuesto | null;
    // Oferta refrendada que el vendedor tiene que aceptar o reducir (o ausente).
    ofertaAnalista?: OfertaAnalista | null;
    // Cambios de oferta ya hechos por el analista (ausente en créditos anteriores al campo).
    historialCambiosOferta?: CambioOfertaRegistro[];
    // Excepción del supervisor para superar el límite de cambios de oferta (creditonet-78): vale
    // sólo para el cambio siguiente al `n`-ésimo (n = cambios ya hechos al autorizarla).
    excepcionCambioOferta?: { n: number; autorizadoPor: string; fecha: string } | null;
    // El analista leyó y confirmó la observación de una solicitud reenviada (creditonet-75). Hasta
    // entonces no puede operar el crédito; se limpia al observar o al reenviar de nuevo.
    observacionConfirmada?: { fecha: string } | null;
    // Todas las observaciones que el analista le devolvió al canal de venta, en orden. Con los
    // comentarios arma el hilo de conversación (creditonet-88); `observacion` es la vigente.
    historialObservaciones?: Observacion[];
  };
  rechazo: Rechazo | null;
  // Historial de firmas (FEL/AFEL): vacío hasta que el analista aprueba el crédito.
  firmas: IntentoFirma[];
  // Chequeo telefónico (sólo si el producto lo requiere): nace al verificarse la firma.
  chequeoTelefonico: ChequeoTelefonico | null;
  // Aprobación de un superior (sólo si el analista la pidió desde AFEL).
  aprobacionSuperior?: AprobacionSuperior | null;
  comentarios: ComentarioSolicitud[];

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
