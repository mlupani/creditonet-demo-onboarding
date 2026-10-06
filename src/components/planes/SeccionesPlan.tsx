"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ORGANISMOS,
  AJUSTE_CUOTA_VARIABLE_PCT,
  CONDICIONES_BONIFICACION,
  TIPOS_CARGO,
  cargoNuevo,
  cargosDe,
  MAX_PLAZO_GRILLA,
  terminosDe,
  SISTEMAS_AMORTIZACION,
  TRATAMIENTOS_GASTO,
  type CargoPeriodico,
  type CondicionBonificacion,
  type FilaGrilla,
  type PlanCuotas,
  type SistemaAmortizacion,
  type TratamientoGasto,
} from "@/lib/config";
import { calcularCuota } from "@/lib/credit";
import { CONDICIONES_LABORALES } from "@/lib/motores";
import {
  PERFILES_INTERNOS,
  ROTULO_BCRA,
  ROTULO_PERFIL,
  SITUACIONES_BCRA,
  type PlanAbm,
} from "@/lib/planes";
import { formatARS } from "@/lib/format";
import { useServicios } from "@/lib/servicios";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { MultiSelectField } from "@/components/ui/MultiSelectField";
import { SelectField } from "@/components/ui/SelectField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
import { MAX_RANGOS_SUELDO } from "@/lib/config";
import { CampoNumero, Panel, Subtitulo } from "@/components/productos/campos";
import { fechaAIso, isoAFecha } from "@/lib/format";
import { ESTADO_PRODUCTO_ABM_META } from "@/components/productos/ListaProductos";
import { IconEye, IconPlus, IconTable, IconTrash } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { capitalesDe, GrillaCuotas } from "@/components/onboarding/oferta/GrillaCuotas";
import { crearXlsx } from "@/lib/xlsx";

export interface SeccionPlanProps {
  p: PlanAbm;
  set: (cambio: (p: PlanAbm) => PlanAbm) => void;
  errores: Record<string, string>;
  // Los errores sólo se muestran después del primer intento de guardar.
  ver: boolean;
}

function useEditores(set: SeccionPlanProps["set"]) {
  return {
    cf: (patch: Partial<PlanCuotas>) => set((p) => ({ ...p, config: { ...p.config, ...patch } })),
  };
}

const alternar = <T,>(lista: T[], valor: T, activo: boolean): T[] =>
  activo ? [...lista.filter((x) => x !== valor), valor] : lista.filter((x) => x !== valor);

function Grilla({ children, cols = 2 }: { children: React.ReactNode; cols?: 2 | 3 }) {
  return (
    <div className={`grid gap-4 ${cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>{children}</div>
  );
}


// --- 1. Datos generales ---

function DatosGenerales({ p, set, errores, ver }: SeccionPlanProps) {
  const { cf } = useEditores(set);
  const meta = ESTADO_PRODUCTO_ABM_META[p.config.estado];
  return (
    <Panel
      titulo="Datos generales"
      descripcion="Cabecera del plan: identificación, estado y vigencia."
      vivo
      nota="Un plan suspendido, eliminado o fuera de vigencia deja de habilitar clientes: si el organismo no tiene otro plan que los admita, las solicitudes se rechazan por falta de línea."
    >
      <Grilla>
        <FormField
          id="pl-codigo"
          label="ID"
          value={p.codigo}
          onChange={() => {}}
          disabled
          hint="Se asigna automáticamente."
        />
        <FormField
          id="pl-nombre"
          label="Nombre"
          required
          value={p.config.nombre}
          onChange={(v) => cf({ nombre: v })}
          error={ver ? errores.nombre : undefined}
        />
      </Grilla>
      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-700">Estado</p>
        <div className="flex items-center gap-3 rounded-lg border border-ink-200 bg-ink-25 px-3 py-2.5">
          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
          <span className="text-xs text-ink-500">
            Activo, suspendido o eliminado: se cambia con los botones del encabezado.
          </span>
        </div>
      </div>
      <Grilla>
        <FormField
          id="pl-vig-desde"
          label="Vigencia desde"
          type="date"
          required
          value={fechaAIso(p.config.vigenciaDesde)}
          onChange={(v) => cf({ vigenciaDesde: isoAFecha(v) })}
          error={ver ? errores.vigenciaDesde : undefined}
        />
        <FormField
          id="pl-vig-hasta"
          label="Vigencia hasta"
          type="date"
          value={fechaAIso(p.config.vigenciaHasta)}
          onChange={(v) => cf({ vigenciaHasta: v ? isoAFecha(v) : null })}
          error={ver ? errores.vigenciaHasta : undefined}
          hint="Vacío: sin vencimiento."
        />
      </Grilla>
    </Panel>
  );
}

// --- 2. Amortización ---

function Amortizacion({ p, set }: SeccionPlanProps) {
  const { cf } = useEditores(set);
  return (
    <Panel
      titulo="Amortización"
      descripcion="Sistema con el que se calcula la cuota y período de gracia."
      vivo
      nota="El sistema cambia la cuota que se calcula en la oferta. El período de gracia se informa en la tabla de cuotas."
    >
      <SelectField
        id="pl-sistema"
        label="Tipo de amortización"
        value={p.config.sistema}
        onChange={(v) => cf({ sistema: v as SistemaAmortizacion })}
        options={SISTEMAS_AMORTIZACION}
        hint={`Francés cuota fija: cuota constante · Francés cuota variable: arranca como el francés y se ajusta ${AJUSTE_CUOTA_VARIABLE_PCT} % por mes · Americano: sólo interés y el capital al final · Tasa directa: interés sobre el capital original · Alemán: capital constante y cuota decreciente.`}
      />
      <CampoNumero
        id="pl-gracia"
        label="Período de gracia"
        sufijo="días"
        value={p.config.periodoGraciaDias}
        onChange={(v) => cf({ periodoGraciaDias: v })}
        className="sm:max-w-xs"
      />
    </Panel>
  );
}

// --- 3. IVA / Sellos ---

function IvaSellos({ p, set, errores, ver }: SeccionPlanProps) {
  const { cf } = useEditores(set);
  return (
    <Panel
      titulo="IVA / Sellos"
      descripcion="Impuestos que el plan aplica sobre la operación."
      vivo
      nota="Se informan en la tabla de cuotas de la oferta."
    >
      <Checkbox
        checked={p.config.calculaIva}
        onChange={(v) => cf({ calculaIva: v })}
        label="Calcula IVA"
      />
      <Grilla>
        {p.config.calculaIva && (
          <CampoNumero
            id="pl-iva"
            label="IVA"
            sufijo="%"
            step={0.5}
            value={p.config.ivaPct}
            onChange={(v) => cf({ ivaPct: v })}
            error={ver ? errores.ivaPct : undefined}
          />
        )}
        <CampoNumero
          id="pl-sellos"
          label="Sellos"
          sufijo="%"
          step={0.1}
          value={p.config.sellosPct}
          onChange={(v) => cf({ sellosPct: v })}
          error={ver ? errores.sellosPct : undefined}
        />
      </Grilla>
    </Panel>
  );
}

// --- 4. Gastos de otorgamiento ---

function Gastos({ p, set, errores, ver }: SeccionPlanProps) {
  const { cf } = useEditores(set);
  const g = p.config.gastoOtorgamiento;
  const setG = (patch: Partial<typeof g>) => cf({ gastoOtorgamiento: { ...g, ...patch } });
  return (
    <Panel
      titulo="Gastos de otorgamiento"
      descripcion="Gasto que se cobra al otorgar el crédito."
      vivo
      nota="Cambia la cuota de la oferta y se informa en la tabla de cuotas."
    >
      <Grilla>
        <SelectField
          id="pl-gasto-tipo"
          label="Se calcula como"
          value={g.tipo}
          onChange={(v) => setG({ tipo: v as typeof g.tipo })}
          options={[
            { value: "PORCENTAJE", label: "Porcentaje del capital" },
            { value: "MONTO_FIJO", label: "Monto fijo" },
          ]}
        />
        {g.tipo === "PORCENTAJE" ? (
          <CampoNumero
            id="pl-gasto-valor"
            label="Porcentaje"
            sufijo="%"
            step={0.1}
            value={g.valor}
            onChange={(v) => setG({ valor: v })}
            error={ver ? errores.gastoOtorgamiento : undefined}
          />
        ) : (
          <MoneyInput
            id="pl-gasto-valor"
            label="Monto"
            value={g.valor}
            onChange={(v) => setG({ valor: v })}
            error={ver ? errores.gastoOtorgamiento : undefined}
          />
        )}
      </Grilla>
      <SelectField
        id="pl-gasto-tratamiento"
        label="Tratamiento del gasto"
        value={g.tratamiento}
        onChange={(v) => setG({ tratamiento: v as TratamientoGasto })}
        options={TRATAMIENTOS_GASTO}
        hint="Se capitaliza: el gasto se suma al capital financiado y paga interés · Se distribuye en las cuotas: se reparte en partes iguales sobre cada cuota."
        error={ver ? errores.gastoTratamiento : undefined}
        className="sm:max-w-md"
      />
    </Panel>
  );
}

// --- 5. Cargos periódicos ---

function Cargos({ p, set, errores, ver }: SeccionPlanProps) {
  const { cf } = useEditores(set);
  const servicios = useServicios();
  const cargos = p.config.cargos;
  const ivaPlan = p.config.calculaIva ? p.config.ivaPct : 0;
  const cambiar = (id: string, patch: Partial<CargoPeriodico>) =>
    cf({ cargos: cargos.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  // La forma de cálculo viene del servicio: al cambiar de cargo, el valor anterior deja de valer.
  const elegirServicio = (c: CargoPeriodico, servicioId: string) => {
    const nuevo = servicios.find((x) => x.id === servicioId);
    cambiar(c.id, {
      servicioId: servicioId || null,
      nombre: nuevo?.nombre ?? "",
      tipo: nuevo?.tipo ?? c.tipo,
      valor: nuevo && nuevo.tipo !== c.tipo ? 0 : c.valor,
    });
  };
  return (
    <Panel
      titulo="Cargos periódicos"
      descripcion="Cargos administrativos, de cobranza o de servicios que van incluidos en cada cuota."
      vivo
      accion={
        <Button size="sm" variant="subtle" onClick={() => cf({ cargos: [...cargos, cargoNuevo()] })}>
          <IconPlus width={14} height={14} />
          Agregar cargo
        </Button>
      }
      nota="Cambian la cuota de la oferta y se informan en la tabla de cuotas. Si el valor es sin IVA, se le suma el IVA del plan."
    >
      {ver && errores.cargos && <ValidationMessage tipo="error">{errores.cargos}</ValidationMessage>}
      {cargos.length === 0 && (
        <p className="rounded-xl border border-dashed border-ink-300 px-4 py-6 text-center text-sm text-ink-500">
          El plan no tiene cargos periódicos. Agregá uno con el botón “Agregar cargo”.
        </p>
      )}
      {cargos.map((c, i) => {
        const disponibles = servicios.filter((x) => x.estado === "ACTIVO" || x.id === c.servicioId);
        return (
          <div key={c.id} className="rounded-xl border border-ink-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <Subtitulo>Cargo {i + 1}</Subtitulo>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Quitar el cargo ${i + 1}`}
                onClick={() => cf({ cargos: cargos.filter((x) => x.id !== c.id) })}
              >
                <IconTrash width={14} height={14} />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField
                id={`pl-cargo-servicio-${c.id}`}
                label="Cargo/servicio"
                value={c.servicioId ?? ""}
                placeholder="Elegí un cargo"
                onChange={(v) => elegirServicio(c, v)}
                options={disponibles.map((x) => ({ value: x.id, label: x.nombre }))}
                hint={
                  c.servicioId
                    ? `Se calcula como ${TIPOS_CARGO.find((t) => t.value === c.tipo)?.label.toLowerCase()} (definido en Parámetros › Cargos/servicios).`
                    : "Se administran en Parámetros › Cargos/servicios."
                }
              />
              {c.servicioId &&
                (c.tipo === "MONTO_FIJO" ? (
                  <MoneyInput
                    id={`pl-cargo-valor-${c.id}`}
                    label="Monto por cuota"
                    value={c.valor}
                    onChange={(v) => cambiar(c.id, { valor: v })}
                  />
                ) : (
                  <CampoNumero
                    id={`pl-cargo-valor-${c.id}`}
                    label="Porcentaje"
                    sufijo={c.tipo === "PORCENTAJE_CUOTA" ? "% s/cuota" : "% s/capital"}
                    step={0.01}
                    value={c.valor}
                    onChange={(v) => cambiar(c.id, { valor: v })}
                  />
                ))}
              <SelectField
                id={`pl-cargo-iva-${c.id}`}
                label="IVA"
                value={c.conIva ? "CON" : "SIN"}
                onChange={(v) => cambiar(c.id, { conIva: v === "CON" })}
                options={[
                  { value: "SIN", label: "Sin IVA (se suma el IVA del plan)" },
                  { value: "CON", label: "Con IVA incluido" },
                ]}
                hint={
                  c.conIva
                    ? "El valor ya incluye el IVA."
                    : ivaPlan > 0
                      ? `Se le suma ${ivaPlan} % de IVA.`
                      : "El plan no calcula IVA: no se suma."
                }
              />
            </div>
          </div>
        );
      })}
      <Link href="/parametros?solapa=servicios" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
        Administrar cargos/servicios
      </Link>
    </Panel>
  );
}

// --- 6-8. Habilitación: BCRA, condición laboral y perfil interno ---

function Habilitacion({
  titulo,
  descripcion,
  error,
  children,
}: {
  titulo: string;
  descripcion: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <Panel
      titulo={titulo}
      descripcion={descripcion}
      vivo
      nota="Habilitación del plan: el plan sólo se usa con clientes cuyo perfil esté aceptado. Si ningún plan del organismo habilita al cliente, la solicitud se rechaza por falta de línea."
    >
      <div className="space-y-3">{children}</div>
      {error && <ValidationMessage tipo="error">{error}</ValidationMessage>}
    </Panel>
  );
}

function CondicionesBcra({ p, set, errores, ver }: SeccionPlanProps) {
  const { cf } = useEditores(set);
  return (
    <Habilitacion
      titulo="Condiciones BCRA"
      descripcion="Situaciones BCRA aceptadas por el plan."
      error={ver ? errores.situacionesBcra : undefined}
    >
      {SITUACIONES_BCRA.map((n) => (
        <Checkbox
          key={n}
          checked={p.config.situacionesBcra.includes(n)}
          onChange={(v) =>
            cf({ situacionesBcra: alternar(p.config.situacionesBcra, n, v).sort() })
          }
          label={ROTULO_BCRA[n]}
        />
      ))}
    </Habilitacion>
  );
}

function CondicionLaboral({ p, set, errores, ver }: SeccionPlanProps) {
  const { cf } = useEditores(set);
  return (
    <Habilitacion
      titulo="Condición laboral"
      descripcion="Condiciones laborales habilitadas para usar el plan."
      error={ver ? errores.condicionesLaborales : undefined}
    >
      {CONDICIONES_LABORALES.map((c) => (
        <Checkbox
          key={c}
          checked={p.config.condicionesLaborales.includes(c)}
          onChange={(v) => cf({ condicionesLaborales: alternar(p.config.condicionesLaborales, c, v) })}
          label={c}
        />
      ))}
    </Habilitacion>
  );
}

function PerfilRiesgo({ p, set, errores, ver }: SeccionPlanProps) {
  const { cf } = useEditores(set);
  return (
    <Habilitacion
      titulo="Perfil de riesgo"
      descripcion="Perfiles de riesgo interno habilitados para usar el plan."
      error={ver ? errores.perfilesInternos : undefined}
    >
      {PERFILES_INTERNOS.map((n) => (
        <Checkbox
          key={n}
          checked={p.config.perfilesInternos.includes(n)}
          onChange={(v) => cf({ perfilesInternos: alternar(p.config.perfilesInternos, n, v).sort() })}
          label={ROTULO_PERFIL[n]}
        />
      ))}
    </Habilitacion>
  );
}

// --- 9. Capital máximo ---

function CapitalMaximo({ p, set, errores, ver }: SeccionPlanProps) {
  const { cf } = useEditores(set);
  const rangos = p.config.rangosSueldoNeto;
  const cambiar = (id: string, patch: Partial<(typeof rangos)[number]>) =>
    cf({ rangosSueldoNeto: rangos.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  return (
    <Panel
      titulo="Capital máximo"
      descripcion="Tope de capital que otorga el plan según el sueldo neto del cliente."
      vivo
      nota="Es uno de los límites de capital de la oferta: gana el más restrictivo entre el universal, sueldos brutos, producto, plan, rango de sueldo neto y cuota máxima."
    >
      <div className="space-y-3">
        <p className="text-xs text-ink-500">
          Opcional, hasta {MAX_RANGOS_SUELDO} rangos: según el sueldo neto del cliente (desde incluido,
          hasta excluido) se limita el capital. Dejá “hasta” vacío para un rango sin tope. Si el sueldo
          cae fuera de todos los rangos, este límite no otorga capital.
        </p>
        {ver && errores.rangosSueldoNeto && (
          <ValidationMessage tipo="error">{errores.rangosSueldoNeto}</ValidationMessage>
        )}
        {rangos.map((r, i) => (
          <div key={r.id} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <MoneyInput
              id={`${r.id}-desde`}
              label={i === 0 ? "Sueldo neto desde" : "Desde"}
              value={r.desde}
              onChange={(v) => cambiar(r.id, { desde: v })}
            />
            <MoneyInput
              id={`${r.id}-hasta`}
              label={i === 0 ? "Sueldo neto hasta" : "Hasta"}
              value={r.hasta ?? 0}
              onChange={(v) => cambiar(r.id, { hasta: v > 0 ? v : null })}
            />
            <MoneyInput
              id={`${r.id}-capital`}
              label={i === 0 ? "Capital máximo" : "Capital"}
              value={r.capitalMaximo}
              onChange={(v) => cambiar(r.id, { capitalMaximo: v })}
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label="Quitar el rango"
              onClick={() => cf({ rangosSueldoNeto: rangos.filter((x) => x.id !== r.id) })}
              className="mb-1.5"
            >
              <IconTrash width={15} height={15} />
            </Button>
          </div>
        ))}
        <Button
          variant="subtle"
          size="sm"
          disabled={rangos.length >= MAX_RANGOS_SUELDO}
          onClick={() =>
            cf({
              rangosSueldoNeto: [
                ...rangos,
                {
                  id: `rango-${Date.now()}`,
                  desde: rangos.at(-1)?.hasta ?? 0,
                  hasta: null,
                  capitalMaximo: 0,
                },
              ],
            })
          }
        >
          <IconPlus width={14} height={14} />
          Agregar rango ({rangos.length}/{MAX_RANGOS_SUELDO})
        </Button>
      </div>
    </Panel>
  );
}

// --- 10. Cuota máxima ---

function CuotaMaxima({ p, set, errores, ver }: SeccionPlanProps) {
  const { cf } = useEditores(set);
  const rangos = p.config.rangosCuota;
  const cambiar = (id: string, patch: Partial<(typeof rangos)[number]>) =>
    cf({ rangosCuota: rangos.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  return (
    <Panel
      titulo="Cuota máxima"
      descripcion="Reglas que acotan la cuota: compiten y gana la menor."
      vivo
      nota="La cuota máxima resultante define cuánto capital soporta el cliente en el plazo elegido."
    >
      <div className="space-y-3">
        <Subtitulo>Por rango de sueldo neto</Subtitulo>
        <p className="text-xs text-ink-500">
          Según el sueldo neto del cliente (desde incluido, hasta excluido) rigen el mínimo de bolsillo
          (SMVM), el RCI sobre el ingreso neto y el tope de cuota del rango. Dejá “hasta” vacío para un
          rango sin tope. Si el sueldo cae fuera de todos los rangos, no hay cuota posible.
        </p>
        {ver && errores.rangosCuota && <ValidationMessage tipo="error">{errores.rangosCuota}</ValidationMessage>}
        {rangos.map((r, i) => (
          <div key={r.id} className="grid gap-3 sm:grid-cols-[repeat(5,minmax(0,1fr))_auto] sm:items-end">
            <MoneyInput
              id={`${r.id}-desde`}
              label={i === 0 ? "Sueldo neto desde" : "Desde"}
              value={r.desde}
              onChange={(v) => cambiar(r.id, { desde: v })}
            />
            <MoneyInput
              id={`${r.id}-hasta`}
              label={i === 0 ? "Sueldo neto hasta" : "Hasta"}
              value={r.hasta ?? 0}
              onChange={(v) => cambiar(r.id, { hasta: v > 0 ? v : null })}
            />
            <MoneyInput
              id={`${r.id}-smvm`}
              label={i === 0 ? "Mínimo de bolsillo (SMVM)" : "SMVM"}
              value={r.smvmBolsillo}
              onChange={(v) => cambiar(r.id, { smvmBolsillo: v })}
            />
            <CampoNumero
              id={`${r.id}-rci`}
              label={i === 0 ? "RCI (sobre ingreso neto)" : "RCI"}
              sufijo="%"
              value={r.rciPct}
              onChange={(v) => cambiar(r.id, { rciPct: v })}
            />
            <MoneyInput
              id={`${r.id}-cuota`}
              label={i === 0 ? "Cuota máxima" : "Cuota"}
              value={r.cuotaMaxima}
              onChange={(v) => cambiar(r.id, { cuotaMaxima: v })}
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label="Quitar el rango"
              onClick={() => cf({ rangosCuota: rangos.filter((x) => x.id !== r.id) })}
              className="mb-1.5"
            >
              <IconTrash width={15} height={15} />
            </Button>
          </div>
        ))}
        <Button
          variant="subtle"
          size="sm"
          onClick={() =>
            cf({
              rangosCuota: [
                ...rangos,
                {
                  id: `rc-${Date.now()}`,
                  desde: rangos.at(-1)?.hasta ?? 0,
                  hasta: null,
                  smvmBolsillo: rangos.at(-1)?.smvmBolsillo ?? 0,
                  rciPct: rangos.at(-1)?.rciPct ?? 0,
                  cuotaMaxima: 0,
                },
              ],
            })
          }
        >
          <IconPlus width={14} height={14} />
          Agregar rango
        </Button>
      </div>

      <div className="space-y-3 border-t border-ink-100 pt-4">
        <Subtitulo>Nivel de endeudamiento</Subtitulo>
        <CampoNumero
          id="pl-endeudamiento"
          label="Endeudamiento máximo"
          sufijo="%"
          value={p.config.endeudamientoMaxPct}
          onChange={(v) => cf({ endeudamientoMaxPct: v })}
          error={ver ? errores.endeudamientoMaxPct : undefined}
          hint="Sobre el ingreso bruto, igual para todos los sueldos."
          className="sm:max-w-xs"
        />
      </div>
    </Panel>
  );
}

// --- 11. Limitantes ---

function Limitantes({ p, set, errores, ver }: SeccionPlanProps) {
  const { cf } = useEditores(set);
  const l = p.config.limitantes;
  const setL = (patch: Partial<typeof l>) => cf({ limitantes: { ...l, ...patch } });
  return (
    <Panel
      titulo="Limitantes"
      descripcion="Recortes porcentuales sobre el capital ya calculado."
      vivo
      nota="Si aplican varios, manda el mayor recorte. 0 significa que la condición no recorta."
    >
      {ver && errores.limitantes && (
        <ValidationMessage tipo="error">{errores.limitantes}</ValidationMessage>
      )}
      <Grilla cols={3}>
        <CampoNumero
          id="pl-lim-sueldo"
          label="Sueldo recalculado para oferta"
          sufijo="%"
          value={l.sueldoRecalculadoPct}
          onChange={(v) => setL({ sueldoRecalculadoPct: v })}
          hint="Recorte cuando el sueldo se recalcula con los conceptos no remunerativos."
        />
      </Grilla>
      <div className="space-y-3">
        <Subtitulo>Situación BCRA</Subtitulo>
        <p className="text-xs text-ink-500">
          Sólo se listan las situaciones habilitadas en el plan. Elegí a cuáles se les aplica el recorte.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {p.config.situacionesBcra.map((n) => (
            <Checkbox
              key={n}
              checked={l.bcra.situaciones.includes(n)}
              onChange={(v) => setL({ bcra: { ...l.bcra, situaciones: alternar(l.bcra.situaciones, n, v).sort() } })}
              label={ROTULO_BCRA[n]}
            />
          ))}
        </div>
        <CampoNumero
          id="pl-lim-bcra"
          label="Recorte para las situaciones elegidas"
          sufijo="%"
          value={l.bcra.pct}
          onChange={(v) => setL({ bcra: { ...l.bcra, pct: v } })}
          className="sm:max-w-xs"
        />
      </div>
      <div className="space-y-3">
        <Subtitulo>Buró interno</Subtitulo>
        <p className="text-xs text-ink-500">
          Sólo se listan los perfiles habilitados en el plan. Elegí a cuáles se les aplica el recorte.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {p.config.perfilesInternos.map((n) => (
            <Checkbox
              key={n}
              checked={l.buroInterno.perfiles.includes(n)}
              onChange={(v) =>
                setL({ buroInterno: { ...l.buroInterno, perfiles: alternar(l.buroInterno.perfiles, n, v).sort() } })
              }
              label={ROTULO_PERFIL[n]}
            />
          ))}
        </div>
        <CampoNumero
          id="pl-lim-buro"
          label="Recorte para los perfiles elegidos"
          sufijo="%"
          value={l.buroInterno.pct}
          onChange={(v) => setL({ buroInterno: { ...l.buroInterno, pct: v } })}
          className="sm:max-w-xs"
        />
      </div>
    </Panel>
  );
}

// --- 12. Bonificaciones ---

function Bonificaciones({ p, set, errores, ver }: SeccionPlanProps) {
  const { cf } = useEditores(set);
  const lista = p.config.bonificaciones;
  const cambiar = (id: string, patch: Partial<(typeof lista)[number]>) =>
    cf({ bonificaciones: lista.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  return (
    <Panel
      titulo="Bonificaciones"
      descripcion="Campañas que bonifican cuotas al final del plan si el cliente paga al día."
      nota="Valores de ejemplo: se guardan pero no cambian el cálculo de la oferta. Los cargos del propio plan no se bonifican acá."
    >
      {ver && errores.bonificaciones && (
        <ValidationMessage tipo="error">{errores.bonificaciones}</ValidationMessage>
      )}
      {lista.length === 0 && <p className="text-sm text-ink-500">El plan no tiene campañas de bonificación.</p>}
      {lista.map((b) => (
        <div key={b.id} className="rounded-xl border border-ink-200 bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_16rem_14rem_auto] sm:items-end">
            <FormField
              id={`${b.id}-nombre`}
              label="Nombre de la campaña"
              value={b.nombre}
              onChange={(v) => cambiar(b.id, { nombre: v })}
            />
            <CampoNumero
              id={`${b.id}-cuotas`}
              label="Cuotas bonificadas al final del plan"
              sufijo="cuotas"
              min={1}
              value={b.cuotasBonificadas}
              onChange={(v) => cambiar(b.id, { cuotasBonificadas: Math.round(v) })}
            />
            <SelectField
              id={`${b.id}-condicion`}
              label="Condición"
              value={b.condicion}
              onChange={(v) => cambiar(b.id, { condicion: v as CondicionBonificacion })}
              options={[...CONDICIONES_BONIFICACION]}
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label="Quitar la campaña"
              onClick={() => cf({ bonificaciones: lista.filter((x) => x.id !== b.id) })}
              className="mb-1.5"
            >
              <IconTrash width={15} height={15} />
            </Button>
          </div>
        </div>
      ))}
      <Button
        variant="subtle"
        size="sm"
        onClick={() =>
          cf({
            bonificaciones: [
              ...lista,
              { id: `bonif-${Date.now()}`, nombre: "", cuotasBonificadas: 1, condicion: "PAGO_AL_DIA" },
            ],
          })
        }
      >
        <IconPlus width={14} height={14} />
        Agregar campaña
      </Button>
    </Panel>
  );
}

// --- 13. Topes de autorización ---

function Topes({ p, set, errores, ver }: SeccionPlanProps) {
  const { cf } = useEditores(set);
  const t = p.config.topes;
  return (
    <Panel
      titulo="Topes de autorización"
      descripcion="Hasta qué monto autoriza cada rol; por encima interviene el siguiente."
      nota="Valores de ejemplo: se guardan pero no cambian quién aprueba en la demo. Los cambios de oferta ya requieren refrendación del supervisor."
    >
      <Grilla>
        <MoneyInput
          id="pl-tope-analista"
          label="Analista de riesgo"
          value={t.montoAnalista}
          onChange={(v) => cf({ topes: { ...t, montoAnalista: v } })}
          error={ver ? errores.topes : undefined}
        />
        <MoneyInput
          id="pl-tope-supervisor"
          label="Supervisor"
          value={t.montoSupervisor}
          onChange={(v) => cf({ topes: { ...t, montoSupervisor: v } })}
        />
      </Grilla>
    </Panel>
  );
}

// --- 14. Grilla de tasas ---

function GrillaTasas({ p, set, errores, ver }: SeccionPlanProps) {
  const { cf } = useEditores(set);
  const grilla = p.config.grilla;
  const cambiar = (i: number, patch: Partial<FilaGrilla>) =>
    cf({ grilla: grilla.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const recomendar = (i: number) =>
    cf({ grilla: grilla.map((f, j) => ({ ...f, recomendada: j === i })) });
  const [viendo, setViendo] = useState(false);
  const cg = p.config.capitalGrilla;
  const setCg = (patch: Partial<typeof cg>) => cf({ capitalGrilla: { ...cg, ...patch } });
  const grillaValida = !errores.grilla;
  const exportar = () => {
    const plazos = terminosDe(grilla);
    const capitales = capitalesDe(cg.maximo, 0, cg.minimo - 1, cg.salto);
    const { sistema, gastoOtorgamiento: gasto } = p.config;
    const filas = [
      ["Capital", ...plazos.map((t) => `${t.plazo} cuotas`)],
      ["TNA %", ...plazos.map((t) => String(t.tna))],
      ...capitales.map((c) => [
        formatARS(c),
        ...plazos.map((t) => formatARS(calcularCuota(c, t.plazo, t.tna, sistema, gasto, cargosDe(p.config)))),
      ]),
    ];
    const blob = new Blob([crearXlsx("Grilla", filas) as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grilla-${p.config.id}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Panel
      titulo="Grilla de tasas"
      descripcion="TNA de cada plazo o rango de plazos. Es la grilla con la que se arma la oferta."
      vivo
      nota="La TNA de cada plazo sale de esta grilla y la cuota se calcula con el sistema del plan. El salto de capital lo escribís vos."
    >
      {ver && errores.grilla && <ValidationMessage tipo="error">{errores.grilla}</ValidationMessage>}
      <Grilla cols={3}>
        <MoneyInput
          id="pl-grilla-min"
          label="Capital mínimo de la grilla"
          value={cg.minimo}
          onChange={(v) => setCg({ minimo: v })}
        />
        <MoneyInput
          id="pl-grilla-max"
          label="Capital máximo de la grilla"
          value={cg.maximo}
          onChange={(v) => setCg({ maximo: v })}
        />
        <MoneyInput
          id="pl-grilla-salto"
          label="Salto de capital"
          value={cg.salto}
          onChange={(v) => setCg({ salto: v })}
          hint="Cada cuánto se abre una fila de capital."
        />
      </Grilla>
      <div className="overflow-x-auto rounded-xl border border-ink-200">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead>
            <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              <th className="px-3 py-2.5">Tipo</th>
              <th className="px-3 py-2.5">Desde (cuotas)</th>
              <th className="px-3 py-2.5">Hasta (cuotas)</th>
              <th className="px-3 py-2.5">Cada</th>
              <th className="px-3 py-2.5">TNA</th>
              <th className="px-3 py-2.5">Recomendada</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {grilla.map((f, i) => {
              const corrido = f.modo === "CORRIDO";
              const entrada =
                "h-9 w-full rounded-lg border border-ink-300 bg-white px-2 text-sm tabular-nums outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-ink-50 disabled:text-ink-300";
              return (
                <tr key={i}>
                  <td className="px-3 py-2">
                    <select
                      aria-label={`Tipo de la fila ${i + 1}`}
                      value={corrido ? "CORRIDO" : "EXACTO"}
                      onChange={(e) =>
                        cambiar(
                          i,
                          e.target.value === "CORRIDO"
                            ? { modo: "CORRIDO", plazoHasta: f.plazoHasta ?? f.plazo + 12, cada: f.cada ?? 1 }
                            : { modo: "EXACTO" }
                        )
                      }
                      className="h-9 rounded-lg border border-ink-300 bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    >
                      <option value="EXACTO">Plazo exacto</option>
                      <option value="CORRIDO">Rango corrido</option>
                    </select>
                  </td>
                  <td className="w-28 px-3 py-2">
                    <input
                      type="number"
                      aria-label={`${corrido ? "Cuota inicial" : "Plazo"} de la fila ${i + 1}`}
                      min={1}
                      max={MAX_PLAZO_GRILLA}
                      step={1}
                      value={f.plazo}
                      onChange={(e) => cambiar(i, { plazo: Number(e.target.value) })}
                      className={entrada}
                    />
                  </td>
                  <td className="w-28 px-3 py-2">
                    <input
                      type="number"
                      aria-label={`Cuota final de la fila ${i + 1}`}
                      min={1}
                      max={MAX_PLAZO_GRILLA}
                      step={1}
                      disabled={!corrido}
                      value={corrido ? (f.plazoHasta ?? f.plazo) : ""}
                      onChange={(e) => cambiar(i, { plazoHasta: Number(e.target.value) })}
                      className={entrada}
                    />
                  </td>
                  <td className="w-24 px-3 py-2">
                    <input
                      type="number"
                      aria-label={`Cada cuántas cuotas se ofrece un plazo en la fila ${i + 1}`}
                      min={1}
                      step={1}
                      disabled={!corrido}
                      value={corrido ? (f.cada ?? 1) : ""}
                      onChange={(e) => cambiar(i, { cada: Number(e.target.value) })}
                      className={entrada}
                    />
                  </td>
                  <td className="w-28 px-3 py-2">
                    <input
                      type="number"
                      aria-label={`TNA de la fila ${i + 1}`}
                      min={0}
                      step={0.5}
                      value={f.tna}
                      onChange={(e) => cambiar(i, { tna: Number(e.target.value) })}
                      className={entrada}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="radio"
                      name="grilla-recomendada"
                      aria-label={`Marcar la fila ${i + 1} como recomendada`}
                      checked={f.recomendada}
                      onChange={() => recomendar(i)}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Quitar la fila ${i + 1}`}
                      disabled={grilla.length <= 1}
                      onClick={() => cf({ grilla: grilla.filter((_, j) => j !== i) })}
                    >
                      <IconTrash width={15} height={15} />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-500">
        Plazo exacto: sólo esa cantidad de cuotas. Rango corrido: todas las cantidades de “desde” a
        “hasta” (o una cada tantas cuotas, si completás “cada”) con la misma TNA.
      </p>
      <div className="flex flex-wrap gap-2">
        {(["EXACTO", "CORRIDO"] as const).map((modo) => (
          <Button
            key={modo}
            variant="subtle"
            size="sm"
            onClick={() => {
              const ultima = terminosDe(grilla).at(-1);
              const desde = (ultima?.plazo ?? 0) + 1;
              cf({
                grilla: [
                  ...grilla,
                  {
                    plazo: desde,
                    ...(modo === "CORRIDO" ? { modo, plazoHasta: desde + 11, cada: 1 } : {}),
                    tna: (ultima?.tna ?? 60) + 3,
                    recomendada: false,
                    primeraCuota: ultima?.primeraCuota ?? "10/10/2026",
                  },
                ],
              });
            }}
          >
            <IconPlus width={14} height={14} />
            {modo === "EXACTO" ? "Agregar plazo" : "Agregar rango"}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="subtle" size="sm" disabled={!grillaValida} onClick={() => setViendo(true)}>
          <IconEye width={14} height={14} />
          Ver grilla
        </Button>
        <Button variant="subtle" size="sm" disabled={!grillaValida} onClick={exportar}>
          <IconTable width={14} height={14} />
          Exportar a Excel
        </Button>
      </div>
      <Modal
        open={viendo}
        onClose={() => setViendo(false)}
        title="Grilla de cuotas"
        maxWidth="max-w-4xl"
        footer={
          <Button variant="subtle" onClick={() => setViendo(false)}>
            Cerrar
          </Button>
        }
      >
        <p className="mb-3 text-xs text-ink-500">
          Cuota mensual de cada capital según la cantidad de cuotas, de {formatARS(cg.minimo)} a{" "}
          {formatARS(cg.maximo)}, cada {formatARS(cg.salto)}.
        </p>
        {viendo && grillaValida && (
          <GrillaCuotas
            terms={terminosDe(grilla)}
            sistema={p.config.sistema}
            gasto={p.config.gastoOtorgamiento}
            cargos={cargosDe(p.config)}
            capitalMaximo={cg.maximo}
            capitalMinimo={cg.minimo - 1}
            paso={cg.salto}
            capital={0}
            plazo={terminosDe(grilla)[0].plazo}
            seleccionable={false}
            onSeleccionar={() => {}}
          />
        )}
      </Modal>
    </Panel>
  );
}

// --- 15. Vinculaciones ---

function Vinculaciones({ p, set }: SeccionPlanProps) {
  const elegidos = ORGANISMOS.filter((o) => p.organismos.includes(o.id));
  return (
    <Panel
      titulo="Vinculaciones"
      descripcion="Organismos a los que se asigna el plan."
      vivo
      nota="Un organismo puede tener varios planes."
    >
      <div className="space-y-3">
        <Subtitulo>Organismos</Subtitulo>
        {p.organismos.length === 0 && (
          <Banner tone="warning" title="El plan no está asignado a ningún organismo">
            Mientras no lo asignes a uno, no se usa en ninguna solicitud.
          </Banner>
        )}
        <MultiSelectField
          id="plan-organismos"
          label="Organismos vinculados"
          values={elegidos.map((o) => o.nombre)}
          onChange={(nombres) =>
            set((x) => ({ ...x, organismos: ORGANISMOS.filter((o) => nombres.includes(o.nombre)).map((o) => o.id) }))
          }
          options={ORGANISMOS.map((o) => o.nombre)}
          placeholder="Elegí los organismos…"
          plural="organismos"
          className="sm:max-w-md"
        />
        {/* Los elegidos quedan a la vista: con muchos organismos el select solo muestra la cantidad. */}
        {elegidos.length > 0 && (
          <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
            {elegidos.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">{o.nombre}</p>
                  {o.detalle && <p className="truncate text-xs text-ink-500">{o.detalle}</p>}
                </div>
                <button
                  type="button"
                  aria-label={`Quitar ${o.nombre}`}
                  onClick={() => set((x) => ({ ...x, organismos: x.organismos.filter((id) => id !== o.id) }))}
                  className="shrink-0 rounded-md p-1.5 text-ink-400 transition hover:bg-ink-50 hover:text-danger-600"
                >
                  <IconTrash width={16} height={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

// --- Beneficio de puntos (solo título por ahora) ---

function BeneficioPuntos() {
  return (
    <Panel titulo="Beneficio de puntos" descripcion="">
      <></>
    </Panel>
  );
}

// --- Registro de secciones ---

export const SECCIONES_PLAN: {
  id: string;
  label: string;
  vivo: boolean;
  Componente: (props: SeccionPlanProps) => React.ReactNode;
}[] = [
  { id: "datos", label: "Datos generales", vivo: true, Componente: DatosGenerales },
  { id: "amortizacion", label: "Amortización", vivo: true, Componente: Amortizacion },
  { id: "iva", label: "IVA / Sellos", vivo: true, Componente: IvaSellos },
  { id: "gastos", label: "Gastos de otorgamiento", vivo: true, Componente: Gastos },
  { id: "cargos", label: "Cargos periódicos", vivo: true, Componente: Cargos },
  { id: "bcra", label: "Condiciones BCRA", vivo: true, Componente: CondicionesBcra },
  { id: "laboral", label: "Condición laboral", vivo: true, Componente: CondicionLaboral },
  { id: "perfil", label: "Perfil de riesgo", vivo: true, Componente: PerfilRiesgo },
  { id: "capital", label: "Capital máximo", vivo: true, Componente: CapitalMaximo },
  { id: "cuota", label: "Cuota máxima", vivo: true, Componente: CuotaMaxima },
  { id: "limitantes", label: "Limitantes", vivo: true, Componente: Limitantes },
  { id: "bonificaciones", label: "Bonificaciones", vivo: false, Componente: Bonificaciones },
  { id: "topes", label: "Topes de autorización", vivo: false, Componente: Topes },
  { id: "puntos", label: "Beneficio de puntos", vivo: false, Componente: BeneficioPuntos },
  { id: "grilla", label: "Grilla de tasas", vivo: true, Componente: GrillaTasas },
  { id: "vinculaciones", label: "Vinculaciones", vivo: true, Componente: Vinculaciones },
];

// Sección donde se muestra cada error de validación.
export const SECCION_DE_ERROR_PLAN: Record<string, string> = {
  nombre: "datos",
  vigenciaDesde: "datos",
  vigenciaHasta: "datos",
  prioridad: "vinculaciones",
  ivaPct: "iva",
  sellosPct: "iva",
  gastoOtorgamiento: "gastos",
  gastoTratamiento: "gastos",
  cargos: "cargos",
  situacionesBcra: "bcra",
  condicionesLaborales: "laboral",
  perfilesInternos: "perfil",
  rangosSueldoNeto: "capital",
  rangosCuota: "cuota",
  endeudamientoMaxPct: "cuota",
  limitantes: "limitantes",
  bonificaciones: "bonificaciones",
  topes: "topes",
  grilla: "grilla",
};
