"use client";

import { useApplication } from "@/lib/application-context";
import {
  BANCOS,
  estadoCamposAdicionales,
  validarLaboral,
} from "@/lib/validation";
import type { LaboralIngresos } from "@/lib/types";
import { Banner } from "@/components/ui/Banner";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { DemoTag } from "@/components/ui/DemoTag";
import { IconBriefcase, IconCheckCircle, IconInfo } from "@/components/icons";

export function PasoLaboralIngresos() {
  const { app, patchLaboral } = useApplication();
  const l = app.laboral;
  const errores = validarLaboral(l, app.configuracion.productoId);
  const set =
    (campo: keyof LaboralIngresos) =>
    (valor: string | number) =>
      patchLaboral({ [campo]: valor } as Partial<LaboralIngresos>);

  const adicionales = estadoCamposAdicionales(l, app.configuracion.productoId);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Datos laborales e ingresos"
          description="Campos obligatorios para habilitar la evaluación de riesgo."
          icon={<IconBriefcase width={18} height={18} />}
        />
        <div className="grid gap-x-5 gap-y-1 p-5 sm:grid-cols-2 sm:p-6">
          <SelectField
            id="banco-sueldo"
            label="Banco donde cobra el sueldo"
            required
            value={l.bancoSueldo}
            onChange={set("bancoSueldo")}
            options={BANCOS.map((b) => ({ value: b, label: b }))}
            error={errores.bancoSueldo}
          />
          <FormField
            id="cbu"
            label="CBU"
            required
            value={l.cbu}
            onChange={(v) => patchLaboral({ cbu: v.replace(/\D/g, "").slice(0, 22) })}
            inputMode="numeric"
            error={errores.cbu}
            hint="22 dígitos, sin espacios ni guiones."
          />
          <MoneyInput
            id="ingreso-neto"
            label="Ingreso neto"
            required
            value={l.ingresoNeto}
            onChange={(v) => patchLaboral({ ingresoNeto: v })}
            error={errores.ingresoNeto}
            hint="Ingreso mensual de bolsillo del cliente."
          />
          <MoneyInput
            id="ingreso-bruto"
            label="Ingreso bruto"
            required
            value={l.ingresoBruto}
            onChange={(v) => patchLaboral({ ingresoBruto: v })}
            error={errores.ingresoBruto}
            hint="Suma de haberes brutos mensuales."
          />
          <FormField
            id="fecha-inicio"
            label="Fecha de inicio laboral"
            required
            value={l.fechaInicioLaboral}
            onChange={set("fechaInicioLaboral")}
            error={errores.fechaInicioLaboral}
            hint="dd/mm/aaaa"
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Información adicional"
          description="Campos configurables. Pueden ser obligatorios según el producto."
          icon={<IconInfo width={18} height={18} />}
          action={
            <DemoTag
              variant="config"
              detalle="Qué campos adicionales son obligatorios por producto es una definición pendiente. En la demo, sólo Email y CUIT del empleador bloquean la evaluación."
            />
          }
        />
        <div className="divide-y divide-ink-100">
          {adicionales.map((campo) => (
            <div
              key={campo.id}
              className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 sm:px-6"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-800">
                  {campo.label}
                  {campo.obligatorioPorProducto && (
                    <span className="ml-1 text-danger-500">*</span>
                  )}
                </p>
                {!campo.completo && (
                  <p className="mt-0.5 text-xs text-ink-500">
                    Este campo puede ser obligatorio según la configuración del producto.
                  </p>
                )}
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  campo.completo
                    ? "border-success-200 bg-success-50 text-success-700"
                    : "border-ink-200 bg-ink-50 text-ink-500"
                }`}
              >
                {campo.completo ? (
                  <>
                    <IconCheckCircle width={13} height={13} />
                    {campo.valor}
                  </>
                ) : (
                  "No informado"
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="grid gap-x-5 gap-y-1 border-t border-ink-100 p-5 sm:grid-cols-2 sm:p-6">
          <FormField
            id="email"
            label="Email"
            required
            type="email"
            value={l.email}
            onChange={set("email")}
            error={errores.email}
            placeholder="nombre@dominio.com"
          />
          <FormField
            id="cuit-empleador"
            label="CUIT del empleador"
            required
            value={l.cuitEmpleador}
            onChange={set("cuitEmpleador")}
            error={errores.cuitEmpleador}
            hint="Formato: 30-12345678-9"
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="extracciones-fecha"
              label="Extracciones · fecha"
              value={l.extraccionesFecha}
              onChange={set("extraccionesFecha")}
              hint="dd/mm/aaaa"
            />
            <MoneyInput
              id="extracciones-importe"
              label="Importe"
              value={l.extraccionesImporte}
              onChange={(v) => patchLaboral({ extraccionesImporte: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="transferencias-fecha"
              label="Transferencias · fecha"
              value={l.transferenciasFecha}
              onChange={set("transferenciasFecha")}
              hint="dd/mm/aaaa"
            />
            <MoneyInput
              id="transferencias-importe"
              label="Importe"
              value={l.transferenciasImporte}
              onChange={(v) => patchLaboral({ transferenciasImporte: v })}
            />
          </div>
          <MoneyInput
            id="disponible"
            label="Disponible"
            value={l.disponible}
            onChange={(v) => patchLaboral({ disponible: v })}
          />
          <MoneyInput
            id="debitos-no-rem"
            label="Débitos no remunerativos"
            value={l.debitosNoRemunerativos}
            onChange={(v) => patchLaboral({ debitosNoRemunerativos: v })}
          />
        </div>
      </Card>

      {Object.keys(errores).length > 0 ? (
        <Banner tone="warning">
          Revisá los campos marcados: cada mensaje indica qué corregir para poder continuar.
        </Banner>
      ) : (
        <Banner tone="success">Los campos obligatorios están completos.</Banner>
      )}
    </div>
  );
}
