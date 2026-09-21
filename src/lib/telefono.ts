// Teléfonos con área (país) + número nacional. La cantidad de dígitos del número depende del
// país elegido (sin el 0 ni el 15 de discado local).

import { onlyDigits } from "./format";

export interface PaisTelefono {
  codigo: string; // "+54"
  iso: string; // "ar": nombre del archivo de la bandera
  nombre: string;
  min: number;
  max: number;
}

export const PAIS_POR_DEFECTO = "+54";

export const PAISES_TELEFONO: PaisTelefono[] = [
  { codigo: "+54", iso: "ar", nombre: "Argentina", min: 10, max: 10 },
  { codigo: "+598", iso: "uy", nombre: "Uruguay", min: 8, max: 8 },
  { codigo: "+56", iso: "cl", nombre: "Chile", min: 9, max: 9 },
  { codigo: "+595", iso: "py", nombre: "Paraguay", min: 9, max: 9 },
  { codigo: "+591", iso: "bo", nombre: "Bolivia", min: 8, max: 8 },
  { codigo: "+55", iso: "br", nombre: "Brasil", min: 10, max: 11 },
  { codigo: "+51", iso: "pe", nombre: "Perú", min: 8, max: 9 },
  { codigo: "+57", iso: "co", nombre: "Colombia", min: 10, max: 10 },
  { codigo: "+58", iso: "ve", nombre: "Venezuela", min: 10, max: 10 },
  { codigo: "+593", iso: "ec", nombre: "Ecuador", min: 8, max: 9 },
  { codigo: "+52", iso: "mx", nombre: "México", min: 10, max: 10 },
  { codigo: "+34", iso: "es", nombre: "España", min: 9, max: 9 },
  { codigo: "+1", iso: "us", nombre: "Estados Unidos", min: 10, max: 10 },
];

export function getPaisTelefono(codigo: string): PaisTelefono {
  return (
    PAISES_TELEFONO.find((p) => p.codigo === codigo) ??
    PAISES_TELEFONO.find((p) => p.codigo === PAIS_POR_DEFECTO)!
  );
}

export function labelPais(p: PaisTelefono): string {
  return `${p.nombre} (${p.codigo})`;
}

export function banderaPais(iso: string): string {
  return `/flags/${iso}.png`;
}

export function textoDigitos(p: PaisTelefono): string {
  return p.min === p.max ? `${p.max} dígitos` : `${p.min} a ${p.max} dígitos`;
}

// Deja sólo dígitos y corta en el máximo del país.
export function sanitizarNumero(codigoPais: string, valor: string): string {
  return onlyDigits(valor).slice(0, getPaisTelefono(codigoPais).max);
}

export function validarNumero(codigoPais: string, valor: string): string | null {
  const pais = getPaisTelefono(codigoPais);
  const n = onlyDigits(valor).length;
  if (n >= pais.min && n <= pais.max) return null;
  return `El teléfono de ${pais.nombre} debe tener ${textoDigitos(pais)}.`;
}

// Teléfono en un único texto ("+54 3515432100"), como lo guardan el cliente y las personas
// vinculadas. Un valor sin código (datos previos) se toma como del país por defecto.
export function armarTelefono(codigoPais: string, numero: string): string {
  return `${codigoPais} ${numero}`;
}

export function parseTelefono(valor: string): { pais: string; numero: string } {
  const m = /^(\+\d+)(?:\s+(.*))?$/.exec(valor.trim());
  if (m && PAISES_TELEFONO.some((p) => p.codigo === m[1])) {
    return { pais: m[1], numero: onlyDigits(m[2] ?? "") };
  }
  return { pais: PAIS_POR_DEFECTO, numero: onlyDigits(valor) };
}

export function formatTelefono(codigoPais: string, numero: string): string {
  return numero ? `${codigoPais || PAIS_POR_DEFECTO} ${numero}` : "";
}
