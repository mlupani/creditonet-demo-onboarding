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

// --- Datos que devuelve la consulta por DNI (simula API pública + base interna) ---

export interface RespuestaConsultaCliente {
  datos: ClienteDatos;
  origen: OrigenCampos;
  numeroCliente: string;
  tipoCliente: TipoCliente;
  laboral: LaboralIngresos;
}

export const CONSULTA_CLIENTE_MOCK: RespuestaConsultaCliente = {
  datos: {
    apellido: "González",
    nombre: "María Fernanda",
    dni: "27456890",
    cuil: "27-27456890-4",
    sexo: "Femenino",
    fechaNacimiento: "14/05/1982",
    estadoCivil: "Casada/o",
    domicilio: "Av. Rafael Núñez 3245, 3° B",
    localidad: "Córdoba",
    provincia: "Córdoba",
    telefono: "351 512-4478",
    nacionalidad: "Argentina",
  },
  origen: {
    apellido: "API pública",
    nombre: "API pública",
    dni: "API pública",
    cuil: "API pública",
    sexo: "API pública",
    fechaNacimiento: "API pública",
    estadoCivil: "Base interna",
    domicilio: "Base interna",
    localidad: "Base interna",
    provincia: "Base interna",
    telefono: "Base interna",
    nacionalidad: "Base interna",
  },
  numeroCliente: "000928",
  tipoCliente: "EXISTENTE",
  laboral: {
    bancoSueldo: "Banco Galicia",
    cbu: "0170299940000052135212",
    ingresoNeto: 1_000_000,
    ingresoBruto: 1_250_000,
    fechaInicioLaboral: "12/03/2019",
    email: "mariafernanda.gonzalez@gmail.com",
    cuitEmpleador: "30-70891234-5",
    extraccionesFecha: "",
    extraccionesImporte: 0,
    transferenciasFecha: "",
    transferenciasImporte: 0,
    disponible: 0,
    debitosNoRemunerativos: 0,
  },
};

export const DATOS_API_PUBLICA: { campo: keyof ClienteDatos; label: string }[] = [
  { campo: "apellido", label: "Apellido" },
  { campo: "nombre", label: "Nombre" },
  { campo: "cuil", label: "CUIL" },
  { campo: "sexo", label: "Sexo" },
  { campo: "fechaNacimiento", label: "Fecha de nacimiento" },
];

// --- Crédito activo para precancelación ---

function creditoActivoInicial(): CreditoActivo {
  return {
    id: "CR-000102",
    capitalOriginal: 1_500_000,
    capitalResidual: 850_000,
    montoCancelacion: 1_000_000,
    desglose: { capital: 850_000, intereses: 100_000, iva: 30_000, cargos: 20_000 },
    cuotasOriginales: 24,
    cuotaActual: 14,
    precancelar: false,
  };
}

// --- Post-oferta: estado inicial con 3 ítems pendientes a propósito (D2) ---

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
      domicilioCompleto: "Av. Rafael Núñez 3245, 3° B, Córdoba",
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
        estado: "CARGADO",
        archivo: "dni_frente_demo.jpg",
        detalle: "1.2 MB · Hoy",
      },
      {
        id: "dni-dorso",
        nombre: "DNI dorso",
        estado: "CARGADO",
        archivo: "dni_dorso_demo.jpg",
        detalle: "1.1 MB · Hoy",
      },
      {
        id: "recibo-sueldo",
        nombre: "Recibo de sueldo",
        estado: "CARGADO",
        archivo: "recibo_sueldo_demo.pdf",
        detalle: "380 KB · Hoy",
      },
      {
        id: "certificacion-domicilio",
        nombre: "Certificación de domicilio",
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
    tipoPersona: null,
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
      bancoSueldo: "",
      cbu: "",
      ingresoNeto: 0,
      ingresoBruto: 0,
      fechaInicioLaboral: "",
      email: "",
      cuitEmpleador: "",
      extraccionesFecha: "",
      extraccionesImporte: 0,
      transferenciasFecha: "",
      transferenciasImporte: 0,
      disponible: 0,
      debitosNoRemunerativos: 0,
    },
    riesgo: {
      estado: "PENDIENTE",
      reglas: [],
      resultado: null,
      evaluadoConIngresoNeto: null,
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
      deudaTerceros: { habilitado: true, importe: 0 },
      aceptada: false,
    }),
    postOferta: crearPostOfertaInicial(),
    pantallasVisitadas: [],
    analista: { tomado: false, observacion: null, motivoRechazo: null },
    fechaEnvioAnalisis: null,
    fechaAprobacion: null,
  };
}

// --- Pasos de la etapa de originación ---

export const STEPS_ORIGINACION: WizardStepMeta[] = [
  {
    id: "tipo-persona",
    numero: 1,
    titulo: "Tipo de persona",
    tituloPantalla: "¿Qué tipo de persona querés registrar?",
    descripcion: "Elegí si la solicitud corresponde a una persona física o jurídica.",
  },
  {
    id: "identificacion",
    numero: 2,
    titulo: "Identificación",
    tituloPantalla: "Identificación del cliente",
    descripcion: "Ingresá el DNI para consultar los datos disponibles.",
  },
  {
    id: "configuracion",
    numero: 3,
    titulo: "Configuración",
    tituloPantalla: "Configuración de la solicitud",
    descripcion: "Producto, organismo, canal y vendedor. Las opciones dependen de la configuración de CreditoNet.",
  },
  {
    id: "laboral",
    numero: 4,
    titulo: "Datos laborales",
    tituloPantalla: "Datos laborales e ingresos",
    descripcion: "Datos de ingresos y del empleador. Los campos obligatorios habilitan la evaluación.",
  },
  {
    id: "adicionales",
    numero: 5,
    titulo: "Datos adicionales",
    tituloPantalla: "Datos adicionales del cliente",
    descripcion: "Información complementaria. Algunos datos provienen de la base interna del cliente.",
  },
  {
    id: "verificacion",
    numero: 6,
    titulo: "Verificación",
    tituloPantalla: "Verificación de identidad",
    descripcion: "Cotejo de la imagen archivada con la persona presente.",
  },
  {
    id: "riesgo",
    numero: 7,
    titulo: "Motor de riesgo",
    tituloPantalla: "Evaluación de riesgo",
    descripcion: "El motor evalúa la solicitud y genera las condiciones de la oferta.",
  },
  {
    id: "oferta",
    numero: 8,
    titulo: "Oferta",
    tituloPantalla: "Oferta de crédito",
    descripcion: "Revisá y ajustá el importe, el plazo y las cancelaciones antes de aceptar.",
  },
];

// --- Notificaciones (header) ---

export const NOTIFICACIONES: AppNotification[] = [
  {
    id: "n1",
    titulo: "Solicitudes esperando análisis",
    detalle: "La bandeja de análisis tiene solicitudes pendientes de revisión.",
    hace: "Hace 12 min",
    tone: "info",
    leida: false,
  },
  {
    id: "n2",
    titulo: "Nueva regla para Empleados de salud",
    detalle: "Se actualizó el ingreso mínimo requerido por el organismo.",
    hace: "Hace 1 h",
    tone: "warning",
    leida: false,
  },
  {
    id: "n3",
    titulo: "Motor de riesgo actualizado",
    detalle: "Se incorporó la regla de comportamiento interno a la evaluación.",
    hace: "Ayer 18:40",
    tone: "success",
    leida: true,
  },
];
