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

export function formatSignedARS(value: number): string {
  if (value < 0) return `−$${formatNumber(Math.abs(value))}`;
  return `+$${formatNumber(value)}`;
}

export function onlyDigits(value: string): string {
  return value.replace(/\D+/g, "");
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

export function isValidPhone(value: string): boolean {
  return onlyDigits(value).length >= 8;
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

export function isValidCard(value: string): boolean {
  return onlyDigits(value).length >= 15 && onlyDigits(value).length <= 16;
}
