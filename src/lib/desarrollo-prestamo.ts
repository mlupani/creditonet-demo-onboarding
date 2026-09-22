import type { CreditApplication } from "./types";
import { nombreOpcion, ORGANISMOS, PRODUCTOS, CANALES, VENDEDORES } from "./config";
import { formatARS } from "./format";
import { importeTerceros, netoAAcreditar, planDeSolicitud, totalPrecancelaciones } from "./credit";
import { parseFecha } from "./format";

export interface FilaDesarrollo {
  dato: string;
  valor: string;
}

export interface CuotaDesarrollo {
  nro: number;
  valorCuota: number;
  pagos: number;
  saldoCuota: number;
  haber: string; // MM/YYYY
  vto: string; // DD/MM/YYYY
  capital: number;
  interes: number;
  ivaInteres: number;
  comision: number;
  ivaComision: number;
  seguro: number;
  servicio1: number;
  servicio2: number;
  remCapital: number;
  remInteres: number;
  remIvaInteres: number;
}

function valorPresentacion(v: string): string {
  const t = v?.trim();
  return t ? t : "—";
}

export function getDesarrolloPrestamo(app: CreditApplication): FilaDesarrollo[] {
  const o = app.oferta;
  const precancel = totalPrecancelaciones(o);
  const terceros = importeTerceros(o);
  const liquidado = netoAAcreditar(o);
  const capitalAprobado = liquidado + precancel + terceros;
  const plan = planDeSolicitud(app);
  const organismoNombre = nombreOpcion(ORGANISMOS, app.configuracion.organismoId);
  const canalNombre = nombreOpcion(CANALES, app.configuracion.canalId);
  const vendedorNombre = nombreOpcion(VENDEDORES, app.configuracion.vendedorId);
  const productoNombre = nombreOpcion(PRODUCTOS, app.configuracion.productoId);
  const bancoPagador = app.laboral.empleadores[0]?.banco?.trim() || "—";
  const casaMatriz = organismoNombre !== "—" ? organismoNombre.toUpperCase() : "CREDIFLASH";
  const comercio = canalNombre !== "—" ? canalNombre.toUpperCase() : "CREDIFLASH";

  return [
    { dato: "Capital Solicitado", valor: formatARS(o.montoSolicitado) },
    { dato: "Capital Aprobado (Liq+Can)", valor: formatARS(capitalAprobado) },
    { dato: "Saldo Capital", valor: formatARS(o.montoSolicitado) },
    { dato: "Renovaciones", valor: formatARS(precancel) },
    { dato: "Canc. Terceros", valor: formatARS(terceros) },
    { dato: "Total Liquidado", valor: formatARS(liquidado) },
    { dato: "Cantidad Cuotas", valor: String(o.plazo) },
    { dato: "Valor Cuota", valor: formatARS(o.valorCuota) },
    { dato: "Casa Matriz", valor: valorPresentacion(casaMatriz) },
    { dato: "Comercio", valor: valorPresentacion(comercio) },
    { dato: "Vendedor", valor: valorPresentacion(vendedorNombre.toUpperCase()) },
    { dato: "Producto", valor: valorPresentacion(productoNombre.toUpperCase()) },
    { dato: "Sub Producto", valor: valorPresentacion(`${productoNombre} · ${organismoNombre}`.toUpperCase()) },
    { dato: "Linea", valor: valorPresentacion(plan.nombre.toUpperCase()) },
    { dato: "Banco Pagador", valor: valorPresentacion(bancoPagador.toUpperCase()) },
  ];
}

// --- Desarrollo de cuotas (grilla tipo core) ---

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatHaber(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${mm}/${d.getFullYear()}`;
}

function formatVto(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function format2(n: number): string {
  return n.toFixed(2);
}

export function generarDesarrolloCuotas(app: CreditApplication): CuotaDesarrollo[] {
  const o = app.oferta;
  const plan = planDeSolicitud(app);
  const plazo = o.plazo;
  const monto = o.montoSolicitado;
  const valorCuota = o.valorCuota;
  const ivaPct = plan.ivaPct ?? 21;

  // Fechas: primera cuota vence según oferta; si no hay fecha válida, hoy
  const baseVto = parseFecha(o.primeraCuotaVencimiento) ?? new Date(2026, 1, 10);
  // Haber = mes anterior al vencimiento (como en captura: 01/2026 -> 10/02/2026)
  // Para cada cuota, vto = base + (n-1) meses, haber = vto -1 mes

  const cuotas: CuotaDesarrollo[] = [];

  // Descomposición constante (tipo tasa directa) para replicar captura:
  // capital = monto / plazo, interes = (valorCuota - capital) / (1+iva)
  // Esto da valores constantes por cuota como en la imagen (125000 / 231600 / 48636)
  // Si monto o cuota son 0, fallback a 0.
  const capitalCuota = plazo > 0 ? monto / plazo : 0;
  const interesCuota = plazo > 0 && valorCuota > 0 ? (valorCuota - capitalCuota) / (1 + ivaPct / 100) : 0;
  const ivaCuota = interesCuota * (ivaPct / 100);

  // Para simular estado pagado/pendiente como en captura (8 pagadas, 2 pendientes en 10 cuotas),
  // marcamos las últimas 2 cuotas como pendientes, el resto pagadas.
  // Si el préstamo es nuevo (sin historial), igual mostramos grilla completa; el remanente
  // se refleja sólo en pendientes.
  const pendientesDesde = Math.max(1, plazo - 1); // últimas 2 cuotas pendientes (n >= plazo-1)

  for (let n = 1; n <= plazo; n++) {
    const vtoDate = addMonths(baseVto, n - 1);
    const haberDate = addMonths(vtoDate, -1);
    const haber = formatHaber(haberDate);
    const vto = formatVto(vtoDate);

    const capital = Number(capitalCuota.toFixed(2));
    const interes = Number(interesCuota.toFixed(2));
    const ivaInteres = Number(ivaCuota.toFixed(2));

    const esPendiente = n >= pendientesDesde;
    const pagos = esPendiente ? 0 : valorCuota;
    const saldoCuota = esPendiente ? valorCuota : 0;
    const remCapital = esPendiente ? capital : 0;
    const remInteres = esPendiente ? interes : 0;
    const remIvaInteres = esPendiente ? ivaInteres : 0;

    cuotas.push({
      nro: n,
      valorCuota: Number(valorCuota.toFixed(2)),
      pagos: Number(pagos.toFixed(2)),
      saldoCuota: Number(saldoCuota.toFixed(2)),
      haber,
      vto,
      capital,
      interes,
      ivaInteres,
      comision: 0,
      ivaComision: 0,
      seguro: 0,
      servicio1: 0,
      servicio2: 0,
      remCapital,
      remInteres,
      remIvaInteres,
    });
  }

  return cuotas;
}

export function formatCuotaValor(n: number): string {
  return format2(n);
}
