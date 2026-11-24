"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { cajasVisibles, sucursalesVisibles } from "@/lib/caja-reglas";
import { useCajaDatos } from "@/lib/caja-store";
import { lotesTransferencia } from "@/lib/proveedores-operaciones";
import { useOrdenesPago, usePagosProveedor, useProveedores } from "@/lib/proveedores-store";
import {
  SIN_FILTROS,
  VISTAS,
  esCobrador,
  esVistaBandeja,
  resumenBandeja,
  totalBandeja,
  vistasDe,
  type FiltrosBandeja,
  type TarjetaBandeja,
  type VistaBandeja,
} from "@/lib/bandeja-reglas";
import { Card } from "@/components/ui/Card";
import { Tooltip } from "@/components/ui/Tooltip";
import { IconSearch } from "@/components/icons";
import { PaginaCaja, CLASE_INPUT, dinero } from "@/components/caja/comunes";
import { PanelRemesas } from "@/components/caja/Tesoreria";
import { pesos } from "./comunes";
import { VistaPendientes } from "./VistaPendientes";
import { VistaProveedores } from "./VistaProveedores";
import { VistaTransferencias } from "./VistaTransferencias";

const ETIQUETA = "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-400";

const PROXIMAMENTE = [
  { id: "prestamos", label: "Préstamos", detalle: "Pago de créditos en liquidación, un pago por beneficiario" },
  { id: "comprobantes", label: "Comprobantes", detalle: "Impuestos, ingresos y egresos de caja, sin comprobante, fondo fijo" },
];

function importeTexto(t: TarjetaBandeja): string {
  const partes: string[] = [];
  if (t.importe.ARS > 0) partes.push(pesos(t.importe.ARS));
  if (t.importe.USD > 0) partes.push(dinero("USD", t.importe.USD));
  return partes.length > 0 ? partes.join(" · ") : "Sin importe";
}

function Tarjeta({ label, detalle, tarjeta, activa, onClick }: { label: string; detalle: string; tarjeta: TarjetaBandeja; activa: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`flex flex-col rounded-xl border p-4 text-left transition ${activa ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100" : "border-ink-200 bg-white hover:border-ink-300 hover:shadow-xs"}`}
    >
      <span className="text-xs font-bold uppercase tracking-wider text-ink-500">{label}</span>
      <span className="mt-1 text-3xl font-bold tabular-nums text-ink-900">{tarjeta.cantidad}</span>
      <span className="mt-0.5 text-xs font-semibold text-ink-700">{importeTexto(tarjeta)}</span>
      <span className="mt-2 text-[11px] leading-snug text-ink-400">{detalle}</span>
    </button>
  );
}

export function PantallaBandeja() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { usuario, cajas, sucursales, movimientos } = useCajaDatos();
  const ordenes = useOrdenesPago();
  const pagos = usePagosProveedor();
  const proveedores = useProveedores();
  const [filtros, setFiltros] = useState<FiltrosBandeja>(SIN_FILTROS);

  const vistas = vistasDe(usuario);
  const pedida = params.get("vista");
  const activa: VistaBandeja | null = esVistaBandeja(pedida) && vistas.includes(pedida) ? pedida : (vistas[0] ?? null);

  const irA = (vista: VistaBandeja, busqueda?: string) => {
    if (busqueda !== undefined) setFiltros((f) => ({ ...f, busqueda }));
    router.replace(`${pathname}?vista=${vista}`);
  };

  // Los lotes de transferencia salen de los pagos: se recalculan cuando éstos cambian.
  const lotes = useMemo(() => lotesTransferencia(), [pagos, ordenes, proveedores]); // eslint-disable-line react-hooks/exhaustive-deps
  const resumen = useMemo(
    () => resumenBandeja({ usuario, ordenes, pagos, proveedores, lotes, movimientos, cajas }, { ...filtros, busqueda: "" }),
    [usuario, ordenes, pagos, proveedores, lotes, movimientos, cajas, filtros]
  );
  const total = totalBandeja(resumen, vistas);
  const sucursalesDelUsuario = sucursalesVisibles(usuario, sucursales, cajas);
  const verSucursal = cajasVisibles(usuario, cajas).length > 1 || sucursalesDelUsuario.length > 1;

  return (
    <PaginaCaja
      titulo="Bandeja de autorizaciones"
      seccion="Bandeja de autorizaciones"
      descripcion="Todo lo que hay que autorizar y pagar, en un solo lugar: órdenes de pago, transferencias, remesas y contingencias. Cada usuario ve sólo lo de su ámbito."
    >
      {vistas.length === 0 ? (
        <Card className="px-5 py-8 text-center text-sm text-ink-500">
          Tu perfil no tiene bandejas para operar. Elegí otro usuario en &quot;Actuar como&quot;.
        </Card>
      ) : (
        <div className="space-y-5">
          <div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {VISTAS.filter((v) => vistas.includes(v.id)).map((v) => (
                <Tarjeta key={v.id} label={v.label} detalle={v.descripcion} tarjeta={resumen[v.id]} activa={activa === v.id} onClick={() => irA(v.id)} />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-600">
                Total por resolver: <span className="font-bold text-ink-900">{total.cantidad}</span> · <span className="font-semibold">{importeTexto(total)}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {PROXIMAMENTE.map((p) => (
                  <Tooltip key={p.id} label="Definido en el documento, fuera del alcance de esta demo" side="top">
                    <span
                      aria-disabled="true"
                      className="cursor-not-allowed rounded-lg border border-dashed border-ink-300 bg-ink-25 px-3 py-1.5 text-xs font-semibold text-ink-400"
                    >
                      {p.label} · Próximamente
                    </span>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>

          {esCobrador(usuario) && (
            <Card className="px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Operar como cobrador</p>
              <p className="mt-1 text-xs text-ink-500">El cajero de una sucursal también puede ser vendedor y cobrador. Estos atajos reusan los circuitos de Créditos.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href="/onboarding"
                  className="inline-flex h-8 items-center rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
                >
                  Solicitar crédito
                </Link>
                {["Refinanciar o renovar", "Pagar crédito", "Cargar movimiento de caja"].map((a) => (
                  <Tooltip key={a} label="Fuera del alcance de esta demo" side="top">
                    <span aria-disabled="true" className="inline-flex h-8 cursor-not-allowed items-center rounded-lg border border-ink-200 bg-ink-100 px-3 text-xs font-semibold text-ink-400">
                      {a}
                    </span>
                  </Tooltip>
                ))}
              </div>
            </Card>
          )}

          {activa && activa !== "remesas" && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className={ETIQUETA}>Buscar por ID, nombre o CUIT</span>
                <span className="relative block">
                  <IconSearch width={16} height={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    value={filtros.busqueda}
                    onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
                    placeholder="OP-0002, proveedor, CUIT…"
                    aria-label="Buscar en la bandeja"
                    className={`${CLASE_INPUT} w-72 pl-9`}
                  />
                </span>
              </label>
              {verSucursal && (activa === "pendientes") && (
                <label className="block">
                  <span className={ETIQUETA}>Sucursal</span>
                  <select value={filtros.sucursalId} onChange={(e) => setFiltros({ ...filtros, sucursalId: e.target.value })} aria-label="Sucursal" className={`${CLASE_INPUT} w-52`}>
                    <option value="">Todas</option>
                    {sucursalesDelUsuario.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block">
                <span className={ETIQUETA}>Moneda</span>
                <select value={filtros.moneda} onChange={(e) => setFiltros({ ...filtros, moneda: e.target.value as FiltrosBandeja["moneda"] })} aria-label="Moneda" className={`${CLASE_INPUT} w-36`}>
                  <option value="">Todas</option>
                  <option value="ARS">Pesos</option>
                  <option value="USD">Dólares</option>
                </select>
              </label>
              {(filtros.busqueda || filtros.sucursalId || filtros.moneda) && (
                <button type="button" onClick={() => setFiltros(SIN_FILTROS)} className="pb-2 text-xs font-semibold text-brand-700 hover:underline">
                  Limpiar filtros
                </button>
              )}
            </div>
          )}

          {activa === "proveedores" && <VistaProveedores filtros={filtros} />}
          {activa === "transferencias" && <VistaTransferencias filtros={filtros} />}
          {activa === "remesas" && <PanelRemesas />}
          {activa === "pendientes" && <VistaPendientes filtros={filtros} onIr={irA} />}
        </div>
      )}
    </PaginaCaja>
  );
}
