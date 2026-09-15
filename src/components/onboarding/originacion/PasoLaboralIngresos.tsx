"use client";

import { useApplication } from "@/lib/application-context";
import { validarLaboral } from "@/lib/validation";
import { onlyDigits } from "@/lib/format";
import { BANCOS } from "@/lib/parametros";
import { Banner } from "@/components/ui/Banner";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { OrigenBadge } from "@/components/ui/OrigenBadge";
import { IconBriefcase, IconLock } from "@/components/icons";

// Datos laborales y financieros mínimos configurados para el producto (Guía §3.2). El recibo
// que respalda el ingreso se pide en el legajo virtual, post-oferta.
export function PasoLaboralIngresos() {
  const { app, patchLaboral } = useApplication();
  const l = app.laboral;
  const errores = validarLaboral(l);
  const completos = Object.keys(errores).length === 0;

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
        />
        <FormField
          id="cuit-empleador"
          label="CUIT del empleador"
          required
          value={l.cuitEmpleador}
          onChange={(v) => patchLaboral({ cuitEmpleador: onlyDigits(v).slice(0, 11) })}
          error={errores.cuitEmpleador}
          inputMode="numeric"
          maxLength={11}
          hint="11 dígitos, sin guiones."
        />
      </div>

      <div className="border-t border-ink-100 px-5 py-4 sm:px-6">
        <p className="text-sm font-semibold text-ink-800">Información adicional</p>
        <p className="mt-0.5 text-xs text-ink-500">
          No es obligatoria para continuar; queda &ldquo;No informado&rdquo; si no se completa.
        </p>
        <div className="mt-3 grid gap-x-5 gap-y-1 sm:grid-cols-2">
          <MoneyInput
            id="disponible"
            label="Saldo disponible"
            value={l.disponible}
            onChange={(v) => patchLaboral({ disponible: v })}
          />
          <MoneyInput
            id="debitos-no-remunerativos"
            label="Débitos no remunerativos"
            value={l.debitosNoRemunerativos}
            onChange={(v) => patchLaboral({ debitosNoRemunerativos: v })}
          />
          <FormField
            id="extracciones-fecha"
            label="Extracciones · Fecha de acreditación"
            value={l.extraccionesFecha}
            onChange={(v) => patchLaboral({ extraccionesFecha: v })}
            hint="dd/mm/aaaa"
          />
          <MoneyInput
            id="extracciones-importe"
            label="Extracciones · Importe"
            value={l.extraccionesImporte}
            onChange={(v) => patchLaboral({ extraccionesImporte: v })}
          />
          <FormField
            id="transferencias-fecha"
            label="Transferencias · Fecha de acreditación"
            value={l.transferenciasFecha}
            onChange={(v) => patchLaboral({ transferenciasFecha: v })}
            hint="dd/mm/aaaa"
          />
          <MoneyInput
            id="transferencias-importe"
            label="Transferencias · Importe"
            value={l.transferenciasImporte}
            onChange={(v) => patchLaboral({ transferenciasImporte: v })}
          />
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
