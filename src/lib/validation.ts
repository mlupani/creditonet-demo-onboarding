import type {
  CampoAdicionalLaboral,
  CreditApplication,
  DatosLaboralesPost,
  DatosPersonalesPost,
  Garante,
  LaboralIngresos,
  PantallaPostOfertaId,
  Referencia,
} from "./types";
import {
  formatARS,
  isValidCBU,
  isValidCUIL,
  isValidDNI,
  isValidEmail,
  isValidPhone,
} from "./format";
import { getProductoConfig, pantallasVisibles } from "./config";

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

// --- Etapa 1: datos laborales e ingresos ---

export type ErroresLaboral = Partial<Record<keyof LaboralIngresos, string>>;

export function validarLaboral(l: LaboralIngresos, productoId: string): ErroresLaboral {
  const e: ErroresLaboral = {};
  if (!l.bancoSueldo.trim())
    e.bancoSueldo = "Seleccioná el banco donde el cliente cobra el sueldo.";
  if (!isValidCBU(l.cbu)) e.cbu = "El CBU debe contener 22 dígitos.";
  if (l.ingresoNeto <= 0)
    e.ingresoNeto = "No puede ser $0. Ingresá el ingreso neto mensual del cliente.";
  if (l.ingresoBruto > 0 && l.ingresoBruto < l.ingresoNeto)
    e.ingresoBruto = "El ingreso bruto no puede ser menor al neto. Revisá los valores.";
  if (!l.fechaInicioLaboral.trim())
    e.fechaInicioLaboral = "Ingresá la fecha de inicio laboral (dd/mm/aaaa).";

  const oblig = getProductoConfig(productoId).camposAdicionalesObligatorios;
  if (oblig.includes("email")) {
    if (!l.email.trim()) e.email = "El producto requiere el email del cliente.";
    else if (!isValidEmail(l.email))
      e.email = "El formato del email no es válido. Ej.: nombre@dominio.com";
  } else if (l.email.trim() && !isValidEmail(l.email)) {
    e.email = "El formato del email no es válido. Ej.: nombre@dominio.com";
  }
  if (oblig.includes("cuitEmpleador")) {
    if (!l.cuitEmpleador.trim())
      e.cuitEmpleador = "El producto requiere el CUIT del empleador.";
    else if (!isValidCUIL(l.cuitEmpleador))
      e.cuitEmpleador = "El CUIT debe tener el formato 30-12345678-9.";
  }
  return e;
}

export function laboralCompleto(l: LaboralIngresos, productoId: string): boolean {
  return Object.keys(validarLaboral(l, productoId)).length === 0;
}

export interface CampoAdicionalEstado {
  id: CampoAdicionalLaboral;
  label: string;
  completo: boolean;
  obligatorioPorProducto: boolean;
  valor: string;
}

export function estadoCamposAdicionales(
  l: LaboralIngresos,
  productoId: string
): CampoAdicionalEstado[] {
  const oblig = getProductoConfig(productoId).camposAdicionalesObligatorios;
  const mk = (
    id: CampoAdicionalLaboral,
    label: string,
    completo: boolean,
    valor: string
  ): CampoAdicionalEstado => ({
    id,
    label,
    completo,
    obligatorioPorProducto: oblig.includes(id),
    valor: completo ? valor : "No informado",
  });
  return [
    mk("email", "Email", !!l.email.trim(), l.email),
    mk("cuitEmpleador", "CUIT del empleador", !!l.cuitEmpleador.trim(), l.cuitEmpleador),
    mk(
      "extracciones",
      "Extracciones (fecha e importe)",
      !!l.extraccionesFecha.trim() && l.extraccionesImporte > 0,
      `${l.extraccionesFecha} · ${formatARS(l.extraccionesImporte)}`
    ),
    mk(
      "transferencias",
      "Transferencias (fecha e importe)",
      !!l.transferenciasFecha.trim() && l.transferenciasImporte > 0,
      `${l.transferenciasFecha} · ${formatARS(l.transferenciasImporte)}`
    ),
    mk("disponible", "Disponible", l.disponible > 0, formatARS(l.disponible)),
    mk(
      "debitosNoRemunerativos",
      "Débitos no remunerativos",
      l.debitosNoRemunerativos > 0,
      formatARS(l.debitosNoRemunerativos)
    ),
  ];
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
  domicilioCompleto: "Domicilio completo",
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
  if (!p.domicilioCompleto.trim())
    e.domicilioCompleto = "Ingresá el domicilio particular completo.";
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

export interface PendienteItem {
  pantallaId: PantallaPostOfertaId;
  pantallaLabel: string;
  campo: string;
}

export interface PantallaEstado {
  id: PantallaPostOfertaId;
  label: string;
  descripcion: string;
  obligatoria: boolean;
  completa: boolean;
  visitada: boolean;
  pendientes: PendienteItem[];
}

export function estadoPantallasPostOferta(app: CreditApplication): PantallaEstado[] {
  const { productoId } = app.configuracion;
  const config = getProductoConfig(productoId);
  const po = app.postOferta;

  return pantallasVisibles(productoId).map((pantalla) => {
    const visitada = app.pantallasVisitadas.includes(pantalla.id);
    const pendientes: PendienteItem[] = [];
    let completa = true;

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
        break;
      }
      case "personales": {
        const err = validarPersonalesPost(po.personales);
        (Object.keys(err) as (keyof DatosPersonalesPost)[]).forEach((k) =>
          push(LABEL_PERSONALES[k])
        );
        completa = pendientes.length === 0;
        break;
      }
      case "tokenizacion": {
        completa = po.tokenizacion.tokenizada;
        if (!completa) push("Tarjeta sin tokenizar");
        break;
      }
      case "referencias": {
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
        break;
      }
      case "impresion": {
        completa = po.impresionGenerada;
        if (!completa) push("Legajo sin imprimir");
        break;
      }
    }

    return {
      id: pantalla.id,
      label: pantalla.label,
      descripcion: pantalla.descripcion,
      obligatoria: pantalla.obligatoria,
      completa,
      visitada,
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

export const RESULTADO_REGLA_TONE: Record<
  "CUMPLE" | "ADVERTENCIA" | "NO_CUMPLE",
  "success" | "warning" | "danger"
> = {
  CUMPLE: "success",
  ADVERTENCIA: "warning",
  NO_CUMPLE: "danger",
};
