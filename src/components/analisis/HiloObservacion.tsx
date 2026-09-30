"use client";

import { useApplication } from "@/lib/application-context";
import { pantallasVisibles } from "@/lib/config";
import { interaccionesCredito } from "@/lib/historial";
import { BurbujaChat } from "@/components/ui/BurbujaChat";

/**
 * Conversación entre el canal de venta, el analista y el chequeador, como un foro (creditonet-88):
 * cada observación del analista abre un tema y debajo van las respuestas. Se ordena por fecha.
 */
export function HiloObservacion() {
  const { app } = useApplication();
  const etiquetaPantalla = (id: string) =>
    pantallasVisibles(app.configuracion).find((p) => p.id === id)?.label ?? id;

  const mensajes = interaccionesCredito(app);

  if (mensajes.length === 0)
    return <p className="text-sm text-ink-500">Todavía no hay mensajes entre el canal de venta y el analista.</p>;

  return (
    <ol className="space-y-2.5" aria-label="Historial de interacciones del crédito">
      {mensajes.map((m) => (
        <BurbujaChat key={m.clave} perfil={m.perfil} usuario={m.usuario} fecha={m.fecha} tema={m.tema}>
          {m.texto}
          {m.pantallas && m.pantallas.length > 0 && (
            <span className="mt-2 block text-xs text-ink-600">
              Pantallas observadas: {m.pantallas.map(etiquetaPantalla).join(", ")}
            </span>
          )}
        </BurbujaChat>
      ))}
    </ol>
  );
}
