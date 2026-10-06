"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApplication } from "@/lib/application-context";
import { NOTIFICACIONES } from "@/lib/mocks";
import {
  marcarLeida,
  marcarTodasLeidas,
  paraRol,
  rutaNotificacion,
  useNotificaciones,
  type ComentarioNotificacion,
} from "@/lib/notificaciones";
import { useRol } from "@/lib/rol-context";
import { LISTA_ROLES, ROLES } from "@/lib/roles";
import {
  IconAlertTriangle,
  IconBell,
  IconCheckCircle,
  IconInfo,
  IconMenu,
} from "@/components/icons";

function tituloRuta(pathname: string) {
  if (pathname === "/") return "Bandeja del canal de venta";
  if (pathname.startsWith("/onboarding")) return "Solicitar crédito";
  if (pathname.startsWith("/analisis")) return "Bandeja del analista de riesgo";
  if (pathname.startsWith("/chequeo")) return "Bandeja de chequeo telefónico";
  if (pathname.startsWith("/graph")) return "Diagrama de flujo · Onboarding";
  if (pathname.startsWith("/productos")) return "Parámetros · Productos";
  if (pathname.startsWith("/organismos")) return "Parámetros · Organismos";
  if (pathname.startsWith("/planes")) return "Parámetros · Planes de cuotas";
  if (pathname.startsWith("/parametros")) return "Parámetros";
  if (pathname.startsWith("/mora")) return "Mora · Modificación de cartera";
  return "CreditoNet";
}

function Notificaciones() {
  const router = useRouter();
  const { cargarCreditoDeDB, creditosDB } = useApplication();
  const [abierto, setAbierto] = useState(false);
  const [leidas, setLeidas] = useState<string[]>([]);
  const { rol } = useRol();
  const dinamicas = useNotificaciones().filter((n) => paraRol(n, rol));
  const noLeidas =
    dinamicas.filter((n) => !n.leida).length +
    NOTIFICACIONES.filter((n) => !leidas.includes(n.id)).length;

  function abrirNotificacion(n: ComentarioNotificacion) {
    marcarLeida(n.id);
    if (n.creditoId) cargarCreditoDeDB(n.creditoId);
    const actual = creditosDB.find((c) => c._id === n.creditoId)?.estado ?? n.estado;
    router.push(rutaNotificacion(actual));
    setAbierto(false);
  }

  function marcarTodas() {
    marcarTodasLeidas();
    setLeidas(NOTIFICACIONES.map((n) => n.id));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-label="Notificaciones"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
      >
        <IconBell width={19} height={19} />
        {noLeidas > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-danger-500 ring-2 ring-white" />
        )}
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} aria-hidden />
          <div className="absolute right-0 z-50 mt-2 w-80 animate-slide-down overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lift">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">Notificaciones</p>
              <button
                onClick={marcarTodas}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                Marcar todas como leídas
              </button>
            </div>
            <ul className="max-h-80 overflow-y-auto scroll-thin">
              {dinamicas.map((n) => (
                <li key={n.id} className="border-b border-ink-50 last:border-0">
                  <button
                    onClick={() => abrirNotificacion(n)}
                    className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-ink-50 ${
                      n.leida ? "opacity-60" : "bg-brand-50/40"
                    }`}
                  >
                    <span className="mt-0.5 shrink-0 text-brand-600">
                      <IconInfo width={17} height={17} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug text-ink-900">
                        {n.numeroCredito ?? "Sin ID"} · {n.autor}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-500">
                        {n.texto}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-ink-400">{n.fecha}</p>
                    </div>
                  </button>
                </li>
              ))}
              {NOTIFICACIONES.map((n) => {
                const leida = leidas.includes(n.id);
                return (
                  <li
                    key={n.id}
                    className={`flex gap-3 border-b border-ink-50 px-4 py-3 last:border-0 ${
                      leida ? "opacity-60" : "bg-brand-50/40"
                    }`}
                  >
                    <span
                      className={`mt-0.5 shrink-0 ${
                        n.tone === "warning"
                          ? "text-warning-600"
                          : n.tone === "success"
                            ? "text-success-600"
                            : "text-brand-600"
                      }`}
                    >
                      {n.tone === "warning" ? (
                        <IconAlertTriangle width={17} height={17} />
                      ) : n.tone === "success" ? (
                        <IconCheckCircle width={17} height={17} />
                      ) : (
                        <IconInfo width={17} height={17} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug text-ink-900">{n.titulo}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{n.detalle}</p>
                      <p className="mt-1 text-[11px] font-medium text-ink-400">{n.hace}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function SelectorRol() {
  const { rol, cambiarRol } = useRol();
  return (
    <div
      role="group"
      aria-label="Usuario de la demo"
      className="flex items-center gap-0.5 rounded-lg bg-ink-100 p-0.5"
    >
      {LISTA_ROLES.map((r) => (
        <button
          key={r}
          onClick={() => cambiarRol(r)}
          aria-pressed={r === rol}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
            r === rol
              ? "bg-white text-brand-700 shadow-xs"
              : "text-ink-500 hover:text-ink-800"
          }`}
        >
          {ROLES[r].corto}
        </button>
      ))}
    </div>
  );
}

export function Header() {
  const { menuAbierto, setMenuAbierto } = useApplication();
  const pathname = usePathname();
  const { rol } = useRol();
  const usuario = ROLES[rol].sesion;
  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/85 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => setMenuAbierto(!menuAbierto)}
          aria-label="Abrir menú"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 lg:hidden"
        >
          <IconMenu width={20} height={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-ink-900">
            {tituloRuta(pathname)}
          </p>
          <p className="hidden text-xs text-ink-400 sm:block">{usuario.organizacion}</p>
        </div>

        <span className="hidden items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-700 sm:inline-flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
          Demo
        </span>

        <SelectorRol />

        <div className="mx-1 hidden h-6 w-px bg-ink-200 sm:block" />

        <Notificaciones />

        <div className="ml-1 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
            {usuario.iniciales}
          </span>
          <div className="hidden leading-tight md:block">
            <p className="text-sm font-semibold text-ink-900">{usuario.nombre}</p>
            <p className="text-xs text-ink-500">
              {usuario.rol} · <span className="text-ink-400">CreditoNet</span>
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
