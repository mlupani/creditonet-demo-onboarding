"use client";

import { useState, type ReactNode } from "react";
import { useApplication } from "@/lib/application-context";
import { formatARS, formatDNI } from "@/lib/format";
import { historialCredito, textoChequeo } from "@/lib/historial";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { EstadoBadge } from "@/components/ui/StatusBadge";

interface ModalProps {
  open: boolean;
  onClose: () => void;
}

export function Filas({ filas }: { filas: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-ink-100 rounded-xl border border-ink-200 bg-ink-25">
      {filas.map((f) => (
        <div key={f.label} className="flex items-start justify-between gap-4 px-4 py-2.5">
          <dt className="text-sm text-ink-500">{f.label}</dt>
          <dd className="text-right text-sm font-semibold text-ink-900">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mt-5">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
        {titulo}
      </h4>
      {children}
    </div>
  );
}

export function CerrarFooter({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex justify-end">
      <Button variant="outline" onClick={onClose}>
        Cerrar
      </Button>
    </div>
  );
}

// Posición del cliente: quién es, cómo está frente a la financiera y qué exposición tiene.
export function PosicionClienteModal({ open, onClose }: ModalProps) {
  const { app } = useApplication();
  const c = app.cliente;
  if (!c) return null;
  const { creditosActivos, deudaTerceros } = app.oferta;
  const limites = app.riesgo.limites;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Posición del cliente"
      footer={<CerrarFooter onClose={onClose} />}
    >
      <Filas
        filas={[
          { label: "Cliente", value: `${c.nombre} ${c.apellido}` },
          { label: "DNI", value: formatDNI(c.dni) },
          { label: "ID de Cliente", value: app.numeroCliente ?? "—" },
          {
            label: "Tipo de cliente",
            value: app.identificacion.tipoCliente === "EXISTENTE" ? "Existente" : "Nuevo",
          },
          ...(app.situaciones
            ? [
                { label: "Situación BCRA", value: app.situaciones.bcra },
                { label: "Situación interna", value: app.situaciones.interna },
              ]
            : []),
        ]}
      />

      <Seccion titulo="Créditos vigentes">
        {creditosActivos.length === 0 ? (
          <p className="rounded-xl border border-ink-200 bg-ink-25 px-4 py-3 text-sm text-ink-500">
            El cliente no tiene créditos propios vigentes.
          </p>
        ) : (
          <ul className="space-y-2">
            {creditosActivos.map((cr) => (
              <li
                key={cr.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-ink-200 px-4 py-2.5"
              >
                <div>
                  <p className="font-mono text-sm font-bold text-brand-700">{cr.id}</p>
                  <p className="text-xs text-ink-500">
                    Cuota {cr.cuotasAbonadas} de {cr.cuotasOriginales} ·{" "}
                    {formatARS(cr.valorCuota)}
                    {cr.enMora && <span className="font-semibold text-danger-700"> · En mora</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-ink-900">
                    {formatARS(cr.capitalResidual)}
                  </p>
                  <p className="text-[11px] text-ink-400">capital residual</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion titulo="Exposición">
        <Filas
          filas={[
            { label: "Cuotas vigentes", value: formatARS(limites?.cuotasVigentes ?? 0) },
            {
              label: "Deuda con terceros",
              value: deudaTerceros.habilitado
                ? `${formatARS(deudaTerceros.importe)} · ${deudaTerceros.entidad || "—"}`
                : "Sin deuda declarada",
            },
            { label: "Ingreso neto declarado", value: formatARS(app.laboral.ingresoNeto) },
          ]}
        />
      </Seccion>
    </Modal>
  );
}

// Ver estado: recorrido de la solicitud y comentarios cargados.
export function EstadoSolicitudModal({ open, onClose }: ModalProps) {
  const { app } = useApplication();
  const enAnalisis = app.estado === "PREAPROBADO" || app.estado === "ANALISIS_TOMADO";
  const historial = historialCredito(app);
  const resolucion =
    app.estado === "PARA_LIQUIDAR" ||
    app.estado === "EN_FIRMA" ||
    app.estado === "FIRMADO" ||
    app.estado === "CHEQUEO_TELEFONICO"
      ? { label: "Aprobada", fecha: app.fechaAprobacion }
      : app.estado === "RECHAZADO"
        ? { label: "Rechazada", fecha: app.rechazo?.fecha }
        : app.estado === "ANULADO"
          ? { label: "Anulada", fecha: app.analista.observacion?.fecha }
          : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Estado de la solicitud"
      footer={<CerrarFooter onClose={onClose} />}
    >
      <Filas
        filas={[
          { label: "ID de Crédito", value: app.numeroCredito ?? "Sin ID" },
          { label: "Estado", value: <EstadoBadge estado={app.estado} /> },
          ...(app.oferta.aceptada
            ? [
                {
                  label: "Oferta",
                  value: `${formatARS(app.oferta.montoSolicitado)} · ${app.oferta.plazo} cuotas`,
                },
              ]
            : []),
          ...(app.fechaSolicitud ? [{ label: "Solicitada", value: app.fechaSolicitud }] : []),
          ...(app.fechaEnvioAnalisis
            ? [
                {
                  label: app.analista.reenviada ? "Reenviada a análisis" : "Enviada a análisis",
                  value: app.fechaEnvioAnalisis,
                },
              ]
            : []),
          ...(app.analista.cambioOfertaPendiente
            ? [{ label: "Cambio de oferta", value: "Pendiente de refrendación del supervisor" }]
            : []),
          ...(enAnalisis
            ? [
                {
                  label: "Analista",
                  value: app.analista.tomado ? "Tomada, en revisión" : "Pendiente de toma",
                },
              ]
            : []),
          ...(resolucion?.fecha ? [{ label: resolucion.label, value: resolucion.fecha }] : []),
          ...(app.chequeoTelefonico
            ? [{ label: "Chequeo telefónico", value: textoChequeo(app.chequeoTelefonico) }]
            : []),
        ]}
      />

      {historial.length > 0 && (
        <Seccion titulo="Historial">
          <ul className="space-y-1.5">
            {historial.map((e, i) => (
              <li key={`${e.etiqueta}-${i}`} className="flex items-baseline justify-between gap-4 text-sm">
                <span className="text-ink-600">{e.etiqueta}</span>
                <span className="font-semibold tabular-nums text-ink-900">{e.fecha}</span>
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      {app.comentarios.length > 0 && <ListaComentarios titulo="Comentarios" />}
    </Modal>
  );
}

export function ListaComentarios({ titulo }: { titulo: string }) {
  const { app } = useApplication();
  return (
    <Seccion titulo={titulo}>
      <ul className="space-y-2">
        {app.comentarios.map((cm) => (
          <li key={cm.id} className="rounded-xl border border-ink-200 px-4 py-2.5">
            <p className="text-sm text-ink-800">{cm.texto}</p>
            <p className="mt-1 text-[11px] text-ink-400">
              {cm.autor} · {cm.fecha}
            </p>
          </li>
        ))}
      </ul>
    </Seccion>
  );
}

const ORIGEN_RECHAZO = {
  INSTITUCIONAL: "Regla institucional",
  MOTOR: "Motor de riesgo",
  SIN_LINEA: "Sin línea disponible",
  ANALISTA: "Analista de riesgo",
  CHEQUEADOR: "Chequeo telefónico",
} as const;

// Motivo de un cierre negativo: rechazo (riesgo) o anulación (el cliente desistió).
export function MotivoModal({ open, onClose }: ModalProps) {
  const { app } = useApplication();
  const rechazo = app.rechazo;
  const anulada = app.estado === "ANULADO";
  const obs = app.analista.observacion;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={anulada ? "Motivo de anulación" : "Motivo de rechazo"}
      footer={<CerrarFooter onClose={onClose} />}
    >
      {anulada ? (
        <Filas
          filas={[
            { label: "Fecha", value: obs?.fecha ?? "—" },
            { label: "Detalle", value: obs?.nota || "El cliente desistió de la operación." },
          ]}
        />
      ) : rechazo ? (
        <Filas
          filas={[
            { label: "Origen", value: ORIGEN_RECHAZO[rechazo.origen] },
            { label: "Códigos", value: rechazo.codigos.join(", ") || "—" },
            { label: "Motivo", value: rechazo.motivo },
            ...(rechazo.observacion
              ? [{ label: "Observación", value: rechazo.observacion }]
              : []),
            { label: "Fecha", value: rechazo.fecha },
          ]}
        />
      ) : (
        <p className="text-sm text-ink-500">La solicitud no registra un motivo de rechazo.</p>
      )}
    </Modal>
  );
}

// `autor` distingue al analista del canal de venta; `paraQuien` ajusta el texto de ayuda.
export function ComentarioModal({
  open,
  onClose,
  autor,
  paraQuien = "el analista de riesgo",
}: ModalProps & { autor?: string; paraQuien?: string }) {
  const { app, agregarComentario } = useApplication();
  const [texto, setTexto] = useState("");

  function cerrar() {
    setTexto("");
    onClose();
  }

  function guardar() {
    const limpio = texto.trim();
    if (!limpio) return;
    agregarComentario(limpio, autor);
    cerrar();
  }

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title="Agregar comentario"
      maxWidth="max-w-md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!texto.trim()}>
            Guardar comentario
          </Button>
        </div>
      }
    >
      <p className="text-sm text-ink-600">
        El comentario queda asociado a la solicitud {app.numeroCredito} y lo ve {paraQuien}.
      </p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={4}
        autoFocus
        placeholder="Escribí el comentario para el analista…"
        aria-label="Comentario"
        className="mt-3 w-full resize-none rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm shadow-xs outline-none transition placeholder:text-ink-400 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      {app.comentarios.length > 0 && <ListaComentarios titulo="Comentarios previos" />}
    </Modal>
  );
}
