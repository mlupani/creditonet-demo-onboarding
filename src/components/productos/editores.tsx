"use client";

import { useState } from "react";
import type {
  AsignacionMotor,
  BloqueTokenizacion,
  DocumentoConfig,
  TokenizacionConfig,
} from "@/lib/config";
import {
  TITULO_PANTALLA_CAMPOS,
  camposConfigurablesDe,
  conCampoObligatorio,
  esObligatorio,
} from "@/lib/campos-config";
import { CONDICIONES_LABORALES, useMotores } from "@/lib/motores";
import { PROVEEDORES_TOKENIZACION, TIPOS_DOCUMENTO } from "@/lib/parametros";
import type { PantallaPostOfertaId } from "@/lib/types";
import { PERFILES_INTERNOS, ROTULO_BCRA, ROTULO_PERFIL, SITUACIONES_BCRA } from "@/lib/planes";
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
import { TERMINOS } from "@/lib/terminologia";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { MultiSelectField } from "@/components/ui/MultiSelectField";
import { SelectField } from "@/components/ui/SelectField";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
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
  error,
}: {
  docs: DocumentoConfig[];
  onChange: (docs: DocumentoConfig[]) => void;
  error?: string;
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
  const cambiar = (tipoId: string, patch: Partial<DocumentoConfig>) =>
    guardar(docs.map((x) => (x.tipoId === tipoId ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
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
                        ? [...docs, { tipoId: t.id, obligatorio: false, minimo: 0, maximo: 1 }]
                        : docs.filter((x) => x.tipoId !== t.id)
                    )
                  }
                  label={t.nombre}
                  description={t.categoria}
                />
              </div>
              {d && (
                <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
                  <Checkbox
                    checked={d.obligatorio}
                    onChange={(v) =>
                      cambiar(t.id, {
                        obligatorio: v,
                        minimo: v ? Math.max(d.minimo, 1) : 0,
                        maximo: v ? Math.max(d.maximo, 1) : d.maximo,
                      })
                    }
                    label="Obligatorio"
                  />
                  <CampoNumero
                    id={`doc-${t.id}-min`}
                    label="Mínimo"
                    min={d.obligatorio ? 1 : 0}
                    value={d.minimo}
                    disabled={!d.obligatorio}
                    onChange={(v) => cambiar(t.id, { minimo: v })}
                    className="w-24"
                  />
                  <CampoNumero
                    id={`doc-${t.id}-max`}
                    label="Máximo"
                    min={1}
                    value={d.maximo}
                    onChange={(v) => cambiar(t.id, { maximo: v })}
                    className="w-24"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <ValidationMessage tipo="error">{error}</ValidationMessage>}
    </div>
  );
}

// --- Tokenización: un bloque proveedor / mínimo / máximo por proveedor ---

export function EditorTokenizacion({
  idBase,
  valor,
  onChange,
  error,
}: {
  idBase: string;
  valor: TokenizacionConfig;
  onChange: (valor: TokenizacionConfig) => void;
  error?: string;
}) {
  const bloques = valor.proveedores;
  const libres = PROVEEDORES_TOKENIZACION.filter((x) => !bloques.some((b) => b.proveedorId === x.id));
  const cambiar = (i: number, patch: Partial<BloqueTokenizacion>) =>
    onChange({ proveedores: bloques.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  return (
    <div className="space-y-3">
      {bloques.length === 0 && (
        <p className="text-xs text-ink-500">Sin proveedores: no se pueden tokenizar tarjetas.</p>
      )}
      {bloques.map((b, i) => (
        <div key={i} className="rounded-xl border border-ink-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-500">
              Proveedor {i + 1}
            </p>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Quitar el proveedor ${i + 1}`}
              onClick={() => onChange({ proveedores: bloques.filter((_, j) => j !== i) })}
            >
              <IconTrash width={14} height={14} />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField
              id={`${idBase}-prov-${i}`}
              label="Proveedor"
              value={b.proveedorId}
              onChange={(v) => cambiar(i, { proveedorId: v })}
              options={PROVEEDORES_TOKENIZACION.filter(
                (x) => x.id === b.proveedorId || libres.some((l) => l.id === x.id)
              ).map((x) => ({ value: x.id, label: x.nombre }))}
            />
            <CampoNumero
              id={`${idBase}-min-${i}`}
              label="Mínimo de tarjetas"
              value={b.minimo}
              onChange={(v) => cambiar(i, { minimo: v })}
            />
            <CampoNumero
              id={`${idBase}-max-${i}`}
              label="Máximo de tarjetas"
              min={1}
              value={b.maximo}
              onChange={(v) => cambiar(i, { maximo: v })}
            />
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        disabled={libres.length === 0}
        onClick={() =>
          onChange({
            proveedores: [...bloques, { proveedorId: libres[0].id, minimo: 0, maximo: 1 }],
          })
        }
      >
        <IconPlus width={14} height={14} />
        Agregar proveedor
      </Button>
      {error && <ValidationMessage tipo="error">{error}</ValidationMessage>}
    </div>
  );
}

// --- Obligatoriedad por campo, en todas las pantallas del onboarding ---

export function EditorCamposObligatorios({
  obligatorios,
  onChange,
  habilitadas,
}: {
  obligatorios: Partial<Record<string, boolean>>;
  onChange: (obligatorios: Partial<Record<string, boolean>>) => void;
  // Pantallas habilitadas del producto: las deshabilitadas se indican pero siguen editables.
  habilitadas: PantallaPostOfertaId[];
}) {
  return (
    <div className="space-y-3">
      {(Object.keys(TITULO_PANTALLA_CAMPOS) as PantallaPostOfertaId[]).map((pantalla) => {
        const campos = camposConfigurablesDe(pantalla);
        const titulo = TITULO_PANTALLA_CAMPOS[pantalla];
        const estado = habilitadas.includes(pantalla) ? "" : " · deshabilitada";
        return (
          <details key={pantalla} className="rounded-xl border border-ink-200 bg-white">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-ink-800">
              {titulo} · {campos.length} campo{campos.length === 1 ? "" : "s"}
              {estado}
            </summary>
            <div className="border-t border-ink-100 px-4 py-4">
              {pantalla === "legajo" && (
                <p className="text-xs text-ink-500">
                  Los ítems del legajo se configuran en el bloque Legajo de esta sección: cada documento define si
                  es obligatorio y su cantidad mínima y máxima.
                </p>
              )}
              {pantalla === "impresion" && (
                <p className="text-xs text-ink-500">Esta pantalla no tiene campos para completar.</p>
              )}
              {campos.length > 0 && (
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {campos.map((c) => (
                    <Checkbox
                      key={c.id}
                      checked={esObligatorio(c, obligatorios)}
                      disabled={c.fijo}
                      onChange={(v) => onChange(conCampoObligatorio(obligatorios, c, v))}
                      label={c.label}
                      description={c.fijo ? "Lo exige el proveedor de tokenización." : undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          </details>
        );
      })}
    </div>
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
  {
    clave: "disponible",
    label: TERMINOS.disponible,
    detalle: "Dinero que el cliente tiene libre para extraer de su cuenta.",
  },
  {
    clave: "saldoDiaAcreditacion",
    label: TERMINOS.saldoDiaAcreditacion,
    detalle: "Saldo de la cuenta el día de la acreditación del sueldo.",
  },
  {
    clave: "extraccionesTransferencias",
    label: TERMINOS.transferenciasExtracciones,
    detalle: "Movimientos que reducen el ingreso neto efectivo.",
  },
  {
    clave: "cuotasBuroExterno",
    label: "Cuotas comprometidas de buró externo",
    detalle: "Cuotas de créditos con otras entidades.",
  },
  {
    clave: "noRemunerativosHorasExtra",
    label: `${TERMINOS.conceptosNoRemunerativos} / horas extra`,
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

// --- Motor de riesgo: asignación por tipo de cliente, condición laboral, situación BCRA y buró interno ---

export function EditorMotor({
  idBase,
  valor,
  onChange,
  placeholderGeneral = "Sin motor asignado",
  error,
  mostrarError = true,
}: {
  idBase: string;
  valor: AsignacionMotor;
  onChange: (valor: AsignacionMotor) => void;
  placeholderGeneral?: string;
  // Asignación incompleta (ver `errorAsignacionMotor`): se muestra junto a "Distinguir".
  error?: string;
  mostrarError?: boolean;
}) {
  // Los grupos de reglas salen del ABM del Motor de riesgo: los no activos se rotulan.
  const OPCIONES_MOTOR = useMotores().map((m) => ({
    value: m.id,
    label: m.estado === "ACTIVO" ? m.nombre : `${m.nombre} (${m.estado.toLowerCase()})`,
  }));
  // Condición laboral → grupo de reglas: se elige la condición en un desplegable y después su
  // grupo. La fila nueva se arma en `nueva` y recién entra a la asignación cuando está completa.
  const [nueva, setNueva] = useState<{ condicion: string; motorId: string } | null>(null);
  const asignadas = Object.entries(valor.porCondicionLaboral);
  const libres = (actual?: string) =>
    CONDICIONES_LABORALES.filter((c) => c === actual || !(c in valor.porCondicionLaboral)).map((c) => ({
      value: c,
      label: c,
    }));
  const cambiarCondicion = (anterior: string, condicion: string) =>
    onChange({
      ...valor,
      porCondicionLaboral: Object.fromEntries(
        asignadas.map(([c, id]) => (c === anterior ? [condicion, id] : [c, id]))
      ),
    });
  const asignarCondicion = (condicion: string, motorId: string) =>
    onChange({ ...valor, porCondicionLaboral: { ...valor.porCondicionLaboral, [condicion]: motorId } });
  const quitarCondicion = (condicion: string) => {
    const { [condicion]: _quitada, ...resto } = valor.porCondicionLaboral;
    void _quitada;
    onChange({ ...valor, porCondicionLaboral: resto });
  };
  const completarNueva = (cambio: Partial<{ condicion: string; motorId: string }>) => {
    const fila = { ...nueva!, ...cambio };
    if (fila.condicion && fila.motorId) {
      asignarCondicion(fila.condicion, fila.motorId);
      setNueva(null);
    } else setNueva(fila);
  };
  const asignarSituacion = (
    campo: "porSituacionBcra" | "porSituacionInterna",
    situacion: number,
    motorId: string
  ) => {
    const { [situacion]: _quitada, ...resto } = valor[campo] ?? {};
    void _quitada;
    onChange({ ...valor, [campo]: motorId ? { ...resto, [situacion]: motorId } : resto });
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
              placeholder="Elegí el grupo de reglas…"
              options={OPCIONES_MOTOR}
              error={mostrarError && error && !valor.porTipoCliente.NUEVO ? "Obligatorio" : undefined}
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
              placeholder="Elegí el grupo de reglas…"
              options={OPCIONES_MOTOR}
              error={mostrarError && error && !valor.porTipoCliente.EXISTENTE ? "Obligatorio" : undefined}
            />
          </div>
        )}
        {mostrarError && error && <ValidationMessage tipo="error">{error}</ValidationMessage>}
      </div>
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Grupo de reglas por condición laboral
        </p>
        {asignadas.length === 0 && !nueva && (
          <p className="text-sm text-ink-500">Sin asignaciones: todas las condiciones usan el motor general.</p>
        )}
        {asignadas.map(([c, motorId], i) => (
          <div key={c} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <SelectField
              id={`${idBase}-cond-${i}`}
              label="Condición laboral"
              value={c}
              onChange={(v) => cambiarCondicion(c, v)}
              options={libres(c)}
            />
            <SelectField
              id={`${idBase}-cond-motor-${i}`}
              label="Grupo de reglas"
              value={motorId}
              onChange={(v) => asignarCondicion(c, v)}
              options={OPCIONES_MOTOR}
            />
            <Button size="sm" variant="ghost" onClick={() => quitarCondicion(c)} aria-label={`Quitar ${c}`}>
              <IconTrash width={14} height={14} />
              Quitar
            </Button>
          </div>
        ))}
        {nueva && (
          <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <SelectField
              id={`${idBase}-cond-nueva`}
              label="Condición laboral"
              value={nueva.condicion}
              onChange={(v) => completarNueva({ condicion: v })}
              placeholder="Elegí la condición…"
              options={libres()}
            />
            <SelectField
              id={`${idBase}-cond-nueva-motor`}
              label="Grupo de reglas"
              value={nueva.motorId}
              onChange={(v) => completarNueva({ motorId: v })}
              placeholder="Elegí el grupo…"
              options={OPCIONES_MOTOR}
            />
            <Button size="sm" variant="ghost" onClick={() => setNueva(null)}>
              Cancelar
            </Button>
          </div>
        )}
        {!nueva && libres().length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setNueva({ condicion: "", motorId: "" })}>
            <IconPlus width={14} height={14} />
            Agregar condición laboral
          </Button>
        )}
      </div>
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Grupo de reglas por situación BCRA
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SITUACIONES_BCRA.map((n) => (
            <SelectField
              key={n}
              id={`${idBase}-bcra-${n}`}
              label={ROTULO_BCRA[n]}
              value={valor.porSituacionBcra?.[n] ?? ""}
              onChange={(v) => asignarSituacion("porSituacionBcra", n, v)}
              placeholder="Usa el motor general"
              options={OPCIONES_MOTOR}
            />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Grupo de reglas por situación en buró interno
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {PERFILES_INTERNOS.map((n) => (
            <SelectField
              key={n}
              id={`${idBase}-interna-${n}`}
              label={ROTULO_PERFIL[n]}
              value={valor.porSituacionInterna?.[n] ?? ""}
              onChange={(v) => asignarSituacion("porSituacionInterna", n, v)}
              placeholder="Usa el motor general"
              options={OPCIONES_MOTOR}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
