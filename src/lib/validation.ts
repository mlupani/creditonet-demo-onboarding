import type {
  CreditApplication,
  DeudaTerceros,
  LaboralIngresos,
  PantallaPostOfertaId,
  PersonaVinculada,
  TarjetaTokenizada,
  TipoPersonaVinculada,
} from "./types";
import { isValidCBU, isValidCUIL, isValidDNI, isValidEmail, parseFecha } from "./format";
import { parseTelefono, validarNumero } from "./telefono";
import { configEfectiva, pantallasVisibles } from "./config";
import { erroresPantalla } from "./campos-post-oferta";
import { getTipoDocumento } from "./parametros";

// --- Catálogos de la etapa pre-oferta (los de post-oferta viven en parametros.ts) ---

export { GENEROS } from "./parametros";

// Condición laboral: dato mínimo y uno de los tres limitantes que eligen la línea
// (reunión 11/09, 27:08 y 02:35).
export const CONDICIONES_LABORALES = [
  "Empleado fijo",
  "Contratado",
  "Monotributista",
  "Jubilado / Pensionado",
];
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

export type ErroresLaboral = Partial<
  Record<Exclude<keyof LaboralIngresos, "empleadores">, string>
> & { empleadores?: { banco?: string; cuit?: string; razonSocial?: string }[] };

export function validarLaboral(l: LaboralIngresos): ErroresLaboral {
  const e: ErroresLaboral = {};
  if (!l.condicionLaboral.trim())
    e.condicionLaboral = "Seleccioná la condición laboral: define la línea y el motor aplicables.";
  if (!l.fechaInicioLaboral.trim())
    e.fechaInicioLaboral = "Seleccioná la fecha de inicio laboral.";
  else if (!parseFecha(l.fechaInicioLaboral))
    e.fechaInicioLaboral = "La fecha de inicio laboral no es válida.";
  if (!l.empleadores || l.empleadores.length === 0) {
    e.empleadores = [{ banco: "Seleccioná el banco.", cuit: "Ingresá el CUIT.", razonSocial: "Ingresá la razón social." }];
  } else {
    const errores = l.empleadores.map((emp) => {
      const err: { banco?: string; cuit?: string; razonSocial?: string } = {};
      if (!emp.banco.trim()) err.banco = "Seleccioná el banco.";
      if (!emp.cuit.trim()) err.cuit = "Ingresá el CUIT.";
      else if (!isValidCUIL(emp.cuit)) err.cuit = "El CUIT debe tener 11 dígitos.";
      if (!emp.razonSocial.trim()) err.razonSocial = "Ingresá la razón social.";
      return err;
    });
    if (errores.some((x) => Object.keys(x).length > 0)) e.empleadores = errores;
  }
  if (l.ingresoNeto <= 0)
    e.ingresoNeto = "No puede ser $0. Ingresá el ingreso neto mensual del cliente.";
  if (l.ingresoBruto <= 0) e.ingresoBruto = "Ingresá el ingreso bruto mensual del cliente.";
  else if (l.ingresoBruto < l.ingresoNeto)
    e.ingresoBruto = "El ingreso bruto no puede ser menor al neto. Revisá los valores.";
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

// --- Etapa 2: referencias y garantes (Onboarding §7–§8) ---

export type CampoPersona =
  | "vinculo"
  | "dni"
  | "nombre"
  | "apellido"
  | "domicilioCalle"
  | "domicilioNumero"
  | "domicilioProvincia"
  | "domicilioLocalidad"
  | "domicilioCodigoPostal"
  | "email"
  | "telefono"
  | "condicionLaboral"
  | "ingresoBruto"
  | "ingresoNeto"
  | "reciboSueldo"
  | "empleadorCalle"
  | "empleadorLocalidad"
  | "empleadorCompaniaTelefonica"
  | "empleadorTelefono"
  | "banco"
  | "cbu";

export const LABEL_PERSONA: Record<CampoPersona, string> = {
  vinculo: "Vínculo",
  dni: "DNI",
  nombre: "Nombre",
  apellido: "Apellido",
  domicilioCalle: "Calle",
  domicilioNumero: "Número",
  domicilioProvincia: "Provincia",
  domicilioLocalidad: "Localidad",
  domicilioCodigoPostal: "Código postal",
  email: "Email",
  telefono: "Teléfono",
  condicionLaboral: "Condición laboral",
  ingresoBruto: "Ingreso bruto",
  ingresoNeto: "Ingreso neto",
  reciboSueldo: "Recibo de sueldo",
  empleadorCalle: "Calle del empleador",
  empleadorLocalidad: "Localidad del empleador",
  empleadorCompaniaTelefonica: "Compañía telefónica del empleador",
  empleadorTelefono: "Teléfono del empleador",
  banco: "Banco",
  cbu: "CBU",
};

export function validarPersona(
  p: PersonaVinculada,
  tipo: TipoPersonaVinculada
): Partial<Record<CampoPersona, string>> {
  const e: Partial<Record<CampoPersona, string>> = {};
  if (!p.vinculo.trim()) e.vinculo = "Seleccioná el vínculo con el cliente.";
  if (!p.dni.trim()) e.dni = "Ingresá el DNI.";
  else if (!isValidDNI(p.dni)) e.dni = "El DNI debe tener 7 u 8 dígitos.";
  if (!p.nombre.trim()) e.nombre = "Ingresá el nombre.";
  if (!p.apellido.trim()) e.apellido = "Ingresá el apellido.";
  if (!p.domicilio.calle.trim()) e.domicilioCalle = "Ingresá la calle.";
  if (!p.domicilio.numero.trim()) e.domicilioNumero = "Ingresá el número.";
  if (!p.domicilio.provincia.trim()) e.domicilioProvincia = "Seleccioná la provincia.";
  if (!p.domicilio.localidad.trim()) e.domicilioLocalidad = "Seleccioná la localidad.";
  if (!p.domicilio.codigoPostal.trim())
    e.domicilioCodigoPostal = "Ingresá el código postal.";
  if (!p.email.trim()) e.email = "Ingresá el email de contacto.";
  else if (!isValidEmail(p.email))
    e.email = "El formato del email no es válido. Ej.: nombre@dominio.com";
  const tel = parseTelefono(p.telefono);
  if (!tel.numero) e.telefono = "Ingresá el teléfono de contacto.";
  else {
    const errorTel = validarNumero(tel.pais, tel.caracteristica, tel.numero);
    if (errorTel) e.telefono = errorTel;
  }
  // El garante debe demostrar capacidad de pago para firmar la documentación del préstamo.
  // Nota creditonet-33: el recibo de sueldo ya no se valida acá; se exige en Legajo virtual por garante.
  if (tipo === "garante") {
    if (!p.condicionLaboral.trim()) e.condicionLaboral = "Seleccioná la condición laboral.";
    if (p.ingresoBruto <= 0) e.ingresoBruto = "Ingresá el ingreso bruto.";
    if (p.ingresoNeto <= 0) e.ingresoNeto = "Ingresá el ingreso neto.";
    if (!p.empleadorCalle.trim()) e.empleadorCalle = "Ingresá la calle del empleador.";
    if (!p.empleadorLocalidad.trim()) e.empleadorLocalidad = "Ingresá la localidad del empleador.";
    if (!(p.empleadorCompaniaTelefonica ?? "").trim())
      e.empleadorCompaniaTelefonica = "Seleccioná la compañía telefónica.";
    const telEmpleador = parseTelefono(p.empleadorTelefono);
    if (!telEmpleador.numero) e.empleadorTelefono = "Ingresá el teléfono del empleador.";
    else {
      const errorTel = validarNumero(telEmpleador.pais, telEmpleador.caracteristica, telEmpleador.numero);
      if (errorTel) e.empleadorTelefono = errorTel;
    }
    // ?? "": sesiones persistidas en sessionStorage antes de este campo no lo tienen.
    if (!(p.banco ?? "").trim()) e.banco = "Seleccioná el banco.";
    if (!(p.cbu ?? "").trim()) e.cbu = "Ingresá el CBU.";
    else if (!isValidCBU(p.cbu)) e.cbu = "El CBU debe tener 22 dígitos.";
  }
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

const conTexto = (valores: Record<string, string>) =>
  Object.values(valores).some((v) => v.trim().length > 0);

// Tokenizada y, si viene precargada de un trámite anterior (Onboarding §6), ya comprobada
// por el vendedor: recién ahí cuenta como una tarjeta válida para el cobro.
export function tarjetaValida(t: TarjetaTokenizada): boolean {
  return t.estado === "TOKENIZADA" && t.verificada !== false;
}

/**
 * Estado de cada pantalla visible según la configuración efectiva (Producto + Organismo):
 * obligatoriedad de campos, cantidades de referencias y garantes, documentos y tarjetas.
 */
export function estadoPantallasPostOferta(app: CreditApplication): PantallaEstado[] {
  const cfg = configEfectiva(app.configuracion);
  const po = app.postOferta;

  return pantallasVisibles(app.configuracion).map((pantalla, index) => {
    const pendientes: PendienteItem[] = [];
    let conDatos = false;

    const push = (campo: string) =>
      pendientes.push({ pantallaId: pantalla.id, pantallaLabel: pantalla.label, campo });

    switch (pantalla.id) {
      case "personales":
      case "laboral": {
        erroresPantalla(app, pantalla.id, cfg.camposObligatorios).forEach((e) =>
          push(e.campo.label)
        );
        conDatos = conTexto(po[pantalla.id]);
        break;
      }
      case "tokenizacion": {
        const validas = po.tarjetas.filter(tarjetaValida).length;
        if (validas === 0) {
          const esperandoCliente = po.tarjetas.some((t) => t.estado === "ESPERANDO_CLIENTE");
          const esperandoComprobacion = po.tarjetas.some(
            (t) => t.estado === "TOKENIZADA" && t.verificada === false
          );
          push(
            esperandoCliente
              ? "Tarjeta esperando al cliente"
              : esperandoComprobacion
                ? "Tarjeta pendiente de comprobar"
                : "Tarjeta sin tokenizar"
          );
        }
        conDatos = po.tarjetas.length > 0;
        break;
      }
      case "referencias":
      case "garantias": {
        const esReferencia = pantalla.id === "referencias";
        const lista = esReferencia ? po.referencias : po.garantes;
        const { minimo } = esReferencia ? cfg.referencias : cfg.garantes;
        const nombre = esReferencia ? "referencia" : "garante";
        const faltan = minimo - lista.length;
        if (faltan > 0)
          push(`Falta${faltan === 1 ? "" : "n"} ${faltan} ${nombre}${faltan === 1 ? "" : "s"}`);
        lista.forEach((persona, i) => {
          (
            Object.keys(
              validarPersona(persona, esReferencia ? "referencia" : "garante")
            ) as CampoPersona[]
          ).forEach((k) =>
            push(
              `${LABEL_PERSONA[k]} ${esReferencia ? "de la referencia" : "del garante"}${
                lista.length > 1 ? ` (${i + 1})` : ""
              }`
            )
          );
        });
        conDatos = lista.some((p) => p.dni.trim() || p.nombre.trim() || p.apellido.trim());
        break;
      }
      case "legajo": {
        cfg.documentos
          .filter((d) => d.obligatorio && (po.legajo[d.tipoId]?.length ?? 0) === 0)
          .forEach((d) => push(getTipoDocumento(d.tipoId).nombre));
        // creditonet-33: si hay garantes, cada uno debe tener su recibo de sueldo en el legajo
        po.garantes.forEach((g, idx) => {
          if ((g.reciboSueldo?.length ?? 0) === 0) {
            const nombre = [g.nombre, g.apellido].filter(Boolean).join(" ") || `Garante ${idx + 1}`;
            push(`Recibo de sueldo de ${nombre}`);
          }
        });
        conDatos =
          Object.values(po.legajo).some((archivos) => archivos.length > 0) ||
          po.garantes.some((g) => (g.reciboSueldo?.length ?? 0) > 0 || (g.otrosDocumentos?.length ?? 0) > 0);
        break;
      }
      case "impresion": {
        if (!po.impresion) push("Legajo sin imprimir ni visualizar");
        conDatos = po.impresion !== null;
        break;
      }
    }

    const completa = pendientes.length === 0;
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
