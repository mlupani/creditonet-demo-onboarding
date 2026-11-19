"use client";

import { useState } from "react";
import { hoy } from "@/lib/caja-store";
import { diasDeAtraso, formatearCuit, saldoComprobante, vencimientoDe } from "@/lib/proveedores-reglas";
import { useComprobantes, usePagosProveedor, useProveedores, useTiposComprobante } from "@/lib/proveedores-store";
import { MEDIO_PAGO_LABEL, type Comprobante } from "@/lib/proveedores-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { Dato, PaginaCaja, descargarXlsx, quien, sinAcentos } from "@/components/caja/comunes";
import {
  CuentaCorriente,
  ENCABEZADO,
  EstadoComprobanteBadge,
  Pestanas,
  Th,
  nombreProveedor,
  numeroComprobante,
  origenTexto,
  pesos,
} from "./comunes";

type Pestana = "ordenes" | "proveedor";

function ConsultaOrdenes() {
  const comprobantes = useComprobantes();
  const proveedores = useProveedores();
  const pagos = usePagosProveedor();
  const tipos = useTiposComprobante();
  const [texto, setTexto] = useState("");
  const [importe, setImporte] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [abierta, setAbierta] = useState<Comprobante | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const tipoTexto = (id: string) => tipos.find((t) => t.id === id)?.descripcion ?? id;
  const pagosDe = (c: Comprobante) => pagos.filter((p) => p.comprobanteId === c.id);
  const fechaOrden = (c: Comprobante) => {
    const ps = pagosDe(c);
    return ps.length > 0 ? ps[ps.length - 1].fecha : (c.autorizacion?.fechaHora ?? "").slice(0, 10);
  };

  const filas = comprobantes
    .filter((c) => !!c.ordenPago)
    .filter((c) => {
      const q = sinAcentos(texto.trim());
      if (!q) return true;
      const p = proveedores.find((x) => x.id === c.proveedorId);
      return [c.ordenPago, c.id, p?.razonSocial, numeroComprobante(c), p?.cuit].some((v) => sinAcentos(v ?? "").includes(q)) ||
        (p?.cuit.replace(/\D/g, "") ?? "").includes(q.replace(/\D/g, "") || "x");
    })
    .filter((c) => (importe.trim() === "" ? true : Math.abs(c.total - Number(importe.replace(",", "."))) < 0.01))
    .filter((c) => (desde ? fechaOrden(c) >= desde : true))
    .filter((c) => (hasta ? fechaOrden(c) <= hasta : true))
    .sort((a, b) => (b.ordenPago ?? "").localeCompare(a.ordenPago ?? ""));

  const detalle = (c: Comprobante) => {
    const ps = pagosDe(c);
    const ultimo = ps[ps.length - 1];
    return {
      asiento: ps.map((p) => p.asiento).join(", ") || "—",
      fechaValor: ultimo?.fecha ?? "—",
      fechaPago: ultimo?.fecha ?? "—",
      origen: ps.length > 0 ? [...new Set(ps.map(origenTexto))].join(", ") : "—",
      medio: ps.length > 0 ? [...new Set(ps.map((p) => MEDIO_PAGO_LABEL[p.medio]))].join(", ") : "—",
    };
  };

  const exportar = () =>
    descargarXlsx("ordenes-de-pago.xlsx", "Órdenes de pago", [
      ["Orden de pago", "Proveedor", "CUIT", "Comprobante", "Total", "Pagado", "Asiento contable", "Fecha valor", "Fecha de pago", "Caja o cuenta", "Medio"],
      ...filas.map((c) => {
        const p = proveedores.find((x) => x.id === c.proveedorId);
        const d = detalle(c);
        const pagado = pagosDe(c).reduce((s, x) => s + x.importe, 0);
        return [c.ordenPago ?? "", p?.razonSocial ?? "", p ? formatearCuit(p.cuit) : "", `${tipoTexto(c.tipoId)} ${numeroComprobante(c)}`, String(c.total), String(pagado), d.asiento, d.fechaValor, d.fechaPago, d.origen, d.medio];
      }),
    ]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FormField id="cons-texto" label="OP, proveedor, CUIT o comprobante" value={texto} onChange={setTexto} />
        <FormField id="cons-importe" label="Importe (total)" type="number" value={importe} onChange={setImporte} />
        <FormField id="cons-desde" label="Fecha desde" type="date" value={desde} onChange={setDesde} />
        <FormField id="cons-hasta" label="Fecha hasta" type="date" value={hasta} onChange={setHasta} />
      </div>
      <div className="flex justify-end">
        <Button variant="outline" onClick={exportar}>
          Exportar a Excel
        </Button>
      </div>
      {aviso && <Banner tone="success">{aviso}</Banner>}

      <Card className="overflow-hidden">
        {filas.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-400">No hay órdenes de pago para mostrar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-left text-sm">
              <thead>
                <tr className={ENCABEZADO}>
                  <Th>Orden de pago</Th>
                  <Th>Proveedor</Th>
                  <Th>Comprobante</Th>
                  <Th derecha>Total</Th>
                  <Th>Fecha de pago</Th>
                  <Th>Pagó</Th>
                  <Th>Estado</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filas.map((c) => {
                  const d = detalle(c);
                  return (
                    <tr key={c.id}>
                      <td className="px-3 py-3 font-mono text-xs font-bold text-brand-700">{c.ordenPago}</td>
                      <td className="px-3 py-3 text-ink-700">{nombreProveedor(proveedores, c.proveedorId)}</td>
                      <td className="px-3 py-3 text-ink-700">
                        {tipoTexto(c.tipoId)}
                        <span className="block font-mono text-xs text-ink-400">{numeroComprobante(c)}</span>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink-900">{pesos(c.total)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-700">{d.fechaPago}</td>
                      <td className="px-3 py-3 text-ink-700">
                        {d.origen}
                        <span className="block text-xs text-ink-400">{d.medio}</span>
                      </td>
                      <td className="px-3 py-3">
                        <EstadoComprobanteBadge estado={c.estado} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => setAbierta(c)}>
                          Ver detalle
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {abierta && (
        <Modal
          open
          onClose={() => setAbierta(null)}
          title={`Orden de pago ${abierta.ordenPago}`}
          maxWidth="max-w-2xl"
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setAbierta(null)}>
                Cerrar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAviso(`Se reimprimió la orden de pago ${abierta.ordenPago} (simulado).`);
                  setAbierta(null);
                }}
              >
                Reimprimir
              </Button>
              <Button
                onClick={() => {
                  const p = proveedores.find((x) => x.id === abierta.proveedorId);
                  setAviso(`Se reenvió la orden de pago ${abierta.ordenPago} a ${p?.mail || p?.razonSocial} (simulado).`);
                  setAbierta(null);
                }}
              >
                Reenviar al proveedor
              </Button>
            </div>
          }
        >
          {(() => {
            const d = detalle(abierta);
            const ps = pagosDe(abierta);
            return (
              <div className="space-y-4">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Dato label="Proveedor">{nombreProveedor(proveedores, abierta.proveedorId)}</Dato>
                  <Dato label="Comprobante incluido">
                    {tipoTexto(abierta.tipoId)} {numeroComprobante(abierta)} · {abierta.id}
                  </Dato>
                  <Dato label="Total de la orden">{pesos(abierta.total)}</Dato>
                  <Dato label="Saldo pendiente">{pesos(saldoComprobante(abierta, pagos))}</Dato>
                  <Dato label="Asiento contable">{d.asiento}</Dato>
                  <Dato label="Fecha valor de contabilización">{d.fechaValor}</Dato>
                  <Dato label="Autorizó">{quien(abierta.autorizacion?.usuarioId)}</Dato>
                  <Dato label="Estado">
                    <EstadoComprobanteBadge estado={abierta.estado} />
                  </Dato>
                </dl>
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Pagos</p>
                  {ps.length === 0 ? (
                    <p className="text-sm text-ink-500">Todavía no se pagó.</p>
                  ) : (
                    <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200 text-sm">
                      {ps.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
                          <span className="font-mono text-xs font-bold text-brand-700">{p.id}</span>
                          <span className="text-ink-700">{p.fecha}</span>
                          <span className="text-ink-700">{MEDIO_PAGO_LABEL[p.medio]} · {origenTexto(p)}</span>
                          <span className="ml-auto font-semibold tabular-nums text-ink-900">{pesos(p.importe)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}

function ConsultaProveedor() {
  const proveedores = useProveedores();
  const comprobantes = useComprobantes();
  const pagos = usePagosProveedor();
  const tipos = useTiposComprobante();
  const [proveedorId, setProveedorId] = useState("");

  const pendientes = comprobantes
    .filter((c) => c.proveedorId === proveedorId && (c.estado === "PARA_LIQUIDAR" || c.estado === "PAGO_PARCIAL"))
    .filter((c) => tipos.find((t) => t.id === c.tipoId)?.efecto !== "RESTA")
    .sort((a, b) => vencimientoDe(a).localeCompare(vencimientoDe(b)));

  return (
    <div className="space-y-4">
      <div className="max-w-md">
        <SelectField
          id="cons-prov"
          label="Proveedor"
          value={proveedorId}
          onChange={setProveedorId}
          options={proveedores.filter((p) => p.estado !== "ELIMINADO").map((p) => ({ value: p.id, label: `${p.razonSocial} · ${formatearCuit(p.cuit)}` }))}
        />
      </div>
      {proveedorId && (
        <>
          <div>
            <h2 className="mb-2 text-sm font-semibold text-ink-900">Comprobantes pendientes de pago</h2>
            <Card className="overflow-hidden">
              {pendientes.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-ink-400">El proveedor no tiene comprobantes pendientes de pago.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] text-left text-sm">
                    <thead>
                      <tr className={ENCABEZADO}>
                        <Th>Comprobante</Th>
                        <Th>Fecha</Th>
                        <Th>Vencimiento</Th>
                        <Th>Orden de pago</Th>
                        <Th derecha>Total</Th>
                        <Th derecha>Saldo pendiente</Th>
                        <Th>Estado</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {pendientes.map((c) => (
                        <tr key={c.id}>
                          <td className="px-3 py-3 text-ink-700">
                            {tipos.find((t) => t.id === c.tipoId)?.descripcion}
                            <span className="block font-mono text-xs text-ink-400">{numeroComprobante(c)}</span>
                          </td>
                          <td className="px-3 py-3 text-ink-700">{c.fechaComprobante}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-ink-700">
                            {vencimientoDe(c)}
                            {diasDeAtraso(vencimientoDe(c), hoy()) > 0 && (
                              <span className="block text-xs font-semibold text-danger-700">Vencido hace {diasDeAtraso(vencimientoDe(c), hoy())} d</span>
                            )}
                          </td>
                          <td className="px-3 py-3 font-mono text-xs text-ink-700">{c.ordenPago}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-ink-900">{pesos(c.total)}</td>
                          <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink-900">{pesos(saldoComprobante(c, pagos))}</td>
                          <td className="px-3 py-3">
                            <EstadoComprobanteBadge estado={c.estado} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold text-ink-900">Cuenta corriente</h2>
            <CuentaCorriente proveedorId={proveedorId} />
          </div>
        </>
      )}
    </div>
  );
}

export function PantallaConsultasProveedores() {
  const [pestana, setPestana] = useState<Pestana>("ordenes");
  return (
    <PaginaCaja
      seccion="Proveedores"
      titulo="Consultas"
      descripcion="Consulta de órdenes de pago y consulta por proveedor (comprobantes pendientes y cuenta corriente)."
    >
      <div className="space-y-6">
        <Pestanas<Pestana>
          etiqueta="Tipo de consulta"
          valor={pestana}
          onChange={setPestana}
          opciones={[
            ["ordenes", "Órdenes de pago"],
            ["proveedor", "Por proveedor"],
          ]}
        />
        {pestana === "ordenes" ? <ConsultaOrdenes /> : <ConsultaProveedor />}
      </div>
    </PaginaCaja>
  );
}
