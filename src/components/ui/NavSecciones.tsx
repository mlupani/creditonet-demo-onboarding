"use client";

import type { ComponentType, ReactNode, SVGProps } from "react";
import { IconChevronsLeft, IconChevronsRight } from "@/components/icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { alternarNavSeccionesColapsado, useNavSeccionesColapsado } from "@/lib/sidebar-colapsado";

export type ItemNav = {
  id: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  // Indicador a la derecha (error, conectado, contador). Colapsado se superpone al ícono.
  extra?: ReactNode;
  // Título de grupo que se muestra antes del ítem (sólo expandido).
  grupo?: string;
};

// Menú lateral de secciones de las pantallas de detalle, colapsable a solo íconos en escritorio.
export function NavSecciones({
  ariaLabel,
  items,
  activa,
  onSelect,
  ancho,
  leyenda,
  children,
}: {
  ariaLabel: string;
  items: ItemNav[];
  activa: string;
  onSelect: (id: string) => void;
  ancho: string;
  leyenda?: ReactNode;
  children: ReactNode;
}) {
  const colapsado = useNavSeccionesColapsado();
  return (
    <div
      className="mt-6 grid gap-6 transition-[grid-template-columns] duration-200 lg:grid-cols-[var(--nav-ancho)_minmax(0,1fr)]"
      style={{ "--nav-ancho": colapsado ? "3.5rem" : ancho } as React.CSSProperties}
    >
      <nav aria-label={ariaLabel} className="relative lg:sticky lg:top-20 lg:self-start">
        <button
          type="button"
          onClick={alternarNavSeccionesColapsado}
          aria-label={colapsado ? "Expandir menú de secciones" : "Colapsar menú de secciones"}
          aria-expanded={!colapsado}
          title={colapsado ? "Expandir menú" : "Colapsar menú"}
          className="mb-1 hidden h-7 items-center gap-2 rounded-lg px-3 text-xs font-medium text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 lg:flex lg:w-full lg:px-2.5"
        >
          {colapsado ? (
            <IconChevronsRight width={16} height={16} className="mx-auto" />
          ) : (
            <>
              <IconChevronsLeft width={16} height={16} />
              Colapsar
            </>
          )}
        </button>
        <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {items.map((it) => {
            const seleccionada = it.id === activa;
            const Icono = it.icon;
            const boton = (
              <button
                type="button"
                onClick={() => onSelect(it.id)}
                aria-current={seleccionada ? "page" : undefined}
                aria-label={colapsado ? it.label : undefined}
                className={`relative flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  colapsado ? "lg:w-14 lg:justify-center lg:px-0" : ""
                } ${
                  seleccionada
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
                }`}
              >
                <Icono width={18} height={18} className="shrink-0" />
                <span className={`flex-1 ${colapsado ? "lg:hidden" : ""}`}>{it.label}</span>
                {it.extra && (
                  <span className={colapsado ? "lg:absolute lg:right-1 lg:top-1" : ""}>
                    {it.extra}
                  </span>
                )}
              </button>
            );
            return (
              <li key={it.id} className="shrink-0">
                {it.grupo && !colapsado && (
                  <p className="hidden px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-ink-400 first:pt-0 lg:block">
                    {it.grupo}
                  </p>
                )}
                {colapsado ? (
                  <Tooltip label={it.label}>{boton}</Tooltip>
                ) : (
                  boton
                )}
              </li>
            );
          })}
        </ul>
        {leyenda && !colapsado && <div className="mt-3 hidden lg:block">{leyenda}</div>}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
