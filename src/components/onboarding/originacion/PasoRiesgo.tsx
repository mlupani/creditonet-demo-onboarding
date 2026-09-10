"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useApplication } from "@/lib/application-context";
import {
  FASES_RIESGO,
  RESULTADO_LABEL,
  evaluarPlan,
  evaluarReglas,
  resolverResultado,
} from "@/lib/credit";
import { formatARS, formatPct, sumarDias } from "@/lib/format";
import type { RiskRule as RiskRuleType } from "@/lib/types";
import { RiskRule } from "@/components/RiskRule";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstadoBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { DemoTag } from "@/components/ui/DemoTag";
import {
  IconArrowDown,
  IconCalendar,
  IconCheck,
  IconLoader,
  IconRefresh,
  IconShieldCheck,
  IconWallet,
  IconX,
} from "@/components/icons";

type Fase = "inicial" | "evaluando" | "revelando" | "completo";

function CapaTitulo({
  numero,
  titulo,
  subtitulo,
  action,
}: {
  numero: number;
  titulo: string;
  subtitulo: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-900 text-xs font-bold text-white">
          {numero}
        </span>
        <div>
          <p className="text-sm font-bold tracking-tight text-ink-900">{titulo}</p>
          <p className="text-xs text-ink-500">{subtitulo}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function FilaPlan({
  label,
  valor,
  detalle,
  ok,
}: {
  label: string;
  valor: string;
  detalle: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-800">{label}</p>
        <p className="text-xs text-ink-500">{detalle}</p>
      </div>
      <span
        className={`inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold tabular-nums ${
          ok ? "text-success-700" : "text-danger-600"
        }`}
      >
        {ok ? (
          <IconCheck width={14} height={14} strokeWidth={3} />
        ) : (
          <IconX width={14} height={14} strokeWidth={3} />
        )}
        {valor}
      </span>
    </div>
  );
}

function DiagramaCapas() {
  return (
    <div className="mx-auto mt-5 max-w-md space-y-1.5 text-left">
      <div className="rounded-xl border border-ink-200 bg-ink-25 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-500">
          1 · Motor de riesgo — “El Patovica”
        </p>
        <p className="mt-0.5 text-sm text-ink-700">
          Filtro pasa / no pasa: edad, Vector BCRA y mora interna.
        </p>
      </div>
      <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-ink-400">
        <IconArrowDown width={13} height={13} />
        si aprueba
      </p>
      <div className="rounded-xl border border-ink-200 bg-ink-25 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-500">
          2 · Plan de cuotas / Línea
        </p>
        <p className="mt-0.5 text-sm text-ink-700">
          RCI, endeudamiento y SMVM de bolsillo → capital máximo y grilla de cuotas.
        </p>
      </div>
    </div>
  );
}

export function PasoRiesgo() {
  const { app, solicitar, finalizarRiesgo, reiniciarDemo } = useApplication();
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
    solicitar();
    setReglas(nuevas);
    setVisibles(0);
    setFaseIdx(0);
    setFase("evaluando");

    const n = FASES_RIESGO.length;
    for (let k = 1; k <= n; k++) {
      timers.current.push(
        window.setTimeout(() => {
          setFaseIdx(k);
          if (k < n) return;
          setFase("revelando");
          nuevas.forEach((_, j) => {
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
        }, 550 * k)
      );
    }
  }, [app, solicitar, finalizarRiesgo, limpiar]);

  const ev = app.riesgo.evaluadoCon;
  const desactualizado =
    yaCompleto &&
    ev !== null &&
    (ev.ingresoNeto !== app.laboral.ingresoNeto ||
      ev.fechaNacimiento !== (app.cliente?.fechaNacimiento ?? ""));

  const resultado = fase === "completo" ? app.riesgo.resultado : null;
  const rechazado = resultado === "RECHAZADO";
  const aprobado = resultado === "APROBADO";
  const listaVisible = fase === "completo" ? reglas : reglas.slice(0, visibles);
  const plan = evaluarPlan(app);
  const o = app.oferta;

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
              queda <strong>En trámite</strong>. La evaluación se resuelve en dos capas:
            </p>
          </div>
          <DiagramaCapas />
          <div className="mt-6 text-center">
            <Button size="lg" onClick={ejecutar}>
              Solicitar
            </Button>
          </div>
        </Card>
      )}

      {(fase === "evaluando" || fase === "revelando") && (
        <div className="animate-fade-in rounded-xl border border-brand-200 bg-brand-50/70 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand-700">
            <IconLoader width={16} height={16} />
            {fase === "evaluando"
              ? FASES_RIESGO[Math.min(faseIdx, FASES_RIESGO.length - 1)].mensaje
              : "Revelando el resultado de las reglas…"}
          </p>
          <ol className="mt-3 space-y-1.5">
            {FASES_RIESGO.map((f, i) => {
              const hecho = fase === "revelando" || i < faseIdx;
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

      {desactualizado && fase === "completo" && !rechazado && (
        <Banner tone="warning" title="Los datos cambiaron desde la última evaluación">
          <span className="flex flex-wrap items-center gap-2">
            Se modificaron datos evaluados por el motor o el plan. Volvé a ejecutar para actualizar
            el resultado. El ID de Crédito se conserva.
            <DemoTag
              variant="regla"
              detalle="La Guía define como disparadores el primer 'Solicitar' y los cambios en los créditos a renovar. Qué ocurre si se editan otros datos después de solicitar está pendiente."
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

      {(fase === "revelando" || fase === "completo") && (
        <section className="space-y-3">
          <CapaTitulo
            numero={1}
            titulo="Motor de riesgo — “El Patovica”"
            subtitulo="Filtro estricto de entrada: pasa / no pasa."
            action={
              resultado ? (
                <StatusBadge tone={rechazado ? "danger" : aprobado ? "success" : "warning"}>
                  {RESULTADO_LABEL[resultado]}
                </StatusBadge>
              ) : undefined
            }
          />
          <ul className="space-y-2.5">
            {listaVisible.map((rule, i) => (
              <RiskRule key={rule.id} rule={rule} index={i} />
            ))}
          </ul>
          {fase === "completo" && !rechazado && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
              <span>
                {reglas.length} reglas evaluadas
                {app.riesgo.fecha && <> · {app.riesgo.fecha}</>}
              </span>
              <Button size="sm" variant="ghost" onClick={ejecutar}>
                <IconRefresh width={14} height={14} />
                Volver a ejecutar
              </Button>
            </div>
          )}
        </section>
      )}

      {fase === "completo" && aprobado && (
        <>
          <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-success-700">
            <IconArrowDown width={14} height={14} />
            Aprobado por el motor · el plan de cuotas calcula la oferta
          </p>

          <section className="animate-fade-up space-y-3">
            <CapaTitulo
              numero={2}
              titulo="Plan de cuotas / Línea"
              subtitulo={`${plan.plan.nombre} · Sistema ${plan.plan.sistema.toLowerCase()}`}
              action={
                <DemoTag
                  variant="regla"
                  detalle="Los topes del plan (RCI, endeudamiento, SMVM de bolsillo) y el capital máximo son valores de demo."
                />
              }
            />
            <Card className="px-5 py-2 sm:px-6">
              <div className="divide-y divide-ink-100">
                <FilaPlan
                  label="Relación cuota-ingreso (RCI)"
                  valor={formatPct(plan.rciPct)}
                  detalle={`Cuota ${formatARS(plan.cuotaPlan)} sobre ingreso neto ${formatARS(plan.ingresoNeto)} · tope ${plan.plan.rciMaxPct} % (cuota máx. ${formatARS(plan.cuotaMaximaRci)})`}
                  ok={plan.cumpleRci}
                />
                <FilaPlan
                  label="Nivel de endeudamiento"
                  valor={formatPct(plan.endeudamientoPct)}
                  detalle={`Incluye cuotas vigentes por ${formatARS(plan.cuotasVigentes)} · máximo ${plan.plan.endeudamientoMaxPct} %`}
                  ok={plan.cumpleEndeudamiento}
                />
                <FilaPlan
                  label="SMVM de bolsillo"
                  valor={formatARS(plan.ingresoBolsillo)}
                  detalle={`Ingreso que queda luego de pagar cuotas · mínimo ${formatARS(plan.plan.smvmBolsillo)}`}
                  ok={plan.cumpleSmvm}
                />
              </div>
            </Card>
            <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 px-5 py-5 text-white shadow-card">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-100">
                    <IconWallet width={14} height={14} />
                    Capital máximo otorgable
                  </p>
                  <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">
                    {formatARS(plan.capitalMaximo)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {plan.plan.plazos.map((p) => (
                    <span
                      key={p}
                      className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-xs font-semibold"
                    >
                      {p} cuotas
                    </span>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-xs text-brand-100">
                Calculado con {formatARS(o.montoSolicitado)} en {o.plazo} cuotas. La oferta se
                recalcula contra esta grilla sin volver a consultar al motor.
              </p>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-success-200 bg-success-50 px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 animate-pop items-center justify-center rounded-full bg-success-600 text-white">
              <IconCheck width={20} height={20} strokeWidth={2.6} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-success-700">Oferta generada</p>
              <p className="text-xs text-success-700/80">
                Continuá para presentar la oferta al cliente.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {app.numeroCredito && (
                <StatusBadge tone="neutral">ID de Crédito {app.numeroCredito}</StatusBadge>
              )}
              <EstadoBadge estado={app.estado} />
            </div>
          </div>
        </>
      )}

      {fase === "completo" && rechazado && (
        <>
          <div className="rounded-xl border border-dashed border-ink-200 bg-ink-25 px-4 py-3 text-sm text-ink-400">
            <span className="font-semibold">2 · Plan de cuotas / Línea</span> — no se ejecuta: el
            motor rechazó la solicitud.
          </div>
          <div className="animate-fade-up rounded-2xl border border-danger-200 bg-danger-50 p-6 text-center sm:p-8">
            <span className="mx-auto flex h-14 w-14 animate-pop items-center justify-center rounded-full bg-danger-600 text-white shadow-sm">
              <IconX width={28} height={28} strokeWidth={2.6} />
            </span>
            <h3 className="mt-4 text-xl font-bold tracking-tight text-danger-700">
              Solicitud rechazada por el motor de riesgo
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-danger-600">
              La solicitud pasó automáticamente a estado Rechazado. Los códigos de las reglas no
              cumplidas quedan registrados de forma inmutable.
            </p>
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
                {sumarDias(app.rechazo?.fecha ?? "", 30)}. No lo bloquea de forma permanente.{" "}
                <DemoTag
                  variant="regla"
                  detalle="Excepción prevista: evaluación manual por el analista si el cliente presenta libre deuda."
                />
              </span>
            </div>
            <Button className="mt-5" variant="outline" onClick={reiniciarDemo}>
              Reiniciar demo
            </Button>
          </div>
        </>
      )}

      <Banner tone="info" title="Cómo se reparten las responsabilidades">
        <span className="flex flex-wrap items-center gap-2">
          El motor sólo filtra y devuelve los códigos de reglas no cumplidas. RCI, endeudamiento y
          SMVM residen en el plan de cuotas. El motor se vuelve a ejecutar al solicitar y cada vez
          que cambia el conjunto de créditos a renovar.
          <DemoTag
            variant="regla"
            detalle="Para ver un rechazo del motor: en el paso 1 cambiá la fecha de nacimiento (ej. 14/05/1945) y volvé a ejecutar. La edad queda fuera del rango permitido."
          />
        </span>
      </Banner>
    </div>
  );
}
