"use client";

import {
  ORGANISMOS,
  SISTEMAS_AMORTIZACION,
  type FilaGrilla,
  type PlanCuotas,
  type SistemaAmortizacion,
} from "@/lib/config";
import { calcularCuota } from "@/lib/credit";
import { CONDICIONES_LABORALES } from "@/lib/motores";
import { PERFILES_INTERNOS, SITUACIONES_BCRA, type PlanAbm } from "@/lib/planes";
import { formatARS } from "@/lib/format";
import type { Plazo } from "@/lib/types";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { SelectField } from "@/components/ui/SelectField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
import { CampoNumero, Panel, Subtitulo } from "@/components/productos/campos";
import { fechaAIso, isoAFecha } from "@/lib/format";
import { ESTADO_PRODUCTO_META } from "@/components/productos/ListaProductos";
import { IconPlus, IconTrash } from "@/components/icons";

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

const ROTULO_BCRA: Record<number, string> = {
  1: "Situación 1 · Normal",
  2: "Situación 2 · Riesgo bajo / seguimiento especial",
  3: "Situación 3 · Con problemas",
  4: "Situación 4 · Alto riesgo de insolvencia",
  5: "Situación 5 · Irrecuperable",
};

const ROTULO_PERFIL: Record<number, string> = {
  1: "Perfil 1 · Al día, sin atrasos",
  2: "Perfil 2 · Atrasos menores",
  3: "Perfil 3 · Con mora",
  4: "Perfil 4 · Mora prolongada",
  5: "Perfil 5 · Incobrable",
};

const PLAZOS: Plazo[] = [12, 18, 24, 36, 48, 60, 72, 84, 96, 120];

// --- 1. Datos generales ---

function DatosGenerales({ p, set, errores, ver }: SeccionPlanProps) {
  const { cf } = useEditores(set);
  const meta = ESTADO_PRODUCTO_META[p.config.estado];
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
        hint="Francés: cuota fija · Americano: sólo interés y el capital al final · Tasa directa: interés sobre el capital original."
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
      nota="Se informa en la tabla de cuotas de la oferta."
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
      <Checkbox
        checked={g.seCapitaliza}
        onChange={(v) => setG({ seCapitaliza: v })}
        label="Se capitaliza"
        description="El gasto se suma al capital financiado en lugar de descontarse del desembolso."
      />
    </Panel>
  );
}

// --- 5. Cargos periódicos ---

function Cargos({ p, set, errores, ver }: SeccionPlanProps) {
  const { cf } = useEditores(set);
  return (
    <Panel
      titulo="Cargos periódicos"
      descripcion="Cargo administrativo o de cobranza que se suma a cada cuota."
      vivo
      nota="Si es mayor a cero, se informa en la tabla de cuotas de la oferta."
    >
      <CampoNumero
        id="pl-cargo-adm"
        label="Cargo administrativo / cobranza"
        sufijo="% s/cuota"
        step={0.1}
        value={p.config.cargoAdministrativoPct}
        onChange={(v) => cf({ cargoAdministrativoPct: v })}
        error={ver ? errores.cargoAdministrativoPct : undefined}
        className="sm:max-w-xs"
      />
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
  return (
    <Panel
      titulo="Capital máximo"
      descripcion="Tope de capital que otorga el plan."
      vivo
      nota="Es uno de los límites de capital de la oferta: gana el más restrictivo entre el universal, sueldos brutos, producto, plan y cuota máxima."
    >
      <Grilla>
        <MoneyInput
          id="pl-monto-max"
          label="Capital máximo"
          required
          value={p.config.montoMaximo}
          onChange={(v) => cf({ montoMaximo: v })}
          error={ver ? errores.montoMaximo : undefined}
        />
        <MoneyInput
          id="pl-monto-renov"
          label="Capital máximo con renovación"
          required
          value={p.config.montoMaximoRenovacion}
          onChange={(v) => cf({ montoMaximoRenovacion: v })}
          error={ver ? errores.montoMaximoRenovacion : undefined}
          hint="Tope ampliado cuando la operación renueva un crédito propio."
        />
      </Grilla>
      <CampoNumero
        id="pl-renov-min"
        label="Cuotas pagas mínimas para renovar"
        sufijo="%"
        value={p.config.renovacionMinCuotasPct}
        onChange={(v) => cf({ renovacionMinCuotasPct: v })}
        hint="Un crédito propio sólo se puede renovar si ya pagó al menos este porcentaje de las cuotas."
        className="sm:max-w-xs"
      />
    </Panel>
  );
}

// --- 10. Cuota máxima ---

function CuotaMaxima({ p, set, errores, ver }: SeccionPlanProps) {
  const { cf } = useEditores(set);
  return (
    <Panel
      titulo="Cuota máxima"
      descripcion="Reglas que acotan la cuota: compiten las tres y gana la menor."
      vivo
      nota="La cuota máxima resultante define cuánto capital soporta el cliente en el plazo elegido."
    >
      <Grilla cols={3}>
        <CampoNumero
          id="pl-rci"
          label="Relación cuota-ingreso (RCI)"
          sufijo="%"
          value={p.config.rciMaxPct}
          onChange={(v) => cf({ rciMaxPct: v })}
          error={ver ? errores.rciMaxPct : undefined}
          hint="Sobre el ingreso neto."
        />
        <CampoNumero
          id="pl-endeudamiento"
          label="Endeudamiento máximo"
          sufijo="%"
          value={p.config.endeudamientoMaxPct}
          onChange={(v) => cf({ endeudamientoMaxPct: v })}
          error={ver ? errores.endeudamientoMaxPct : undefined}
          hint="Sobre el ingreso bruto."
        />
        <MoneyInput
          id="pl-smvm"
          label="Mínimo de bolsillo"
          value={p.config.smvmBolsillo}
          onChange={(v) => cf({ smvmBolsillo: v })}
          error={ver ? errores.smvmBolsillo : undefined}
          hint="Lo que le tiene que quedar al cliente."
        />
      </Grilla>
    </Panel>
  );
}

// --- 11. Limitantes ---

function Limitantes({ p, set, errores, ver }: SeccionPlanProps) {
  const { cf } = useEditores(set);
  const l = p.config.limitantes;
  const setL = (patch: Partial<typeof l>) => cf({ limitantes: { ...l, ...patch } });
  const setCondicion = (condicion: string, pct: number) => {
    const { [condicion]: _q, ...resto } = l.condicionLaboralPct;
    void _q;
    setL({ condicionLaboralPct: pct > 0 ? { ...resto, [condicion]: pct } : resto });
  };
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
          id="pl-lim-nuevo"
          label="Cliente nuevo"
          sufijo="%"
          value={l.clienteNuevoPct}
          onChange={(v) => setL({ clienteNuevoPct: v })}
        />
        <CampoNumero
          id="pl-lim-existente"
          label="Cliente existente"
          sufijo="%"
          value={l.clienteExistentePct}
          onChange={(v) => setL({ clienteExistentePct: v })}
        />
        <CampoNumero
          id="pl-lim-bcra"
          label="Situación BCRA distinta de 1"
          sufijo="%"
          value={l.situacionBcraDistintaDeUnoPct}
          onChange={(v) => setL({ situacionBcraDistintaDeUnoPct: v })}
        />
      </Grilla>
      <div className="space-y-3">
        <Subtitulo>Recorte por condición laboral</Subtitulo>
        <Grilla cols={3}>
          {CONDICIONES_LABORALES.map((c, i) => (
            <CampoNumero
              key={c}
              id={`pl-lim-cond-${i}`}
              label={c}
              sufijo="%"
              value={l.condicionLaboralPct[c] ?? 0}
              onChange={(v) => setCondicion(c, v)}
            />
          ))}
        </Grilla>
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
      descripcion="Descuentos sobre los cargos del plan bajo ciertas condiciones."
      nota="Valores de ejemplo: se guardan pero no cambian el cálculo de la oferta."
    >
      {ver && errores.bonificaciones && (
        <ValidationMessage tipo="error">{errores.bonificaciones}</ValidationMessage>
      )}
      {lista.length === 0 && <p className="text-sm text-ink-500">El plan no tiene bonificaciones.</p>}
      {lista.map((b) => (
        <div key={b.id} className="rounded-xl border border-ink-200 bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem_1fr_auto] sm:items-end">
            <FormField
              id={`${b.id}-concepto`}
              label="Concepto"
              value={b.concepto}
              onChange={(v) => cambiar(b.id, { concepto: v })}
            />
            <CampoNumero
              id={`${b.id}-pct`}
              label="Bonifica"
              sufijo="%"
              value={b.pct}
              onChange={(v) => cambiar(b.id, { pct: v })}
            />
            <FormField
              id={`${b.id}-condicion`}
              label="Condición"
              value={b.condicion}
              onChange={(v) => cambiar(b.id, { condicion: v })}
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label="Quitar la bonificación"
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
              { id: `bonif-${Date.now()}`, concepto: "", pct: 0, condicion: "" },
            ],
          })
        }
      >
        <IconPlus width={14} height={14} />
        Agregar bonificación
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
  const libres = PLAZOS.filter((pl) => !grilla.some((f) => f.plazo === pl));
  return (
    <Panel
      titulo="Grilla de tasas"
      descripcion="TNA de cada plazo. Es la grilla con la que se arma la oferta."
      vivo
      nota={`La TNA de cada plazo sale de esta grilla y la cuota se calcula con el sistema del plan. La columna de cuota muestra el resultado para ${formatARS(1_000_000)}.`}
    >
      {ver && errores.grilla && <ValidationMessage tipo="error">{errores.grilla}</ValidationMessage>}
      <div className="overflow-x-auto rounded-xl border border-ink-200">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              <th className="px-3 py-2.5">Plazo</th>
              <th className="px-3 py-2.5">TNA</th>
              <th className="px-3 py-2.5">1ª cuota</th>
              <th className="px-3 py-2.5">Cuota de ejemplo</th>
              <th className="px-3 py-2.5">Recomendada</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {grilla.map((f, i) => (
              <tr key={i}>
                <td className="px-3 py-2">
                  <select
                    aria-label={`Plazo de la fila ${i + 1}`}
                    value={f.plazo}
                    onChange={(e) => cambiar(i, { plazo: Number(e.target.value) as Plazo })}
                    className="h-9 rounded-lg border border-ink-300 bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  >
                    {[f.plazo, ...libres].sort((a, b) => a - b).map((pl) => (
                      <option key={pl} value={pl}>
                        {pl} cuotas
                      </option>
                    ))}
                  </select>
                </td>
                <td className="w-32 px-3 py-2">
                  <input
                    type="number"
                    aria-label={`TNA de la fila ${i + 1}`}
                    min={0}
                    step={0.5}
                    value={f.tna}
                    onChange={(e) => cambiar(i, { tna: Number(e.target.value) })}
                    className="h-9 w-full rounded-lg border border-ink-300 bg-white px-2 text-sm tabular-nums outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </td>
                <td className="w-36 px-3 py-2">
                  <input
                    type="date"
                    aria-label={`Primera cuota de la fila ${i + 1}`}
                    value={fechaAIso(f.primeraCuota)}
                    onChange={(e) => cambiar(i, { primeraCuota: isoAFecha(e.target.value) })}
                    className="h-9 w-full rounded-lg border border-ink-300 bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </td>
                <td className="px-3 py-2 tabular-nums text-ink-700">
                  {formatARS(calcularCuota(1_000_000, f.plazo, f.tna, p.config.sistema))}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="radio"
                    name="grilla-recomendada"
                    aria-label={`Marcar ${f.plazo} cuotas como recomendada`}
                    checked={f.recomendada}
                    onChange={() => recomendar(i)}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Quitar ${f.plazo} cuotas`}
                    disabled={grilla.length <= 1}
                    onClick={() => cf({ grilla: grilla.filter((_, j) => j !== i) })}
                  >
                    <IconTrash width={15} height={15} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        variant="subtle"
        size="sm"
        disabled={libres.length === 0}
        onClick={() => {
          const ultima = grilla[grilla.length - 1];
          cf({
            grilla: [
              ...grilla,
              {
                plazo: libres[0],
                tna: (ultima?.tna ?? 60) + 3,
                recomendada: false,
                primeraCuota: ultima?.primeraCuota ?? "10/10/2026",
              },
            ].sort((a, b) => a.plazo - b.plazo),
          });
        }}
      >
        <IconPlus width={14} height={14} />
        Agregar plazo
      </Button>
    </Panel>
  );
}

// --- 15. Vinculaciones ---

function Vinculaciones({ p, set, errores, ver }: SeccionPlanProps) {
  const { cf } = useEditores(set);
  return (
    <Panel
      titulo="Vinculaciones"
      descripcion="Organismos a los que se asigna el plan y su prioridad."
      vivo
      nota="Un organismo puede tener varios planes. Con más de un plan que habilite al cliente, se usa el de menor número de prioridad."
    >
      <CampoNumero
        id="pl-prioridad"
        label="Prioridad"
        min={1}
        value={p.config.prioridad}
        onChange={(v) => cf({ prioridad: v })}
        error={ver ? errores.prioridad : undefined}
        hint="1 se evalúa primero."
        className="sm:max-w-xs"
      />
      <div className="space-y-3">
        <Subtitulo>Organismos</Subtitulo>
        {p.organismos.length === 0 && (
          <Banner tone="warning" title="El plan no está asignado a ningún organismo">
            Mientras no lo asignes a uno, no se usa en ninguna solicitud.
          </Banner>
        )}
        {ORGANISMOS.map((o) => (
          <Checkbox
            key={o.id}
            checked={p.organismos.includes(o.id)}
            onChange={(v) => set((x) => ({ ...x, organismos: alternar(x.organismos, o.id, v) }))}
            label={o.nombre}
            description={o.detalle}
          />
        ))}
      </div>
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
  cargoAdministrativoPct: "cargos",
  situacionesBcra: "bcra",
  condicionesLaborales: "laboral",
  perfilesInternos: "perfil",
  montoMaximo: "capital",
  montoMaximoRenovacion: "capital",
  rciMaxPct: "cuota",
  endeudamientoMaxPct: "cuota",
  smvmBolsillo: "cuota",
  limitantes: "limitantes",
  bonificaciones: "bonificaciones",
  topes: "topes",
  grilla: "grilla",
};
