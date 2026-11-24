// Aviso de acuerdos bancarios próximos a vencer (v4, 4.1): se muestra en la Posición de saldos.
// Regla pura, sin estado: recibe los acuerdos y la fecha operativa.

import type { AcuerdoBancario } from "./caja-tipos";

// Días de anticipación con los que se avisa un vencimiento.
export const DIAS_AVISO_ACUERDO = 30;

export interface AvisoAcuerdo {
  acuerdoId: string;
  cuentaId: string;
  vencimiento: string;
  // Días que faltan para el vencimiento; negativo si ya venció.
  dias: number;
  vencido: boolean;
}

// Días entre dos fechas ISO (aaaa-mm-dd), sin depender de la zona horaria ni del horario de verano.
export const diasHastaVencimiento = (vencimiento: string, fecha: string): number => {
  const aDias = (iso: string) => {
    const [a, m, d] = iso.split("-").map(Number);
    return Date.UTC(a, m - 1, d) / 86400000;
  };
  return Math.round(aDias(vencimiento) - aDias(fecha));
};

// Acuerdos activos que vencen dentro del plazo de aviso o que ya vencieron, del más urgente al menos.
export function acuerdosPorVencer(
  acuerdos: AcuerdoBancario[],
  fecha: string,
  umbral: number = DIAS_AVISO_ACUERDO
): AvisoAcuerdo[] {
  return acuerdos
    .filter((a) => a.estado === "ACTIVO")
    .map((a) => {
      const dias = diasHastaVencimiento(a.vencimiento, fecha);
      return { acuerdoId: a.id, cuentaId: a.cuentaId, vencimiento: a.vencimiento, dias, vencido: dias < 0 };
    })
    .filter((a) => a.dias <= umbral)
    .sort((x, y) => x.dias - y.dias);
}

// "vence en 7 días", "vence hoy", "vence mañana" o "venció hace 3 días".
export function textoVencimiento(dias: number): string {
  if (dias < 0) return `venció hace ${-dias} ${-dias === 1 ? "día" : "días"}`;
  if (dias === 0) return "vence hoy";
  if (dias === 1) return "vence mañana";
  return `vence en ${dias} días`;
}
