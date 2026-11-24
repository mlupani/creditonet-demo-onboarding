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
import { Modal } from "@/components/ui/Modal";
import { ErrorBanner, NotaModal, PaginaCaja, quien } from "@/components/caja/comunes";
import { Campo, CampoLectura, INPUT_COMPACTO, PanelVentana, TablaCompacta, Td, Th } from "@/components/caja/compacto";
import {
  EstadoComprobanteBadge,
  EstadoOrdenBadge,
  Pestanas,
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
    <PanelVentana titulo={proveedor ? `Nueva orden de pago · ${proveedor.razonSocial}` : "Nueva orden de pago"}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Campo label="Proveedor">
          <select
            id="op-proveedor"
            aria-label="Proveedor"
            value={proveedorId}
            onChange={(e) => cambiarProveedor(e.target.value)}
            className={INPUT_COMPACTO}
          >
            <option value="">Elegí el proveedor</option>
            {proveedores
              .filter((p) => p.estado === "ACTIVO")
              .map((p) => (
                <option key={p.id} value={p.id}>{`${p.razonSocial} · ${formatearCuit(p.cuit)}`}</option>
              ))}
          </select>
        </Campo>
        <CampoLectura label="Cuenta destino del proveedor">
          {proveedor ? (
            proveedor.cbu ? <span className="font-mono">{proveedor.cbu}</span> : <span className="text-warning-700">Sin CBU en la ficha</span>
          ) : (
            <span className="text-ink-400">—</span>
          )}
        </CampoLectura>
        <CampoLectura label="Moneda">ARS</CampoLectura>
      </div>
      <p className="mt-2 max-w-3xl text-[11px] leading-snug text-ink-500">
        Una orden de pago es siempre de un solo proveedor y puede incluir varias facturas de ese proveedor. Sólo se pueden tildar comprobantes en estado
        Para liquidar. Las notas de crédito restan de las facturas de la orden.
      </p>

      {proveedor && (
        <div className="mt-3 space-y-3">
          {disponibles.length === 0 ? (
            <p className="rounded-lg border border-ink-200 px-5 py-6 text-center text-xs text-ink-400">El proveedor no tiene comprobantes Para liquidar.</p>
          ) : (
            <TablaCompacta etiqueta="Comprobantes para liquidar" minWidth="min-w-[40rem]">
              <thead>
                <tr>
                  <Th className="w-8" />
                  <Th>Comprobante</Th>
                  <Th>Fecha</Th>
                  <Th>Vencimiento</Th>
                  <Th derecha>Saldo</Th>
                  <Th derecha>A pagar</Th>
                </tr>
              </thead>
              <tbody>
                {disponibles.map((c) => {
                  const tipo = tipos.find((t) => t.id === c.tipoId);
                  const item = aPagarDe(c.id);
                  const atraso = diasDeAtraso(vencimientoDe(c), hoy());
                  return (
                    <tr key={c.id} className={tildados.includes(c.id) ? "bg-brand-50/60" : undefined}>
                      <Td>
                        <input
                          type="checkbox"
                          aria-label={`Incluir ${numeroComprobante(c)}`}
                          checked={tildados.includes(c.id)}
                          onChange={() => alternar(c.id)}
                          className="h-3.5 w-3.5 rounded border-ink-300"
                        />
                      </Td>
                      <Td>
                        {tipo?.descripcion}
                        <span className="ml-1.5 font-mono text-[11px] text-ink-500">{numeroComprobante(c)}</span>
                      </Td>
                      <Td>{c.fechaComprobante}</Td>
                      <Td>
                        {vencimientoDe(c)}
                        {atraso > 0 && <span className="ml-1.5 font-semibold text-danger-700">Vencido hace {atraso} d</span>}
                      </Td>
                      <Td derecha className={esNota(c.id) ? "text-success-700" : undefined}>
                        {esNota(c.id) ? pesos(-saldoComprobante(c, pagos, ordenes)) : pesos(saldoComprobante(c, pagos, ordenes))}
                      </Td>
                      <Td derecha className="font-semibold">
                        {tildados.includes(c.id) && item ? (esNota(c.id) ? "—" : pesos(item.aPagar)) : ""}
                      </Td>
                    </tr>
                  );
                })}
                <tr>
                  <Td colSpan={5} className="bg-ink-25 font-bold">
                    Total orden de pago
                  </Td>
                  <Td derecha className="bg-ink-25 font-bold">
                    {calculo?.ok ? pesos(calculo.total) : pesos(0)}
                  </Td>
                </tr>
              </tbody>
            </TablaCompacta>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="success" disabled={!!denegado || tildados.length === 0} onClick={() => armar(false)} title={denegado ?? undefined}>
              Cerrar y enviar a autorizar
            </Button>
            <Button size="sm" variant="navyOutline" disabled={!!denegado || tildados.length === 0} onClick={() => armar(true)}>
              Grabar borrador
            </Button>
            <Button
              size="sm"
              variant="dangerOutline"
              disabled={tildados.length === 0}
              onClick={() => {
                setTildados([]);
                setError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
          {denegado && <p className="text-xs text-ink-500">{denegado}</p>}
          {calculo && !calculo.ok && <p className="text-xs font-semibold text-warning-700">{calculo.error}</p>}
          <ErrorBanner error={error} />
        </div>
      )}
    </PanelVentana>
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
        <Campo label="Estado">
          <select
            id="ord-estado"
            aria-label="Estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value as "" | EstadoOrdenPago)}
            className={INPUT_COMPACTO}
          >
            <option value="">Todos</option>
            {(Object.keys(ESTADO_ORDEN_LABEL) as EstadoOrdenPago[]).map((e) => (
              <option key={e} value={e}>
                {ESTADO_ORDEN_LABEL[e]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Proveedor">
          <select
            id="ord-proveedor"
            aria-label="Proveedor"
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            className={INPUT_COMPACTO}
          >
            <option value="">Todos</option>
            {proveedores
              .filter((p) => p.estado !== "ELIMINADO")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.razonSocial}
                </option>
              ))}
          </select>
        </Campo>
      </div>
      <ErrorBanner error={error} />

      {filas.length === 0 ? (
        <p className="rounded-lg border border-ink-200 bg-white px-5 py-6 text-center text-xs text-ink-400">No hay órdenes de pago para mostrar.</p>
      ) : (
        <TablaCompacta etiqueta="Órdenes de pago" minWidth="min-w-[56rem]">
          <thead>
            <tr>
              <Th>Orden</Th>
              <Th>Proveedor</Th>
              <Th>Comprobantes</Th>
              <Th derecha>Total</Th>
              <Th derecha>Pagado</Th>
              <Th>Armó</Th>
              <Th>Estado</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map((o) => {
              const noAutoriza = puedeAutorizarOrden(usuario, o);
              const noArma = puedeArmarOrden(usuario);
              const anulable = ["BORRADOR", "EMITIDA", "AUTORIZADA", "PENDIENTE_TRANSFERENCIA"].includes(o.estado);
              return (
                <tr key={o.id}>
                  <Td className="font-mono font-bold text-brand-700">{o.id}</Td>
                  <Td>{nombreProveedor(proveedores, o.proveedorId)}</Td>
                  <Td>
                    {o.items.length}
                    <span className="block font-mono text-[11px] text-ink-500">
                      {o.items.map((i) => { const c = comprobanteDe(i.comprobanteId); return c ? numeroComprobante(c) : i.comprobanteId; }).join(" · ")}
                    </span>
                  </Td>
                  <Td derecha className="font-semibold">{pesos(o.total)}</Td>
                  <Td derecha>{pesos(pagadoDeOrden(o.id, pagos))}</Td>
                  <Td>
                    {quien(o.armadaPor)}
                    <span className="block text-[11px] text-ink-500">{o.fechaArmado}</span>
                  </Td>
                  <Td>
                    <EstadoOrdenBadge estado={o.estado} />
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      {o.estado === "BORRADOR" && (
                        <Button size="xs" variant="successOutline" disabled={!!noArma} title={noArma ?? undefined} onClick={() => correr(emitirOrdenPago(o.id))}>
                          Cerrar y emitir
                        </Button>
                      )}
                      {o.estado === "EMITIDA" && (
                        <>
                          <Button size="xs" variant="successOutline" disabled={!!noAutoriza} title={noAutoriza ?? undefined} onClick={() => correr(autorizarOrdenPago(o.id))}>
                            Autorizar
                          </Button>
                          <Button size="xs" variant="dangerOutline" disabled={!!noAutoriza} title={noAutoriza ?? undefined} onClick={() => setAccion({ tipo: "rechazar", orden: o })}>
                            Rechazar
                          </Button>
                        </>
                      )}
                      {anulable && (
                        <Button size="xs" variant="dangerOutline" onClick={() => setAccion({ tipo: "anular", orden: o })}>
                          Anular
                        </Button>
                      )}
                      <Button size="xs" variant="navyOutline" onClick={() => setHistorial(o)}>
                        Historial
                      </Button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TablaCompacta>
      )}

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