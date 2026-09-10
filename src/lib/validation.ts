import type {
  CreditApplication,
  DatosLaboralesPost,
  DatosPersonalesPost,
  DeudaTerceros,
  Garante,
  LaboralIngresos,
  PantallaPostOfertaId,
  Referencia,
} from "./types";
import {
  isValidCBU,
  isValidDNI,
  isValidEmail,
  isValidPhone,
  parseFecha,
} from "./format";
import { configEfectiva, pantallasVisibles } from "./config";

// --- Catálogos de opciones (simulan venir de Parámetros) ---

export const ESTADOS_CIVILES = [
  "Casada/o",
  "Soltera/o",
  "Divorciada/o",
  "Viuda/o",
  "Unión convivencial",
];
export const BANCOS = [
  "Banco Galicia",
  "Banco Nación",
  "Banco de Córdoba",
  "Banco Macro",
  "Banco Santander",
  "Banco BBVA",
];
export const RELACIONES_REFERENCIA = [
  "Familiar directo",
  "Amigo",
  "Compañero de trabajo",
  "Otros",
];
export const TIPOS_VIVIENDA = [
  "Propietario",
  "Inquilino",
  "Prestado por familiar/amigo",
];
export const RUBROS = [
  "Salud - Servicios sanatoriales",
  "Salud - Atención primaria",
  "Administración pública",
  "Comercio",
  "Industria",
  "Educación",
];
export const PROVINCIAS = [
  "Córdoba",
  "Buenos Aires",
  "Santa Fe",
  "Mendoza",
  "Tucumán",
  "CABA",
];
export const MARCAS_TARJETA = ["Visa", "Mastercard", "American Express", "Cabal"];
export const GENEROS = ["Femenino", "Masculino", "No binario"];
export const ENTIDADES_ACREEDORAS = [
  "Tarjeta Naranja",
  "Banco Macro",
  "Banco Santander",
  "Tarjeta Cabal",
  "Otra entidad",
];

// Motivos codificados del analista (Guía §7.2, §8).
export const MOTIVOS_RECHAZO = [
  { codigo: "RA-01", label: "Inconsistencia documental insalvable" },
  { codigo: "RA-02", label: "Sospecha de fraude o suplantación de identidad" },
  { codigo: "RA-03", label: "Ingresos no verificables con el empleador" },
  { codigo: "RA-04", label: "Otro motivo (detallar en la observación)" },
];
export const MOTIVOS_OBSERVACION = [
  "Documentación ilegible",
  "Datos inconsistentes",
  "Falta documentación",
  "Otro",
];

// --- Pre-oferta: datos laborales y financieros mínimos ---

export type ErroresLaboral = Partial<Record<keyof LaboralIngresos, string>>;

export function validarLaboral(l: LaboralIngresos): ErroresLaboral {
  const e: ErroresLaboral = {};
  if (!l.fechaInicioLaboral.trim())
    e.fechaInicioLaboral = "Ingresá la fecha de inicio laboral (dd/mm/aaaa).";
  else if (!parseFecha(l.fechaInicioLaboral))
    e.fechaInicioLaboral = "La fecha debe tener el formato dd/mm/aaaa.";
  if (!l.bancoCobro.trim()) e.bancoCobro = "Seleccioná el banco donde el cliente cobra.";
  if (l.ingresoNeto <= 0)
    e.ingresoNeto = "No puede ser $0. Ingresá el ingreso neto mensual del cliente.";
  if (l.ingresoBruto <= 0) e.ingresoBruto = "Ingresá el ingreso bruto mensual del cliente.";
  else if (l.ingresoBruto < l.ingresoNeto)
    e.ingresoBruto = "El ingreso bruto no puede ser menor al neto. Revisá los valores.";
  if (l.montoExtraidoDiaCobro <= 0)
    e.montoExtraidoDiaCobro = "Ingresá el monto extraído o transferido el día de cobro.";
  return e;
}

export function laboralCompleto(l: LaboralIngresos): boolean {
  return Object.keys(validarLaboral(l)).length === 0;
}

// --- Oferta: cancelación de deudas con terceros ---

export function validarDeudaTerceros(
  d: DeudaTerceros
): Partial<Record<"entidad" | "importe" | "cbu", string>> {
  const e: Partial<Record<"entidad" | "importe" | "cbu", string>> = {};
  if (!d.habilitado) return e;
  if (!d.entidad.trim()) e.entidad = "Seleccioná la entidad acreedora.";
  if (d.importe <= 0) e.importe = "Ingresá el monto a cancelar.";
  if (!isValidCBU(d.cbu)) e.cbu = "El CBU de destino debe contener 22 dígitos.";
  return e;
}

// --- Etapa 2: validadores por pantalla ---

const LABEL_LABORAL_POST: Record<keyof DatosLaboralesPost, string> = {
  domicilioLaboral: "Domicilio laboral",
  fechaIngresoLaboral: "Fecha de ingreso laboral",
  razonSocial: "Razón social del empleador",
  rubro: "Rubro / actividad",
  provincia: "Provincia",
  telefonoLaboral: "Teléfono laboral",
  numeroLegajo: "Número de legajo",
  bancoCobro: "Banco donde cobra",
  cbu: "CBU",
};

export function validarLaboralPost(
  l: DatosLaboralesPost
): Partial<Record<keyof DatosLaboralesPost, string>> {
  const e: Partial<Record<keyof DatosLaboralesPost, string>> = {};
  (Object.keys(LABEL_LABORAL_POST) as (keyof DatosLaboralesPost)[]).forEach((k) => {
    if (k === "cbu") {
      if (!isValidCBU(l.cbu)) e.cbu = "El CBU debe contener 22 dígitos.";
      return;
    }
    if (k === "telefonoLaboral") {
      if (!isValidPhone(l.telefonoLaboral))
        e.telefonoLaboral = "Ingresá un teléfono laboral válido (al menos 8 dígitos).";
      return;
    }
    if (!String(l[k]).trim()) e[k] = `Completá el campo ${LABEL_LABORAL_POST[k].toLowerCase()}.`;
  });
  return e;
}

const LABEL_PERSONALES: Record<keyof DatosPersonalesPost, string> = {
  email: "Email",
  domicilioReal: "Domicilio real",
  telefonoCelular: "Teléfono celular",
  nacionalidad: "Nacionalidad",
  estadoCivil: "Estado civil",
  tipoVivienda: "Tipo de vivienda",
  hijosACargo: "Hijos a cargo",
  tarjetaCredito: "Tarjeta de crédito",
};

export function validarPersonalesPost(
  p: DatosPersonalesPost
): Partial<Record<keyof DatosPersonalesPost, string>> {
  const e: Partial<Record<keyof DatosPersonalesPost, string>> = {};
  if (!p.email.trim()) e.email = "Ingresá el email del cliente.";
  else if (!isValidEmail(p.email))
    e.email = "El formato del email no es válido. Ej.: nombre@dominio.com";
  if (!p.domicilioReal.trim()) e.domicilioReal = "Ingresá el domicilio real del cliente.";
  if (!p.telefonoCelular.trim())
    e.telefonoCelular = "Ingresá el teléfono celular del cliente.";
  else if (!isValidPhone(p.telefonoCelular))
    e.telefonoCelular = "El teléfono celular debe tener al menos 8 dígitos.";
  if (!p.nacionalidad.trim()) e.nacionalidad = "Ingresá la nacionalidad.";
  if (!p.estadoCivil.trim()) e.estadoCivil = "Seleccioná el estado civil.";
  if (!p.tipoVivienda.trim()) e.tipoVivienda = "Seleccioná el tipo de vivienda.";
  if (!p.hijosACargo.trim()) e.hijosACargo = "Indicá la cantidad de hijos a cargo.";
  if (!p.tarjetaCredito.trim())
    e.tarjetaCredito = "Indicá si el cliente posee tarjeta de crédito.";
  return e;
}

const LABEL_REFERENCIA: Record<keyof Omit<Referencia, "id">, string> = {
  nombre: "Nombre de la referencia",
  telefono: "Teléfono de la referencia",
  email: "Email de referencia",
  domicilio: "Domicilio de la referencia",
  relacion: "Relación de la referencia",
};

export function validarReferencia(
  r: Referencia
): Partial<Record<keyof Omit<Referencia, "id">, string>> {
  const e: Partial<Record<keyof Omit<Referencia, "id">, string>> = {};
  if (!r.nombre.trim()) e.nombre = "Ingresá el nombre completo de la referencia.";
  if (!r.telefono.trim()) e.telefono = "Ingresá el teléfono de la referencia.";
  else if (!isValidPhone(r.telefono))
    e.telefono = "El teléfono debe tener al menos 8 dígitos.";
  if (!r.email.trim()) e.email = "Ingresá el email de la referencia.";
  else if (!isValidEmail(r.email))
    e.email = "El formato del email no es válido. Ej.: nombre@dominio.com";
  if (!r.domicilio.trim()) e.domicilio = "Ingresá el domicilio de la referencia.";
  if (!r.relacion.trim()) e.relacion = "Seleccioná la relación con el cliente.";
  return e;
}

export function validarGarante(g: Garante): Partial<Record<keyof Garante, string>> {
  const e: Partial<Record<keyof Garante, string>> = {};
  if (!g.nombre.trim()) e.nombre = "Ingresá el nombre completo del garante.";
  if (!g.dni.trim()) e.dni = "Ingresá el DNI del garante.";
  else if (!isValidDNI(g.dni)) e.dni = "El DNI debe contener entre 7 y 8 dígitos.";
  if (!g.telefono.trim()) e.telefono = "Ingresá el teléfono del garante.";
  else if (!isValidPhone(g.telefono))
    e.telefono = "El teléfono debe tener al menos 8 dígitos.";
  if (!g.datosLaborales.trim())
    e.datosLaborales = "Describí los datos laborales del garante.";
  if (g.ingresos <= 0) e.ingresos = "Ingresá los ingresos del garante.";
  if (!g.lugarTrabajo.trim()) e.lugarTrabajo = "Ingresá el lugar de trabajo del garante.";
  return e;
}

// --- Estado consolidado de las pantallas post-oferta ---

// Semántica visual de la Guía §6.1: verde = completa y validada; azul = iniciada con
// obligatorios pendientes; gris = no iniciada.
export type EstadoVisualPantalla = "COMPLETA" | "INICIADA" | "NO_INICIADA";

export interface PendienteItem {
  pantallaId: PantallaPostOfertaId;
  pantallaLabel: string;
  campo: string;
}

export interface PantallaEstado {
  id: PantallaPostOfertaId;
  numero: number;
  label: string;
  descripcion: string;
  obligatoria: boolean;
  completa: boolean;
  estadoVisual: EstadoVisualPantalla;
  pendientes: PendienteItem[];
}

const tieneTexto = (obj: object) =>
  Object.values(obj).some((v) => typeof v === "string" && v.trim().length > 0);

export function estadoPantallasPostOferta(app: CreditApplication): PantallaEstado[] {
  const config = configEfectiva(app.configuracion);
  const po = app.postOferta;

  return pantallasVisibles(app.configuracion).map((pantalla, index) => {
    const pendientes: PendienteItem[] = [];
    let completa = true;
    let conDatos = false;

    const push = (campo: string) =>
      pendientes.push({
        pantallaId: pantalla.id,
        pantallaLabel: pantalla.label,
        campo,
      });

    switch (pantalla.id) {
      case "laboral": {
        const err = validarLaboralPost(po.laboral);
        (Object.keys(err) as (keyof DatosLaboralesPost)[]).forEach((k) =>
          push(LABEL_LABORAL_POST[k])
        );
        completa = pendientes.length === 0;
        conDatos = tieneTexto(po.laboral);
        break;
      }
      case "personales": {
        const err = validarPersonalesPost(po.personales);
        (Object.keys(err) as (keyof DatosPersonalesPost)[]).forEach((k) =>
          push(LABEL_PERSONALES[k])
        );
        completa = pendientes.length === 0;
        conDatos = tieneTexto(po.personales);
        break;
      }
      case "tokenizacion": {
        completa = po.tokenizacion.tokenizada;
        if (!completa) push("Tarjeta sin tokenizar");
        conDatos = po.tokenizacion.tokenizada || po.tokenizacion.numero.trim().length > 0;
        break;
      }
      case "referencias": {
        conDatos = po.referencias.some((r) => tieneTexto({ ...r, id: "" }));
        if (po.referencias.length === 0) {
          push("Al menos una referencia");
          completa = false;
          break;
        }
        po.referencias.forEach((ref, i) => {
          const err = validarReferencia(ref);
          (Object.keys(err) as (keyof Omit<Referencia, "id">)[]).forEach((k) =>
            push(
              po.referencias.length > 1
                ? `${LABEL_REFERENCIA[k]} (${i + 1})`
                : LABEL_REFERENCIA[k]
            )
          );
        });
        completa = pendientes.length === 0;
        break;
      }
      case "garantias": {
        conDatos =
          po.garante.nombre.trim().length > 0 ||
          po.garanteDocs.some((d) => d.estado === "CARGADO");
        if (!config.requiereGarante) {
          completa = true;
          break;
        }
        const err = validarGarante(po.garante);
        if (Object.keys(err).length > 0) push("Datos del garante");
        if (po.garanteDocs.some((d) => d.estado !== "CARGADO"))
          push("Documentación del garante");
        completa = pendientes.length === 0;
        break;
      }
      case "legajo": {
        po.legajo
          .filter((d) => d.estado !== "CARGADO")
          .forEach((d) => push(d.nombre));
        completa = pendientes.length === 0;
        conDatos = po.legajo.some((d) => d.estado === "CARGADO");
        break;
      }
      case "impresion": {
        completa = po.impresionGenerada;
        if (!completa) push("Legajo sin imprimir");
        conDatos = po.impresionGenerada;
        break;
      }
    }

    const iniciada = conDatos || app.pantallasVisitadas.includes(pantalla.id);
    return {
      id: pantalla.id,
      numero: index + 1,
      label: pantalla.label,
      descripcion: pantalla.descripcion,
      obligatoria: pantalla.obligatoria,
      completa,
      estadoVisual: completa ? "COMPLETA" : iniciada ? "INICIADA" : "NO_INICIADA",
      pendientes,
    };
  });
}

export function pendientesFinalizarCarga(app: CreditApplication): PendienteItem[] {
  return estadoPantallasPostOferta(app)
    .filter((p) => p.obligatoria && !p.completa)
    .flatMap((p) => p.pendientes);
}

export function puedeFinalizarCarga(app: CreditApplication): boolean {
  return pendientesFinalizarCarga(app).length === 0;
}
