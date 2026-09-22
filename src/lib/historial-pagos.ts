import type { CreditoActivo } from "./types";

export type EstadoCuota = "Pagada" | "Pagada con atraso" | "Pendiente" | "En mora" | "Vence pronto";

export interface CuotaHistorial {
  nro: number;
  vencimiento: string; // dd/mm/yyyy
  importe: number;
  fechaPago: string | null; // dd/mm/yyyy or null
  estado: EstadoCuota;
  diasAtraso: number | null;
  medio: string;
}

// Genera fechas determinísticas: la última cuota pagada venció hace ~25 días,
// el resto cada ~30 días. Usa el id del crédito como seed para variaciones.
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatFecha(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fechaVencimientoCuota(nro: number, credito: CreditoActivo): Date {
  // Última cuota pagada = hace 25 días (coherente con card "hace 25 días")
  const hoy = new Date(2026, 8, 22); // 22/09/2026 fijo para demo determinística
  const diasDesdeVencimientoUltimaPaga = 25;
  // Si nro == cuotasAbonadas → venció hace 25 días
  // Si nro < cuotasAbonadas → 30 días antes por cada cuota
  // Si nro > cuotasAbonadas → 30 días después por cada cuota futura
  const deltaCuotas = nro - credito.cuotasAbonadas;
  // delta 0 = -25 días, delta 1 = +30-25 = +5 días (vence en 5 días), etc.
  // Aproximación: 30 días por cuota
  const diasOffset = deltaCuotas * 30 - diasDesdeVencimientoUltimaPaga;
  // Ajuste determinístico por crédito para no alinear todos igual: +/-2 días según hash
  const jitter = (hashCode(credito.id) % 5) - 2;
  return addDays(hoy, diasOffset + jitter);
}

export function generarHistorialPagos(credito: CreditoActivo): CuotaHistorial[] {
  const h = hashCode(credito.id);
  const cuotas: CuotaHistorial[] = [];
  for (let n = 1; n <= credito.cuotasOriginales; n++) {
    const vencDate = fechaVencimientoCuota(n, credito);
    const vencimiento = formatFecha(vencDate);
    const esPasada = n <= credito.cuotasAbonadas;
    const esSiguiente = n === credito.cuotasAbonadas + 1;
    let estado: EstadoCuota = "Pendiente";
    let fechaPago: string | null = null;
    let diasAtraso: number | null = null;
    let medio = "—";

    if (esPasada) {
      // Determinístico: ~15% con atraso leve (3-9 días)
      const conAtraso = (h + n * 7) % 7 === 0;
      if (conAtraso && n !== credito.cuotasAbonadas) {
        const atraso = ((h + n) % 7) + 3; // 3-9
        estado = "Pagada con atraso";
        diasAtraso = atraso;
        fechaPago = formatFecha(addDays(vencDate, atraso));
        medio = "Débito automático";
      } else if (credito.enMora && n === credito.cuotasAbonadas) {
        // Última pagada de un crédito en mora se pagó con atraso mayor
        const atraso = 12 + (h % 8);
        estado = "Pagada con atraso";
        diasAtraso = atraso;
        fechaPago = formatFecha(addDays(vencDate, atraso));
        medio = "Pago voluntario";
      } else {
        estado = "Pagada";
        fechaPago = formatFecha(addDays(vencDate, (h + n) % 2)); // 0-1 día
        medio = n % 3 === 0 ? "Pago voluntario" : "Débito automático";
      }
    } else if (esSiguiente) {
      if (credito.enMora) {
        estado = "En mora";
        // vencida hace 5-15 días
        // ya calculado como vencDate en pasado reciente
        diasAtraso = Math.max(1, Math.round((Date.now() - vencDate.getTime()) / 86400000));
        // Recalculamos atraso coherente: hoy - vencDate (~5 días + jitter)
        const hoy = new Date(2026, 8, 22);
        const diff = Math.round((hoy.getTime() - vencDate.getTime()) / 86400000);
        diasAtraso = diff > 0 ? diff : 5;
        medio = "—";
      } else {
        // Si vence en <=7 días → Vence pronto
        const hoy = new Date(2026, 8, 22);
        const diff = Math.round((vencDate.getTime() - hoy.getTime()) / 86400000);
        estado = diff >= 0 && diff <= 7 ? "Vence pronto" : "Pendiente";
        medio = "—";
      }
    } else {
      estado = "Pendiente";
      medio = "—";
    }

    cuotas.push({
      nro: n,
      vencimiento,
      importe: credito.valorCuota,
      fechaPago,
      estado,
      diasAtraso,
      medio,
    });
  }
  return cuotas;
}

export function resumenHistorial(cuotas: CuotaHistorial[]) {
  const pagadas = cuotas.filter((c) => c.estado === "Pagada").length;
  const conAtraso = cuotas.filter((c) => c.estado === "Pagada con atraso").length;
  const enMora = cuotas.filter((c) => c.estado === "En mora").length;
  const pendientes = cuotas.filter((c) => c.estado === "Pendiente" || c.estado === "Vence pronto").length;
  const maxAtraso = Math.max(0, ...cuotas.map((c) => c.diasAtraso ?? 0));
  return { pagadas, conAtraso, enMora, pendientes, maxAtraso };
}

export function estadoTone(estado: EstadoCuota): string {
  switch (estado) {
    case "Pagada":
      return "text-success-700 bg-success-50 border-success-200";
    case "Pagada con atraso":
      return "text-warning-700 bg-warning-50 border-warning-200";
    case "En mora":
      return "text-danger-700 bg-danger-50 border-danger-200";
    case "Vence pronto":
      return "text-warning-700 bg-warning-50 border-warning-200";
    case "Pendiente":
    default:
      return "text-ink-500 bg-ink-50 border-ink-200";
  }
}

// Para mostrar en la card resumen rápido
export function textoUltimoPago(credito: CreditoActivo): string {
  if (credito.cuotasAbonadas === 0) return "Sin pagos registrados";
  const hist = generarHistorialPagos(credito);
  const ultima = hist[credito.cuotasAbonadas - 1];
  if (!ultima) return "hace 25 días";
  if (ultima.estado === "Pagada con atraso") return `hace 25 días · con ${ultima.diasAtraso} días de atraso`;
  return "hace 25 días";
}
