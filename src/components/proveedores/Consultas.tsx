"use client";

import { useState } from "react";
import { hoy } from "@/lib/caja-store";
import { diasDeAtraso, formatearCuit, pagadoDeOrden, pendienteDeOrden, saldoComprobante, vencimientoDe } from "@/lib/proveedores-reglas";
import { useComprobantes, useOrdenesPago, usePagosProveedor, useProveedores, useTiposComprobante } from "@/lib/proveedores-store";
import { ESTADO_ORDEN_LABEL, ESTADO_PAGO_LABEL, MEDIO_PAGO_LABEL, type OrdenPago } from "@/lib/proveedores-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Dato, PaginaCaja, descargarXlsx, quien, sinAcentos } from "@/components/caja/comunes";
import { Campo, INPUT_COMPACTO, TablaCompacta, Td, Th } from "@/components/caja/compacto";
import {
  CuentaCorriente,
  EstadoComprobanteBadge,
  EstadoOrdenBadge,
  Pestanas,
  nombreProveedor,
  numeroComprobante,
  origenTexto,
  pesos,
} from "./comunes";

type Pestana = "ordenes" | "proveedor";

function ConsultaOrdenes() {
  const ordenes = useOrdenesPago();
  const comprobantes = useComprobantes();
  const proveedores = useProveedores();
  const pagos = usePagosProveedor();
  const tipos = useTiposComprobante();
  const [texto, setTexto] = useState("");
  const [importe, setImporte] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [abierta, setAbierta] = useState<OrdenPago | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const tipoTexto = (id: string) => tipos.find((t) => t.id === id)?.descripcion ?? id;
  const comprobanteDe = (id: string) => comprobantes.find((c) => c.id === id);
  const pagosDe = (o: OrdenPago) => pagos.filter((p) => p.ordenPago === o.id);
  const hechosDe = (o: OrdenPago) => pagosDe(o).filter((p) => ["EJECUTADA", "CONFIRMADA", "ENTREGADO", "PRESENTADO", "DEBITADO"].includes(p.estado));
  const fechaOrden = (o: OrdenPago) => {
    const hs = hechosDe(o);
    return hs.length > 0 ? hs[hs.length - 1].fecha : o.fechaArmado;
  };

  const filas = ordenes
    .filter((o) => {
      const q = sinAcentos(texto.trim());
      if (!q) return true;
      const p = proveedores.find((x) => x.id === o.proveedorId);
      const numeros = o.items.map((i) => {
        const c = comprobanteDe(i.comprobanteId);
        return c ? numeroComprobante(c) : "";
      });
      return (
        [o.id, p?.razonSocial, p?.cuit, ...numeros, ...o.items.map((i) => i.comprobanteId)].some((v) => sinAcentos(v ?? "").includes(q)) ||
        (p?.cuit.replace(/\D/g, "") ?? "").includes(q.replace(/\D/g, "") || "x")
      );
    })
    .filter((o) => (importe.trim() === "" ? true : Math.abs(o.total - Number(importe.replace(",", "."))) < 0.01))
    .filter((o) => (desde ? fechaOrden(o) >= desde : true))
    .filter((o) => (hasta ? fechaOrden(o) <= hasta : true))
    .sort((a, b) => b.id.localeCompare(a.id));

  const detalle = (o: OrdenPago) => {
    const hs = hechosDe(o);
    const ultimo = hs[hs.length - 1];
    return {
      asiento: hs.map((p) => p.asiento).join(", ") || "—",
      fechaValor: ultimo?.fecha ?? "—",
      fechaPago: ultimo?.fecha ?? "—",
      origen: hs.length > 0 ? [...new Set(hs.map(origenTexto))].join(", ") : "—",
      medio: hs.length > 0 ? [...new Set(hs.map((p) => MEDIO_PAGO_LABEL[p.medio]))].join(", ") : "—",
    };
  };

  const exportar = () =>
    descargarXlsx("ordenes-de-pago.xlsx", "Órdenes de pago", [
      ["Orden de pago", "Estado", "Proveedor", "CUIT", "Comprobantes", "Total", "Pagado", "Pendiente", "Asiento contable", "Fecha valor", "Fecha de pago", "Caja o cuenta", "Medio"],
      ...filas.map((o) => {
        const p = proveedores.find((x) => x.id === o.proveedorId);
        const d = detalle(o);
        return [
          o.id,
          ESTADO_ORDEN_LABEL[o.estado],
          p?.razonSocial ?? "",
          p ? formatearCuit(p.cuit) : "",
          o.items.map((i) => { const c = comprobanteDe(i.comprobanteId); return c ? `${tipoTexto(c.tipoId)} ${numeroComprobante(c)}` : i.comprobanteId; }).join(" | "),
          String(o.total),
          String(pagadoDeOrden(o.id, pagos)),
          String(pendienteDeOrden(o, pagos)),
          d.asiento,
          d.fechaValor,
          d.fechaPago,
          d.origen,
          d.medio,
        ];
      }),
    ]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
        <Campo label="OP, proveedor, CUIT o comprobante">
          <input id="cons-texto" aria-label="OP, proveedor, CUIT o comprobante" value={texto} onChange={(e) => setTexto(e.target.value)} className={INPUT_COMPACTO} />
        </Campo>
        <Campo label="Importe (total)">
          <input id="cons-importe" aria-label="Importe (total)" type="number" value={importe} onChange={(e) => setImporte(e.target.value)} className={INPUT_COMPACTO} />
        </Campo>
        <Campo label="Fecha desde">
          <input id="cons-desde" aria-label="Fecha desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={INPUT_COMPACTO} />
        </Campo>
        <Campo label="Fecha hasta">
          <input id="cons-hasta" aria-label="Fecha hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={INPUT_COMPACTO} />
        </Campo>
        <Button size="sm" variant="navyOutline" onClick={exportar}>
          Exportar a Excel
        </Button>
      </div>
      {aviso && <Banner tone="success">{aviso}</Banner>}

      {filas.length === 0 ? (
        <p className="rounded-lg border border-ink-200 bg-white px-5 py-6 text-center text-xs text-ink-400">No hay órdenes de pago para mostrar.</p>
      ) : (
        <TablaCompacta etiqueta="Órdenes de pago" minWidth="min-w-[56rem]">
          <thead>
            <tr>
              <Th>Orden de pago</Th>
              <Th>Proveedor</Th>
              <Th>Comprobantes</Th>
              <Th derecha>Total</Th>
              <Th derecha>Pagado</Th>
              <Th>Pagó</Th>
              <Th>Estado</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map((o) => {
              const d = detalle(o);
              return (
                <tr key={o.id}>
                  <Td className="font-mono font-bold text-brand-700">{o.id}</Td>
                  <Td>{nombreProveedor(proveedores, o.proveedorId)}</Td>
                  <Td>
                    {o.items.length} {o.items.length === 1 ? "comprobante" : "comprobantes"}
                    <span className="block font-mono text-[11px] text-ink-500">
                      {o.items.map((i) => { const c = comprobanteDe(i.comprobanteId); return c ? numeroComprobante(c) : i.comprobanteId; }).join(" · ")}
                    </span>
                  </Td>
                  <Td derecha className="font-semibold">{pesos(o.total)}</Td>
                  <Td derecha>{pesos(pagadoDeOrden(o.id, pagos))}</Td>
                  <Td>
                    {d.origen}
                    <span className="block text-[11px] text-ink-500">{d.medio}</span>
                  </Td>
                  <Td>
                    <EstadoOrdenBadge estado={o.estado} />
                  </Td>
                  <Td>
                    <Button size="xs" variant="brandOutline" onClick={() => setAbierta(o)}>
                      Ver detalle
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TablaCompacta>
      )}

      {abierta && (
        <Modal
          open
          onClose={() => setAbierta(null)}
          title={`Orden de pago ${abierta.id}`}
          maxWidth="max-w-3xl"
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setAbierta(null)}>
                Cerrar
              </Button>
              <Button
                variant="navyOutline"
                onClick={() => {
                  setAviso(`Se reimprimió la orden de pago ${abierta.id} (simulado).`);
                  setAbierta(null);
                }}
              >
                Reimprimir
              </Button>
              <Button
                onClick={() => {
                  const p = proveedores.find((x) => x.id === abierta.proveedorId);
                  setAviso(`Se reenvió la orden de pago ${abierta.id} a ${p?.mail || p?.razonSocial} (simulado).`);
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
                  <Dato label="Estado">
                    <EstadoOrdenBadge estado={abierta.estado} />
                  </Dato>
                  <Dato label="Total de la orden">{pesos(abierta.total)}</Dato>
                  <Dato label="Pendiente de pago">{pesos(pendienteDeOrden(abierta, pagos))}</Dato>
                  <Dato label="Cuenta destino">{abierta.cuentaDestino || "—"}</Dato>
                  <Dato label="Asiento contable">{d.asiento}</Dato>
                  <Dato label="Fecha valor de contabilización">{d.fechaValor}</Dato>
                  <Dato label="Fecha de pago">{d.fechaPago}</Dato>
                </dl>

                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Comprobantes incluidos</p>
                  <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200 text-sm">
                    {abierta.items.map((i) => {
                      const c = comprobanteDe(i.comprobanteId);
                      if (!c) return null;
                      return (
                        <li key={i.comprobanteId} className="space-y-1 px-3 py-2">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="font-mono text-xs font-bold text-brand-700">{c.id}</span>
                            <span className="text-ink-700">
                              {tipoTexto(c.tipoId)} {numeroComprobante(c)}
                            </span>
                            <EstadoComprobanteBadge estado={c.estado} />
                            <span className="ml-auto font-semibold tabular-nums text-ink-900">{pesos(c.total)}</span>
                          </div>
                          <p className="text-xs text-ink-500">
                            Cargó {quien(c.cargadoPor)} · autorizó {quien(c.autorizacion?.usuarioId)}
                            {i.credito > 0 && ` · crédito aplicado ${pesos(i.credito)} · a pagar ${pesos(i.aPagar)}`}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Trazabilidad de la orden</p>
                  <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200 text-sm">
                    <li className="px-3 py-2 text-ink-700">
                      Armó <strong>{quien(abierta.armadaPor)}</strong> el {abierta.fechaArmado}
                    </li>
                    <li className="px-3 py-2 text-ink-700">
                      {abierta.autorizacion ? (
                        <>
                          Autorizó <strong>{quien(abierta.autorizacion.usuarioId)}</strong> el {abierta.autorizacion.fechaHora}
                          {abierta.autorizacion.firmaId ? ` · llave ${abierta.autorizacion.firmaId}` : ""}
                        </>
                      ) : (
                        "Todavía sin autorizar."
                      )}
                    </li>
                    {abierta.cierre && (
                      <li className="px-3 py-2 text-ink-700">
                        {abierta.cierre.tipo === "RECHAZO" ? "Rechazó" : "Anuló"} <strong>{quien(abierta.cierre.usuarioId)}</strong> el {abierta.cierre.fechaHora}:{" "}
                        {abierta.cierre.motivo}
                      </li>
                    )}
                    <li className="px-3 py-2 text-ink-700">
                      {ps.length > 0 ? (
                        <>Pagó {[...new Set(ps.map((p) => quien(p.usuarioId)))].join(", ")}</>
                      ) : (
                        "Todavía no se pagó."
                      )}
                    </li>
                  </ul>
                </div>

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
                          <span className="text-ink-700">
                            {MEDIO_PAGO_LABEL[p.medio]} · {origenTexto(p)}
                          </span>
                          <span className="text-xs font-semibold text-ink-500">{ESTADO_PAGO_LABEL[p.estado]}</span>
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
  const ordenes = useOrdenesPago();
  const tipos = useTiposComprobante();
  const [proveedorId, setProveedorId] = useState("");

  const pendientes = comprobantes
    .filter((c) => c.proveedorId === proveedorId && ["PARA_LIQUIDAR", "EN_ORDEN_PAGO", "PAGO_PARCIAL"].includes(c.estado))
    .filter((c) => tipos.find((t) => t.id === c.tipoId)?.efecto !== "RESTA")
    .filter((c) => saldoComprobante(c, pagos, ordenes) > 0.001)
    .sort((a, b) => vencimientoDe(a).localeCompare(vencimientoDe(b)));

  return (
    <div className="space-y-4">
      <div className="max-w-md">
        <Campo label="Proveedor">
          <select id="cons-prov" aria-label="Proveedor" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} className={INPUT_COMPACTO}>
            <option value="">Elegí el proveedor</option>
            {proveedores
              .filter((p) => p.estado !== "ELIMINADO")
              .map((p) => (
                <option key={p.id} value={p.id}>{`${p.razonSocial} · ${formatearCuit(p.cuit)}`}</option>
              ))}
          </select>
        </Campo>
      </div>
      {proveedorId && (
        <>
          <div>
            <h2 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-600">Comprobantes pendientes de pago</h2>
            {pendientes.length === 0 ? (
              <p className="rounded-lg border border-ink-200 bg-white px-5 py-5 text-center text-xs text-ink-400">El proveedor no tiene comprobantes pendientes de pago.</p>
            ) : (
              <TablaCompacta etiqueta="Comprobantes pendientes de pago" minWidth="min-w-[40rem]">
                <thead>
                  <tr>
                    <Th>Comprobante</Th>
                    <Th>Fecha</Th>
                    <Th>Vencimiento</Th>
                    <Th>Orden de pago</Th>
                    <Th derecha>Total</Th>
                    <Th derecha>Saldo pendiente</Th>
                    <Th>Estado</Th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map((c) => (
                    <tr key={c.id}>
                      <Td>
                        {tipos.find((t) => t.id === c.tipoId)?.descripcion}
                        <span className="ml-1.5 font-mono text-[11px] text-ink-500">{numeroComprobante(c)}</span>
                      </Td>
                      <Td>{c.fechaComprobante}</Td>
                      <Td className="whitespace-nowrap">
                        {vencimientoDe(c)}
                        {diasDeAtraso(vencimientoDe(c), hoy()) > 0 && (
                          <span className="ml-1.5 font-semibold text-danger-700">Vencido hace {diasDeAtraso(vencimientoDe(c), hoy())} d</span>
                        )}
                      </Td>
                      <Td className="font-mono">{c.ordenPago ?? "—"}</Td>
                      <Td derecha>{pesos(c.total)}</Td>
                      <Td derecha className="font-semibold">{pesos(saldoComprobante(c, pagos, ordenes))}</Td>
                      <Td>
                        <EstadoComprobanteBadge estado={c.estado} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TablaCompacta>
            )}
          </div>
          <div>
            <h2 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-600">Cuenta corriente</h2>
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
      descripcion="Consulta de órdenes de pago (con su trazabilidad) y consulta por proveedor (comprobantes pendientes y cuenta corriente)."
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
