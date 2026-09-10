"use client";

import { useApplication } from "@/lib/application-context";
import { ESTADOS_CIVILES, TIPOS_VIVIENDA, validarPersonalesPost } from "@/lib/validation";
import type { DatosPersonalesPost } from "@/lib/types";
import { Banner } from "@/components/ui/Banner";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { YaInformadoBadge } from "@/components/ui/OrigenBadge";
import { DemoTag } from "@/components/ui/DemoTag";
import { IconUser } from "@/components/icons";

export function PantallaPersonales() {
  const { app, patchPersonalesPost } = useApplication();
  const p = app.postOferta.personales;
  const err = validarPersonalesPost(p);
  const set =
    (campo: keyof DatosPersonalesPost) =>
    (valor: string) =>
      patchPersonalesPost({ [campo]: valor });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Datos personales"
          description="Email, teléfono celular y domicilio real, más la situación personal del cliente."
          icon={<IconUser width={18} height={18} />}
          action={
            <DemoTag
              variant="config"
              detalle="Las opciones de tipo de vivienda, estado civil y demás listas provienen de la configuración de CreditoNet."
            />
          }
        />
        <div className="grid gap-x-5 gap-y-1 p-5 sm:grid-cols-2 sm:p-6">
          <FormField
            id="pp-email"
            label="Email"
            required
            type="email"
            badge={<YaInformadoBadge />}
            value={p.email}
            onChange={set("email")}
            error={err.email}
          />
          <FormField
            id="pp-domicilio"
            label="Domicilio real"
            required
            badge={<YaInformadoBadge />}
            value={p.domicilioReal}
            onChange={set("domicilioReal")}
            error={err.domicilioReal}
          />
          <FormField
            id="pp-celular"
            label="Teléfono celular"
            required
            value={p.telefonoCelular}
            onChange={set("telefonoCelular")}
            inputMode="tel"
            error={err.telefonoCelular}
            hint="Al menos 8 dígitos."
          />
          <FormField
            id="pp-nacionalidad"
            label="Nacionalidad"
            required
            badge={<YaInformadoBadge />}
            value={p.nacionalidad}
            onChange={set("nacionalidad")}
            error={err.nacionalidad}
          />
          <SelectField
            id="pp-estado-civil"
            label="Estado civil"
            required
            value={p.estadoCivil}
            onChange={set("estadoCivil")}
            options={ESTADOS_CIVILES.map((e) => ({ value: e, label: e }))}
            error={err.estadoCivil}
          />
          <SelectField
            id="pp-vivienda"
            label="Tipo de vivienda"
            required
            value={p.tipoVivienda}
            onChange={set("tipoVivienda")}
            options={TIPOS_VIVIENDA.map((t) => ({ value: t, label: t }))}
            error={err.tipoVivienda}
          />
          <FormField
            id="pp-hijos"
            label="Hijos a cargo"
            required
            value={p.hijosACargo}
            onChange={set("hijosACargo")}
            inputMode="numeric"
            error={err.hijosACargo}
          />
          <SelectField
            id="pp-tarjeta"
            label="¿Posee tarjeta de crédito?"
            required
            value={p.tarjetaCredito}
            onChange={set("tarjetaCredito")}
            options={[
              { value: "Sí", label: "Sí" },
              { value: "No", label: "No" },
            ]}
            error={err.tarjetaCredito}
          />
        </div>
      </Card>

      {Object.keys(err).length === 0 && (
        <Banner tone="success">Datos personales completos.</Banner>
      )}
    </div>
  );
}
