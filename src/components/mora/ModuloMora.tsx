"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { useProductos } from "@/lib/productos";
import { Card } from "@/components/ui/Card";
import { CarteraPunitorios } from "@/components/productos/CarteraPunitorios";

// Módulo Mora (por ahora sólo la modificación de punitorios de la cartera activa).
export function ModuloMora() {
  const { hidratado } = useApplication();
  const productos = useProductos().filter((p) => p.config.estado !== "ELIMINADO");
  const [elegido, setElegido] = useState("");
  const producto = productos.find((p) => p.config.id === elegido) ?? productos[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="animate-fade-in">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Módulo Mora</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">Modificación de cartera</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Cambia los punitorios de los créditos activos en mora de un producto, por organismo. Cada
          aplicación queda como checkpoint.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {!hidratado || !producto ? (
          <Card className="px-5 py-8 text-center text-sm text-ink-400">
            {hidratado ? "No hay productos." : "Cargando…"}
          </Card>
        ) : (
          <>
            <select
              value={producto.config.id}
              onChange={(e) => setElegido(e.target.value)}
              aria-label="Producto"
              className="h-10 rounded-lg border border-ink-300 bg-white px-3 text-sm text-ink-700 shadow-xs outline-none transition hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              {productos.map((p) => (
                <option key={p.config.id} value={p.config.id}>
                  {p.config.nombre}
                </option>
              ))}
            </select>
            {/* El asistente guarda el producto por su cuenta: no hay borrador que sincronizar. */}
            <CarteraPunitorios key={producto.config.id} p={producto} set={() => {}} />
          </>
        )}
      </div>
    </div>
  );
}
