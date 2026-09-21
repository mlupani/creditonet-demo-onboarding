"use client";

import type { AsignacionMotor, DocumentoConfig } from "@/lib/config";
import { CONDICIONES_LABORALES, MOTORES } from "@/lib/motores";
import { TIPOS_DOCUMENTO } from "@/lib/parametros";
import {
  CANALES_NOTIFICACION,
  ESTADOS_NOTIFICACION_ONBOARDING,
  MAX_TRAMOS_PUNITORIOS,
  type GestionPrestamos,
  type NotificacionesProducto,
  type RecalculoNeto,
  type SeleccionLista,
  type TramoPunitorio,
} from "@/lib/productos";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { MultiSelectField } from "@/components/ui/MultiSelectField";
import { SelectField } from "@/components/ui/SelectField";
import { CampoNumero } from "./campos";
import { IconPlus, IconTrash } from "@/components/icons";

// Editores compartidos por el ABM de Productos y el de Organismos (que hace excepciones sobre
// los mismos valores).

// --- Punitorios: hasta 5 tramos ---

export function EditorTramos({
  idBase,
  tramos,
  onChange,
}: {
  idBase: string;
  tramos: TramoPunitorio[];
  onChange: (tramos: TramoPunitorio[]) => void;
}) {
  const cambiar = (i: number, patch: Partial<TramoPunitorio>) =>
    onChange(tramos.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <div className="space-y-3">
      {tramos.map((t, i) => (
        <div key={i} className="rounded-xl border border-ink-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Tramo {i + 1}</p>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Quitar el tramo ${i + 1}`}
              disabled={tramos.length <= 1}
              onClick={() => onChange(tramos.filter((_, j) => j !== i))}
            >
              <IconTrash width={14} height={14} />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoNumero
              id={`${idBase}-desde-${i}`}
              label="Desde el día de atraso"
              value={t.desdeDia}
              min={1}
              onChange={(v) => cambiar(i, { desdeDia: v })}
            />
            <CampoNumero
              id={`${idBase}-pct-${i}`}
              label="% punitorio sobre la tasa"
              sufijo="%"
              step={0.5}
              value={t.punitorioPct}
              onChange={(v) => cambiar(i, { punitorioPct: v })}
            />
            <CampoNumero
              id={`${idBase}-gracia-${i}`}
              label="Días de gracia"
              sufijo="días"
              value={t.diasGracia}
              onChange={(v) => cambiar(i, { diasGracia: v })}
            />
            <MoneyInput
              id={`${idBase}-tope-${i}`}
              label="Monto tope sin IVA"
              value={t.montoTopeSinIva}
              onChange={(v) => cambiar(i, { montoTopeSinIva: v })}
            />
          </div>
        </div>
      ))}
      <Button
        variant="subtle"
        size="sm"
        disabled={tramos.length >= MAX_TRAMOS_PUNITORIOS}
        onClick={() => {
          const ultimo = tramos[tramos.length - 1];
          onChange([
            ...tramos,
            {
              desdeDia: (ultimo?.desdeDia ?? 0) + 30,
              punitorioPct: ultimo?.punitorioPct ?? 50,
              diasGracia: 0,
              montoTopeSinIva: ultimo?.montoTopeSinIva ?? 0,
            },
          ]);
        }}
      >
        <IconPlus width={14} height={14} />
        Agregar tramo ({tramos.length} de {MAX_TRAMOS_PUNITORIOS})
      </Button>
    </div>
  );
}

// --- Notificaciones: estados del onboarding + crédito activo ---

export function EditorNotificaciones({
  idBase,
  valor,
  onChange,
}: {
  idBase: string;
  valor: NotificacionesProducto;
  onChange: (valor: NotificacionesProducto) => void;
}) {
  const ca = valor.creditoActivo;
  const setCa = (patch: Partial<typeof ca>) =>
    onChange({ ...valor, creditoActivo: { ...ca, ...patch } });
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Onboarding · hasta 5 estados
        </p>
        {ESTADOS_NOTIFICACION_ONBOARDING.map((e) => (
          <Checkbox
            key={e.id}
            checked={valor.onboarding[e.id]}
            onChange={(v) => onChange({ ...valor, onboarding: { ...valor.onboarding, [e.id]: v } })}
            label={`Avisar al pasar a ${e.label}`}
          />
        ))}
      </div>
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Crédito activo
        </p>
        <Checkbox
          checked={ca.vencimiento}
          onChange={(v) => setCa({ vencimiento: v })}
          label="Vencimiento de cuota"
        />
        {ca.vencimiento && (
          <CampoNumero
            id={`${idBase}-dias-antes`}
            label="Avisar con anticipación de"
            sufijo="días"
            value={ca.diasAntesVencimiento}
            onChange={(v) => setCa({ diasAntesVencimiento: v })}
            className="sm:max-w-xs"
          />
        )}
        <Checkbox checked={ca.pago} onChange={(v) => setCa({ pago: v })} label="Pago recibido" />
        <Checkbox checked={ca.mora} onChange={(v) => setCa({ mora: v })} label="Mora" />
        <Checkbox
          checked={ca.cancelacion}
          onChange={(v) => setCa({ cancelacion: v })}
          label="Cancelación del crédito"
        />
      </div>
      <MultiSelectField
        id={`${idBase}-canales`}
        label="Medios de envío"
        values={valor.canales}
        onChange={(v) => onChange({ ...valor, canales: v })}
        options={CANALES_NOTIFICACION}
      />
    </div>
  );
}

// --- Documentos del legajo ---

export function EditorDocumentos({
  docs,
  onChange,
}: {
  docs: DocumentoConfig[];
  onChange: (docs: DocumentoConfig[]) => void;
}) {
  // Se conserva el orden del catálogo de Parámetros.
  const guardar = (lista: DocumentoConfig[]) =>
    onChange(
      [...lista].sort(
        (a, b) =>
          TIPOS_DOCUMENTO.findIndex((t) => t.id === a.tipoId) -
          TIPOS_DOCUMENTO.findIndex((t) => t.id === b.tipoId)
      )
    );
  return (
    <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200 bg-white">
      {TIPOS_DOCUMENTO.map((t) => {
        const d = docs.find((x) => x.tipoId === t.id);
        return (
          <li key={t.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <div className="min-w-0 flex-1 basis-56">
              <Checkbox
                checked={!!d}
                onChange={(v) =>
                  guardar(
                    v
                      ? [...docs, { tipoId: t.id, obligatorio: false, multiple: false }]
                      : docs.filter((x) => x.tipoId !== t.id)
                  )
                }
                label={t.nombre}
                description={t.categoria}
              />
            </div>
            {d && (
              <div className="flex gap-5">
                <Checkbox
                  checked={d.obligatorio}
                  onChange={(v) =>
                    guardar(docs.map((x) => (x.tipoId === t.id ? { ...x, obligatorio: v } : x)))
                  }
                  label="Obligatorio"
                />
                <Checkbox
                  checked={d.multiple}
                  onChange={(v) =>
                    guardar(docs.map((x) => (x.tipoId === t.id ? { ...x, multiple: v } : x)))
                  }
                  label="Varias imágenes"
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// --- Habilitar todos o seleccionar determinados ---

export function EditorSeleccion({
  opciones,
  valor,
  onChange,
}: {
  opciones: { value: string; label: string; detalle?: string }[];
  valor: SeleccionLista;
  onChange: (valor: SeleccionLista) => void;
}) {
  const todosIds = opciones.map((o) => o.value);
  return (
    <div className="space-y-3">
      <div role="radiogroup" className="inline-flex rounded-lg border border-ink-300 bg-white p-0.5">
        {[
          { todos: true, label: "Todos" },
          { todos: false, label: "Seleccionar determinados" },
        ].map((op) => (
          <button
            key={op.label}
            type="button"
            role="radio"
            aria-checked={valor.todos === op.todos}
            onClick={() => onChange(op.todos ? { todos: true, ids: todosIds } : { ...valor, todos: false })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              valor.todos === op.todos ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-100"
            }`}
          >
            {op.label}
          </button>
        ))}
      </div>
      {valor.todos ? (
        <p className="text-xs text-ink-500">Quedan habilitados todos ({opciones.length}).</p>
      ) : (
        <div className="space-y-2">
          {opciones.map((o) => (
            <Checkbox
              key={o.value}
              checked={valor.ids.includes(o.value)}
              onChange={(v) =>
                onChange({
                  todos: false,
                  ids: v
                    ? [...valor.ids.filter((x) => x !== o.value), o.value]
                    : valor.ids.filter((x) => x !== o.value),
                })
              }
              label={o.label}
              description={o.detalle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Gestión de préstamos ---

export function EditorGestion({
  idBase,
  valor,
  onChange,
  errores,
}: {
  idBase: string;
  valor: GestionPrestamos;
  onChange: (valor: GestionPrestamos) => void;
  errores?: { razonSocial?: string; cuit?: string };
}) {
  return (
    <div className="space-y-4">
      <Checkbox
        checked={valor.activa}
        onChange={(v) => onChange({ ...valor, activa: v })}
        label="Gestión de préstamos activa"
        description="Si está activa, se informa quién gestiona la cartera."
      />
      {valor.activa && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id={`${idBase}-razon`}
            label="Razón social"
            required
            value={valor.razonSocial}
            onChange={(v) => onChange({ ...valor, razonSocial: v })}
            error={errores?.razonSocial}
          />
          <FormField
            id={`${idBase}-cuit`}
            label="CUIT"
            required
            value={valor.cuit}
            onChange={(v) => onChange({ ...valor, cuit: v })}
            placeholder="30-12345678-9"
            error={errores?.cuit}
          />
          <FormField
            id={`${idBase}-domicilio`}
            label="Domicilio"
            value={valor.domicilio}
            onChange={(v) => onChange({ ...valor, domicilio: v })}
            className="sm:col-span-2"
          />
        </div>
      )}
    </div>
  );
}

// --- Datos financieros: recálculo del sueldo neto ---

const CONCEPTOS_NETO: { clave: keyof RecalculoNeto; label: string; detalle: string }[] = [
  { clave: "disponible", label: "Disponible", detalle: "Saldo disponible del cliente." },
  {
    clave: "extraccionesTransferencias",
    label: "Extracciones / transferencias",
    detalle: "Movimientos que reducen el ingreso neto efectivo.",
  },
  {
    clave: "cuotasBuroExterno",
    label: "Cuotas comprometidas de buró externo",
    detalle: "Cuotas de créditos con otras entidades.",
  },
  {
    clave: "noRemunerativosHorasExtra",
    label: "Conceptos no remunerativos / horas extra",
    detalle: "Ingresos variables que se incluyen o no en el neto.",
  },
];

export function EditorRecalculoNeto({
  valor,
  onChange,
}: {
  valor: RecalculoNeto;
  onChange: (valor: RecalculoNeto) => void;
}) {
  return (
    <div className="space-y-3">
      {CONCEPTOS_NETO.map((c) => (
        <Checkbox
          key={c.clave}
          checked={valor[c.clave]}
          onChange={(v) => onChange({ ...valor, [c.clave]: v })}
          label={c.label}
          description={c.detalle}
        />
      ))}
    </div>
  );
}

// --- Motor de riesgo: asignación por tipo de cliente y condición laboral ---

const OPCIONES_MOTOR = MOTORES.map((m) => ({ value: m.id, label: m.nombre }));

export function EditorMotor({
  idBase,
  valor,
  onChange,
  placeholderGeneral = "Sin motor asignado",
}: {
  idBase: string;
  valor: AsignacionMotor;
  onChange: (valor: AsignacionMotor) => void;
  placeholderGeneral?: string;
}) {
  const asignarCondicion = (condicion: string, motorId: string) => {
    const { [condicion]: _quitada, ...resto } = valor.porCondicionLaboral;
    void _quitada;
    onChange({
      ...valor,
      porCondicionLaboral: motorId ? { ...resto, [condicion]: motorId } : resto,
    });
  };
  return (
    <div className="space-y-4">
      <SelectField
        id={`${idBase}-general`}
        label="Motor general"
        value={valor.motorId ?? ""}
        onChange={(v) => onChange({ ...valor, motorId: v || null })}
        placeholder={placeholderGeneral}
        options={OPCIONES_MOTOR}
        hint="Se usa cuando no aplica ninguna asignación específica."
      />
      <div className="space-y-3">
        <Checkbox
          checked={valor.distingueTipoCliente}
          onChange={(v) => onChange({ ...valor, distingueTipoCliente: v })}
          label="Distinguir cliente nuevo / existente"
          description="Cada tipo de cliente evalúa con su propio grupo de reglas."
        />
        {valor.distingueTipoCliente && (
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              id={`${idBase}-nuevo`}
              label="Cliente nuevo"
              value={valor.porTipoCliente.NUEVO ?? ""}
              onChange={(v) =>
                onChange({ ...valor, porTipoCliente: { ...valor.porTipoCliente, NUEVO: v || null } })
              }
              placeholder="Usa la condición laboral"
              options={OPCIONES_MOTOR}
            />
            <SelectField
              id={`${idBase}-existente`}
              label="Cliente existente"
              value={valor.porTipoCliente.EXISTENTE ?? ""}
              onChange={(v) =>
                onChange({
                  ...valor,
                  porTipoCliente: { ...valor.porTipoCliente, EXISTENTE: v || null },
                })
              }
              placeholder="Usa la condición laboral"
              options={OPCIONES_MOTOR}
            />
          </div>
        )}
      </div>
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Grupo de reglas por condición laboral
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {CONDICIONES_LABORALES.map((c, i) => (
            <SelectField
              key={c}
              id={`${idBase}-cond-${i}`}
              label={c}
              value={valor.porCondicionLaboral[c] ?? ""}
              onChange={(v) => asignarCondicion(c, v)}
              placeholder="Usa el motor general"
              options={OPCIONES_MOTOR}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
