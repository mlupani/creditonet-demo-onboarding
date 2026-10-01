// Validación de créditos simultáneos en distintos canales (creditonet-118): un cliente con una
// solicitud viva en un canal no puede originar otra en un canal distinto. Los créditos que ya no
// están en trámite (anulados, rechazados y los ya liquidados) no lo bloquean.

import type { CreditApplication, EstadoCredito } from "./types";

const NO_BLOQUEAN: readonly EstadoCredito[] = ["ANULADO", "RECHAZADO", "ACTIVO"];

export function bloqueaSimultaneidad(estado: EstadoCredito): boolean {
  return !NO_BLOQUEAN.includes(estado);
}

type CreditoParaSimultaneidad = Pick<CreditApplication, "numeroCredito" | "estado" | "cliente" | "configuracion">;

const soloDigitos = (s: string) => s.replace(/\D+/g, "");

// Devuelve el crédito vivo del mismo cliente en otro canal (el primero), o undefined si el
// cliente puede originar en `canalId`. `numeroCredito` es el de la solicitud que se está
// cargando, para no compararla contra sí misma.
export function creditoSimultaneoEnOtroCanal<T extends CreditoParaSimultaneidad>(
  creditos: T[],
  dni: string,
  canalId: string,
  numeroCredito: string | null
): T | undefined {
  const documento = soloDigitos(dni);
  if (!documento) return undefined;
  return creditos.find(
    (c) =>
      bloqueaSimultaneidad(c.estado) &&
      c.cliente !== null &&
      soloDigitos(c.cliente.dni) === documento &&
      c.configuracion.canalId !== canalId &&
      (numeroCredito === null || c.numeroCredito !== numeroCredito)
  );
}
