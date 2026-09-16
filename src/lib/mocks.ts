import type {
  AppNotification,
  ClienteDatos,
  CreditApplication,
  CreditoActivo,
  DeudaTerceros,
  EscenarioMotor,
  LaboralIngresos,
  OrigenCampos,
  PersonaVinculada,
  PostOferta,
  SituacionesCliente,
  TipoCliente,
  WizardStepMeta,
} from "./types";
import {
  CAPITAL_MAXIMO_BASE,
  CAPITAL_MAXIMO_CON_PRECANCELACION,
  recalcularOferta,
} from "./credit";
import { configEfectiva } from "./config";
import { camposDe } from "./campos-post-oferta";
import { onlyDigits } from "./format";

// --- Datos que devuelve la consulta por DNI / CUIL (simula API pública + base interna) ---

export interface RespuestaConsultaCliente {
  datos: ClienteDatos;
  origen: OrigenCampos;
  numeroCliente: string | null;
  tipoCliente: TipoCliente;
  // Se traen con el DNI, antes de evaluar (reunión 11/09, 02:30).
  situaciones: SituacionesCliente;
  // Cliente existente: datos laborales del último trámite, precargados y editables.
  laboral: LaboralIngresos;
  // Base interna del cliente existente: precargan la carga post-oferta (Onboarding §4).
  contacto: { caracteristica: string; numero: string; compania: string; email: string };
  domicilio: {
    calle: string;
    numero: string;
    piso: string;
    departamento: string;
    provincia: string;
    localidad: string;
    codigoPostal: string;
  };
}

export interface CasoDemoCliente extends RespuestaConsultaCliente {
  id: string;
  dni: string;
  cuil: string;
  tag: string;
  titulo: string;
  descripcionCorta: string;
  escenarioMotorDefault: EscenarioMotor;
  creditosActivos: CreditoActivo[];
  deudaTerceros: DeudaTerceros;
}

// ---------------------------------------------------------------------------
// CASOS DE CAMINOS HARDCODEADOS PARA LA DEMO
// ---------------------------------------------------------------------------

// 1. DNI 1 -> Happy Path
export const CASO_HAPPY_PATH: CasoDemoCliente = {
  id: "happy-path",
  dni: "20111111",
  cuil: "20-20111111-3",
  tag: "DNI 1 · Happy Path",
  titulo: "Happy path",
  descripcionCorta: "Motor pasa, sin deudas previas, oferta limpia",
  escenarioMotorDefault: "PASA",
  numeroCliente: "000412",
  tipoCliente: "EXISTENTE",
  situaciones: { bcra: 1, interna: 1 },
  datos: {
    apellido: "Gómez",
    nombre: "Juan Ignacio",
    dni: "20111111",
    cuil: "20-20111111-3",
    genero: "Masculino",
    fechaNacimiento: "15/04/1988",
    domicilio: "Av. Colón 2450, 4° A, Córdoba",
    email: "juanignacio.gomez@gmail.com",
  },
  origen: {
    apellido: "API pública",
    nombre: "API pública",
    dni: "API pública",
    cuil: "API pública",
    genero: "API pública",
    fechaNacimiento: "API pública",
    domicilio: "API pública",
    email: "Base interna",
  },
  contacto: {
    caracteristica: "351",
    numero: "5432100",
    compania: "Personal",
    email: "juanignacio.gomez@gmail.com",
  },
  domicilio: {
    calle: "Av. Colón",
    numero: "2450",
    piso: "4",
    departamento: "A",
    provincia: "Córdoba",
    localidad: "Córdoba",
    codigoPostal: "5000",
  },
  laboral: {
    condicionLaboral: "Empleado fijo",
    fechaInicioLaboral: "10/03/2018",
    bancoCobro: "Banco Santander",
    ingresoBruto: 1_500_000,
    ingresoNeto: 1_200_000,
    montoExtraidoDiaCobro: 950_000,
    cuitEmpleador: "30712345671",
    disponible: 0,
    debitosNoRemunerativos: 0,
    extraccionesFecha: "",
    extraccionesImporte: 0,
    transferenciasFecha: "",
    transferenciasImporte: 0,
  },
  creditosActivos: [],
  deudaTerceros: { habilitado: false, entidad: "", importe: 0, cbu: "" },
};

// 2. DNI 2 -> Rechazo
export const CASO_RECHAZO: CasoDemoCliente = {
  id: "rechazo",
  dni: "20222222",
  cuil: "20-20222222-7",
  tag: "DNI 2 · Rechazo",
  titulo: "Rechazo",
  descripcionCorta: "BCRA 4, motor rechaza con carencia 30 días",
  escenarioMotorDefault: "NO_PASA",
  numeroCliente: "000789",
  tipoCliente: "EXISTENTE",
  situaciones: { bcra: 4, interna: 3 },
  datos: {
    apellido: "Benítez",
    nombre: "Marcos Daniel",
    dni: "20222222",
    cuil: "20-20222222-7",
    genero: "Masculino",
    fechaNacimiento: "22/08/1985",
    domicilio: "San Jerónimo 1840, Córdoba",
    email: "marcos.benitez@outlook.com",
  },
  origen: {
    apellido: "API pública",
    nombre: "API pública",
    dni: "API pública",
    cuil: "API pública",
    genero: "API pública",
    fechaNacimiento: "API pública",
    domicilio: "API pública",
    email: "Base interna",
  },
  contacto: {
    caracteristica: "351",
    numero: "4889900",
    compania: "Claro",
    email: "marcos.benitez@outlook.com",
  },
  domicilio: {
    calle: "San Jerónimo",
    numero: "1840",
    piso: "",
    departamento: "",
    provincia: "Córdoba",
    localidad: "Córdoba",
    codigoPostal: "5000",
  },
  laboral: {
    condicionLaboral: "Empleado fijo",
    fechaInicioLaboral: "05/06/2021",
    bancoCobro: "Banco Macro",
    ingresoBruto: 950_000,
    ingresoNeto: 750_000,
    montoExtraidoDiaCobro: 600_000,
    cuitEmpleador: "30654321982",
    disponible: 0,
    debitosNoRemunerativos: 0,
    extraccionesFecha: "",
    extraccionesImporte: 0,
    transferenciasFecha: "",
    transferenciasImporte: 0,
  },
  creditosActivos: [],
  deudaTerceros: { habilitado: false, entidad: "", importe: 0, cbu: "" },
};

// 3. DNI 3 -> Cliente con crédito interno
export const CASO_CREDITO_INTERNO: CasoDemoCliente = {
  id: "credito-interno",
  dni: "20333333",
  cuil: "27-20333333-4",
  tag: "DNI 3 · Crédito interno",
  titulo: "Crédito interno",
  descripcionCorta: "Préstamo propio vigente CR-000102 a renovar",
  escenarioMotorDefault: "PASA",
  numeroCliente: "000928",
  tipoCliente: "EXISTENTE",
  situaciones: { bcra: 2, interna: 1 },
  datos: {
    apellido: "González",
    nombre: "María Fernanda",
    dni: "20333333",
    cuil: "27-20333333-4",
    genero: "Femenino",
    fechaNacimiento: "14/05/1982",
    domicilio: "Av. Rafael Núñez 3245, 3° B, Córdoba",
    email: "mariafernanda.gonzalez@gmail.com",
  },
  origen: {
    apellido: "API pública",
    nombre: "API pública",
    dni: "API pública",
    cuil: "API pública",
    genero: "API pública",
    fechaNacimiento: "API pública",
    domicilio: "API pública",
    email: "Base interna",
  },
  contacto: {
    caracteristica: "351",
    numero: "6123344",
    compania: "Claro",
    email: "mariafernanda.gonzalez@gmail.com",
  },
  domicilio: {
    calle: "Av. Rafael Núñez",
    numero: "3245",
    piso: "3",
    departamento: "B",
    provincia: "Córdoba",
    localidad: "Córdoba",
    codigoPostal: "5000",
  },
  laboral: {
    condicionLaboral: "Empleado fijo",
    fechaInicioLaboral: "12/03/2019",
    bancoCobro: "Banco Galicia",
    ingresoBruto: 1_250_000,
    ingresoNeto: 1_000_000,
    montoExtraidoDiaCobro: 820_000,
    cuitEmpleador: "30712345671",
    disponible: 0,
    debitosNoRemunerativos: 0,
    extraccionesFecha: "",
    extraccionesImporte: 0,
    transferenciasFecha: "",
    transferenciasImporte: 0,
  },
  creditosActivos: [
    {
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
      cuotasAbonadas: 14,
      valorCuota: 108_700,
      precancelar: false,
    },
  ],
  deudaTerceros: { habilitado: false, entidad: "", importe: 0, cbu: "" },
};

// 4. DNI 4 -> Cliente con crédito externo
export const CASO_CREDITO_EXTERNO: CasoDemoCliente = {
  id: "credito-externo",
  dni: "20444444",
  cuil: "20-20444444-1",
  tag: "DNI 4 · Crédito externo",
  titulo: "Crédito externo",
  descripcionCorta: "Deuda terceros en Tarjeta Naranja $350.000",
  escenarioMotorDefault: "PASA",
  numeroCliente: "001150",
  tipoCliente: "EXISTENTE",
  situaciones: { bcra: 1, interna: 1 },
  datos: {
    apellido: "Romero",
    nombre: "Lucas Matías",
    dni: "20444444",
    cuil: "20-20444444-1",
    genero: "Masculino",
    fechaNacimiento: "08/11/1990",
    domicilio: "Mariano Fragueiro 1280, Alta Córdoba, Córdoba",
    email: "lucas.romero@hotmail.com",
  },
  origen: {
    apellido: "API pública",
    nombre: "API pública",
    dni: "API pública",
    cuil: "API pública",
    genero: "API pública",
    fechaNacimiento: "API pública",
    domicilio: "API pública",
    email: "Base interna",
  },
  contacto: {
    caracteristica: "351",
    numero: "7654321",
    compania: "Movistar",
    email: "lucas.romero@hotmail.com",
  },
  domicilio: {
    calle: "Mariano Fragueiro",
    numero: "1280",
    piso: "",
    departamento: "",
    provincia: "Córdoba",
    localidad: "Córdoba",
    codigoPostal: "5000",
  },
  laboral: {
    condicionLaboral: "Empleado fijo",
    fechaInicioLaboral: "01/09/2020",
    bancoCobro: "Banco BBVA",
    ingresoBruto: 1_400_000,
    ingresoNeto: 1_100_000,
    montoExtraidoDiaCobro: 900_000,
    cuitEmpleador: "30709988771",
    disponible: 0,
    debitosNoRemunerativos: 0,
    extraccionesFecha: "",
    extraccionesImporte: 0,
    transferenciasFecha: "",
    transferenciasImporte: 0,
  },
  creditosActivos: [],
  deudaTerceros: {
    habilitado: true,
    entidad: "Tarjeta Naranja",
    importe: 350_000,
    cbu: "2850590940090418135201",
  },
};

// 5. DNI 5 -> Cliente con ambos créditos
export const CASO_AMBOS_CREDITOS: CasoDemoCliente = {
  id: "ambos-creditos",
  dni: "20555555",
  cuil: "23-20555555-4",
  tag: "DNI 5 · Ambos créditos",
  titulo: "Ambos créditos",
  descripcionCorta: "Crédito interno CR-000215 + deuda Santander $300.000",
  escenarioMotorDefault: "PASA",
  numeroCliente: "001320",
  tipoCliente: "EXISTENTE",
  situaciones: { bcra: 2, interna: 2 },
  datos: {
    apellido: "Castro",
    nombre: "Valeria Soledad",
    dni: "20555555",
    cuil: "23-20555555-4",
    genero: "Femenino",
    fechaNacimiento: "03/07/1987",
    domicilio: "Chacabuco 450, 7° C, Córdoba",
    email: "valeria.castro@gmail.com",
  },
  origen: {
    apellido: "API pública",
    nombre: "API pública",
    dni: "API pública",
    cuil: "API pública",
    genero: "API pública",
    fechaNacimiento: "API pública",
    domicilio: "API pública",
    email: "Base interna",
  },
  contacto: {
    caracteristica: "351",
    numero: "3216549",
    compania: "Personal",
    email: "valeria.castro@gmail.com",
  },
  domicilio: {
    calle: "Chacabuco",
    numero: "450",
    piso: "7",
    departamento: "C",
    provincia: "Córdoba",
    localidad: "Córdoba",
    codigoPostal: "5000",
  },
  laboral: {
    condicionLaboral: "Empleado fijo",
    fechaInicioLaboral: "15/04/2017",
    bancoCobro: "Banco Provincia",
    ingresoBruto: 1_700_000,
    ingresoNeto: 1_350_000,
    montoExtraidoDiaCobro: 1_100_000,
    cuitEmpleador: "30715566778",
    disponible: 0,
    debitosNoRemunerativos: 0,
    extraccionesFecha: "",
    extraccionesImporte: 0,
    transferenciasFecha: "",
    transferenciasImporte: 0,
  },
  creditosActivos: [
    {
      id: "CR-000215",
      capitalOriginal: 1_800_000,
      capitalResidual: 750_000,
      montoCancelacion: 900_000,
      desglose: {
        capitalResidual: 750_000,
        interesesAVencer: 90_000,
        iva: 35_000,
        cargosCancelacion: 25_000,
        punitorios: 0,
      },
      cuotasOriginales: 24,
      cuotasAbonadas: 15,
      valorCuota: 125_000,
      precancelar: true,
    },
  ],
  deudaTerceros: {
    habilitado: true,
    entidad: "Banco Santander",
    importe: 300_000,
    cbu: "0720123488000034567890",
  },
};

// 6. DNI X -> Cliente nuevo (base por defecto y fallback dinámico)
export const CASO_CLIENTE_NUEVO_BASE: CasoDemoCliente = {
  id: "cliente-nuevo",
  dni: "40999999",
  cuil: "20-40999999-4",
  tag: "DNI X · Cliente nuevo",
  titulo: "Cliente nuevo",
  descripcionCorta: "Sin historial previo, aplica limitante nuevo",
  escenarioMotorDefault: "PASA",
  numeroCliente: null,
  tipoCliente: "NUEVO",
  situaciones: { bcra: 1, interna: 1 },
  datos: {
    apellido: "Rossi",
    nombre: "Tomás Agustín",
    dni: "40999999",
    cuil: "20-40999999-4",
    genero: "Masculino",
    fechaNacimiento: "18/09/1997",
    domicilio: "Bv. San Juan 890, 2° A, Córdoba",
    email: "tomas.rossi@gmail.com",
  },
  origen: {
    apellido: "API pública",
    nombre: "API pública",
    dni: "API pública",
    cuil: "API pública",
    genero: "API pública",
    fechaNacimiento: "API pública",
    domicilio: "API pública",
    email: "Manual",
  },
  contacto: {
    caracteristica: "351",
    numero: "2233445",
    compania: "Claro",
    email: "tomas.rossi@gmail.com",
  },
  domicilio: {
    calle: "Bv. San Juan",
    numero: "890",
    piso: "2",
    departamento: "A",
    provincia: "Córdoba",
    localidad: "Córdoba",
    codigoPostal: "5000",
  },
  laboral: {
    condicionLaboral: "Empleado fijo",
    fechaInicioLaboral: "10/02/2023",
    bancoCobro: "Banco Nación",
    ingresoBruto: 1_150_000,
    ingresoNeto: 950_000,
    montoExtraidoDiaCobro: 700_000,
    cuitEmpleador: "30708912345",
    disponible: 0,
    debitosNoRemunerativos: 0,
    extraccionesFecha: "",
    extraccionesImporte: 0,
    transferenciasFecha: "",
    transferenciasImporte: 0,
  },
  creditosActivos: [],
  deudaTerceros: { habilitado: false, entidad: "", importe: 0, cbu: "" },
};

// Diccionario de casos preconfigurados
export const CASOS_CLIENTES_DEMO: Record<string, CasoDemoCliente> = {
  "20111111": CASO_HAPPY_PATH,
  "20222222": CASO_RECHAZO,
  "20333333": CASO_CREDITO_INTERNO,
  "27456890": CASO_CREDITO_INTERNO, // compatibilidad con mock anterior
  "20444444": CASO_CREDITO_EXTERNO,
  "20555555": CASO_AMBOS_CREDITOS,
  "40999999": CASO_CLIENTE_NUEVO_BASE,
};

// Lista ordenada para los accesos rápidos en la interfaz
export const LISTA_CASOS_DEMO: CasoDemoCliente[] = [
  CASO_HAPPY_PATH,
  CASO_RECHAZO,
  CASO_CREDITO_INTERNO,
  CASO_CREDITO_EXTERNO,
  CASO_AMBOS_CREDITOS,
  CASO_CLIENTE_NUEVO_BASE,
];

/**
 * Resuelve el caso correspondiente al DNI o CUIL ingresado.
 * Si el DNI no está entre los preconfigurados (1 a 5), se trata como DNI X (Cliente nuevo),
 * adaptando el documento a lo ingresado con datos específicos hardcodeados.
 */
export function obtenerCasoPorDocumento(documento: string): CasoDemoCliente {
  const digits = onlyDigits(documento);
  if (CASOS_CLIENTES_DEMO[digits]) {
    return CASOS_CLIENTES_DEMO[digits];
  }

  // Búsqueda si se ingresó un CUIL (11 dígitos)
  if (digits.length === 11) {
    const dni8 = digits.slice(2, 10);
    if (CASOS_CLIENTES_DEMO[dni8]) return CASOS_CLIENTES_DEMO[dni8];
    const dni7 = digits.slice(2, 9);
    if (CASOS_CLIENTES_DEMO[dni7]) return CASOS_CLIENTES_DEMO[dni7];
  }

  // DNI X: cualquier otro DNI devuelve un cliente nuevo con datos específicos
  const dniFinal = digits || "40999999";
  const cuilFinal = `20-${dniFinal.padStart(8, "0")}-4`;
  return {
    ...CASO_CLIENTE_NUEVO_BASE,
    dni: dniFinal,
    cuil: cuilFinal,
    datos: {
      ...CASO_CLIENTE_NUEVO_BASE.datos,
      dni: dniFinal,
      cuil: cuilFinal,
    },
  };
}

// Compatibilidad hacia atrás
export const CONSULTA_CLIENTE_MOCK: RespuestaConsultaCliente = CASO_CREDITO_INTERNO;

// Campos que autocompleta la API pública (Guía §3.1).
export const DATOS_API_PUBLICA: { campo: keyof ClienteDatos; label: string }[] = [
  { campo: "nombre", label: "Nombre" },
  { campo: "apellido", label: "Apellido" },
  { campo: "domicilio", label: "Domicilio" },
  { campo: "fechaNacimiento", label: "Fecha de nacimiento" },
  { campo: "genero", label: "Género" },
];

// --- Crédito propio vigente, elegible para renovación / precancelación ---

function creditosActivosIniciales(): CreditoActivo[] {
  return [
    {
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
    },
  ];
}

// Valores que se proponen al activar la cancelación de deuda con terceros.
export const DEUDA_TERCEROS_DEMO = {
  entidad: "Tarjeta Naranja",
  importe: 100_000,
  cbu: "2850590940090418135201",
};

// --- Post-oferta ---

// Vacía hasta que se comienza la carga: recién ahí se precarga (ver `precargarPostOferta`).
function crearPostOfertaInicial(): PostOferta {
  return {
    precarga: {},
    personales: {},
    laboral: {},
    tarjetas: [],
    referencias: [],
    garantes: [],
    legajo: {},
    impresion: null,
  };
}

// Valores de demo para los campos a cargar, como si el vendedor ya hubiera avanzado. Quedan
// pendientes a propósito: DNI del cónyuge, email de la referencia, el recibo y el
// comprobante de servicio (estos dos últimos se cargan en el legajo virtual, post-oferta).
const CARGA_DEMO: Record<string, string> = {
  nacionalidad: "Argentina",
  estadoCivil: "Casada/o",
  tipoVivienda: "Propietario",
  personasACargo: "2",
  tieneConyuge: "Sí",
  dniConyuge: "", // PENDIENTE
  "domicilio.barrio": "Cerro de las Rosas",
  cuitEmpleador: "30712345679",
  razonSocial: "Sanatorio Modelo S.A.",
  rubro: "Salud - Servicios sanatoriales",
  numeroLegajo: "SM-4821",
  cargo: "Enfermera profesional",
  "domicilioLaboral.calle": "Bv. Los Andes",
  "domicilioLaboral.numero": "1250",
  "domicilioLaboral.barrio": "Alta Córdoba",
  "domicilioLaboral.provincia": "Córdoba",
  "domicilioLaboral.localidad": "Córdoba",
  "domicilioLaboral.codigoPostal": "5000",
  "telefonoLaboral.caracteristica": "351",
  "telefonoLaboral.numero": "4228890",
  "telefonoLaboral.interno": "112",
  "telefonoLaboral.horario": "Lunes a viernes de 8 a 16 h",
  cbu: "0170299940000052135212",
};

/**
 * Arma la carga post-oferta la primera vez que se comienza (Onboarding §3–§5).
 *
 * Precargados: la identificación sale del pedido inicial, el contacto y el domicilio de la base
 * interna del cliente existente y el banco de los datos mínimos. Quedan guardados en
 * `precarga` para poder mostrar después qué dato se rectificó.
 */
export function precargarPostOferta(app: CreditApplication): PostOferta {
  const c = app.cliente;
  const base = c?.dni ? obtenerCasoPorDocumento(c.dni) : CONSULTA_CLIENTE_MOCK;
  const precarga: Record<string, string> = {
    nombreCompleto: c ? `${c.nombre} ${c.apellido}` : "",
    dni: c?.dni ?? "",
    cuit: onlyDigits(c?.cuil ?? ""),
    fechaNacimiento: c?.fechaNacimiento ?? "",
    genero: c?.genero ?? "",
    "domicilio.calle": base.domicilio.calle,
    "domicilio.numero": base.domicilio.numero,
    "domicilio.piso": base.domicilio.piso,
    "domicilio.departamento": base.domicilio.departamento,
    "domicilio.provincia": base.domicilio.provincia,
    "domicilio.localidad": base.domicilio.localidad,
    "domicilio.codigoPostal": base.domicilio.codigoPostal,
    "telefono.caracteristica": base.contacto.caracteristica,
    "telefono.numero": base.contacto.numero,
    companiaTelefonica: base.contacto.compania,
    email: base.contacto.email,
    banco: app.laboral.bancoCobro,
  };
  const valores = (pantalla: "personales" | "laboral") =>
    Object.fromEntries(
      camposDe(pantalla)
        .filter((campo) => campo.origen !== "NO_MODIFICABLE")
        .map((campo) => [campo.id, precarga[campo.id] ?? CARGA_DEMO[campo.id] ?? ""])
    );

  const cfg = configEfectiva(app.configuracion);
  // El recibo (sueldo o haberes) y el comprobante de servicio se piden en el legajo
  // virtual, post-oferta: quedan pendientes al arrancar la carga.
  const PENDIENTES = new Set(["recibo-sueldo", "recibo-haberes", "comprobante-servicio"]);
  const legajo = Object.fromEntries(
    cfg.documentos
      .filter((d) => d.obligatorio && !PENDIENTES.has(d.tipoId))
      .map((d) => [
        d.tipoId,
        [{ id: `${d.tipoId}-1`, nombre: `${d.tipoId.replace(/-/g, "_")}_1.jpg`, detalle: "1.1 MB · Hoy" }],
      ])
  );
  const conGarantias = cfg.pantallas.some((p) => p.id === "garantias" && p.visible);
  const garante: PersonaVinculada = {
    id: "garante-1",
    vinculo: "Cónyuge",
    dni: "25984123",
    nombreCompleto: "Roberto González",
    domicilio: "Av. Rafael Núñez 3245, 3° B, Córdoba",
    email: "roberto.gonzalez@gmail.com",
    autocompletado: true,
  };

  return {
    precarga,
    personales: valores("personales"),
    laboral: valores("laboral"),
    tarjetas: [],
    referencias: [
      {
        id: "referencia-1",
        vinculo: "Familiar directo",
        dni: "30111222",
        nombreCompleto: "Carla Giménez",
        domicilio: "Av. Colón 1450, Córdoba",
        email: "", // PENDIENTE
        autocompletado: true,
      },
    ],
    garantes: conGarantias ? [garante] : [],
    legajo,
    impresion: null,
  };
}

// API simulada de consulta por DNI para referencias y garantes (Onboarding §7): cualquier
// DNI válido devuelve una persona de prueba.
const PERSONAS_API = [
  { nombreCompleto: "Lucía Fernández", domicilio: "Obispo Trejo 520, Córdoba" },
  { nombreCompleto: "Martín Sosa", domicilio: "Av. Vélez Sarsfield 1820, Córdoba" },
  { nombreCompleto: "Valeria Paz", domicilio: "Duarte Quirós 910, Córdoba" },
  { nombreCompleto: "Diego Romero", domicilio: "Av. Hipólito Yrigoyen 355, Córdoba" },
];

export function consultarPersonaMock(dni: string) {
  const ultimo = Number(onlyDigits(dni).slice(-1) || "0");
  return PERSONAS_API[ultimo % PERSONAS_API.length];
}

// --- Estado inicial de la aplicación ---

export function crearAplicacionInicial(): CreditApplication {
  return {
    numeroCredito: null,
    numeroCliente: null,
    estado: "BORRADOR",
    etapa: "ORIGINACION",
    tipoPersona: "FISICA",
    identificacion: { documento: "", consultado: false, tipoCliente: null },
    cliente: null,
    situaciones: null,
    origenCampos: {},
    identidadVerificada: false,
    configuracion: {
      productoId: "prestamo-personal",
      organismoId: "empleados-salud",
      canalId: "sucursal",
      vendedorId: "juan-perez",
    },
    laboral: {
      condicionLaboral: "",
      fechaInicioLaboral: "",
      bancoCobro: "",
      ingresoBruto: 0,
      ingresoNeto: 0,
      montoExtraidoDiaCobro: 0,
      cuitEmpleador: "",
      disponible: 0,
      debitosNoRemunerativos: 0,
      extraccionesFecha: "",
      extraccionesImporte: 0,
      transferenciasFecha: "",
      transferenciasImporte: 0,
    },
    riesgo: {
      estado: "PENDIENTE",
      motorId: null,
      escenario: "PASA",
      reglas: [],
      institucionales: [],
      resultado: null,
      planId: null,
      limites: null,
      evaluadoCon: null,
      fecha: null,
    },
    oferta: recalcularOferta({
      capitalMaximoBase: CAPITAL_MAXIMO_BASE,
      capitalMaximoRenovacion: CAPITAL_MAXIMO_CON_PRECANCELACION,
      capitalMaximoActual: CAPITAL_MAXIMO_BASE,
      montoSolicitado: CAPITAL_MAXIMO_BASE,
      plazo: 12,
      tna: 58,
      valorCuota: 0,
      totalAPagar: 0,
      primeraCuotaVencimiento: "10/10/2026",
      creditosActivos: creditosActivosIniciales(),
      deudaTerceros: { habilitado: false, entidad: "", importe: 0, cbu: "" },
      aceptada: false,
    }),
    postOferta: crearPostOfertaInicial(),
    pantallasVisitadas: [],
    analista: { tomado: false, observacion: null, reenviada: false },
    rechazo: null,
    fechaSolicitud: null,
    fechaPreaprobacion: null,
    fechaEnvioAnalisis: null,
    fechaAprobacion: null,
  };
}

// --- Pasos de la etapa pre-oferta (Guía §3–§5) ---

// Orden del flujo según Arquitectura v3 §2 y Onboarding v4 §2 (14/09/2026):
// Canal → Tipo de persona → Identificación → Producto + Organismo → Datos laborales →
// Reglas institucionales + Motor + Límites + Plan → Primera oferta.
export const STEPS_ORIGINACION: WizardStepMeta[] = [
  {
    id: "identificacion",
    numero: 1,
    titulo: "Identificación",
    tituloPantalla: "Identificación",
    descripcion:
      "Quién pide el crédito y con qué documento se identifica. El vendedor se toma automáticamente de la sesión.",
  },
  {
    id: "producto-organismo",
    numero: 2,
    titulo: "Producto y organismo",
    tituloPantalla: "Producto y organismo",
    descripcion:
      "El producto define la configuración general y el organismo la particulariza. El canal limita qué productos se pueden ofrecer.",
  },
  {
    id: "datos-cliente",
    numero: 3,
    titulo: "Datos del cliente",
    tituloPantalla: "Datos del cliente",
    descripcion:
      "Revisá lo que trajo la consulta: si es un cliente nuevo o existente, autocompleta los datos y evalúa las reglas institucionales que ya tienen sus datos.",
  },
  {
    id: "datos-minimos",
    numero: 4,
    titulo: "Datos laborales",
    tituloPantalla: "Datos laborales",
    descripcion:
      "Sólo los datos que las reglas y el motor necesitan para evaluar. El resto del legajo se carga después de la oferta.",
  },
  {
    id: "evaluacion",
    numero: 5,
    titulo: "Evaluación",
    tituloPantalla: "Reglas, motor, límites y plan",
    descripcion:
      "Se genera el ID de Crédito. Se evalúan las reglas institucionales, el motor decide si pasa, se determinan los límites y el plan calcula la primera oferta.",
  },
  {
    id: "oferta",
    numero: 6,
    titulo: "Oferta",
    tituloPantalla: "Oferta de crédito",
    descripcion:
      "Primera oferta. Si el cliente precancela créditos se recalcula una nueva oferta antes de aceptarla.",
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
