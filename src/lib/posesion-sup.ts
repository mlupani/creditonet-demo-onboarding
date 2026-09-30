// Crédito "en posesión de [SUP]" (creditonet-114): mientras un superior lo tiene (estado SUPERIOR)
// los analistas lo siguen viendo en su bandeja, marcado, y lo pueden abrir sólo para consultar.

import { SESION_SUPERVISOR } from "./config";
import { ROLES, esSuperior, type Rol } from "./roles";
import type { EstadoCredito } from "./types";

export const enPosesionSup = (estado: EstadoCredito) => estado === "SUPERIOR";

// A cargo del superior asignado (o de quien levantó / recibió el caso); por defecto, el superior de la demo.
export const leyendaPosesionSup = (responsable?: string | null) =>
  `En posesión de ${responsable ?? SESION_SUPERVISOR.nombre}`;

// El superior a cargo conserva sus acciones (sin responsable asignado, cualquier superior); cualquier
// otro rol —incluido otro superior si el caso fue derivado a un colega— sólo lee.
export const soloLecturaPorSup = (estado: EstadoCredito, rol: Rol, responsable?: string | null) =>
  enPosesionSup(estado) &&
  !(esSuperior(rol) && (!responsable || responsable === ROLES[rol].sesion.nombre));

// Rol de superior que corresponde a un nombre (para avisarle).
export const rolDeSuperior = (nombre: string | null | undefined): Rol | null =>
  (["superior", "superior2"] as const).find((r) => ROLES[r].sesion.nombre === nombre) ?? null;

// Fondo distintivo de la fila en las bandejas.
export const CLASE_FILA_POSESION_SUP = "bg-violet-50/70";
