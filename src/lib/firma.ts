// Lógica pura del tramo firma → chequeo telefónico → liquidación.
//
// Tras la aprobación del analista: FEL (esperando la firma del cliente) → AFEL (el analista
// verifica la firma) → chequeo telefónico, si el producto lo pide → para liquidar. La firma
// admite una única refirma: como máximo hay dos instancias en el historial.

import {
  MAX_INTENTOS_FIRMA,
  type CreditApplication,
  type EstadoCredito,
  type IntentoFirma,
  type MetodoFirma,
} from "./types";
import { extrasEfectivos, type ModalidadFirma } from "./productos";

type Seleccion = CreditApplication["configuracion"];

export const ESTADOS_FIRMA: EstadoCredito[] = ["EN_FIRMA", "FIRMADO", "CHEQUEO_TELEFONICO"];

// Producto con las excepciones del organismo. Sin producto conocido, la modalidad más abierta.
export function modalidadFirma(sel: Seleccion): ModalidadFirma {
  return extrasEfectivos(sel.productoId, sel.organismoId)?.modalidadFirma ?? "AMBAS";
}

export function requiereChequeoTelefonico(sel: Seleccion): boolean {
  return extrasEfectivos(sel.productoId, sel.organismoId)?.requiereChequeoTelefonico ?? false;
}

// Método de firma con el que arranca el crédito. En "Ambas" lo elige el analista al aprobar.
export function metodoPorDefecto(modalidad: ModalidadFirma): MetodoFirma {
  return modalidad === "FISICA" ? "FISICA" : "ELECTRONICA";
}

export function intentoActual(firmas: IntentoFirma[]): IntentoFirma | null {
  return firmas.length > 0 ? firmas[firmas.length - 1] : null;
}

// Sólo se permite una refirma: con dos instancias en el historial ya no se ofrece.
export function puedeRefirmar(firmas: IntentoFirma[]): boolean {
  return firmas.length > 0 && firmas.length < MAX_INTENTOS_FIRMA;
}

export function firmaAprobada(firmas: IntentoFirma[]): boolean {
  return intentoActual(firmas)?.resultado === "APROBADA";
}

// Guardia central: no se liquida sin firma aprobada ni, si el producto lo exige, sin chequeo.
export function puedeLiquidar(
  app: Pick<CreditApplication, "firmas" | "chequeoTelefonico" | "configuracion">
): boolean {
  if (!firmaAprobada(app.firmas)) return false;
  return (
    !requiereChequeoTelefonico(app.configuracion) || app.chequeoTelefonico?.resultado === "OK"
  );
}

// Historial de los créditos de la DB simulada, coherente con su estado.
export function firmasDeSemilla(
  c: Pick<CreditApplication, "estado" | "fechaAprobacion" | "fechaEnvioAnalisis" | "fechaSolicitud">
): IntentoFirma[] {
  const fecha = c.fechaAprobacion ?? c.fechaEnvioAnalisis ?? c.fechaSolicitud;
  switch (c.estado) {
    case "EN_FIRMA":
      return [{ n: 1, metodo: "ELECTRONICA", fechaFirma: null, resultado: "PENDIENTE", fechaResultado: null }];
    case "FIRMADO":
      return [{ n: 1, metodo: "ELECTRONICA", fechaFirma: fecha, resultado: "PENDIENTE", fechaResultado: null }];
    case "CHEQUEO_TELEFONICO":
    case "PARA_LIQUIDAR":
      return [{ n: 1, metodo: "ELECTRONICA", fechaFirma: fecha, resultado: "APROBADA", fechaResultado: fecha }];
    default:
      return [];
  }
}
