"use client";

import { useState } from "react";
import type {
  AsignacionMotor,
  BloqueTokenizacion,
  DocumentoConfig,
  TokenizacionConfig,
  TipoTarjeta,
} from "@/lib/config";
import { TIPOS_TARJETA } from "@/lib/config";
import {
  TITULO_PANTALLA_CAMPOS,
  camposConfigurablesDe,
  conCampoObligatorio,
  esObligatorio,
} from "@/lib/campos-config";
import { CONDICIONES_LABORALES, useMotores } from "@/lib/motores";
import {
  PROVEEDORES_TOKENIZACION,
  PROVINCIAS,
  TIPOS_DOCUMENTO,
  localidadesDe,
  tipoDeDocumento,
} from "@/lib/parametros";
import { aplicarCambioDomicilio, sanitizarCampoDomicilio } from "@/lib/campos-post-oferta";
import type { Domicilio, PantallaPostOfertaId } from "@/lib/types";
import { PERFILES_INTERNOS, ROTULO_BCRA, ROTULO_PERFIL, SITUACIONES_BCRA } from "@/lib/planes";
import {
  CANALES_NOTIFICACION,
  ESTADOS_NOTIFICACION_ONBOARDING,
  MAX_TRAMOS_PUNITORIOS,
  normalizarGestion,
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
import { CampoNumero, Subtitulo } from "./campos";
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
//
// Lista de ítems del legajo con un desplegable para agregar los del catálogo de Parámetros y la
// posibilidad de crear ítems nuevos sobre la marcha (se guardan en la misma lista del producto).

export function EditorDocumentos({
  docs,
  onChange,
  error,
}: {
  docs: DocumentoConfig[];
  onChange: (docs: DocumentoConfig[]) => void;
  error?: string;
}) {
  const [elegido, setElegido] = useState("");
  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: "", categoria: "" });
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null);

  const disponibles = TIPOS_DOCUMENTO.filter((t) => !docs.some((d) => d.tipoId === t.id));
  const categorias = [
    ...new Set([...TIPOS_DOCUMENTO.map((t) => t.categoria), ...docs.flatMap((d) => (d.categoria ? [d.categoria] : []))]),
  ];
  const cambiar = (tipoId: string, patch: Partial<DocumentoConfig>) =>
    onChange(docs.map((x) => (x.tipoId === tipoId ? { ...x, ...patch } : x)));

  function agregar() {
    if (!elegido) return;
    onChange([...docs, { tipoId: elegido, obligatorio: false, minimo: 0, maximo: 1 }]);
    setElegido("");
  }

  function crear() {
    const nombre = nuevo.nombre.trim();
    if (!nombre) {
      setErrorNuevo("Ingresá el nombre del ítem.");
      return;
    }
    const existentes = [...TIPOS_DOCUMENTO.map((t) => t.nombre), ...docs.map((d) => d.nombre ?? "")];
    if (existentes.some((n) => n.toLowerCase() === nombre.toLowerCase())) {
      setErrorNuevo("Ya existe un ítem con ese nombre.");
      return;
    }
    onChange([
      ...docs,
      {
        tipoId: `custom-${Date.now().toString(36)}`,
        nombre,
        categoria: nuevo.categoria || "Otros",
        obligatorio: false,
        minimo: 0,
        maximo: 1,
      },
    ]);
    setNuevo({ nombre: "", categoria: "" });
    setErrorNuevo(null);
    setCreando(false);
  }

  return (
    <div className="space-y-3">
      {docs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-200 px-4 py-5 text-center text-sm text-ink-400">
          El legajo todavía no tiene ítems: agregá uno desde el desplegable.
        </p>
      ) : (
        <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200 bg-white">
          {docs.map((d) => {
            const t = tipoDeDocumento(d);
            return (
              <li key={d.tipoId} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="text-sm font-medium text-ink-900">
                    {t.nombre}
                    {d.nombre && (
                      <span className="ml-2 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                        Nuevo
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-500">{t.categoria}</p>
                </div>
                <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
                  <Checkbox
                    checked={d.obligatorio}
                    onChange={(v) =>
                      cambiar(d.tipoId, {
                        obligatorio: v,
                        minimo: v ? Math.max(d.minimo, 1) : 0,
                        maximo: v ? Math.max(d.maximo, 1) : d.maximo,
                      })
                    }
                    label="Obligatorio"
                  />
                  <CampoNumero
                    id={`doc-${d.tipoId}-min`}
                    label="Mínimo"
                    min={d.obligatorio ? 1 : 0}
                    value={d.minimo}
                    disabled={!d.obligatorio}
                    onChange={(v) => cambiar(d.tipoId, { minimo: v })}
                    className="w-24"
                  />
                  <CampoNumero
                    id={`doc-${d.tipoId}-max`}
                    label="Máximo"
                    min={1}
                    value={d.maximo}
                    onChange={(v) => cambiar(d.tipoId, { maximo: v })}
                    className="w-24"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Quitar ${t.nombre}`}
                    onClick={() => onChange(docs.filter((x) => x.tipoId !== d.tipoId))}
                  >
                    <IconTrash width={14} height={14} />
                    Quitar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <SelectField
          id="doc-agregar"
          label="Agregar ítem al legajo"
          value={elegido}
          onChange={setElegido}
          placeholder={disponibles.length === 0 ? "No quedan ítems del catálogo" : "Elegí un ítem…"}
          options={disponibles.map((t) => ({ value: t.id, label: `${t.nombre} · ${t.categoria}` }))}
          disabled={disponibles.length === 0}
          className="min-w-64 flex-1 sm:max-w-md"
        />
        <Button onClick={agregar} disabled={!elegido}>
          <IconPlus width={14} height={14} />
          Agregar
        </Button>
        <Button variant="outline" onClick={() => setCreando((v) => !v)} aria-expanded={creando}>
          {creando ? "Cancelar" : "Crear ítem nuevo"}
        </Button>
      </div>

      {creando && (
        <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              id="doc-nuevo-nombre"
              label="Nombre del ítem"
              required
              value={nuevo.nombre}
              onChange={(v) => {
                setNuevo((n) => ({ ...n, nombre: v }));
                setErrorNuevo(null);
              }}
              placeholder="Ej.: Constancia de CBU"
              error={errorNuevo ?? undefined}
            />
            <SelectField
              id="doc-nuevo-categoria"
              label="Categoría"
              value={nuevo.categoria}
              onChange={(v) => setNuevo((n) => ({ ...n, categoria: v }))}
              placeholder="Otros"
              options={categorias.map((c) => ({ value: c, label: c }))}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={crear}>
              <IconPlus width={14} height={14} />
              Crear y agregar
            </Button>
          </div>
        </div>
      )}
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
  tokenizacion,
  onTokenizacion,
  errorTokenizacion,
}: {
  obligatorios: Partial<Record<string, boolean>>;
  onChange: (obligatorios: Partial<Record<string, boolean>>) => void;
  tokenizacion: TokenizacionConfig;
  onTokenizacion: (valor: TokenizacionConfig) => void;
  errorTokenizacion?: string;
  // Pantallas habilitadas del producto: las deshabilitadas se indican pero siguen editables.
  habilitadas: PantallaPostOfertaId[];
}) {
  return (
    <div className="space-y-3">
      {(Object.keys(TITULO_PANTALLA_CAMPOS) as PantallaPostOfertaId[])
        // Legajo e impresión no tienen campos para completar: se configuran en su propio bloque.
        .filter((pantalla) => pantalla !== "legajo" && pantalla !== "impresion")
        .map((pantalla) => {
        // En tokenización los campos de la tarjeta siempre se piden (los exige el proveedor): no se
        // listan. El código de seguridad tiene su propio check, más abajo.
        const campos = camposConfigurablesDe(pantalla).filter(
          (c) => !(pantalla === "tokenizacion" && (c.fijo || c.id === "tarjeta.codigo"))
        );
        const titulo = TITULO_PANTALLA_CAMPOS[pantalla];
        const estado = habilitadas.includes(pantalla) ? "" : " · deshabilitada";
        return (
          <details
            key={pantalla}
            open={pantalla === "tokenizacion" && errorTokenizacion ? true : undefined}
            className="rounded-xl border border-ink-200 bg-white"
          >
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-ink-800">
              {titulo}
              {campos.length > 0 && ` · ${campos.length} campo${campos.length === 1 ? "" : "s"}`}
              {estado}
            </summary>
            <div className="border-t border-ink-100 px-4 py-4">
              {pantalla === "tokenizacion" && (
                <div className="mb-4 grid gap-x-6 gap-y-4 border-b border-ink-100 pb-4 sm:grid-cols-2">
                  <SelectField
                    id="p-tok-tipo-tarjeta"
                    label="Tipo de tarjeta"
                    value={tokenizacion.tipoTarjeta ?? "DEBITO"}
                    onChange={(v) => onTokenizacion({ ...tokenizacion, tipoTarjeta: v as TipoTarjeta })}
                    options={TIPOS_TARJETA}
                  />
                  <Checkbox
                    checked={tokenizacion.pedirCodigoSeguridad !== false}
                    onChange={(v) => onTokenizacion({ ...tokenizacion, pedirCodigoSeguridad: v })}
                    label="Código de seguridad"
                    description="Si está deshabilitado, no es obligatorio pedirlo."
                  />
                </div>
              )}
              {pantalla === "tokenizacion" && (
                <div className="mb-4 space-y-3 border-b border-ink-100 pb-4">
                  <Subtitulo>Mínimo de tarjetas por proveedor</Subtitulo>
                  <p className="text-xs text-ink-500">
                    Repetí el bloque para pedir un mínimo por proveedor: por ejemplo, 1 de A y 2 de B.
                    El onboarding valida cada mínimo por separado.
                  </p>
                  <EditorTokenizacion
                    idBase="p-tok"
                    valor={tokenizacion}
                    onChange={onTokenizacion}
                    error={errorTokenizacion}
                  />
                </div>
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
  const dom = normalizarGestion(valor).domicilio;
  const setDom = (campo: keyof Domicilio, v: string) =>
    onChange({
      ...valor,
      domicilio: aplicarCambioDomicilio(dom, campo, sanitizarCampoDomicilio(campo, v)),
    });
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
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 sm:col-span-2">
            Domicilio
          </p>
          <FormField
            id={`${idBase}-dom-calle`}
            label="Calle"
            value={dom.calle}
            onChange={(v) => setDom("calle", v)}
          />
          <FormField
            id={`${idBase}-dom-numero`}
            label="Número"
            inputMode="numeric"
            value={dom.numero}
            onChange={(v) => setDom("numero", v)}
          />
          <FormField
            id={`${idBase}-dom-piso`}
            label="Piso"
            value={dom.piso}
            onChange={(v) => setDom("piso", v)}
          />
          <FormField
            id={`${idBase}-dom-departamento`}
            label="Departamento"
            value={dom.departamento}
            onChange={(v) => setDom("departamento", v)}
          />
          <SelectField
            id={`${idBase}-dom-provincia`}
            label="Provincia"
            value={dom.provincia}
            onChange={(v) => setDom("provincia", v)}
            options={PROVINCIAS.map((v) => ({ value: v, label: v }))}
          />
          <SelectField
            id={`${idBase}-dom-localidad`}
            label="Localidad"
            value={dom.localidad}
            onChange={(v) => setDom("localidad", v)}
            options={localidadesDe(dom.provincia).map((l) => ({ value: l.nombre, label: l.nombre }))}
            hint="Provincia y localidad salen de Parámetros."
          />
          <FormField
            id={`${idBase}-dom-cp`}
            label="Código postal"
            inputMode="numeric"
            value={dom.codigoPostal}
            onChange={(v) => setDom("codigoPostal", v)}
            hint="Se completa al elegir la localidad; se puede editar."
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

// Asignación de un grupo de reglas a varias claves a la vez (situaciones, condiciones laborales):
// un desplegable para el motor y un multiselect con las claves. Se guarda como clave → motor,
// así que cada clave tiene un solo motor y las que ya tienen otro no se ofrecen en esta fila.
function AsignacionPorSituacion({
  idBase,
  titulo,
  claves,
  rotulo,
  etiquetaClaves,
  textoVacio,
  valor,
  onChange,
  opcionesMotor,
}: {
  idBase: string;
  titulo: string;
  claves: string[];
  rotulo: (clave: string) => string;
  etiquetaClaves: string;
  textoVacio: string;
  valor: Record<string, string>;
  onChange: (valor: Record<string, string>) => void;
  opcionesMotor: { value: string; label: string }[];
}) {
  const [nueva, setNueva] = useState<{ motorId: string; sits: string[] } | null>(null);
  // Una fila por motor, con sus situaciones.
  const grupos = [...new Set(Object.values(valor))].map((motorId) => ({
    motorId,
    sits: claves.filter((n) => valor[n] === motorId),
  }));
  const asignadasA = (motorId: string) => (n: string) => !valor[n] || valor[n] === motorId;
  const aRotulos = (sits: string[]) => sits.map((n) => rotulo(n));
  const aClaves = (rotulos: string[]) => claves.filter((n) => rotulos.includes(rotulo(n)));
  const sinMotor = (motorId: string) =>
    Object.fromEntries(Object.entries(valor).filter(([, id]) => id !== motorId));

  function cambiarClaves(motorId: string, sits: string[]) {
    const resto = Object.fromEntries(Object.entries(valor).filter(([, id]) => id !== motorId));
    onChange({ ...resto, ...Object.fromEntries(sits.map((n) => [n, motorId])) });
  }
  function cambiarMotor(anterior: string, motorId: string) {
    if (!motorId) return;
    onChange(Object.fromEntries(Object.entries(valor).map(([n, id]) => [n, id === anterior ? motorId : id])));
  }
  // La fila nueva se arma completa (motor y situaciones) y recién entra con "Agregar".
  function confirmarNueva() {
    if (!nueva?.motorId || nueva.sits.length === 0) return;
    // Sólo se ofrecen situaciones libres: se suman a lo que ya tenía ese motor.
    onChange({ ...valor, ...Object.fromEntries(nueva.sits.map((n) => [n, nueva.motorId])) });
    setNueva(null);
  }
  const libresNueva = claves.filter((n) => !valor[n]);

  return (
    <div className="space-y-3">
      <Subtitulo>{titulo}</Subtitulo>
      {grupos.length === 0 && !nueva && (
        <p className="text-sm text-ink-500">{textoVacio}</p>
      )}
      {grupos.map((g, i) => (
        <div key={g.motorId} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
          <SelectField
            id={`${idBase}-motor-${i}`}
            label="Grupo de reglas"
            value={g.motorId}
            onChange={(v) => cambiarMotor(g.motorId, v)}
            options={opcionesMotor}
          />
          <MultiSelectField
            id={`${idBase}-sits-${i}`}
            label={etiquetaClaves}
            values={aRotulos(g.sits)}
            onChange={(r) => cambiarClaves(g.motorId, aClaves(r))}
            options={aRotulos(claves.filter(asignadasA(g.motorId)))}
            placeholder={`Elegí ${etiquetaClaves.toLowerCase()}…`}
          />
          <Button size="sm" variant="ghost" onClick={() => onChange(sinMotor(g.motorId))} aria-label="Quitar asignación">
            <IconTrash width={14} height={14} />
            Quitar
          </Button>
        </div>
      ))}
      {nueva && (
        <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
          <SelectField
            id={`${idBase}-motor-nueva`}
            label="Grupo de reglas"
            value={nueva.motorId}
            onChange={(v) => setNueva({ ...nueva, motorId: v })}
            placeholder="Elegí el grupo…"
            options={opcionesMotor}
          />
          <MultiSelectField
            id={`${idBase}-sits-nueva`}
            label={etiquetaClaves}
            values={aRotulos(nueva.sits)}
            onChange={(r) => setNueva({ ...nueva, sits: aClaves(r) })}
            options={aRotulos(libresNueva)}
            placeholder={`Elegí ${etiquetaClaves.toLowerCase()}…`}
          />
          <div className="flex gap-1.5">
            <Button size="sm" onClick={confirmarNueva} disabled={!nueva.motorId || nueva.sits.length === 0}>
              Agregar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNueva(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
      {!nueva && libresNueva.length > 0 && (
        <Button size="sm" variant="outline" onClick={() => setNueva({ motorId: "", sits: [] })}>
          <IconPlus width={14} height={14} />
          Agregar asignación
        </Button>
      )}
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
      <AsignacionPorSituacion
        idBase={`${idBase}-cond`}
        titulo="Grupo de reglas por condición laboral"
        claves={CONDICIONES_LABORALES}
        rotulo={(c) => c}
        etiquetaClaves="Condiciones laborales"
        textoVacio="Sin asignaciones: todas las condiciones usan el motor general."
        valor={valor.porCondicionLaboral}
        onChange={(porCondicionLaboral) => onChange({ ...valor, porCondicionLaboral })}
        opcionesMotor={OPCIONES_MOTOR}
      />
      <AsignacionPorSituacion
        idBase={`${idBase}-bcra`}
        titulo="Grupo de reglas por situación BCRA"
        claves={SITUACIONES_BCRA.map(String)}
        rotulo={(n) => ROTULO_BCRA[Number(n)]}
        etiquetaClaves="Situaciones"
        textoVacio="Sin asignaciones: todas las situaciones usan el motor general."
        valor={valor.porSituacionBcra ?? {}}
        onChange={(porSituacionBcra) => onChange({ ...valor, porSituacionBcra })}
        opcionesMotor={OPCIONES_MOTOR}
      />
      <AsignacionPorSituacion
        idBase={`${idBase}-interna`}
        titulo="Grupo de reglas por situación en buró interno"
        claves={PERFILES_INTERNOS.map(String)}
        rotulo={(n) => ROTULO_PERFIL[Number(n)]}
        etiquetaClaves="Situaciones"
        textoVacio="Sin asignaciones: todas las situaciones usan el motor general."
        valor={valor.porSituacionInterna ?? {}}
        onChange={(porSituacionInterna) => onChange({ ...valor, porSituacionInterna })}
        opcionesMotor={OPCIONES_MOTOR}
      />
    </div>
  );
}
