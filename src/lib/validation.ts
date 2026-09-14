import type {
  CreditApplication,
  DeudaTerceros,
  LaboralIngresos,
  PantallaPostOfertaId,
  PersonaVinculada,
} from "./types";
import { isValidCBU, isValidDNI, isValidEmail, parseFecha } from "./format";
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

export type ErroresLaboral = Partial<Record<keyof LaboralIngresos, string>>;

export function validarLaboral(l: LaboralIngresos): ErroresLaboral {
  const e: ErroresLaboral = {};
  if (!l.condicionLaboral.trim())
    e.condicionLaboral = "Seleccioná la condición laboral: define la línea y el motor aplicables.";
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

// --- Etapa 2: referencias y garantes (Onboarding §7–§8) ---

export type CampoPersona = "vinculo" | "dni" | "nombreCompleto" | "domicilio" | "email";

export const LABEL_PERSONA: Record<CampoPersona, string> = {
  vinculo: "Vínculo",
  dni: "DNI",
  nombreCompleto: "Nombre completo",
  domicilio: "Domicilio",
  email: "Email",
};

export function validarPersona(p: PersonaVinculada): Partial<Record<CampoPersona, string>> {
  const e: Partial<Record<CampoPersona, string>> = {};
  if (!p.vinculo.trim()) e.vinculo = "Seleccioná el vínculo con el cliente.";
  if (!p.dni.trim()) e.dni = "Ingresá el DNI.";
  else if (!isValidDNI(p.dni)) e.dni = "El DNI debe tener 7 u 8 dígitos.";
  if (!p.nombreCompleto.trim()) e.nombreCompleto = "Ingresá el nombre completo.";
  if (!p.domicilio.trim()) e.domicilio = "Ingresá el domicilio completo.";
  if (!p.email.trim()) e.email = "Ingresá el email de contacto.";
  else if (!isValidEmail(p.email))
    e.email = "El formato del email no es válido. Ej.: nombre@dominio.com";
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
        const tokenizadas = po.tarjetas.filter((t) => t.estado === "TOKENIZADA").length;
        if (tokenizadas === 0)
          push(po.tarjetas.length > 0 ? "Tarjeta esperando al cliente" : "Tarjeta sin tokenizar");
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
          (Object.keys(validarPersona(persona)) as CampoPersona[]).forEach((k) =>
            push(
              `${LABEL_PERSONA[k]} ${esReferencia ? "de la referencia" : "del garante"}${
                lista.length > 1 ? ` (${i + 1})` : ""
              }`
            )
          );
        });
        conDatos = lista.some((p) => p.dni.trim() || p.nombreCompleto.trim());
        break;
      }
      case "legajo": {
        cfg.documentos
          .filter((d) => d.obligatorio && (po.legajo[d.tipoId]?.length ?? 0) === 0)
          .forEach((d) => push(getTipoDocumento(d.tipoId).nombre));
        conDatos = Object.values(po.legajo).some((archivos) => archivos.length > 0);
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
