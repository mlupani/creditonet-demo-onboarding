// Módulo Motor de Riesgo (doc v2 · 14/09/2026).
// §2: pueden existir MÚLTIPLES motores, cada uno con su nombre, reglas y configuración.
// §4: cada regla se configura como bloqueante o no bloqueante.
// §5: el resultado principal es PASA / NO PASA, y se conserva el detalle de las reglas.
//
// En la demo los motores son datos fijos: no hay motor real ni reglas persistidas.

import type {
  CreditApplication,
  EscenarioMotor,
  ResultadoRegla,
  RiskResultado,
  RiskRule,
} from "./types";
import { getOrganismo, getProductoConfig, nombreOpcion, PRODUCTOS } from "./config";
import { calcularEdad, formatARS, parseFecha } from "./format";

export interface MotorRiesgo {
  id: string;
  nombre: string;
  descripcion: string;
  fuentes: string[];
  // Condiciones laborales para las que se asigna este motor dentro del producto
  // (reunión 11/09, 02:11: "para fijo va el motor 1 y para contratado el 2").
  condicionesLaborales: string[];
  edadMinima: number;
  edadMaxima: number;
  antiguedadMinimaMeses: number;
  ingresoMinimo: number;
}

export const MOTORES: MotorRiesgo[] = [
  {
    id: "motor-salud",
    nombre: "Motor Empleados de Salud",
    descripcion: "Convenio provincial del sector salud, con descuento por haberes.",
    fuentes: ["BCRA", "Base interna", "Onboarding"],
    condicionesLaborales: ["Empleado fijo", "Contratado"],
    edadMinima: 18,
    edadMaxima: 75,
    antiguedadMinimaMeses: 12,
    ingresoMinimo: 600_000,
  },
  {
    id: "motor-seguridad",
    nombre: "Motor Fuerzas de Seguridad",
    descripcion: "Personal policial y penitenciario con haberes garantizados.",
    fuentes: ["BCRA", "Base interna", "Onboarding"],
    condicionesLaborales: ["Empleado fijo"],
    edadMinima: 18,
    edadMaxima: 70,
    antiguedadMinimaMeses: 24,
    ingresoMinimo: 700_000,
  },
  {
    id: "motor-pasivos",
    nombre: "Motor Pasivos / Jubilados",
    descripcion: "Haber previsional. Rango etario ampliado y exposición más acotada.",
    fuentes: ["BCRA", "Base interna", "Onboarding"],
    condicionesLaborales: ["Jubilado / Pensionado"],
    edadMinima: 55,
    edadMaxima: 85,
    antiguedadMinimaMeses: 6,
    ingresoMinimo: 400_000,
  },
  {
    id: "motor-judicial",
    nombre: "Motor Crédito Judicial",
    descripcion: "Adelanto sobre sentencia. Evalúa la cesión de cobro y el expediente.",
    fuentes: ["BCRA", "Base interna", "Onboarding"],
    condicionesLaborales: ["Empleado fijo", "Contratado", "Monotributista"],
    edadMinima: 18,
    edadMaxima: 80,
    antiguedadMinimaMeses: 0,
    ingresoMinimo: 500_000,
  },
  {
    id: "motor-general",
    nombre: "Motor General",
    descripcion: "Motor por defecto cuando no aplica ninguna configuración específica.",
    fuentes: ["BCRA", "Base interna"],
    condicionesLaborales: [],
    edadMinima: 18,
    edadMaxima: 75,
    antiguedadMinimaMeses: 12,
    ingresoMinimo: 500_000,
  },
];

export function getMotor(id: string | null): MotorRiesgo {
  return MOTORES.find((m) => m.id === id) ?? MOTORES[MOTORES.length - 1];
}

export interface SeleccionMotor {
  motor: MotorRiesgo;
  // Por qué se eligió ese motor: se muestra en la demo para explicar la regla de selección.
  criterio: string;
  condicionLaboral: string;
}

/**
 * Motor §2 y reunión 11/09 (02:09–02:13): dentro del producto se asigna un motor por
 * condición laboral, y el organismo puede definir una excepción que tiene prioridad.
 * La asociación exacta sigue siendo un pendiente funcional; acá es una tabla fija.
 */
export function seleccionarMotor(
  configuracion: { productoId: string; organismoId: string },
  condicionLaboral = ""
): SeleccionMotor {
  const producto = getProductoConfig(configuracion.productoId);
  const organismo = getOrganismo(configuracion.organismoId);
  const nombreProducto = nombreOpcion(PRODUCTOS, configuracion.productoId);
  const condicion = condicionLaboral || organismo.condicionLaboral;

  let motorId = "motor-general";
  let criterio = `Sin configuración específica para ${nombreProducto} · ${organismo.nombre}`;

  if (producto.id === "credito-judicial") {
    motorId = "motor-judicial";
    criterio = `El producto ${nombreProducto} tiene motor propio, con prioridad sobre el organismo`;
  } else if (organismo.id === "policia-provincial") {
    motorId = "motor-seguridad";
    criterio = `Excepción del organismo ${organismo.nombre} sobre ${nombreProducto}`;
  } else if (organismo.id === "jubilados-provincial") {
    motorId = "motor-pasivos";
    criterio = `Excepción del organismo ${organismo.nombre} sobre ${nombreProducto}`;
  } else if (organismo.id === "empleados-salud") {
    motorId = "motor-salud";
    criterio = `${nombreProducto} · ${organismo.nombre}`;
  }

  const motor = getMotor(motorId);
  if (condicion && motor.condicionesLaborales.length > 0)
    criterio += ` · condición laboral “${condicion}”`;

  return { motor, criterio, condicionLaboral: condicion };
}

// --- Resultado ---

export const RESULTADOS_MOTOR: { id: RiskResultado; label: string; detalle: string }[] = [
  {
    id: "PASA",
    label: "Pasa",
    detalle: "La solicitud continúa hacia los límites y el plan de cuotas.",
  },
  {
    id: "NO_PASA",
    label: "No pasa",
    detalle: "Alguna regla bloqueante no pasó: la solicitud no continúa.",
  },
];

// Control exclusivo de la demo: fuerza el resultado de las reglas que dependen de fuentes
// externas para poder mostrar los tres caminos en una presentación.
export const ESCENARIOS_MOTOR: { id: EscenarioMotor; label: string; detalle: string }[] = [
  { id: "PASA", label: "Pasa", detalle: "Todas las reglas pasan." },
  {
    id: "PASA_CON_MARCADAS",
    label: "Pasa con reglas marcadas",
    detalle: "Una regla no bloqueante no pasa: la solicitud continúa y la revisa el analista.",
  },
  {
    id: "NO_PASA",
    label: "No pasa",
    detalle: "Una regla bloqueante no pasa: la solicitud no continúa.",
  },
];

type ReglaEvaluada = { bloqueante: boolean; resultado: string };

// Regla bloqueante que no pasa: define que el motor (o la regla institucional) no pase.
export function reglaBloquea(r: ReglaEvaluada): boolean {
  return r.bloqueante && r.resultado === "NO_PASA";
}

// Regla no bloqueante que no pasa: no frena la solicitud, pero queda marcada para que el
// analista la revise al final (Motor §4 y §10).
export function reglaMarcada(r: ReglaEvaluada): boolean {
  return !r.bloqueante && r.resultado === "NO_PASA";
}

// --- Ejecución de las reglas ---

function mesesDesde(fecha: string): number | null {
  const d = parseFecha(fecha);
  if (!d) return null;
  const hoy = new Date();
  return (hoy.getFullYear() - d.getFullYear()) * 12 + (hoy.getMonth() - d.getMonth());
}

const pasa = (ok: boolean): ResultadoRegla => (ok ? "PASA" : "NO_PASA");

/**
 * Ejecuta las reglas del motor seleccionado.
 *
 * Las reglas de edad, antigüedad e ingreso mínimo se resuelven con los datos realmente
 * cargados en el onboarding. Las que dependen de fuentes externas son mock y las mueve el
 * escenario de la demo: NO_PASA hace fallar la situación BCRA (bloqueante) y
 * PASA_CON_MARCADAS hace fallar la blacklist (no bloqueante).
 */
export function evaluarReglas(
  app: CreditApplication,
  motor: MotorRiesgo,
  escenario: EscenarioMotor
): RiskRule[] {
  const edad = calcularEdad(app.cliente?.fechaNacimiento ?? "");
  const edadOk = edad !== null && edad >= motor.edadMinima && edad <= motor.edadMaxima;

  const meses = mesesDesde(app.laboral.fechaInicioLaboral);
  const antiguedadOk = meses !== null && meses >= motor.antiguedadMinimaMeses;

  const neto = app.laboral.ingresoNeto;
  const ingresoOk = neto >= motor.ingresoMinimo;

  const enBlacklist = escenario === "PASA_CON_MARCADAS";

  return [
    {
      id: "edad",
      codigo: "MR-01",
      nombre: "Edad dentro del rango permitido",
      detalle: "Calculada a partir de la fecha de nacimiento informada por la API.",
      fuente: "Onboarding",
      valorEvaluado: edad !== null ? `${edad} años` : "Sin dato",
      condicion: `Entre ${motor.edadMinima} y ${motor.edadMaxima} años`,
      bloqueante: true,
      resultado: pasa(edadOk),
    },
    {
      id: "antiguedad",
      codigo: "MR-02",
      nombre: "Antigüedad laboral",
      detalle: "Meses transcurridos desde la fecha de inicio laboral declarada.",
      fuente: "Onboarding",
      valorEvaluado: meses !== null ? `${meses} meses` : "Sin dato",
      condicion: `Mínimo ${motor.antiguedadMinimaMeses} meses`,
      bloqueante: true,
      resultado: pasa(antiguedadOk),
    },
    {
      id: "ingreso",
      codigo: "MR-03",
      nombre: "Ingreso mínimo",
      detalle: "Ingreso neto mensual acreditado en la cuenta sueldo.",
      fuente: "Onboarding",
      valorEvaluado: formatARS(neto),
      condicion: `Mínimo ${formatARS(motor.ingresoMinimo)}`,
      bloqueante: true,
      resultado: pasa(ingresoOk),
    },
    {
      id: "bcra",
      codigo: "MR-04",
      nombre: "Situación BCRA",
      detalle: "Situación del cliente en la Central de Deudores del BCRA.",
      fuente: "BCRA",
      valorEvaluado:
        escenario === "NO_PASA"
          ? "Situación 4 · deuda con alto riesgo de insolvencia"
          : `Situación ${app.situaciones?.bcra ?? 1} · sin deudas reportadas`,
      condicion: "Situación 1 o 2",
      bloqueante: true,
      resultado: pasa(escenario !== "NO_PASA"),
    },
    {
      id: "mora",
      codigo: "MR-05",
      nombre: "Vector de mora interna",
      detalle: "Historial de cumplimiento con la financiera.",
      fuente: "Base interna",
      valorEvaluado: "0 días de atraso · CR-000102 al día",
      condicion: "Hasta 30 días de atraso",
      bloqueante: true,
      resultado: "PASA",
    },
    {
      // "Quiero limitar que el tipo no esté en dos lados haciendo un pedido por dos
      // canales; si dice que sí, rechazo" (reunión 11/09, 01:54).
      id: "tramite-duplicado",
      codigo: "MR-06",
      nombre: "Sin trámite activo en otro canal",
      detalle: "Solicitudes en curso del mismo cliente por cualquier canal de venta.",
      fuente: "Base interna",
      valorEvaluado: "0 solicitudes en curso",
      condicion: "Sin trámite pendiente",
      bloqueante: true,
      resultado: "PASA",
    },
    {
      // Motor §7: la blacklist es sólo un dato que una regla evalúa, y la regla puede ser
      // bloqueante o no. Acá está configurada como no bloqueante.
      id: "blacklist",
      codigo: "MR-07",
      nombre: "Persona en blacklist",
      detalle: "Coincidencias por DNI/CUIT o teléfono en las listas del negocio.",
      fuente: "Base interna",
      valorEvaluado: enBlacklist ? "1 coincidencia por teléfono" : "Sin coincidencias",
      condicion: "Sin coincidencias",
      bloqueante: false,
      resultado: pasa(!enBlacklist),
    },
  ];
}

// Motor §4–§5: si alguna regla bloqueante no pasa, el motor no pasa. Las no bloqueantes
// que no pasan no cambian el resultado: quedan marcadas para el analista.
export function resolverResultado(reglas: RiskRule[]): RiskResultado {
  return reglas.some(reglaBloquea) ? "NO_PASA" : "PASA";
}
