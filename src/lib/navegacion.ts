// Árbol del menú lateral, con la misma estructura que el de creditonet-fe (Versión 1 del árbol de
// menú): módulos de primer nivel que contienen pantallas, grupos anidados y opciones "próximamente".
// Sin JSX: lo comparten el Sidebar y los tests. Los módulos sin pantalla en la demo se declaran
// `proximamente` y sólo los ve el rol superior.

import { esSuperior, puedeVer, type Rol } from "./roles";

export type IconoMenu =
  | "creditos"
  | "onboarding"
  | "parametros"
  | "usuarios"
  | "caja"
  | "contable"
  | "reportes"
  | "flujo";

/** Pantalla navegable: una ruta de la demo, con la solapa de Parámetros cuando corresponde. */
export interface MenuPantalla {
  label: string;
  href: string;
  /** Valor de `?solapa=` (sólo Parámetros). */
  solapa?: string;
  icono?: IconoMenu;
  /** Roles que la ven (el superior siempre). Si falta, decide la ruta en `roles.ts`. */
  roles?: Rol[];
}

/** Grupo: agrupa opciones sin ser pantalla propia; puede anidarse. */
export interface MenuGrupo {
  label: string;
  icono?: IconoMenu;
  children: readonly MenuEntrada[];
}

/** Opción prevista que todavía no tiene pantalla en la demo. */
export interface MenuProximamente {
  label: string;
  icono?: IconoMenu;
  proximamente: true;
}

export type MenuEntrada = MenuPantalla | MenuGrupo | MenuProximamente;

export const esProximamente = (e: MenuEntrada): e is MenuProximamente => "proximamente" in e;
export const esGrupo = (e: MenuEntrada): e is MenuGrupo => "children" in e;

const pronto = (label: string): MenuProximamente => ({ label, proximamente: true });
const solapa = (label: string, id: string, roles: Rol[] = ["analista"]): MenuPantalla => ({
  label,
  href: "/parametros",
  solapa: id,
  roles,
});
const solapaCaja = (label: string, id: string) => solapa(label, id, ["caja"]);
const caja = (label: string, href: string): MenuPantalla => ({ label, href });

export const SOLAPA_POR_DEFECTO = "motivos";

export const MENU: readonly MenuEntrada[] = [
  {
    label: "Créditos",
    icono: "creditos",
    children: [
      { label: "Solicitar crédito", href: "/onboarding" },
      {
        label: "Bandejas",
        children: [
          { label: "Solicitudes", href: "/" },
          { label: "Análisis", href: "/analisis" },
          { label: "Chequeo", href: "/chequeo" },
        ],
      },
      { label: "Producto", href: "/productos" },
      { label: "Organismo", href: "/organismos" },
      { label: "Plan de cuota", href: "/planes" },
      { label: "Notificaciones", href: "/notificaciones" },
      pronto("Plantillas de documento"),
      { label: "Motor de riesgo", href: "/motor-riesgo" },
      { label: "Mora", href: "/mora" },
    ],
  },
  {
    label: "Onboarding",
    icono: "onboarding",
    children: [pronto("Configuraciones de firma"), pronto("Solicitudes de firma")],
  },
  {
    label: "Parámetros",
    icono: "parametros",
    children: [
      {
        label: "Personas",
        children: [
          pronto("Condiciones laborales"),
          pronto("Documentación"),
          pronto("Estados civiles"),
          pronto("Nacionalidades"),
          pronto("Rubros de actividad laboral"),
          pronto("Tipos de cliente"),
          pronto("Tipos de vivienda"),
          pronto("Vínculos"),
        ],
      },
      { label: "Ubicación", children: [pronto("Localidades"), solapa("Provincias (sellado)", "provincias")] },
      {
        label: "Financiero",
        children: [
          pronto("Bancos"),
          solapa("Cargos/servicios", "servicios"),
          solapa("Impositivos", "impositivos"),
          pronto("Proveedores de tokenización"),
          pronto("Tipos de tarjeta"),
        ],
      },
      {
        label: "Operativo",
        children: [pronto("Canales"), pronto("Compañías telefónicas"), solapa("Motivos de observación", "motivos")],
      },
      {
        label: "Caja y Bancos",
        children: [
          solapaCaja("Sucursales", "sucursales"),
          solapaCaja("Cajas", "cajas"),
          solapaCaja("Denominaciones", "denominaciones"),
          solapaCaja("Bancos", "cuentas-bancarias"),
          solapaCaja("Tipos de chequera", "tipos-chequera"),
          solapaCaja("Feriados", "feriados"),
          solapaCaja("Motivos de diferencia de caja", "motivos-diferencia"),
          solapaCaja("Tipos de movimiento de tesorería", "tipos-movimiento"),
          solapaCaja("Estados de movimientos de tesorería", "estados-movimiento"),
          solapaCaja("Matriz de autorizaciones y llaves", "matriz-autorizacion"),
          solapaCaja("Alertas, destinatarios y plazos", "alertas-destinatarios"),
        ],
      },
      {
        label: "Proveedores",
        children: [
          solapaCaja("Proveedores", "proveedores"),
          solapaCaja("Tipos de comprobante", "tipos-comprobante"),
          solapaCaja("Estados de comprobantes", "estados-comprobante"),
        ],
      },
    ],
  },
  {
    label: "Usuarios y accesos",
    icono: "usuarios",
    children: [pronto("Usuarios"), pronto("Roles"), pronto("Permisos")],
  },
  {
    label: "Caja y Bancos",
    icono: "caja",
    children: [
      {
        label: "Caja",
        children: [
          caja("Apertura de caja", "/caja/apertura"),
          caja("Cierre de caja", "/caja/cierre"),
          caja("Arqueo de caja", "/caja/arqueo"),
          caja("Cambio de turno", "/caja/turno"),
          caja("Libro de movimientos de caja", "/caja/libro"),
          caja("Cierre de sucursal", "/caja/cierre-sucursal"),
        ],
      },
      {
        label: "Bancos",
        children: [
          caja("Alta de acuerdos", "/caja/acuerdos"),
          caja("Alta de chequeras", "/caja/chequeras"),
          caja("Cheques y valores", "/caja/cheques"),
          caja("Conciliaciones", "/caja/bancos"),
        ],
      },
      // La Bandeja reemplaza a Movimientos de tesorería (vista Remesas) y al pago de órdenes de pago.
      caja("Bandeja de autorizaciones", "/caja/bandeja"),
      {
        label: "Posición de caja y bancos",
        children: [
          caja("Posición de saldos", "/caja/posicion"),
          caja("Tablero de tesoros", "/caja/tablero"),
          caja("Histórico de saldos", "/caja/historico"),
          caja("Alertas enviadas", "/caja/alertas"),
        ],
      },
      pronto("Cash flow"),
      {
        label: "Proveedores",
        children: [
          caja("Carga de comprobantes", "/proveedores/carga"),
          caja("Órdenes de pago", "/proveedores/ordenes"),
          caja("Posición de proveedores", "/proveedores/posicion"),
          caja("Consultas", "/proveedores/consultas"),
        ],
      },
    ],
  },
  { label: "Contable", icono: "contable", proximamente: true },
  { label: "Reportes", icono: "reportes", proximamente: true },
  // Pantalla propia de la demo: no existe en creditonet-fe.
  { label: "Diagrama de flujo", href: "/graph", icono: "flujo" },
];

/** Href real de la pantalla, con su solapa. */
export const hrefPantalla = (p: MenuPantalla): string =>
  p.solapa ? `${p.href}?solapa=${p.solapa}` : p.href;

/** Pantallas de un árbol, en orden de menú y a cualquier nivel. */
export function pantallas(entradas: readonly MenuEntrada[]): MenuPantalla[] {
  return entradas.flatMap((e) => (esProximamente(e) ? [] : esGrupo(e) ? pantallas(e.children) : [e]));
}

/**
 * Árbol que ve el rol: sólo sus pantallas; las opciones "próximamente" son del superior y los
 * grupos que quedan vacíos se podan.
 */
export function menuVisible(rol: Rol, entradas: readonly MenuEntrada[] = MENU): MenuEntrada[] {
  return entradas.flatMap((e): MenuEntrada[] => {
    if (esProximamente(e)) return esSuperior(rol) ? [e] : [];
    if (esGrupo(e)) {
      const children = menuVisible(rol, e.children);
      return children.length > 0 ? [{ ...e, children }] : [];
    }
    const visible = e.roles ? esSuperior(rol) || e.roles.includes(rol) : puedeVer(rol, e.href);
    return visible ? [e] : [];
  });
}

/** Indica si el rol ve la solapa de Parámetros (cada ABM es de un rol, el superior ve todas). */
export const solapaVisible = (rol: Rol, id: string): boolean =>
  esSuperior(rol) || (pantallas(MENU).find((p) => p.solapa === id)?.roles ?? []).includes(rol);

const coincide = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/**
 * Pantalla activa para la ruta y la solapa actuales. Gana la ruta más larga; en Parámetros
 * decide la solapa (la primera si falta o es desconocida).
 */
export function pantallaActiva(
  pathname: string,
  solapaActual: string | null,
  entradas: readonly MenuEntrada[] = MENU
): MenuPantalla | undefined {
  const candidatas = pantallas(entradas).filter((p) => coincide(pathname, p.href));
  const conSolapa = candidatas.filter((p) => p.solapa);
  if (conSolapa.length > 0) {
    const conocida = conSolapa.some((p) => p.solapa === solapaActual);
    const pedida = conocida ? solapaActual : SOLAPA_POR_DEFECTO;
    return conSolapa.find((p) => p.solapa === pedida);
  }
  return candidatas.sort((a, b) => b.href.length - a.href.length)[0];
}

/** Indica si la entrada, o algún descendiente, es la pantalla activa. */
export function contienePantalla(e: MenuEntrada, activa: MenuPantalla | undefined): boolean {
  if (!activa || esProximamente(e)) return false;
  if (esGrupo(e)) return e.children.some((c) => contienePantalla(c, activa));
  return e === activa;
}

/** Primera pantalla de la entrada, en orden de menú. */
export function primeraPantalla(e: MenuEntrada): MenuPantalla | undefined {
  return esProximamente(e) ? undefined : esGrupo(e) ? pantallas(e.children)[0] : e;
}
