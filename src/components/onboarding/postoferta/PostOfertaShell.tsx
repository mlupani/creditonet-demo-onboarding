"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApplication } from "@/lib/application-context";
import { pantallasVisibles, resumenConfigProducto } from "@/lib/config";
import {
  estadoPantallasPostOferta,
  pendientesFinalizarCarga,
} from "@/lib/validation";
import type { PantallaPostOfertaId } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { StepperLibre, type PasoLibre } from "@/components/ui/StepperLibre";
import { DemoTag } from "@/components/ui/DemoTag";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCheck,
  IconCheckCircle,
} from "@/components/icons";

import { PantallaLaboral } from "./PantallaLaboral";
import { PantallaPersonales } from "./PantallaPersonales";
import { PantallaTokenizacion } from "./PantallaTokenizacion";
import { PantallaReferencias } from "./PantallaReferencias";
import { PantallaGarantias } from "./PantallaGarantias";
import { PantallaLegajo } from "./PantallaLegajo";
import { PantallaImpresion } from "./PantallaImpresion";

const PANTALLAS: Record<PantallaPostOfertaId, () => React.ReactNode> = {
  laboral: PantallaLaboral,
  personales: PantallaPersonales,
  tokenizacion: PantallaTokenizacion,
  referencias: PantallaReferencias,
  garantias: PantallaGarantias,
  legajo: PantallaLegajo,
  impresion: PantallaImpresion,
};

export function PostOfertaShell() {
  const router = useRouter();
  const {
    app,
    pantallaActual,
    setPantallaActual,
    visitarPantalla,
    finalizarCarga,
  } = useApplication();
  const [modal, setModal] = useState<"pendientes" | "ok" | null>(null);

  const visibles = useMemo(
    () => pantallasVisibles(app.configuracion.productoId),
    [app.configuracion.productoId]
  );
  const estados = useMemo(() => estadoPantallasPostOferta(app), [app]);
  const pendientes = useMemo(() => pendientesFinalizarCarga(app), [app]);
  const resumen = resumenConfigProducto(app.configuracion.productoId);
  const completadas = estados.filter((e) => e.completa).length;

  // Normaliza la pantalla actual si no está en las visibles.
  useEffect(() => {
    if (!visibles.some((p) => p.id === pantallaActual)) {
      setPantallaActual(visibles[0]?.id ?? "laboral");
    }
  }, [visibles, pantallaActual, setPantallaActual]);

  useEffect(() => {
    visitarPantalla(pantallaActual);
  }, [pantallaActual, visitarPantalla]);

  const pasos: PasoLibre[] = visibles.map((p) => {
    const est = estados.find((e) => e.id === p.id);
    return {
      id: p.id,
      label: p.label,
      obligatoria: p.obligatoria,
      completa: est?.completa ?? false,
    };
  });

  const PantallaActiva = PANTALLAS[pantallaActual];

  function onFinalizar() {
    setModal(pendientes.length === 0 ? "ok" : "pendientes");
  }

  function irA(id: PantallaPostOfertaId) {
    setPantallaActual(id);
    setModal(null);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="animate-fade-in flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
            Completar solicitud · Post-oferta
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">
            {app.cliente?.nombre} {app.cliente?.apellido} · {app.numeroCredito}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {completadas} de {estados.length} pantallas completas. Podés navegar libremente entre
            ellas.
          </p>
        </div>
        <Button size="lg" onClick={onFinalizar}>
          Finalizar carga
          <IconArrowRight width={16} height={16} />
        </Button>
      </div>

      <div className="mt-5">
        <StepperLibre pasos={pasos} actual={pantallaActual} onSelect={setPantallaActual} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div key={pantallaActual} className="animate-fade-up">
          <PantallaActiva />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                Configuración del producto
              </p>
              <DemoTag
                variant="config"
                detalle="La cantidad, el orden y la obligatoriedad de estas pantallas se definen por producto en Parámetros. En la demo la configuración es fija."
              />
            </div>
            <p className="mt-2 text-sm font-semibold text-ink-900">{resumen.nombre}</p>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-ink-50 py-2">
                <dt className="text-[10px] font-medium text-ink-500">Pantallas</dt>
                <dd className="text-base font-bold tabular-nums text-ink-900">{resumen.total}</dd>
              </div>
              <div className="rounded-lg bg-ink-50 py-2">
                <dt className="text-[10px] font-medium text-ink-500">Obligat.</dt>
                <dd className="text-base font-bold tabular-nums text-brand-700">
                  {resumen.obligatorias}
                </dd>
              </div>
              <div className="rounded-lg bg-ink-50 py-2">
                <dt className="text-[10px] font-medium text-ink-500">Opcion.</dt>
                <dd className="text-base font-bold tabular-nums text-ink-500">
                  {resumen.opcionales}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
              Estado de la carga
            </p>
            {pendientes.length === 0 ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-success-700">
                <IconCheckCircle width={15} height={15} />
                Todo completo. Podés finalizar.
              </p>
            ) : (
              <>
                <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-warning-700">
                  <IconAlertTriangle width={15} height={15} />
                  {pendientes.length}{" "}
                  {pendientes.length === 1 ? "elemento pendiente" : "elementos pendientes"}
                </p>
                <ul className="mt-2 space-y-1">
                  {pendientes.map((p, i) => (
                    <li key={`${p.pantallaId}-${p.campo}-${i}`}>
                      <button
                        type="button"
                        onClick={() => irA(p.pantallaId)}
                        className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs text-ink-600 transition hover:bg-ink-100 hover:text-brand-700"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning-500" />
                        <span className="font-medium">{p.pantallaLabel}</span>
                        <IconArrowRight width={11} height={11} className="text-ink-400" />
                        <span>{p.campo}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </aside>
      </div>

      <Modal
        open={modal === "pendientes"}
        onClose={() => setModal(null)}
        title="No se puede finalizar todavía"
        maxWidth="max-w-md"
        footer={
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setModal(null)}>
              Seguir cargando
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-600">
          Hay {pendientes.length}{" "}
          {pendientes.length === 1 ? "elemento pendiente" : "elementos pendientes"}. Tocá cada uno
          para ir directo a la pantalla y completarlo.
        </p>
        <ul className="mt-4 space-y-2">
          {pendientes.map((p, i) => (
            <li key={`${p.pantallaId}-${p.campo}-${i}`}>
              <button
                type="button"
                onClick={() => irA(p.pantallaId)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40"
              >
                <span>
                  <span className="block text-sm font-semibold text-ink-900">
                    {p.pantallaLabel}
                  </span>
                  <span className="block text-xs text-ink-500">{p.campo}</span>
                </span>
                <IconArrowRight width={16} height={16} className="text-brand-600" />
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={modal === "ok"}
        onClose={() => setModal(null)}
        title="Carga completa"
        maxWidth="max-w-md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setModal(null)}>
              Volver
            </Button>
            <Button
              variant="success"
              autoFocus
              onClick={() => {
                finalizarCarga();
                router.push("/analisis");
              }}
            >
              Continuar
            </Button>
          </div>
        }
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-600 text-white">
            <IconCheck width={20} height={20} strokeWidth={2.6} />
          </span>
          <p className="text-sm leading-relaxed text-ink-700">
            El crédito ha sido debidamente cargado y pasa a análisis de riesgo. El crédito dejará
            de aparecer en la bandeja del vendedor.
          </p>
        </div>
      </Modal>
    </div>
  );
}
