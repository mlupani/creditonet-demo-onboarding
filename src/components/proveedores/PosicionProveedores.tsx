"use client";

import Link from "next/link";
import { useState } from "react";
import { hoy } from "@/lib/caja-store";
import { antiguedadDeuda, saldoProveedor, formatearCuit, TRAMOS_DEUDA, type DeudaPorTramo } from "@/lib/proveedores-reglas";
import { useComprobantes, usePagosProveedor, useProveedores, useTiposComprobante } from "@/lib/proveedores-store";
import { ESTADO_ABM_LABEL, type EstadoAbm } from "@/lib/caja-tipos";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PaginaCaja, CLASE_INPUT, descargarXlsx, sinAcentos } from "@/components/caja/comunes";
import { CuentaCorriente, ENCABEZADO, Th, pesos } from "./comunes";

type Orden = "NOMBRE" | "ID" | "SALDO";

const DEUDA_CERO: DeudaPorTramo = { NO_VENCIDO: 0, D1_30: 0, D31_60: 0, D61_90: 0, MAS_90: 0, total: 0 };

export function PantallaPosicionProveedores() {
  const proveedores = useProveedores();
  const comprobantes = useComprobantes();
  const pagos = usePagosProveedor();
  const tipos = useTiposComprobante();
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<"" | EstadoAbm>("");
  const [orden, setOrden] = useState<Orden>("NOMBRE");
  const [elegido, setElegido] = useState<string | null>(null);

  // Antigüedad de la deuda a la fecha operativa de la demo.
  const deudaPorProveedor = new Map(antiguedadDeuda(comprobantes, pagos, tipos, hoy()).porProveedor.map((d) => [d.proveedorId, d]));

  const filas = proveedores
    .filter((p) => p.estado !== "ELIMINADO" || estado === "ELIMINADO")
    .filter((p) => (estado ? p.estado === estado : true))
    .filter((p) => {
      const q = sinAcentos(busqueda.trim());
      if (!q) return true;
      return sinAcentos(p.razonSocial).includes(q) || sinAcentos(p.fantasia).includes(q) || p.cuit.replace(/\D/g, "").includes(q.replace(/\D/g, "") || "x") || sinAcentos(p.id).includes(q);
    })
    .map((p) => ({ p, saldo: saldoProveedor(p.id, comprobantes, pagos, tipos), deuda: deudaPorProveedor.get(p.id) ?? DEUDA_CERO }))
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
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setElegido(null)}>
            Volver a la posición
          </Button>
          <Link
            href="/parametros?solapa=proveedores"
            className="inline-flex h-10 items-center rounded-lg border border-ink-300 bg-white px-4 text-sm font-semibold text-brand-700 shadow-xs hover:bg-ink-50"
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
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">Buscar por CUIT, razón social o ID</span>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar proveedor"
            placeholder="Buscar…"
            className={CLASE_INPUT}
          />
        </label>
        <SelectField
          id="pos-estado"
          label="Estado"
          value={estado}
          onChange={(v) => setEstado(v as "" | EstadoAbm)}
          placeholder="Activos y suspendidos"
          options={(Object.keys(ESTADO_ABM_LABEL) as EstadoAbm[]).map((e) => ({ value: e, label: ESTADO_ABM_LABEL[e] }))}
        />
        <SelectField
          id="pos-orden"
          label="Ordenar por"
          value={orden}
          onChange={(v) => setOrden((v || "NOMBRE") as Orden)}
          options={[
            { value: "NOMBRE", label: "Nombre" },
            { value: "ID", label: "ID" },
            { value: "SALDO", label: "Saldo (mayor deuda primero)" },
          ]}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <p className="text-sm text-ink-600">
          Deuda total de la lista: <span className="font-bold tabular-nums text-ink-900">{pesos(total)}</span>
        </p>
        <div className="ml-auto">
          <Button variant="outline" onClick={exportar}>
            Exportar a Excel
          </Button>
        </div>
      </div>

      <Card className="mt-3 overflow-hidden">
        {filas.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-400">No hay proveedores para mostrar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead>
                <tr className={ENCABEZADO}>
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
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filas.map(({ p, saldo, deuda }) => (
                  <tr key={p.id}>
                    <td className="px-3 py-3 font-mono text-xs font-bold text-brand-700">{p.id}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-700">{formatearCuit(p.cuit)}</td>
                    <td className="px-3 py-3 text-ink-900">{p.razonSocial}</td>
                    <td className="px-3 py-3">
                      <StatusBadge tone={p.estado === "ACTIVO" ? "success" : "neutral"}>{ESTADO_ABM_LABEL[p.estado]}</StatusBadge>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink-900">{pesos(saldo)}</td>
                    {TRAMOS_DEUDA.map((t) => (
                      <td
                        key={t.id}
                        className={`px-3 py-3 text-right tabular-nums ${
                          deuda[t.id] === 0 ? "text-ink-300" : t.id === "NO_VENCIDO" ? "text-ink-700" : "font-semibold text-danger-700"
                        }`}
                      >
                        {deuda[t.id] === 0 ? "—" : pesos(deuda[t.id])}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setElegido(p.id)}>
                        Cuenta corriente
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink-200 bg-ink-25 font-semibold text-ink-900">
                  <td className="px-3 py-3" colSpan={4}>
                    Totales
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{pesos(total)}</td>
                  {totalTramos.map((v, i) => (
                    <td key={TRAMOS_DEUDA[i].id} className={`px-3 py-3 text-right tabular-nums ${i > 0 && v > 0 ? "text-danger-700" : ""}`}>
                      {pesos(v)}
                    </td>
                  ))}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </PaginaCaja>
  );
}
