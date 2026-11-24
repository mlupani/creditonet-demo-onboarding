// Matriz de autorizaciones (7.18): por tipo de operación, qué perfil carga, qué perfil autoriza y hasta
// qué importe. Una operación tiene varios escalones; el importe decide cuáles aplican. Las funciones
// reciben las reglas por parámetro (para los tests) y, si falta, leen las del store.

import { controlStores } from "./control-store";
import { ROL_CAJA_LABEL, SIMBOLO, type Moneda, type RolCaja, type UsuarioCaja } from "./caja-tipos";
import { OPERACION_MATRIZ_LABEL, type ReglaMatriz, type TipoOperacionMatriz } from "./control-tipos";

const activas = (reglas: ReglaMatriz[], operacion: TipoOperacionMatriz) =>
  reglas.filter((r) => r.operacion === operacion && r.estado === "ACTIVO");

// Escalones que cubren el importe: el tope vacío no limita.
export function reglasAplicables(operacion: TipoOperacionMatriz, importe: number, moneda: Moneda, reglas: ReglaMatriz[] = controlStores.matriz.get()): ReglaMatriz[] {
  return activas(reglas, operacion).filter((r) => {
    const tope = r.importeHasta[moneda];
    return tope === null || importe <= tope;
  });
}

const unicos = (roles: RolCaja[]) => [...new Set(roles)];

export function perfilesQueAutorizan(operacion: TipoOperacionMatriz, importe: number, moneda: Moneda, reglas: ReglaMatriz[] = controlStores.matriz.get()): RolCaja[] {
  return unicos(reglasAplicables(operacion, importe, moneda, reglas).flatMap((r) => r.perfilAutoriza));
}

export function perfilesQueCargan(operacion: TipoOperacionMatriz, reglas: ReglaMatriz[] = controlStores.matriz.get()): RolCaja[] {
  return unicos(activas(reglas, operacion).flatMap((r) => r.perfilCarga));
}

// Devuelve el motivo si el usuario no puede autorizar la operación por ese importe, o null si puede.
export function puedeAutorizarPorMatriz(
  usuario: UsuarioCaja | undefined,
  operacion: TipoOperacionMatriz,
  importe: number,
  moneda: Moneda,
  reglas: ReglaMatriz[] = controlStores.matriz.get()
): string | null {
  if (!usuario) return "Elegí el usuario que autoriza.";
  if (activas(reglas, operacion).length === 0) return `La matriz de autorizaciones no tiene reglas activas para ${OPERACION_MATRIZ_LABEL[operacion].toLowerCase()}.`;
  const perfiles = perfilesQueAutorizan(operacion, importe, moneda, reglas);
  if (perfiles.some((p) => usuario.roles.includes(p))) return null;
  const quienes = perfiles.length > 0 ? perfiles.map((p) => ROL_CAJA_LABEL[p]).join(", ") : "nadie (el importe supera todos los topes)";
  return `Tu perfil no puede autorizar ${OPERACION_MATRIZ_LABEL[operacion].toLowerCase()} por ${SIMBOLO[moneda]} ${importe.toLocaleString("es-AR")}. Autorizan: ${quienes}.`;
}

// Si algún escalón aplicable admite la autorización remota de Casa Central para un perfil del usuario.
export function admiteRemota(usuario: UsuarioCaja, operacion: TipoOperacionMatriz, importe: number, moneda: Moneda, reglas: ReglaMatriz[] = controlStores.matriz.get()): boolean {
  return reglasAplicables(operacion, importe, moneda, reglas).some((r) => r.admiteRemota && r.perfilAutoriza.some((p) => usuario.roles.includes(p)));
}

// Si el escalón con el que autoriza el usuario exige una segunda autorización.
export const requiereDobleAutorizacion = (usuario: UsuarioCaja, operacion: TipoOperacionMatriz, importe: number, moneda: Moneda, reglas: ReglaMatriz[] = controlStores.matriz.get()): boolean =>
  reglasAplicables(operacion, importe, moneda, reglas).some((r) => r.dobleAutorizacion && r.perfilAutoriza.some((p) => usuario.roles.includes(p)));
