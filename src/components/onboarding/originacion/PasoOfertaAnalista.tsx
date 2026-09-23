"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { calcularCuota, getTerm, ofertaAnalistaDe, planDeSolicitud } from "@/lib/credit";
import { formatARS } from "@/lib/format";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconArrowRight } from "@/components/icons";

import { TablaCuotas } from "../oferta/TablaCuotas";
import { ComposicionCredito } from "../oferta/ComposicionCredito";
import { ConfirmarOfertaModal } from "../oferta/ConfirmarOfertaModal";

/**
 * Pantalla de oferta cuando el analista cambió la oferta y el vendedor retoma la solicitud.
 *
 * Todo lo demás queda bloqueado: sólo puede aceptar la oferta del analista o elegir otro valor
 * en la grilla, siempre con el mismo capital o menos y cualquier cantidad de cuotas. Al aceptar
 * pasa a la vista de sólo lectura de la solicitud completa, donde sólo queda finalizar.
 */
export function PasoOfertaAnalista() {
  const { app, aceptarOfertaAnalista } = useApplication();
  const [modal, setModal] = useState(false);
  const o = app.oferta;
  const analista = ofertaAnalistaDe(app);
  if (!analista) return null;

  const plan = planDeSolicitud(app);
  const cuotaAnalista = calcularCuota(
    analista.montoSolicitado,
    analista.plazo,
    getTerm(analista.plazo, plan).tna,
    plan.sistema
  );
  const esLaDelAnalista =
    o.montoSolicitado === analista.montoSolicitado && o.plazo === analista.plazo;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="flex flex-col gap-5">
          <Banner tone="warning" title="El analista cambió la oferta">
            {analista.nota}
          </Banner>

          <div className="overflow-hidden rounded-2xl shadow-card lg:sticky lg:top-[calc(4rem_+_var(--wizard-header-h,0px))] lg:z-30">
            <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-5 py-6 text-center sm:py-7">
              <p className="text-sm font-medium text-brand-100">
                Nueva oferta del analista · Capital máximo otorgable
              </p>
              <p className="mt-1.5 text-4xl font-bold tracking-tight tabular-nums text-white sm:text-5xl">
                {formatARS(analista.montoSolicitado)}
              </p>
              <p className="mt-2 text-sm font-semibold text-brand-50">
                {analista.plazo} cuotas de {formatARS(cuotaAnalista)}
              </p>
            </div>
          </div>

          <Card className="p-5 sm:p-6">
            <p className="text-xs text-ink-500">
              Podés aceptar la oferta del analista o elegir otro valor en la grilla, siempre con el
              mismo capital o menos y cualquier cantidad de cuotas del plan.
            </p>
            <p className="mt-3 rounded-lg border border-brand-200 bg-brand-50/60 px-3.5 py-2.5 text-sm text-brand-800">
              {esLaDelAnalista ? "Oferta seleccionada" : "Oferta elegida"}:{" "}
              <strong className="tabular-nums">
                {formatARS(o.montoSolicitado)} en {o.plazo} cuotas de {formatARS(o.valorCuota)}
              </strong>
            </p>
          </Card>

          <TablaCuotas tope={{ capital: analista.montoSolicitado }} />

          <Card className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Button
                size="lg"
                variant="success"
                onClick={() => setModal(true)}
                className="sm:w-auto"
              >
                {esLaDelAnalista ? "Aceptar oferta del analista" : "Aceptar oferta elegida"}
                <IconArrowRight width={16} height={16} />
              </Button>
            </div>
            <p className="mt-3 border-t border-ink-100 pt-3 text-[11px] text-ink-400">
              Al aceptar se muestra la solicitud completa, sin poder editarla, para finalizar y
              reenviarla al analista.
            </p>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-[calc(4rem_+_var(--wizard-header-h,0px))] lg:z-30 lg:self-start">
          <ComposicionCredito />
        </aside>
      </div>

      <ConfirmarOfertaModal
        open={modal}
        reenvio
        onClose={() => setModal(false)}
        onConfirm={() => {
          setModal(false);
          aceptarOfertaAnalista();
        }}
      />
    </div>
  );
}
