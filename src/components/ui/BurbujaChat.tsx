import type { ReactNode } from "react";
import { PERFIL_ETIQUETA, type PerfilInteraccion } from "@/lib/historial";

// Cada perfil con su color: canal de venta azul, analista naranja, supervisor violeta y
// chequeador verde.
const COLORES: Record<PerfilInteraccion, { caja: string; titulo: string }> = {
  VENTA: { caja: "border-brand-200 bg-brand-50", titulo: "text-brand-700" },
  ANALISTA: { caja: "border-warning-200 bg-warning-50", titulo: "text-warning-700" },
  SUPERVISOR: { caja: "border-violet-200 bg-violet-50", titulo: "text-violet-700" },
  CHEQUEO: { caja: "border-success-200 bg-success-50", titulo: "text-success-700" },
};

/**
 * Mensaje de una conversación del crédito, estilo chat de WhatsApp (creditonet-112). Cada perfil
 * tiene su color y `derecha` decide el lado (ver `ladosDeChat`): los mensajes seguidos de un mismo
 * perfil quedan del mismo lado y la respuesta de otro va al lado contrario. Todas las
 * conversaciones de la app usan esta burbuja para verse igual. Va dentro de un <ul>/<ol>.
 */
export function BurbujaChat({
  perfil,
  usuario,
  fecha,
  tema,
  derecha,
  children,
}: {
  perfil: PerfilInteraccion;
  usuario: string;
  fecha: string;
  tema?: string;
  derecha: boolean;
  children: ReactNode;
}) {
  const color = COLORES[perfil];
  return (
    <li className={`flex ${derecha ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-2xl border px-3.5 py-2 ${color.caja} ${
          derecha ? "rounded-tr-sm" : "rounded-tl-sm"
        }`}
      >
        <p className={`text-[11px] font-bold uppercase tracking-wider ${color.titulo}`}>
          {PERFIL_ETIQUETA[perfil]} · {usuario}
        </p>
        {tema && <p className="mt-1 text-sm font-semibold text-ink-900">{tema}</p>}
        <div className="mt-1 whitespace-pre-line text-sm text-ink-800">{children}</div>
        <p className="mt-1 text-right text-[11px] tabular-nums text-ink-500">{fecha}</p>
      </div>
    </li>
  );
}
