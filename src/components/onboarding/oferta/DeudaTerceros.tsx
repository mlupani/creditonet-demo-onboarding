"use client";

import { useApplication } from "@/lib/application-context";
import { DEUDA_TERCEROS_DEMO } from "@/lib/mocks";
import { ENTIDADES_ACREEDORAS, validarDeudaTerceros } from "@/lib/validation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { SelectField } from "@/components/ui/SelectField";
import { IconLandmark } from "@/components/icons";

// Cancelación de deudas con terceros (Guía §5.4): entidad, monto y CBU de destino.
export function DeudaTerceros() {
  const { app, setDeudaTerceros } = useApplication();
  const d = app.oferta.deudaTerceros;
  const err = validarDeudaTerceros(d);

  return (
    <Card>
      <CardHeader
        title="Cancelación de deudas con terceros"
        description="Destiná parte del préstamo a cancelar deudas en otras entidades financieras."
        icon={<IconLandmark width={18} height={18} />}
      />
      <div className="space-y-3 p-5 sm:p-6">
        <Checkbox
          checked={d.habilitado}
          onChange={(v) =>
            setDeudaTerceros(
              v
                ? { habilitado: true, ...DEUDA_TERCEROS_DEMO }
                : { habilitado: false, entidad: "", importe: 0, cbu: "" }
            )
          }
          label="Cancelar una deuda con otra entidad"
          description="El monto se transfiere al CBU de la entidad acreedora y reduce la acreditación neta."
        />
        {d.habilitado && (
          <div className="animate-fade-up grid gap-x-5 gap-y-1 border-t border-ink-100 pt-3 sm:grid-cols-2">
            <SelectField
              id="terceros-entidad"
              label="Entidad acreedora"
              required
              value={d.entidad}
              onChange={(v) => setDeudaTerceros({ entidad: v })}
              options={ENTIDADES_ACREEDORAS.map((e) => ({ value: e, label: e }))}
              error={err.entidad}
            />
            <MoneyInput
              id="terceros-importe"
              label="Monto a cancelar"
              required
              value={d.importe}
              onChange={(v) => setDeudaTerceros({ importe: v })}
              error={err.importe}
              hint="Se descuenta de la acreditación neta."
            />
            <FormField
              id="terceros-cbu"
              label="CBU de destino"
              required
              value={d.cbu}
              onChange={(v) => setDeudaTerceros({ cbu: v.replace(/\D/g, "").slice(0, 22) })}
              inputMode="numeric"
              error={err.cbu}
              hint="22 dígitos. En la demo no se ejecuta ninguna transferencia."
              className="sm:col-span-2"
            />
          </div>
        )}
      </div>
    </Card>
  );
}
