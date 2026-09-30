// Crédito "en posesión de [SUP]" (creditonet-114): mientras un superior lo tiene (estado SUPERIOR)
// los analistas lo siguen viendo en su bandeja, marcado, y lo pueden abrir sólo para consultar.

import { SESION_SUPERVISOR } from "./config";
import type { Rol } from "./roles";
import type { EstadoCredito } from "./types";

export const enPosesionSup = (estado: EstadoCredito) => estado === "SUPERIOR";

export const LEYENDA_POSESION_SUP = `En posesión de ${SESION_SUPERVISOR.nombre}`;

// El superior poseedor conserva sus acciones; cualquier otro rol sólo lee.
export const soloLecturaPorSup = (estado: EstadoCredito, rol: Rol) =>
  enPosesionSup(estado) && rol !== "superior";

// Fondo distintivo de la fila en las bandejas.
export const CLASE_FILA_POSESION_SUP = "bg-violet-50/70";
