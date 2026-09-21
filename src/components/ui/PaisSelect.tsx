"use client";

import { useEffect, useRef, useState } from "react";
import { IconChevronDown } from "@/components/icons";
import { PAISES_TELEFONO, banderaPais, labelPais } from "@/lib/telefono";

function Bandera({ iso }: { iso: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-5 shrink-0 rounded-[3px] bg-ink-100 bg-cover bg-center shadow-[0_0_0_1px_rgb(16_24_40/0.1)]"
      style={{ backgroundImage: `url(${banderaPais(iso)})` }}
    />
  );
}

// Selector de área (país): cerrado muestra la bandera y el código; la lista, además, el nombre.
export function PaisSelect({
  id,
  value,
  onChange,
  invalid = false,
  disabled = false,
  className = "",
}: {
  id: string;
  value: string;
  onChange: (codigo: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const actual = PAISES_TELEFONO.find((p) => p.codigo === value);

  useEffect(() => {
    if (!abierto) return;
    const cerrarAfuera = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    const cerrarConEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", cerrarAfuera);
    document.addEventListener("keydown", cerrarConEscape);
    return () => {
      document.removeEventListener("mousedown", cerrarAfuera);
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, [abierto]);

  return (
    <div ref={raiz} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={actual ? `Área (país): ${labelPais(actual)}` : "Área (país)"}
        onClick={() => setAbierto((a) => !a)}
        className={`flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-sm shadow-xs outline-none transition ${
          invalid
            ? "border-danger-400 focus:border-danger-500 focus:ring-2 focus:ring-danger-100"
            : "border-ink-300 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        } ${disabled ? "cursor-not-allowed bg-ink-50 text-ink-500" : "text-ink-900"}`}
      >
        {actual ? (
          <>
            <Bandera iso={actual.iso} />
            <span>{actual.codigo}</span>
          </>
        ) : (
          <span className="text-ink-400">Área</span>
        )}
        <IconChevronDown width={16} height={16} className="ml-auto shrink-0 text-ink-400" />
      </button>
      {abierto && (
        <ul
          role="listbox"
          aria-label="Área (país)"
          className="absolute left-0 top-full z-30 mt-1 max-h-64 w-64 overflow-auto rounded-lg border border-ink-200 bg-white py-1 shadow-lift"
        >
          {PAISES_TELEFONO.map((p) => (
            <li key={p.codigo} role="option" aria-selected={p.codigo === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(p.codigo);
                  setAbierto(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-ink-50 focus:bg-ink-50 focus:outline-none ${
                  p.codigo === value ? "bg-brand-50 font-medium text-brand-700" : "text-ink-800"
                }`}
              >
                <Bandera iso={p.iso} />
                <span className="flex-1">{p.nombre}</span>
                <span className="text-ink-500">{p.codigo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
