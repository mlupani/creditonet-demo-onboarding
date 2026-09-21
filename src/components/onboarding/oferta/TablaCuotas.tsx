"use client";

import { useEffect, useRef, useState } from "react";
import { useApplication } from "@/lib/application-context";
import { SISTEMAS_AMORTIZACION } from "@/lib/config";
import { calcularCuota, grillaDe, planDeSolicitud } from "@/lib/credit";
import type { Plazo } from "@/lib/types";
import { formatARS, formatPct } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { IconArrowLeft, IconArrowRight, IconCheckCircle, IconExpand } from "@/components/icons";
import { GrillaCuotas } from "./GrillaCuotas";

// Placeholder de una cuota mientras se "recalcula" (delay ficticio, ver más abajo).
function SkeletonCuota() {
  return (
    <div className="rounded-xl border border-ink-200 p-4">
      <div className="h-3.5 w-14 animate-pulse rounded bg-ink-150" />
      <div className="mt-2.5 h-5 w-24 animate-pulse rounded bg-ink-150" />
      <div className="mt-2 h-3 w-20 animate-pulse rounded bg-ink-100" />
      <div className="mt-2 h-3 w-28 animate-pulse rounded bg-ink-100" />
    </div>
  );
}

export function TablaCuotas({
  pendiente = false,
  onSeleccion,
}: {
  pendiente?: boolean;
  onSeleccion?: () => void;
} = {}) {
  const { app, patchOferta } = useApplication();
  const o = app.oferta;
  // Plan y grilla de tasas de la solicitud: la TNA de cada plazo sale del plan.
  const plan = planDeSolicitud(app);
  const terms = grillaDe(plan);
  const [showAllPlazos, setShowAllPlazos] = useState(false);

  // Recalculo ficticio: cada cambio de monto muestra un skeleton 1 segundo para que se note
  const [recalculando, setRecalculando] = useState(false);
  // que las cuotas se están recalculando, en vez de cambiar el número de golpe.
  const montoAnterior = useRef(o.montoSolicitado);
  useEffect(() => {
    if (montoAnterior.current === o.montoSolicitado) return;
    montoAnterior.current = o.montoSolicitado;
    setRecalculando(true);
    const t = window.setTimeout(() => setRecalculando(false), 1000);
    return () => window.clearTimeout(t);
  }, [o.montoSolicitado]);

  // Indicadores de scroll horizontal: se muestran flecha y degradé sólo del lado que
  // todavía tiene opciones ocultas.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const actualizarScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    actualizarScrollState();
    window.addEventListener("resize", actualizarScrollState);
    return () => window.removeEventListener("resize", actualizarScrollState);
  }, [terms.length, recalculando]);

  function desplazar(direccion: 1 | -1) {
    scrollRef.current?.scrollBy({ left: direccion * 240, behavior: "smooth" });
  }

  // Al elegir una celda de la grilla se cambian capital y cuotas juntos. El carousel puede
  // tener ese plazo fuera de vista: se cierra el modal y se scrollea hasta él.
  function seleccionarDesdeGrilla(montoSolicitado: number, plazo: Plazo) {
    patchOferta({ montoSolicitado, plazo });
    onSeleccion?.();
    setShowAllPlazos(false);
    requestAnimationFrame(() => {
      scrollRef.current
        ?.querySelector<HTMLElement>(`[data-plazo="${plazo}"]`)
        ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink-900">
            Plan de cuotas · {plan.nombre}
          </h3>
          <p className="mt-0.5 text-xs text-ink-500">
            Alternativas válidas después de aplicar los límites. La selección define la cuota, el
            total y el primer vencimiento.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => setShowAllPlazos(true)}
        >
          <IconExpand width={14} height={14} />
          Ver grilla
        </Button>
      </div>

      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
        {[
          [
            "Sistema",
            (SISTEMAS_AMORTIZACION.find((s) => s.value === plan.sistema)?.label ?? plan.sistema)
              .split(" (")[0]
              .toLowerCase(),
          ],
          ["Gracia", `${plan.periodoGraciaDias} días`],
          ["IVA", plan.calculaIva ? formatPct(plan.ivaPct) : "no aplica"],
          ["Sellos", formatPct(plan.sellosPct)],
          [
            "Gasto de otorgamiento",
            `${
              plan.gastoOtorgamiento.tipo === "PORCENTAJE"
                ? formatPct(plan.gastoOtorgamiento.valor)
                : formatARS(plan.gastoOtorgamiento.valor)
            }${plan.gastoOtorgamiento.seCapitaliza ? " (se capitaliza)" : ""}`,
          ],
          ...(plan.cargoAdministrativoPct > 0
            ? [["Cargo administrativo", `${formatPct(plan.cargoAdministrativoPct)} s/cuota`]]
            : []),
        ].map(([label, valor]) => (
          <span key={label}>
            {label} <strong className="font-semibold text-ink-700">{valor}</strong>
          </span>
        ))}
      </p>

      {pendiente && (
        <div className="mt-3 rounded-lg border border-warning-300 bg-warning-50 px-3.5 py-2.5 text-xs font-medium text-warning-700">
          Cambió la renovación, así que la combinación anterior ya no existe: elegí de nuevo el
          plazo sobre los importes actualizados.
        </div>
      )}

      <div className="relative mt-5">
        {canScrollLeft && (
          <>
            <div className="pointer-events-none absolute -left-1 top-0 z-10 h-full w-10 bg-gradient-to-r from-white to-transparent" />
            <button
              type="button"
              onClick={() => desplazar(-1)}
              aria-label="Ver plazos anteriores"
              className="absolute left-0.5 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-600 shadow-sm hover:bg-ink-50"
            >
              <IconArrowLeft width={14} height={14} />
            </button>
          </>
        )}
        {canScrollRight && (
          <>
            <div className="pointer-events-none absolute -right-1 top-0 z-10 h-full w-10 bg-gradient-to-l from-white to-transparent" />
            <button
              type="button"
              onClick={() => desplazar(1)}
              aria-label="Ver más plazos"
              className="absolute right-0.5 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-600 shadow-sm hover:bg-ink-50"
            >
              <IconArrowRight width={14} height={14} />
            </button>
          </>
        )}
        <div
          ref={scrollRef}
          onScroll={actualizarScrollState}
          className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3 pt-3 scrollbar-thin scrollbar-thumb-ink-200"
        >
        {recalculando
          ? terms.map((term) => <SkeletonCuota key={term.plazo} />)
          : terms.map((term) => {
              const seleccionada = term.plazo === o.plazo && !pendiente;
              const cuota = calcularCuota(o.montoSolicitado, term.plazo, term.tna, plan.sistema);
              return (
                <button
                  key={term.plazo}
                  type="button"
                  data-plazo={term.plazo}
                  onClick={() => {
                    patchOferta({ plazo: term.plazo });
                    onSeleccion?.();
                  }}
                  className={`relative shrink-0 rounded-xl border p-4 pt-5 text-left transition-all w-56 ${
                    seleccionada
                      ? "border-brand-600 bg-brand-50/60 shadow-sm ring-1 ring-brand-600"
                      : "border-ink-200 bg-white hover:border-brand-300 hover:bg-brand-50/30"
                  }`}
                >
                  {term.recomendada && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                      Recomendada
                    </span>
                  )}
                  {seleccionada && (
                    <span className="absolute right-3 top-3 text-brand-600">
                      <IconCheckCircle width={17} height={17} />
                    </span>
                  )}
                  <p
                    className={`text-sm font-bold ${seleccionada ? "text-brand-700" : "text-ink-900"}`}
                  >
                    {term.plazo} cuotas
                  </p>
                  <p className="mt-1.5 text-lg font-bold tabular-nums text-ink-900">
                    {formatARS(cuota)}
                  </p>
                  <p className="text-xs text-ink-500">por mes · TNA {term.tna}%</p>
                  <p className="mt-1.5 text-[11px] text-ink-400">
                    1ª cuota:{" "}
                    <span className="font-semibold text-ink-600">{term.primeraCuota}</span>
                  </p>
                </button>
              );
            })}
        </div>
      </div>

      <Modal
        open={showAllPlazos}
        onClose={() => setShowAllPlazos(false)}
        title="Grilla de cuotas"
        maxWidth="max-w-5xl"
        footer={
          <Button variant="primary" onClick={() => setShowAllPlazos(false)}>
            Cerrar
          </Button>
        }
      >
        <p className="mb-3 text-xs text-ink-500">
          Cuota mensual de cada capital según la cantidad de cuotas, hasta el capital máximo de{" "}
          <strong className="font-semibold text-ink-700">{formatARS(o.capitalMaximoActual)}</strong>.
          Elegí una celda para seleccionar ese capital y ese plazo.
        </p>
        <GrillaCuotas
          terms={terms}
          sistema={plan.sistema}
          capitalMaximo={o.capitalMaximoActual}
          capital={o.montoSolicitado}
          plazo={o.plazo}
          seleccionable={!pendiente}
          onSeleccionar={seleccionarDesdeGrilla}
        />
      </Modal>
    </Card>
  );
}
