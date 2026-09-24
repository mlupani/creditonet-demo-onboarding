"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApplication } from "@/lib/application-context";
import { etiquetaObservado } from "@/lib/credit";
import { STEPS_ORIGINACION } from "@/lib/mocks";
import { estadoPantallasPostOferta } from "@/lib/validation";
import { coincideCliente, formatARS, formatDNI, sumarDias } from "@/lib/format";
import { textoChequeo } from "@/lib/historial";
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
import type { CreditApplication } from "@/lib/types";
import {
  IconAlertTriangle,
  IconChevronDown,
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
  CAMBIO_OFERTA: "OBSERVADAS",
  PREAPROBADO: "ANALISIS",
  ANALISIS_TOMADO: "ANALISIS",
  EN_FIRMA: "RESUELTAS",
  FIRMADO: "RESUELTAS",
  CHEQUEO_TELEFONICO: "RESUELTAS",
  PARA_LIQUIDAR: "RESUELTAS",
  RECHAZADO: "RESUELTAS",
  ANULADO: "RESUELTAS",
};

export default function BandejaCanalVentaPage() {
  const router = useRouter();
  const {
    app,
    creditosDB,
    cargarCreditoDeDB,
    paso,
    hidratado,
    reiniciarDemo,
    retomarObservada,
    anularCredito,
    setPaso,
    setPantallaActual,
  } = useApplication();
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState<ModalId | null>(null);
  const [colapsados, setColapsados] = useState<Record<Grupo, boolean>>({
    TRAMITE: false,
    OBSERVADAS: true,
    ANALISIS: true,
    RESUELTAS: true,
  });
  const [pagina, setPagina] = useState<Record<Grupo, number>>({
    TRAMITE: 1,
    OBSERVADAS: 1,
    ANALISIS: 1,
    RESUELTAS: 1,
  });
  const POR_PAGINA = 5;

  const cliente = app.cliente;
  const identificada = app.identificacion.consultado && cliente !== null;

  const q = busqueda.trim();

  useEffect(() => {
    setPagina({ TRAMITE: 1, OBSERVADAS: 1, ANALISIS: 1, RESUELTAS: 1 });
  }, [q]);

  function toggleColapso(g: Grupo) {
    setColapsados((prev) => ({ ...prev, [g]: !prev[g] }));
  }

  function irASolicitud() {
    if (app.estado === "OBSERVADO") retomarObservada();
    router.push("/onboarding");
  }

  function nuevaSolicitud() {
    reiniciarDemo();
    router.push("/onboarding");
  }

  function abrirCreditoDB(cred: (typeof creditosDB)[number]) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _bandeja, _descripcion, _id, ...rest } = cred as unknown as Record<string, unknown>;
    const data = rest as unknown as CreditApplication;
    cargarCreditoDeDB(cred._id);
    // Derivar paso/pantalla según etapa para que /onboarding muestre la pantalla correcta
    if (data.etapa === "POST_OFERTA") {
      // En post-oferta la navegación usa pantallas, no paso de originación
      // Buscar primera pantalla incompleta o dejar la primera
      const estados = estadoPantallasPostOferta(data);
      const primeraIncompleta = estados.find((e) => !e.completa);
      if (primeraIncompleta) setPantallaActual(primeraIncompleta.id);
      else setPantallaActual("personales");
    } else if (data.etapa === "ORIGINACION") {
      // Originación: estimar paso según datos
      if (data.riesgo.estado === "COMPLETO" && data.oferta.planId) setPaso(6);
      else if (data.laboral.ingresoNeto > 0) setPaso(5);
      else if (data.identidadVerificada) setPaso(4);
      else if (data.configuracion.productoId) setPaso(3);
      else setPaso(1);
    }
    // OBSERVADO se retoma como POST_OFERTA al continuar
    if (data.estado === "OBSERVADO") {
      // patch ya dejó estado OBSERVADO, retomarObservada lo pasa a POST_OFERTA al clic
      // No hacemos retomar aquí, lo hará irASolicitud al continuar
    }
    router.push("/onboarding");
  }

  // Acciones de la bandeja sobre una fila: la cargan como solicitud en curso y abren el
  // modal (los modales y anular/comentar operan sobre `app`). Navegar al onboarding, en
  // cambio, sigue por `abrirCreditoDB`.
  function actuar(
    cred: (typeof creditosDB)[number],
    modalId: Extract<ModalId, "anular" | "posicion" | "estado" | "motivo" | "comentario">
  ) {
    cargarCreditoDeDB(cred._id);
    setModal(modalId);
  }

  function detallePara(c: CreditApplication, pasoActual: number) {
    const pasoMeta = STEPS_ORIGINACION[Math.min(Math.max(pasoActual, 1), STEPS_ORIGINACION.length) - 1];
    if (c.estado === "BORRADOR" || (c.estado === "EN_TRAMITE" && c.etapa === "ORIGINACION")) {
      if (!c.riesgo.planId && c.riesgo.estado !== "COMPLETO") {
        // Sin oferta aún
        if (c.etapa === "ORIGINACION" && c.laboral.ingresoNeto === 0) {
          return `Originación · paso ${pasoMeta.numero}: ${pasoMeta.titulo} · sin oferta`;
        }
        return `Originación · ${pasoMeta.titulo} · oferta pendiente`;
      }
      return `Originación · paso ${pasoMeta.numero} de ${STEPS_ORIGINACION.length}: ${pasoMeta.titulo}`;
    }
    if (c.estado === "EN_TRAMITE" && c.etapa === "POST_OFERTA") {
                    const estados = estadoPantallasPostOferta(c);
                      const completas = estados.filter((e) => e.completa).length;
                      const base = `Carga post-oferta · ${completas} de ${estados.length} pantallas`;
                      if (c.oferta.aceptada || c.oferta.planId) {
                        return `${base} · ${formatARS(c.oferta.montoSolicitado)} · ${c.oferta.plazo} cuotas · TNA ${c.oferta.tna}%`;
                      }
                      return base;
    }
    if (c.estado === "OBSERVADO") {
      const obs = c.analista.observacion;
      return obs ? `${obs.motivo}: ${obs.nota}` : "Observada por el analista";
    }
    if (c.estado === "CAMBIO_OFERTA") {
      return "Oferta respondida · aguardando confirmación del analista";
    }
    if (c.estado === "PREAPROBADO" || c.estado === "ANALISIS_TOMADO") {
      return c.analista.reenviada
        ? "Reenviada con correcciones · en bandeja del analista"
        : c.estado === "ANALISIS_TOMADO"
          ? "Tomada por analista · en revisión"
          : "Preaprobada · pendiente de toma";
    }
    if (c.estado === "EN_FIRMA") return "Aprobada · esperando la firma del cliente (FEL)";
    if (c.estado === "FIRMADO") return "Firmada · el analista verifica la firma (AFEL)";
    if (c.estado === "CHEQUEO_TELEFONICO")
      return `En chequeo telefónico · ${textoChequeo(c.chequeoTelefonico)} · sólo lectura`;
    if (c.estado === "PARA_LIQUIDAR") return "Aprobada · en Bandeja de Liquidación (Tesorería)";
    if (c.estado === "RECHAZADO" && c.rechazo) {
      const { origen, codigos, motivo } = c.rechazo;
      const map: Record<typeof origen, string> = {
        INSTITUCIONAL: `Rechazo institucional · ${codigos.join(", ")}`,
        MOTOR: `Rechazo motor · ${codigos.join(", ")}`,
        SIN_LINEA: `Sin línea · ${codigos.join(", ")}`,
        ANALISTA: `Rechazo analista · ${codigos.join(", ")} ${motivo}`,
        CHEQUEADOR: `Rechazo en chequeo telefónico · ${codigos.join(", ")} ${motivo}`,
      };
      return map[origen];
    }
    if (c.estado === "ANULADO") return "Anulada · cliente desistió";
    return `${c.estado} · ${formatARS(c.oferta.montoSolicitado)} · ${c.oferta.plazo} cuotas`;
  }

  function vencimientoPara(c: CreditApplication, pasoActual: number) {
    if (c.estado === "OBSERVADO" && c.analista.observacion) return `Corregir antes del ${sumarDias(c.analista.observacion.fecha, 15)}`;
    if (c.fechaSolicitud) return `Condiciones vigentes hasta ${sumarDias(c.fechaSolicitud, 30)}`;
    if (c.estado === "BORRADOR") return "Se genera al presionar Solicitar";
    return "";
  }

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

      <div className="mt-8 space-y-5">
        {GRUPOS.map((g) => {
          const dbFiltrados = creditosDB.filter(
            (c) => GRUPO_POR_ESTADO[c.estado] === g.id && (!q || (c.cliente && coincideCliente(c.cliente, q)))
          );
          const appGrupo = hidratado ? GRUPO_POR_ESTADO[app.estado] : null;
          const appCoincide = hidratado && cliente && coincideCliente(cliente, busqueda);
          const mostrarApp =
            appCoincide && appGrupo === g.id && !creditosDB.some((c) => c.numeroCredito && c.numeroCredito === app.numeroCredito);
          const totalFilas = dbFiltrados.length + (mostrarApp ? 1 : 0);
          const colapsado = colapsados[g.id];
          const paginaActual = pagina[g.id] ?? 1;
          const totalPaginas = Math.ceil(dbFiltrados.length / POR_PAGINA) || 1;
          const paginaSafe = Math.min(paginaActual, totalPaginas);
          const inicio = (paginaSafe - 1) * POR_PAGINA;
          const paginados = dbFiltrados.slice(inicio, inicio + POR_PAGINA);

          return (
            <section key={g.id} aria-label={g.titulo} className="rounded-xl border border-ink-200 bg-white shadow-xs">
              <button
                onClick={() => toggleColapso(g.id)}
                className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left hover:bg-ink-25 transition"
                aria-expanded={!colapsado}
              >
                <span className="flex items-center gap-2">
                  <IconChevronDown width={16} height={16} className={`text-ink-500 transition-transform ${colapsado ? "-rotate-90" : ""}`} />
                  <span className="text-xs font-bold uppercase tracking-widest text-ink-700">{g.titulo}</span>
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-500">{totalFilas}</span>
                  {g.id === "TRAMITE" && totalFilas > POR_PAGINA && !colapsado && (
                    <span className="hidden text-[11px] text-ink-400 sm:inline">· pág. {paginaSafe}/{totalPaginas} · 5 por página</span>
                  )}
                </span>
                <IconChevronDown width={16} height={16} className={`shrink-0 text-ink-400 transition-transform ${colapsado ? "-rotate-180" : ""}`} />
              </button>

              {!colapsado && (
                <>
                  {!hidratado ? (
                    <p className="px-5 py-6 text-center text-sm text-ink-400">Cargando…</p>
                  ) : totalFilas === 0 ? (
                    <p className="flex items-center justify-center gap-2 px-5 py-6 text-center text-sm text-ink-400">
                      <IconFileStack width={15} height={15} />
                      {q ? `Sin coincidencias para “${busqueda}”.` : g.vacio}
                    </p>
                  ) : (
                    <>
                      <div className="divide-y divide-ink-100 border-t border-ink-100">
                        {mostrarApp && paginaSafe === 1 && (
                          <div className="px-5 py-4 bg-brand-50/40">
                            <div className="mb-2 inline-flex items-center gap-1 rounded bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">En curso</div>
                            <div className="grid gap-3 md:grid-cols-[1fr_1.3fr_0.9fr_1.6fr] md:items-center md:gap-4">
                              <div>
                                <p className="font-mono text-sm font-bold text-brand-700">{app.numeroCredito ?? "Sin ID"}</p>
                                <p className="text-[11px] text-ink-400">{app.numeroCredito ? `Solicitada ${app.fechaSolicitud ?? ""}` : "Se genera al presionar Solicitar"}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-ink-900">{cliente?.nombre} {cliente?.apellido}</p>
                                <p className="text-xs text-ink-500">DNI {formatDNI(cliente?.dni ?? "")} · ID {app.numeroCliente}</p>
                                {app.oferta.planId && <p className="mt-1 text-xs font-semibold tabular-nums text-ink-700">{formatARS(app.oferta.montoSolicitado)} · {app.oferta.plazo} cuotas</p>}
                              </div>
                              <div>
                                <EstadoBadge estado={app.estado} etiqueta={etiquetaObservado(app)} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-ink-700">{detallePara(app, paso)}</p>
                                <p className="mt-0.5 text-[11px] font-medium text-ink-400">{vencimientoPara(app, paso)}</p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 md:justify-end">
                              <Button size="sm" variant={app.estado === "OBSERVADO" ? "primary" : "outline"} onClick={irASolicitud}>
                                {app.estado === "OBSERVADO" ? "Tramitar observación" : "Continuar carga"}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setModal("posicion")}>Posición cliente</Button>
                            </div>
                          </div>
                        )}
                        {paginados.map((cred) => {
                          const cli = cred.cliente;
                          const det = detallePara(cred as unknown as CreditApplication, paso);
                          const venc = vencimientoPara(cred as unknown as CreditApplication, paso);
                          const conOferta = cred.oferta.planId !== null && cred.riesgo.estado === "COMPLETO";

                          return (
                            <div key={cred.numeroCredito ?? cred.cliente?.dni ?? cred._descripcion} className="px-5 py-4 hover:bg-ink-25 transition">
                              <div className="grid gap-3 md:grid-cols-[1fr_1.3fr_0.9fr_1.6fr] md:items-center md:gap-4">
                                <div>
                                  <p className="font-mono text-sm font-bold text-brand-700">{cred.numeroCredito ?? "Sin ID"}</p>
                                  <p className="text-[11px] text-ink-400">{cred.numeroCredito ? `Solicitada ${cred.fechaSolicitud ?? ""}` : "Se genera al presionar Solicitar"}</p>
                                  {cred.oferta.planId && <p className="mt-1 text-[11px] font-medium text-ink-500">{cred.configuracion.productoId} · {cred.configuracion.organismoId}</p>}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-ink-900">{cli ? `${cli.nombre} ${cli.apellido}` : "—"}</p>
                                  <p className="text-xs text-ink-500">{cli ? `DNI ${formatDNI(cli.dni)} · ID ${cred.numeroCliente ?? "—"}` : "Sin cliente"}</p>
                                  {conOferta ? (
                                    <p className="mt-1 text-xs font-semibold tabular-nums text-ink-700">{formatARS(cred.oferta.montoSolicitado)} · {cred.oferta.plazo} cuotas · {formatARS(cred.oferta.valorCuota)}/mes</p>
                                  ) : (
                                    cred.estado !== "BORRADOR" && <p className="mt-1 text-xs italic text-ink-400">Sin oferta aún</p>
                                  )}
                                </div>
                                <div>
                                  <EstadoBadge
                                    estado={cred.estado}
                                    etiqueta={etiquetaObservado(cred as unknown as CreditApplication)}
                                  />
                                  {conOferta && <p className="mt-1 text-[11px] tabular-nums text-ink-500">TNA {cred.oferta.tna}% · {cred.oferta.primeraCuotaVencimiento}</p>}
                                  {cred._descripcion && <p className="mt-1 text-[10px] italic leading-tight text-ink-400 line-clamp-2">{cred._descripcion}</p>}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm text-ink-700">{det}</p>
                                  {venc && <p className={`mt-0.5 text-[11px] font-medium ${cred.estado === "OBSERVADO" ? "text-warning-700" : "text-ink-400"}`}>{venc}</p>}
                                  {cred.etapa === "POST_OFERTA" && conOferta && (
                                    <p className="mt-1 text-[11px] text-ink-500">{estadoPantallasPostOferta(cred as unknown as CreditApplication).filter((e) => e.completa).length}/{estadoPantallasPostOferta(cred as unknown as CreditApplication).length} pantallas post-oferta</p>
                                  )}
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2 md:justify-end">
                                {g.id === "TRAMITE" && (
                                  <Button size="sm" variant="outline" onClick={() => abrirCreditoDB(cred)}>
                                    Continuar carga
                                  </Button>
                                )}
                                {g.id === "OBSERVADAS" && (
                                  <Button size="sm" variant="primary" onClick={() => abrirCreditoDB(cred)}>
                                    Tramitar observación
                                  </Button>
                                )}
                                {(g.id === "ANALISIS" || g.id === "RESUELTAS") && (
                                  <Button size="sm" variant="outline" onClick={() => actuar(cred, "estado")}>
                                    Ver estado
                                  </Button>
                                )}
                                {g.id === "ANALISIS" && (
                                  <Button size="sm" variant="outline" onClick={() => actuar(cred, "comentario")}>
                                    Agregar comentario
                                  </Button>
                                )}
                                {g.id === "RESUELTAS" && cred.estado === "RECHAZADO" && (
                                  <Button size="sm" variant="outline" onClick={() => actuar(cred, "motivo")}>
                                    Ver motivo
                                  </Button>
                                )}
                                {(g.id === "TRAMITE" || g.id === "OBSERVADAS") && (
                                  <Button size="sm" variant="ghost" onClick={() => actuar(cred, "anular")}>
                                    Anular
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => actuar(cred, "posicion")}>
                                  Posición del cliente
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {dbFiltrados.length > POR_PAGINA && (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 bg-ink-25 px-5 py-3">
                          <p className="text-xs text-ink-500">Mostrando {inicio + 1}–{Math.min(inicio + POR_PAGINA, dbFiltrados.length)} de {dbFiltrados.length} · 5 por página</p>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" disabled={paginaSafe <= 1} onClick={() => setPagina((p) => ({ ...p, [g.id]: paginaSafe - 1 }))}>Anterior</Button>
                            {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
                              <button
                                key={n}
                                onClick={() => setPagina((p) => ({ ...p, [g.id]: n }))}
                                className={`min-w-8 rounded-lg px-2.5 py-1.5 text-xs font-bold ${n === paginaSafe ? "bg-brand-600 text-white shadow-sm" : "bg-white text-ink-700 hover:bg-ink-100 border border-ink-200"}`}
                              >
                                {n}
                              </button>
                            ))}
                            <Button size="sm" variant="ghost" disabled={paginaSafe >= totalPaginas} onClick={() => setPagina((p) => ({ ...p, [g.id]: paginaSafe + 1 }))}>Siguiente</Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
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
