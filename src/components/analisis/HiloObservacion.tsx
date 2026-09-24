"use client";

import { useApplication } from "@/lib/application-context";
import { SESION_ANALISTA, pantallasVisibles } from "@/lib/config";
import { observacionesDe } from "@/lib/credit";
import { parseFecha } from "@/lib/format";

// Los comentarios traen "Hoy HH:MM" o "dd/mm/aaaa HH:MM"; las observaciones "dd/mm/aaaa".
function instante(fecha: string): number {
  const conHora = /^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}):(\d{2})$/.exec(fecha.trim());
  if (!conHora) return parseFecha(fecha)?.getTime() ?? 0;
  const dia = parseFecha(conHora[1]);
  if (!dia) return 0;
  dia.setHours(Number(conHora[2]), Number(conHora[3]));
  return dia.getTime();
}

type Mensaje = {
  clave: string;
  rol: "ANALISTA" | "VENTA";
  autor: string;
  fecha: string;
  // Tema de una observación del analista; los comentarios no lo tienen.
  tema?: string;
  texto: string;
  pantallas?: string[];
};

/**
 * Conversación entre el analista y el canal de venta, como un foro (creditonet-88): cada
 * observación del analista abre un tema y debajo van las respuestas del canal de venta. Se ordena
 * por fecha; a igual fecha el tema del analista va antes que las respuestas.
 */
export function HiloObservacion() {
  const { app } = useApplication();
  const etiquetaPantalla = (id: string) =>
    pantallasVisibles(app.configuracion).find((p) => p.id === id)?.label ?? id;

  const mensajes: Mensaje[] = [
    ...observacionesDe(app).map(
      (o, i): Mensaje => ({
        clave: `obs-${i}`,
        rol: "ANALISTA",
        autor: SESION_ANALISTA.nombre,
        fecha: o.fecha,
        tema: o.motivo,
        texto: o.nota,
        pantallas: o.pantallas.map(etiquetaPantalla),
      })
    ),
    ...app.comentarios.map(
      (c): Mensaje => ({
        clave: c.id,
        rol: c.autor === SESION_ANALISTA.nombre ? "ANALISTA" : "VENTA",
        autor: c.autor,
        fecha: c.fecha,
        texto: c.texto,
      })
    ),
  ]
    .map((m, i) => ({ m, i, t: instante(m.fecha) }))
    .sort((a, b) => a.t - b.t || Number(!!b.m.tema) - Number(!!a.m.tema) || a.i - b.i)
    .map(({ m }) => m);

  return (
    <ol className="space-y-3" aria-label="Conversación con el canal de venta">
      {mensajes.map((m) =>
        m.rol === "ANALISTA" ? (
          <li key={m.clave} className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-warning-700">
              Analista de riesgo · {m.autor} · {m.fecha}
            </p>
            {m.tema && <p className="mt-1 text-sm font-semibold text-ink-900">Tema: {m.tema}</p>}
            <p className="mt-1 whitespace-pre-line text-sm text-ink-800">{m.texto}</p>
            {m.pantallas && m.pantallas.length > 0 && (
              <p className="mt-2 text-xs text-ink-600">
                Pantallas observadas: {m.pantallas.join(", ")}
              </p>
            )}
          </li>
        ) : (
          <li
            key={m.clave}
            className="ml-5 rounded-xl border border-brand-200 border-l-4 bg-brand-50/60 px-4 py-3"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700">
              Canal de venta · {m.autor} · {m.fecha}
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink-800">{m.texto}</p>
          </li>
        )
      )}
    </ol>
  );
}
