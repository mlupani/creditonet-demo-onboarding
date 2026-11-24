"use client";

import { useState } from "react";
import { esResponsable, esSupervisor, puedeAprobar } from "@/lib/caja-reglas";
import { autorizarMovimiento, errorAutorizarMovimiento, nombreCaja, origenTexto, posicionDeCaja } from "@/lib/caja-operaciones";
import { nombreUsuario, useCajaDatos } from "@/lib/caja-store";
import { formatNumber } from "@/lib/format";
import { monedasDe, type Caja, type MovimientoTesoreria, type PedidoRefuerzo, type UsuarioCaja } from "@/lib/caja-tipos";
import { Button } from "@/components/ui/Button";
import { IconPlus, IconSearch } from "@/components/icons";
import { aError } from "./Jornada";
import {
  BoletaModal,
  DetalleMovimientoModal,
  DocumentarModal,
  EnviarModal,
  ExtraccionModal,
  NuevoMovimientoModal,
  PedidoModal,
  RecibirModal,
  ResolverIncidenciaModal,
  ResolverPedidoModal,
  destinoTexto,
  estadoTexto,
} from "./TesoreriaModales";
import { INPUT_COMPACTO, PanelVentana, Pill, TablaCompacta, Td, Th, type Fase } from "./compacto";
import { NotaModal, PaginaCaja, SelectorCaja, cajasPropias, descargarXlsx, dinero, sinAcentos } from "./comunes";

type Seccion = "realizados" | "recibidos" | "autorizar" | "transito" | "recibir" | "incidencia" | "finalizados";

const SECCIONES: { id: Seccion; label: string }[] = [
  { id: "realizados", label: "Pedidos realizados" },
  { id: "recibidos", label: "Pedidos recibidos" },
  { id: "autorizar", label: "Por autorizar" },
  { id: "transito", label: "Enviados en tránsito" },
  { id: "recibir", label: "Por recibir" },
  { id: "incidencia", label: "Con incidencia" },
  { id: "finalizados", label: "Finalizados" },
];

const FASE: Record<string, Fase> = {
  SOLICITADO: "inicial",
  AUTORIZADO: "espera",
  RECHAZADO: "rechazo",
  EN_TRANSITO: "proceso",
  CON_INCIDENCIA: "espera",
  ACEPTADO: "proceso",
  FINALIZADO: "ok",
};

type Modal =
  | { tipo: "nuevo" }
  | { tipo: "pedido" }
  | { tipo: "pedido-resolver"; pedido: PedidoRefuerzo }
  | { tipo: "enviar" | "recibir" | "incidencia" | "boleta" | "detalle" | "autorizar" | "rechazar" | "extraccion" | "documentar"; mov: MovimientoTesoreria };

// Contenido de Movimientos de tesorería (remesas, refuerzos, retiros, depósitos y pases). Lo muestra la
// Bandeja, que ya pone la barra de usuario y el encabezado; `cajaId` preselecciona la caja.
export function PanelRemesas({ cajaId: cajaInicial }: { cajaId?: string } = {}) {
  const { cajas, movimientos, pedidos, usuario } = useCajaDatos();
  const supervisa = esSupervisor(usuario);
  const visibles: Caja[] = supervisa ? cajas.filter((c) => c.estado === "ACTIVO") : cajasPropias(cajas, usuario);
  const [elegida, setElegida] = useState<string | null>(cajaInicial ?? null);
  const cajaId = elegida !== null && (elegida === "" ? supervisa : visibles.some((c) => c.id === elegida)) ? elegida : supervisa ? "" : (visibles[0]?.id ?? "");
  const [seccion, setSeccion] = useState<Seccion>("autorizar");
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState<Modal | null>(null);

  const todo = supervisa && !cajaId;
  const cajaActual = cajas.find((c) => c.id === cajaId);
  const toca = (m: MovimientoTesoreria) =>
    todo || m.origenId === cajaId || (m.destino.tipo === "CAJA" && m.destino.cajaId === cajaId);
  const delOrigen = (m: MovimientoTesoreria) => todo || m.origenId === cajaId;
  const delDestino = (m: MovimientoTesoreria) => m.destino.tipo === "CAJA" && (todo || m.destino.cajaId === cajaId);

  const filtroMov: Record<Exclude<Seccion, "realizados" | "recibidos">, (m: MovimientoTesoreria) => boolean> = {
    autorizar: (m) => m.estado === "SOLICITADO" && toca(m),
    // Un pedido a banco en tránsito ya está por recibir en el tesoro: no figura como enviado.
    transito: (m) => ((m.estado === "EN_TRANSITO" && !m.origenBancoId) || m.estado === "AUTORIZADO") && delOrigen(m),
    recibir: (m) => m.estado === "EN_TRANSITO" && delDestino(m),
    incidencia: (m) => m.estado === "CON_INCIDENCIA" && toca(m),
    finalizados: (m) => (m.estado === "ACEPTADO" || m.estado === "FINALIZADO" || m.estado === "RECHAZADO") && toca(m),
  };
  const q = sinAcentos(busqueda.trim());
  const coincideMov = (m: MovimientoTesoreria) =>
    !q || sinAcentos(`${m.id} ${m.fechaSolicitud} ${origenTexto(m)} ${destinoTexto(m)} ${m.importe} ${formatNumber(m.importe)} ${m.motivo}`).includes(q);
  const coincidePedido = (p: PedidoRefuerzo) =>
    !q || sinAcentos(`${p.id} ${p.fecha} ${nombreCaja(p.solicitanteCajaId)} ${nombreCaja(p.aCajaId)} ${p.importe} ${formatNumber(p.importe)}`).includes(q);

  const pedidosRealizados = pedidos.filter((p) => todo || p.solicitanteCajaId === cajaId);
  const pedidosRecibidos = pedidos.filter((p) => todo || p.aCajaId === cajaId);
  const contador = (s: Seccion) =>
    s === "realizados"
      ? pedidosRealizados.filter((p) => p.estado === "PENDIENTE").length
      : s === "recibidos"
        ? pedidosRecibidos.filter((p) => p.estado === "PENDIENTE").length
        : movimientos.filter(filtroMov[s]).length;

  const esPedidos = seccion === "realizados" || seccion === "recibidos";
  const filasMov = esPedidos ? [] : movimientos.filter(filtroMov[seccion]).filter(coincideMov);
  const filasPedido = (seccion === "realizados" ? pedidosRealizados : seccion === "recibidos" ? pedidosRecibidos : []).filter(coincidePedido);

  const exportar = () => {
    const cab = ["ID", "Fecha", "Tipo", "Origen", "Destino", "Moneda", "Importe", "Estado", "Solicitante", "Motivo"];
    descargarXlsx("movimientos-tesoreria.xlsx", "Movimientos", [
      cab,
      ...(esPedidos
        ? filasPedido.map((p) => [p.id, p.fecha, "Pedido de refuerzo", nombreCaja(p.solicitanteCajaId), nombreCaja(p.aCajaId), p.moneda, String(p.importe), p.estado, nombreUsuario(p.usuarioId), p.motivo])
        : filasMov.map((m) => [m.id, m.fechaSolicitud, m.tipoId, origenTexto(m), destinoTexto(m), m.moneda, String(m.importe), estadoTexto(m), nombreUsuario(m.solicitanteId), m.motivo])),
    ]);
  };

  const acciones = (m: MovimientoTesoreria, u: UsuarioCaja) => {
    const origen = cajas.find((c) => c.id === m.origenId);
    const destino = m.destino.tipo === "CAJA" ? cajas.find((c) => c.id === (m.destino as { cajaId: string }).cajaId) : undefined;
    return (
      <div className="flex flex-wrap gap-1.5">
        {m.estado === "SOLICITADO" && errorAutorizarMovimiento(m, u) === null && (
          <>
            <Button size="xs" variant="success" onClick={() => setModal({ tipo: "autorizar", mov: m })}>
              Autorizar
            </Button>
            <Button size="xs" variant="dangerOutline" onClick={() => setModal({ tipo: "rechazar", mov: m })}>
              Rechazar
            </Button>
          </>
        )}
        {m.estado === "AUTORIZADO" && origen && !m.origenBancoId && esResponsable(origen, u.id) && (
          <Button size="xs" variant="successOutline" onClick={() => setModal({ tipo: "enviar", mov: m })}>
            Enviar
          </Button>
        )}
        {m.estado === "AUTORIZADO" && origen && m.origenBancoId && esResponsable(origen, u.id) && (
          <Button size="xs" variant="successOutline" onClick={() => setModal({ tipo: "extraccion", mov: m })}>
            Registrar extracción
          </Button>
        )}
        {m.estado === "ACEPTADO" && (esSupervisor(u) || (origen && esResponsable(origen, u.id)) || (destino && esResponsable(destino, u.id))) && (
          <Button size="xs" variant="navyOutline" onClick={() => setModal({ tipo: "documentar", mov: m })}>
            Documentar
          </Button>
        )}
        {m.estado === "EN_TRANSITO" && destino && esResponsable(destino, u.id) && (
          <Button size="xs" variant="successOutline" onClick={() => setModal({ tipo: "recibir", mov: m })}>
            Recibir
          </Button>
        )}
        {m.estado === "EN_TRANSITO" && m.destino.tipo === "BANCO" && origen && esResponsable(origen, u.id) && (
          <Button size="xs" variant="successOutline" onClick={() => setModal({ tipo: "boleta", mov: m })}>
            Cargar boleta
          </Button>
        )}
        {m.estado === "CON_INCIDENCIA" && puedeAprobar(u, m.solicitanteId) && u.id !== m.recepcion?.usuarioId && (
          <Button size="xs" variant="successOutline" onClick={() => setModal({ tipo: "incidencia", mov: m })}>
            Resolver
          </Button>
        )}
        <Button size="xs" variant="navyOutline" onClick={() => setModal({ tipo: "detalle", mov: m })}>
          Detalle
        </Button>
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <SelectorCaja cajas={visibles} valor={cajaId} onChange={setElegida} todas={supervisa ? "Todas las cajas" : undefined} />
        <Button size="sm" variant="success" onClick={() => setModal({ tipo: "nuevo" })}>
          <IconPlus width={14} height={14} />
          Nuevo movimiento
        </Button>
        <Button size="sm" variant="brandOutline" onClick={() => setModal({ tipo: "pedido" })}>
          Nuevo pedido de refuerzo
        </Button>
        <Button size="sm" variant="navyOutline" onClick={exportar}>
          Exportar a Excel
        </Button>
        <div className="relative w-full sm:w-72">
          <IconSearch width={14} height={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por ID, fecha, origen, destino o importe…"
            aria-label="Buscar movimientos"
            className={`${INPUT_COMPACTO} bg-white pl-8`}
          />
        </div>
      </div>

      {cajaActual && (
        <PanelVentana titulo={`Fondos de ${cajaActual.nombre}`} className="mt-3">
          <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {monedasDe(cajaActual.moneda).map((m) => {
              // Real, comprometido y estimado (R3): el estimado manda, y lo que viene en camino es sólo informativo.
              const p = posicionDeCaja(cajaActual.id, m);
              const minimo = cajaActual.minimoOperativo?.[m] ?? 0;
              return (
                <dl key={m} className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-5">
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-500">Real</dt>
                    <dd className="text-xs font-bold tabular-nums text-ink-900">{dinero(m, p.real)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-500">Comprometido</dt>
                    <dd className="text-xs font-bold tabular-nums text-ink-900">{dinero(m, p.comprometido)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-500">Estimado</dt>
                    <dd className={`text-xs font-bold tabular-nums ${p.estimado <= minimo ? "text-danger-700" : "text-success-700"}`}>{dinero(m, p.estimado)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-500">A recibir</dt>
                    <dd className="text-xs font-bold tabular-nums text-ink-500">{dinero(m, p.aRecibir)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-500">Mínimo operativo</dt>
                    <dd className="text-xs font-bold tabular-nums text-ink-900">{dinero(m, minimo)}</dd>
                  </div>
                </dl>
              );
            })}
          </div>
        </PanelVentana>
      )}

      <div role="tablist" className="mt-3 flex flex-wrap gap-1">
        {SECCIONES.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={seccion === s.id}
            onClick={() => setSeccion(s.id)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition ${seccion === s.id ? "border-navy-800 bg-navy-800 text-white" : "border-ink-300 bg-white text-ink-600 hover:bg-ink-100"}`}
          >
            {s.label}
            <span className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${seccion === s.id ? "bg-white/20 text-white" : "bg-ink-100 text-ink-600"}`}>{contador(s.id)}</span>
          </button>
        ))}
      </div>

      <div className="mt-2">
        {esPedidos ? (
          filasPedido.length === 0 ? (
            <PanelVentana titulo={SECCIONES.find((s) => s.id === seccion)?.label}>
              <p className="py-3 text-center text-xs text-ink-400">No hay pedidos en esta sección.</p>
            </PanelVentana>
          ) : (
            <TablaCompacta etiqueta="Pedidos de refuerzo" minWidth="min-w-[48rem]">
              <thead>
                <tr>
                  <Th>ID</Th>
                  <Th>Fecha</Th>
                  <Th>Pide</Th>
                  <Th>A</Th>
                  <Th derecha>Importe</Th>
                  <Th>Estado</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {filasPedido.map((p) => {
                  const aCaja = cajas.find((c) => c.id === p.aCajaId);
                  return (
                    <tr key={p.id}>
                      <Td className="font-mono font-bold text-brand-700">{p.id}</Td>
                      <Td className="tabular-nums">{p.fecha}</Td>
                      <Td>{nombreCaja(p.solicitanteCajaId)}</Td>
                      <Td>{nombreCaja(p.aCajaId)}</Td>
                      <Td derecha>
                        {dinero(p.moneda, p.importe)}
                        {p.importeAprobado !== undefined && p.importeAprobado !== p.importe && <span className="block text-[11px] text-ink-500">aprobado {dinero(p.moneda, p.importeAprobado)}</span>}
                      </Td>
                      <Td>
                        <Pill fase={p.estado === "APROBADO" ? "ok" : p.estado === "RECHAZADO" ? "rechazo" : "espera"}>
                          {p.estado === "APROBADO" ? (p.movimientoId ? `Aprobado · ${p.movimientoId}` : "Aprobado") : p.estado === "RECHAZADO" ? "Rechazado" : "Pendiente"}
                        </Pill>
                      </Td>
                      <Td derecha>
                        {p.estado === "PENDIENTE" && aCaja && esResponsable(aCaja, usuario.id) && (
                          <Button size="xs" variant="success" onClick={() => setModal({ tipo: "pedido-resolver", pedido: p })}>
                            Resolver
                          </Button>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TablaCompacta>
          )
        ) : filasMov.length === 0 ? (
          <PanelVentana titulo={SECCIONES.find((s) => s.id === seccion)?.label}>
            <p className="py-3 text-center text-xs text-ink-400">No hay movimientos en esta sección.</p>
          </PanelVentana>
        ) : (
          <TablaCompacta etiqueta="Movimientos de tesorería" minWidth="min-w-[60rem]">
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Fecha</Th>
                <Th>Origen</Th>
                <Th>Destino</Th>
                <Th derecha>Importe</Th>
                <Th>Estado</Th>
                <Th>Acciones según estado</Th>
              </tr>
            </thead>
            <tbody>
              {filasMov.map((m) => (
                <tr key={m.id}>
                  <Td className="font-mono font-bold text-brand-700">{m.id}</Td>
                  <Td className="tabular-nums">{m.fechaSolicitud}</Td>
                  <Td>{origenTexto(m)}</Td>
                  <Td>{destinoTexto(m)}</Td>
                  <Td derecha>{dinero(m.moneda, m.importe)}</Td>
                  <Td>
                    <Pill fase={FASE[m.estado] ?? "inicial"}>{estadoTexto(m)}</Pill>
                    {m.estado === "AUTORIZADO" && (
                      <span className="mt-0.5 block text-[11px] text-ink-500">Listo para enviar · Reservado: {dinero(m.moneda, m.importe)}</span>
                    )}
                  </Td>
                  <Td>{acciones(m, usuario)}</Td>
                </tr>
              ))}
            </tbody>
          </TablaCompacta>
        )}
      </div>

      {modal?.tipo === "nuevo" && <NuevoMovimientoModal cajaInicial={cajaId} onClose={() => setModal(null)} />}
      {modal?.tipo === "pedido" && <PedidoModal cajaId={cajaId} onClose={() => setModal(null)} />}
      {modal?.tipo === "pedido-resolver" && <ResolverPedidoModal pedido={modal.pedido} onClose={() => setModal(null)} />}
      {modal?.tipo === "enviar" && <EnviarModal mov={modal.mov} onClose={() => setModal(null)} />}
      {modal?.tipo === "recibir" && <RecibirModal mov={modal.mov} onClose={() => setModal(null)} />}
      {modal?.tipo === "incidencia" && <ResolverIncidenciaModal mov={modal.mov} onClose={() => setModal(null)} />}
      {modal?.tipo === "boleta" && <BoletaModal mov={modal.mov} onClose={() => setModal(null)} />}
      {modal?.tipo === "extraccion" && <ExtraccionModal mov={modal.mov} onClose={() => setModal(null)} />}
      {modal?.tipo === "documentar" && <DocumentarModal mov={modal.mov} onClose={() => setModal(null)} />}
      {modal?.tipo === "detalle" && <DetalleMovimientoModal mov={modal.mov} onClose={() => setModal(null)} />}
      <NotaModal
        open={modal?.tipo === "autorizar" || modal?.tipo === "rechazar"}
        titulo={modal?.tipo === "autorizar" ? "Autorizar el movimiento" : "Rechazar el movimiento"}
        descripcion={
          modal?.tipo === "autorizar"
            ? "Sin autorización no sale el dinero. Al autorizar se reserva el importe en el origen y se firma con tu llave de autorización."
            : "Un movimiento rechazado no mueve dinero."
        }
        etiquetaNota={modal?.tipo === "rechazar" ? "Motivo del rechazo" : "Nota (opcional)"}
        requerida={modal?.tipo === "rechazar"}
        confirmar={modal?.tipo === "autorizar" ? "Autorizar" : "Rechazar"}
        tono={modal?.tipo === "autorizar" ? "success" : "danger"}
        llave={
          modal?.tipo === "autorizar"
            ? {
                operacion: "Autorización de movimiento de tesorería",
                referencia: modal.mov.id,
                importe: modal.mov.importe,
                moneda: modal.mov.moneda,
                cargadoPor: modal.mov.solicitanteId,
              }
            : undefined
        }
        onClose={() => setModal(null)}
        onConfirmar={(nota, firmaId) => {
          if (modal?.tipo !== "autorizar" && modal?.tipo !== "rechazar") return null;
          return aError(autorizarMovimiento(modal.mov.id, modal.tipo === "autorizar", nota, firmaId));
        }}
      />
    </div>
  );
}

export function PantallaTesoreria() {
  return (
    <PaginaCaja
      titulo="Movimientos de tesorería"
      seccion="Bandeja de autorizaciones"
      descripcion="Bandeja única para todo traslado de fondos entre tesoros, cajas y bancos: remesas, refuerzos, retiros, depósitos y pases entre cajeros."
    >
      <PanelRemesas />
    </PaginaCaja>
  );
}