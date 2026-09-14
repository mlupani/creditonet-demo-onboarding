"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { CONDICIONES_LABORALES, validarLaboral } from "@/lib/validation";
import { BANCOS } from "@/lib/parametros";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { OrigenBadge } from "@/components/ui/OrigenBadge";
import {
  IconBriefcase,
  IconCheck,
  IconClock,
  IconLock,
  IconPlus,
  IconTrash,
  IconUpload,
} from "@/components/icons";

// El nombre del comprobante depende de la condición laboral: un pasivo presenta el recibo de
// haberes, no de sueldo.
function nombreRecibo(condicionLaboral: string): string {
  return condicionLaboral === "Jubilado / Pensionado" ? "Recibo de haberes" : "Recibo de sueldo";
}

// Datos laborales y financieros mínimos configurados para el producto (Guía §3.2).
export function PasoLaboralIngresos() {
  const { app, patchLaboral } = useApplication();
  const l = app.laboral;
  const errores = validarLaboral(l);
  const completos = Object.keys(errores).length === 0;
  const [subiendo, setSubiendo] = useState(false);
  const nombre = nombreRecibo(l.condicionLaboral);

  function adjuntarRecibo() {
    setSubiendo(true);
    window.setTimeout(() => {
      const n = l.recibos.length + 1;
      const slug = nombre.toLowerCase().replace(/\s+/g, "_");
      patchLaboral({
        recibos: [
          ...l.recibos,
          { id: `recibo-${Date.now()}`, nombre: `${slug}_${n}.jpg`, detalle: "1.2 MB · Hoy" },
        ],
      });
      setSubiendo(false);
    }, 900);
  }

  function quitarRecibo(id: string) {
    patchLaboral({ recibos: l.recibos.filter((r) => r.id !== id) });
  }

  return (
    <Card>
      <CardHeader
        title="Datos laborales y financieros"
        description="Los datos mínimos que el producto requiere para solicitar."
        icon={<IconBriefcase width={18} height={18} />}
        action={
          app.identificacion.tipoCliente === "EXISTENTE" ? (
            <OrigenBadge origen="Base interna" />
          ) : undefined
        }
      />
      <div className="grid gap-x-5 gap-y-1 p-5 sm:grid-cols-2 sm:p-6">
        <SelectField
          id="condicion-laboral"
          label="Condición laboral"
          required
          value={l.condicionLaboral}
          onChange={(v) => patchLaboral({ condicionLaboral: v })}
          options={CONDICIONES_LABORALES.map((c) => ({ value: c, label: c }))}
          error={errores.condicionLaboral}
          hint="Junto con la situación BCRA y la del buró interno determina qué línea aplica."
        />
        <FormField
          id="fecha-inicio"
          label="Fecha de inicio laboral"
          required
          value={l.fechaInicioLaboral}
          onChange={(v) => patchLaboral({ fechaInicioLaboral: v })}
          error={errores.fechaInicioLaboral}
          hint="dd/mm/aaaa"
        />
        <SelectField
          id="banco-cobro"
          label="Banco de cobro"
          required
          value={l.bancoCobro}
          onChange={(v) => patchLaboral({ bancoCobro: v })}
          options={BANCOS.map((b) => ({ value: b, label: b }))}
          error={errores.bancoCobro}
        />
        <MoneyInput
          id="ingreso-bruto"
          label="Ingreso bruto"
          required
          value={l.ingresoBruto}
          onChange={(v) => patchLaboral({ ingresoBruto: v })}
          error={errores.ingresoBruto}
          hint="Haberes brutos mensuales."
        />
        <MoneyInput
          id="ingreso-neto"
          label="Ingreso neto"
          required
          value={l.ingresoNeto}
          onChange={(v) => patchLaboral({ ingresoNeto: v })}
          error={errores.ingresoNeto}
          hint="Ingreso mensual de bolsillo. Base del cálculo de RCI."
        />
        <MoneyInput
          id="monto-extraido"
          label="Monto extraído / transferido el día de cobro"
          required
          value={l.montoExtraidoDiaCobro}
          onChange={(v) => patchLaboral({ montoExtraidoDiaCobro: v })}
          error={errores.montoExtraidoDiaCobro}
          hint="Movimiento de la cuenta sueldo el día de la acreditación."
          className="sm:col-span-2"
        />
      </div>

      <div className="border-t border-ink-100 px-5 py-4 sm:px-6">
        <p className="flex items-center gap-2 text-sm font-medium text-ink-700">
          {nombre}
          <span className="text-danger-500">*</span>
        </p>
        <p className="mt-0.5 text-xs text-ink-500">
          Respalda el ingreso declarado. Se incorpora al legajo virtual: no se vuelve a pedir
          después de la oferta.
        </p>

        {l.recibos.length > 0 && (
          <ul className="mt-3 space-y-2">
            {l.recibos.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-success-200 bg-success-50/60 p-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-success-200 bg-success-100 text-success-600">
                  <IconCheck width={16} height={16} strokeWidth={2.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">{r.nombre}</p>
                  <p className="text-xs text-success-700">{r.detalle}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => quitarRecibo(r.id)}>
                  <IconTrash width={14} height={14} />
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        )}

        {subiendo && (
          <div className="mt-3 flex animate-pulse items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/60 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-200 bg-brand-100 text-brand-600">
              <IconUpload width={16} height={16} />
            </span>
            <p className="text-sm font-medium text-brand-700">Subiendo documento…</p>
          </div>
        )}

        <Button
          className="mt-3"
          size="sm"
          variant="outline"
          onClick={adjuntarRecibo}
          disabled={subiendo}
        >
          {l.recibos.length === 0 ? (
            <IconUpload width={14} height={14} />
          ) : (
            <IconPlus width={14} height={14} />
          )}
          {l.recibos.length === 0 ? `Adjuntar ${nombre.toLowerCase()}` : "Agregar otro recibo"}
        </Button>

        {errores.recibos && l.recibos.length === 0 && !subiendo && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-danger-600">
            <IconClock width={13} height={13} />
            {errores.recibos}
          </p>
        )}
      </div>

      <div className="space-y-3 border-t border-ink-100 px-5 py-4 sm:px-6">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-500">
          <IconLock width={14} height={14} className="mt-0.5 shrink-0 text-brand-500" />
          Persistencia obligatoria: los ingresos y extracciones quedan guardados para auditoría y
          reevaluaciones futuras.
        </p>
        {completos ? (
          <Banner tone="success">Los datos mínimos están completos. Ya podés solicitar.</Banner>
        ) : (
          <Banner tone="warning">
            Revisá los campos marcados: cada mensaje indica qué corregir para poder continuar.
          </Banner>
        )}
      </div>
    </Card>
  );
}
