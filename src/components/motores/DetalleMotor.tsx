"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApplication } from "@/lib/application-context";
import type { EstadoProducto } from "@/lib/config";
import { OPERADORES } from "@/lib/expresiones";
import {
  ACCIONES,
  borradorMotor,
  cadenaMotores,
  cambiarEstadoMotor,
  crearMotor,
  filtrarVariables,
  FUENTES,
  guardarMotor,
  motorDisponible,
  nuevaReglaId,
  textoVigenciaMotor,
  useMotores,
  validarMotor,
  variablesDeFuentes,
  vencimientoMotor,
  vigenciaMotor,
  type FirmaMotor,
  type MotorRiesgo,
  type ReglaMotor,
} from "@/lib/motores";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tooltip } from "@/components/ui/Tooltip";
import { ESTADO_PRODUCTO_META } from "@/components/productos/ListaProductos";
import {
  IconArrowLeft,
  IconCheckCircle,
  IconLoader,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@/components/icons";

const TEXTO_ESTADO: Partial<Record<EstadoProducto, { titulo: string; descripcion: string; boton: string }>> = {
  SUSPENDIDO: {
    titulo: "¿Suspender el grupo de reglas?",
    descripcion:
      "Deja de evaluarse: las solicitudes que lo tenían asignado pasan al motor general y las cadenas que lo concatenan se cortan antes de él.",
    boton: "Suspender grupo",
  },
  ELIMINADO: {
    titulo: "¿Eliminar el grupo de reglas?",
    descripcion:
      "Pasa a Eliminados y deja de evaluarse. Las solicitudes ya evaluadas conservan su resultado y se puede restaurar.",
    boton: "Eliminar grupo",
  },
};

export function DetalleMotor({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { hidratado } = useApplication();
  const motores = useMotores();

  if (!hidratado) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-ink-400">
        <IconLoader width={24} height={24} />
      </div>
    );
  }

  if (id === "nuevo") {
    const de = params.get("de");
    return <Formulario key={`nuevo-${de}`} registro={borradorMotor(de)} todos={motores} nuevo />;
  }

  const registro = motores.find((m) => m.id === id);
  if (!registro) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-bold tracking-tight text-ink-900">No existe el grupo “{id}”</h1>
          <p className="mt-2 text-sm text-ink-500">Puede haber sido creado en otra sesión de la demo.</p>
          <div className="mt-6">
            <Button onClick={() => router.push("/motor-riesgo")}>Volver al Motor de riesgo</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <Formulario key={id} registro={registro} todos={motores} editarAlAbrir={params.get("editar") === "1"} />
  );
}

type ModoVigencia = "SIN" | "DIAS" | "FECHA";

function Formulario({
  registro,
  todos,
  nuevo = false,
  editarAlAbrir = false,
}: {
  registro: MotorRiesgo;
  todos: MotorRiesgo[];
  nuevo?: boolean;
  editarAlAbrir?: boolean;
}) {
  const router = useRouter();
  const [borrador, setBorrador] = useState<MotorRiesgo>(() => structuredClone(registro));
  const [editando, setEditando] = useState(nuevo || editarAlAbrir);
  const [intentado, setIntentado] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [pendiente, setPendiente] = useState<EstadoProducto | null>(null);
  const [reglaActiva, setReglaActiva] = useState<string | null>(null);
  // Reglas que se editan de a una, sin pasar todo el grupo a edición.
  const [reglasEditando, setReglasEditando] = useState<string[]>([]);
  const algunaEdicion = editando || reglasEditando.length > 0;
  const [busquedaVariable, setBusquedaVariable] = useState("");

  const errores = validarMotor(borrador, todos);
  const cantErrores = Object.keys(errores).length;
  const ver = (clave: string) => (intentado ? errores[clave] : undefined);
  const meta = ESTADO_PRODUCTO_META[registro.estado];
  const vigencia = vigenciaMotor(registro);
  const modoVigencia: ModoVigencia =
    borrador.vigenciaHasta !== null ? "FECHA" : borrador.vigenciaDias !== null ? "DIAS" : "SIN";

  function editar(cambio: (m: MotorRiesgo) => MotorRiesgo) {
    setGuardado(false);
    setBorrador(cambio);
  }
  const editarRegla = (rid: string, cambio: Partial<ReglaMotor>) =>
    editar((m) => ({ ...m, reglas: m.reglas.map((r) => (r.id === rid ? { ...r, ...cambio } : r)) }));

  // Clic en una variable disponible → se agrega a la regla que se estaba editando (por defecto, la última).
  function agregarVariable(nombre: string) {
    const destino = borrador.reglas.find((r) => r.id === reglaActiva) ?? borrador.reglas.at(-1);
    if (!destino) return;
    editarRegla(destino.id, { expresion: `${destino.expresion.trimEnd()} ${nombre}`.trimStart() });
  }

  // Desde la vista de sólo lectura también se puede cargar una regla: sólo la nueva pasa a edición.
  function nuevaRegla() {
    const id = nuevaReglaId(borrador.reglas);
    setReglasEditando((ids) => [...ids, id]);
    setReglaActiva(id);
    editar((m) => ({
      ...m,
      reglas: [{ id, nombre: "", expresion: "", accion: "RECHAZAR" }, ...m.reglas],
    }));
  }

  function grabar() {
    setIntentado(true);
    if (cantErrores > 0) return;
    if (nuevo) {
      const id = crearMotor(borrador);
      router.replace(`/motor-riesgo/${id}`);
      return;
    }
    guardarMotor(borrador);
    setGuardado(true);
    setIntentado(false);
    setEditando(false);
    setReglasEditando([]);
  }

  function cancelar() {
    if (nuevo) {
      router.push("/motor-riesgo");
      return;
    }
    setBorrador(structuredClone(registro));
    setIntentado(false);
    setEditando(false);
    setReglasEditando([]);
  }

  function aplicarEstado(estado: EstadoProducto) {
    cambiarEstadoMotor(registro.id, estado);
    setBorrador((b) => ({ ...b, estado }));
  }

  // Concatenar con grupo → [desplegable de grupos activos] (v1 §5).
  const opcionesConcatenar = todos
    .filter((m) => m.id !== registro.id && (m.estado === "ACTIVO" || m.id === borrador.concatenarCon))
    .map((m) => ({ value: m.id, label: `${m.codigo} · ${m.nombre}` }));
  const cadena = cadenaMotores(borrador, todos.map((m) => (m.id === borrador.id ? borrador : m)));
  const texto = pendiente ? TEXTO_ESTADO[pendiente] : undefined;
  const variablesFiltradas = filtrarVariables(variablesDeFuentes(borrador.fuentes), busquedaVariable);
  // Lista legible de lo que impide grabar, para mostrarla junto al botón.
  const listaErrores = Object.entries(errores).map(([clave, msg]) => {
    const m = /^regla-(.+)-(nombre|expresion)$/.exec(clave);
    const n = m ? borrador.reglas.findIndex((r) => r.id === m[1]) + 1 : 0;
    return n > 0 ? `Regla ${n}: ${msg}` : msg;
  });
  const spanReglas = algunaEdicion ? "" : "lg:col-span-2";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => router.push("/motor-riesgo")}>
        <IconArrowLeft width={15} height={15} />
        Retornar a la lista de grupos
      </Button>

      <div className="animate-fade-in flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
            Grupo de reglas <span className="font-mono">{registro.codigo}</span>
            {nuevo && " · nuevo"}
          </p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-ink-900">
            {borrador.nombre.trim() || "Grupo sin nombre"}
            {!nuevo && <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>}
          </h1>
          {!nuevo && (
            <p className="mt-1 text-sm text-ink-500">
              Vigencia: {textoVigenciaMotor(registro)} · {registro.reglas.length} regla
              {registro.reglas.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
        {/* Botones de navegación del formulario (v1 §6). */}
        <div className="flex flex-wrap gap-2">
          {editando ? (
            <>
              <Button variant="outline" onClick={cancelar}>
                Cancelar
              </Button>
              <Button onClick={grabar}>Grabar</Button>
            </>
          ) : (
            <>
              <Button onClick={() => setEditando(true)}>Modificar</Button>
              <Button variant="outline" onClick={() => router.push(`/motor-riesgo/nuevo?de=${registro.id}`)}>
                Copiar grupo
              </Button>
              {registro.estado === "ACTIVO" && (
                <Button variant="ghost" onClick={() => setPendiente("SUSPENDIDO")}>
                  Suspender
                </Button>
              )}
              {registro.estado === "SUSPENDIDO" && (
                <Button variant="ghost" onClick={() => aplicarEstado("ACTIVO")}>
                  Activar
                </Button>
              )}
              {registro.estado === "ELIMINADO" ? (
                <Button variant="ghost" onClick={() => aplicarEstado("SUSPENDIDO")}>
                  Restaurar
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => setPendiente("ELIMINADO")}>
                  Eliminar
                </Button>
              )}
            </>
          )}
          <Button variant="ghost" onClick={() => router.push("/motor-riesgo")}>
            Retornar
          </Button>
        </div>
      </div>

      {!nuevo && registro.estado !== "ACTIVO" && (
        <Banner tone="warning" title={registro.estado === "ELIMINADO" ? "Grupo eliminado" : "Grupo suspendido"} className="mt-4">
          No se evalúa: las solicitudes que lo tienen asignado usan el motor general.
        </Banner>
      )}
      {!nuevo && registro.estado === "ACTIVO" && vigencia !== "VIGENTE" && (
        <Banner tone="warning" title="Vencido — revisar" className="mt-4">
          {vigencia === "VENCIDO"
            ? `Venció el ${registro.vigenciaHasta}: el grupo dejó de estar disponible y las solicitudes usan el motor general.`
            : `Venció el plazo de ${registro.vigenciaDias} días desde la activación. Sigue evaluándose, pero lo tiene que revisar un líder de producto.`}
        </Banner>
      )}
      {guardado && !editando && (
        <Banner tone="success" className="mt-4">
          Cambios grabados. Ya rigen en la evaluación de las solicitudes de la demo.
        </Banner>
      )}

      <div className="mt-6 space-y-5">
        <Card>
          <CardHeader title="Cabecera" description="Identificación y vigencia del grupo." />
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-[6rem_minmax(0,1fr)]">
            <FormField id="motor-id" label="ID" value={borrador.codigo} onChange={() => {}} disabled hint="Automático" />
            <FormField
              id="motor-nombre"
              label="Descripción / Nombre"
              required
              value={borrador.nombre}
              onChange={(v) => editar((m) => ({ ...m, nombre: v }))}
              placeholder="Ej.: Motor empl. públicos Río Negro"
              disabled={!editando}
              error={ver("nombre")}
            />
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-sm font-medium text-ink-700">Vigencia</p>
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex rounded-lg border border-ink-200 bg-ink-50 p-0.5">
                  {(
                    [
                      ["SIN", "Sin vencimiento"],
                      ["DIAS", "En días"],
                      ["FECHA", "Por fecha"],
                    ] as const
                  ).map(([modo, label]) => (
                    <button
                      key={modo}
                      type="button"
                      disabled={!editando}
                      aria-pressed={modoVigencia === modo}
                      onClick={() =>
                        editar((m) => ({
                          ...m,
                          vigenciaDias: modo === "DIAS" ? (m.vigenciaDias ?? 180) : null,
                          vigenciaHasta: modo === "FECHA" ? (m.vigenciaHasta ?? "31/12/2026") : null,
                        }))
                      }
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${
                        modoVigencia === modo ? "bg-white text-ink-900 shadow-xs" : "text-ink-500 enabled:hover:text-ink-800"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {modoVigencia === "DIAS" && (
                  <FormField
                    id="motor-vigencia-dias"
                    label="Días desde la activación"
                    className="w-56"
                    inputMode="numeric"
                    value={String(borrador.vigenciaDias ?? "")}
                    onChange={(v) => editar((m) => ({ ...m, vigenciaDias: Number(v.replace(/\D/g, "")) || 0 }))}
                    disabled={!editando}
                    error={ver("vigencia")}
                    hint={`Activado el ${borrador.activadoEl} · vence ${vencimientoMotor(borrador) ?? "—"}. Vencido, lo revisa un líder de producto.`}
                  />
                )}
                {modoVigencia === "FECHA" && (
                  <FormField
                    id="motor-vigencia-fecha"
                    label="Fecha de vencimiento"
                    className="w-56"
                    value={borrador.vigenciaHasta ?? ""}
                    onChange={(v) => editar((m) => ({ ...m, vigenciaHasta: v }))}
                    placeholder="dd/mm/aaaa"
                    disabled={!editando}
                    error={ver("vigencia")}
                    hint="Desde ese día el grupo deja de estar disponible."
                  />
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Fuentes de variables"
            description="Habilitan las variables que pueden usar las reglas. El prefijo de 4 letras identifica su origen."
          />
          <div className="space-y-4 px-6 py-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {FUENTES.map((f) => (
                <Checkbox
                  key={f.id}
                  checked={borrador.fuentes.includes(f.id)}
                  disabled={!editando}
                  onChange={(v) =>
                    editar((m) => ({
                      ...m,
                      fuentes: v ? FUENTES.map((x) => x.id).filter((x) => x === f.id || m.fuentes.includes(x)) : m.fuentes.filter((x) => x !== f.id),
                    }))
                  }
                  label={`${f.label} (${f.id}-)`}
                  description={f.detalle}
                />
              ))}
            </div>
            {ver("fuentes") && <p className="text-sm text-danger-600">{ver("fuentes")}</p>}
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Variables disponibles</p>
                <BuscadorVariables valor={busquedaVariable} onChange={setBusquedaVariable} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {variablesFiltradas.map((v) => (
                  <Tooltip key={v.nombre} label={v.detalle} side="top">
                    <button
                      type="button"
                      disabled={!algunaEdicion || borrador.reglas.length === 0}
                      onClick={() => agregarVariable(v.nombre)}
                      className="rounded-md border border-ink-200 bg-ink-25 px-2 py-1 font-mono text-xs text-ink-700 transition enabled:hover:border-brand-300 enabled:hover:bg-brand-50 disabled:cursor-default"
                    >
                      {v.nombre}
                    </button>
                  </Tooltip>
                ))}
                {variablesFiltradas.length === 0 && (
                  <p className="text-sm text-ink-400">Ninguna variable coincide con la búsqueda.</p>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Reglas del grupo"
            description="Si la expresión es verdadera, la regla aplica su acción: Rechazar rechaza el crédito; Verificar lo marca para la revisión del analista."
            action={
              <Button size="sm" className="shrink-0 whitespace-nowrap" onClick={nuevaRegla}>
                <IconPlus width={14} height={14} />
                Nueva regla
              </Button>
            }
          />
          <div className={`grid grid-cols-1 gap-3 px-6 py-5 ${algunaEdicion ? "" : "lg:grid-cols-2"}`}>
            {borrador.reglas.length === 0 && (
              <p className={`rounded-lg border border-dashed px-4 py-6 text-center text-sm ${spanReglas} ${ver("reglas") ? "border-danger-300 text-danger-600" : "border-ink-200 text-ink-400"}`}>
                {ver("reglas") ?? "El grupo todavía no tiene reglas."}
              </p>
            )}
            {borrador.reglas.map((r, i) => (
              <ReglaEditor
                key={r.id}
                numero={i + 1}
                regla={r}
                fuentes={borrador.fuentes}
                editando={editando || reglasEditando.includes(r.id)}
                onEditar={() => setReglasEditando((ids) => [...ids, r.id])}
                pie={
                  !editando && reglasEditando.includes(r.id) ? (
                    <BarraGuardar
                      errores={intentado ? listaErrores : []}
                      onGuardar={grabar}
                      onCancelar={cancelar}
                    />
                  ) : undefined
                }
                errorNombre={ver(`regla-${r.id}-nombre`)}
                errorExpresion={
                  intentado || r.expresion.trim() ? errores[`regla-${r.id}-expresion`] : undefined
                }
                onChange={(c) => editarRegla(r.id, c)}
                onActivar={() => setReglaActiva(r.id)}
                onCopiar={() => {
                  const copiaId = nuevaReglaId(borrador.reglas);
                  setReglasEditando((ids) => [...ids, copiaId]);
                  editar((m) => {
                    const idx = m.reglas.findIndex((x) => x.id === r.id);
                    const copia = { ...r, id: copiaId, nombre: `${r.nombre} (copia)` };
                    return { ...m, reglas: [...m.reglas.slice(0, idx + 1), copia, ...m.reglas.slice(idx + 1)] };
                  });
                }}
                onEliminar={() => editar((m) => ({ ...m, reglas: m.reglas.filter((x) => x.id !== r.id) }))}
              />
            ))}
            {editando && borrador.reglas.length > 0 && (
              <BarraGuardar
                className={`border-t border-ink-100 pt-4 ${spanReglas}`}
                errores={intentado ? listaErrores : []}
                onGuardar={grabar}
                onCancelar={cancelar}
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Concatenación"
            description="Al terminar este grupo, la evaluación pasa automáticamente al grupo concatenado. Sin concatenación, termina con sus propias reglas."
          />
          <div className="space-y-4 px-6 py-5">
            <SelectField
              id="motor-concatenar"
              label="Concatenar con grupo"
              value={borrador.concatenarCon ?? ""}
              onChange={(v) => editar((m) => ({ ...m, concatenarCon: v || null }))}
              placeholder="Sin concatenación"
              options={opcionesConcatenar}
              disabled={!editando}
              error={intentado || borrador.concatenarCon ? errores.concatenarCon : undefined}
              className="max-w-md"
            />
            <ol className="flex flex-wrap items-center gap-2 text-sm">
              {cadena.map((g, i) => (
                <li key={g.id} className="flex items-center gap-2">
                  {i > 0 && <span className="text-ink-300">→</span>}
                  <span className={`rounded-lg border px-3 py-1.5 ${i === 0 ? "border-brand-200 bg-brand-50 text-brand-800" : "border-ink-200 bg-white text-ink-700"}`}>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-400">
                      Grupo {i + 1} · {g.reglas.length} regla{g.reglas.length === 1 ? "" : "s"}
                    </span>
                    {g.nombre.trim() || "Este grupo"}
                  </span>
                </li>
              ))}
              <li className="flex items-center gap-2">
                <span className="text-ink-300">→</span>
                <span className="rounded-lg bg-ink-100 px-3 py-1.5 font-medium text-ink-600">Evaluación completa</span>
              </li>
            </ol>
            {borrador.concatenarCon &&
              !errores.concatenarCon &&
              !motorDisponible(todos.find((m) => m.id === borrador.concatenarCon) ?? borrador) && (
                <p className="text-sm text-warning-700">
                  El grupo concatenado no está disponible (suspendido o vencido): la evaluación termina antes de él.
                </p>
              )}
          </div>
        </Card>

        {!nuevo && <Auditoria registro={registro} />}
      </div>

      <ConfirmationModal
        open={pendiente !== null && texto !== undefined}
        title={texto?.titulo ?? ""}
        descripcion={texto?.descripcion}
        rows={[
          { label: "Grupo", value: registro.nombre },
          { label: "ID", value: registro.codigo },
        ]}
        confirmLabel={texto?.boton ?? ""}
        cancelLabel="Volver"
        tone="danger"
        onConfirm={() => {
          if (pendiente) aplicarEstado(pendiente);
          setPendiente(null);
        }}
        onCancel={() => setPendiente(null)}
      />
    </div>
  );
}

// Último elemento de la expresión: variable, número, texto entre comillas u operador.
const RE_ULTIMO = /\s*(?:(?:CNET|BCRA|BURO)-[\p{L}\d_]+|\d+(?:\.\d+)?|"[^"]*"|AND|<=|>=|\S)\s*$/u;

function ReglaEditor({
  numero,
  regla,
  fuentes,
  editando,
  errorNombre,
  errorExpresion,
  onChange,
  onActivar,
  onEditar,
  pie,
  onCopiar,
  onEliminar,
}: {
  numero: number;
  regla: ReglaMotor;
  fuentes: MotorRiesgo["fuentes"];
  editando: boolean;
  errorNombre?: string;
  errorExpresion?: string;
  onChange: (c: Partial<ReglaMotor>) => void;
  onActivar: () => void;
  onEditar: () => void;
  pie?: React.ReactNode;
  onCopiar: () => void;
  onEliminar: () => void;
}) {
  const [variable, setVariable] = useState("");
  const [valor, setValor] = useState("");
  const [filtro, setFiltro] = useState("");
  const agregar = (pieza: string) =>
    onChange({ expresion: `${regla.expresion.trimEnd()} ${pieza}`.trimStart() });
  const accion = ACCIONES.find((a) => a.id === regla.accion)!;

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-xs" onFocusCapture={onActivar}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-500">Regla {numero}</p>
        {!editando && (
          <Button size="sm" variant="ghost" onClick={onEditar}>
            Editar regla
          </Button>
        )}
        {editando && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={onCopiar}>
              Copiar regla
            </Button>
            <Button size="sm" variant="ghost" onClick={onEliminar}>
              <IconTrash width={14} height={14} />
              Eliminar regla
            </Button>
          </div>
        )}
      </div>

      {editando ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <FormField
              id={`regla-${regla.id}-nombre`}
              label="Nombre"
              required
              value={regla.nombre}
              onChange={(v) => onChange({ nombre: v })}
              placeholder="Ej.: Morosos 30 días"
              error={errorNombre}
            />
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink-700">Acción</p>
              <div className="flex rounded-lg border border-ink-200 bg-ink-50 p-0.5">
                {ACCIONES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={regla.accion === a.id}
                    onClick={() => onChange({ accion: a.id })}
                    title={a.detalle}
                    className={`h-9 rounded-md px-3 text-sm font-medium transition ${
                      regla.accion === a.id
                        ? a.id === "RECHAZAR"
                          ? "bg-danger-600 text-white shadow-xs"
                          : "bg-warning-500 text-white shadow-xs"
                        : "text-ink-500 hover:text-ink-800"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor={`regla-${regla.id}-expresion`} className="mb-1.5 block text-sm font-medium text-ink-700">
              Expresión <span className="text-danger-500">*</span>
            </label>
            <input
              id={`regla-${regla.id}-expresion`}
              value={regla.expresion}
              onChange={(e) => onChange({ expresion: e.target.value })}
              placeholder="Ej.: CNET-días_atraso > 0 AND CNET-días_atraso < 30"
              spellCheck={false}
              aria-invalid={!!errorExpresion}
              className={`h-10 w-full rounded-lg border bg-white px-3 font-mono text-sm shadow-xs outline-none transition placeholder:font-sans placeholder:text-ink-400 ${
                errorExpresion
                  ? "border-danger-400 focus:ring-2 focus:ring-danger-100"
                  : "border-ink-300 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              }`}
            />
            {errorExpresion && <p className="mt-1.5 text-sm text-danger-600">{errorExpresion}</p>}
          </div>

          {/* Se arma seleccionando elementos en secuencia (v1 §3). */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-ink-25 p-2.5">
            <BuscadorVariables valor={filtro} onChange={setFiltro} compacto />
            <select
              value={variable}
              onChange={(e) => {
                if (e.target.value) agregar(e.target.value);
                setVariable("");
              }}
              aria-label="Agregar variable"
              className="h-8 rounded-lg border border-ink-300 bg-white px-2 font-mono text-xs text-ink-700"
            >
              <option value="">+ Variable…</option>
              {filtrarVariables(variablesDeFuentes(fuentes), filtro).map((v) => (
                <option key={v.nombre} value={v.nombre}>
                  {v.nombre}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-1">
              {OPERADORES.map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => agregar(op)}
                  aria-label={`Agregar operador ${op}`}
                  className="h-8 min-w-8 rounded-md border border-ink-200 bg-white px-2 font-mono text-xs font-semibold text-ink-700 transition hover:border-brand-300 hover:bg-brand-50"
                >
                  {op}
                </button>
              ))}
            </div>
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                const v = valor.trim();
                if (!v) return;
                agregar(/^\d+(\.\d+)?$/.test(v) ? v : `"${v.replace(/"/g, "")}"`);
                setValor("");
              }}
            >
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Valor"
                aria-label="Valor a agregar"
                className="h-8 w-28 rounded-lg border border-ink-300 bg-white px-2 text-xs"
              />
              <Button size="sm" variant="outline" type="submit">
                Agregar
              </Button>
            </form>
            <Button
              size="sm"
              variant="ghost"
              disabled={!regla.expresion.trim()}
              onClick={() => onChange({ expresion: regla.expresion.replace(RE_ULTIMO, "") })}
            >
              ⌫ Quitar último
            </Button>
          </div>
          {pie}
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="font-semibold text-ink-900">{regla.nombre || "Sin nombre"}</p>
          <code className="block rounded-lg bg-ink-25 px-3 py-2 font-mono text-sm text-ink-800">
            {regla.expresion || "—"}
          </code>
          <p className="text-sm text-ink-600">
            Acción:{" "}
            <StatusBadge tone={regla.accion === "RECHAZAR" ? "danger" : "warning"}>{accion.label}</StatusBadge>{" "}
            <span className="text-ink-500">{accion.detalle}</span>
          </p>
          <p className="text-xs text-ink-500">
            Creada: {textoFirma(regla.creada)} · Última modificación: {textoFirma(regla.modificada)}
          </p>
        </div>
      )}
    </div>
  );
}

// Errores que impiden grabar + Cancelar / Guardar regla, juntos para no salir de la regla.
function BarraGuardar({
  errores,
  onGuardar,
  onCancelar,
  className = "",
}: {
  errores: string[];
  onGuardar: () => void;
  onCancelar: () => void;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {errores.length > 0 && (
        <Banner
          tone="error"
          title={`Hay ${errores.length} error${errores.length === 1 ? "" : "es"} para corregir antes de grabar`}
        >
          <ul className="list-disc space-y-0.5 pl-5">
            {errores.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </Banner>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button onClick={onGuardar}>
          <IconCheckCircle width={15} height={15} />
          Guardar regla
        </Button>
      </div>
    </div>
  );
}

const textoFirma = (f?: FirmaMotor) => (f ? `${f.usuario} (${f.perfil}) · ${f.fecha}` : "sin registro");

function BuscadorVariables({
  valor,
  onChange,
  compacto = false,
}: {
  valor: string;
  onChange: (v: string) => void;
  compacto?: boolean;
}) {
  return (
    <div className={`relative ${compacto ? "w-40" : "w-full sm:w-64"}`}>
      <IconSearch
        width={13}
        height={13}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400"
      />
      <input
        type="search"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar variable…"
        aria-label="Buscar variable"
        className={`w-full rounded-lg border border-ink-300 bg-white pl-8 pr-2 text-xs outline-none transition placeholder:text-ink-400 hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${compacto ? "h-8" : "h-9"}`}
      />
    </div>
  );
}

// Auditoría (creditonet-119): quién creó y modificó el grupo y cada cambio de estado.
function Auditoria({ registro }: { registro: MotorRiesgo }) {
  const historial = [...(registro.historialEstados ?? [])].reverse();
  const fila = (etiqueta: string, f?: FirmaMotor) => (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm text-ink-800">{f ? `${f.usuario} (${f.perfil})` : "Sin registro"}</dd>
      {f && <dd className="text-xs text-ink-500">{f.fecha}</dd>}
    </div>
  );
  return (
    <Card>
      <CardHeader
        title="Auditoría"
        description="Quién creó y modificó el grupo y sus reglas, con fecha, y cada cambio de estado."
      />
      <div className="space-y-4 px-6 py-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          {fila("Creado por", registro.creado)}
          {fila("Última modificación", registro.modificado)}
        </dl>
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Historial de estados
          </p>
          {historial.length === 0 ? (
            <p className="text-sm text-ink-400">Sin cambios de estado registrados.</p>
          ) : (
            <ol className="divide-y divide-ink-100 rounded-xl border border-ink-200">
              {historial.map((c, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                  <span className="text-ink-500">{c.fecha}</span>
                  <span className="text-ink-800">
                    {c.anterior ? `${ESTADO_PRODUCTO_META[c.anterior].label} → ` : "Alta → "}
                    <strong>{ESTADO_PRODUCTO_META[c.estado].label}</strong>
                  </span>
                  <span className="text-ink-500">
                    por {c.usuario} ({c.perfil})
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Card>
  );
}
