"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { configEfectiva } from "@/lib/config";
import { getTipoDocumento } from "@/lib/parametros";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import {
  IconCheck,
  IconCheckCircle,
  IconClock,
  IconFileText,
  IconPlus,
  IconTrash,
  IconUpload,
} from "@/components/icons";

const chip = "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";

// Pantalla 6 · Legajo virtual (Onboarding §9): un botón por tipo de documento de Parámetros,
// con obligatoriedad y carga de una o varias imágenes configuradas por producto.
export function PantallaLegajo() {
  const { app, adjuntarDocumento, quitarArchivo } = useApplication();
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const docs = configEfectiva(app.configuracion).documentos;
  const archivos = app.postOferta.legajo;
  const obligatorios = docs.filter((d) => d.obligatorio);
  const cargados = obligatorios.filter((d) => (archivos[d.tipoId]?.length ?? 0) > 0).length;
  const completo = cargados === obligatorios.length;

  function adjuntar(tipoId: string) {
    setSubiendo(tipoId);
    window.setTimeout(() => {
      adjuntarDocumento(tipoId);
      setSubiendo(null);
    }, 900);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Legajo virtual"
          description="Imágenes y documentos solicitados al cliente. Cada tipo de documento se define en Parámetros."
          icon={<IconFileText width={18} height={18} />}
          action={
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                completo
                  ? "border-success-200 bg-success-50 text-success-700"
                  : "border-warning-200 bg-warning-50 text-warning-700"
              }`}
            >
              {completo && <IconCheckCircle width={13} height={13} />}
              {cargados} de {obligatorios.length} obligatorios
            </span>
          }
        />
        <ul className="space-y-2.5 p-5 sm:p-6">
          {docs.map((d) => {
            const tipo = getTipoDocumento(d.tipoId);
            const lista = archivos[d.tipoId] ?? [];
            const cargado = lista.length > 0;
            const esteSubiendo = subiendo === d.tipoId;
            return (
              <li
                key={d.tipoId}
                className={`rounded-xl border p-4 transition-all ${
                  cargado
                    ? "border-success-200 bg-success-50/60"
                    : esteSubiendo
                      ? "animate-pulse border-brand-200 bg-brand-50/60"
                      : "border-ink-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                      cargado
                        ? "border-success-200 bg-success-100 text-success-600"
                        : "border-ink-200 bg-ink-50 text-ink-400"
                    }`}
                  >
                    {cargado ? (
                      <IconCheck width={18} height={18} strokeWidth={2.5} />
                    ) : esteSubiendo ? (
                      <IconUpload width={18} height={18} />
                    ) : (
                      <IconClock width={18} height={18} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
                      {tipo.nombre}
                      <span className={`${chip} bg-ink-100 text-ink-500`}>{tipo.categoria}</span>
                      <span
                        className={`${chip} ${
                          d.obligatorio ? "bg-danger-50 text-danger-700" : "bg-ink-50 text-ink-400"
                        }`}
                      >
                        {d.obligatorio ? "Obligatorio" : "Opcional"}
                      </span>
                      <span className={`${chip} bg-brand-50 text-brand-700`}>
                        {d.multiple ? "Varias imágenes" : "Una imagen"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {cargado
                        ? `${lista.length} archivo${lista.length === 1 ? "" : "s"} adjunto${lista.length === 1 ? "" : "s"}`
                        : esteSubiendo
                          ? "Subiendo documento…"
                          : "Pendiente de adjuntar"}
                    </p>
                  </div>
                  {(!cargado || d.multiple) && (
                    <Button
                      size="sm"
                      variant={cargado ? "ghost" : "outline"}
                      onClick={() => adjuntar(d.tipoId)}
                      disabled={subiendo !== null}
                      loading={esteSubiendo}
                    >
                      {cargado && !esteSubiendo && <IconPlus width={14} height={14} />}
                      {cargado ? "Agregar imagen" : "Adjuntar"}
                    </Button>
                  )}
                </div>
                {cargado && (
                  <ul className="mt-3 space-y-1 border-t border-success-200/70 pt-2">
                    {lista.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium text-success-700">
                          {a.nombre} · {a.detalle}
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => quitarArchivo(d.tipoId, a.id)}>
                          <IconTrash width={13} height={13} />
                          Quitar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Banner tone={completo ? "success" : "info"}>
        {completo
          ? "Todos los documentos obligatorios están adjuntos."
          : "La carga es simulada. En el sistema real se validan formato, tamaño y legibilidad."}
      </Banner>
    </div>
  );
}
