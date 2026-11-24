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
import { PaginaCaja, dinero } from "@/components/caja/comunes";
import { BandaSeccion, COLOR_BANDEJA, Campo, INPUT_COMPACTO } from "@/components/caja/compacto";
import { PanelRemesas } from "@/components/caja/Tesoreria";
import { pesos } from "./comunes";
import { VistaPendientes } from "./VistaPendientes";
import { VistaProveedores } from "./VistaProveedores";
import { VistaTransferencias } from "./VistaTransferencias";

type IdSolapa = VistaBandeja | "prestamos" | "comprobantes";

// Los seis botones de la Bandeja, con el número y el color que les da el documento funcional.
const SOLAPAS: { id: IdSolapa; numero: number; label: string; color: string; texto: string; pronto?: boolean }[] = [
  {
    id: "proveedores",
    numero: 1,
    label: "Proveedores",
    color: COLOR_BANDEJA.proveedores,
    texto:
      "Muestra todas las órdenes de pago autorizadas, pendientes de pago. Se puede pagar de a una (botón Pagar en cada fila) o en lote, tildando varias órdenes del mismo proveedor. El sistema no permite tildar órdenes de proveedores distintos en el mismo pago. Las órdenes emitidas se autorizan acá, con la llave de un usuario distinto del que las armó.",
  },
  {
    id: "prestamos",
    numero: 2,
    label: "Préstamos",
    color: COLOR_BANDEJA.prestamos,
    pronto: true,
    texto: "Pago de créditos en liquidación, un pago por beneficiario.",
  },
  {
    id: "remesas",
    numero: 3,
    label: "Remesas",
    color: COLOR_BANDEJA.remesas,
    texto:
      "Muestra las remesas autorizadas y en curso, con el circuito y los estados de Caja y Bancos 3.1: pedidos realizados y recibidos, por autorizar, en tránsito, por recibir, con incidencia y finalizados. Desde acá, quien tiene la remesa a cargo ve qué tiene que mandar o recibir y ejecuta cada paso.",
  },
  {
    id: "comprobantes",
    numero: 4,
    label: "Comprobantes",
    color: COLOR_BANDEJA.comprobantes,
    pronto: true,
    texto: "Impuestos, ingresos y egresos de caja, movimientos sin comprobante previo y fondo fijo.",
  },
  {
    id: "transferencias",
    numero: 5,
    label: "Transferencias",
    color: COLOR_BANDEJA.transferencias,
    texto:
      "Reúne todo lo que ya tiene banco de origen asignado y espera ser transferido: órdenes de pago, préstamos y remesas. Lo trabaja quien opera el home banking. Se agrupa por banco y cuenta de origen para cargar todo junto en el banco. Cada transferencia recorre los estados Preparada → Pendiente de ejecución → Ejecutada → Confirmada, o Rechazada.",
  },
  {
    id: "pendientes",
    numero: 6,
    label: "Pendientes",
    color: COLOR_BANDEJA.pendientes,
    texto:
      "Contingencias: pagos rechazados, pagos parciales e incidencias de remesas. Toda contingencia genera mail al Tesorero central (y al Director si así se configura) y queda visible acá hasta resolverse.",
  },
];

function importeTexto(t: TarjetaBandeja): string {
  const partes: string[] = [];
  if (t.importe.ARS > 0) partes.push(pesos(t.importe.ARS));
  if (t.importe.USD > 0) partes.push(dinero("USD", t.importe.USD));
  return partes.length > 0 ? partes.join(" · ") : "Sin importe";
}

function Solapa({
  solapa,
  tarjeta,
  activa,
  onClick,
}: {
  solapa: (typeof SOLAPAS)[number];
  tarjeta?: TarjetaBandeja;
  activa: boolean;
  onClick: () => void;
}) {
  const contenido = (
    <>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
          style={activa ? { backgroundColor: "#fff", color: solapa.color } : { backgroundColor: solapa.color, color: "#fff" }}
        >
          {solapa.numero}
        </span>
        <span className="text-xs font-bold">{solapa.label}</span>
        {tarjeta && !solapa.pronto && (
          <span className={`ml-auto rounded-full px-1.5 text-[11px] font-bold tabular-nums ${activa ? "bg-white/25 text-white" : "bg-ink-100 text-ink-800"}`}>
            {tarjeta.cantidad}
          </span>
        )}
      </span>
      <span className={`mt-0.5 block truncate text-[10.5px] ${activa ? "text-white/85" : "text-ink-500"}`}>
        {solapa.pronto ? "Próximamente" : tarjeta ? importeTexto(tarjeta) : ""}
      </span>
    </>
  );
  const base = "min-w-[8.5rem] flex-1 rounded-md border px-2.5 py-1.5 text-left transition";
  if (solapa.pronto) {
    return (
      <Tooltip label="Definido en el documento, fuera del alcance de esta demo" side="top">
        <span aria-disabled="true" className={`${base} block cursor-not-allowed border-dashed border-ink-300 bg-ink-25 opacity-70`}>
          {contenido}
        </span>
      </Tooltip>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`${base} ${activa ? "border-transparent text-white shadow-sm" : "border-ink-200 bg-white hover:border-ink-300 hover:shadow-xs"}`}
      style={activa ? { backgroundColor: solapa.color } : { borderTopColor: solapa.color, borderTopWidth: 3 }}
    >
      {contenido}
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
  const solapaActiva = SOLAPAS.find((s) => s.id === activa);
  const hayFiltros = filtros.busqueda || filtros.sucursalId || filtros.moneda;

  return (
    <PaginaCaja
      titulo="Bandeja de autorizaciones"
      seccion="Bandeja de autorizaciones"
      descripcion="Todo lo que hay que autorizar y pagar, en un solo lugar: órdenes de pago, transferencias, remesas y contingencias. Cada usuario ve sólo lo de su ámbito."
    >
      {vistas.length === 0 ? (
        <Card className="px-5 py-6 text-center text-xs text-ink-500">
          Tu perfil no tiene bandejas para operar. Elegí otro usuario en &quot;Actuar como&quot;.
        </Card>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="flex flex-wrap gap-2">
              {SOLAPAS.filter((s) => s.pronto || vistas.includes(s.id as VistaBandeja)).map((s) => (
                <Solapa
                  key={s.id}
                  solapa={s}
                  tarjeta={s.pronto ? undefined : resumen[s.id as VistaBandeja]}
                  activa={activa === s.id}
                  onClick={() => irA(s.id as VistaBandeja)}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-600">
              Total por resolver: <span className="font-bold text-ink-900">{total.cantidad}</span> · <span className="font-semibold">{importeTexto(total)}</span>
            </p>
          </div>

          {esCobrador(usuario) && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-ink-25 px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-brand-700">Operar como cobrador</span>
              <Link
                href="/onboarding"
                className="inline-flex h-7 items-center rounded-md bg-brand-600 px-2.5 text-[11px] font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                Solicitar crédito
              </Link>
              {["Refinanciar o renovar", "Pagar crédito", "Cargar movimiento de caja"].map((a) => (
                <Tooltip key={a} label="Fuera del alcance de esta demo" side="top">
                  <span
                    aria-disabled="true"
                    className="inline-flex h-7 cursor-not-allowed items-center rounded-md border border-ink-200 bg-ink-100 px-2.5 text-[11px] font-semibold text-ink-400"
                  >
                    {a}
                  </span>
                </Tooltip>
              ))}
            </div>
          )}

          {solapaActiva && (
            <BandaSeccion numero={solapaActiva.numero} titulo={`Botón ${solapaActiva.label}`} color={solapaActiva.color}>
              {solapaActiva.texto}
            </BandaSeccion>
          )}

          {activa && activa !== "remesas" && (
            <div className="flex flex-wrap items-end gap-3">
              <Campo label="Buscar por ID, nombre o CUIT" className="w-64">
                <span className="relative block">
                  <IconSearch width={14} height={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    value={filtros.busqueda}
                    onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
                    placeholder="OP-0002, proveedor, CUIT…"
                    aria-label="Buscar en la bandeja"
                    className={`${INPUT_COMPACTO} pl-8`}
                  />
                </span>
              </Campo>
              {verSucursal && activa === "pendientes" && (
                <Campo label="Sucursal" className="w-44">
                  <select value={filtros.sucursalId} onChange={(e) => setFiltros({ ...filtros, sucursalId: e.target.value })} aria-label="Sucursal" className={INPUT_COMPACTO}>
                    <option value="">Todas</option>
                    {sucursalesDelUsuario.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </Campo>
              )}
              <Campo label="Moneda" className="w-32">
                <select
                  value={filtros.moneda}
                  onChange={(e) => setFiltros({ ...filtros, moneda: e.target.value as FiltrosBandeja["moneda"] })}
                  aria-label="Moneda"
                  className={INPUT_COMPACTO}
                >
                  <option value="">Todas</option>
                  <option value="ARS">Pesos</option>
                  <option value="USD">Dólares</option>
                </select>
              </Campo>
              {hayFiltros && (
                <button type="button" onClick={() => setFiltros(SIN_FILTROS)} className="pb-1.5 text-[11px] font-semibold text-brand-700 hover:underline">
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
