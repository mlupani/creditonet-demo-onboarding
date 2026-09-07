"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApplication } from "@/lib/application-context";
import {
  FASES_RIESGO,
  RESULTADO_LABEL,
  evaluarReglas,
  resolverResultado,
} from "@/lib/credit";
import type { RiskRule as RiskRuleType } from "@/lib/types";
import { RiskRule } from "@/components/RiskRule";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DemoTag } from "@/components/ui/DemoTag";
import {
  IconCheck,
  IconLoader,
  IconRefresh,
  IconShieldCheck,
  IconX,
} from "@/components/icons";

type Fase = "inicial" | "evaluando" | "revelando" | "completo";

export function PasoRiesgo() {
  const { app, finalizarRiesgo } = useApplication();
  const yaCompleto = app.riesgo.estado === "COMPLETO";

  const [fase, setFase] = useState<Fase>(yaCompleto ? "completo" : "inicial");
  const [faseIdx, setFaseIdx] = useState(0);
  const [reglas, setReglas] = useState<RiskRuleType[]>(yaCompleto ? app.riesgo.reglas : []);
  const [visibles, setVisibles] = useState(yaCompleto ? app.riesgo.reglas.length : 0);
  const timers = useRef<number[]>([]);

  const limpiar = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => () => limpiar(), [limpiar]);

  const ejecutar = useCallback(() => {
    limpiar();
    const nuevas = evaluarReglas(app);
    setReglas(nuevas);
    setVisibles(0);
    setFaseIdx(0);
    setFase("evaluando");

    FASES_RIESGO.forEach((_, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setFaseIdx(i);
          if (i === FASES_RIESGO.length - 1) {
            timers.current.push(
              window.setTimeout(() => {
                setFase("revelando");
                nuevas.forEach((__, j) => {
                  timers.current.push(
                    window.setTimeout(() => {
                      setVisibles(j + 1);
                      if (j === nuevas.length - 1) {
                        timers.current.push(
                          window.setTimeout(() => {
                            finalizarRiesgo(nuevas, resolverResultado(nuevas));
                            setFase("completo");
                          }, 450)
                        );
                      }
                    }, 320 * (j + 1))
                  );
                });
              }, 650)
            );
          }
        }, 650 * (i + 1))
      );
    });
  }, [app, finalizarRiesgo, limpiar]);

  const desactualizado =
    yaCompleto &&
    app.riesgo.evaluadoConIngresoNeto !== null &&
    app.riesgo.evaluadoConIngresoNeto !== app.laboral.ingresoNeto;

  const resultado = fase === "completo" ? app.riesgo.resultado : null;
  const rechazado = resultado === "RECHAZAR";
  const listaVisible = fase === "completo" ? reglas : reglas.slice(0, visibles);

  return (
    <div className="space-y-5">
      {fase === "inicial" && (
        <div className="rounded-2xl border border-ink-200 bg-white p-6 text-center shadow-card sm:p-8">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <IconShieldCheck width={24} height={24} />
          </span>
          <h3 className="mt-3 text-base font-bold tracking-tight text-ink-900">
            Evaluar solicitud
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">
            El motor consulta información crediticia, aplica las reglas del producto y del
            organismo, y genera las condiciones de la oferta.
          </p>
          <Button className="mt-4" size="lg" onClick={ejecutar}>
            Evaluar crédito
          </Button>
        </div>
      )}

      {(fase === "evaluando" || fase === "revelando") && (
        <div className="animate-fade-in rounded-xl border border-brand-200 bg-brand-50/70 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand-700">
            <IconLoader width={16} height={16} />
            {fase === "evaluando"
              ? FASES_RIESGO[faseIdx].mensaje
              : "Revelando resultado de las reglas…"}
          </p>
          <ol className="mt-3 space-y-1.5">
            {FASES_RIESGO.map((f, i) => (
              <li
                key={f.id}
                className={`flex items-center gap-2 text-xs ${
                  fase === "revelando" || i < faseIdx
                    ? "text-success-700"
                    : i === faseIdx
                      ? "font-semibold text-brand-700"
                      : "text-ink-400"
                }`}
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  {fase === "revelando" || i < faseIdx ? (
                    <IconCheck width={12} height={12} strokeWidth={3} />
                  ) : i === faseIdx ? (
                    <IconLoader width={12} height={12} />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-ink-300" />
                  )}
                </span>
                {f.mensaje}
              </li>
            ))}
          </ol>
        </div>
      )}

      {desactualizado && fase === "completo" && (
        <Banner tone="warning" title="Los datos cambiaron desde la última evaluación">
          <span className="flex flex-wrap items-center gap-2">
            El ingreso neto se modificó después de ejecutar el análisis. Volvé a evaluar para
            actualizar el resultado.
            <DemoTag
              variant="regla"
              detalle="Si cambiar el producto o los datos vuelve a ejecutar automáticamente el motor de riesgo es una decisión pendiente."
            />
          </span>
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={ejecutar}>
              <IconRefresh width={14} height={14} />
              Volver a ejecutar
            </Button>
          </div>
        </Banner>
      )}

      {fase === "completo" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm text-ink-500">
            <IconShieldCheck width={17} height={17} className="text-brand-600" />
            <span>
              <span className="font-semibold text-ink-800">{reglas.length} reglas evaluadas</span>
              {app.riesgo.fecha && <span className="text-ink-400"> · {app.riesgo.fecha}</span>}
            </span>
          </div>
          <Button size="sm" variant="ghost" onClick={ejecutar}>
            <IconRefresh width={15} height={15} />
            Volver a ejecutar
          </Button>
        </div>
      )}

      {listaVisible.length > 0 && (
        <ul className="space-y-2.5">
          {listaVisible.map((rule, i) => (
            <RiskRule key={rule.id} rule={rule} index={i} />
          ))}
        </ul>
      )}

      {fase === "completo" && (
        <div
          className={`animate-fade-up overflow-hidden rounded-2xl border p-6 text-center shadow-card sm:p-8 ${
            rechazado ? "border-danger-200 bg-danger-50" : "border-success-200 bg-success-50"
          }`}
        >
          <span
            className={`mx-auto flex h-14 w-14 animate-pop items-center justify-center rounded-full text-white shadow-sm ${
              rechazado ? "bg-danger-600" : "bg-success-600"
            }`}
          >
            {rechazado ? (
              <IconX width={28} height={28} strokeWidth={2.6} />
            ) : (
              <IconCheck width={28} height={28} strokeWidth={2.6} />
            )}
          </span>
          <h3
            className={`mt-4 text-xl font-bold tracking-tight ${
              rechazado ? "text-danger-700" : "text-success-700"
            }`}
          >
            {rechazado ? "Solicitud no aprobada por el motor" : "Condiciones de oferta generadas"}
          </h3>
          <p
            className={`mx-auto mt-1.5 max-w-md text-sm leading-relaxed ${
              rechazado ? "text-danger-600" : "text-success-700/80"
            }`}
          >
            {rechazado
              ? "Una o más reglas no se cumplieron. En el sistema real la solicitud quedaría bloqueada o pasaría a análisis según la configuración."
              : "El cliente cumple las reglas necesarias. El motor generó el capital máximo y los planes de la oferta."}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <StatusBadge tone={rechazado ? "danger" : "success"}>
              Acción del motor: {resultado ? RESULTADO_LABEL[resultado] : "—"}
            </StatusBadge>
            {app.numeroCredito && (
              <StatusBadge tone="neutral">Crédito {app.numeroCredito}</StatusBadge>
            )}
          </div>
        </div>
      )}

      <Banner tone="info" title="Cómo funciona el motor de riesgo">
        <span className="flex flex-wrap items-center gap-2">
          Las reglas provienen de la configuración del producto y del organismo. Cada regla puede
          generar la oferta, pasar a analista o rechazar. En la demo todas las reglas aprueban.
          <DemoTag
            variant="regla"
            detalle="El valor del ingreso mínimo ($750.000) es una configuración de demo. Probá bajar el ingreso neto en el paso anterior y volvé a evaluar."
          />
        </span>
      </Banner>
    </div>
  );
}
