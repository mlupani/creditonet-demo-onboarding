"use client";

import { useApplication } from "@/lib/application-context";
import { BANCOS, PROVINCIAS, RUBROS, validarLaboralPost } from "@/lib/validation";
import type { DatosLaboralesPost } from "@/lib/types";
import { Banner } from "@/components/ui/Banner";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { YaInformadoBadge } from "@/components/ui/OrigenBadge";
import { IconBriefcase } from "@/components/icons";

export function PantallaLaboral() {
  const { app, patchLaboralPost } = useApplication();
  const l = app.postOferta.laboral;
  const err = validarLaboralPost(l);
  const set =
    (campo: keyof DatosLaboralesPost) =>
    (valor: string) =>
      patchLaboralPost({ [campo]: valor });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Datos laborales"
          description="Datos del empleador y de la acreditación. Se completan con la información de la etapa 1."
          icon={<IconBriefcase width={18} height={18} />}
        />
        <div className="grid gap-x-5 gap-y-1 p-5 sm:grid-cols-2 sm:p-6">
          <FormField
            id="pl-domicilio"
            label="Domicilio laboral"
            required
            badge={<YaInformadoBadge />}
            value={l.domicilioLaboral}
            onChange={set("domicilioLaboral")}
            error={err.domicilioLaboral}
          />
          <FormField
            id="pl-fecha"
            label="Fecha de ingreso laboral"
            required
            badge={<YaInformadoBadge />}
            value={l.fechaIngresoLaboral}
            onChange={set("fechaIngresoLaboral")}
            error={err.fechaIngresoLaboral}
            hint="dd/mm/aaaa"
          />
          <FormField
            id="pl-razon"
            label="Razón social del empleador"
            required
            badge={<YaInformadoBadge />}
            value={l.razonSocial}
            onChange={set("razonSocial")}
            error={err.razonSocial}
          />
          <SelectField
            id="pl-rubro"
            label="Rubro / actividad"
            required
            value={l.rubro}
            onChange={set("rubro")}
            options={RUBROS.map((r) => ({ value: r, label: r }))}
            error={err.rubro}
          />
          <SelectField
            id="pl-provincia"
            label="Provincia"
            required
            value={l.provincia}
            onChange={set("provincia")}
            options={PROVINCIAS.map((p) => ({ value: p, label: p }))}
            error={err.provincia}
          />
          <FormField
            id="pl-tel"
            label="Teléfono laboral"
            required
            badge={<YaInformadoBadge />}
            value={l.telefonoLaboral}
            onChange={set("telefonoLaboral")}
            inputMode="tel"
            error={err.telefonoLaboral}
          />
          <FormField
            id="pl-legajo"
            label="Número de legajo"
            required
            value={l.numeroLegajo}
            onChange={set("numeroLegajo")}
            error={err.numeroLegajo}
          />
          <SelectField
            id="pl-banco"
            label="Banco donde cobra"
            required
            value={l.bancoCobro}
            onChange={set("bancoCobro")}
            options={BANCOS.map((b) => ({ value: b, label: b }))}
            error={err.bancoCobro}
          />
          <FormField
            id="pl-cbu"
            label="CBU"
            required
            badge={<YaInformadoBadge />}
            value={l.cbu}
            onChange={(v) => patchLaboralPost({ cbu: v.replace(/\D/g, "").slice(0, 22) })}
            inputMode="numeric"
            error={err.cbu}
            className="sm:col-span-2"
          />
        </div>
      </Card>

      {Object.keys(err).length === 0 && (
        <Banner tone="success">Datos laborales completos.</Banner>
      )}
    </div>
  );
}
