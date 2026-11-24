"use client";

import { Fragment, useMemo, useState } from "react";
import { nombreUsuario, useUsuarioActual } from "@/lib/caja-store";
import { puedeAutorizarPorMatriz } from "@/lib/matriz";
import { autorizarOrdenPago, rechazarOrdenPago } from "@/lib/proveedores-operaciones";
import { puedeAutorizarOrden, puedePagarOrden, vencimientoDe } from "@/lib/proveedores-reglas";
import { useComprobantes, useOrdenesPago, usePagosProveedor, useProveedores, useTiposComprobante } from "@/lib/proveedores-store";
import { ESTADO_PAGO_LABEL, MEDIO_PAGO_LABEL, type Comprobante, type OrdenPago } from "@/lib/proveedores-tipos";
import { ordenesDeBandeja, type FiltrosBandeja } from "@/lib/bandeja-reglas";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IconFileText } from "@/components/icons";
import { LlaveModal } from "@/components/caja/LlaveModal";
import { NotaModal, descargarXlsx } from "@/components/caja/comunes";
import { ENCABEZADO, EstadoOrdenBadge, Flecha, ImagenComprobanteModal, Th, cuitTexto, formatearCbu, nombreProveedor, numeroComprobante, origenTexto, pesos } from "./comunes";
import { PagarModal } from "./PagarModal";

type Accion = { tipo: "autorizar" | "rechazar" | "pagar"; orden: OrdenPago; pendiente: number };

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">{label}</p>
      <p className="mt-0.5 text-sm text-ink-800">{children}</p>
    </div>
  );
}

// Órdenes de pago autorizadas por pagar y emitidas por autorizar. Cada fila se abre en cascada: facturas
// incluidas, quién cargó, autorizó y armó, la imagen del comprobante y los pagos ya hechos.
export function VistaProveedores({ filtros }: { filtros: FiltrosBandeja }) {
  const usuario = useUsuarioActual();
  const ordenes = useOrdenesPago();
  const pagos = usePagosProveedor();
  const proveedores = useProveedores();
  const comprobantes = useComprobantes();
  const tipos = useTiposComprobante();
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [accion, setAccion] = useState<Accion | null>(null);
  const [imagen, setImagen] = useState<Comprobante | null>(null);

  const filas = useMemo(() => ordenesDeBandeja(ordenes, pagos, proveedores, filtros), [ordenes, pagos, proveedores, filtros]);
  const alternar = (id: string) =>
    setAbiertas((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });

  const motivoNoAutoriza = (o: OrdenPago) =>
    puedeAutorizarOrden(usuario, o) ?? puedeAutorizarPorMatriz(usuario, "ORDEN_PAGO", o.total, "ARS");
  const motivoNoPaga = puedePagarOrden(usuario);

  const exportar = () =>
    descargarXlsx("bandeja-ordenes-pago.xlsx", "Órdenes de pago", [
      ["Orden", "Proveedor", "CUIT", "Facturas", "Total", "Pendiente", "Estado", "Armó", "Autorizó"],
      ...filas.map((f) => [
        f.orden.id,
        f.proveedor?.razonSocial ?? f.orden.proveedorId,
        cuitTexto(f.proveedor),
        String(f.orden.items.length),
        String(f.orden.total),
        String(f.pendiente),
        f.fase === "AUTORIZAR" ? "Por autorizar" : "Autorizada · por pagar",
        nombreUsuario(f.orden.armadaPor),
        f.orden.autorizacion ? nombreUsuario(f.orden.autorizacion.usuarioId) : "",
      ]),
    ]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-ink-500">
          Las órdenes salen del armado en Proveedores. Acá se autorizan con la llave (otro usuario distinto de quien la armó) y se pagan
          eligiendo el medio. Una orden agrupa las facturas de un solo proveedor.
        </p>
        <Button variant="outline" size="sm" onClick={exportar} disabled={filas.length === 0}>
          Exportar a Excel
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className={ENCABEZADO}>
              <Th />
              <Th>Orden</Th>
              <Th>Proveedor</Th>
              <Th derecha>Facturas</Th>
              <Th derecha>Total</Th>
              <Th derecha>Pendiente</Th>
              <Th>Situación</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {filas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-ink-400">
                  No hay órdenes de pago por autorizar ni por pagar con estos filtros.
                </td>
              </tr>
            )}
            {filas.map(({ orden, proveedor, fase, pendiente }) => {
              const abierta = abiertas.has(orden.id);
              const pagosOrden = pagos.filter((p) => p.ordenPago === orden.id);
              const noAutoriza = fase === "AUTORIZAR" ? motivoNoAutoriza(orden) : null;
              return (
                <Fragment key={orden.id}>
                  <tr className={abierta ? "bg-brand-50/40" : "hover:bg-ink-25"}>
                    <td className="w-10 px-2 py-3">
                      <Flecha abierto={abierta} onClick={() => alternar(orden.id)} etiqueta={`Ver el detalle de ${orden.id}`} />
                    </td>
                    <td className="px-3 py-3 font-semibold text-ink-900">{orden.id}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-ink-800">{proveedor?.razonSocial ?? orden.proveedorId}</p>
                      <p className="text-xs text-ink-400">CUIT {cuitTexto(proveedor)}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{orden.items.length}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{pesos(orden.total)}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink-900">{pesos(pendiente)}</td>
                    <td className="px-3 py-3">
                      {fase === "AUTORIZAR" ? <StatusBadge tone="warning">Por autorizar</StatusBadge> : <StatusBadge tone="success">Por pagar</StatusBadge>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {fase === "AUTORIZAR" ? (
                          <>
                            <Button
                              size="sm"
                              variant="success"
                              disabled={!!noAutoriza}
                              title={noAutoriza ?? "Autorizar con tu llave"}
                              onClick={() => setAccion({ tipo: "autorizar", orden, pendiente })}
                            >
                              Autorizar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!!noAutoriza}
                              title={noAutoriza ?? "Rechazar con motivo"}
                              onClick={() => setAccion({ tipo: "rechazar", orden, pendiente })}
                            >
                              Rechazar
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" disabled={!!motivoNoPaga} title={motivoNoPaga ?? "Elegí el medio y pagá"} onClick={() => setAccion({ tipo: "pagar", orden, pendiente })}>
                            Pagar
                          </Button>
                        )}
                      </div>
                      {(noAutoriza || (fase === "PAGAR" && motivoNoPaga)) && (
                        <p className="mt-1 max-w-56 text-[11px] leading-snug text-ink-400">{noAutoriza ?? motivoNoPaga}</p>
                      )}
                    </td>
                  </tr>
                  {abierta && (
                    <tr className="bg-ink-25">
                      <td colSpan={8} className="px-4 pb-4 pt-2">
                        <div className="grid gap-3 sm:grid-cols-4">
                          <Dato label="Armó la orden">
                            {nombreUsuario(orden.armadaPor)} · {orden.fechaArmado}
                          </Dato>
                          <Dato label="Autorizó la orden">
                            {orden.autorizacion
                              ? `${nombreUsuario(orden.autorizacion.usuarioId)} · ${orden.autorizacion.fechaHora}${orden.autorizacion.firmaId ? ` · llave ${orden.autorizacion.firmaId}` : ""}`
                              : "Todavía sin autorizar"}
                          </Dato>
                          <Dato label="Estado de la orden">
                            <EstadoOrdenBadge estado={orden.estado} />
                          </Dato>
                          <Dato label="Destino de la transferencia">
                            {orden.cuentaDestino ? <span className="font-mono text-xs">{formatearCbu(orden.cuentaDestino)}</span> : "Sin CBU cargado"}
                          </Dato>
                        </div>

                        <p className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Facturas incluidas</p>
                        <div className="overflow-x-auto rounded-lg border border-ink-200 bg-white">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className={ENCABEZADO}>
                                <Th>Comprobante</Th>
                                <Th>Fecha</Th>
                                <Th>Vence</Th>
                                <Th>Cargó</Th>
                                <Th>Autorizó</Th>
                                <Th derecha>Crédito aplicado</Th>
                                <Th derecha>A pagar</Th>
                                <Th />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-ink-100">
                              {orden.items.map((item) => {
                                const c = comprobantes.find((x) => x.id === item.comprobanteId);
                                return (
                                  <tr key={item.comprobanteId}>
                                    <td className="px-3 py-2">
                                      <span className="font-medium text-ink-800">{c ? `${tipos.find((t) => t.id === c.tipoId)?.descripcion ?? ""} ${numeroComprobante(c)}` : item.comprobanteId}</span>
                                      <span className="ml-1 text-ink-400">{item.comprobanteId}</span>
                                    </td>
                                    <td className="px-3 py-2">{c?.fechaComprobante ?? "—"}</td>
                                    <td className="px-3 py-2">{c ? vencimientoDe(c) : "—"}</td>
                                    <td className="px-3 py-2">{c ? nombreUsuario(c.cargadoPor) : "—"}</td>
                                    <td className="px-3 py-2">{c?.autorizacion ? nombreUsuario(c.autorizacion.usuarioId) : "—"}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{item.credito ? pesos(item.credito) : "—"}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{pesos(item.aPagar)}</td>
                                    <td className="px-3 py-2 text-right">
                                      {c && (
                                        <button type="button" onClick={() => setImagen(c)} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                                          <IconFileText width={14} height={14} />
                                          Ver imagen
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <p className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Pagos de la orden</p>
                        {pagosOrden.length === 0 ? (
                          <p className="text-xs text-ink-400">Todavía no se pagó nada.</p>
                        ) : (
                          <ul className="space-y-1 text-xs">
                            {pagosOrden.map((p) => (
                              <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2">
                                <span className="font-semibold text-ink-800">{p.id}</span>
                                <span className="text-ink-600">
                                  {MEDIO_PAGO_LABEL[p.medio]} · {origenTexto(p)}
                                </span>
                                <span className="tabular-nums text-ink-800">{pesos(p.importe)}</span>
                                <StatusBadge tone={p.estado === "RECHAZADA" || p.estado === "RECHAZADO" || p.estado === "ANULADO" ? "danger" : "info"}>
                                  {ESTADO_PAGO_LABEL[p.estado]}
                                </StatusBadge>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>

      {accion?.tipo === "autorizar" && (
        <LlaveModal
          open
          titulo={`Autorizar ${accion.orden.id}`}
          descripcion={`Orden de pago de ${nombreProveedor(proveedores, accion.orden.proveedorId)} por ${pesos(accion.orden.total)}. Firmás con tu llave: la autoriza un usuario distinto del que la armó.`}
          datos={{
            operacion: "Autorización de orden de pago",
            referencia: accion.orden.id,
            importe: accion.orden.total,
            moneda: "ARS",
            cargadoPor: accion.orden.armadaPor,
          }}
          usuarioId={usuario.id}
          confirmar="Autorizar"
          onFirmada={(firma) => {
            const r = autorizarOrdenPago(accion.orden.id, firma.id);
            return r.ok ? null : r.error;
          }}
          onClose={() => setAccion(null)}
        />
      )}
      {accion?.tipo === "rechazar" && (
        <NotaModal
          open
          titulo={`Rechazar ${accion.orden.id}`}
          descripcion="La orden se rechaza y sus facturas vuelven a quedar Para liquidar."
          requerida
          confirmar="Rechazar"
          tono="danger"
          llave={{ operacion: "Rechazo de orden de pago", referencia: accion.orden.id, importe: accion.orden.total, moneda: "ARS", cargadoPor: accion.orden.armadaPor }}
          onClose={() => setAccion(null)}
          onConfirmar={(nota, firmaId) => {
            const r = rechazarOrdenPago(accion.orden.id, nota, firmaId);
            return r.ok ? null : r.error;
          }}
        />
      )}
      {accion?.tipo === "pagar" && <PagarModal orden={accion.orden} pendiente={accion.pendiente} onClose={() => setAccion(null)} />}
      {imagen && <ImagenComprobanteModal comprobante={imagen} proveedor={nombreProveedor(proveedores, imagen.proveedorId)} onClose={() => setImagen(null)} />}
    </div>
  );
}
