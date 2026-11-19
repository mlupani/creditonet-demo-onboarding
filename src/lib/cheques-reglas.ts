// Reglas puras de cheques y valores en custodia (v2: 1.1/1.2 y 2.2). Sin estado ni efectos.

import type { Cheque, Chequera, EstadoCheque, FormaCheque, Moneda, TipoChequera } from "./caja-tipos";

// Transiciones válidas de estado por origen del cheque.
export const TRANSICIONES: Record<Cheque["origen"], Partial<Record<EstadoCheque, EstadoCheque[]>>> = {
  TERCERO: {
    EN_CUSTODIA: ["DEPOSITADO", "RECHAZADO", "ENTREGADO"],
    DEPOSITADO: ["RECHAZADO"],
  },
  PROPIO: {
    EMITIDO: ["COBRADO", "ANULADO"],
  },
};

export const puedeTransicionar = (c: Pick<Cheque, "origen" | "estado">, hacia: EstadoCheque): boolean =>
  (TRANSICIONES[c.origen][c.estado] ?? []).includes(hacia);

// Un tipo de chequera cuya descripción es "E-cheq" (sin importar guion ni mayúsculas) emite e-cheqs.
export const formaDeTipo = (tipo: TipoChequera | undefined): FormaCheque =>
  tipo && /echeq/.test(tipo.descripcion.toLowerCase().replace(/[^a-z]/g, "")) ? "ECHEQ" : "FISICO";

const numeroDe = (texto: string): number => Number(texto.replace(/\D/g, "")) || 0;

// Cheques propios librados contra una chequera (los anulados también consumen su número).
export const chequesDeChequera = (chequeraId: string, cheques: Cheque[]) =>
  cheques.filter((c) => c.origen === "PROPIO" && c.chequeraId === chequeraId);

export interface NumeracionChequera {
  conRango: boolean;
  total: number; // 0 si no hay rango
  usados: number;
  disponibles: number; // 0 si no hay rango
}

export function numeracionDe(chequera: Chequera, cheques: Cheque[]): NumeracionChequera {
  const usados = chequesDeChequera(chequera.id, cheques).length;
  const desde = numeroDe(chequera.desde);
  const hasta = numeroDe(chequera.hasta);
  const conRango = chequera.desde !== "" && chequera.hasta !== "" && hasta >= desde;
  const total = conRango ? hasta - desde + 1 : 0;
  return { conRango, total, usados, disponibles: conRango ? Math.max(0, total - usados) : 0 };
}

// Próximo número libre de la chequera: dentro del rango si lo tiene; si no (e-cheq), un correlativo propio.
export function proximoNumero(chequera: Chequera, forma: FormaCheque, cheques: Cheque[]): string | null {
  const usados = new Set(chequesDeChequera(chequera.id, cheques).map((c) => c.numero));
  if (chequera.desde !== "" && chequera.hasta !== "") {
    const desde = numeroDe(chequera.desde);
    const hasta = numeroDe(chequera.hasta);
    for (let n = desde; n <= hasta; n++) {
      const texto = String(n).padStart(chequera.desde.length, "0");
      if (!usados.has(texto)) return texto;
    }
    return null;
  }
  if (forma !== "ECHEQ") return null;
  const ultimo = Math.max(0, ...[...usados].map(numeroDe));
  return `E-${String(ultimo + 1).padStart(4, "0")}`;
}

// Cheques de terceros que una caja tiene en custodia.
export const enCustodia = (cajaId: string, cheques: Cheque[]) =>
  cheques.filter((c) => c.origen === "TERCERO" && c.estado === "EN_CUSTODIA" && c.cajaId === cajaId);

export const totalPorMoneda = (cheques: Cheque[]): Record<Moneda, number> => ({
  ARS: cheques.filter((c) => c.moneda === "ARS").reduce((s, c) => s + c.importe, 0),
  USD: cheques.filter((c) => c.moneda === "USD").reduce((s, c) => s + c.importe, 0),
});

const MS_DIA = 86_400_000;
const aDia = (fecha: string) => Date.UTC(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)) - 1, Number(fecha.slice(8, 10)));

// Días hasta el vencimiento (negativo si ya venció).
export const diasHastaPago = (fechaPago: string, hoy: string) => Math.round((aDia(fechaPago) - aDia(hoy)) / MS_DIA);

export const vencePronto = (c: Cheque, hoy: string, dias = 7): boolean =>
  c.estado === "EN_CUSTODIA" && diasHastaPago(c.fechaPago, hoy) <= dias;
