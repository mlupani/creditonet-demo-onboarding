// Quién está operando esta pestaña. El rol lo elige el header (RolProvider), que vive por debajo
// de AppProvider; éste lo necesita para firmar cada cambio de estado del log (creditonet-112).

import { ROLES, ROL_POR_DEFECTO, type Rol } from "./roles";

let rolActivo: Rol = ROL_POR_DEFECTO;

export function fijarRolActivo(rol: Rol) {
  rolActivo = rol;
}

export function actorActivo(): { usuario: string; perfil: string } {
  const { nombre, rol } = ROLES[rolActivo].sesion;
  return { usuario: nombre, perfil: rol };
}
