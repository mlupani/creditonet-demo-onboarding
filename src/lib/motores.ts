// Módulo Motor de Riesgo (doc v2 · 14/09/2026 y doc Motor de Riesgo v1 · 27/09/2026).
// §2 (v2): pueden existir MÚLTIPLES motores. En v1 cada motor es un GRUPO DE REGLAS: N reglas
// con nombre, expresión (variables CNET- / BCRA- / BURO- + operadores) y acción. Si la
// expresión es verdadera, Rechazar rechaza el crédito (bloqueante) y Verificar la marca para
// el analista (no bloqueante). Un grupo puede concatenarse con otro para evaluarse en secuencia.
// §5 (v2): el resultado principal es PASA / NO PASA, y se conserva el detalle de las reglas.
//
// En la demo los grupos viven en un ABM en memoria (persistido en la sesión) y los valores de
// BCRA y del buró externo son mock.

import type {
  TipoCliente,
  CreditApplication,
  EscenarioMotor,
  ResultadoRegla,
  RiskResultado,
  RiskRule,
} from "./types";
import {
  excepcionesDe,
  getOrganismo,
  getProductoConfig,
  motorAsignado,
  nombreOpcion,
  PLANES_CUOTAS,
  PRODUCTOS,
  type EstadoProducto,
} from "./config";
import { calcularEdad, fechaHoy, formatNumber, parseFecha, sumarDias } from "./format";
import {
  evaluarExpresion,
  validarExpresion,
  variablesDeExpresion,
  type ValorVariable,
} from "./expresiones";
import { crearStoreAbm } from "./store-abm";

// --- Fuentes y variables (v1 §2) ---

export type FuenteVariable = "CNET" | "BCRA" | "BURO";

export const FUENTES: { id: FuenteVariable; label: string; detalle: string }[] = [
  { id: "CNET", label: "Base interna CreditoNet", detalle: "Datos propios y del onboarding." },
  { id: "BCRA", label: "BCRA", detalle: "Central de Deudores (Función 2 del módulo)." },
  { id: "BURO", label: "Buró externo", detalle: "Informe comercial externo (Función 3 del módulo)." },
];

export const LABEL_FUENTE: Record<FuenteVariable, string> = {
  CNET: "Base interna",
  BCRA: "BCRA",
  BURO: "Buró externo",
};

export interface VariableMotor {
  nombre: string;
  fuente: FuenteVariable;
  tipo: "numero" | "texto";
  detalle: string;
  valor: (app: CreditApplication, escenario?: EscenarioMotor) => ValorVariable | null;
}

function mesesDesde(fecha: string): number | null {
  const d = parseFecha(fecha);
  if (!d) return null;
  const hoy = new Date();
  return (hoy.getFullYear() - d.getFullYear()) * 12 + (hoy.getMonth() - d.getMonth());
}

// Días de atraso representativos de cada situación BCRA / perfil interno (1 a 5): los datos de
// BCRA y del buró son mock y se derivan de las situaciones del cliente de la demo.
const DIAS_POR_SITUACION = [0, 0, 31, 91, 181, 366];
const DIAS_POR_PERFIL = [0, 0, 15, 45, 120, 365];
const interna = (app: CreditApplication) => app.situaciones?.interna ?? 1;
const bcra = (app: CreditApplication) => app.situaciones?.bcra ?? 1;

export const VARIABLES: VariableMotor[] = [
  {
    nombre: "CNET-edad",
    fuente: "CNET",
    tipo: "numero",
    detalle: "Años, según la fecha de nacimiento informada por la API.",
    valor: (app) => calcularEdad(app.cliente?.fechaNacimiento ?? ""),
  },
  {
    nombre: "CNET-antiguedad_meses",
    fuente: "CNET",
    tipo: "numero",
    detalle: "Meses desde la fecha de inicio laboral declarada.",
    valor: (app) => mesesDesde(app.laboral.fechaInicioLaboral),
  },
  {
    nombre: "CNET-sueldo_neto",
    fuente: "CNET",
    tipo: "numero",
    detalle: "Ingreso neto mensual acreditado en la cuenta sueldo.",
    valor: (app) => app.laboral.ingresoNeto,
  },
  {
    nombre: "CNET-condicion_laboral",
    fuente: "CNET",
    tipo: "texto",
    detalle: "Condición laboral declarada. Se compara con un texto: \"Contratado\".",
    valor: (app) => app.laboral.condicionLaboral || null,
  },
  {
    nombre: "CNET-días_atraso",
    fuente: "CNET",
    tipo: "numero",
    detalle: "Días de atraso en cuotas con la financiera (vector de mora interna).",
    valor: (app) => DIAS_POR_PERFIL[interna(app)],
  },
  {
    nombre: "CNET-monto_deuda",
    fuente: "CNET",
    tipo: "numero",
    detalle: "Saldo de deuda vigente con la financiera.",
    valor: (app) => (interna(app) > 1 ? 180_000 * interna(app) : 0),
  },
  {
    nombre: "CNET-tramites_en_curso",
    fuente: "CNET",
    tipo: "numero",
    detalle: "Solicitudes en curso del mismo cliente por cualquier canal de venta.",
    valor: () => 0,
  },
  {
    nombre: "CNET-coincidencias_blacklist",
    fuente: "CNET",
    tipo: "numero",
    detalle: "Coincidencias por DNI/CUIT o teléfono en las listas del negocio.",
    valor: (_app, escenario) => (escenario === "PASA_CON_MARCADAS" ? 1 : 0),
  },
  {
    nombre: "BCRA-situacion",
    fuente: "BCRA",
    tipo: "numero",
    detalle: "Situación en la Central de Deudores (1 normal a 5 irrecuperable).",
    valor: bcra,
  },
  {
    nombre: "BCRA-dias_mora",
    fuente: "BCRA",
    tipo: "numero",
    detalle: "Días de mora informados en la Central de Deudores.",
    valor: (app) => DIAS_POR_SITUACION[bcra(app)],
  },
  {
    nombre: "BURO-cuotas_activas",
    fuente: "BURO",
    tipo: "numero",
    detalle: "Cantidad de créditos con cuotas activas en el sistema.",
    valor: (app) => (interna(app) >= 3 ? 4 : 1),
  },
  {
    nombre: "BURO-deuda_total",
    fuente: "BURO",
    tipo: "numero",
    detalle: "Deuda total informada por el buró externo.",
    valor: (app) => (bcra(app) >= 3 ? 2_500_000 : 350_000),
  },
];

export function variablesDeFuentes(fuentes: FuenteVariable[]): VariableMotor[] {
  return VARIABLES.filter((v) => fuentes.includes(v.fuente));
}

export function tiposVariables(fuentes: FuenteVariable[]): Record<string, "numero" | "texto"> {
  return Object.fromEntries(variablesDeFuentes(fuentes).map((v) => [v.nombre, v.tipo]));
}

// --- Grupos de reglas (v1 §2–§5) ---

export type AccionRegla = "RECHAZAR" | "VERIFICAR";

export const ACCIONES: { id: AccionRegla; label: string; detalle: string }[] = [
  { id: "RECHAZAR", label: "Rechazar", detalle: "Si la expresión es verdadera, rechaza el crédito." },
  {
    id: "VERIFICAR",
    label: "Verificar",
    detalle: "Si la expresión es verdadera, la marca para la revisión del analista. No rechaza.",
  },
];

export interface ReglaMotor {
  id: string;
  nombre: string;
  expresion: string;
  accion: AccionRegla;
}

export interface MotorRiesgo {
  id: string;
  codigo: string;
  // Descripción / Nombre del grupo.
  nombre: string;
  estado: EstadoProducto;
  // Vigencia en días desde la activación (vencida, la revisa un líder de producto) o por fecha
  // fija (desde ese día el grupo deja de estar disponible). Ambas null = sin vencimiento.
  vigenciaDias: number | null;
  vigenciaHasta: string | null;
  activadoEl: string;
  fuentes: FuenteVariable[];
  reglas: ReglaMotor[];
  // Grupo que se evalúa a continuación (v1 §5).
  concatenarCon: string | null;
  // Condiciones laborales para las que se asigna este motor dentro del producto
  // (reunión 11/09, 02:11: "para fijo va el motor 1 y para contratado el 2").
  condicionesLaborales: string[];
}

// Reglas de segmento de los motores de ejemplo: rango de edad, antigüedad e ingreso mínimo.
function reglasSegmento(p: {
  edadMin: number;
  edadMax: number;
  antiguedad: number;
  ingreso: number;
}): ReglaMotor[] {
  const reglas: ReglaMotor[] = [
    { id: "r1", nombre: "Edad menor a la mínima", expresion: `CNET-edad < ${p.edadMin}`, accion: "RECHAZAR" },
    { id: "r2", nombre: "Edad mayor a la máxima", expresion: `CNET-edad > ${p.edadMax}`, accion: "RECHAZAR" },
  ];
  if (p.antiguedad > 0)
    reglas.push({
      id: "r3",
      nombre: "Antigüedad laboral insuficiente",
      expresion: `CNET-antiguedad_meses < ${p.antiguedad}`,
      accion: "RECHAZAR",
    });
  reglas.push({
    id: "r4",
    nombre: "Ingreso menor al mínimo",
    expresion: `CNET-sueldo_neto < ${p.ingreso}`,
    accion: "RECHAZAR",
  });
  return reglas;
}

function grupo(
  datos: Pick<MotorRiesgo, "id" | "codigo" | "nombre" | "reglas" | "condicionesLaborales"> &
    Partial<MotorRiesgo>
): MotorRiesgo {
  return {
    estado: "ACTIVO",
    vigenciaDias: null,
    vigenciaHasta: null,
    activadoEl: "01/07/2026",
    fuentes: ["CNET"],
    concatenarCon: "motor-politicas",
    ...datos,
  };
}

function motoresIniciales(): MotorRiesgo[] {
  return [
    grupo({
      id: "motor-salud",
      codigo: "01",
      nombre: "Motor Empleados de Salud",
      vigenciaHasta: "31/12/2026",
      condicionesLaborales: ["Empleado fijo", "Contratado"],
      reglas: reglasSegmento({ edadMin: 18, edadMax: 75, antiguedad: 12, ingreso: 600_000 }),
    }),
    grupo({
      id: "motor-seguridad",
      codigo: "02",
      nombre: "Motor Fuerzas de Seguridad",
      vigenciaDias: 180,
      condicionesLaborales: ["Empleado fijo"],
      reglas: reglasSegmento({ edadMin: 18, edadMax: 70, antiguedad: 24, ingreso: 700_000 }),
    }),
    grupo({
      id: "motor-pasivos",
      codigo: "03",
      nombre: "Motor Pasivos / Jubilados",
      condicionesLaborales: ["Jubilado / Pensionado"],
      reglas: reglasSegmento({ edadMin: 55, edadMax: 85, antiguedad: 6, ingreso: 400_000 }),
    }),
    grupo({
      id: "motor-judicial",
      codigo: "04",
      nombre: "Motor Crédito Judicial",
      condicionesLaborales: ["Empleado fijo", "Contratado", "Monotributista"],
      reglas: reglasSegmento({ edadMin: 18, edadMax: 80, antiguedad: 0, ingreso: 500_000 }),
    }),
    grupo({
      id: "motor-general",
      codigo: "05",
      nombre: "Motor General",
      condicionesLaborales: [],
      reglas: reglasSegmento({ edadMin: 18, edadMax: 75, antiguedad: 12, ingreso: 500_000 }),
    }),
    // Reglas comunes a todos los segmentos (v1 §5, "Segmentación + reglas comunes").
    grupo({
      id: "motor-politicas",
      codigo: "06",
      nombre: "Políticas generales BCRA y buró interno",
      fuentes: ["CNET", "BCRA"],
      concatenarCon: null,
      condicionesLaborales: [],
      reglas: [
        { id: "r1", nombre: "Situación BCRA irregular", expresion: "BCRA-situacion >= 3", accion: "RECHAZAR" },
        { id: "r2", nombre: "Mora interna mayor a 30 días", expresion: "CNET-días_atraso > 30", accion: "VERIFICAR" },
        {
          // "Quiero limitar que el tipo no esté en dos lados haciendo un pedido por dos
          // canales; si dice que sí, rechazo" (reunión 11/09, 01:54).
          id: "r3",
          nombre: "Trámite activo en otro canal",
          expresion: "CNET-tramites_en_curso > 0",
          accion: "RECHAZAR",
        },
        {
          // Motor §7 (v2): la blacklist es sólo un dato que una regla evalúa.
          id: "r4",
          nombre: "Persona en blacklist",
          expresion: "CNET-coincidencias_blacklist > 0",
          accion: "VERIFICAR",
        },
      ],
    }),
  ];
}

// Lista viva que lee el resto de la demo: el ABM la reemplaza en el lugar.
export const MOTORES: MotorRiesgo[] = motoresIniciales();

const store = crearStoreAbm<MotorRiesgo>({
  clave: "creditonet.motores.v1",
  inicial: motoresIniciales(),
  valido: (r) => !!r?.id && Array.isArray(r.reglas) && Array.isArray(r.fuentes),
  aplicar: (lista) => {
    MOTORES.splice(0, MOTORES.length, ...lista);
  },
});

export const useMotores = store.useLista;
export const hidratarMotores = store.hidratar;

export function guardarMotor(m: MotorRiesgo) {
  const lista = store.get();
  store.commit(
    lista.some((r) => r.id === m.id) ? lista.map((r) => (r.id === m.id ? m : r)) : [...lista, m]
  );
}

// Al reactivar un grupo vuelve a correr su vigencia en días.
export function cambiarEstadoMotor(id: string, estado: EstadoProducto) {
  store.commit(
    store.get().map((r) =>
      r.id !== id
        ? r
        : {
            ...r,
            estado,
            activadoEl: estado === "ACTIVO" && r.estado !== "ACTIVO" ? fechaHoy() : r.activadoEl,
          }
    )
  );
}

function idLibre(nombre: string): string {
  const base =
    "motor-" +
    (nombre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "grupo");
  let id = base;
  for (let n = 2; store.get().some((r) => r.id === id); n++) id = `${base}-${n}`;
  return id;
}

/**
 * Borrador de grupo nuevo: en blanco o copia de otro (v1 §4: hereda todas sus reglas). No se
 * agrega a la lista hasta que se graba (`crearMotor`).
 */
export function borradorMotor(copiarDeId: string | null): MotorRiesgo {
  const lista = store.get();
  const siguiente = Math.max(0, ...lista.map((r) => Number(r.codigo) || 0)) + 1;
  const base = lista.find((r) => r.id === copiarDeId);
  const comun = {
    id: "",
    codigo: String(siguiente).padStart(2, "0"),
    estado: "ACTIVO" as const,
    activadoEl: fechaHoy(),
  };
  if (base) return { ...structuredClone(base), ...comun, nombre: `${base.nombre} (copia)` };
  return {
    ...comun,
    nombre: "",
    vigenciaDias: null,
    vigenciaHasta: null,
    fuentes: ["CNET"],
    reglas: [],
    concatenarCon: null,
    condicionesLaborales: [],
  };
}

/** Graba un borrador nuevo con su id definitivo. */
export function crearMotor(m: MotorRiesgo): string {
  const id = idLibre(m.nombre);
  guardarMotor({ ...m, id });
  return id;
}

export function nuevaReglaId(reglas: ReglaMotor[]): string {
  return `r${Math.max(0, ...reglas.map((r) => Number(r.id.replace(/\D/g, "")) || 0)) + 1}`;
}

// --- Vigencia ---

export type EstadoVigenciaMotor = "VIGENTE" | "REVISAR" | "VENCIDO";

export function vencimientoMotor(m: MotorRiesgo): string | null {
  if (m.vigenciaHasta) return m.vigenciaHasta;
  if (m.vigenciaDias !== null) return sumarDias(m.activadoEl, m.vigenciaDias);
  return null;
}

// Vencida la fecha fija, el grupo deja de estar disponible; vencido el plazo en días sigue
// corriendo, pero lo tiene que revisar un líder de producto.
export function vigenciaMotor(m: MotorRiesgo, hoy: Date = new Date()): EstadoVigenciaMotor {
  const vence = parseFecha(vencimientoMotor(m) ?? "");
  if (!vence) return "VIGENTE";
  if (vence > new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) return "VIGENTE";
  return m.vigenciaHasta ? "VENCIDO" : "REVISAR";
}

export function textoVigenciaMotor(m: MotorRiesgo): string {
  if (vigenciaMotor(m) !== "VIGENTE") return "Vencido — revisar";
  if (m.vigenciaHasta) return `Hasta ${m.vigenciaHasta}`;
  if (m.vigenciaDias !== null) return `${m.vigenciaDias} días · vence ${vencimientoMotor(m)}`;
  return "Sin vencimiento";
}

export function motorDisponible(m: MotorRiesgo): boolean {
  return m.estado === "ACTIVO" && vigenciaMotor(m) !== "VENCIDO";
}

/**
 * Grupos que se evalúan a partir de `m`, en orden (v1 §5). La cadena se corta en un grupo no
 * disponible y nunca repite un grupo.
 */
export function cadenaMotores(m: MotorRiesgo, lista: MotorRiesgo[] = MOTORES): MotorRiesgo[] {
  const cadena = [m];
  let sig = m.concatenarCon;
  while (sig && !cadena.some((c) => c.id === sig)) {
    const g = lista.find((r) => r.id === sig);
    if (!g || !motorDisponible(g)) break;
    cadena.push(g);
    sig = g.concatenarCon;
  }
  return cadena;
}

// --- Validación y exportación ---

export function validarMotor(m: MotorRiesgo, todos: MotorRiesgo[]): Record<string, string> {
  const e: Record<string, string> = {};
  const nombre = m.nombre.trim();
  if (!nombre) e.nombre = "Ingresá la descripción del grupo.";
  else if (todos.some((r) => r.id !== m.id && r.nombre.trim().toLowerCase() === nombre.toLowerCase()))
    e.nombre = "Ya existe otro grupo con ese nombre.";
  if (m.vigenciaDias !== null && (!Number.isInteger(m.vigenciaDias) || m.vigenciaDias < 1))
    e.vigencia = "La vigencia en días es un número entero desde 1.";
  if (m.vigenciaHasta !== null && !parseFecha(m.vigenciaHasta))
    e.vigencia = "Ingresá una fecha de vencimiento válida (dd/mm/aaaa).";
  if (m.fuentes.length === 0) e.fuentes = "Habilitá al menos una fuente de variables.";
  if (m.reglas.length === 0) e.reglas = "El grupo necesita al menos una regla.";
  const tipos = tiposVariables(m.fuentes);
  for (const r of m.reglas) {
    if (!r.nombre.trim()) e[`regla-${r.id}-nombre`] = "Ingresá el nombre de la regla.";
    const err = validarExpresion(r.expresion, tipos);
    if (err) e[`regla-${r.id}-expresion`] = err;
  }
  if (m.concatenarCon) {
    const sig = todos.find((r) => r.id === m.concatenarCon);
    if (m.concatenarCon === m.id) e.concatenarCon = "Un grupo no se puede concatenar consigo mismo.";
    else if (!sig) e.concatenarCon = "El grupo elegido ya no existe.";
    else if (
      m.id &&
      cadenaMotores(sig, todos.map((r) => (r.id === m.id ? m : r))).some((c) => c.id === m.id)
    )
      e.concatenarCon = `La cadena vuelve a este grupo: “${sig.nombre}” ya termina en él.`;
  }
  return e;
}

export function motoresACsv(lista: MotorRiesgo[]): string {
  const filas = [
    ["ID", "Descripción", "Vigencia", "Estado", "Fuentes", "Reglas", "Concatena con"],
    ...lista.map((m) => [
      m.codigo,
      m.nombre,
      textoVigenciaMotor(m),
      m.estado,
      m.fuentes.join(", "),
      String(m.reglas.length),
      MOTORES.find((r) => r.id === m.concatenarCon)?.nombre ?? "",
    ]),
  ];
  const celda = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
}

// Condiciones laborales conocidas (planes y motores): sirven para asignar motor por condición.
export const CONDICIONES_LABORALES: string[] = [
  ...new Set([
    ...Object.values(PLANES_CUOTAS).flatMap((p) => p.condicionesLaborales),
    ...MOTORES.flatMap((m) => m.condicionesLaborales),
  ]),
];

export function getMotor(id: string | null): MotorRiesgo {
  return (
    MOTORES.find((m) => m.id === id) ?? MOTORES.find((m) => m.id === "motor-general") ?? MOTORES[0]
  );
}

export interface SeleccionMotor {
  motor: MotorRiesgo;
  // Por qué se eligió ese motor: se muestra en la demo para explicar la regla de selección.
  criterio: string;
  condicionLaboral: string;
}

/**
 * Motor §2 y resumen del Producto: el producto asigna el motor (grupo de reglas) según el tipo
 * de cliente (nuevo / existente), la condición laboral, la situación BCRA y la situación en buró
 * interno, y el organismo puede pisar esa asignación. Si el organismo define la suya y ésta aplica al cliente, manda; si no, la del
 * producto; si tampoco, el motor general. Un grupo suspendido, eliminado o con la fecha de
 * vigencia vencida no está disponible: se usa el motor general.
 */
export function seleccionarMotor(
  configuracion: { productoId: string; organismoId: string },
  condicionLaboral = "",
  tipoCliente: TipoCliente | null = null,
  situaciones: { bcra: number; interna: number } | null = null
): SeleccionMotor {
  const producto = getProductoConfig(configuracion.productoId);
  const organismo = getOrganismo(configuracion.organismoId);
  const nombreProducto = nombreOpcion(PRODUCTOS, configuracion.productoId);
  const condicion = condicionLaboral || organismo.condicionLaboral;

  let motorId = "motor-general";
  let criterio = `Sin configuración específica para ${nombreProducto} · ${organismo.nombre}`;

  const motorOrganismo = excepcionesDe(configuracion.organismoId, configuracion.productoId).motor;
  const delOrganismo = motorOrganismo
    ? motorAsignado(motorOrganismo, condicion, tipoCliente, situaciones)
    : null;
  const delProducto = motorAsignado(producto.motor, condicion, tipoCliente, situaciones);
  if (delOrganismo) {
    motorId = delOrganismo;
    criterio = `Excepción del organismo ${organismo.nombre} sobre ${nombreProducto}`;
  } else if (delProducto) {
    motorId = delProducto;
    criterio = `Motor asignado al producto ${nombreProducto}`;
  }

  let motor = getMotor(motorId);
  if (!motorDisponible(motor) && motor.id !== "motor-general") {
    criterio = `${motor.nombre} no está disponible (suspendido o vencido): se usa el motor general`;
    motor = getMotor("motor-general");
  }
  if (condicion && motor.condicionesLaborales.length > 0)
    criterio += ` · condición laboral “${condicion}”`;

  return { motor, criterio, condicionLaboral: condicion };
}

// --- Resultado ---

// Control exclusivo de la demo: fuerza el resultado de las reglas que dependen de fuentes
// externas para poder mostrar los tres caminos en una presentación.
export const ESCENARIOS_MOTOR: { id: EscenarioMotor; label: string; detalle: string }[] = [
  { id: "PASA", label: "Pasa", detalle: "Todas las reglas pasan." },
  {
    id: "PASA_CON_MARCADAS",
    label: "Pasa con reglas marcadas",
    detalle: "Una regla de verificación se cumple: la solicitud continúa y la revisa el analista.",
  },
  {
    id: "NO_PASA",
    label: "No pasa",
    detalle: "Una regla de rechazo se cumple: la solicitud no continúa.",
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

const pasa = (ok: boolean): ResultadoRegla => (ok ? "PASA" : "NO_PASA");

function mostrarValor(v: ValorVariable | null): string {
  if (v === null) return "sin dato";
  return typeof v === "number" ? formatNumber(v) : `“${v}”`;
}

/**
 * Ejecuta las reglas del grupo seleccionado y de los grupos concatenados, en orden (v1 §5).
 *
 * Una regla cuya expresión es verdadera "no pasa": si su acción es Rechazar es bloqueante; si
 * es Verificar queda marcada para el analista. Si falta el dato de alguna variable la regla
 * tampoco pasa (no se puede descartar el riesgo). BCRA y buró son mock; el escenario de la demo
 * mueve la blacklist (PASA_CON_MARCADAS).
 */
export function evaluarReglas(
  app: CreditApplication,
  motor: MotorRiesgo,
  escenario?: EscenarioMotor
): RiskRule[] {
  const valores: Record<string, ValorVariable | null> = Object.fromEntries(
    VARIABLES.map((v) => [v.nombre, v.valor(app, escenario)])
  );
  return cadenaMotores(motor).flatMap((g) =>
    g.reglas.map((r, i) => {
      const usadas = variablesDeExpresion(r.expresion);
      const fuentes = [
        ...new Set(usadas.map((u) => LABEL_FUENTE[u.slice(0, 4) as FuenteVariable])),
      ];
      return {
        id: `${g.id}:${r.id}`,
        codigo: `${g.codigo}-R${i + 1}`,
        nombre: r.nombre,
        detalle: `Grupo ${g.codigo} · ${g.nombre}. ${
          r.accion === "RECHAZAR" ? "Rechaza" : "Marca para verificar"
        } si se cumple la expresión.`,
        fuente: fuentes.join(" · ") || "Base interna",
        valorEvaluado:
          usadas.map((u) => `${u} = ${mostrarValor(valores[u] ?? null)}`).join(" · ") || "—",
        condicion: `Que no se cumpla ${r.expresion}`,
        bloqueante: r.accion === "RECHAZAR",
        resultado: pasa(evaluarExpresion(r.expresion, valores) === false),
      };
    })
  );
}

// Motor §4–§5: si alguna regla bloqueante no pasa, el motor no pasa. Las no bloqueantes
// que no pasan no cambian el resultado: quedan marcadas para el analista.
export function resolverResultado(reglas: RiskRule[]): RiskResultado {
  return reglas.some(reglaBloquea) ? "NO_PASA" : "PASA";
}
