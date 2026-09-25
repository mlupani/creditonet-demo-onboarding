"use client";

import type { ReactNode } from "react";
import { Card } from "./ui/Card";
import { StatusBadge } from "./ui/StatusBadge";
import { Button } from "./ui/Button";
import { IconCheck, IconClock, IconArrowRight } from "@/components/icons";
import { formatARS } from "@/lib/format";
import { TERMINOS } from "@/lib/terminologia";

export interface TimelineItem {
  label: string;
  estado: "done" | "current" | "pending";
}

function CheckDraw({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" strokeDasharray={48} className="animate-draw" />
    </svg>
  );
}

function TimelineCircle({ estado }: { estado: TimelineItem["estado"] }) {
  const done = estado === "done";
  const current = estado === "current";
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
        done
          ? "border-success-500 bg-success-500 text-white"
          : current
            ? "border-brand-500 bg-white text-brand-600 ring-4 ring-brand-100"
            : "border-ink-200 bg-white text-ink-300"
      }`}
    >
      {done ? (
        <IconCheck width={15} height={15} strokeWidth={3} />
      ) : current ? (
        <IconArrowRight width={14} height={14} strokeWidth={2.5} />
      ) : (
        <IconClock width={14} height={14} />
      )}
    </span>
  );
}

function TimelineText({ item }: { item: TimelineItem }) {
  const done = item.estado === "done";
  const current = item.estado === "current";
  return (
    <div>
      <p
        className={`text-xs font-semibold sm:text-[13px] ${
          done ? "text-ink-900" : current ? "text-brand-700" : "text-ink-400"
        }`}
      >
        {item.label}
      </p>
      <p
        className={`text-[11px] font-medium ${
          done ? "text-success-600" : current ? "text-brand-600" : "text-ink-400"
        }`}
      >
        {done ? "Completado" : current ? "En curso" : "Pendiente"}
      </p>
    </div>
  );
}

function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <>
      <ol className="hidden sm:block">
        <li className="flex">
          {items.map((item, index) => (
            <div key={item.label} className="relative flex-1">
              {index < items.length - 1 && (
                <span
                  aria-hidden
                  className={`absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-[15px] h-0.5 ${
                    item.estado === "done" ? "bg-success-400" : "bg-ink-200"
                  }`}
                />
              )}
              <div className="relative flex flex-col items-center text-center">
                <TimelineCircle estado={item.estado} />
                <div className="mt-2">
                  <TimelineText item={item} />
                </div>
              </div>
            </div>
          ))}
        </li>
      </ol>
      <ol className="sm:hidden">
        {items.map((item, index) => (
          <li key={item.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <TimelineCircle estado={item.estado} />
              {index < items.length - 1 && (
                <span
                  aria-hidden
                  className={`my-1 w-0.5 flex-1 ${item.estado === "done" ? "bg-success-400" : "bg-ink-200"}`}
                />
              )}
            </div>
            <div className="pb-5 pt-1">
              <TimelineText item={item} />
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

export function SuccessScreen({
  variant,
  titulo,
  numero,
  capital,
  neto,
  cuotas,
  valorCuota,
  timeline,
  primaryAction,
  secondaryAction,
  children,
}: {
  variant: "aprobado" | "enviada";
  titulo?: string;
  numero?: string | null;
  capital?: number;
  neto?: number;
  cuotas?: number;
  valorCuota?: number;
  timeline?: TimelineItem[];
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  children?: ReactNode;
}) {
  const aprobado = variant === "aprobado";
  return (
    <Card className="animate-fade-up overflow-hidden">
      <div
        className={`px-6 py-10 text-center sm:px-10 sm:py-12 ${
          aprobado ? "bg-success-50/70" : "bg-brand-50/60"
        }`}
      >
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full shadow-sm ${
            aprobado ? "animate-pop bg-success-600 text-white" : "animate-pop bg-brand-600 text-white"
          }`}
        >
          <CheckDraw className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
          {titulo ??
            (aprobado ? (
              <span className="text-success-700">✓ CRÉDITO APROBADO</span>
            ) : (
              "Solicitud enviada a análisis"
            ))}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-600">
          {aprobado
            ? "La solicitud pasó a estado Para liquidar y quedó en la Bandeja de Liquidación (Tesorería) para el desembolso."
            : "La solicitud quedó en la bandeja del analista de riesgo, que puede aprobarla, observarla o rechazarla."}
        </p>
        {aprobado && numero && (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-1.5 shadow-card">
            <span className="font-mono text-sm font-semibold text-ink-900">{numero}</span>
            <StatusBadge tone="success">Para liquidar</StatusBadge>
          </div>
        )}
      </div>

      <div className="px-6 py-6 sm:px-10">
        {aprobado && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Capital aprobado", value: formatARS(capital ?? 0), tone: "text-ink-900" },
              { label: TERMINOS.saldoAcreditacion, value: formatARS(neto ?? 0), tone: "text-success-700" },
              { label: "Cuotas", value: `${cuotas ?? 0}`, tone: "text-ink-900" },
              { label: "Valor de cuota", value: formatARS(valorCuota ?? 0), tone: "text-brand-700" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-ink-200 bg-white px-4 py-3.5 text-center shadow-card"
              >
                <p className="text-xs font-medium text-ink-500">{stat.label}</p>
                <p className={`mt-1 text-lg font-bold tabular-nums tracking-tight ${stat.tone}`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        )}
        {children}

        {timeline && (
          <div className="mt-6 rounded-xl border border-ink-200 bg-ink-25 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
              Recorrido de la solicitud
            </p>
            <div className="mt-4">
              <Timeline items={timeline} />
            </div>
          </div>
        )}

        <div className="mt-7 flex flex-col-reverse items-stretch justify-center gap-2.5 sm:flex-row">
          {secondaryAction && (
            <Button variant="outline" size="lg" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
          {primaryAction && (
            <Button variant="primary" size="lg" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
