"use client";

import { useState } from "react";

const DIAGRAMAS = [
  { id: "resumen", label: "Resumen", src: "/diagramas/onboarding-flujo.html" },
  { id: "d1", label: "1 · Pedido", src: "/diagramas/onboarding-1-pedido.html" },
  { id: "d2", label: "2 · Oferta", src: "/diagramas/onboarding-2-oferta.html" },
  { id: "d3", label: "3 · Carga y análisis", src: "/diagramas/onboarding-3-carga.html" },
] as const;

export default function GraphPage() {
  const [activo, setActivo] = useState<(typeof DIAGRAMAS)[number]["id"]>("resumen");

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col">
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-ink-200 bg-white px-4 py-2 sm:px-6">
        {DIAGRAMAS.map((d) => (
          <button
            key={d.id}
            onClick={() => setActivo(d.id)}
            className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
              d.id === activo
                ? "bg-brand-50 text-brand-700"
                : "text-ink-500 hover:bg-ink-100 hover:text-ink-800"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
      {/* Los 4 iframes quedan siempre montados: si se desmontan mientras la
          animación "Live" está corriendo, el visor Archify tira un error al
          limpiar su estado. Alternar visibilidad evita eso y conserva el
          zoom/pan de cada diagrama al volver a su pestaña. */}
      <div className="relative w-full flex-1">
        {DIAGRAMAS.map((d) => (
          <iframe
            key={d.id}
            src={d.src}
            title={d.label}
            className="absolute inset-0 h-full w-full border-0"
            style={{ visibility: d.id === activo ? "visible" : "hidden" }}
          />
        ))}
      </div>
    </div>
  );
}
