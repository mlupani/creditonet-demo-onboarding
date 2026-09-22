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
// creditonet-33: si hay garantes, se muestra sección por garante para recibo de sueldo (obligatorio) y otros documentos.
export function PantallaLegajo() {
  const {
    app,
    adjuntarDocumento,
    quitarArchivo,
    adjuntarReciboSueldo,
    quitarReciboSueldo,
    adjuntarOtroDocumento,
    quitarOtroDocumento,
  } = useApplication();
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [subiendoRecibo, setSubiendoRecibo] = useState<string | null>(null);
  const [subiendoOtro, setSubiendoOtro] = useState<string | null>(null);
  const docs = configEfectiva(app.configuracion).documentos;
  const archivos = app.postOferta.legajo;
  const obligatorios = docs.filter((d) => d.obligatorio);
  const cargados = obligatorios.filter((d) => (archivos[d.tipoId]?.length ?? 0) > 0).length;
  const completo = cargados === obligatorios.length;
  const garantes = app.postOferta.garantes;
  const garantesCompletos = garantes.filter((g) => (g.reciboSueldo?.length ?? 0) > 0).length;
  const legajoCompleto = completo && garantesCompletos === garantes.length;

  function adjuntar(tipoId: string) {
    setSubiendo(tipoId);
    window.setTimeout(() => {
      adjuntarDocumento(tipoId);
      setSubiendo(null);
    }, 900);
  }

  function adjuntarRecibo(id: string) {
    setSubiendoRecibo(id);
    window.setTimeout(() => {
      adjuntarReciboSueldo("garante", id);
      setSubiendoRecibo(null);
    }, 900);
  }

  function adjuntarOtro(id: string) {
    setSubiendoOtro(id);
    window.setTimeout(() => {
      adjuntarOtroDocumento("garante", id);
      setSubiendoOtro(null);
    }, 900);
  }

  return (
    <div className="space-y-5">
      {app.identificacion.tipoCliente === "NUEVO" && (
        <Banner tone="info" title="Firma física del cliente">
          {app.identificacion.firmaRegistrada
            ? "Si se carga una firma física en el legajo, se compara con el registro de firma que el cliente hizo al identificarse. Es sólo una referencia: no es la firma electrónica del crédito."
            : "En la identificación no se registró la firma del cliente, así que no habrá una referencia para comparar la firma física que se cargue al legajo."}
        </Banner>
      )}
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

      {garantes.length > 0 && (
        <Card>
          <CardHeader
            title="Documentación de garantes"
            description="Recibo de sueldo (obligatorio) y otros documentos por cada garante. Se movió aquí desde la pantalla de Garantías (creditonet-33)."
            icon={<IconFileText width={18} height={18} />}
            action={
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                  garantesCompletos === garantes.length
                    ? "border-success-200 bg-success-50 text-success-700"
                    : "border-warning-200 bg-warning-50 text-warning-700"
                }`}
              >
                {garantesCompletos === garantes.length && <IconCheckCircle width={13} height={13} />}
                {garantesCompletos} de {garantes.length} con recibo
              </span>
            }
          />
          <div className="space-y-3 p-5 sm:p-6">
            {garantes.map((g, idx) => {
              const nombre = [g.nombre, g.apellido].filter(Boolean).join(" ") || `Garante ${idx + 1}`;
              const recibos = g.reciboSueldo ?? [];
              const otros = g.otrosDocumentos ?? [];
              const tieneRecibo = recibos.length > 0;
              const reciboSubiendo = subiendoRecibo === g.id;
              const otroSubiendo = subiendoOtro === g.id;
              return (
                <div key={g.id} className="rounded-xl border border-ink-200 bg-white p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-ink-900">{nombre}</p>
                        <p className="text-xs text-ink-500">DNI {g.dni || "—"} · {g.vinculo || "sin vínculo"}</p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${
                        tieneRecibo ? "border-success-200 bg-success-50 text-success-700" : "border-warning-200 bg-warning-50 text-warning-700"
                      }`}
                    >
                      {tieneRecibo && <IconCheck width={12} height={12} strokeWidth={2.6} />}
                      {tieneRecibo ? "Recibo cargado" : "Recibo pendiente"}
                    </span>
                  </div>

                  {/* Recibo de sueldo - obligatorio */}
                  <div className="rounded-lg border border-ink-100 bg-ink-50/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-ink-700">
                          Recibo de sueldo <span className="text-danger-500">*</span>
                        </p>
                        <p className="text-xs text-ink-500">
                          {tieneRecibo ? `${recibos.length} archivo${recibos.length === 1 ? "" : "s"} adjunto${recibos.length === 1 ? "" : "s"}` : "Sin adjuntar todavía."}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => adjuntarRecibo(g.id)}
                        disabled={subiendoRecibo !== null || subiendoOtro !== null || subiendo !== null}
                        loading={reciboSubiendo}
                      >
                        {!reciboSubiendo && <IconUpload width={14} height={14} />}
                        {tieneRecibo ? "Agregar otro" : "Adjuntar recibo"}
                      </Button>
                    </div>
                    {!tieneRecibo && (
                      <p className="mt-1.5 text-xs font-medium text-danger-600">Adjuntá el recibo de sueldo del garante.</p>
                    )}
                    {tieneRecibo && (
                      <ul className="mt-2 space-y-1 rounded-lg border border-success-200 bg-success-50/60 p-2">
                        {recibos.map((a) => (
                          <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="flex items-center gap-1.5 truncate font-medium text-success-700">
                              <IconCheck width={13} height={13} strokeWidth={2.6} />
                              {a.nombre} · {a.detalle}
                            </span>
                            <Button size="sm" variant="ghost" onClick={() => quitarReciboSueldo("garante", g.id, a.id)}>
                              <IconTrash width={13} height={13} />
                              Quitar
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Otros documentos - opcional */}
                  <div className="mt-3 rounded-lg border border-ink-100 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-ink-700">Otros documentos</p>
                        <p className="text-xs text-ink-500">
                          {otros.length > 0 ? `${otros.length} archivo${otros.length === 1 ? "" : "s"} adjunto${otros.length === 1 ? "" : "s"}` : "Opcional — ej. DNI, comprobantes adicionales."}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => adjuntarOtro(g.id)}
                        disabled={subiendoOtro !== null || subiendoRecibo !== null || subiendo !== null}
                        loading={otroSubiendo}
                      >
                        {!otroSubiendo && <IconPlus width={14} height={14} />}
                        {otros.length > 0 ? "Agregar otro" : "Adjuntar"}
                      </Button>
                    </div>
                    {otros.length > 0 && (
                      <ul className="mt-2 space-y-1 rounded-lg border border-ink-200 bg-ink-50/60 p-2">
                        {otros.map((a) => (
                          <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate font-medium text-ink-700">
                              {a.nombre} · {a.detalle}
                            </span>
                            <Button size="sm" variant="ghost" onClick={() => quitarOtroDocumento("garante", g.id, a.id)}>
                              <IconTrash width={13} height={13} />
                              Quitar
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Banner tone={legajoCompleto ? "success" : "info"}>
        {legajoCompleto
          ? "Todos los documentos obligatorios están adjuntos."
          : garantes.length > 0 && garantesCompletos !== garantes.length
            ? `Falta el recibo de sueldo de ${garantes.length - garantesCompletos} garante${garantes.length - garantesCompletos === 1 ? "" : "s"}.`
            : "La carga es simulada. En el sistema real se validan formato, tamaño y legibilidad."}
      </Banner>
    </div>
  );
}
