"use client";

import { useApplication } from "@/lib/application-context";
import { Card } from "@/components/ui/Card";
import { CarteraPunitorios } from "@/components/productos/CarteraPunitorios";

// Módulo Mora (por ahora sólo la modificación de punitorios de la cartera activa).
export function ModuloMora() {
  const { hidratado } = useApplication();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="animate-fade-in">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Módulo Mora</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">Modificación de cartera</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Cambia los punitorios de los créditos activos en mora de uno o más productos, por organismo. Cada
          aplicación queda como checkpoint.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {!hidratado ? (
          <Card className="px-5 py-8 text-center text-sm text-ink-400">Cargando…</Card>
        ) : (
          <CarteraPunitorios />
        )}
      </div>
    </div>
  );
}
