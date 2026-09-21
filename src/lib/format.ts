const numberFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 0,
});

export function formatNumber(value: number): string {
  return numberFormatter.format(Math.round(value));
}

export function formatARS(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${formatNumber(Math.abs(value))}`;
}

export function formatPct(value: number): string {
  return `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`;
}

export function formatSignedARS(value: number): string {
  if (value < 0) return `−$${formatNumber(Math.abs(value))}`;
  return `+$${formatNumber(value)}`;
}

export function onlyDigits(value: string): string {
  return value.replace(/\D+/g, "");
}

export function nombreApellido(p: { nombre: string; apellido: string }): string {
  return `${p.nombre} ${p.apellido}`.trim();
}

const sinAcentos = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Buscador de las bandejas: con dígitos busca por DNI/CUIL, si no por apellido o nombre.
export function coincideCliente(
  c: { dni: string; cuil: string; apellido: string; nombre: string },
  busqueda: string
): boolean {
  const q = busqueda.trim();
  if (!q) return true;
  if (/\d/.test(q)) {
    const d = onlyDigits(q);
    return c.dni.includes(d) || onlyDigits(c.cuil).includes(d);
  }
  return sinAcentos(`${c.apellido} ${c.nombre}`).includes(sinAcentos(q));
}

// Máscara de entrada de CUIT/CUIL xx-xxxxxxxx-x: sólo dígitos, con los guiones puestos solos.
export function maskCuit(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

export function isValidDNI(value: string): boolean {
  const d = onlyDigits(value);
  return d.length >= 7 && d.length <= 8;
}

export function isValidCUIL(value: string): boolean {
  return /^\d{2}-?\d{8}-?\d$/.test(value.trim());
}

export function isValidCBU(value: string): boolean {
  return onlyDigits(value).length === 22;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function formatDNI(value: string): string {
  const d = onlyDigits(value);
  return d ? formatNumber(Number(d)) : "";
}

// Sello de tiempo para la demo ("Hoy HH:MM").
export function selloTiempo(): string {
  const hora = new Date().toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Hoy ${hora}`;
}

// --- Fechas dd/mm/aaaa ---

function aTexto(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// Máscara de entrada dd/mm/aaaa: deja sólo dígitos e inserta las barras a medida que se escribe.
// Si se tipea la barra después de un día o mes de un dígito ("5/4/1988"), lo completa con 0.
export function maskFecha(value: string): string {
  const partes = value.split("/").slice(0, 3);
  const d = partes
    .map((p, i) => {
      const digitos = onlyDigits(p);
      return i < 2 && i < partes.length - 1 && digitos.length === 1 ? `0${digitos}` : digitos;
    })
    .join("")
    .slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function parseFecha(value: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fechaHoy(): string {
  return aTexto(new Date());
}

export function sumarDias(fecha: string, dias: number): string {
  const base = parseFecha(fecha) ?? new Date();
  base.setDate(base.getDate() + dias);
  return aTexto(base);
}

export function calcularEdad(fechaNacimiento: string): number | null {
  const nac = parseFecha(fechaNacimiento);
  if (!nac) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const cumple = new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate());
  if (hoy < cumple) edad -= 1;
  return edad;
}

export function isValidCard(value: string): boolean {
  return onlyDigits(value).length >= 15 && onlyDigits(value).length <= 16;
}
