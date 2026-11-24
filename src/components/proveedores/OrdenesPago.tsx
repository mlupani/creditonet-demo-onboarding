"use client";

import { useState } from "react";
import { hoy, useUsuarioActual } from "@/lib/caja-store";
import {
  armarOrdenPago,
  anularOrdenPago,
  autorizarOrdenPago,
  emitirOrdenPago,
  rechazarOrdenPago,
} from "@/lib/proveedores-operaciones";
import {
  diasDeAtraso,
  formatearCuit,
  itemsDeOrden,
  pagadoDeOrden,
  puedeArmarOrden,
  puedeAutorizarOrden,
  saldoComprobante,
  vencimientoDe,
} from "@/lib/proveedores-reglas";
import { useComprobantes, useOrdenesPago, usePagosProveedor, useProveedores, useTiposComprobante } from "@/lib/proveedores-store";
import { ESTADO_ORDEN_LABEL, type EstadoOrdenPago, type OrdenPago } from "@/lib/proveedores-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { Dato, ErrorBanner, NotaModal, PaginaCaja, quien } from "@/components/caja/comunes";
import {
  ENCABEZADO,
  EstadoComprobanteBadge,
  EstadoOrdenBadge,
  Pestanas,
  Th,
  nombreProveedor,
  numeroComprobante,
  pesos,
} from "./comunes";

type Pestana = "armar" | "ordenes";

// ---------- Armado ----------

function Armado({ onArmada }: { onArmada: () => void }) {
  const proveedores = useProveedores();
  const comprobantes = useComprobantes();
  const tipos = useTiposComprobante();
  const pagos = usePagosProveedor();
  const ordenes = useOrdenesPago();
  const usuario = useUsuarioActual();
  const [proveedorId, setProveedorId] = useState("");
  const [tildados, setTildados] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const proveedor = proveedores.find((p) => p.id === proveedorId);
  const disponibles = comprobantes
    .filter((c) => c.proveedorId === proveedorId && c.estado === "PARA_LIQUIDAR")
    .sort((a, b) => vencimientoDe(a).localeCompare(vencimientoDe(b)));
  const seleccion = disponibles.filter((c) => tildados.includes(c.id));
  const calculo = seleccion.length > 0 ? itemsDeOrden(seleccion, tipos, pagos, ordenes) : null;
  const denegado = puedeArmarOrden(usuario);

  const esNota = (id: string) => tipos.find((t) => t.id === comprobantes.find((c) => c.id === id)?.tipoId)?.efecto === "RESTA";
  const aPagarDe = (id: string) => (calculo?.ok ? calculo.items.find((i) => i.comprobanteId === id) : undefined);

  const cambiarProveedor = (id: string) => {
    setProveedorId(id);
    setTildados([]);
    setError(null);
  };
  const alternar = (id: string) => {
    setError(null);
    setTildados((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  };

  const armar = (borrador: boolean) => {
    const r = armarOrdenPago(proveedorId, tildados, { borrador });
    if (r.ok) {
      setTildados([]);
      setError(null);
      onArmada();
    } else setError(r.error);
  };

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <SelectField
          id="op-proveedor"
          label="Proveedor"
          required
          value={proveedorId}
          onChange={cambiarProveedor}
          placeholder="Elegí el proveedor"
          options={proveedores.filter((p) => p.estado === "ACTIVO").map((p) => ({ value: p.id, label: `${p.razonSocial} · ${formatearCuit(p.cuit)}` }))}
        />
      </div>
      <p className="max-w-3xl text-xs text-ink-500">
        Una orden de pago es siempre de un solo proveedor y puede incluir varias facturas de ese proveedor. Sólo se pueden tildar comprobantes en estado
        Para liquidar. Las notas de crédito restan de las facturas de la orden.
      </p>

      {proveedor && (
        <>
          <Card className="overflow-hidden">
            {disponibles.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-400">El proveedor no tiene comprobantes Para liquidar.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[52rem] text-left text-sm">
                  <thead>
                    <tr className={ENCABEZADO}>
                      <Th />
                      <Th>Comprobante</Th>
                      <Th>Fecha</Th>
                      <Th>Vencimiento</Th>
                      <Th derecha>Saldo</Th>
                      <Th derecha>A pagar</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {disponibles.map((c) => {
                      const tipo = tipos.find((t) => t.id === c.tipoId);
                      const item = aPagarDe(c.id);
                      const atraso = diasDeAtraso(vencimientoDe(c), hoy());
                      return (
                        <tr key={c.id} className={tildados.includes(c.id) ? "bg-brand-50/50" : undefined}>
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              aria-label={`Incluir ${numeroComprobante(c)}`}
                              checked={tildados.includes(c.id)}
                              onChange={() => alternar(c.id)}
                              className="h-4 w-4 rounded border-ink-300"
                            />
                          </td>
                          <td className="px-3 py-3 text-ink-700">
                            {tipo?.descripcion}
                            <span className="block font-mono text-xs text-ink-400">{numeroComprobante(c)}</span>
                          </td>
                          <td className="px-3 py-3 text-ink-700">{c.fechaComprobante}</td>
                          <td className="px-3 py-3 text-ink-700">
                            {vencimientoDe(c)}
                            {atraso > 0 && <span className="block text-xs font-semibold text-danger-700">Vencido hace {atraso} d</span>}
                          </td>
                          <td className={`px-3 py-3 text-right tabular-nums ${esNota(c.id) ? "text-success-700" : "text-ink-900"}`}>
                            {esNota(c.id) ? pesos(-saldoComprobante(c, pagos, ordenes)) : pesos(saldoComprobante(c, pagos, ordenes))}
                          </td>
                          <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink-900">
                            {tildados.includes(c.id) && item ? (esNota(c.id) ? "—" : pesos(item.aPagar)) : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border border-ink-200 bg-ink-25 px-4 py-3">
            <Dato label="Cuenta destino del proveedor">
              {proveedor.cbu ? <span className="font-mono text-xs">{proveedor.cbu}</span> : <span className="text-warning-700">Sin CBU en la ficha</span>}
            </Dato>
            <Dato label="Total de la orden de pago">
              <span className="text-lg font-bold tabular-nums">{calculo?.ok ? pesos(calculo.total) : pesos(0)}</span>
            </Dato>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="outline" disabled={!!denegado || tildados.length === 0} onClick={() => armar(true)}>
                Grabar borrador
              </Button>
              <Button disabled={!!denegado || tildados.length === 0} onClick={() => armar(false)} title={denegado ?? undefined}>
                Cerrar y enviar a autorizar
              </Button>
            </div>
          </div>
          {denegado && <p className="text-xs text-ink-500">{denegado}</p>}
          {calculo && !calculo.ok && <p className="text-xs font-semibold text-warning-700">{calculo.error}</p>}
          <ErrorBanner error={error} />
        </>
      )}
    </div>
  );
}

// ---------- Órdenes ----------

type Accion = { tipo: "rechazar" | "anular"; orden: OrdenPago } | null;

function Ordenes() {
  const ordenes = useOrdenesPago();
  const proveedores = useProveedores();
  const comprobantes = useComprobantes();
  const pagos = usePagosProveedor();
  const usuario = useUsuarioActual();
  const [estado, setEstado] = useState<"" | EstadoOrdenPago>("");
  const [proveedorId, setProveedorId] = useState("");
  const [accion, setAccion] = useState<Accion>(null);
  const [historial, setHistorial] = useState<OrdenPago | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filas = ordenes
    .filter((o) => (estado ? o.estado === estado : true))
    .filter((o) => (proveedorId ? o.proveedorId === proveedorId : true))
    .sort((a, b) => b.id.localeCompare(a.id));

  const correr = (r: { ok: boolean; error?: string }) => setError(r.ok ? null : (r.error ?? "No se pudo completar la operación."));
  const comprobanteDe = (id: string) => comprobantes.find((c) => c.id === id);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <SelectField
          id="ord-estado"
          label="Estado"
          value={estado}
          onChange={(v) => setEstado(v as "" | EstadoOrdenPago)}
          placeholder="Todos"
          options={(Object.keys(ESTADO_ORDEN_LABEL) as EstadoOrdenPago[]).map((e) => ({ value: e, label: ESTADO_ORDEN_LABEL[e] }))}
        />
        <SelectField
          id="ord-proveedor"
          label="Proveedor"
          value={proveedorId}
          onChange={setProveedorId}
          placeholder="Todos"
          options={proveedores.filter((p) => p.estado !== "ELIMINADO").map((p) => ({ value: p.id, label: p.razonSocial }))}
        />
      </div>
      <ErrorBanner error={error} />

      <Card className="overflow-hidden">
        {filas.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-400">No hay órdenes de pago para mostrar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-left text-sm">
              <thead>
                <tr className={ENCABEZADO}>
                  <Th>Orden</Th>
                  <Th>Proveedor</Th>
                  <Th>Comprobantes</Th>
                  <Th derecha>Total</Th>
                  <Th derecha>Pagado</Th>
                  <Th>Armó</Th>
                  <Th>Estado</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filas.map((o) => {
                  const noAutoriza = puedeAutorizarOrden(usuario, o);
                  const noArma = puedeArmarOrden(usuario);
                  const anulable = ["BORRADOR", "EMITIDA", "AUTORIZADA", "PENDIENTE_TRANSFERENCIA"].includes(o.estado);
                  return (
                    <tr key={o.id}>
                      <td className="px-3 py-3 font-mono text-xs font-bold text-brand-700">{o.id}</td>
                      <td className="px-3 py-3 text-ink-700">{nombreProveedor(proveedores, o.proveedorId)}</td>
                      <td className="px-3 py-3 text-ink-700">
                        {o.items.length}
                        <span className="block font-mono text-xs text-ink-400">
                          {o.items.map((i) => { const c = comprobanteDe(i.comprobanteId); return c ? numeroComprobante(c) : i.comprobanteId; }).join(" · ")}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink-900">{pesos(o.total)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink-700">{pesos(pagadoDeOrden(o.id, pagos))}</td>
                      <td className="px-3 py-3 text-ink-700">
                        {quien(o.armadaPor)}
                        <span className="block text-xs text-ink-400">{o.fechaArmado}</span>
                      </td>
                      <td className="px-3 py-3">
                        <EstadoOrdenBadge estado={o.estado} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {o.estado === "BORRADOR" && (
                            <Button size="sm" disabled={!!noArma} title={noArma ?? undefined} onClick={() => correr(emitirOrdenPago(o.id))}>
                              Cerrar y emitir
                            </Button>
                          )}
                          {o.estado === "EMITIDA" && (
                            <>
                              <Button size="sm" disabled={!!noAutoriza} title={noAutoriza ?? undefined} onClick={() => correr(autorizarOrdenPago(o.id))}>
                                Autorizar
                              </Button>
                              <Button size="sm" variant="outline" disabled={!!noAutoriza} title={noAutoriza ?? undefined} onClick={() => setAccion({ tipo: "rechazar", orden: o })}>
                                Rechazar
                              </Button>
                            </>
                          )}
                          {anulable && (
                            <Button size="sm" variant="outline" onClick={() => setAccion({ tipo: "anular", orden: o })}>
                              Anular
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setHistorial(o)}>
                            Historial
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {accion && (
        <NotaModal
          open
          titulo={accion.tipo === "rechazar" ? `Rechazar ${accion.orden.id}` : `Anular ${accion.orden.id}`}
          descripcion={
            accion.tipo === "rechazar"
              ? "Los comprobantes vuelven a Para liquidar para que se arme otra orden."
              : "Se liberan los comprobantes y se cancelan las transferencias preparadas y los cheques emitidos (se libera su reserva). Con pagos ya hechos no se puede anular."
          }
          etiquetaNota="Motivo"
          requerida
          confirmar={accion.tipo === "rechazar" ? "Rechazar orden" : "Anular orden"}
          tono="danger"
          onClose={() => setAccion(null)}
          onConfirmar={(nota) => {
            const r = accion.tipo === "rechazar" ? rechazarOrdenPago(accion.orden.id, nota) : anularOrdenPago(accion.orden.id, nota);
            return r.ok ? null : r.error;
          }}
        />
      )}

      {historial && (
        <Modal open onClose={() => setHistorial(null)} title={`Historial de ${historial.id}`} maxWidth="max-w-lg" footer={<Button variant="outline" onClick={() => setHistorial(null)}>Cerrar</Button>}>
          <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200 text-sm">
            {historial.historial.map((e, i) => (
              <li key={i} className="px-3 py-2">
                <span className="font-semibold text-ink-900">{e.evento}</span>
                <span className="text-ink-500"> · {quien(e.usuarioId)} · {e.fechaHora}</span>
                {e.detalle && <span className="block text-xs text-ink-500">{e.detalle}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-500">
            {historial.items.length} comprobantes ·{" "}
            {historial.items.map((i) => comprobanteDe(i.comprobanteId)).filter(Boolean).map((c) => (
              <span key={c!.id} className="mr-1 inline-flex align-middle"><EstadoComprobanteBadge estado={c!.estado} /></span>
            ))}
          </p>
        </Modal>
      )}
    </div>
  );
}

export function PantallaOrdenesPago() {
  const [pestana, setPestana] = useState<Pestana>("armar");
  return (
    <PaginaCaja
      seccion="Proveedores"
      titulo="Órdenes de pago"
      descripcion="Se arma y se autoriza la orden de pago: siempre de un solo proveedor, con una o varias de sus facturas ya autorizadas. El pago se hace en la Bandeja de autorizaciones."
    >
      <Banner tone="info" title="El pago se hace en la Bandeja de autorizaciones">
        Una vez autorizada, la orden queda pendiente de pago en la Bandeja (botón Proveedores), donde quien paga elige el medio (caja, cheque o transferencia) y la
        cuenta de origen, porque es quien conoce los saldos. La cuenta destino sale de la ficha del proveedor.
      </Banner>
      <div className="mt-4 space-y-4">
        <Pestanas<Pestana>
          etiqueta="Orden de pago"
          valor={pestana}
          onChange={setPestana}
          opciones={[
            ["armar", "Armar orden"],
            ["ordenes", "Órdenes"],
          ]}
        />
        {pestana === "armar" ? <Armado onArmada={() => setPestana("ordenes")} /> : <Ordenes />}
      </div>
    </PaginaCaja>
  );
}
