"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApplication } from "@/lib/application-context";
import {
  calcularCuota,
  cambiosOfertaDe,
  getTerm,
  ofertaAnalistaDe,
  planDeSolicitud,
} from "@/lib/credit";
import { formatARS } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmationModal } from "@/components/ConfirmationModal";
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
 *
 * Si el cambio lo hizo el analista desde la grilla, no hay nada que elegir: el vendedor ve
 * únicamente la oferta y la acepta o la declina (declinar anula la solicitud).
 */
export function PasoOfertaAnalista() {
  const router = useRouter();
  const { app, aceptarOfertaAnalista, anularCredito, rechazarCredito } = useApplication();
  const [modal, setModal] = useState(false);
  const [declinarAbierto, setDeclinarAbierto] = useState(false);
  const [rechazarAbierto, setRechazarAbierto] = useState(false);
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

  const porGrilla = cambiosOfertaDe(app).at(-1)?.tipo === "OFERTA";

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="flex flex-col gap-5">
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

          {!porGrilla && (
            <>
              <Card className="p-5 sm:p-6">
                <p className="text-xs text-ink-500">
                  Podés aceptar la oferta del analista o elegir otro valor en la grilla, siempre con
                  el mismo capital o menos y cualquier cantidad de cuotas del plan.
                </p>
                <p className="mt-3 rounded-lg border border-brand-200 bg-brand-50/60 px-3.5 py-2.5 text-sm text-brand-800">
                  {esLaDelAnalista ? "Oferta seleccionada" : "Oferta elegida"}:{" "}
                  <strong className="tabular-nums">
                    {formatARS(o.montoSolicitado)} en {o.plazo} cuotas de {formatARS(o.valorCuota)}
                  </strong>
                </p>
              </Card>

              <TablaCuotas tope={{ capital: analista.montoSolicitado }} />
            </>
          )}

          <Card className="p-4 sm:p-5">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              {porGrilla && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setDeclinarAbierto(true)}
                  className="sm:w-auto"
                >
                  Declinar oferta
                </Button>
              )}
              <Button
                size="lg"
                variant="danger"
                onClick={() => setRechazarAbierto(true)}
                className="sm:w-auto"
              >
                Rechazar oferta
              </Button>
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
              {porGrilla
                ? "Al aceptar se muestra la solicitud completa, sin poder editarla, para finalizar y reenviarla al analista. Si la declinás, la solicitud se anula."
                : "Al aceptar se muestra la solicitud completa, sin poder editarla, para finalizar y reenviarla al analista."}
            </p>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-[calc(4rem_+_var(--wizard-header-h,0px))] lg:z-30 lg:self-start">
          <ComposicionCredito />
        </aside>
      </div>

      <ConfirmationModal
        open={declinarAbierto}
        title="¿Declinar la oferta del analista?"
        descripcion="La solicitud queda anulada: el cliente no acepta la nueva oferta. Esta acción no se puede deshacer."
        rows={[
          { label: "ID de Crédito", value: app.numeroCredito ?? "—" },
          {
            label: "Oferta del analista",
            value: `${formatARS(analista.montoSolicitado)} en ${analista.plazo} cuotas de ${formatARS(cuotaAnalista)}`,
          },
        ]}
        confirmLabel="Declinar y anular"
        cancelLabel="Volver"
        tone="danger"
        onConfirm={() => {
          setDeclinarAbierto(false);
          anularCredito("El cliente declinó el cambio de oferta del analista.");
          router.push("/");
        }}
        onCancel={() => setDeclinarAbierto(false)}
      />

      <ConfirmationModal
        open={rechazarAbierto}
        title="¿Rechazar la oferta del analista?"
        descripcion="La solicitud queda rechazada: el cliente no acepta la nueva oferta. Esta acción no se puede deshacer."
        rows={[
          { label: "ID de Crédito", value: app.numeroCredito ?? "—" },
          {
            label: "Oferta del analista",
            value: `${formatARS(analista.montoSolicitado)} en ${analista.plazo} cuotas de ${formatARS(cuotaAnalista)}`,
          },
        ]}
        confirmLabel="Rechazar oferta"
        cancelLabel="Volver"
        tone="danger"
        onConfirm={() => {
          setRechazarAbierto(false);
          rechazarCredito(
            "RA-04",
            "Otro motivo (detallar en la observación)",
            `El cliente rechazó la oferta del analista: ${formatARS(analista.montoSolicitado)} en ${analista.plazo} cuotas.`
          );
          router.push("/");
        }}
        onCancel={() => setRechazarAbierto(false)}
      />

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
