"use client";

import { useState, type ReactNode } from "react";
import { fechaVisibleAnalista } from "@/lib/creditos-db";
import { ORGANISMOS, PRODUCTOS, SESION_ANALISTA, VENDEDORES, nombreOpcion } from "@/lib/config";
import { formatARS, formatDNI } from "@/lib/format";
import type { CreditApplication } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import {
  IconBarChart,
  IconBriefcase,
  IconCalendar,
  IconChevronDown,
  IconUser,
  IconWallet,
} from "@/components/icons";

function Seccion({ icono, titulo, children }: { icono: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-center gap-2 text-ink-500">
        {icono}
        <span className="text-[11px] font-bold uppercase tracking-widest">{titulo}</span>
      </div>
      <dl className="space-y-3">{children}</dl>
    </div>
  );
}

function Dato({ label, valor, fuerte = false }: { label: string; valor: ReactNode; fuerte?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className={`text-sm tabular-nums ${fuerte ? "text-base font-bold text-ink-900" : "text-ink-700"}`}>{valor}</dd>
    </div>
  );
}

// Fila colapsable de la bandeja del analista (vista "Lista"): cabecera resumida y, al
// expandir, la tarjeta con el detalle del crédito.
export function FilaCreditoCollapse({
  credito,
  onAbrir,
  enCurso = false,
}: {
  credito: CreditApplication;
  onAbrir: () => void;
  enCurso?: boolean;
}) {
  const [abierta, setAbierta] = useState(false);
  const cli = credito.cliente;

  if (!cli) return null;
  const cfg = credito.configuracion;
  const producto = nombreOpcion(PRODUCTOS, cfg.productoId);
  const organismo = nombreOpcion(ORGANISMOS, cfg.organismoId);
  const vendedor = nombreOpcion(VENDEDORES, cfg.vendedorId);
  const fecha = fechaVisibleAnalista(credito);
  const analista =
    credito.estado === "OBSERVADO" || !credito.analista.tomado ? "Sin asignar" : SESION_ANALISTA.nombre;
  const idPanel = `fila-${credito.numeroCredito ?? cli.dni}`;

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white shadow-card ${
        enCurso ? "border-brand-200" : "border-ink-200"
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={abierta}
        aria-controls={idPanel}
        onClick={() => setAbierta((v) => !v)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setAbierta((v) => !v);
          }
        }}
        className="flex cursor-pointer flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 transition hover:bg-ink-25 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600"
      >
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
            {cli.nombre.charAt(0)}
            {cli.apellido.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-bold tracking-tight text-ink-900">
              {cli.nombre} {cli.apellido}
              {enCurso && (
                <span className="ml-2 rounded bg-brand-600 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-white">
                  En curso
                </span>
              )}
            </p>
            <p className="truncate text-sm text-ink-500">DNI {formatDNI(cli.dni)}</p>
            <p className="truncate text-sm text-ink-500">ID Cliente: {credito.numeroCliente ?? "—"}</p>
          </div>
        </div>
        <div className="w-36 shrink-0 border-l border-ink-200 pl-6">
          <p className="text-xs text-ink-400">ID Crédito</p>
          <p className="font-mono text-sm font-bold text-brand-700">{credito.numeroCredito ?? "Sin ID"}</p>
        </div>
        <div className="flex w-40 shrink-0 justify-center">
          <EstadoBadge estado={credito.estado} />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onAbrir();
            }}
          >
            Abrir
          </Button>
          <IconChevronDown
            width={18}
            height={18}
            className={`text-ink-400 transition-transform ${abierta ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {abierta && (
        <div id={idPanel} className="animate-fade-up border-t border-ink-100">
          <div className="grid gap-6 px-5 py-5 sm:grid-cols-2 lg:grid-cols-5 lg:gap-0 lg:[&>*]:border-l lg:[&>*]:border-ink-100 lg:[&>*]:px-5 lg:[&>*:first-child]:border-l-0 lg:[&>*:first-child]:pl-0">
            <Seccion icono={<IconUser width={18} height={18} />} titulo="Cliente">
              <Dato label="Nombre" valor={`${cli.nombre} ${cli.apellido}`} />
              <Dato label="DNI" valor={formatDNI(cli.dni)} />
              <Dato label="ID Cliente" valor={credito.numeroCliente ?? "—"} />
            </Seccion>
            <Seccion icono={<IconBriefcase width={18} height={18} />} titulo="Producto">
              <Dato label="Producto" valor={producto} />
              <Dato label="Organismo" valor={organismo} />
            </Seccion>
            <Seccion icono={<IconWallet width={18} height={18} />} titulo="Financiación">
              <Dato label="Monto" valor={formatARS(credito.oferta.montoSolicitado)} fuerte />
              <Dato label="Cuota" valor={formatARS(credito.oferta.valorCuota)} fuerte />
              <Dato label="Cuotas" valor={credito.oferta.plazo} />
            </Seccion>
            <Seccion icono={<IconBarChart width={18} height={18} />} titulo="Estado">
              <div>
                <EstadoBadge estado={credito.estado} />
              </div>
            </Seccion>
            <Seccion icono={<IconCalendar width={18} height={18} />} titulo="Gestión">
              <Dato label="Fecha" valor={fecha ?? "—"} />
              <Dato label="Vendedor" valor={vendedor} />
              <Dato label="Analista" valor={analista} />
            </Seccion>
          </div>
        </div>
      )}
    </div>
  );
}
