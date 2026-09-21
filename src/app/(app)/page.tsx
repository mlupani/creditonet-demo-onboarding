"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { STEPS_ORIGINACION } from "@/lib/mocks";
import { estadoPantallasPostOferta } from "@/lib/validation";
import { coincideCliente, formatARS, formatDNI, sumarDias } from "@/lib/format";
import type { EstadoCredito } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import {
  ComentarioModal,
  EstadoSolicitudModal,
  MotivoModal,
  PosicionClienteModal,
} from "@/components/bandeja/ModalesBandeja";
import {
  IconAlertTriangle,
  IconClock,
  IconFileStack,
  IconPlus,
  IconRefresh,
  IconSearch,
} from "@/components/icons";

// Vías del canal de venta (Guía §3.1) que la demo todavía no simula.
const ACCIONES_PROXIMAS = [
  {
    id: "renovacion",
    titulo: "Precancelación / Renovación",
    descripcion: "Cancelación anticipada o renovación de créditos propios vigentes.",
    icon: IconRefresh,
  },
  {
    id: "mora",
    titulo: "Gestión de mora",
    descripcion: "Refinanciación autorizada y regularización de créditos con atraso.",
    icon: IconAlertTriangle,
  },
];

type Grupo = "TRAMITE" | "OBSERVADAS" | "ANALISIS" | "RESUELTAS";
type ModalId = "nueva" | "anular" | "posicion" | "estado" | "motivo" | "comentario";

// Secciones de la bandeja del canal de venta, en el orden en que se trabajan.
const GRUPOS: { id: Grupo; titulo: string; vacio: string }[] = [
  { id: "TRAMITE", titulo: "En trámite", vacio: "No hay solicitudes con la carga pendiente." },
  { id: "OBSERVADAS", titulo: "Observadas", vacio: "No hay observaciones del analista por tramitar." },
  { id: "ANALISIS", titulo: "En análisis", vacio: "No hay solicitudes en la bandeja del analista." },
  {
    id: "RESUELTAS",
    titulo: "Activos / Cancelados / Rechazados",
    vacio: "Todavía no hay solicitudes resueltas.",
  },
];

const GRUPO_POR_ESTADO: Record<EstadoCredito, Grupo> = {
  BORRADOR: "TRAMITE",
  EN_TRAMITE: "TRAMITE",
  OBSERVADO: "OBSERVADAS",
  PREAPROBADO: "ANALISIS",
  ANALISIS_TOMADO: "ANALISIS",
  PARA_LIQUIDAR: "RESUELTAS",
  RECHAZADO: "RESUELTAS",
  ANULADO: "RESUELTAS",
};

export default function BandejaCanalVentaPage() {
  const router = useRouter();
  const { app, paso, hidratado, reiniciarDemo, retomarObservada, anularCredito } =
    useApplication();
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState<ModalId | null>(null);

  const cliente = app.cliente;
  const identificada = app.identificacion.consultado && cliente !== null;

  const q = busqueda.trim();
  const coincide = identificada && coincideCliente(cliente!, busqueda);
  const grupoActual = GRUPO_POR_ESTADO[app.estado];

  function irASolicitud() {
    if (app.estado === "OBSERVADO") retomarObservada();
    router.push("/onboarding");
  }

  function nuevaSolicitud() {
    reiniciarDemo();
    router.push("/onboarding");
  }

  // --- Datos de la fila de la bandeja ---
  const pasoMeta = STEPS_ORIGINACION[Math.min(Math.max(paso, 1), STEPS_ORIGINACION.length) - 1];
  let detalle = "";
  let vencimiento = "";

  if (app.estado === "BORRADOR" || app.estado === "EN_TRAMITE") {
    if (app.etapa === "ORIGINACION") {
      detalle = `Originación · paso ${pasoMeta.numero} de ${STEPS_ORIGINACION.length}: ${pasoMeta.titulo}`;
    } else {
      const estados = estadoPantallasPostOferta(app);
      detalle = `Carga post-oferta · ${estados.filter((e) => e.completa).length} de ${
        estados.length
      } pantallas completas`;
    }
    if (app.fechaSolicitud)
      vencimiento = `Condiciones vigentes hasta ${sumarDias(app.fechaSolicitud, 30)}`;
  } else if (app.estado === "OBSERVADO") {
    const obs = app.analista.observacion;
    detalle = obs ? `${obs.motivo}: ${obs.nota}` : "Observada por el analista";
    if (obs) vencimiento = `Corregir antes del ${sumarDias(obs.fecha, 15)}`;
  } else if (app.estado === "PREAPROBADO" || app.estado === "ANALISIS_TOMADO") {
    detalle = app.analista.reenviada
      ? "Reenviada con correcciones · en la bandeja del analista"
      : app.estado === "ANALISIS_TOMADO"
        ? "Tomada por el analista de riesgo · en revisión"
        : "Preaprobada · pendiente de toma en la bandeja del analista";
  } else if (app.estado === "ANULADO") {
    const obs = app.analista.observacion;
    detalle = obs?.nota ? `Anulada · ${obs.nota}` : "Anulada: el cliente desistió de la operación.";
  } else if (app.estado === "PARA_LIQUIDAR") {
    detalle = "Aprobada · en la Bandeja de Liquidación (Tesorería)";
  } else if (app.estado === "RECHAZADO" && app.rechazo) {
    const { origen, codigos, motivo, fecha } = app.rechazo;
    const detalleRechazo: Record<typeof origen, string> = {
      INSTITUCIONAL: `Rechazo por regla institucional · ${codigos.join(", ")}`,
      MOTOR: `Rechazo automático del motor · ${codigos.join(", ")}`,
      SIN_LINEA: `Sin línea disponible · ${codigos.join(", ")}`,
      ANALISTA: `Rechazo del analista · ${codigos.join(", ")} ${motivo}`,
    };
    detalle = detalleRechazo[origen];
    if (origen === "MOTOR") vencimiento = `Carencia hasta ${sumarDias(fecha, 30)}`;
  }

  // Acciones de la fila según el grupo (Bandeja de solicitudes).
  const posicion = { label: "Posición cliente", onClick: () => setModal("posicion") };
  const anular = { label: "Anular", onClick: () => setModal("anular") };
  const verEstado = { label: "Ver estado", onClick: () => setModal("estado") };
  const acciones: { label: string; onClick: () => void }[] =
    grupoActual === "TRAMITE"
      ? [{ label: "Continuar carga", onClick: irASolicitud }, anular, posicion]
      : grupoActual === "OBSERVADAS"
        ? [{ label: "Tramitar observación", onClick: irASolicitud }, anular, posicion]
        : grupoActual === "ANALISIS"
          ? [verEstado, { label: "Agregar comentario", onClick: () => setModal("comentario") }, posicion]
          : [
              verEstado,
              ...(app.estado === "RECHAZADO" || app.estado === "ANULADO"
                ? [
                    {
                      label: app.estado === "ANULADO" ? "Ver motivo anulación" : "Ver motivo rechazo",
                      onClick: () => setModal("motivo"),
                    },
                  ]
                : []),
              posicion,
            ];

  const fila = (
    <div className="px-5 py-4">
      <div className="grid gap-3 md:grid-cols-[1fr_1.3fr_0.9fr_1.6fr] md:items-center md:gap-4">
        <div>
          <p className="font-mono text-sm font-bold text-brand-700">
            {app.numeroCredito ?? "Sin ID"}
          </p>
          <p className="text-[11px] text-ink-400">
            {app.numeroCredito
              ? `Solicitada ${app.fechaSolicitud ?? ""}`
              : "Se genera al presionar Solicitar"}
          </p>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-900">
            {cliente?.nombre} {cliente?.apellido}
          </p>
          <p className="text-xs text-ink-500">
            DNI {formatDNI(cliente?.dni ?? "")} · ID de Cliente {app.numeroCliente}
          </p>
        </div>
        <div>
          <EstadoBadge estado={app.estado} />
          {app.oferta.aceptada && (
            <p className="mt-1 text-[11px] tabular-nums text-ink-500">
              {formatARS(app.oferta.montoSolicitado)} · {app.oferta.plazo} cuotas
            </p>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-ink-700">{detalle}</p>
          {vencimiento && (
            <p
              className={`mt-0.5 text-[11px] font-medium ${
                app.estado === "OBSERVADO" ? "text-warning-700" : "text-ink-400"
              }`}
            >
              {vencimiento}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 md:justify-end">
        {acciones.map((a, i) => (
          <Button
            key={a.label}
            size="sm"
            variant={i === 0 ? (app.estado === "OBSERVADO" ? "primary" : "outline") : "ghost"}
            onClick={a.onClick}
          >
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="animate-fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
            Canal de venta · Módulo Onboarding
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
            Bandeja de solicitudes
          </h1>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative sm:w-72">
            <IconSearch
              width={15}
              height={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar DNI/apellido"
              aria-label="Buscar por DNI o apellido"
              className="h-10 w-full rounded-lg border border-ink-300 bg-white pl-9 pr-3 text-sm shadow-xs outline-none transition placeholder:text-ink-400 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <Button onClick={() => (identificada ? setModal("nueva") : nuevaSolicitud())}>
            <IconPlus width={16} height={16} />
            Nueva solicitud
          </Button>
        </div>
      </div>

      <div className="mt-8 space-y-7">
        {GRUPOS.map((g) => {
          const filas = hidratado && coincide && grupoActual === g.id ? 1 : 0;
          return (
            <section key={g.id} aria-label={g.titulo}>
              <div className="mb-2 flex items-center gap-2 border-b border-ink-200 pb-2">
                <h2 className="text-xs font-bold uppercase tracking-widest text-ink-700">
                  {g.titulo}
                </h2>
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-500">
                  {filas}
                </span>
              </div>
              <Card className="overflow-hidden">
                {!hidratado ? (
                  <p className="px-5 py-6 text-center text-sm text-ink-400">Cargando…</p>
                ) : filas ? (
                  fila
                ) : (
                  <p className="flex items-center justify-center gap-2 px-5 py-6 text-center text-sm text-ink-400">
                    <IconFileStack width={15} height={15} />
                    {identificada && q && !coincide
                      ? `Sin coincidencias para “${busqueda}”.`
                      : g.vacio}
                  </p>
                )}
              </Card>
            </section>
          );
        })}
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-bold tracking-tight text-ink-900">Otras vías de entrada</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {ACCIONES_PROXIMAS.map((a) => (
            <Card key={a.id} className="flex items-start gap-3 p-4 opacity-80">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-400">
                <a.icon width={20} height={20} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-ink-900">{a.titulo}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{a.descripcion}</p>
                <span className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
                  <IconClock width={12} height={12} />
                  Disponible próximamente
                </span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-6">
        <p className="text-xs text-ink-400">
          Ambiente de demostración · datos simulados · sin conexión a sistemas reales.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/analisis")}>
            <IconFileStack width={15} height={15} />
            Bandeja del analista
          </Button>
          <Button variant="ghost" size="sm" onClick={() => reiniciarDemo()}>
            Reiniciar demo
          </Button>
        </div>
      </div>

      <ConfirmationModal
        open={modal === "nueva" || modal === "anular"}
        title={modal === "nueva" ? "¿Iniciar una nueva solicitud?" : "¿Anular la solicitud?"}
        descripcion={
          modal === "nueva"
            ? "La demo maneja una solicitud por vez: la actual se reemplaza y la demo se reinicia."
            : "Se usa cuando el cliente desiste. La solicitud queda cerrada como Anulada, que no es lo mismo que un rechazo de riesgo."
        }
        rows={[
          {
            label: "Cliente",
            value: cliente ? `${cliente.nombre} ${cliente.apellido}` : "—",
          },
          { label: "Estado", value: <EstadoBadge estado={app.estado} /> },
        ]}
        confirmLabel={modal === "nueva" ? "Iniciar nueva solicitud" : "Anular solicitud"}
        cancelLabel="Volver"
        tone="danger"
        onConfirm={() => {
          const eraNueva = modal === "nueva";
          setModal(null);
          if (eraNueva) nuevaSolicitud();
          else anularCredito("Anulada por el canal de venta: el cliente desistió.");
        }}
        onCancel={() => setModal(null)}
      />
      <PosicionClienteModal open={modal === "posicion"} onClose={() => setModal(null)} />
      <EstadoSolicitudModal open={modal === "estado"} onClose={() => setModal(null)} />
      <MotivoModal open={modal === "motivo"} onClose={() => setModal(null)} />
      <ComentarioModal open={modal === "comentario"} onClose={() => setModal(null)} />
    </div>
  );
}
