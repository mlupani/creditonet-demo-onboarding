"use client";

import type { ReactNode } from "react";

// Kit visual compacto del módulo Caja y Bancos, tomado de las vistas de ejemplo de los documentos
// funcionales: tablas con encabezado azul marino y grilla fina, texto chico, estados como pastillas
// de colores, campos con etiqueta en mayúsculas y botones con contorno de color.

// Fases de un estado, con el mismo código de colores de los diagramas de estados del documento.
export type Fase = "inicial" | "proceso" | "espera" | "ok" | "rechazo";

const FASE: Record<Fase, string> = {
  inicial: "border-ink-400 bg-ink-25 text-ink-700",
  proceso: "border-brand-500 bg-brand-50 text-brand-700",
  espera: "border-warning-600 bg-warning-50 text-warning-700",
  ok: "border-success-600 bg-success-50 text-success-700",
  rechazo: "border-danger-600 bg-danger-50 text-danger-700",
};

// Estado como pastilla de color: gris = inicial, azul = en proceso, ámbar = espera o reservado,
// verde = final OK, rojo = rechazo o anulación.
export function Pill({ fase, children, className = "" }: { fase: Fase; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-px text-[10.5px] font-bold leading-4 ${FASE[fase]} ${className}`}
    >
      {children}
    </span>
  );
}

// Punto de color para estados sencillos (Abierta, Cerrada, Con pendientes…).
export function Punto({ fase, children }: { fase: Fase; children: ReactNode }) {
  const color: Record<Fase, string> = {
    inicial: "bg-ink-400",
    proceso: "bg-brand-500",
    espera: "bg-warning-600",
    ok: "bg-success-600",
    rechazo: "bg-danger-600",
  };
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden className={`h-2 w-2 rounded-full ${color[fase]}`} />
      {children}
    </span>
  );
}

// Clases del encabezado y de las celdas de las tablas compactas.
export const TH = "border border-navy-700 bg-navy-800 px-2.5 py-1.5 text-left text-[11px] font-bold text-white";
export const TD = "border border-ink-200 px-2.5 py-1.5 align-top text-ink-800";
export const TD_NUM = `${TD} text-right tabular-nums`;

export function Th({ children, derecha, className = "" }: { children?: ReactNode; derecha?: boolean; className?: string }) {
  return (
    <th scope="col" className={`${TH} ${derecha ? "text-right" : ""} ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, derecha, className = "", colSpan }: { children?: ReactNode; derecha?: boolean; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={`${TD} ${derecha ? "text-right tabular-nums" : ""} ${className}`}>
      {children}
    </td>
  );
}

// Tabla compacta con contenedor que se desplaza dentro de la pantalla, nunca la página.
export function TablaCompacta({
  etiqueta,
  minWidth = "min-w-[40rem]",
  children,
}: {
  etiqueta: string;
  minWidth?: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-ink-300 bg-white">
      <table aria-label={etiqueta} className={`w-full border-collapse text-xs ${minWidth}`}>
        {children}
      </table>
    </div>
  );
}

// Panel con barra de título gris (por ejemplo "Bandeja › Proveedores"), como las vistas del documento.
export function PanelVentana({
  titulo,
  accion,
  children,
  className = "",
}: {
  titulo: ReactNode;
  accion?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-lg border border-ink-300 bg-white ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-ink-300 bg-ink-100 px-3 py-1.5 text-[11px] font-semibold text-ink-600">
        <span>{titulo}</span>
        {accion}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

// Banda de color con el nombre de una sección (un color por botón de la Bandeja).
export function BandaSeccion({
  numero,
  titulo,
  color,
  children,
}: {
  numero?: number | string;
  titulo: string;
  color: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5 rounded-md px-3.5 py-2 text-white" style={{ backgroundColor: color }}>
        {numero !== undefined && <span className="text-base font-bold leading-none">{numero}</span>}
        <h2 className="text-sm font-bold leading-none">{titulo}</h2>
      </div>
      {children && <p className="mt-2 max-w-4xl text-xs leading-relaxed text-ink-600">{children}</p>}
    </div>
  );
}

// Campo con la etiqueta chica en mayúsculas y el control debajo.
export function Campo({ label, children, className = "", ayuda }: { label: string; children: ReactNode; className?: string; ayuda?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-500">{label}</span>
      {children}
      {ayuda && <span className="mt-1 block text-[11px] text-ink-500">{ayuda}</span>}
    </label>
  );
}

// Dato de solo lectura con el mismo formato que un campo (cajita gris).
export function CampoLectura({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-500">{label}</span>
      <div className="min-h-8 rounded-md border border-ink-200 bg-ink-25 px-2.5 py-1.5 text-xs text-ink-800">{children}</div>
    </div>
  );
}

export const INPUT_COMPACTO =
  "h-8 w-full rounded-md border border-ink-300 bg-ink-25 px-2.5 text-xs text-ink-800 outline-none transition hover:border-ink-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:text-ink-400";

// Colores de identidad de cada botón de la Bandeja de autorizaciones.
export const COLOR_BANDEJA = {
  proveedores: "#92400e",
  prestamos: "#166534",
  remesas: "#0f766e",
  comprobantes: "#334155",
  transferencias: "#1d4ed8",
  pendientes: "#991b1b",
} as const;

// Cuadro de resumen (saldo esperado, contado, diferencia…) con borde de color según el tono.
export function Cifra({
  label,
  children,
  tono = "neutro",
  className = "",
}: {
  label: string;
  children: ReactNode;
  tono?: "neutro" | "malo" | "bueno";
  className?: string;
}) {
  const borde = tono === "malo" ? "border-danger-600" : tono === "bueno" ? "border-success-600" : "border-ink-300";
  const texto = tono === "malo" ? "text-danger-700" : "text-ink-900";
  return (
    <div className={`rounded-lg border bg-white px-3 py-2 ${borde} ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={`mt-0.5 text-base font-bold tabular-nums ${texto}`}>{children}</p>
    </div>
  );
}
