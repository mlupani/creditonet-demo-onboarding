"use client";

import { useApplication } from "@/lib/application-context";
import { CONDICIONES_LABORALES, validarLaboral } from "@/lib/validation";
import { fechaAIso, isoAFecha, maskCuit } from "@/lib/format";
import { BANCOS } from "@/lib/parametros";
import { MultiSelectField } from "@/components/ui/MultiSelectField";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { OrigenBadge } from "@/components/ui/OrigenBadge";
import { IconBriefcase, IconLock, IconPlus, IconTrash } from "@/components/icons";

// Datos laborales y financieros mínimos configurados para el producto (Guía §3.2). El recibo
// que respalda el ingreso se pide en el legajo virtual, post-oferta.
export function PasoLaboralIngresos() {
  const { app, patchLaboral } = useApplication();
  const l = app.laboral;
  const errores = validarLaboral(l);
  const completos = Object.keys(errores).length === 0;
  const cuitsEmpleador = l.cuitsEmpleador.length > 0 ? l.cuitsEmpleador : [""];

  function actualizarCuitEmpleador(i: number, valor: string) {
    const siguiente = cuitsEmpleador.map((c, idx) => (idx === i ? maskCuit(valor) : c));
    patchLaboral({ cuitsEmpleador: siguiente });
  }

  function quitarCuitEmpleador(i: number) {
    patchLaboral({ cuitsEmpleador: l.cuitsEmpleador.filter((_, idx) => idx !== i) });
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
      <div className="space-y-6">
        <div className="p-5 sm:p-6">
          <p className="mb-3 text-base font-semibold text-ink-800">Datos laborales</p>
          <div className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
            <SelectField
              id="condicion-laboral"
              label="Condición laboral"
              required
              value={l.condicionLaboral}
              onChange={(v) => patchLaboral({ condicionLaboral: v })}
              options={CONDICIONES_LABORALES.map((c) => ({ value: c, label: c }))}
              error={errores.condicionLaboral}
              hint="Determina qué línea aplica y participa en la generación de la oferta. La situación BCRA y el buró interno (vistos al identificar al cliente) no bloquean la línea, sólo recortan el capital. No se puede modificar después de la oferta."
            />
            <FormField
              id="fecha-inicio"
              label="Fecha de inicio laboral"
              type="date"
              required
              value={fechaAIso(l.fechaInicioLaboral)}
              onChange={(v) => patchLaboral({ fechaInicioLaboral: isoAFecha(v) })}
              error={errores.fechaInicioLaboral}
            />
            <MultiSelectField
              id="banco-cobro"
              label="Bancos de cobro"
              required
              values={l.bancosCobro}
              onChange={(v) => patchLaboral({ bancosCobro: v })}
              options={BANCOS}
              error={errores.bancosCobro}
              hint="Podés elegir más de uno: en la carga post-oferta se asigna un CBU a cada banco."
              className="sm:col-span-2"
            />
            <div className="sm:col-span-2">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink-700">CUIT del empleador</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => patchLaboral({ cuitsEmpleador: [...cuitsEmpleador, ""] })}
                >
                  <IconPlus width={14} height={14} />
                  Agregar empleador
                </Button>
              </div>
              <div className="space-y-3">
                {cuitsEmpleador.map((cuit, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <FormField
                      id={`cuit-empleador-${i}`}
                      label={cuitsEmpleador.length > 1 ? `Empleador ${i + 1}` : "CUIT"}
                      className="flex-1"
                      value={maskCuit(cuit)}
                      onChange={(v) => actualizarCuitEmpleador(i, v)}
                      error={errores.cuitsEmpleador?.[i]}
                      inputMode="numeric"
                      maxLength={13}
                      placeholder="xx-xxxxxxxx-x"
                    />
                    {cuitsEmpleador.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-5 shrink-0"
                        onClick={() => quitarCuitEmpleador(i)}
                      >
                        <IconTrash width={14} height={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-ink-500">
                11 dígitos: los guiones se completan solos. Agregá más de uno si el cliente tiene
                más de un empleador (pluriempleo).
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <p className="mb-3 text-base font-semibold text-ink-800">Datos financieros</p>
          <div className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
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
            <FormField
              id="extracciones-fecha"
              label="Extracciones · Fecha de acreditación"
              type="date"
              value={fechaAIso(l.extraccionesFecha)}
              onChange={(v) => patchLaboral({ extraccionesFecha: isoAFecha(v) })}
            />
            <FormField
              id="transferencias-fecha"
              label="Transferencias · Fecha de acreditación"
              type="date"
              value={fechaAIso(l.transferenciasFecha)}
              onChange={(v) => patchLaboral({ transferenciasFecha: isoAFecha(v) })}
            />
            <MoneyInput
              id="disponible"
              label="Disponible"
              value={l.disponible}
              onChange={(v) => patchLaboral({ disponible: v })}
            />
          </div>
        </div>
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
