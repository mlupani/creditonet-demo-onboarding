import type { CreditApplication } from "./types";
import { configEfectiva, nombreOpcion, ORGANISMOS, PRODUCTOS, CANALES, VENDEDORES } from "./config";
import { formatARS } from "./format";
import { importeTerceros, netoAAcreditar, planDeSolicitud, totalPrecancelaciones } from "./credit";

export interface FilaDesarrollo {
  dato: string;
  valor: string;
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
  // Capital aprobado = liquidado + renovaciones + cancelación terceros
  const capitalAprobado = liquidado + precancel + terceros;
  const plan = planDeSolicitud(app);
  const organismoNombre = nombreOpcion(ORGANISMOS, app.configuracion.organismoId);
  const canalNombre = nombreOpcion(CANALES, app.configuracion.canalId);
  const vendedorNombre = nombreOpcion(VENDEDORES, app.configuracion.vendedorId);
  const productoNombre = nombreOpcion(PRODUCTOS, app.configuracion.productoId);
  const bancoPagador =
    app.laboral.empleadores[0]?.banco?.trim() || "—";

  // Fallback a CREDIFLASH si el nombre del catálogo no aporta valor de negocio visible
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
    {
      dato: "Sub Producto",
      valor: valorPresentacion(`${productoNombre} · ${organismoNombre}`.toUpperCase()),
    },
    { dato: "Linea", valor: valorPresentacion(plan.nombre.toUpperCase()) },
    { dato: "Banco Pagador", valor: valorPresentacion(bancoPagador.toUpperCase()) },
  ];
}
