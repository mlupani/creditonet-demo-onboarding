"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import {
  importeTerceros,
  netoAAcreditar,
  ofertaExcedeMaximo,
  totalPrecancelaciones,
} from "@/lib/credit";
import { formatARS } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
import { IconArrowLeft, IconCheck } from "@/components/icons";

import { OfertaCabecera } from "../oferta/OfertaCabecera";
import { MontoSolicitado } from "../oferta/MontoSolicitado";
import { TablaCuotas } from "../oferta/TablaCuotas";
import { CreditosActivos } from "../oferta/CreditosActivos";
import { DeudaTerceros } from "../oferta/DeudaTerceros";
import { ComposicionCredito } from "../oferta/ComposicionCredito";
import { SeleccionFinal } from "../oferta/SeleccionFinal";
import { ConfirmarOfertaModal } from "../oferta/ConfirmarOfertaModal";

export function PasoOferta() {
  const { app, paso, setPaso, aceptarOferta } = useApplication();
  const [modal, setModal] = useState(false);
  const o = app.oferta;

  const excede = ofertaExcedeMaximo(o);
  const neto = netoAAcreditar(o);
  const bloqueado = excede || neto < 0 || o.montoSolicitado <= 0;
  const razon = excede
    ? `Reducí el importe: supera el capital máximo de ${formatARS(o.capitalMaximoActual)}.`
    : neto < 0
      ? "El neto a acreditar es negativo. Ajustá el importe o las cancelaciones."
      : o.montoSolicitado <= 0
        ? "Ingresá el importe del préstamo."
        : null;

  const precancel = totalPrecancelaciones(o);
  const terceros = importeTerceros(o);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-5">
        <OfertaCabecera />
        <MontoSolicitado />
        <TablaCuotas />
        <CreditosActivos />
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
              disabled={bloqueado}
              onClick={() => setModal(true)}
              className="sm:w-auto"
            >
              <IconCheck width={16} height={16} />
              Aceptar oferta
            </Button>
          </div>
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <SummaryCard
          title="Resumen del crédito"
          rows={[
            { label: "Capital", value: formatARS(o.montoSolicitado), strong: true },
            ...(precancel > 0
              ? [{ label: "Precancelación", value: `−${formatARS(precancel)}`, tone: "danger" as const }]
              : []),
            ...(terceros > 0
              ? [{ label: "Terceros", value: `−${formatARS(terceros)}`, tone: "danger" as const }]
              : []),
            {
              label: "Neto",
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
