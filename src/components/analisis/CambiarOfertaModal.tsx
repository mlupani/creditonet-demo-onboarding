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
import { MoneyInput } from "@/components/ui/MoneyInput";
import { RequiredBadge } from "@/components/ui/RequiredBadge";
import { SelectField } from "@/components/ui/SelectField";
import { Banner } from "@/components/ui/Banner";
import { IconArrowRight } from "@/components/icons";

/**
 * Cambio de oferta del analista (reunión 11/09, 01:14–01:35).
 *
 * Puede corregir el capital, el plazo y los sueldos que el vendedor cargó mal. La cuota no
 * se toca: se recalcula sola. La condición dura es que el monto a liquidar quede por encima
 * de cero: si las cancelaciones se comen el capital nuevo, la operación no se puede cambiar
 * y corresponde rechazarla ("el nuevo monto no permite la precancelación").
 *
 * Un cambio de oferta requiere la refrendación del supervisor: al confirmar queda pendiente y
 * recién cuando lo refrenda el crédito vuelve al canal de venta en estado Observado con el
 * nuevo importe, para que el vendedor lo hable con el cliente.
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
  const plazosDisponibles = grillaDe(plan);

  const [monto, setMonto] = useState(o.montoSolicitado);
  const [plazo, setPlazo] = useState<Plazo>(o.plazo);
  const [bruto, setBruto] = useState(app.laboral.ingresoBruto);
  const [neto, setNeto] = useState(app.laboral.ingresoNeto);
  const [nota, setNota] = useState("");
  const [intentado, setIntentado] = useState(false);

  const precancel = totalPrecancelaciones(o);
  const terceros = importeTerceros(o);
  const netoALiquidar = monto - precancel - terceros;
  const term = getTerm(plazo, plan);
  const nuevaCuota = calcularCuota(monto, plazo, term.tna, plan.sistema);

  const errorNeto = neto > bruto ? "El ingreso neto no puede superar al bruto." : null;
  const errorLiquidar =
    netoALiquidar <= 0
      ? "Con este capital el monto a liquidar queda en cero o negativo: el nuevo monto no permite la precancelación. Corresponde rechazar la solicitud."
      : null;
  const notaValida = nota.trim().length >= 5;
  const puedeConfirmar = !errorNeto && !errorLiquidar && monto > 0 && notaValida;

  function confirmar() {
    setIntentado(true);
    if (!puedeConfirmar) return;
    onConfirmar({
      montoSolicitado: monto,
      plazo,
      ingresoBruto: bruto,
      ingresoNeto: neto,
      nota: nota.trim(),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
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
        Corregí el capital, el plazo o los sueldos que se cargaron mal. La cuota se recalcula
        sola. El cambio <strong>requiere la refrendación del supervisor</strong>: recién entonces
        la solicitud vuelve al vendedor en estado <strong>Observado</strong> con la nueva oferta.
      </p>

      <div className="mt-4 grid gap-x-5 gap-y-1 sm:grid-cols-2">
        <MoneyInput
          id="ca-monto"
          label="Capital"
          required
          value={monto}
          onChange={setMonto}
          hint={`Original: ${formatARS(o.montoSolicitado)}`}
        />
        <SelectField
          id="ca-plazo"
          label="Plazo"
          required
          value={String(plazo)}
          onChange={(v) => setPlazo(Number(v) as Plazo)}
          options={plazosDisponibles.map((t) => ({
            value: String(t.plazo),
            label: `${t.plazo} cuotas · TNA ${t.tna} %`,
          }))}
        />
        <MoneyInput
          id="ca-bruto"
          label="Ingreso bruto"
          required
          value={bruto}
          onChange={setBruto}
          hint="Dato sensible que el analista controla contra el recibo."
        />
        <MoneyInput
          id="ca-neto"
          label="Ingreso neto"
          required
          value={neto}
          onChange={setNeto}
          error={errorNeto ?? undefined}
        />
      </div>

      <div className="mt-4 divide-y divide-ink-100 rounded-xl border border-ink-200 bg-ink-25">
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <span className="text-sm text-ink-500">Nueva cuota</span>
          <span className="text-sm font-semibold tabular-nums text-ink-900">
            {formatARS(nuevaCuota)}
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

      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
        <IconArrowRight width={13} height={13} className="shrink-0 text-ink-400" />
        {formatARS(o.montoSolicitado)} en {o.plazo} cuotas → {formatARS(monto)} en {plazo} cuotas
      </p>
    </Modal>
  );
}
