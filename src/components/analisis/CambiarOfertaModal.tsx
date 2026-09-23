"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import type { CambioOferta } from "@/lib/application-context";
import {
  calcularCuota,
  getTerm,
  grillaDe,
  importeTerceros,
  planDeSolicitud,
  totalPrecancelaciones,
} from "@/lib/credit";
import { formatARS } from "@/lib/format";
import type { Plazo } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { RequiredBadge } from "@/components/ui/RequiredBadge";
import { Banner } from "@/components/ui/Banner";
import { GrillaCuotas } from "@/components/onboarding/oferta/GrillaCuotas";
import { IconExpand } from "@/components/icons";

/**
 * Cambio de oferta del analista (reunión 11/09, 01:14–01:35).
 *
 * El capital actual es el techo: el capital máximo y las cuotas vigentes se muestran como texto y
 * el analista sólo puede bajar el capital eligiendo una celda de la grilla (mismo capital o
 * menos, con cualquier cantidad de cuotas del plan). La condición dura es que el monto a liquidar quede por encima de cero: si
 * las cancelaciones se comen el capital nuevo, la operación no se puede cambiar y corresponde
 * rechazarla ("el nuevo monto no permite la precancelación").
 *
 * Un cambio de oferta requiere la refrendación del supervisor: al confirmar queda pendiente y
 * recién cuando lo refrenda el crédito vuelve al canal de venta en estado Observado con el
 * nuevo importe. El vendedor sólo puede aceptarlo o elegir otra oferta menor.
 */
export function CambiarOfertaModal({
  open,
  onClose,
  onConfirmar,
}: {
  open: boolean;
  onClose: () => void;
  onConfirmar: (cambio: CambioOferta) => void;
}) {
  const { app } = useApplication();
  const o = app.oferta;
  const plan = planDeSolicitud(app);
  const terms = grillaDe(plan);

  const [monto, setMonto] = useState(o.montoSolicitado);
  const [plazo, setPlazo] = useState<Plazo>(o.plazo);
  const [grillaAbierta, setGrillaAbierta] = useState(false);
  const [nota, setNota] = useState("");
  const [intentado, setIntentado] = useState(false);

  const precancel = totalPrecancelaciones(o);
  const terceros = importeTerceros(o);
  const netoALiquidar = monto - precancel - terceros;
  const term = getTerm(plazo, plan);
  const nuevaCuota = calcularCuota(monto, plazo, term.tna, plan.sistema);
  const cambio = monto !== o.montoSolicitado || plazo !== o.plazo;

  const errorLiquidar =
    netoALiquidar <= 0
      ? "Con este capital el monto a liquidar queda en cero o negativo: el nuevo monto no permite la precancelación. Corresponde rechazar la solicitud."
      : null;
  const notaValida = nota.trim().length >= 5;
  const puedeConfirmar = cambio && !errorLiquidar && monto > 0 && notaValida;

  function confirmar() {
    setIntentado(true);
    if (!puedeConfirmar) return;
    onConfirmar({ montoSolicitado: monto, plazo, nota: nota.trim() });
  }

  return (
    <>
      <Modal
        open={open}
        onClose={grillaAbierta ? () => {} : onClose}
        title="Cambiar la oferta"
        maxWidth="max-w-lg"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={confirmar}>
              Enviar a refrendación
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-600">
          Sólo se puede bajar el capital: elegí en la grilla un capital igual o menor, con la
          cantidad de cuotas que corresponda. El cambio <strong>requiere la refrendación del supervisor</strong>:
          recién entonces la solicitud vuelve al vendedor en estado <strong>Observado</strong> con
          la nueva oferta.
        </p>

        <dl className="mt-4 divide-y divide-ink-100 rounded-xl border border-ink-200 bg-ink-25">
          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="text-sm text-ink-500">Capital máximo</dt>
            <dd className="text-sm font-semibold tabular-nums text-ink-900">
              {formatARS(o.montoSolicitado)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="text-sm text-ink-500">Plazo</dt>
            <dd className="text-sm font-semibold tabular-nums text-ink-900">
              {o.plazo} cuotas de {formatARS(o.valorCuota)}
            </dd>
          </div>
        </dl>

        <Button variant="outline" className="mt-4 w-full" onClick={() => setGrillaAbierta(true)}>
          <IconExpand width={16} height={16} />
          Abrir grilla para cambiar la oferta
        </Button>

        {cambio && (
          <div className="mt-4 divide-y divide-ink-100 rounded-xl border border-brand-200 bg-brand-50/50">
            <div className="flex items-center justify-between gap-4 px-4 py-2.5">
              <span className="text-sm text-ink-500">Nueva oferta</span>
              <span className="text-sm font-semibold tabular-nums text-ink-900">
                {formatARS(monto)} en {plazo} cuotas de {formatARS(nuevaCuota)}
              </span>
            </div>
            {precancel > 0 && (
              <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                <span className="text-sm text-ink-500">Renovación de créditos propios</span>
                <span className="text-sm font-semibold tabular-nums text-danger-600">
                  −{formatARS(precancel)}
                </span>
              </div>
            )}
            {terceros > 0 && (
              <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                <span className="text-sm text-ink-500">Cancelación a terceros</span>
                <span className="text-sm font-semibold tabular-nums text-danger-600">
                  −{formatARS(terceros)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 px-4 py-2.5">
              <span className="text-sm font-medium text-ink-700">Monto a liquidar</span>
              <span
                className={`text-base font-bold tabular-nums ${
                  netoALiquidar > 0 ? "text-success-700" : "text-danger-600"
                }`}
              >
                {formatARS(netoALiquidar)}
              </span>
            </div>
          </div>
        )}
        {intentado && !cambio && (
          <p className="mt-1.5 text-xs font-medium text-danger-600">
            Elegí en la grilla una oferta distinta a la actual, con el mismo capital o menos.
          </p>
        )}

        {errorLiquidar && (
          <div className="mt-3">
            <Banner tone="error" title="No se puede aplicar este cambio">
              {errorLiquidar}
            </Banner>
          </div>
        )}

        <div className="mt-4">
          <label htmlFor="ca-nota" className="mb-1.5 block text-sm font-medium text-ink-700">
            Nota para el vendedor
          </label>
          <div className="relative">
            <textarea
              id="ca-nota"
              rows={3}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej.: El recibo informa $980.000 de neto, no $1.200.000. Se baja el capital a $1.000.000."
              className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm shadow-xs outline-none transition placeholder:text-ink-400 ${
                intentado && !notaValida
                  ? "border-danger-400 focus:border-danger-500 focus:ring-2 focus:ring-danger-100"
                  : "border-ink-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              }`}
            />
            <RequiredBadge />
          </div>
          {intentado && !notaValida && (
            <p className="mt-1.5 text-xs font-medium text-danger-600">
              Explicá el cambio en al menos 5 caracteres: el vendedor se lo tiene que transmitir
              al cliente.
            </p>
          )}
        </div>

      </Modal>

      <Modal
        open={open && grillaAbierta}
        onClose={() => setGrillaAbierta(false)}
        title="Grilla para cambiar la oferta"
        maxWidth="max-w-5xl"
        footer={
          <Button variant="primary" onClick={() => setGrillaAbierta(false)}>
            Cerrar
          </Button>
        }
      >
        <p className="mb-3 text-xs text-ink-500">
          Capital hasta{" "}
          <strong className="font-semibold text-ink-700">{formatARS(o.montoSolicitado)}</strong>,
          con todas las cuotas del plan. Elegí una celda: ese capital y ese plazo serán la nueva
          oferta.
        </p>
        <GrillaCuotas
          terms={terms}
          sistema={plan.sistema}
          capitalMaximo={o.montoSolicitado}
          capital={monto}
          plazo={plazo}
          seleccionable
          onSeleccionar={(capital, nuevoPlazo) => {
            setMonto(capital);
            setPlazo(nuevoPlazo);
            setGrillaAbierta(false);
          }}
        />
      </Modal>
    </>
  );
}
