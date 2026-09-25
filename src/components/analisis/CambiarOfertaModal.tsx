"use client";

import { useEffect, useRef, useState } from "react";
import { useApplication, evaluarSolicitud } from "@/lib/application-context";
import type {
  CambioDatosFinancieros,
  CambioOferta,
  ResultadoEvaluacion,
} from "@/lib/application-context";
import {
  calcularCuota,
  getTerm,
  grillaDe,
  importeTerceros,
  planDeSolicitud,
  totalPrecancelaciones,
} from "@/lib/credit";
import { formatARS } from "@/lib/format";
import { reglaBloquea } from "@/lib/motores";
import { TERMINOS } from "@/lib/terminologia";
import { PLANES_CUOTAS, SESION_SUPERVISOR } from "@/lib/config";
import type { DatoFinancieroCorregido, Plazo } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { RequiredBadge } from "@/components/ui/RequiredBadge";
import { Banner } from "@/components/ui/Banner";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { GrillaCuotas } from "@/components/onboarding/oferta/GrillaCuotas";
import { IconExpand, IconLoader, IconRefresh } from "@/components/icons";

type Solapa = "oferta" | "financieros";

// Datos financieros que el analista puede corregir: son los que entran al recálculo.
const CAMPOS_RECALCULO = [
  "ingresoBruto",
  "ingresoNeto",
  "disponible",
  "debitosNoRemunerativos",
  "extraccionesImporte",
  "transferenciasImporte",
] as const;

type ValoresFinancieros = Record<(typeof CAMPOS_RECALCULO)[number], number>;

// El resultado vale sólo para los valores con los que se ejecutó el motor.
function mismosValores(a: ValoresFinancieros, b: ValoresFinancieros): boolean {
  return CAMPOS_RECALCULO.every((k) => a[k] === b[k]);
}

/**
 * Cambio de oferta del analista (reunión 11/09, 01:14–01:35).
 *
 * El capital actual es el techo: el capital máximo y las cuotas vigentes se muestran como texto y
 * el analista sólo puede bajar el capital eligiendo una celda de la grilla (mismo capital o
 * menos, con cualquier cantidad de cuotas del plan). La condición dura es que el saldo de acreditación quede por encima de cero: si
 * las cancelaciones se comen el capital nuevo, la operación no se puede cambiar y corresponde
 * rechazarla ("el nuevo monto no permite la precancelación").
 *
 * El cambio de oferta rige de inmediato: al confirmar el crédito vuelve al canal de venta en
 * estado Observado con el nuevo importe. El vendedor sólo puede aceptarlo o elegir otra oferta menor.
 *
 * La segunda solapa corrige datos financieros y necesita recalcular el motor. El recálculo no es
 * automático (creditonet-97): lo dispara el botón "Recalcular motor" y el resultado se muestra en
 * la misma pantalla, sin modal intermedio. La justificación se habilita sólo con un recálculo
 * vigente, y si el resultado no pasa el analista puede derivar la decisión al supervisor en lugar
 * de rechazar la solicitud él mismo.
 */
export function CambiarOfertaModal({
  open,
  onClose,
  onConfirmar,
  onConfirmarDatosFinancieros,
  onDerivarDatosFinancieros,
}: {
  open: boolean;
  onClose: () => void;
  onConfirmar: (cambio: CambioOferta) => void;
  onConfirmarDatosFinancieros: (cambio: CambioDatosFinancieros) => void;
  // El recálculo no pasa y el analista deriva la decisión al supervisor (creditonet-97).
  onDerivarDatosFinancieros: (cambio: CambioDatosFinancieros, motivo: string) => void;
}) {
  const { app } = useApplication();
  const o = app.oferta;
  const plan = planDeSolicitud(app);
  const terms = grillaDe(plan);

  const [tab, setTab] = useState<Solapa>("oferta");

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
      ? `Con este capital el ${TERMINOS.saldoAcreditacion.toLowerCase()} queda en cero o negativo: el nuevo monto no permite la precancelación. Corresponde rechazar la solicitud.`
      : null;
  const notaValida = nota.trim().length >= 5;
  const puedeConfirmar = cambio && !errorLiquidar && monto > 0 && notaValida;

  function confirmar() {
    setIntentado(true);
    if (!puedeConfirmar) return;
    onConfirmar({ montoSolicitado: monto, plazo, nota: nota.trim() });
  }

  // --- Solapa 2: datos financieros (creditonet-69) ---
  const l = app.laboral;
  const [ingresoBruto, setIngresoBruto] = useState(l.ingresoBruto);
  const [ingresoNeto, setIngresoNeto] = useState(l.ingresoNeto);
  const [disponible, setDisponible] = useState(l.disponible);
  const [debitosNoRemunerativos, setDebitosNoRemunerativos] = useState(l.debitosNoRemunerativos);
  const [extraccionesImporte, setExtraccionesImporte] = useState(l.extraccionesImporte);
  const [transferenciasImporte, setTransferenciasImporte] = useState(l.transferenciasImporte);
  const [notaFin, setNotaFin] = useState("");
  const [intentadoFin, setIntentadoFin] = useState(false);
  // Cada dato sensible está bloqueado hasta pulsar "Corregir" (creditonet-80).
  const [editando, setEditando] = useState<Record<string, boolean>>({});
  // El motor no se dispara solo: lo corre el botón "Recalcular" y el resultado queda acá, con
  // los valores con los que se ejecutó, para poder mostrarlo en la misma pantalla
  // (creditonet-97: sin modal intermedio).
  const [recalculo, setRecalculo] = useState<{
    valores: ValoresFinancieros;
    ev: ResultadoEvaluacion;
  } | null>(null);
  const [recalculando, setRecalculando] = useState(false);
  const timerRecalculo = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timerRecalculo.current !== null) window.clearTimeout(timerRecalculo.current);
    },
    []
  );

  const camposFin = [
    { id: "ingresoBruto", label: "Ingreso bruto", valor: ingresoBruto, set: setIngresoBruto, original: l.ingresoBruto },
    { id: "ingresoNeto", label: "Ingreso neto", valor: ingresoNeto, set: setIngresoNeto, original: l.ingresoNeto },
    { id: "disponible", label: TERMINOS.disponible, valor: disponible, set: setDisponible, original: l.disponible },
    {
      id: "debitosNoRemunerativos",
      label: TERMINOS.conceptosNoRemunerativos,
      valor: debitosNoRemunerativos,
      set: setDebitosNoRemunerativos,
      original: l.debitosNoRemunerativos,
    },
    {
      id: "extraccionesImporte",
      label: TERMINOS.saldoDiaAcreditacion,
      valor: extraccionesImporte,
      set: setExtraccionesImporte,
      original: l.extraccionesImporte,
    },
    {
      id: "transferenciasImporte",
      label: TERMINOS.transferenciasExtracciones,
      valor: transferenciasImporte,
      set: setTransferenciasImporte,
      original: l.transferenciasImporte,
    },
  ];
  const datosCorregidos: DatoFinancieroCorregido[] = camposFin
    .filter((c) => c.valor !== c.original)
    .map((c) => ({ campo: c.label, antes: c.original, despues: c.valor }));
  const hayCambioFin = datosCorregidos.length > 0;

  const valoresFin: ValoresFinancieros = {
    ingresoBruto,
    ingresoNeto,
    disponible,
    debitosNoRemunerativos,
    extraccionesImporte,
    transferenciasImporte,
  };

  // Resultado vigente: si el analista tocó un dato después de recalcular, el resultado anterior
  // ya no describe lo que va a aplicar, así que se descarta y hay que volver a recalcular.
  const evFin = recalculo !== null && mismosValores(recalculo.valores, valoresFin) ? recalculo.ev : null;
  const desactualizadoFin = recalculo !== null && evFin === null;

  const institucionalNoPasaFin = evFin !== null && evFin.institucionales.some(reglaBloquea);
  const motorNoPasaFin = evFin !== null && !institucionalNoPasaFin && evFin.resultado === "NO_PASA";
  const sinLineaFin =
    evFin !== null && !institucionalNoPasaFin && !motorNoPasaFin && evFin.planId === null;
  const pasaFin =
    evFin !== null &&
    !institucionalNoPasaFin &&
    !motorNoPasaFin &&
    !sinLineaFin &&
    evFin.limites !== null;
  const motivoNoPasaFin = institucionalNoPasaFin
    ? "Una regla institucional bloqueante no pasa con estos datos."
    : motorNoPasaFin
      ? "Una regla bloqueante del Motor de Riesgo no pasa con estos datos."
      : sinLineaFin
        ? (evFin!.sinLineaMotivo ?? "No hay una línea de cuotas disponible con estos datos.")
        : null;
  // Reglas bloqueantes que no pasaron, para mostrar el detalle junto al resultado.
  const reglasNoPasanFin =
    evFin === null
      ? []
      : (institucionalNoPasaFin ? evFin.institucionales : evFin.reglas).filter(reglaBloquea);

  const notaFinValida = notaFin.trim().length >= 5;
  // La justificación se habilita recién con un recálculo vigente: hasta entonces no hay nada
  // concreto que justificar (creditonet-97).
  const notaFinHabilitada = evFin !== null;
  const puedeConfirmarFin = hayCambioFin && evFin !== null && notaFinValida;

  function recalcularFin() {
    setIntentadoFin(true);
    if (!hayCambioFin || recalculando) return;
    const valores = valoresFin;
    setRecalculando(true);
    // El motor de la demo es sincrónico: el retardo sólo hace visible que se está ejecutando.
    timerRecalculo.current = window.setTimeout(() => {
      setRecalculo({
        valores,
        ev: evaluarSolicitud({ ...app, laboral: { ...l, ...valores } }),
      });
      setRecalculando(false);
    }, 600);
  }

  function cambioFin(): CambioDatosFinancieros {
    return { datos: datosCorregidos, ...valoresFin, nota: notaFin.trim() };
  }

  function aplicarFin() {
    setIntentadoFin(true);
    if (!puedeConfirmarFin) return;
    onConfirmarDatosFinancieros(cambioFin());
  }

  function derivarFin() {
    setIntentadoFin(true);
    if (!puedeConfirmarFin || pasaFin) return;
    onDerivarDatosFinancieros(cambioFin(), motivoNoPasaFin ?? "");
  }

  return (
    <>
      <Modal
        open={open}
        onClose={grillaAbierta ? () => {} : onClose}
        title={tab === "oferta" ? "Cambiar la oferta" : "Cambio de datos financieros"}
        maxWidth="max-w-lg"
        footer={
          tab === "oferta" ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={confirmar}>
                Confirmar cambio
              </Button>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              {evFin === null ? (
                <Button variant="primary" onClick={recalcularFin} loading={recalculando}>
                  {!recalculando && <IconRefresh width={15} height={15} />}
                  {desactualizadoFin ? "Volver a recalcular" : "Recalcular motor"}
                </Button>
              ) : pasaFin ? (
                <Button variant="primary" onClick={aplicarFin}>
                  Aplicar el cambio
                </Button>
              ) : (
                <>
                  <Button variant="warning" onClick={derivarFin}>
                    Derivar a supervisor
                  </Button>
                  <Button variant="danger" onClick={aplicarFin}>
                    Aplicar y rechazar
                  </Button>
                </>
              )}
            </div>
          )
        }
      >
        <div role="tablist" aria-label="Tipo de cambio" className="mb-4 flex gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "oferta"}
            onClick={() => setTab("oferta")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold tracking-wide transition ${
              tab === "oferta"
                ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                : "border-ink-300 bg-white text-ink-700 hover:border-ink-400 hover:bg-ink-50"
            }`}
          >
            Cambio de oferta
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "financieros"}
            onClick={() => setTab("financieros")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold tracking-wide transition ${
              tab === "financieros"
                ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                : "border-ink-300 bg-white text-ink-700 hover:border-ink-400 hover:bg-ink-50"
            }`}
          >
            Datos financieros
          </button>
        </div>

        {tab === "oferta" ? (
          <>
        <p className="text-sm text-ink-600">
          Sólo se puede bajar el capital: elegí en la grilla un capital igual o menor, con la
          cantidad de cuotas que corresponda. Al confirmar, la solicitud vuelve al vendedor en
          estado <strong>Observado</strong> con la nueva oferta.
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
                <span className="text-sm text-ink-500">{TERMINOS.cancelacionTerceros}</span>
                <span className="text-sm font-semibold tabular-nums text-danger-600">
                  −{formatARS(terceros)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 px-4 py-2.5">
              <span className="text-sm font-medium text-ink-700">{TERMINOS.saldoAcreditacion}</span>
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
          </>
        ) : (
          <>
            <p className="text-sm text-ink-600">
              Estos datos pueden cambiar la capacidad de endeudamiento. Corregilos y pulsá{" "}
              <strong>Recalcular motor</strong>: se ejecutan de nuevo las reglas institucionales,
              el <strong>Motor de Riesgo</strong>, la línea y los límites, y el resultado se
              muestra acá mismo. El cambio rige de inmediato, <strong>sin refrendación</strong>:
              si el motor pasa, la solicitud queda <strong>Observada</strong> con la nueva oferta;
              si no pasa, podés rechazarla o derivar la decisión al supervisor.
            </p>

            <div className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-2">
              {camposFin.map((c) => (
                <div key={c.id}>
                  <MoneyInput
                    id={`cdf-${c.id}`}
                    label={c.label}
                    value={c.valor}
                    onChange={c.set}
                    disabled={!editando[c.id]}
                  />
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                    {editando[c.id] ? (
                      <>
                        <span className="text-ink-500">Original: {formatARS(c.original)}</span>
                        <button
                          type="button"
                          onClick={() => {
                            c.set(c.original);
                            setEditando((e) => ({ ...e, [c.id]: false }));
                          }}
                          className="font-semibold text-ink-600 hover:underline"
                        >
                          Descartar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditando((e) => ({ ...e, [c.id]: true }))}
                        className="font-semibold text-brand-700 hover:underline"
                      >
                        Corregir
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Sueldo neto recalculado:{" "}
              <strong className="tabular-nums text-ink-700">
                {formatARS(ingresoNeto - debitosNoRemunerativos)}
              </strong>{" "}
              (neto menos {TERMINOS.conceptosNoRemunerativos.toLowerCase()}).
            </p>

            {intentadoFin && !hayCambioFin && (
              <p className="mt-1.5 text-xs font-medium text-danger-600">
                Cambiá al menos un dato financiero respecto del valor actual.
              </p>
            )}

            {recalculando && (
              <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-brand-700">
                <IconLoader width={16} height={16} />
                Ejecutando reglas institucionales, Motor de Riesgo, línea y límites…
              </p>
            )}

            {!recalculando && evFin === null && hayCambioFin && (
              <p className="mt-4 rounded-xl border border-dashed border-ink-300 bg-ink-25 px-4 py-3 text-xs text-ink-600">
                {desactualizadoFin
                  ? "Los datos cambiaron desde el último recálculo: el resultado anterior ya no vale. Volvé a recalcular para ver cómo queda el motor."
                  : "Todavía no se recalculó el motor: pulsá Recalcular motor para ver el resultado con estos datos."}
              </p>
            )}

            {!recalculando && evFin !== null && (
              <div className="mt-4 space-y-3">
                {pasaFin ? (
                  <Banner tone="success" title="El motor pasa con estos datos">
                    Nuevo capital máximo{" "}
                    <strong className="tabular-nums">
                      {formatARS(evFin.limites!.capitalConsiderado)}
                    </strong>
                    {evFin.planId && PLANES_CUOTAS[evFin.planId] && (
                      <> · línea {PLANES_CUOTAS[evFin.planId].nombre}</>
                    )}
                    . Al aplicar, la solicitud vuelve al canal de venta en estado{" "}
                    <strong>Observado</strong> con la oferta nueva.
                  </Banner>
                ) : (
                  <Banner tone="error" title="El motor no pasa con estos datos">
                    {motivoNoPasaFin} Si lo aplicás, la solicitud pasa a{" "}
                    <strong>Rechazado</strong>; con <strong>Derivar a supervisor</strong> nada rige
                    todavía y decide {SESION_SUPERVISOR.nombre}.
                  </Banner>
                )}

                {reglasNoPasanFin.length > 0 && (
                  <ul className="space-y-1 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-xs text-danger-700">
                    {reglasNoPasanFin.map((r) => (
                      <li key={r.id}>
                        <span className="font-mono font-bold">{r.codigo}</span> {r.nombre}:{" "}
                        {r.valorEvaluado}
                      </li>
                    ))}
                  </ul>
                )}

                <dl className="divide-y divide-ink-100 rounded-xl border border-ink-200 bg-ink-25">
                  {datosCorregidos.map((d) => (
                    <div
                      key={d.campo}
                      className="flex items-center justify-between gap-4 px-4 py-2"
                    >
                      <dt className="text-xs text-ink-500">{d.campo}</dt>
                      <dd className="text-xs font-semibold tabular-nums text-ink-900">
                        {formatARS(d.antes)} → {formatARS(d.despues)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <div className="mt-4">
              <label htmlFor="cdf-nota" className="mb-1.5 block text-sm font-medium text-ink-700">
                Nota / justificación
              </label>
              <div className="relative">
                <textarea
                  id="cdf-nota"
                  rows={3}
                  value={notaFin}
                  onChange={(e) => setNotaFin(e.target.value)}
                  disabled={!notaFinHabilitada}
                  placeholder={
                    notaFinHabilitada
                      ? "Ej.: El recibo informa $1.450.000 de bruto, no $1.100.000. Se recalcula con el dato correcto."
                      : "Se habilita después de recalcular el motor."
                  }
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm shadow-xs outline-none transition placeholder:text-ink-400 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400 ${
                    notaFinHabilitada ? "bg-white" : "bg-ink-50"
                  } ${
                    intentadoFin && notaFinHabilitada && !notaFinValida
                      ? "border-danger-400 focus:border-danger-500 focus:ring-2 focus:ring-danger-100"
                      : "border-ink-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  }`}
                />
                <RequiredBadge />
              </div>
              {!notaFinHabilitada ? (
                <p className="mt-1.5 text-xs text-ink-500">
                  La justificación se escribe sobre un resultado concreto: primero recalculá el
                  motor.
                </p>
              ) : (
                intentadoFin && !notaFinValida && (
                  <p className="mt-1.5 text-xs font-medium text-danger-600">
                    Explicá el motivo del cambio en al menos 5 caracteres.
                  </p>
                )
              )}
            </div>
          </>
        )}
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
