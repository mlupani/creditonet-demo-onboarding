"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { nombreUsuario, useUsuarioActual } from "@/lib/caja-store";
import { puedeAutorizarPorMatriz } from "@/lib/matriz";
import { autorizarOrdenPago, rechazarOrdenPago } from "@/lib/proveedores-operaciones";
import { puedeAutorizarOrden, puedePagarOrden, vencimientoDe } from "@/lib/proveedores-reglas";
import { useComprobantes, useOrdenesPago, usePagosProveedor, useProveedores, useTiposComprobante } from "@/lib/proveedores-store";
import { ESTADO_PAGO_LABEL, MEDIO_PAGO_LABEL, type Comprobante, type OrdenPago } from "@/lib/proveedores-tipos";
import { ordenesDeBandeja, type FiltrosBandeja } from "@/lib/bandeja-reglas";
import { Button } from "@/components/ui/Button";
import { LlaveModal } from "@/components/caja/LlaveModal";
import { NotaModal } from "@/components/caja/comunes";
import { Pill, TablaCompacta, Td, Th, type Fase } from "@/components/caja/compacto";
import { Flecha, ImagenComprobanteModal, cuitTexto, formatearCbu, nombreProveedor, numeroComprobante, origenTexto, pesos } from "./comunes";
import { EstadoOrdenBadge } from "./comunes";
import { PagarModal, type ItemPago } from "./PagarModal";

type Accion =
  | { tipo: "autorizar" | "rechazar"; orden: OrdenPago }
  | { tipo: "pagar"; items: ItemPago[] };

// 2026-11-18 → 18/11
const fechaCorta = (f: string) => (/^\d{4}-\d{2}-\d{2}$/.test(f) ? `${f.slice(8)}/${f.slice(5, 7)}` : f);

const FASE_PAGO = (estado: string): Fase =>
  estado === "RECHAZADA" || estado === "RECHAZADO" || estado === "ANULADO" ? "rechazo" : "proceso";

// Órdenes de pago emitidas por autorizar y autorizadas por pagar. Cada fila se abre en cascada: facturas
// incluidas, quién cargó, autorizó y armó, la imagen del comprobante y los pagos ya hechos. Se paga de a
// una (botón Pagar de la fila) o en lote, tildando varias órdenes del mismo proveedor.
export function VistaProveedores({ filtros }: { filtros: FiltrosBandeja }) {
  const usuario = useUsuarioActual();
  const ordenes = useOrdenesPago();
  const pagos = usePagosProveedor();
  const proveedores = useProveedores();
  const comprobantes = useComprobantes();
  const tipos = useTiposComprobante();
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [tildadas, setTildadas] = useState<Set<string>>(new Set());
  const [accion, setAccion] = useState<Accion | null>(null);
  const [imagen, setImagen] = useState<Comprobante | null>(null);

  const filas = useMemo(() => ordenesDeBandeja(ordenes, pagos, proveedores, filtros), [ordenes, pagos, proveedores, filtros]);
  const alternar = (id: string) =>
    setAbiertas((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  const tildar = (id: string) =>
    setTildadas((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });

  const motivoNoAutoriza = (o: OrdenPago) =>
    puedeAutorizarOrden(usuario, o) ?? puedeAutorizarPorMatriz(usuario, "ORDEN_PAGO", o.total, "ARS");
  const motivoNoPaga = puedePagarOrden(usuario);

  // Las órdenes tildadas que siguen siendo pagables (por si cambiaron desde que se tildaron).
  const seleccion = filas.filter((f) => f.fase === "PAGAR" && tildadas.has(f.orden.id));
  const proveedorTildado = seleccion[0]?.orden.proveedorId;
  const totalSeleccion = seleccion.reduce((s, f) => s + f.pendiente, 0);

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-ink-500">
        Las órdenes salen del armado en Proveedores. Una orden agrupa las facturas de un solo proveedor.
      </p>

      <TablaCompacta etiqueta="Órdenes de pago de la bandeja" minWidth="min-w-[58rem]">
        <thead>
          <tr>
            <Th className="w-16">
              <span className="sr-only">Selección</span>
            </Th>
            <Th>ID OP</Th>
            <Th>Proveedor / CUIT</Th>
            <Th>Fecha proceso</Th>
            <Th>Fecha comprob.</Th>
            <Th>N° comprobante</Th>
            <Th derecha>Importe</Th>
            <Th>Estado</Th>
            <Th>
              <span className="sr-only">Acciones</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 && (
            <tr>
              <Td colSpan={9} className="py-6 text-center text-ink-400">
                No hay órdenes de pago por autorizar ni por pagar con estos filtros.
              </Td>
            </tr>
          )}
          {filas.map(({ orden, proveedor, fase, pendiente }) => {
            const abierta = abiertas.has(orden.id);
            const pagosOrden = pagos.filter((p) => p.ordenPago === orden.id);
            const noAutoriza = fase === "AUTORIZAR" ? motivoNoAutoriza(orden) : null;
            const items = orden.items.map((i) => ({ item: i, c: comprobantes.find((x) => x.id === i.comprobanteId) }));
            const otroProveedor = !!proveedorTildado && proveedorTildado !== orden.proveedorId;
            const tildable = fase === "PAGAR" && !otroProveedor;
            return (
              <Fragment key={orden.id}>
                <tr className={abierta ? "bg-brand-50/40" : tildadas.has(orden.id) ? "bg-brand-50/30" : undefined}>
                  <Td className="whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={fase === "PAGAR" && tildadas.has(orden.id)}
                        disabled={!tildable}
                        onChange={() => tildar(orden.id)}
                        aria-label={`Tildar ${orden.id} para pagar en lote`}
                        title={
                          fase === "AUTORIZAR"
                            ? "Se puede tildar cuando la orden esté autorizada"
                            : otroProveedor
                              ? "Sólo se pueden tildar órdenes del mismo proveedor"
                              : "Tildar para pagar en lote"
                        }
                        className="h-3.5 w-3.5 accent-brand-600 disabled:cursor-not-allowed"
                      />
                      <Flecha abierto={abierta} onClick={() => alternar(orden.id)} etiqueta={`Ver el detalle de ${orden.id}`} />
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap font-semibold text-ink-900">{orden.id}</Td>
                  <Td>
                    <p className="font-medium text-ink-900">{proveedor?.razonSocial ?? orden.proveedorId}</p>
                    <p className="text-[11px] text-ink-500">{cuitTexto(proveedor)}</p>
                  </Td>
                  <Td className="whitespace-nowrap">{fechaCorta(orden.fechaArmado)}</Td>
                  <Td className="whitespace-nowrap">{items.map((x) => (x.c ? fechaCorta(x.c.fechaComprobante) : "—")).join(" · ")}</Td>
                  <Td>{items.map((x) => (x.c ? numeroComprobante(x.c) : x.item.comprobanteId)).join(" · ")}</Td>
                  <Td derecha className="font-semibold text-ink-900">
                    {pesos(pendiente)}
                  </Td>
                  <Td>{fase === "AUTORIZAR" ? <Pill fase="proceso">Emitida</Pill> : <Pill fase="espera">Autorizada</Pill>}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      {fase === "AUTORIZAR" ? (
                        <>
                          <Button
                            size="xs"
                            variant="successOutline"
                            disabled={!!noAutoriza}
                            title={noAutoriza ?? "Autorizar con tu llave"}
                            onClick={() => setAccion({ tipo: "autorizar", orden })}
                          >
                            Autorizar
                          </Button>
                          <Button
                            size="xs"
                            variant="dangerOutline"
                            disabled={!!noAutoriza}
                            title={noAutoriza ?? "Rechazar con motivo"}
                            onClick={() => setAccion({ tipo: "rechazar", orden })}
                          >
                            Rechazar
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="xs"
                          variant="successOutline"
                          disabled={!!motivoNoPaga}
                          title={motivoNoPaga ?? "Elegí el medio y pagá"}
                          onClick={() => setAccion({ tipo: "pagar", items: [{ orden, pendiente }] })}
                        >
                          Pagar
                        </Button>
                      )}
                    </div>
                    {(noAutoriza || (fase === "PAGAR" && motivoNoPaga)) && (
                      <p className="mt-1 max-w-44 text-[10.5px] leading-snug text-ink-500">{noAutoriza ?? motivoNoPaga}</p>
                    )}
                  </Td>
                </tr>
                {abierta && (
                  <tr className="bg-ink-25">
                    <Td colSpan={9} className="px-3 py-2">
                      <p className="text-[11px] leading-relaxed text-ink-700">
                        <span className="font-bold">▾ Detalle {orden.id}</span> · Cargó:{" "}
                        {[...new Set(items.map((x) => (x.c ? nombreUsuario(x.c.cargadoPor) : "—")))].join(", ")} · Armó: {nombreUsuario(orden.armadaPor)}{" "}
                        {orden.fechaArmado} · Autorizó:{" "}
                        {orden.autorizacion
                          ? `${nombreUsuario(orden.autorizacion.usuarioId)} ${orden.autorizacion.fechaHora}${orden.autorizacion.firmaId ? ` · llave ${orden.autorizacion.firmaId}` : ""}`
                          : "todavía sin autorizar"}{" "}
                        · Facturas:{" "}
                        {items.map((x) => `${x.c ? numeroComprobante(x.c) : x.item.comprobanteId} (${pesos(x.item.aPagar)})`).join(", ")} · Cuenta destino:{" "}
                        {orden.cuentaDestino ? <span className="font-mono">{formatearCbu(orden.cuentaDestino)}</span> : "sin CBU cargado"} ·{" "}
                        <EstadoOrdenBadge estado={orden.estado} />
                      </p>
                      <p className="mt-1 text-[11px]">
                        {items.map(
                          (x) =>
                            x.c && (
                              <button key={x.c.id} type="button" onClick={() => setImagen(x.c!)} className="mr-3 text-brand-700 underline hover:text-brand-900">
                                Ver imagen {numeroComprobante(x.c)}
                              </button>
                            )
                        )}
                      </p>

                      <p className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-wide text-ink-500">Facturas incluidas</p>
                      <TablaCompacta etiqueta={`Facturas de ${orden.id}`} minWidth="min-w-[40rem]">
                        <thead>
                          <tr>
                            <Th>Comprobante</Th>
                            <Th>Fecha</Th>
                            <Th>Vence</Th>
                            <Th>Cargó</Th>
                            <Th>Autorizó</Th>
                            <Th derecha>Crédito aplicado</Th>
                            <Th derecha>A pagar</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map(({ item, c }) => (
                            <tr key={item.comprobanteId}>
                              <Td>
                                <span className="font-medium">{c ? `${tipos.find((t) => t.id === c.tipoId)?.descripcion ?? ""} ${numeroComprobante(c)}` : item.comprobanteId}</span>
                                <span className="ml-1 text-ink-400">{item.comprobanteId}</span>
                              </Td>
                              <Td>{c?.fechaComprobante ?? "—"}</Td>
                              <Td>{c ? vencimientoDe(c) : "—"}</Td>
                              <Td>{c ? nombreUsuario(c.cargadoPor) : "—"}</Td>
                              <Td>{c?.autorizacion ? nombreUsuario(c.autorizacion.usuarioId) : "—"}</Td>
                              <Td derecha>{item.credito ? pesos(item.credito) : "—"}</Td>
                              <Td derecha>{pesos(item.aPagar)}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </TablaCompacta>

                      <p className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-wide text-ink-500">Pagos de la orden</p>
                      {pagosOrden.length === 0 ? (
                        <p className="text-[11px] text-ink-400">Todavía no se pagó nada.</p>
                      ) : (
                        <ul className="space-y-1 text-[11px]">
                          {pagosOrden.map((p) => (
                            <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-md border border-ink-200 bg-white px-2.5 py-1.5">
                              <span className="font-semibold text-ink-800">{p.id}</span>
                              <span className="text-ink-600">
                                {MEDIO_PAGO_LABEL[p.medio]} · {origenTexto(p)}
                              </span>
                              <span className="tabular-nums text-ink-800">{pesos(p.importe)}</span>
                              <Pill fase={FASE_PAGO(p.estado)}>{ESTADO_PAGO_LABEL[p.estado]}</Pill>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </TablaCompacta>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          variant="success"
          size="sm"
          disabled={seleccion.length === 0 || !!motivoNoPaga}
          title={motivoNoPaga ?? (seleccion.length === 0 ? "Tildá una o más órdenes del mismo proveedor" : "Elegí el medio y pagá")}
          onClick={() => setAccion({ tipo: "pagar", items: seleccion.map((f) => ({ orden: f.orden, pendiente: f.pendiente })) })}
        >
          Pagar seleccionadas ({seleccion.length} · {pesos(totalSeleccion)})
        </Button>
        <Link
          href="/proveedores/posicion"
          className="inline-flex h-8 items-center rounded-lg border border-navy-800 bg-white px-3 text-xs font-semibold text-navy-800 hover:bg-ink-100"
        >
          Ver posición del proveedor
        </Link>
        {proveedorTildado && (
          <span className="text-[11px] text-ink-500">
            Tildadas sólo de {nombreProveedor(proveedores, proveedorTildado)}: el sistema no permite mezclar proveedores en un mismo pago.
          </span>
        )}
      </div>

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
      {accion?.tipo === "pagar" && (
        <PagarModal
          items={accion.items}
          onClose={(pagado) => {
            setAccion(null);
            if (pagado) setTildadas(new Set());
          }}
        />
      )}
      {imagen && <ImagenComprobanteModal comprobante={imagen} proveedor={nombreProveedor(proveedores, imagen.proveedorId)} onClose={() => setImagen(null)} />}
    </div>
  );
}
