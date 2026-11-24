"use client";

import Link from "next/link";
import { useState } from "react";
import { hoy } from "@/lib/caja-store";
import { antiguedadDeuda, saldoProveedor, formatearCuit, TRAMOS_DEUDA, type DeudaPorTramo } from "@/lib/proveedores-reglas";
import { useComprobantes, useOrdenesPago, usePagosProveedor, useProveedores, useTiposComprobante } from "@/lib/proveedores-store";
import { ESTADO_ABM_LABEL, type EstadoAbm } from "@/lib/caja-tipos";
import { Button } from "@/components/ui/Button";
import { PaginaCaja, descargarXlsx, sinAcentos } from "@/components/caja/comunes";
import { Campo, Cifra, INPUT_COMPACTO, Pill, TablaCompacta, Td, Th } from "@/components/caja/compacto";
import { CuentaCorriente, pesos } from "./comunes";

type Orden = "NOMBRE" | "ID" | "SALDO";

const DEUDA_CERO: DeudaPorTramo = { NO_VENCIDO: 0, D1_30: 0, D31_60: 0, D61_90: 0, MAS_90: 0, total: 0 };

export function PantallaPosicionProveedores() {
  const proveedores = useProveedores();
  const comprobantes = useComprobantes();
  const pagos = usePagosProveedor();
  const ordenes = useOrdenesPago();
  const tipos = useTiposComprobante();
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<"" | EstadoAbm>("");
  const [orden, setOrden] = useState<Orden>("NOMBRE");
  const [elegido, setElegido] = useState<string | null>(null);

  // Antigüedad de la deuda a la fecha operativa de la demo.
  const deudaPorProveedor = new Map(antiguedadDeuda(comprobantes, pagos, tipos, hoy(), undefined, ordenes).porProveedor.map((d) => [d.proveedorId, d]));

  const filas = proveedores
    .filter((p) => p.estado !== "ELIMINADO" || estado === "ELIMINADO")
    .filter((p) => (estado ? p.estado === estado : true))
    .filter((p) => {
      const q = sinAcentos(busqueda.trim());
      if (!q) return true;
      return sinAcentos(p.razonSocial).includes(q) || sinAcentos(p.fantasia).includes(q) || p.cuit.replace(/\D/g, "").includes(q.replace(/\D/g, "") || "x") || sinAcentos(p.id).includes(q);
    })
    .map((p) => ({ p, saldo: saldoProveedor(p.id, comprobantes, pagos, tipos, ordenes), deuda: deudaPorProveedor.get(p.id) ?? DEUDA_CERO }))
    .sort((a, b) =>
      orden === "SALDO" ? b.saldo - a.saldo : orden === "ID" ? a.p.id.localeCompare(b.p.id) : a.p.razonSocial.localeCompare(b.p.razonSocial)
    );
  const total = filas.reduce((s, f) => s + f.saldo, 0);
  const totalTramos = TRAMOS_DEUDA.map((t) => filas.reduce((s, f) => s + f.deuda[t.id], 0));
  const vencido = (d: DeudaPorTramo) => d.total - d.NO_VENCIDO;
  const seleccionado = proveedores.find((p) => p.id === elegido);

  const exportar = () =>
    descargarXlsx("posicion-proveedores.xlsx", "Proveedores", [
      ["ID", "CUIT", "Razón social", "Estado", "Saldo de cuenta corriente", ...TRAMOS_DEUDA.map((t) => `Deuda ${t.label}`), "Deuda vencida"],
      ...filas.map(({ p, saldo, deuda }) => [
        p.id,
        formatearCuit(p.cuit),
        p.razonSocial,
        ESTADO_ABM_LABEL[p.estado],
        String(saldo),
        ...TRAMOS_DEUDA.map((t) => String(deuda[t.id])),
        String(vencido(deuda)),
      ]),
      [
        "Total",
        "",
        "",
        "",
        String(total),
        ...totalTramos.map(String),
        String(totalTramos.slice(1).reduce((s, x) => s + x, 0)),
      ],
    ]);

  if (seleccionado) {
    return (
      <PaginaCaja
        seccion="Proveedores"
        titulo={`Cuenta corriente · ${seleccionado.razonSocial}`}
        descripcion={`${seleccionado.id} · CUIT ${formatearCuit(seleccionado.cuit)}`}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="navyOutline" onClick={() => setElegido(null)}>
            Volver a la posición
          </Button>
          <Link
            href="/parametros?solapa=proveedores"
            className="inline-flex h-8 items-center rounded-lg border border-brand-600 bg-white px-3 text-xs font-semibold text-brand-700 hover:bg-brand-50"
          >
            Ficha del proveedor en Parámetros
          </Link>
        </div>
        <CuentaCorriente proveedorId={seleccionado.id} />
      </PaginaCaja>
    );
  }

  return (
    <PaginaCaja
      seccion="Proveedores"
      titulo="Posición de proveedores"
      descripcion="Todos los proveedores con el saldo de su cuenta corriente (lo que se les debe) y la antigüedad de la deuda: lo que todavía no venció y los días vencidos a la fecha operativa. Las notas de crédito descuentan del saldo pero no figuran en los tramos."
    >
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <Campo label="Buscar por CUIT, razón social o ID">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar proveedor"
            placeholder="Buscar…"
            className={INPUT_COMPACTO}
          />
        </Campo>
        <Campo label="Estado">
          <select id="pos-estado" aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value as "" | EstadoAbm)} className={INPUT_COMPACTO}>
            <option value="">Activos y suspendidos</option>
            {(Object.keys(ESTADO_ABM_LABEL) as EstadoAbm[]).map((e) => (
              <option key={e} value={e}>
                {ESTADO_ABM_LABEL[e]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Ordenar por">
          <select id="pos-orden" aria-label="Ordenar por" value={orden} onChange={(e) => setOrden((e.target.value || "NOMBRE") as Orden)} className={INPUT_COMPACTO}>
            <option value="NOMBRE">Nombre</option>
            <option value="ID">ID</option>
            <option value="SALDO">Saldo (mayor deuda primero)</option>
          </select>
        </Campo>
        <Button size="sm" variant="navyOutline" onClick={exportar}>
          Exportar a Excel
        </Button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Cifra label="Deuda total de la lista">{pesos(total)}</Cifra>
        <Cifra label="Deuda vencida" tono={totalTramos.slice(1).some((v) => v > 0) ? "malo" : "neutro"}>
          {pesos(totalTramos.slice(1).reduce((s, x) => s + x, 0))}
        </Cifra>
        <Cifra label="Proveedores en la lista">{filas.length}</Cifra>
      </div>

      <div className="mt-3">
        {filas.length === 0 ? (
          <p className="rounded-lg border border-ink-200 bg-white px-5 py-6 text-center text-xs text-ink-400">No hay proveedores para mostrar.</p>
        ) : (
          <TablaCompacta etiqueta="Posición de proveedores" minWidth="min-w-[60rem]">
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>CUIT</Th>
                <Th>Razón social</Th>
                <Th>Estado</Th>
                <Th derecha>Saldo</Th>
                {TRAMOS_DEUDA.map((t) => (
                  <Th key={t.id} derecha>
                    {t.id === "NO_VENCIDO" ? t.label : `${t.label} d`}
                  </Th>
                ))}
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ p, saldo, deuda }) => (
                <tr key={p.id}>
                  <Td className="font-mono font-bold text-brand-700">{p.id}</Td>
                  <Td className="whitespace-nowrap">{formatearCuit(p.cuit)}</Td>
                  <Td className="text-ink-900">{p.razonSocial}</Td>
                  <Td>
                    <Pill fase={p.estado === "ACTIVO" ? "ok" : "inicial"}>{ESTADO_ABM_LABEL[p.estado]}</Pill>
                  </Td>
                  <Td derecha className="font-semibold text-ink-900">{pesos(saldo)}</Td>
                  {TRAMOS_DEUDA.map((t) => (
                    <Td
                      key={t.id}
                      derecha
                      className={deuda[t.id] === 0 ? "text-ink-300" : t.id === "NO_VENCIDO" ? "" : "font-semibold text-danger-700"}
                    >
                      {deuda[t.id] === 0 ? "—" : pesos(deuda[t.id])}
                    </Td>
                  ))}
                  <Td>
                    <Button size="xs" variant="brandOutline" onClick={() => setElegido(p.id)}>
                      Cuenta corriente
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-ink-25 font-bold text-ink-900">
                <Td colSpan={4}>Totales</Td>
                <Td derecha>{pesos(total)}</Td>
                {totalTramos.map((v, i) => (
                  <Td key={TRAMOS_DEUDA[i].id} derecha className={i > 0 && v > 0 ? "text-danger-700" : ""}>
                    {pesos(v)}
                  </Td>
                ))}
                <Td />
              </tr>
            </tfoot>
          </TablaCompacta>
        )}
      </div>
    </PaginaCaja>
  );
}
