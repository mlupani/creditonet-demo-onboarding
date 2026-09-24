"use client";

import { useApplication } from "@/lib/application-context";
import { CONDICIONES_LABORALES, validarLaboral } from "@/lib/validation";
import { fechaAIso, isoAFecha, maskCuit } from "@/lib/format";
import { BANCOS } from "@/lib/parametros";
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
  const empleadores = l.empleadores.length > 0 ? l.empleadores : [{ banco: "", cuit: "", razonSocial: "" }];
  const esPlaceholder = l.empleadores.length === 0;

  function actualizarEmpleador(i: number, patch: Partial<{ banco: string; cuit: string; razonSocial: string }>) {
    if (esPlaceholder) {
      const base = { banco: "", cuit: "", razonSocial: "" };
      const nuevo = { ...base, ...patch };
      if (patch.cuit !== undefined) nuevo.cuit = maskCuit(patch.cuit);
      patchLaboral({ empleadores: [nuevo] });
      return;
    }
    const siguiente = l.empleadores.map((emp, idx) => {
      if (idx !== i) return emp;
      const actualizado = { ...emp, ...patch };
      if (patch.cuit !== undefined) actualizado.cuit = maskCuit(patch.cuit);
      return actualizado;
    });
    patchLaboral({ empleadores: siguiente });
  }

  function quitarEmpleador(i: number) {
    if (esPlaceholder) return;
    patchLaboral({ empleadores: l.empleadores.filter((_, idx) => idx !== i) });
  }

  function agregarEmpleador() {
    if (esPlaceholder) {
      patchLaboral({
        empleadores: [
          { banco: "", cuit: "", razonSocial: "" },
          { banco: "", cuit: "", razonSocial: "" },
        ],
      });
      return;
    }
    patchLaboral({ empleadores: [...l.empleadores, { banco: "", cuit: "", razonSocial: "" }] });
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
            <div className="sm:col-span-2">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink-800">Empleadores</span>
                <Button size="sm" variant="outline" onClick={agregarEmpleador}>
                  <IconPlus width={14} height={14} />
                  Agregar empleador
                </Button>
              </div>
              <div className="space-y-4">
                {empleadores.map((emp, i) => {
                  const err = errores.empleadores?.[i];
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-ink-200 bg-ink-50/50 p-4"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-ink-500">
                          Empleador {i + 1}
                        </span>
                        {empleadores.length > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Quitar empleador ${i + 1}`}
                            onClick={() => quitarEmpleador(i)}
                          >
                            <IconTrash width={14} height={14} />
                          </Button>
                        )}
                      </div>
                      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-3">
                        <SelectField
                          id={`empleador-${i}-banco`}
                          label="Banco"
                          required
                          value={emp.banco}
                          onChange={(v) => actualizarEmpleador(i, { banco: v })}
                          options={BANCOS.map((b) => ({ value: b, label: b }))}
                          placeholder="Seleccionar banco"
                          error={err?.banco}
                        />
                        <FormField
                          id={`empleador-${i}-cuit`}
                          label="CUIT del empleador"
                          required
                          value={maskCuit(emp.cuit)}
                          onChange={(v) => actualizarEmpleador(i, { cuit: v })}
                          error={err?.cuit}
                          inputMode="numeric"
                          maxLength={13}
                          placeholder="xx-xxxxxxxx-x"
                        />
                        <FormField
                          id={`empleador-${i}-razon`}
                          label="Razón social"
                          required
                          value={emp.razonSocial}
                          onChange={(v) => actualizarEmpleador(i, { razonSocial: v })}
                          error={err?.razonSocial}
                          placeholder="Ej.: Sanatorio Modelo S.A."
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-ink-500">
                Seleccioná el banco donde cobra, el CUIT (11 dígitos, guiones automáticos) y la
                razón social. Agregá más filas si el cliente tiene pluriempleo.
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
            <MoneyInput
              id="extracciones-saldo"
              label="Saldo de acreditación"
              value={l.extraccionesImporte}
              onChange={(v) => patchLaboral({ extraccionesImporte: v })}
            />
            <MoneyInput
              id="transferencias-saldo"
              label="Extracciones / Transferencias - Saldo de acreditación"
              value={l.transferenciasImporte}
              onChange={(v) => patchLaboral({ transferenciasImporte: v })}
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
