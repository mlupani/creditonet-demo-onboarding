import type {
  AppNotification,
  ClienteDatos,
  CreditApplication,
  CreditoActivo,
  LaboralIngresos,
  OrigenCampos,
  PostOferta,
  TipoCliente,
  WizardStepMeta,
} from "./types";
import { CAPITAL_MAXIMO_BASE, recalcularOferta } from "./credit";

// --- Datos que devuelve la consulta por DNI / CUIL (simula API pública + base interna) ---

export interface RespuestaConsultaCliente {
  datos: ClienteDatos;
  origen: OrigenCampos;
  numeroCliente: string;
  tipoCliente: TipoCliente;
  // Cliente existente: datos laborales del último trámite, precargados y editables.
  laboral: LaboralIngresos;
}

export const CONSULTA_CLIENTE_MOCK: RespuestaConsultaCliente = {
  datos: {
    apellido: "González",
    nombre: "María Fernanda",
    dni: "27456890",
    cuil: "27-27456890-4",
    genero: "Femenino",
    fechaNacimiento: "14/05/1982",
    domicilio: "Av. Rafael Núñez 3245, 3° B, Córdoba",
  },
  origen: {
    apellido: "API pública",
    nombre: "API pública",
    dni: "API pública",
    cuil: "API pública",
    genero: "API pública",
    fechaNacimiento: "API pública",
    domicilio: "API pública",
  },
  numeroCliente: "000928",
  tipoCliente: "EXISTENTE",
  laboral: {
    fechaInicioLaboral: "12/03/2019",
    bancoCobro: "Banco Galicia",
    ingresoBruto: 1_250_000,
    ingresoNeto: 1_000_000,
    montoExtraidoDiaCobro: 820_000,
  },
};

// Campos que autocompleta la API pública (Guía §3.1).
export const DATOS_API_PUBLICA: { campo: keyof ClienteDatos; label: string }[] = [
  { campo: "nombre", label: "Nombre" },
  { campo: "apellido", label: "Apellido" },
  { campo: "domicilio", label: "Domicilio" },
  { campo: "fechaNacimiento", label: "Fecha de nacimiento" },
  { campo: "genero", label: "Género" },
];

// --- Crédito propio vigente, elegible para renovación / precancelación ---

function creditoActivoInicial(): CreditoActivo {
  return {
    id: "CR-000102",
    capitalOriginal: 1_500_000,
    capitalResidual: 850_000,
    montoCancelacion: 1_000_000,
    desglose: {
      capitalResidual: 850_000,
      interesesAVencer: 100_000,
      iva: 30_000,
      cargosCancelacion: 20_000,
      punitorios: 0,
    },
    cuotasOriginales: 24,
    cuotasAbonadas: 13,
    valorCuota: 108_700,
    precancelar: false,
  };
}

// Valores que se proponen al activar la cancelación de deuda con terceros.
export const DEUDA_TERCEROS_DEMO = {
  entidad: "Tarjeta Naranja",
  importe: 100_000,
  cbu: "2850590940090418135201",
};

// --- Post-oferta: estado inicial con 3 ítems pendientes a propósito ---

function crearPostOfertaInicial(): PostOferta {
  return {
    laboral: {
      domicilioLaboral: "Bv. Los Andes 1250, Córdoba",
      fechaIngresoLaboral: "12/03/2019",
      razonSocial: "Sanatorio Modelo S.A.",
      rubro: "Salud - Servicios sanatoriales",
      provincia: "Córdoba",
      telefonoLaboral: "351 422-8890",
      numeroLegajo: "SM-4821",
      bancoCobro: "Banco Galicia",
      cbu: "0170299940000052135212",
    },
    personales: {
      email: "mariafernanda.gonzalez@gmail.com",
      domicilioReal: "Av. Rafael Núñez 3245, 3° B, Córdoba",
      telefonoCelular: "", // PENDIENTE
      nacionalidad: "Argentina",
      estadoCivil: "Casada/o",
      tipoVivienda: "Propietario",
      hijosACargo: "2",
      tarjetaCredito: "Sí",
    },
    tokenizacion: {
      tipoTarjeta: "CREDITO",
      numero: "",
      vencimiento: "",
      marca: "",
      cvv: "",
      tokenizada: false,
      token: null,
    },
    referencias: [
      {
        id: "ref-1",
        nombre: "Carla Giménez",
        telefono: "351 544-2210",
        email: "", // PENDIENTE
        domicilio: "Av. Colón 1450, Córdoba",
        relacion: "Familiar directo",
      },
    ],
    garante: {
      nombre: "Roberto González",
      dni: "25984123",
      telefono: "351 555-8834",
      datosLaborales: "Empleado público · 11 años de antigüedad",
      ingresos: 1_400_000,
      lugarTrabajo: "Municipalidad de Córdoba",
    },
    garanteDocs: [
      {
        id: "gar-recibo",
        nombre: "Recibo de sueldo del garante",
        estado: "CARGADO",
        archivo: "recibo_garante_demo.pdf",
        detalle: "312 KB · Hoy",
      },
      {
        id: "gar-dni",
        nombre: "DNI del garante",
        estado: "CARGADO",
        archivo: "dni_garante_demo.jpg",
        detalle: "1.0 MB · Hoy",
      },
    ],
    legajo: [
      {
        id: "dni-frente",
        nombre: "DNI frente",
        categoria: "Identidad",
        estado: "CARGADO",
        archivo: "dni_frente_demo.jpg",
        detalle: "1.2 MB · Hoy",
      },
      {
        id: "dni-dorso",
        nombre: "DNI dorso",
        categoria: "Identidad",
        estado: "CARGADO",
        archivo: "dni_dorso_demo.jpg",
        detalle: "1.1 MB · Hoy",
      },
      {
        id: "recibo-sueldo",
        nombre: "Recibo de sueldo",
        categoria: "Ingresos",
        estado: "CARGADO",
        archivo: "recibo_sueldo_demo.pdf",
        detalle: "380 KB · Hoy",
      },
      {
        id: "comprobante-servicio",
        nombre: "Comprobante de servicio",
        categoria: "Domicilio",
        estado: "PENDIENTE", // PENDIENTE
      },
    ],
    impresionGenerada: false,
  };
}

// --- Estado inicial de la aplicación ---

export function crearAplicacionInicial(): CreditApplication {
  return {
    numeroCredito: null,
    numeroCliente: null,
    estado: "BORRADOR",
    etapa: "ORIGINACION",
    identificacion: { documento: "", consultado: false, tipoCliente: null },
    cliente: null,
    origenCampos: {},
    identidadVerificada: false,
    configuracion: {
      productoId: "prestamo-personal",
      organismoId: "empleados-salud",
      canalId: "venta-directa",
      vendedorId: "juan-perez",
    },
    laboral: {
      fechaInicioLaboral: "",
      bancoCobro: "",
      ingresoBruto: 0,
      ingresoNeto: 0,
      montoExtraidoDiaCobro: 0,
    },
    riesgo: {
      estado: "PENDIENTE",
      reglas: [],
      resultado: null,
      evaluadoCon: null,
      fecha: null,
    },
    oferta: recalcularOferta({
      capitalMaximoBase: CAPITAL_MAXIMO_BASE,
      capitalMaximoActual: CAPITAL_MAXIMO_BASE,
      montoSolicitado: CAPITAL_MAXIMO_BASE,
      plazo: 12,
      tna: 58,
      valorCuota: 0,
      totalAPagar: 0,
      primeraCuotaVencimiento: "10/10/2026",
      creditosActivos: [creditoActivoInicial()],
      deudaTerceros: { habilitado: false, entidad: "", importe: 0, cbu: "" },
      aceptada: false,
    }),
    postOferta: crearPostOfertaInicial(),
    pantallasVisitadas: [],
    analista: { tomado: false, observacion: null, reenviada: false },
    rechazo: null,
    fechaSolicitud: null,
    fechaEnvioAnalisis: null,
    fechaAprobacion: null,
  };
}

// --- Pasos de la etapa pre-oferta (Guía §3–§5) ---

export const STEPS_ORIGINACION: WizardStepMeta[] = [
  {
    id: "identificacion",
    numero: 1,
    titulo: "Identificación",
    tituloPantalla: "Identificación del cliente",
    descripcion: "Ingresá el DNI o CUIL. Los datos se autocompletan desde fuentes externas.",
  },
  {
    id: "datos-minimos",
    numero: 2,
    titulo: "Producto y datos mínimos",
    tituloPantalla: "Selección comercial y datos mínimos",
    descripcion: "Producto, organismo y los datos laborales y financieros que requiere el producto.",
  },
  {
    id: "solicitar",
    numero: 3,
    titulo: "Solicitar",
    tituloPantalla: "Solicitar y evaluar",
    descripcion: "Se genera el ID de Crédito. El motor de riesgo filtra y el plan de cuotas calcula la oferta.",
  },
  {
    id: "oferta",
    numero: 4,
    titulo: "Oferta",
    tituloPantalla: "Oferta de crédito",
    descripcion: "Ajustá el importe, el plazo, las renovaciones y las cancelaciones antes de continuar.",
  },
];

// --- Notificaciones (header) ---

export const NOTIFICACIONES: AppNotification[] = [
  {
    id: "n1",
    titulo: "Solicitudes esperando análisis",
    detalle: "La bandeja del analista de riesgo tiene solicitudes pendientes de revisión.",
    hace: "Hace 12 min",
    tone: "info",
    leida: false,
  },
  {
    id: "n2",
    titulo: "Línea Salud 2026 actualizada",
    detalle: "Se ajustó el tope de relación cuota-ingreso (RCI) del plan de cuotas.",
    hace: "Hace 1 h",
    tone: "warning",
    leida: false,
  },
  {
    id: "n3",
    titulo: "Motor de riesgo actualizado",
    detalle: "Se incorporó la regla de carencia por rechazo a la evaluación.",
    hace: "Ayer 18:40",
    tone: "success",
    leida: true,
  },
];
