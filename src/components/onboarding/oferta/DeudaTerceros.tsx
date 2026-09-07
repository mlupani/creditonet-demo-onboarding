"use client";

import { useApplication } from "@/lib/application-context";
import { getProductoConfig } from "@/lib/config";
import { formatARS } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { DemoTag } from "@/components/ui/DemoTag";
import { IconInfo, IconLandmark } from "@/components/icons";

export function DeudaTerceros() {
  const { app, setDeudaTerceros } = useApplication();
  const config = getProductoConfig(app.configuracion.productoId);
  if (!config.permiteDeudaTerceros) return null;

  const o = app.oferta;
  const activa = o.deudaTerceros.importe > 0;

  return (
    <Card>
      <CardHeader
        title="Cancelación de deudas externas"
        description="Disponible sólo para productos que lo permiten."
        icon={<IconLandmark width={18} height={18} />}
        action={
          <DemoTag
            variant="config"
            detalle="Qué productos permiten destinar fondos a cancelar deuda de terceros es una definición pendiente. En la demo está habilitado."
          />
        }
      />
      <div className="space-y-3 p-5 sm:p-6">
        <Checkbox
          checked={activa}
          onChange={(v) => setDeudaTerceros(v ? 100_000 : 0)}
          label="Destinar parte del crédito a cancelar una deuda externa"
          description="Este importe será destinado a cancelar una deuda externa y reduce el dinero neto que recibe el cliente."
        />
        {activa && (
          <div className="animate-fade-up border-t border-ink-100 pt-3">
            <MoneyInput
              id="importe-terceros"
              label="Importe destinado a cancelación"
              value={o.deudaTerceros.importe}
              onChange={(v) => setDeudaTerceros(v)}
              hint="Se descuenta del neto a acreditar."
            />
            <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-500">
              <IconInfo width={13} height={13} className="mt-0.5 shrink-0 text-brand-500" />
              No se ejecuta una transferencia real en la demo. El importe de {formatARS(
                o.deudaTerceros.importe
              )}{" "}
              reduce el neto que recibe el cliente.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
