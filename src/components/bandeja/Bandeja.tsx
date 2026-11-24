"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
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
  type DatosBandeja,
  type FiltrosBandeja,
  type TarjetaBandeja,
  type VistaBandeja,
} from "@/lib/bandeja-reglas";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tooltip } from "@/components/ui/Tooltip";
import { IconSearch } from "@/components/icons";
import { PaginaCaja, dinero, descargarXlsx } from "@/components/caja/comunes";
import { BandaSeccion, COLOR_BANDEJA, Campo, INPUT_COMPACTO } from "@/components/caja/compacto";
import { PanelRemesas } from "@/components/caja/Tesoreria";
import { pesos } from "./comunes";
import { hojaDeVistas } from "./exportar";
import { VistaPendientes } from "./VistaPendientes";
import { VistaProveedores } from "./VistaProveedores";
import { VistaTransferencias } from "./VistaTransferencias";

type IdSolapa = VistaBandeja | "prestamos" | "comprobantes" | "todos";

const COLOR_TODOS = "#1e2a4a";
const SIN_ALCANCE = "Fuera del alcance de esta demo";

// Los botones de la Bandeja, con el número y el color que les da el documento funcional.
const SOLAPAS: { id: IdSolapa; numero?: number; label: string; color: string; texto: string; pronto?: boolean }[] = [
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
  {
    id: "todos",
    label: "Todos",
    color: COLOR_TODOS,
    texto: "Todo lo que hay para resolver, una sección debajo de otra.",
  },
];

function importeTexto(t: TarjetaBandeja): string {
  const partes: string[] = [];
  if (t.importe.ARS > 0) partes.push(pesos(t.importe.ARS));
  if (t.importe.USD > 0) partes.push(dinero("USD", t.importe.USD));
  return partes.length > 0 ? partes.join(" · ") : "Sin importe";
}

// Tarjeta de totales de un botón: cantidad e importe, clickeable para pasar a esa solapa. Pendientes
// resalta en rojo cuando hay contingencias.
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
  const alerta = solapa.id === "pendientes" && !!tarjeta && tarjeta.cantidad > 0;
  const contenido = (
    <>
      <span className="flex items-center gap-1.5">
        {solapa.numero !== undefined && (
          <span
            aria-hidden
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
            style={activa ? { backgroundColor: "#fff", color: solapa.color } : { backgroundColor: solapa.color, color: "#fff" }}
          >
            {solapa.numero}
          </span>
        )}
        <span className="text-[11px] font-bold uppercase tracking-wide">{solapa.label}</span>
      </span>
      {solapa.pronto ? (
        <span className="mt-1.5 block text-[10.5px] text-ink-500">Próximamente</span>
      ) : (
        tarjeta && (
          <>
            <span
              className={`mt-1 block text-xl font-bold leading-none tabular-nums ${activa ? "text-white" : alerta ? "text-danger-700" : "text-ink-900"}`}
            >
              {tarjeta.cantidad}
            </span>
            <span className={`mt-1 block truncate text-[10.5px] font-semibold ${activa ? "text-white/90" : "text-ink-600"}`}>{importeTexto(tarjeta)}</span>
          </>
        )
      )}
    </>
  );
  const base = "min-w-[8.5rem] flex-1 rounded-md border px-2.5 py-2 text-left transition";
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
      className={`${base} ${
        activa
          ? "border-transparent text-white shadow-sm"
          : alerta
            ? "border-danger-200 bg-danger-50 hover:border-danger-600"
            : "border-ink-200 bg-white hover:border-ink-300 hover:shadow-xs"
      }`}
      style={activa ? { backgroundColor: solapa.color } : { borderTopColor: solapa.color, borderTopWidth: 3 }}
    >
      {contenido}
    </button>
  );
}

// Botón del bloque de cobrador que todavía no está en la demo: se ve, pero no actúa.
function AtajoPendiente({ children }: { children: ReactNode }) {
  return (
    <Tooltip label={SIN_ALCANCE} side="top">
      <span
        aria-disabled="true"
        className="inline-flex h-7 cursor-not-allowed items-center gap-1 rounded-md border border-brand-600 bg-white px-2.5 text-[11px] font-semibold text-brand-700 opacity-60"
      >
        {children}
      </span>
    </Tooltip>
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
  const activa: VistaBandeja | "todos" | null =
    pedida === "todos" && vistas.length > 1
      ? "todos"
      : esVistaBandeja(pedida) && vistas.includes(pedida)
        ? pedida
        : (vistas[0] ?? null);

  const irA = (vista: VistaBandeja | "todos", busqueda?: string) => {
    if (busqueda !== undefined) setFiltros((f) => ({ ...f, busqueda }));
    router.replace(`${pathname}?vista=${vista}`);
  };

  // Los lotes de transferencia salen de los pagos: se recalculan cuando éstos cambian.
  const lotes = useMemo(() => lotesTransferencia(), [pagos, ordenes, proveedores]); // eslint-disable-line react-hooks/exhaustive-deps
  const datos: DatosBandeja = useMemo(
    () => ({ usuario, ordenes, pagos, proveedores, lotes, movimientos, cajas }),
    [usuario, ordenes, pagos, proveedores, lotes, movimientos, cajas]
  );
  const resumen = useMemo(() => resumenBandeja(datos, { ...filtros, busqueda: "" }), [datos, filtros]);
  const total = totalBandeja(resumen, vistas);
  const sucursalesDelUsuario = sucursalesVisibles(usuario, sucursales, cajas);
  const verSucursal = cajasVisibles(usuario, cajas).length > 1 || sucursalesDelUsuario.length > 1;
  const solapaActiva = SOLAPAS.find((s) => s.id === activa);
  const hayFiltros = filtros.busqueda || filtros.sucursalId || filtros.moneda || filtros.fechaDesde || filtros.fechaHasta;
  // Remesas tiene su propio panel con sus filtros: en esa solapa la barra solo exporta.
  const soloExportar = activa === "remesas";

  const exportar = () => {
    if (!activa) return;
    const hoja = hojaDeVistas(activa === "todos" ? vistas : [activa], datos, filtros);
    descargarXlsx(`bandeja-${activa}.xlsx`, hoja.nombre, hoja.filas);
  };

  const vistaDe = (v: VistaBandeja) => {
    if (v === "proveedores") return <VistaProveedores filtros={filtros} />;
    if (v === "transferencias") return <VistaTransferencias filtros={filtros} />;
    if (v === "remesas") return <PanelRemesas />;
    return <VistaPendientes filtros={filtros} onIr={irA} />;
  };

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
          {esCobrador(usuario) && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-ink-200 bg-ink-25 px-3 py-2">
              <span className="w-full text-[10px] font-bold uppercase tracking-wide text-ink-500">Operar como cobrador / canal</span>
              <Link
                href="/onboarding"
                className="inline-flex h-7 items-center rounded-md bg-success-600 px-2.5 text-[11px] font-semibold text-white shadow-sm hover:bg-success-700"
              >
                + Solicitar crédito
              </Link>
              <AtajoPendiente>↻ Refinanciar / Renovar</AtajoPendiente>
              <AtajoPendiente>$ Pagar crédito</AtajoPendiente>
              <AtajoPendiente>⇄ Carga de movimiento de caja</AtajoPendiente>
              <Tooltip label={SIN_ALCANCE} side="top">
                <span className="relative block w-56">
                  <IconSearch width={14} height={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    disabled
                    aria-label="Buscar cliente por DNI o apellido"
                    placeholder="Buscar cliente: DNI / apellido"
                    className={`${INPUT_COMPACTO} pl-8`}
                  />
                </span>
              </Tooltip>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-500">Qué hay para resolver</p>
            <div className="flex flex-wrap gap-2">
              {SOLAPAS.filter((s) => (s.id === "todos" ? vistas.length > 1 : s.pronto || vistas.includes(s.id as VistaBandeja))).map((s) => (
                <Solapa
                  key={s.id}
                  solapa={s}
                  tarjeta={s.pronto ? undefined : s.id === "todos" ? total : resumen[s.id as VistaBandeja]}
                  activa={activa === s.id}
                  onClick={() => irA(s.id as VistaBandeja | "todos")}
                />
              ))}
            </div>
          </div>

          {solapaActiva && (
            <BandaSeccion numero={solapaActiva.numero} titulo={activa === "todos" ? "Todos" : `Botón ${solapaActiva.label}`} color={solapaActiva.color}>
              {solapaActiva.texto}
            </BandaSeccion>
          )}

          <div className="flex flex-wrap items-end gap-3">
            {!soloExportar && (
              <>
                <Campo label="Buscar: ID · nombre · CUIT" className="w-60">
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
                {verSucursal && (
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
                <Campo label="Moneda" className="w-28">
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
                <Campo label="Fecha desde" className="w-36">
                  <input
                    type="date"
                    value={filtros.fechaDesde}
                    max={filtros.fechaHasta || undefined}
                    onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })}
                    aria-label="Fecha desde"
                    className={INPUT_COMPACTO}
                  />
                </Campo>
                <Campo label="Fecha hasta" className="w-36">
                  <input
                    type="date"
                    value={filtros.fechaHasta}
                    min={filtros.fechaDesde || undefined}
                    onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })}
                    aria-label="Fecha hasta"
                    className={INPUT_COMPACTO}
                  />
                </Campo>
                {hayFiltros && (
                  <button type="button" onClick={() => setFiltros(SIN_FILTROS)} className="pb-1.5 text-[11px] font-semibold text-brand-700 hover:underline">
                    Limpiar filtros
                  </button>
                )}
              </>
            )}
            <div className="ml-auto">
              <Button variant="navyOutline" size="sm" onClick={exportar}>
                Exportar a Excel
              </Button>
            </div>
          </div>

          {activa === "todos" ? (
            <div className="space-y-5">
              {vistas.map((v) => {
                const s = SOLAPAS.find((x) => x.id === v)!;
                return (
                  <section key={v} aria-label={s.label} className="space-y-2">
                    <BandaSeccion numero={s.numero} titulo={`Botón ${s.label}`} color={s.color} />
                    {v === "remesas" && (
                      <p className="text-[11px] text-ink-500">Remesas se filtra desde su propio panel; los filtros de arriba no la afectan.</p>
                    )}
                    {vistaDe(v)}
                  </section>
                );
              })}
            </div>
          ) : (
            activa && vistaDe(activa)
          )}
        </div>
      )}
    </PaginaCaja>
  );
}
