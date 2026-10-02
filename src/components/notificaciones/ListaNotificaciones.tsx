"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import {
  AMBITOS,
  EVENTOS,
  MEDIOS,
  VARIABLES_TEXTO,
  cambiarEstadoNotificacion,
  disponibleEnProducto,
  eliminarNotificacion,
  getEvento,
  guardarNotificacion,
  nuevaNotificacion,
  usePlantillasNotificacion,
  validarNotificacion,
  type AmbitoNotificacion,
  type MedioNotificacion,
  type Notificacion,
} from "@/lib/plantillas-notificacion";
import { useProductos } from "@/lib/productos";
import { EditorSeleccion } from "@/components/productos/editores";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
import { IconPlus, IconSearch, IconTrash } from "@/components/icons";

const sinAcentos = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const etiquetaMedio = (id: MedioNotificacion) => MEDIOS.find((m) => m.id === id)?.label ?? id;

// ABM de notificaciones: plantillas con evento, texto, medios y parámetros, en dos solapas
// (externas al cliente, internas a los equipos).
export function ListaNotificaciones() {
  const { hidratado } = useApplication();
  const todas = usePlantillasNotificacion();
  const productos = useProductos();
  const [ambito, setAmbito] = useState<AmbitoNotificacion>("EXTERNO");
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<Notificacion | null>(null);
  const [aEliminar, setAEliminar] = useState<Notificacion | null>(null);

  const q = sinAcentos(busqueda.trim());
  const filas = todas
    .filter((n) => n.ambito === ambito)
    .filter((n) => !q || sinAcentos(`${n.codigo} ${n.nombre} ${getEvento(n.evento)?.label ?? ""} ${n.texto}`).includes(q))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="animate-fade-in">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Módulo Notificaciones</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">Notificaciones</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Plantillas de aviso: cada una tiene un evento que la dispara, un texto, los medios de envío y
          sus parámetros (por ejemplo, los días de mora a partir de los cuales se avisa).
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button onClick={() => setEditando(nuevaNotificacion(ambito))}>
          <IconPlus width={16} height={16} />
          Nueva notificación
        </Button>
        <div className="relative w-full sm:w-72">
          <IconSearch
            width={15}
            height={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, evento o texto…"
            aria-label="Buscar notificaciones"
            className="h-10 w-full rounded-lg border border-ink-300 bg-white pl-9 pr-3 text-sm shadow-xs outline-none transition placeholder:text-ink-400 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>

      <div role="tablist" aria-label="Ámbito de la notificación" className="mt-5 inline-flex rounded-lg border border-ink-200 bg-ink-50 p-0.5">
        {AMBITOS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={ambito === a.id}
            onClick={() => setAmbito(a.id)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              ambito === a.id ? "bg-white text-ink-900 shadow-xs" : "text-ink-500 hover:text-ink-800"
            }`}
          >
            {a.label}
            <span className="ml-1.5 text-xs tabular-nums text-ink-400">
              {todas.filter((n) => n.ambito === a.id).length}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-500">{AMBITOS.find((a) => a.id === ambito)?.detalle}</p>

      <Card className="mt-4 overflow-hidden">
        {!hidratado ? (
          <p className="px-5 py-8 text-center text-sm text-ink-400">Cargando…</p>
        ) : filas.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-400">
            {q ? "Ninguna notificación coincide con la búsqueda." : "Todavía no hay notificaciones en esta solapa."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="w-20 px-4 py-2.5">ID</th>
                  <th className="px-4 py-2.5">Notificación</th>
                  <th className="px-4 py-2.5">Evento</th>
                  <th className="px-4 py-2.5">Medios</th>
                  <th className="px-4 py-2.5">Parámetros</th>
                  <th className="px-4 py-2.5">Productos</th>
                  <th className="w-28 px-4 py-2.5">Estado</th>
                  <th className="w-56 px-4 py-2.5">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filas.map((n) => (
                  <tr key={n.id} className="align-top transition hover:bg-ink-25">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-brand-700">{n.codigo}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink-900">{n.nombre}</p>
                      <p className="mt-0.5 line-clamp-2 max-w-xs text-xs text-ink-500">{n.texto}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{getEvento(n.evento)?.label ?? n.evento}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {n.medios.map((m) => (
                          <span
                            key={m}
                            className="rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-[11px] font-medium text-ink-700"
                          >
                            {etiquetaMedio(m)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-700">
                      {n.parametros.length === 0 ? (
                        <span className="text-ink-400">—</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {n.parametros.map((p) => (
                            <li key={p.id}>
                              {p.etiqueta || p.clave}: <strong>{p.valor}</strong> {p.unidad}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-700">
                      {!n.disponibleEn || n.disponibleEn.todos
                        ? "Todos"
                        : productos
                            .filter((p) => disponibleEnProducto(n, p.config.id))
                            .map((p) => p.config.nombre)
                            .join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={n.estado === "ACTIVA" ? "success" : "neutral"}>
                        {n.estado === "ACTIVA" ? "Activa" : "Inactiva"}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setEditando(structuredClone(n))}>
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cambiarEstadoNotificacion(n.id, n.estado === "ACTIVA" ? "INACTIVA" : "ACTIVA")}
                        >
                          {n.estado === "ACTIVA" ? "Desactivar" : "Activar"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setAEliminar(n)} aria-label={`Eliminar ${n.nombre}`}>
                          <IconTrash width={14} height={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editando && <FormularioNotificacion key={editando.id || "nueva"} inicial={editando} todas={todas} onCerrar={() => setEditando(null)} />}

      <ConfirmationModal
        open={aEliminar !== null}
        title="¿Eliminar la notificación?"
        descripcion="Se borra la plantilla. Si solo querés dejar de usarla, desactivala."
        rows={[
          { label: "Notificación", value: aEliminar?.nombre ?? "—" },
          { label: "ID", value: aEliminar?.codigo ?? "—" },
        ]}
        confirmLabel="Eliminar notificación"
        cancelLabel="Volver"
        tone="danger"
        onConfirm={() => {
          if (aEliminar) eliminarNotificacion(aEliminar.id);
          setAEliminar(null);
        }}
        onCancel={() => setAEliminar(null)}
      />
    </div>
  );
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "_$1");

function FormularioNotificacion({
  inicial,
  todas,
  onCerrar,
}: {
  inicial: Notificacion;
  todas: Notificacion[];
  onCerrar: () => void;
}) {
  const [b, setB] = useState<Notificacion>({
    ...inicial,
    disponibleEn: inicial.disponibleEn ?? { todos: true, ids: [] },
  });
  const productos = useProductos();
  const [intentado, setIntentado] = useState(false);
  const errores = validarNotificacion(b, todas);
  const ver = (k: string) => (intentado ? errores[k] : undefined);
  const nuevo = !inicial.id;
  const eventos = EVENTOS.filter((e) => e.ambito === b.ambito);
  const medios = MEDIOS.filter((m) => m.ambitos.includes(b.ambito));
  const variables = [
    ...VARIABLES_TEXTO,
    ...b.parametros.filter((p) => p.clave).map((p) => ({ clave: p.clave, detalle: p.etiqueta || "Parámetro" })),
  ];

  const set = (patch: Partial<Notificacion>) => setB((x) => ({ ...x, ...patch }));
  const cambiarParametro = (id: string, patch: Partial<Notificacion["parametros"][number]>) =>
    set({ parametros: b.parametros.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  // Al elegir el evento se cargan sus parámetros (con un valor sugerido); los propios se conservan.
  function elegirEvento(id: string) {
    const anterior = getEvento(b.evento);
    const siguiente = getEvento(id);
    const propios = b.parametros.filter((p) => !anterior?.parametros.some((x) => x.clave === p.clave));
    const sugeridos = (siguiente?.parametros ?? [])
      .filter((x) => !propios.some((p) => p.clave === x.clave))
      .map((x) => ({ id: `p-${x.clave}-${Date.now().toString(36)}`, ...x }));
    set({ evento: id, parametros: [...sugeridos, ...propios] });
  }

  function guardar() {
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    guardarNotificacion({ ...b, nombre: b.nombre.trim(), texto: b.texto.trim() });
    onCerrar();
  }

  return (
    <Modal
      open
      onClose={onCerrar}
      title={nuevo ? `Nueva notificación ${b.ambito === "EXTERNO" ? "externa" : "interna"}` : `Editar notificación ${b.codigo}`}
      maxWidth="max-w-3xl"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {intentado && Object.keys(errores).length > 0 && (
            <p className="mr-auto self-center text-sm font-medium text-danger-600">
              Hay {Object.keys(errores).length} error{Object.keys(errores).length === 1 ? "" : "es"} para corregir.
            </p>
          )}
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={guardar}>{nuevo ? "Crear notificación" : "Guardar cambios"}</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="ntf-nombre"
            label="Nombre"
            required
            value={b.nombre}
            onChange={(v) => set({ nombre: v })}
            placeholder="Ej.: Aviso de mora al cliente"
            error={ver("nombre")}
          />
          <SelectField
            id="ntf-evento"
            label="Evento que la dispara"
            required
            value={b.evento}
            onChange={elegirEvento}
            placeholder="Elegí el evento…"
            options={eventos.map((e) => ({ value: e.id, label: e.label }))}
            error={ver("evento")}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink-700">
            Medios de envío <span className="text-danger-500">*</span>
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {medios.map((m) => (
              <Checkbox
                key={m.id}
                checked={b.medios.includes(m.id)}
                onChange={(v) =>
                  set({ medios: v ? [...b.medios, m.id] : b.medios.filter((x) => x !== m.id) })
                }
                label={m.label}
              />
            ))}
          </div>
          {ver("medios") && (
            <div className="mt-2">
              <ValidationMessage tipo="error">{ver("medios")}</ValidationMessage>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="ntf-texto" className="mb-1.5 block text-sm font-medium text-ink-700">
            Texto <span className="text-danger-500">*</span>
          </label>
          <textarea
            id="ntf-texto"
            rows={4}
            value={b.texto}
            onChange={(e) => set({ texto: e.target.value })}
            aria-invalid={!!ver("texto")}
            placeholder="Ej.: Hola {{cliente}}, tu crédito {{numero_credito}} tiene {{dias_mora}} días de mora."
            className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink-900 shadow-xs outline-none transition placeholder:text-ink-400 ${
              ver("texto")
                ? "border-danger-400 focus:ring-2 focus:ring-danger-100"
                : "border-ink-300 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            }`}
          />
          {ver("texto") && <p className="mt-1.5 text-sm text-danger-600">{ver("texto")}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-500">Variables (clic para agregar):</span>
            {variables.map((v) => (
              <button
                key={v.clave}
                type="button"
                title={v.detalle}
                onClick={() => set({ texto: `${b.texto}${b.texto && !b.texto.endsWith(" ") ? " " : ""}{{${v.clave}}}` })}
                className="rounded-md border border-ink-200 bg-ink-25 px-2 py-0.5 font-mono text-xs text-ink-700 transition hover:border-brand-300 hover:bg-brand-50"
              >
                {`{{${v.clave}}}`}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-ink-700">Parámetros</p>
            <p className="text-xs text-ink-500">
              Valores que condicionan cuándo se envía (por ejemplo, los días de mora). Se pueden usar en el
              texto con su clave, como {"{{clave}}"}.
            </p>
          </div>
          {b.parametros.length === 0 && <p className="text-sm text-ink-400">Sin parámetros.</p>}
          {b.parametros.map((p) => (
            <div key={p.id} className="space-y-1">
              <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_6rem_6rem_auto]">
                <FormField
                  id={`ntf-p-${p.id}-etiqueta`}
                  label="Nombre"
                  value={p.etiqueta}
                  onChange={(v) =>
                    cambiarParametro(p.id, {
                      etiqueta: v,
                      clave: p.clave === slug(p.etiqueta) ? slug(v) : p.clave,
                    })
                  }
                  placeholder="Días de mora"
                />
                <FormField
                  id={`ntf-p-${p.id}-clave`}
                  label="Clave"
                  value={p.clave}
                  onChange={(v) => cambiarParametro(p.id, { clave: v })}
                  placeholder="dias_mora"
                />
                <FormField
                  id={`ntf-p-${p.id}-valor`}
                  label="Valor"
                  value={p.valor}
                  onChange={(v) => cambiarParametro(p.id, { valor: v })}
                />
                <FormField
                  id={`ntf-p-${p.id}-unidad`}
                  label="Unidad"
                  value={p.unidad}
                  onChange={(v) => cambiarParametro(p.id, { unidad: v })}
                  placeholder="días"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Quitar parámetro"
                  onClick={() => set({ parametros: b.parametros.filter((x) => x.id !== p.id) })}
                >
                  <IconTrash width={14} height={14} />
                </Button>
              </div>
              {ver(`parametro-${b.parametros.indexOf(p)}`) && (
                <ValidationMessage tipo="error">{ver(`parametro-${b.parametros.indexOf(p)}`)}</ValidationMessage>
              )}
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              set({
                parametros: [
                  ...b.parametros,
                  { id: `p-${Date.now().toString(36)}`, clave: "", etiqueta: "", valor: "", unidad: "" },
                ],
              })
            }
          >
            <IconPlus width={14} height={14} />
            Agregar parámetro
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-ink-700">Disponible en los productos</p>
          <p className="text-xs text-ink-500">
            Cada producto elige, entre las que tiene disponibles, cuáles envía.
          </p>
          <EditorSeleccion
            opciones={productos.map((p) => ({ value: p.config.id, label: p.config.nombre }))}
            valor={b.disponibleEn}
            onChange={(disponibleEn) => set({ disponibleEn })}
          />
          {ver("productos") && <ValidationMessage tipo="error">{ver("productos")}</ValidationMessage>}
        </div>

        <Checkbox
          checked={b.estado === "ACTIVA"}
          onChange={(v) => set({ estado: v ? "ACTIVA" : "INACTIVA" })}
          label="Notificación activa"
          description="Si está inactiva, se conserva pero no se envía."
        />
      </div>
    </Modal>
  );
}
