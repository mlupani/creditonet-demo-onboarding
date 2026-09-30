"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApplication } from "@/lib/application-context";
import { useRol } from "@/lib/rol-context";
import { marcarLeida, paraRol, rutaNotificacion, rutaParaEstado, useNotificaciones } from "@/lib/notificaciones";
import { IconBell } from "@/components/icons";

const VISIBLE_MS = 8000;
const REPETIR_MS = 30000;

let audio: AudioContext | null = null;

// Dos tonos cortos generados en el momento (sin archivo de audio). Si el navegador
// bloquea el audio hasta que haya un gesto del usuario, el aviso se muestra igual.
function sonar() {
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    void ctx.resume();
    [880, 1175].forEach((freq, i) => {
      const inicio = ctx.currentTime + i * 0.16;
      const osc = ctx.createOscillator();
      const ganancia = ctx.createGain();
      osc.frequency.value = freq;
      ganancia.gain.setValueAtTime(0.0001, inicio);
      ganancia.gain.exponentialRampToValueAtTime(0.15, inicio + 0.02);
      ganancia.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.3);
      osc.connect(ganancia).connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.32);
    });
  } catch {
    /* sin audio disponible */
  }
}

// Aviso flotante de comentarios sin leer. No aparece mientras el analista tiene el
// crédito tomado en su pantalla; al soltarlo/terminarlo o cambiar de pantalla se
// muestra, y se repite cada tanto hasta que se hace click.
export function ToastNotificaciones() {
  const router = useRouter();
  const pathname = usePathname();
  const { app, creditosDB, cargarCreditoDeDB } = useApplication();
  const { rol } = useRol();
  const notificaciones = useNotificaciones().filter((n) => paraRol(n, rol));
  const [vistas, setVistas] = useState<string[]>([]);
  const [visible, setVisible] = useState(false);

  const pendientes = notificaciones.filter((n) => !n.leida && !vistas.includes(n.id));
  const ultima = pendientes[0];
  const trabajando =
    ((app.estado === "ANALISIS_TOMADO" && app.analista.tomado) ||
      (app.estado === "CHEQUEO_TELEFONICO" && app.chequeoTelefonico?.tomado === true)) &&
    pathname === rutaParaEstado(app.estado);
  const activo = !!ultima && !trabajando;
  const ultimaId = ultima?.id;

  useEffect(() => {
    if (!activo) return;
    let timer = 0;
    const mostrar = () => {
      setVisible(true);
      sonar();
      timer = window.setTimeout(ocultar, VISIBLE_MS);
    };
    const ocultar = () => {
      setVisible(false);
      timer = window.setTimeout(mostrar, REPETIR_MS);
    };
    timer = window.setTimeout(mostrar, 0);
    return () => {
      window.clearTimeout(timer);
      setVisible(false);
    };
  }, [activo, ultimaId]);

  if (!activo || !visible || !ultima) return null;

  function abrir() {
    if (!ultima) return;
    setVistas((v) => [...v, ...pendientes.map((n) => n.id)]);
    marcarLeida(ultima.id);
    if (ultima.creditoId) cargarCreditoDeDB(ultima.creditoId);
    const actual = creditosDB.find((c) => c._id === ultima.creditoId)?.estado ?? ultima.estado;
    router.push(rutaNotificacion(actual));
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 top-20 z-50 w-80 max-w-[calc(100vw-2rem)] animate-slide-down"
    >
      <button
        onClick={abrir}
        className="flex w-full gap-3 rounded-xl border border-brand-200 bg-white p-4 text-left shadow-lift transition hover:bg-brand-50"
      >
        <span className="mt-0.5 shrink-0 text-brand-600">
          <IconBell width={18} height={18} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug text-ink-900">
            {pendientes.length === 1
              ? "Nueva notificación"
              : `${pendientes.length} notificaciones nuevas`}
          </p>
          <p className="mt-0.5 text-xs font-medium text-ink-700">
            {ultima.numeroCredito ?? "Sin ID"} · {ultima.autor}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-500">{ultima.texto}</p>
        </div>
      </button>
    </div>
  );
}
