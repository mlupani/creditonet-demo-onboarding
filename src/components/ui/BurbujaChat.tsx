import type { ReactNode } from "react";
import { LADO_BACKOFFICE, PERFIL_ETIQUETA, type PerfilInteraccion } from "@/lib/historial";

/**
 * Mensaje de una conversación del crédito, estilo chat de WhatsApp (creditonet-112): el canal de
 * venta en azul a la derecha y el resto (analista, supervisor, chequeador) en naranja a la
 * izquierda. Todas las conversaciones de la app usan esta burbuja para verse igual. Va dentro de
 * un <ul>/<ol>.
 */
export function BurbujaChat({
  perfil,
  usuario,
  fecha,
  tema,
  children,
}: {
  perfil: PerfilInteraccion;
  usuario: string;
  fecha: string;
  tema?: string;
  children: ReactNode;
}) {
  const venta = !LADO_BACKOFFICE.includes(perfil);
  return (
    <li className={`flex ${venta ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-2xl border px-3.5 py-2 ${
          venta ? "rounded-tr-sm border-brand-200 bg-brand-50" : "rounded-tl-sm border-warning-200 bg-warning-50"
        }`}
      >
        <p
          className={`text-[11px] font-bold uppercase tracking-wider ${
            venta ? "text-brand-700" : "text-warning-700"
          }`}
        >
          {PERFIL_ETIQUETA[perfil]} · {usuario}
        </p>
        {tema && <p className="mt-1 text-sm font-semibold text-ink-900">{tema}</p>}
        <div className="mt-1 whitespace-pre-line text-sm text-ink-800">{children}</div>
        <p className="mt-1 text-right text-[11px] tabular-nums text-ink-500">{fecha}</p>
      </div>
    </li>
  );
}
