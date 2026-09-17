"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApplication } from "@/lib/application-context";
import { FASES_RIESGO, calcularLimites } from "@/lib/credit";
import { seleccionarLinea } from "@/lib/config";
import { evaluarReglas, reglaMarcada, resolverResultado, seleccionarMotor } from "@/lib/motores";
import { evaluarInstitucionales, institucionalesBloquean } from "@/lib/reglas-institucionales";
import { sumarDias } from "@/lib/format";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstadoBadge, StatusBadge } from "@/components/ui/StatusBadge";
import {
  IconArrowDown,
  IconCalendar,
  IconCheck,
  IconLoader,
  IconRefresh,
  IconShieldCheck,
  IconX,
} from "@/components/icons";

import { EscenarioMotor } from "../evaluacion/EscenarioMotor";

type Fase = "inicial" | "evaluando" | "completo";

function DiagramaEtapas() {
  const etapas = [
    {
      n: 1,
      titulo: "Reglas institucionales",
      detalle: "Políticas transversales, con los datos mínimos confirmados.",
    },
    {
      n: 2,
      titulo: "Motor de riesgo",
      detalle: "Ejecuta las reglas del motor que corresponde y determina si la solicitud pasa.",
    },
  ];
  return (
    <div className="mx-auto mt-5 max-w-md space-y-1.5 text-left">
      {etapas.map((e, i) => (
        <div key={e.n}>
          <div className="rounded-xl border border-ink-200 bg-ink-25 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-500">
              {e.n} · {e.titulo}
            </p>
            <p className="mt-0.5 text-sm text-ink-700">{e.detalle}</p>
          </div>
          {i < etapas.length - 1 && (
            <p className="flex items-center justify-center py-1 text-ink-300">
              <IconArrowDown width={13} height={13} />
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function PasoEvaluacion() {
  const { app, solicitar, finalizarRiesgo, reiniciarDemo } = useApplication();
  const yaCompleto = app.riesgo.estado === "COMPLETO";

  const [fase, setFase] = useState<Fase>(yaCompleto ? "completo" : "inicial");
  const [faseIdx, setFaseIdx] = useState(0);
  const timers = useRef<number[]>([]);

  const limpiar = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => () => limpiar(), [limpiar]);

  const ejecutar = useCallback(() => {
    limpiar();
    // 1 · Reglas institucionales con los datos mínimos ya confirmados (Motor §6).
    const nuevasInstitucionales = evaluarInstitucionales(app, "EVALUACION");
    const descartada = institucionalesBloquean(nuevasInstitucionales);

    // 2 · Producto + Organismo + condición laboral determinan qué motor se ejecuta. Si una
    // regla institucional descartó la solicitud, el motor no llega a ejecutarse.
    const { motor } = seleccionarMotor(app.configuracion, app.laboral.condicionLaboral);
    const nuevas = descartada ? [] : evaluarReglas(app, motor, app.riesgo.escenario);
    const resultado = descartada ? null : resolverResultado(nuevas);

    // Pasado el motor hay que verificar que la línea admita la condición laboral, ANTES de
    // calcular. Si no, se rechaza sin que el motor tenga nada que ver (02:28).
    const linea =
      resultado !== "PASA"
        ? { plan: null, motivo: null }
        : seleccionarLinea(app.configuracion.organismoId, {
            condicionLaboral: app.laboral.condicionLaboral,
          });

    // 3 · Límites de la primera oferta: sin cancelaciones, que se ofrecen después (Plan §9).
    const limites = linea.plan ? calcularLimites(app, { conCancelaciones: false }) : null;

    solicitar();
    setFaseIdx(0);
    setFase("evaluando");

    const finalizar = () => {
      finalizarRiesgo({
        institucionales: nuevasInstitucionales,
        motorId: descartada ? null : motor.id,
        reglas: nuevas,
        resultado,
        planId: linea.plan?.id ?? null,
        sinLineaMotivo: linea.motivo,
        limites,
      });
      setFase("completo");
    };

    const n = FASES_RIESGO.length;
    for (let k = 1; k <= n; k++) {
      timers.current.push(
        window.setTimeout(() => {
          setFaseIdx(k);
          if (k === n) timers.current.push(window.setTimeout(finalizar, 450));
        }, 500 * k)
      );
    }
  }, [app, solicitar, finalizarRiesgo, limpiar]);

  const ev = app.riesgo.evaluadoCon;
  const desactualizado =
    yaCompleto &&
    ev !== null &&
    (ev.ingresoNeto !== app.laboral.ingresoNeto ||
      ev.fechaNacimiento !== (app.cliente?.fechaNacimiento ?? "") ||
      ev.genero !== (app.cliente?.genero ?? ""));

  const completo = fase === "completo";
  const origenRechazo = completo ? (app.rechazo?.origen ?? null) : null;
  const rechazoInstitucional = origenRechazo === "INSTITUCIONAL";
  const motorNoPasa = origenRechazo === "MOTOR";
  const sinLinea = origenRechazo === "SIN_LINEA";
  const motorAprobado = completo && origenRechazo === null && app.riesgo.limites !== null;
  const reglasMarcadas = app.riesgo.reglas.filter(reglaMarcada);
  const marcadas = reglasMarcadas.length;

  return (
    <div className="space-y-5">
      {fase === "inicial" && (
        <Card className="p-6 sm:p-8">
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <IconShieldCheck width={24} height={24} />
            </span>
            <h3 className="mt-3 text-base font-bold tracking-tight text-ink-900">
              Solicitar crédito
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
              Al presionar <strong>Solicitar</strong> se genera el ID de Crédito y la solicitud
              queda <strong>En trámite</strong>. Primero se evalúan las reglas institucionales y
              el motor; recién después intervienen los límites y el plan de cuotas.
            </p>
          </div>
          <DiagramaEtapas />
          <div className="mt-6">
            <EscenarioMotor />
          </div>
          <div className="mt-5 text-center">
            <Button size="lg" onClick={ejecutar}>
              Solicitar
            </Button>
          </div>
        </Card>
      )}

      {fase === "evaluando" && (
        <div className="animate-fade-in rounded-xl border border-brand-200 bg-brand-50/70 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand-700">
            <IconLoader width={16} height={16} />
            {FASES_RIESGO[Math.min(faseIdx, FASES_RIESGO.length - 1)].mensaje}
          </p>
          <ol className="mt-3 space-y-1.5">
            {FASES_RIESGO.map((f, i) => {
              const hecho = i < faseIdx;
              const actual = !hecho && i === faseIdx;
              return (
                <li
                  key={f.id}
                  className={`flex items-center gap-2 text-xs ${
                    hecho
                      ? "text-success-700"
                      : actual
                        ? "font-semibold text-brand-700"
                        : "text-ink-400"
                  }`}
                >
                  <span className="flex h-4 w-4 items-center justify-center">
                    {hecho ? (
                      <IconCheck width={12} height={12} strokeWidth={3} />
                    ) : actual ? (
                      <IconLoader width={12} height={12} />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-ink-300" />
                    )}
                  </span>
                  {f.mensaje}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {desactualizado && completo && origenRechazo === null && (
        <Banner tone="warning" title="Los datos cambiaron desde la última evaluación">
          <span className="flex flex-wrap items-center gap-2">
            Se modificaron datos que las reglas o el plan utilizaron. Volvé a ejecutar para
            actualizar el resultado. El ID de Crédito se conserva.
          </span>
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={ejecutar}>
              <IconRefresh width={14} height={14} />
              Volver a ejecutar
            </Button>
          </div>
        </Banner>
      )}

      {rechazoInstitucional && (
        <>
          <div className="rounded-xl border border-dashed border-ink-200 bg-ink-25 px-4 py-3 text-sm text-ink-400">
            <span className="font-semibold">2 · Motor de riesgo</span> no se ejecuta y no se
            llega al paso de Oferta: una regla institucional rechazó la solicitud.
          </div>
          <div className="animate-fade-up rounded-2xl border border-danger-200 bg-danger-50 p-6 text-center sm:p-8">
            <span className="mx-auto flex h-14 w-14 animate-pop items-center justify-center rounded-full bg-danger-600 text-white shadow-sm">
              <IconX width={28} height={28} strokeWidth={2.6} />
            </span>
            <h3 className="mt-4 text-xl font-bold tracking-tight text-danger-700">
              Solicitud rechazada por una regla institucional
            </h3>
            <p className="mx-auto mt-1.5 max-w-lg text-sm leading-relaxed text-danger-600">
              Es una política transversal del negocio, anterior al motor: el motor no llegó a
              ejecutarse. La solicitud pasó a estado Rechazado y el motivo queda registrado para
              la bandeja.
            </p>
            <div className="mx-auto mt-4 max-w-md rounded-xl border border-danger-200 bg-white px-4 py-3 text-left text-sm text-ink-700">
              {app.rechazo?.observacion}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <EstadoBadge estado="RECHAZADO" />
              {app.rechazo?.codigos.map((c) => (
                <span
                  key={c}
                  className="rounded-md border border-danger-200 bg-white px-2 py-0.5 font-mono text-xs font-bold text-danger-700"
                >
                  {c}
                </span>
              ))}
              {app.numeroCredito && (
                <StatusBadge tone="neutral">ID de Crédito {app.numeroCredito}</StatusBadge>
              )}
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={ejecutar}>
                <IconRefresh width={15} height={15} />
                Volver a ejecutar
              </Button>
              <Button variant="ghost" onClick={reiniciarDemo}>
                Reiniciar demo
              </Button>
            </div>
          </div>
        </>
      )}

      {sinLinea && (
        <div className="animate-fade-up rounded-2xl border border-danger-200 bg-danger-50 p-6 text-center sm:p-8">
          <span className="mx-auto flex h-14 w-14 animate-pop items-center justify-center rounded-full bg-danger-600 text-white shadow-sm">
            <IconX width={28} height={28} strokeWidth={2.6} />
          </span>
          <h3 className="mt-4 text-xl font-bold tracking-tight text-danger-700">
            Sin línea disponible para este cliente
          </h3>
          <p className="mx-auto mt-1.5 max-w-lg text-sm leading-relaxed text-danger-600">
            El motor pasó: ninguna regla bloqueante falló. Lo que no existe es un plan de cuotas
            habilitado para esta condición laboral, así que la operación no puede continuar y no
            llega al analista.
          </p>
          <div className="mx-auto mt-4 max-w-md rounded-xl border border-danger-200 bg-white px-4 py-3 text-left text-sm text-ink-700">
            {app.rechazo?.observacion}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <EstadoBadge estado="RECHAZADO" />
            <StatusBadge tone="neutral">Rechazo previo al plan</StatusBadge>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={ejecutar}>
              <IconRefresh width={15} height={15} />
              Volver a ejecutar
            </Button>
            <Button variant="ghost" onClick={reiniciarDemo}>
              Reiniciar demo
            </Button>
          </div>
        </div>
      )}

      {motorAprobado && (
        <>
          <div className="animate-fade-up flex flex-wrap items-center gap-3 rounded-2xl border border-success-200 bg-success-50 px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 animate-pop items-center justify-center rounded-full bg-success-600 text-white">
              <IconCheck width={20} height={20} strokeWidth={2.6} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-success-700">Motor de riesgo: pasa</p>
              <p className="text-xs text-success-700/80">
                Los límites aplicables al capital y las cuotas se arman en el siguiente paso,
                Oferta.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {app.numeroCredito && (
                <StatusBadge tone="neutral">ID de Crédito {app.numeroCredito}</StatusBadge>
              )}
            </div>
          </div>

          {marcadas > 0 && (
            <div className="animate-fade-up rounded-2xl border border-warning-200 bg-warning-50 p-4">
              <p className="text-sm font-bold text-warning-700">
                {marcadas} regla{marcadas === 1 ? "" : "s"} marcada{marcadas === 1 ? "" : "s"}{" "}
                para el analista
              </p>
              <ul className="mt-1.5 space-y-1 text-xs text-warning-700/90">
                {reglasMarcadas.map((r) => (
                  <li key={r.id}>
                    <span className="font-mono font-bold">{r.codigo}</span> {r.nombre}:{" "}
                    {r.valorEvaluado}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={ejecutar}>
              <IconRefresh width={14} height={14} />
              Volver a ejecutar
            </Button>
          </div>
        </>
      )}

      {motorNoPasa && (
        <>
          <div className="rounded-xl border border-dashed border-ink-200 bg-ink-25 px-4 py-3 text-sm text-ink-400">
            No se llega al paso de Oferta: el motor no pasó.
          </div>
          <div className="animate-fade-up rounded-2xl border border-danger-200 bg-danger-50 p-6 text-center sm:p-8">
            <span className="mx-auto flex h-14 w-14 animate-pop items-center justify-center rounded-full bg-danger-600 text-white shadow-sm">
              <IconX width={28} height={28} strokeWidth={2.6} />
            </span>
            <h3 className="mt-4 text-xl font-bold tracking-tight text-danger-700">
              Solicitud rechazada por el motor de riesgo
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-danger-600">
              La solicitud pasó automáticamente a estado Rechazado. Los códigos de las reglas
              bloqueantes que no pasaron quedan registrados para poder mostrar el motivo en la
              bandeja.
            </p>
            <div className="mx-auto mt-4 max-w-md rounded-xl border border-danger-200 bg-white px-4 py-3 text-left text-sm text-ink-700">
              {app.rechazo?.observacion}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <EstadoBadge estado="RECHAZADO" />
              {app.rechazo?.codigos.map((c) => (
                <span
                  key={c}
                  className="rounded-md border border-danger-200 bg-white px-2 py-0.5 font-mono text-xs font-bold text-danger-700"
                >
                  {c}
                </span>
              ))}
              {app.numeroCredito && (
                <StatusBadge tone="neutral">ID de Crédito {app.numeroCredito}</StatusBadge>
              )}
            </div>
            <div className="mx-auto mt-5 flex max-w-md items-start gap-2.5 rounded-xl border border-danger-200 bg-white px-4 py-3 text-left text-sm text-ink-700">
              <IconCalendar width={16} height={16} className="mt-0.5 shrink-0 text-danger-600" />
              <span>
                <strong>Período de carencia de 30 días:</strong> el ID de Cliente{" "}
                {app.numeroCliente} podrá iniciar un nuevo trámite a partir del{" "}
                {sumarDias(app.rechazo?.fecha ?? "", 30)}. No lo bloquea de forma permanente.
              </span>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={ejecutar}>
                <IconRefresh width={15} height={15} />
                Volver a ejecutar
              </Button>
              <Button variant="ghost" onClick={reiniciarDemo}>
                Reiniciar demo
              </Button>
            </div>
          </div>
        </>
      )}

      {completo && (
        <div className="space-y-3">
          <EscenarioMotor />
        </div>
      )}
    </div>
  );
}
