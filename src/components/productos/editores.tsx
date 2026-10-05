"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  AsignacionMotor,
  CombinacionMotor,
  BloqueTokenizacion,
  CantidadConfig,
  DocumentoConfig,
  TokenizacionConfig,
} from "@/lib/config";
import type { TipoCliente } from "@/lib/types";
import { crearXlsx } from "@/lib/xlsx";
import { TIPOS_TARJETA, claveCombinacion, normalizarAsignacion, textoCombinacion, tiposTarjetaDe } from "@/lib/config";
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
  MAX_TRAMOS_PUNITORIOS,
  asignadasDe,
  quitadasDe,
  marcarExcepcion,
  normalizarGestion,
  type GestionPrestamos,
  type NotificacionesProducto,
  type RecalculoNeto,
  type SeleccionLista,
  type TramoPunitorio,
} from "@/lib/productos";
import { AMBITOS, MEDIOS, disponibleEnProducto, getEvento, usePlantillasNotificacion } from "@/lib/plantillas-notificacion";
import { TERMINOS } from "@/lib/terminologia";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { MultiSelectField } from "@/components/ui/MultiSelectField";
import { SelectField } from "@/components/ui/SelectField";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
import { CampoNumero, Subtitulo } from "./campos";
import { IconPencil, IconPlus, IconTrash } from "@/components/icons";

// Editores compartidos por el ABM de Productos y el de Organismos (que hace excepciones sobre
// los mismos valores).

// --- Punitorios: hasta 6 tramos ---

export function EditorTramos({
  idBase,
  tramos,
  onChange,
  ancho,
}: {
  idBase: string;
  tramos: TramoPunitorio[];
  onChange: (tramos: TramoPunitorio[]) => void;
  // Ocupa todo el ancho: los cuatro campos del tramo en una sola fila.
  ancho?: boolean;
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
          <div className={`grid gap-3 sm:grid-cols-2 ${ancho ? "lg:grid-cols-4" : ""}`}>
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

// --- Notificaciones: asignación de las plantillas globales a este producto ---
//
// Las notificaciones (evento, texto, medios, parámetros) se administran una sola vez en el módulo
// Notificaciones; el producto sólo elige cuáles envía.

export function EditorNotificaciones({
  idBase,
  valor,
  onChange,
  productoId,
}: {
  idBase: string;
  // Con producto, sólo se ofrecen las notificaciones disponibles para él.
  productoId?: string;
  valor: NotificacionesProducto;
  onChange: (valor: NotificacionesProducto) => void;
}) {
  const [elegida, setElegida] = useState("");
  const plantillas = usePlantillasNotificacion();
  const asignadas = asignadasDe(valor);
  const quitadas = quitadasDe(valor);
  const disponibles = plantillas.filter(
    (n) => n.estado === "ACTIVA" && !asignadas.includes(n.id) && (!productoId || disponibleEnProducto(n, productoId))
  );
  const agregar = () => {
    if (!elegida) return;
    onChange({ ...valor, asignadas: [...asignadas, elegida] });
    setElegida("");
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-500">
          Las notificaciones asignadas se ven en sólo lectura: se crean y editan en el módulo Notificaciones. Podés quitar
          una como excepción (deja de enviarse, sin borrarla) y restaurarla cuando quieras.
        </p>
        <Link href="/notificaciones" className="text-sm font-medium text-brand-600 hover:underline">
          Administrar notificaciones
        </Link>
      </div>
      {AMBITOS.map((a) => {
        const lista = plantillas.filter((n) => n.ambito === a.id && asignadas.includes(n.id));
        const enviadas = lista.filter((n) => !quitadas.includes(n.id)).length;
        return (
          <div key={a.id} className="space-y-2">
            <Subtitulo>
              {a.label} · {enviadas} de {lista.length}
            </Subtitulo>
            {lista.length === 0 ? (
              <p className="text-sm text-ink-400">Todavía no hay notificaciones {a.label.toLowerCase()} asignadas.</p>
            ) : (
              <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200 bg-white">
                {lista.map((n) => {
                  const enExcepcion = quitadas.includes(n.id);
                  return (
                    <li key={n.id} className="flex flex-wrap items-start gap-x-6 gap-y-2 px-4 py-3">
                      <div className="min-w-0 flex-1 basis-64" id={`${idBase}-${n.id}`}>
                        <p className={`text-sm font-medium ${enExcepcion ? "text-ink-400 line-through" : "text-ink-900"}`}>
                          {n.nombre}
                          {n.estado === "INACTIVA" && " (inactiva)"}
                          {enExcepcion && (
                            <span className="ml-2 rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-700 no-underline">
                              Excepción
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-ink-500">
                          {getEvento(n.evento)?.label ?? n.evento} ·{" "}
                          {n.medios.map((m) => MEDIOS.find((x) => x.id === m)?.label ?? m).join(", ")}
                        </p>
                      </div>
                      {n.parametros.length > 0 && (
                        <p className="text-xs text-ink-500">
                          {n.parametros.map((p) => `${p.etiqueta || p.clave}: ${p.valor} ${p.unidad}`.trim()).join(" · ")}
                        </p>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`${enExcepcion ? "Restaurar" : "Quitar como excepción"} ${n.nombre}`}
                        onClick={() => onChange(marcarExcepcion(valor, n.id, !enExcepcion))}
                      >
                        {enExcepcion ? "Restaurar" : "Quitar como excepción"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap items-end gap-2">
        <SelectField
          id={`${idBase}-agregar`}
          label="Asignar otra notificación"
          value={elegida}
          onChange={setElegida}
          placeholder={disponibles.length === 0 ? "No quedan notificaciones disponibles" : "Elegí una notificación…"}
          options={disponibles.map((n) => ({ value: n.id, label: `${n.nombre} · ${n.ambito === "EXTERNO" ? "Externa" : "Interna"}` }))}
          disabled={disponibles.length === 0}
          className="min-w-64 flex-1 sm:max-w-md"
        />
        <Button onClick={agregar} disabled={!elegida}>
          <IconPlus width={14} height={14} />
          Asignar
        </Button>
      </div>
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
                  <div className="mt-2">
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
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
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
    onChange({ ...valor, proveedores: bloques.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
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
              onClick={() => onChange({ ...valor, proveedores: bloques.filter((_, j) => j !== i) })}
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
            ...valor,
            proveedores: [...bloques, { proveedorId: libres[0].id, minimo: bloques.length === 0 ? 1 : 0, maximo: 1 }],
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
  onHabilitar,
  errorTokenizacion,
  cantidades,
  onCantidades,
  errores,
}: {
  obligatorios: Partial<Record<string, boolean>>;
  onChange: (obligatorios: Partial<Record<string, boolean>>) => void;
  tokenizacion: TokenizacionConfig;
  onTokenizacion: (valor: TokenizacionConfig) => void;
  errorTokenizacion?: string;
  // Habilita o deshabilita una pantalla (hoy sólo se usa para el pedido de tokenización).
  onHabilitar: (pantalla: PantallaPostOfertaId, habilitada: boolean) => void;
  // Cantidad mínima y máxima de referencias y garantes (pantallas "referencias" y "garantias").
  cantidades: { referencias: CantidadConfig; garantes: CantidadConfig };
  onCantidades: (valor: { referencias: CantidadConfig; garantes: CantidadConfig }) => void;
  errores?: Partial<Record<"referencias" | "garantes", string>>;
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
            open={
              (pantalla === "tokenizacion" && errorTokenizacion) ||
              (pantalla === "referencias" && errores?.referencias) ||
              (pantalla === "garantias" && errores?.garantes)
                ? true
                : undefined
            }
            className="rounded-xl border border-ink-200 bg-white"
          >
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-ink-800">
              {titulo}
              {campos.length > 0 && ` · ${campos.length} campo${campos.length === 1 ? "" : "s"}`}
              {estado}
            </summary>
            <div className="border-t border-ink-100 px-4 py-4">
              {pantalla === "tokenizacion" && (
                <div className="mb-4 border-b border-ink-100 pb-4">
                  <Checkbox
                    checked={habilitadas.includes("tokenizacion")}
                    onChange={(v) => onHabilitar("tokenizacion", v)}
                    label="Pedir tokenización"
                    description="Si está deshabilitado, el onboarding no pide tarjetas."
                  />
                  {habilitadas.includes("tokenizacion") && (
                    <div className="mt-3">
                      <Checkbox
                        checked={tokenizacion.obligatoria !== false}
                        onChange={(v) => onTokenizacion({ ...tokenizacion, obligatoria: v })}
                        label="Tokenización obligatoria"
                        description="Si está deshabilitado, el cliente puede continuar sin tokenizar tarjeta."
                      />
                    </div>
                  )}
                </div>
              )}
              {pantalla === "tokenizacion" && (
                <div className="mb-4 grid gap-x-6 gap-y-4 border-b border-ink-100 pb-4 sm:grid-cols-2">
                  <MultiSelectField
                    id="p-tok-tipo-tarjeta"
                    label="Tipos de tarjeta"
                    values={tiposTarjetaDe(tokenizacion).map((t) => TIPOS_TARJETA.find((x) => x.value === t)?.label ?? t)}
                    onChange={(rotulos) => {
                      // Siempre queda al menos un tipo.
                      const tipos = TIPOS_TARJETA.filter((x) => rotulos.includes(x.label)).map((x) => x.value);
                      if (tipos.length > 0) onTokenizacion({ ...tokenizacion, tiposTarjeta: tipos, tipoTarjeta: undefined });
                    }}
                    options={TIPOS_TARJETA.map((x) => x.label)}
                    placeholder="Elegí los tipos…"
                    plural="tipos de tarjeta"
                    hint="Podés marcar más de uno."
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
              {(pantalla === "referencias" || pantalla === "garantias") &&
                (() => {
                  const key = pantalla === "referencias" ? "referencias" : "garantes";
                  const id = pantalla === "referencias" ? "p-ref" : "p-gar";
                  return (
                    <div className={`space-y-2 ${campos.length > 0 ? "mt-4 border-t border-ink-100 pt-4" : ""}`}>
                      <Subtitulo>{key === "referencias" ? "Cantidad de referencias" : "Cantidad de garantes"}</Subtitulo>
                      <div className="grid grid-cols-2 gap-3">
                        <CampoNumero
                          id={`${id}-min`}
                          label="Mínimo"
                          value={cantidades[key].minimo}
                          onChange={(v) => onCantidades({ ...cantidades, [key]: { ...cantidades[key], minimo: v } })}
                        />
                        <CampoNumero
                          id={`${id}-max`}
                          label="Máximo"
                          value={cantidades[key].maximo}
                          onChange={(v) => onCantidades({ ...cantidades, [key]: { ...cantidades[key], maximo: v } })}
                        />
                      </div>
                      {errores?.[key] && <ValidationMessage tipo="error">{errores[key]}</ValidationMessage>}
                    </div>
                  );
                })()}
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

// --- Motor de riesgo: tabla de combinaciones ---

const TIPOS_CLIENTE = [
  { value: "NUEVO", label: "Cliente nuevo" },
  { value: "EXISTENTE", label: "Cliente existente" },
];

// Arriba se arma la combinación: tipo de cliente, condiciones laborales, situaciones BCRA y de
// buró interno (todo opcional: lo que se deja vacío no se mira) y el grupo de reglas que rige.
// "Agregar" genera una fila por cada combinación de lo elegido; abajo se ven las filas, cada una
// es una regla de asignación. Una misma combinación no se puede cargar dos veces.
function TablaCombinaciones({
  idBase,
  combinaciones,
  onChange,
  opcionesMotor,
}: {
  idBase: string;
  combinaciones: CombinacionMotor[];
  onChange: (combinaciones: CombinacionMotor[]) => void;
  opcionesMotor: { value: string; label: string }[];
}) {
  const [tipo, setTipo] = useState<TipoCliente | "">("");
  const [condiciones, setCondiciones] = useState<string[]>([]);
  const [bcra, setBcra] = useState<string[]>([]);
  const [interna, setInterna] = useState<string[]>([]);
  const [motor, setMotor] = useState("");
  // Fila que se está editando: el formulario se carga con sus valores y "Guardar" la reemplaza.
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const nombreMotor = (id: string) => opcionesMotor.find((o) => o.value === id)?.label ?? "—";
  const clavesDe = (rotulos: string[], numeros: number[], rotulo: Record<number, string>) =>
    numeros.filter((n) => rotulos.includes(rotulo[n])).map(String);
  // Sin nada elegido en un criterio, la fila lo deja en blanco ("cualquiera").
  const o = (valores: string[]) => (valores.length > 0 ? valores : [""]);

  const bcraElegidas = clavesDe(bcra, SITUACIONES_BCRA, ROTULO_BCRA);
  const internaElegidas = clavesDe(interna, PERFILES_INTERNOS, ROTULO_PERFIL);
  const cantidad = o(condiciones).length * o(bcraElegidas).length * o(internaElegidas).length;

  // Filas que genera lo elegido en el formulario.
  const nuevas: CombinacionMotor[] = [];
  for (const condicion of o(condiciones))
    for (const b of o(bcraElegidas))
      for (const i of o(internaElegidas))
        nuevas.push({ id: `nueva-${nuevas.length}`, tipoCliente: tipo, condicion, bcra: b, interna: i, motor });

  // Una misma combinación no se carga dos veces (al editar, la propia fila no cuenta).
  const existentes = new Set(combinaciones.filter((c) => c.id !== editandoId).map(claveCombinacion));
  const repetidas = nuevas.filter((c) => existentes.has(claveCombinacion(c)));
  const aviso =
    repetidas.length > 0
      ? `Ya está cargada: ${repetidas.slice(0, 3).map(textoCombinacion).join("; ")}${
          repetidas.length > 3 ? ` y ${repetidas.length - 3} más` : ""
        }. Cambiá la combinación${editandoId ? "" : " o eliminá la fila existente"}.`
      : null;

  function limpiar() {
    setTipo("");
    setCondiciones([]);
    setBcra([]);
    setInterna([]);
    setEditandoId(null);
  }

  function guardar() {
    if (!motor || repetidas.length > 0) return;
    const marca = Date.now().toString(36);
    const filas = nuevas.map((c, i) => ({ ...c, id: `comb-${marca}-${i}` }));
    if (editandoId) {
      // La primera conserva el lugar y el id de la fila editada; las demás van a continuación.
      filas[0].id = editandoId;
      onChange(combinaciones.flatMap((c) => (c.id === editandoId ? filas : [c])));
    } else onChange([...combinaciones, ...filas]);
    limpiar();
  }

  function editar(c: CombinacionMotor) {
    setEditandoId(c.id);
    setTipo(c.tipoCliente);
    setCondiciones(c.condicion ? [c.condicion] : []);
    setBcra(c.bcra ? [ROTULO_BCRA[Number(c.bcra)]] : []);
    setInterna(c.interna ? [ROTULO_PERFIL[Number(c.interna)]] : []);
    setMotor(c.motor);
  }

  function exportar() {
    const filas = [
      ["N°", "Tipo de cliente", "Condición laboral", "Situación BCRA", "Buró interno", "Grupo de reglas"],
      ...combinaciones.map((c, i) => [
        String(i + 1),
        c.tipoCliente === "NUEVO" ? "Nuevo" : c.tipoCliente === "EXISTENTE" ? "Existente" : "Cualquiera",
        c.condicion || "Cualquiera",
        c.bcra ? (ROTULO_BCRA[Number(c.bcra)] ?? c.bcra) : "Cualquiera",
        c.interna ? (ROTULO_PERFIL[Number(c.interna)] ?? c.interna) : "Cualquiera",
        nombreMotor(c.motor),
      ]),
    ];
    const blob = new Blob([crearXlsx("Combinaciones", filas) as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "motor-riesgo-combinaciones.xlsx";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const cualquiera = <span className="text-ink-400">Cualquiera</span>;

  return (
    <div className="space-y-4">
      <Subtitulo>Combinaciones de asignación</Subtitulo>
      <p className="text-xs text-ink-500">
        Cada fila es una regla: si el cliente cumple lo que fija la combinación, evalúa con su grupo de
        reglas. Lo que dejes sin elegir no se tiene en cuenta; si aplican varias filas, gana la más
        específica y, a igual especificidad, la primera de la tabla.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id={`${idBase}-comb-tipo`}
          label="Tipo de cliente"
          value={tipo}
          onChange={(v) => setTipo(v as TipoCliente | "")}
          placeholder="Cualquiera"
          options={TIPOS_CLIENTE}
        />
        <SelectField
          id={`${idBase}-comb-motor`}
          label="Grupo de reglas"
          value={motor}
          onChange={setMotor}
          placeholder="Elegí el grupo…"
          options={opcionesMotor}
        />
        <MultiSelectField
          id={`${idBase}-comb-cond`}
          label="Condiciones laborales"
          values={condiciones}
          onChange={setCondiciones}
          options={CONDICIONES_LABORALES}
          placeholder="Cualquiera"
          plural="condiciones"
          className="sm:col-span-2"
        />
        <MultiSelectField
          id={`${idBase}-comb-bcra`}
          label="Situación BCRA"
          values={bcra}
          onChange={setBcra}
          options={SITUACIONES_BCRA.map((n) => ROTULO_BCRA[n])}
          placeholder="Cualquiera"
          plural="situaciones"
        />
        <MultiSelectField
          id={`${idBase}-comb-interna`}
          label="Situación en buró interno"
          values={interna}
          onChange={setInterna}
          options={PERFILES_INTERNOS.map((n) => ROTULO_PERFIL[n])}
          placeholder="Cualquiera"
          plural="situaciones"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={guardar} disabled={!motor || repetidas.length > 0}>
          {editandoId ? (
            "Guardar cambios"
          ) : (
            <>
              <IconPlus width={14} height={14} />
              Agregar combinación
            </>
          )}
        </Button>
        <Button size="sm" variant="outline" onClick={exportar} disabled={combinaciones.length === 0}>
          Exportar a Excel
        </Button>
        {editandoId && (
          <Button size="sm" variant="ghost" onClick={limpiar}>
            Cancelar edición
          </Button>
        )}
        {cantidad > 1 && <p className="text-xs text-ink-500">Se van a generar {cantidad} filas.</p>}
        {editandoId && <p className="text-xs font-medium text-brand-700">Editando la combinación seleccionada.</p>}
      </div>
      {aviso && <ValidationMessage tipo="error">{aviso}</ValidationMessage>}

      <div className="overflow-x-auto rounded-xl border border-ink-200">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            <tr>
              <th className="w-10 px-3 py-2.5">N°</th>
              <th className="px-3 py-2.5">Tipo de cliente</th>
              <th className="px-3 py-2.5">Condición laboral</th>
              <th className="px-3 py-2.5">Situación BCRA</th>
              <th className="px-3 py-2.5">Buró interno</th>
              <th className="px-3 py-2.5">Grupo de reglas</th>
              <th className="px-3 py-2.5">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {combinaciones.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-5 text-center text-sm text-ink-400">
                  Sin combinaciones: todos los clientes usan el motor general.
                </td>
              </tr>
            )}
            {combinaciones.map((c, i) => (
              <tr key={c.id}>
                <td className="px-3 py-2.5 tabular-nums text-ink-400">{i + 1}</td>
                <td className="px-3 py-2.5 text-ink-800">
                  {c.tipoCliente ? (c.tipoCliente === "NUEVO" ? "Nuevo" : "Existente") : cualquiera}
                </td>
                <td className="px-3 py-2.5 text-ink-800">{c.condicion || cualquiera}</td>
                <td className="px-3 py-2.5 text-ink-800">
                  {c.bcra ? ROTULO_BCRA[Number(c.bcra)] ?? c.bcra : cualquiera}
                </td>
                <td className="px-3 py-2.5 text-ink-800">
                  {c.interna ? ROTULO_PERFIL[Number(c.interna)] ?? c.interna : cualquiera}
                </td>
                <td className="px-3 py-2.5 font-medium text-ink-900">{nombreMotor(c.motor)}</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="inline-flex gap-0.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Editar combinación"
                      aria-label={`Editar combinación ${i + 1}`}
                      onClick={() => editar(c)}
                    >
                      <IconPencil width={14} height={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Eliminar combinación"
                      aria-label={`Eliminar combinación ${i + 1}`}
                      className="text-danger-600 hover:text-danger-700"
                      onClick={() => {
                        onChange(combinaciones.filter((x) => x.id !== c.id));
                        if (editandoId === c.id) limpiar();
                      }}
                    >
                      <IconTrash width={14} height={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EditorMotor({
  idBase,
  valor: valorGuardado,
  onChange,
  error,
  mostrarError = true,
}: {
  idBase: string;
  valor: AsignacionMotor;
  onChange: (valor: AsignacionMotor) => void;
  placeholderGeneral?: string;
  // Combinaciones incompletas o repetidas (ver `errorAsignacionMotor`).
  error?: string;
  mostrarError?: boolean;
}) {
  // Los grupos de reglas salen del ABM del Motor de riesgo: los no activos se rotulan.
  const OPCIONES_MOTOR = useMotores().map((m) => ({
    value: m.id,
    label: m.estado === "ACTIVO" ? m.nombre : `${m.nombre} (${m.estado.toLowerCase()})`,
  }));
  const valor = normalizarAsignacion(valorGuardado);
  return (
    <div className="space-y-5">
      <TablaCombinaciones
        idBase={idBase}
        combinaciones={valor.combinaciones}
        onChange={(combinaciones) => onChange({ ...valor, combinaciones })}
        opcionesMotor={OPCIONES_MOTOR}
      />
      {mostrarError && error && <ValidationMessage tipo="error">{error}</ValidationMessage>}
    </div>
  );
}
