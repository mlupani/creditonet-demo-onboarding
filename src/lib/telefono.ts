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

const MAX_DIGITOS_CARACTERISTICA = 5;

// Deja sólo dígitos en la característica (código de área/localidad); no depende del país porque
// su largo varía mucho entre localidades de un mismo país.
export function sanitizarCaracteristica(valor: string): string {
  return onlyDigits(valor).slice(0, MAX_DIGITOS_CARACTERISTICA);
}

// Deja sólo dígitos y corta en lo que le queda al número una vez descontada la característica,
// para no superar el máximo del país entre los dos campos.
export function sanitizarNumero(codigoPais: string, caracteristica: string, valor: string): string {
  const pais = getPaisTelefono(codigoPais);
  const max = Math.max(0, pais.max - onlyDigits(caracteristica).length);
  return onlyDigits(valor).slice(0, max);
}

export function validarNumero(codigoPais: string, caracteristica: string, valor: string): string | null {
  const pais = getPaisTelefono(codigoPais);
  const n = onlyDigits(caracteristica).length + onlyDigits(valor).length;
  if (n >= pais.min && n <= pais.max) return null;
  return `El teléfono de ${pais.nombre} debe tener ${textoDigitos(pais)} entre característica y número.`;
}

// Teléfono en un único texto ("+54 351 5432100"), como lo guardan el cliente y las personas
// vinculadas.
export function armarTelefono(codigoPais: string, caracteristica: string, numero: string): string {
  return [codigoPais, caracteristica, numero].filter((p) => p !== "").join(" ");
}

// Un valor sin código de país (datos previos) se toma como del país por defecto. Si tras el país
// quedan dos partes, la primera es la característica; con una sola, es el número completo (no se
// puede adivinar dónde empieza la característica).
export function parseTelefono(valor: string): { pais: string; caracteristica: string; numero: string } {
  const partes = valor.trim().split(/\s+/).filter(Boolean);
  let pais = PAIS_POR_DEFECTO;
  if (partes[0] && PAISES_TELEFONO.some((p) => p.codigo === partes[0])) {
    pais = partes.shift()!;
  }
  if (partes.length >= 2) {
    return { pais, caracteristica: onlyDigits(partes[0]), numero: onlyDigits(partes.slice(1).join("")) };
  }
  return { pais, caracteristica: "", numero: onlyDigits(partes.join("")) };
}

export function formatTelefono(codigoPais: string, caracteristica: string, numero: string): string {
  return numero ? armarTelefono(codigoPais || PAIS_POR_DEFECTO, caracteristica, numero) : "";
}
