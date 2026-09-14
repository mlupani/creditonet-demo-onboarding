"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { STEPS_ORIGINACION } from "@/lib/mocks";
import { estadoPantallasPostOferta } from "@/lib/validation";
import { formatARS, formatDNI, onlyDigits, sumarDias } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconClipboardPlus,
  IconClock,
  IconFileStack,
  IconRefresh,
  IconSearch,
} from "@/components/icons";

interface Accion {
  id: string;
  titulo: string;
  descripcion: string;
  icon: (props: { width?: number; height?: number }) => React.ReactNode;
  disponible: boolean;
}

// Las 3 vías directas del canal de venta (Guía §3.1).
const ACCIONES: Accion[] = [
  {
    id: "solicitar",
    titulo: "Solicitar crédito",
    descripcion:
      "Identificación, evaluación del motor de riesgo, oferta y carga post-oferta hasta el envío a análisis.",
    icon: IconClipboardPlus,
    disponible: true,
  },
  {
    id: "renovacion",
    titulo: "Precancelación / Renovación",
    descripcion: "Cancelación anticipada o renovación de créditos propios vigentes.",
    icon: IconRefresh,
    disponible: false,
  },
  {
    id: "mora",
    titulo: "Gestión de mora",
    descripcion: "Refinanciación autorizada y regularización de créditos con atraso.",
    icon: IconAlertTriangle,
    disponible: false,
  },
];

export default function BandejaCanalVentaPage() {
  const router = useRouter();
  const { app, paso, hidratado, reiniciarDemo, retomarObservada, anularCredito } =
    useApplication();
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState<"descartar" | "nueva" | null>(null);

  const cliente = app.cliente;
  const identificada = app.identificacion.consultado && cliente !== null;
  const enCurso =
    app.estado === "OBSERVADO" ||
    app.estado === "EN_TRAMITE" ||
    (app.estado === "BORRADOR" && (identificada || paso > 1));
  const cerrada = !enCurso && app.estado !== "BORRADOR";

  const q = onlyDigits(busqueda);
  const coincide =
    identificada &&
    (!q || cliente!.dni.includes(q) || onlyDigits(cliente!.cuil).includes(q));

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
  let accion: { label: string; onClick: () => void } | null = null;

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
    accion = { label: "Retomar", onClick: irASolicitud };
  } else if (app.estado === "OBSERVADO") {
    const obs = app.analista.observacion;
    detalle = obs ? `${obs.motivo}: ${obs.nota}` : "Observada por el analista";
    if (obs) vencimiento = `Corregir antes del ${sumarDias(obs.fecha, 15)}`;
    accion = { label: "Corregir y reenviar", onClick: irASolicitud };
  } else if (app.estado === "PREAPROBADO" || app.estado === "ANALISIS_TOMADO") {
    detalle = app.analista.reenviada
      ? "Reenviada con correcciones · en la bandeja del analista"
      : "Preaprobada · en la bandeja del analista de riesgo";
    accion = { label: "Ver estado", onClick: () => router.push("/onboarding") };
  } else if (app.estado === "ANULADO") {
    const obs = app.analista.observacion;
    detalle = obs?.nota ? `Anulada · ${obs.nota}` : "Anulada: el cliente desistió de la operación.";
    accion = { label: "Nueva solicitud", onClick: () => setModal("nueva") };
  } else if (app.estado === "PARA_LIQUIDAR") {
    detalle = "Aprobada · en la Bandeja de Liquidación (Tesorería)";
    accion = { label: "Ver", onClick: () => router.push("/analisis") };
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
    accion = {
      label: "Ver",
      onClick: () => router.push(origen === "ANALISTA" ? "/analisis" : "/onboarding"),
    };
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="animate-fade-up">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
          Canal de venta · Módulo Onboarding
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
          ¿Qué querés hacer?
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-500 sm:text-base">
          Elegí una de las vías de entrada. En esta demo sólo la solicitud de crédito es navegable.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {ACCIONES.map((a) => (
          <Card
            key={a.id}
            className={`flex flex-col p-5 transition ${
              a.disponible ? "hover:border-brand-300 hover:shadow-lift" : "opacity-80"
            }`}
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                a.disponible ? "bg-brand-600 text-white shadow-sm" : "bg-ink-100 text-ink-400"
              }`}
            >
              <a.icon width={21} height={21} />
            </span>
            <h2 className="mt-4 text-base font-bold tracking-tight text-ink-900">{a.titulo}</h2>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-500">{a.descripcion}</p>
            <div className="mt-4">
              {a.disponible ? (
                <Button
                  onClick={() => (cerrada ? setModal("nueva") : irASolicitud())}
                  className="w-full"
                >
                  {enCurso ? "Continuar solicitud" : cerrada ? "Nueva solicitud" : "Comenzar"}
                  <IconArrowRight width={16} height={16} />
                </Button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-xs font-semibold text-ink-400">
                  <IconClock width={13} height={13} />
                  Disponible próximamente
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-ink-900">Mis solicitudes</h2>
            <p className="text-sm text-ink-500">
              Buscá por DNI o CUIL para retomar una carga incompleta.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <IconSearch
              width={15}
              height={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <input
              type="text"
              inputMode="numeric"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por DNI o CUIL"
              aria-label="Buscar por DNI o CUIL"
              className="w-full rounded-lg border border-ink-300 bg-white py-2 pl-9 pr-3 text-sm shadow-xs outline-none transition placeholder:text-ink-400 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>

        <Card className="mt-4 overflow-hidden">
          <div className="hidden grid-cols-[1fr_1.3fr_0.9fr_1.6fr_auto] gap-4 border-b border-ink-100 bg-ink-25 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400 md:grid">
            <span>ID de Crédito</span>
            <span>Cliente</span>
            <span>Estado</span>
            <span>Detalle</span>
            <span className="w-40" />
          </div>

          {!hidratado ? (
            <p className="px-5 py-8 text-center text-sm text-ink-400">Cargando…</p>
          ) : !identificada ? (
            <div className="px-5 py-10 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-ink-100 text-ink-400">
                <IconFileStack width={20} height={20} />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink-700">Todavía no hay solicitudes</p>
              <p className="mt-1 text-xs text-ink-500">
                Iniciá una desde <strong>Solicitar crédito</strong>.
              </p>
            </div>
          ) : !coincide ? (
            <p className="px-5 py-8 text-center text-sm text-ink-500">
              No hay solicitudes para el documento <strong>{busqueda}</strong>.
            </p>
          ) : (
            <div className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_1.3fr_0.9fr_1.6fr_auto] md:items-center md:gap-4">
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
                  {cliente!.nombre} {cliente!.apellido}
                </p>
                <p className="text-xs text-ink-500">
                  DNI {formatDNI(cliente!.dni)} · ID de Cliente {app.numeroCliente}
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
              <div className="flex gap-2 md:w-40 md:flex-col md:items-stretch">
                {accion && (
                  <Button
                    size="sm"
                    variant={app.estado === "OBSERVADO" ? "primary" : "outline"}
                    onClick={accion.onClick}
                  >
                    {accion.label}
                  </Button>
                )}
                {enCurso && (
                  <Button size="sm" variant="ghost" onClick={() => setModal("descartar")}>
                    Anular
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
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
        open={modal !== null}
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
    </div>
  );
}
