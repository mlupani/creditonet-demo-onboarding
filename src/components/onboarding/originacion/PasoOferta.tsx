"use client";

import { useEffect, useRef, useState } from "react";
import { useApplication } from "@/lib/application-context";
import {
  cancelacionesExcedenCapital,
  importeTerceros,
  netoAAcreditar,
  ofertaExcedeMaximo,
  totalPrecancelaciones,
} from "@/lib/credit";
import { validarDeudaTerceros } from "@/lib/validation";
import { formatARS } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoTag } from "@/components/ui/DemoTag";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
import { IconArrowLeft, IconArrowRight, IconRefresh } from "@/components/icons";

import { OfertaCabecera } from "../oferta/OfertaCabecera";
import { MontoSolicitado } from "../oferta/MontoSolicitado";
import { TablaCuotas } from "../oferta/TablaCuotas";
import { CreditosActivos } from "../oferta/CreditosActivos";
import { DeudaTerceros } from "../oferta/DeudaTerceros";
import { ComposicionCredito } from "../oferta/ComposicionCredito";
import { SeleccionFinal } from "../oferta/SeleccionFinal";
import { ConfirmarOfertaModal } from "../oferta/ConfirmarOfertaModal";

export function PasoOferta() {
  const { app, paso, setPaso, aceptarOferta, patchOferta, togglePrecancelar } = useApplication();
  const o = app.oferta;
  const [modal, setModal] = useState(false);
  const [borrador, setBorrador] = useState(o.montoSolicitado);
  // El importe también cambia desde afuera (una cancelación rearma la oferta): el borrador
  // lo acompaña para no quedar mostrando un monto viejo ni bloquear la aceptación.
  const [montoPrevio, setMontoPrevio] = useState(o.montoSolicitado);
  if (o.montoSolicitado !== montoPrevio) {
    setMontoPrevio(o.montoSolicitado);
    setBorrador(o.montoSolicitado);
  }
  const [recalculado, setRecalculado] = useState(false);
  const [reevaluandoId, setReevaluandoId] = useState<string | null>(null);
  // Cambiar la renovación invalida la combinación elegida: hay que volver a seleccionar
  // el plazo contra la oferta nueva (reunión 11/09, 43:06-45:21).
  const [plazoPendiente, setPlazoPendiente] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  // Recálculo contra la grilla del plan, sin volver al motor (Guía §5.2).
  function recalcular() {
    patchOferta({ montoSolicitado: borrador });
    setRecalculado(true);
  }

  // Precancelar sobre la primera oferta modifica el monto y recalcula la oferta (Plan §9).
  function toggleRenovacion(id: string) {
    setReevaluandoId(id);
    timer.current = window.setTimeout(() => {
      togglePrecancelar(id);
      setReevaluandoId(null);
      setPlazoPendiente(true);
    }, 1100);
  }

  const pendienteRecalculo = borrador !== o.montoSolicitado;
  const errTerceros = validarDeudaTerceros(o.deudaTerceros);
  const razon = reevaluandoId
    ? "Esperá a que termine el recálculo de la oferta."
    : plazoPendiente
      ? "Cambiaron las condiciones: volvé a elegir el plazo sobre la oferta actualizada."
      : pendienteRecalculo
      ? borrador > o.capitalMaximoActual
        ? `El importe supera el capital máximo de ${formatARS(o.capitalMaximoActual)}.`
        : "Presioná Recalcular para aplicar el nuevo importe."
      : o.montoSolicitado <= 0
        ? "Ingresá el importe del préstamo."
        : ofertaExcedeMaximo(o)
          ? `Reducí el importe: supera el capital máximo de ${formatARS(o.capitalMaximoActual)}.`
          : cancelacionesExcedenCapital(o)
            ? "Las cancelaciones superan el capital solicitado. Ajustá el capital o quitá cancelaciones."
            : Object.keys(errTerceros).length > 0
              ? "Completá la entidad, el monto y el CBU de la deuda con terceros."
              : null;

  const neto = netoAAcreditar(o);
  const precancel = totalPrecancelaciones(o);
  const terceros = importeTerceros(o);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-5">
        <OfertaCabecera />
        <MontoSolicitado
          borrador={borrador}
          onBorrador={(v) => {
            setBorrador(v);
            setRecalculado(false);
          }}
          onRecalcular={recalcular}
          recalculado={recalculado}
        />
        <TablaCuotas
          pendiente={plazoPendiente}
          onSeleccion={() => setPlazoPendiente(false)}
        />
        <div className="pt-2">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-600">
            <IconRefresh width={12} height={12} />
            Opcional · sobre la primera oferta
          </p>
          <h2 className="mt-0.5 text-base font-bold tracking-tight text-ink-900">
            ¿Desea precancelar créditos?
          </h2>
          <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-ink-500">
            Si el cliente cancela créditos propios o deudas con terceros se modifica el monto y se
            recalcula una nueva oferta, que vuelve a respetar todos los límites.
          </p>
        </div>
        <CreditosActivos reevaluandoId={reevaluandoId} onToggle={toggleRenovacion} />
        <DeudaTerceros />
        <SeleccionFinal />

        <Card className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" onClick={() => setPaso(paso - 1)} className="sm:w-auto">
              <IconArrowLeft width={16} height={16} />
              Atrás
            </Button>
            <div className="min-w-0 flex-1 sm:mx-4">
              {razon && (
                <ValidationMessage tipo="warning" className="!mt-0 justify-start">
                  {razon}
                </ValidationMessage>
              )}
            </div>
            <Button
              size="lg"
              variant="success"
              disabled={razon !== null}
              onClick={() => setModal(true)}
              className="sm:w-auto"
            >
              Aceptar oferta
              <IconArrowRight width={16} height={16} />
            </Button>
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3 text-[11px] text-ink-400">
            Al aceptar se confirma la oferta y se habilita la carga post-oferta.
            <DemoTag
              variant="regla"
              detalle="El orden exacto entre la confirmación de la oferta, la precancelación y las 7 pantallas post-oferta está pendiente de confirmación funcional (Arquitectura §16). La demo ofrece la precancelación antes de confirmar."
            />
          </p>
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <SummaryCard
          title="Resumen del crédito"
          rows={[
            { label: "Capital solicitado", value: formatARS(o.montoSolicitado), strong: true },
            ...(precancel > 0
              ? [
                  {
                    label: "Renovación",
                    value: `−${formatARS(precancel)}`,
                    tone: "danger" as const,
                  },
                ]
              : []),
            ...(terceros > 0
              ? [{ label: "Terceros", value: `−${formatARS(terceros)}`, tone: "danger" as const }]
              : []),
            {
              label: "Acreditación neta",
              value: formatARS(neto),
              tone: neto >= 0 ? ("success" as const) : ("danger" as const),
              big: true,
            },
            { label: `Cuota (${o.plazo}x)`, value: formatARS(o.valorCuota) },
            { label: "TNA", value: `${o.tna}%` },
            { label: "Total a pagar", value: formatARS(o.totalAPagar) },
            { label: "1ª cuota", value: o.primeraCuotaVencimiento },
          ]}
        />
        <ComposicionCredito />
      </aside>

      <ConfirmarOfertaModal
        open={modal}
        onClose={() => setModal(false)}
        onConfirm={() => {
          setModal(false);
          aceptarOferta();
        }}
      />
    </div>
  );
}
