"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApplication } from "@/lib/application-context";
import { mostrarToast } from "@/lib/toast";
import { CANALES, ORGANISMOS, PRODUCTOS, nombreOpcion } from "@/lib/config";
import {
  estaPendiente,
  estaRespondida,
  marcarLeida,
  quitarNotificacion,
  rutaNotificacion,
  sinRespuestaDesdeAyer,
  useNotificaciones,
  type ComentarioNotificacion,
} from "@/lib/notificaciones";
import { intentoActual } from "@/lib/firma";
import { coincideCliente, formatARS, formatDNI } from "@/lib/format";
import type { CreditoDB } from "@/lib/creditos-db";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { IconCheck, IconFileStack, IconSearch, IconX } from "@/components/icons";

// Flujo (creditonet-110): Pendientes → En chequeo → Notif. pendientes → Notif. respondidas →
// Finalizados. Las dos pestañas de notificaciones listan avisos, no créditos.
type Pestana = "PEND" | "CURSO" | "NOTIF_PEND" | "NOTIF_RESP" | "FIN";

const PESTANAS: {
  id: Pestana;
  titulo: string;
  vacio: string;
  incluye: (c: CreditoDB) => boolean;
}[] = [
  {
    id: "PEND",
    titulo: "Pendientes",
    vacio: "No hay créditos pendientes de chequeo telefónico.",
    incluye: (c) => c.estado === "CHEQUEO_TELEFONICO" && c.chequeoTelefonico?.tomado !== true,
  },
  {
    id: "CURSO",
    titulo: "En chequeo",
    vacio: "No hay chequeos tomados en curso.",
    incluye: (c) => c.estado === "CHEQUEO_TELEFONICO" && c.chequeoTelefonico?.tomado === true,
  },
  {
    id: "NOTIF_PEND",
    titulo: "Notif. pendientes",
    vacio: "No hay notificaciones esperando respuesta del canal de venta.",
    incluye: () => false,
  },
  {
    id: "NOTIF_RESP",
    titulo: "Notif. respondidas",
    vacio: "No hay notificaciones respondidas para tratar.",
    incluye: () => false,
  },
  {
    id: "FIN",
    titulo: "Finalizados",
    vacio: "Todavía no hay chequeos finalizados.",
    incluye: (c) => c.chequeoTelefonico?.resultado != null || c.chequeoTelefonico?.noConcretado != null,
  },
];

const COLUMNAS = [
  "Cliente",
  "DNI",
  "Producto",
  "Organismo",
  "Monto",
  "Cuotas",
  "Firma verificada",
  "Estado",
  "Resultado",
];

function LuzNotificaciones({ cantidad }: { cantidad: number }) {
  if (cantidad === 0) return null;
  return (
    <span
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-500 px-1 text-[11px] font-bold tabular-nums text-white"
      title={`${cantidad} notificación${cantidad === 1 ? "" : "es"} sin leer`}
    >
      {cantidad}
    </span>
  );
}

export function ListaChequeo({ onAbrir }: { onAbrir: () => void }) {
  const router = useRouter();
  const { creditosDB, cargarCreditoDeDB, cerrarNoConcretado } = useApplication();
  const [pestana, setPestana] = useState<Pestana>("PEND");
  const [busqueda, setBusqueda] = useState("");
  const [canal, setCanal] = useState("");
  const [porCerrar, setPorCerrar] = useState<ComentarioNotificacion | null>(null);
  const notificaciones = useNotificaciones();

  // Avisos sobre créditos en chequeo, con crédito en la DB. Se siguen viendo mientras el crédito
  // siga en chequeo telefónico; al salir de chequeo desaparecen.
  // - Pendientes: los que dejó el chequeador y esperan respuesta del canal de venta.
  // - Respondidas: lo que contestó el canal de venta (u otro rol) y el chequeador debe tratar.
  const creditoDe = (n: ComentarioNotificacion) =>
    creditosDB.find((c) => c._id === n.creditoId);
  const avisos = notificaciones.filter(
    (n) => creditoDe(n)?.estado === "CHEQUEO_TELEFONICO"
  );
  const respondidas = avisos.filter(estaRespondida);
  const sinLeerDe = (creditoId: string) =>
    respondidas.filter((n) => !n.leida && n.creditoId === creditoId).length;
  const avisosDe = (id: Pestana) =>
    avisos
      .filter(id === "NOTIF_PEND" ? estaPendiente : estaRespondida)
      .filter((n) => {
        const c = creditoDe(n)!;
        if (canal && c.configuracion.canalId !== canal) return false;
        if (busqueda.trim() && !(c.cliente && coincideCliente(c.cliente, busqueda))) return false;
        return true;
      });
  const esNotif = pestana === "NOTIF_PEND" || pestana === "NOTIF_RESP";
  const avisosFiltrados = esNotif ? avisosDe(pestana) : [];

  const enPestana = (p: (typeof PESTANAS)[number]) =>
    creditosDB.filter((c) => {
      if (!p.incluye(c)) return false;
      if (canal && c.configuracion.canalId !== canal) return false;
      if (busqueda.trim() && !(c.cliente && coincideCliente(c.cliente, busqueda))) return false;
      return true;
    });

  const activa = PESTANAS.find((p) => p.id === pestana)!;
  const lista = enPestana(activa);

  function abrir(c: CreditoDB) {
    cargarCreditoDeDB(c._id);
    onAbrir();
  }

  function abrirAviso(n: ComentarioNotificacion) {
    const c = creditoDe(n);
    if (!c) return;
    marcarLeida(n.id);
    cargarCreditoDeDB(c._id);
    // Si el crédito sigue en la órbita del chequeador se abre acá; si no, se navega
    // a la bandeja donde está (misma regla que la página de chequeo).
    const ch = c.chequeoTelefonico;
    const enChequeo = c.estado === "CHEQUEO_TELEFONICO" && ch !== null;
    const finChequeo =
      (c.estado === "PARA_LIQUIDAR" && ch?.resultado === "OK") ||
      (c.estado === "RECHAZADO" && c.rechazo?.origen === "CHEQUEADOR");
    if (enChequeo || finChequeo) onAbrir();
    else router.push(rutaNotificacion(c.estado));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <IconSearch
            width={15}
            height={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar DNI / apellido"
            aria-label="Buscar por DNI o apellido"
            className="h-10 w-full rounded-lg border border-ink-300 bg-white pl-9 pr-3 text-sm shadow-xs outline-none transition placeholder:text-ink-400 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <select
          value={canal}
          onChange={(e) => setCanal(e.target.value)}
          aria-label="Filtro canal"
          className="h-10 rounded-lg border border-ink-300 bg-white px-3 text-sm text-ink-700 shadow-xs outline-none transition hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        >
          <option value="">Canal: todos</option>
          {CANALES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <div role="tablist" aria-label="Estados del chequeo" className="flex flex-wrap gap-2">
        {PESTANAS.map((p) => {
          const seleccionada = p.id === pestana;
          const cantidad =
            p.id === "NOTIF_PEND" || p.id === "NOTIF_RESP" ? avisosDe(p.id).length : enPestana(p).length;
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={seleccionada}
              onClick={() => setPestana(p.id)}
              title={p.titulo}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-bold tracking-wide transition ${
                seleccionada
                  ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                  : "border-ink-300 bg-white text-ink-700 hover:border-ink-400 hover:bg-ink-50"
              }`}
            >
              {p.titulo}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                  seleccionada ? "bg-white/20 text-white" : "bg-ink-100 text-ink-500"
                }`}
              >
                {cantidad}
              </span>
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        {esNotif ? (
          avisosFiltrados.length === 0 ? (
            <p className="flex items-center justify-center gap-2 px-5 py-8 text-center text-sm text-ink-400">
              <IconFileStack width={15} height={15} />
              {busqueda.trim() || canal
                ? "Ningún aviso coincide con la búsqueda o el filtro."
                : activa.vacio}
            </p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {avisosFiltrados.map((n) => {
                const c = creditoDe(n)!;
                const cli = c.cliente!;
                return (
                  <li
                    key={n.id}
                    className={`flex cursor-pointer flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 transition hover:bg-ink-25 ${
                      estaRespondida(n) && n.leida ? "opacity-60" : ""
                    }`}
                    onClick={() => abrirAviso(n)}
                  >
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="truncate text-sm font-semibold text-ink-900">
                        {cli.nombre} {cli.apellido}
                      </p>
                      <p className="font-mono text-[11px] font-bold text-brand-700">
                        {c.numeroCredito ?? "Sin ID"}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {nombreOpcion(PRODUCTOS, c.configuracion.productoId)} ·{" "}
                        {formatARS(c.oferta.montoSolicitado)}
                      </p>
                    </div>
                    <div className="min-w-0 flex-[2] basis-72">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                        {n.autor} · {n.fecha}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-ink-700">{n.texto}</p>
                      {estaPendiente(n) && (
                        <p className="mt-1 text-[11px] font-semibold text-warning-600">
                          {sinRespuestaDesdeAyer(n)
                            ? "Sin respuesta desde ayer: ya se puede cerrar como no concretado."
                            : "Esperando respuesta del canal de venta."}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">
                      <EstadoBadge estado={c.estado} />
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => abrirAviso(n)}>
                        Abrir
                      </Button>
                      {estaRespondida(n) ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            quitarNotificacion(n.id);
                            mostrarToast("Respuesta marcada como tratada");
                          }}
                          aria-label={`Marcar como tratada la respuesta de ${n.numeroCredito ?? "la solicitud"}`}
                        >
                          <IconCheck width={14} height={14} />
                          Marcar tratada
                        </Button>
                      ) : (
                        sinRespuestaDesdeAyer(n) && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPorCerrar(n);
                            }}
                            aria-label={`Cerrar como no concretado ${n.numeroCredito ?? "la solicitud"}`}
                          >
                            <IconX width={14} height={14} />
                            Cerrar como no concretado
                          </Button>
                        )
                      )}
                      {estaRespondida(n) && !n.leida && <LuzNotificaciones cantidad={sinLeerDe(c._id)} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : lista.length === 0 ? (
          <p className="flex items-center justify-center gap-2 px-5 py-8 text-center text-sm text-ink-400">
            <IconFileStack width={15} height={15} />
            {busqueda.trim() || canal ? "Ningún crédito coincide con la búsqueda o el filtro." : activa.vacio}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  {COLUMNAS.map((c) => (
                    <th key={c} className="px-3 py-2.5 font-semibold">
                      {c}
                    </th>
                  ))}
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => {
                  const cli = c.cliente!;
                  const resultado = c.chequeoTelefonico?.resultado;
                  // Un crédito cerrado como no concretado ya no tiene pantalla de chequeo.
                  const abrible = !c.chequeoTelefonico?.noConcretado;
                  return (
                    <tr
                      key={c._id}
                      className={`align-middle transition hover:bg-ink-25 ${abrible ? "cursor-pointer" : ""}`}
                      onClick={abrible ? () => abrir(c) : undefined}
                    >
                      <td className="px-3 py-3">
                        <p className="font-semibold text-ink-900">
                          {cli.nombre} {cli.apellido}
                        </p>
                        <p className="font-mono text-[11px] font-bold text-brand-700">
                          {c.numeroCredito ?? "Sin ID"}
                        </p>
                      </td>
                      <td className="px-3 py-3 tabular-nums text-ink-700">{formatDNI(cli.dni)}</td>
                      <td className="px-3 py-3 text-ink-700">
                        {nombreOpcion(PRODUCTOS, c.configuracion.productoId)}
                      </td>
                      <td className="px-3 py-3 text-ink-700">
                        {nombreOpcion(ORGANISMOS, c.configuracion.organismoId)}
                      </td>
                      <td className="px-3 py-3 font-semibold tabular-nums text-ink-900">
                        {formatARS(c.oferta.montoSolicitado)}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-ink-700">{c.oferta.plazo}</td>
                      <td className="px-3 py-3 text-ink-700">
                        {intentoActual(c.firmas)?.fechaResultado ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        <EstadoBadge estado={c.estado} />
                      </td>
                      <td className="px-3 py-3 text-ink-700">
                        {c.chequeoTelefonico?.noConcretado
                          ? "No concretado"
                          : resultado === "OK"
                          ? "Correcto"
                          : resultado === "NO_OK"
                            ? "No correcto"
                            : c.chequeoTelefonico?.observacion
                              ? "Observado"
                              : "—"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {abrible && (
                            <Button size="sm" variant="outline" onClick={() => abrir(c)}>
                              Abrir
                            </Button>
                          )}
                          {pestana !== "PEND" && <LuzNotificaciones cantidad={sinLeerDe(c._id)} />}
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
      <ConfirmationModal
        open={porCerrar !== null}
        title="Cerrar como no concretado"
        descripcion="El canal de venta no respondió el aviso. El crédito se anula y el chequeo pasa a Finalizados como no concretado."
        rows={[
          { label: "ID de Crédito", value: porCerrar?.numeroCredito ?? "—" },
          { label: "Aviso", value: porCerrar?.texto ?? "—" },
        ]}
        confirmLabel="Cerrar como no concretado"
        tone="danger"
        onConfirm={() => {
          if (porCerrar?.creditoId) {
            cerrarNoConcretado(porCerrar.creditoId);
            mostrarToast("Crédito cerrado como no concretado");
          }
          setPorCerrar(null);
        }}
        onCancel={() => setPorCerrar(null)}
      />
    </div>
  );
}
