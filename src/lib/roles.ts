// Roles de la demo: se eligen por query param (?rol=...) desde el header y definen qué
// pantallas ve cada usuario. El superior ve todo.

import {
  SESION,
  SESION_ANALISTA,
  SESION_CHEQUEADOR,
  SESION_SUPERVISOR,
} from "./config";

export type Rol = "venta" | "analista" | "chequeo" | "superior";

export const ROL_POR_DEFECTO: Rol = "venta";

export const ROLES: Record<
  Rol,
  { corto: string; sesion: { nombre: string; iniciales: string; rol: string; organizacion: string }; inicio: string }
> = {
  venta: { corto: "Venta", sesion: SESION, inicio: "/" },
  analista: { corto: "Analista", sesion: SESION_ANALISTA, inicio: "/analisis" },
  chequeo: { corto: "Chequeo", sesion: SESION_CHEQUEADOR, inicio: "/chequeo" },
  superior: { corto: "Superior", sesion: SESION_SUPERVISOR, inicio: "/" },
};

export const LISTA_ROLES = Object.keys(ROLES) as Rol[];

export function parseRol(valor: string | null | undefined): Rol | null {
  return valor && valor in ROLES ? (valor as Rol) : null;
}

// Rutas por prefijo → roles habilitados (el superior siempre entra). "/" coincide sólo exacto.
const PERMISOS: { ruta: string; roles: Rol[] }[] = [
  { ruta: "/", roles: ["venta"] },
  { ruta: "/onboarding", roles: ["venta"] },
  { ruta: "/analisis", roles: ["analista"] },
  { ruta: "/chequeo", roles: ["chequeo"] },
  { ruta: "/productos", roles: ["analista"] },
  { ruta: "/organismos", roles: ["analista"] },
  { ruta: "/planes", roles: ["analista"] },
  { ruta: "/parametros", roles: ["analista"] },
  { ruta: "/motor-riesgo", roles: ["analista"] },
  { ruta: "/graph", roles: ["venta", "analista", "chequeo"] },
];

export function puedeVer(rol: Rol, pathname: string): boolean {
  if (rol === "superior") return true;
  const regla = PERMISOS.find((p) =>
    p.ruta === "/" ? pathname === "/" : pathname === p.ruta || pathname.startsWith(`${p.ruta}/`)
  );
  return regla ? regla.roles.includes(rol) : true;
}
