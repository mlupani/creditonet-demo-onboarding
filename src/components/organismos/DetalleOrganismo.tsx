"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApplication } from "@/lib/application-context";
import { SESION_SUPERVISOR, type EstadoProducto } from "@/lib/config";
import { estadoVigencia, textoVigencia, useProductos } from "@/lib/productos";
import {
  borradorDe,
  cambiarEstadoOrganismo,
  desdeVista,
  erroresDe,
  excepcionesPorSeccion,
  guardarOrganismo,
  rechazarExcepciones,
  refrendarExcepciones,
  totalExcepciones,
  totalExcepcionesProducto,
  productosConExcepciones,
  useOrganismos,
  validarOrganismo,
  vistaDe,
  type OrganismoAbm,
} from "@/lib/organismos";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ESTADO_PRODUCTO_META } from "@/components/productos/ListaProductos";
import { SECCIONES_ORGANISMO, SECCION_DE_ERROR_ORG } from "./SeccionesOrganismo";
import { IconArrowLeft, IconCheckCircle, IconLoader } from "@/components/icons";

export const TEXTO_ACCION_ORG: Partial<
  Record<EstadoProducto, { titulo: string; descripcion: string; boton: string }>
> = {
  SUSPENDIDO: {
    titulo: "¿Suspender el organismo?",
    descripcion:
      "Deja de ofrecerse en Solicitar crédito. Las solicitudes que ya lo usan conservan su configuración y podés activarlo de nuevo cuando quieras.",
    boton: "Suspender organismo",
  },
  ELIMINADO: {
    titulo: "¿Eliminar el organismo?",
    descripcion:
      "Deja de ofrecerse y pasa a Eliminados. Se conserva para rotular las solicitudes históricas y se puede restaurar.",
    boton: "Eliminar organismo",
  },
};

export function DetalleOrganismo({ id }: { id: string }) {
  const router = useRouter();
  const { hidratado } = useApplication();
  const organismos = useOrganismos();
  const registro = organismos.find((o) => o.config.id === id);

  if (!hidratado) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-ink-400">
        <IconLoader width={24} height={24} />
      </div>
    );
  }

  if (!registro) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-bold tracking-tight text-ink-900">
            No existe el organismo “{id}”
          </h1>
          <p className="mt-2 text-sm text-ink-500">Puede haber sido creado en otra sesión de la demo.</p>
          <div className="mt-6">
            <Button onClick={() => router.push("/organismos")}>Volver a Organismos</Button>
          </div>
        </Card>
      </div>
    );
  }

  return <Editor key={id} registro={registro} todos={organismos} />;
}

// Lo que cuenta para saber si hay cambios sin guardar (el orden de los productos no importa).
const claveDe = (o: OrganismoAbm) =>
  JSON.stringify({
    config: { ...o.config, productos: [...o.config.productos].sort() },
    extras: o.extras,
  });

function Editor({ registro, todos }: { registro: OrganismoAbm; todos: OrganismoAbm[] }) {
  const router = useRouter();
  const productos = useProductos();
  const [borrador, setBorrador] = useState<OrganismoAbm>(() => borradorDe(registro));
  const [seccion, setSeccion] = useState(SECCIONES_ORGANISMO[0].id);
  const [prodElegido, setProdElegido] = useState<string | null>(null);
  const [intentado, setIntentado] = useState(false);
  const [guardado, setGuardado] = useState<null | { pendiente: boolean }>(null);
  const [pendienteEstado, setPendienteEstado] = useState<EstadoProducto | null>(null);

  const errores = validarOrganismo(borrador, todos);
  const seccionesConError = new Set(
    Object.keys(errores).map((k) => SECCION_DE_ERROR_ORG[k.split("@")[0]])
  );
  const sucio = claveDe(borrador) !== claveDe(borradorDe(registro));
  const activa = SECCIONES_ORGANISMO.find((s) => s.id === seccion) ?? SECCIONES_ORGANISMO[0];
  const meta = ESTADO_PRODUCTO_META[registro.config.estado];
  const vigencia = estadoVigencia(registro.config);

  // Producto cuyas excepciones se editan: uno de los que el organismo habilita.
  const habilitados = productos.filter((p) => borrador.config.productos.includes(p.config.id));
  const referencia = habilitados.find((p) => p.config.id === prodElegido) ?? habilitados[0];
  const prodId = referencia?.config.id ?? "__ninguno__";
  const vista = vistaDe(borrador, prodId);
  const excProducto = borrador.config.excepciones[prodId];
  const porSeccion = excepcionesPorSeccion(
    excProducto ?? { overrides: {}, motor: null, canales: null, extras: {} }
  );
  const total = totalExcepciones(borrador);
  const conExcepciones = productosConExcepciones(borrador);

  function editar(cambio: (o: ReturnType<typeof vistaDe>) => ReturnType<typeof vistaDe>) {
    setGuardado(null);
    setBorrador((b) => desdeVista(b, prodId, cambio(vistaDe(b, prodId))));
  }

  function guardar() {
    setIntentado(true);
    const primero = Object.keys(errores)[0];
    if (primero) {
      const [campo, prod] = primero.split("@");
      if (prod) setProdElegido(prod);
      setSeccion(SECCION_DE_ERROR_ORG[campo] ?? SECCIONES_ORGANISMO[0].id);
      return;
    }
    const pendiente =
      JSON.stringify(borrador.config.excepciones) !== JSON.stringify(registro.config.excepciones);
    guardarOrganismo(borrador);
    setGuardado({ pendiente });
    setIntentado(false);
  }

  function descartar() {
    setBorrador(borradorDe(registro));
    setIntentado(false);
  }

  // El estado se aplica directo: no forma parte de los cambios pendientes de guardar.
  function aplicarEstado(estado: EstadoProducto) {
    cambiarEstadoOrganismo(registro.config.id, estado);
    setBorrador((b) => ({ ...b, config: { ...b.config, estado } }));
  }

  function pedirEstado(estado: EstadoProducto) {
    if (estado === "ACTIVO" || registro.config.estado === "ELIMINADO") aplicarEstado(estado);
    else setPendienteEstado(estado);
  }

  // Simulación del supervisor sobre las excepciones propuestas.
  function refrendar() {
    refrendarExcepciones(registro.config.id);
    setGuardado(null);
  }
  function rechazarPropuesta() {
    rechazarExcepciones(registro.config.id);
    setBorrador((b) => ({
      ...b,
      config: { ...b.config, excepciones: structuredClone(registro.config.excepciones) },
    }));
    setGuardado(null);
  }

  const texto = pendienteEstado ? TEXTO_ACCION_ORG[pendienteEstado] : undefined;
  const SeccionActiva = activa.Componente;
  const pend = registro.pendiente;
  const productosPendientes = pend
    ? Object.keys({ ...pend.excepciones, ...registro.config.excepciones }).filter(
        (id) =>
          JSON.stringify(pend.excepciones[id] ?? null) !==
          JSON.stringify(registro.config.excepciones[id] ?? null)
      ).length
    : 0;
  const cantErrores = Object.keys(errores).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-28 sm:px-6 lg:px-8">
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => router.push("/organismos")}>
        <IconArrowLeft width={15} height={15} />
        Volver a Organismos
      </Button>

      <div className="animate-fade-in flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-600">
            Organismo <span className="font-mono">{registro.codigo}</span>
          </p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-ink-900">
            {registro.config.nombre}
            <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {registro.config.detalle}
            {registro.config.detalle && " · "}
            {registro.config.productos.length} producto
            {registro.config.productos.length === 1 ? "" : "s"} · Vigencia:{" "}
            {textoVigencia(registro.config)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {registro.config.estado === "ACTIVO" && (
            <Button variant="outline" onClick={() => pedirEstado("SUSPENDIDO")}>
              Suspender
            </Button>
          )}
          {registro.config.estado === "SUSPENDIDO" && (
            <Button variant="outline" onClick={() => pedirEstado("ACTIVO")}>
              Activar
            </Button>
          )}
          {registro.config.estado === "ELIMINADO" ? (
            <Button variant="outline" onClick={() => pedirEstado("SUSPENDIDO")}>
              Restaurar
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => pedirEstado("ELIMINADO")}>
              Eliminar
            </Button>
          )}
        </div>
      </div>

      {registro.config.estado !== "ACTIVO" ? (
        <Banner
          tone="warning"
          title={registro.config.estado === "ELIMINADO" ? "Organismo eliminado" : "Organismo suspendido"}
        >
          No se ofrece en Solicitar crédito. Las solicitudes que ya lo usan conservan su
          configuración.
        </Banner>
      ) : (
        vigencia !== "VIGENTE" && (
          <Banner
            tone="warning"
            title={vigencia === "VENCIDA" ? "Vigencia vencida" : "Vigencia por iniciar"}
          >
            El organismo está activo, pero hoy queda fuera de su vigencia y no se ofrece.
          </Banner>
        )
      )}

      {pend && (
        <div className="mt-4 rounded-xl border border-warning-300 bg-warning-50 p-4">
          <p className="text-sm font-bold text-warning-700">
            Excepciones pendientes de refrendación del supervisor
          </p>
          <p className="mt-1 text-sm text-warning-700/90">
            {pend.solicitadoPor} propuso cambios en {productosPendientes} producto
            {productosPendientes === 1 ? "" : "s"} ({pend.fecha}). No rigen en el flujo hasta que
            las refrende {SESION_SUPERVISOR.nombre}.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="success" onClick={refrendar}>
              Refrendar como supervisor
            </Button>
            <Button size="sm" variant="outline" onClick={rechazarPropuesta}>
              Rechazar propuesta
            </Button>
            <span className="text-[11px] text-warning-700/80">
              Simulación de la demo: en producción lo hace el supervisor desde su sesión.
            </span>
          </div>
        </div>
      )}
      {!pend && registro.refrendada && (
        <p className="mt-3 text-xs text-ink-500">
          Últimas excepciones refrendadas por {registro.refrendada.por} · {registro.refrendada.fecha}
        </p>
      )}

      <Card className="mt-5">
        <div className="flex flex-wrap items-end justify-between gap-4 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900">Excepciones por producto</p>
            <p className="mt-0.5 max-w-xl text-sm text-ink-500">
              El organismo hereda cada producto por completo y sólo pisa lo que necesita, producto
              por producto. Elegí cuál editar.{" "}
              {total === 0 ? (
                "Hoy hereda el 100 % de la configuración."
              ) : (
                <>
                  <span className="font-semibold text-warning-700">
                    {total} {total === 1 ? "excepción" : "excepciones"}
                  </span>{" "}
                  definidas en {conExcepciones} de {borrador.config.productos.length} productos.
                </>
              )}
            </p>
          </div>
          {referencia && (
            <SelectField
              id="o-referencia"
              label="Producto"
              value={referencia.config.id}
              onChange={setProdElegido}
              options={habilitados.map((p) => {
                const n = totalExcepcionesProducto(borrador.config.excepciones[p.config.id]);
                return {
                  value: p.config.id,
                  label: `${p.config.nombre}${n > 0 ? ` · ${n} excepci${n === 1 ? "ón" : "ones"}` : ""}`,
                };
              })}
              className="w-full sm:w-80"
            />
          )}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <nav aria-label="Secciones del organismo" className="lg:sticky lg:top-20 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECCIONES_ORGANISMO.map((s, i) => {
              const seleccionada = s.id === activa.id;
              const conError = intentado && seccionesConError.has(s.id);
              const excepciones = porSeccion[s.id as keyof typeof porSeccion] ?? 0;
              const primeraDelProducto =
                s.alcance === "producto" && SECCIONES_ORGANISMO[i - 1]?.alcance === "organismo";
              return (
                <li key={s.id} className="shrink-0">
                  {i === 0 && (
                    <p className="hidden px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-ink-400 lg:block">
                      Del organismo
                    </p>
                  )}
                  {primeraDelProducto && (
                    <p className="hidden px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-ink-400 lg:block">
                      Sobre {referencia?.config.nombre ?? "el producto"}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setSeccion(s.id)}
                    aria-current={seleccionada ? "page" : undefined}
                    className={`flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                      seleccionada
                        ? "bg-brand-50 text-brand-700"
                        : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
                    }`}
                  >
                    <span className="flex-1">{s.label}</span>
                    {conError ? (
                      <span className="h-2 w-2 rounded-full bg-danger-500" title="Tiene errores" />
                    ) : excepciones > 0 ? (
                      <span
                        className="rounded-full bg-warning-100 px-1.5 text-[11px] font-bold tabular-nums text-warning-700"
                        title={`${excepciones} ${excepciones === 1 ? "excepción" : "excepciones"}`}
                      >
                        {excepciones}
                      </span>
                    ) : s.vivo ? (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-brand-500"
                        title="Conectado al flujo de la demo"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 hidden space-y-1 px-3 text-[11px] text-ink-400 lg:block">
            <p className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              Conectado al flujo
            </p>
            <p className="flex items-center gap-1.5">
              <span className="rounded-full bg-warning-100 px-1 text-[10px] font-bold text-warning-700">
                n
              </span>
              Excepciones sobre este producto
            </p>
          </div>
        </nav>

        <div className="min-w-0">
          {referencia || activa.alcance === "organismo" ? (
            <SeccionActiva
              o={vista}
              p={referencia ?? productos[0]}
              productos={productos}
              set={editar}
              errores={erroresDe(errores, prodId)}
              ver={intentado}
            />
          ) : (
            <Banner tone="warning" title="El organismo no tiene productos habilitados">
              Habilitá al menos un producto activo en “Productos habilitados” para poder definir
              excepciones sobre él.
            </Banner>
          )}
        </div>
      </div>

      {(sucio || guardado) && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white/95 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            {sucio ? (
              <p
                className={`text-sm font-medium ${
                  intentado && cantErrores > 0 ? "text-danger-600" : "text-ink-600"
                }`}
              >
                {intentado && cantErrores > 0
                  ? `Hay ${cantErrores} error${cantErrores === 1 ? "" : "es"} para corregir antes de guardar.`
                  : "Tenés cambios sin guardar. Las excepciones requieren la refrendación del supervisor."}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm font-medium text-success-700">
                <IconCheckCircle width={16} height={16} />
                {guardado?.pendiente
                  ? "Guardado. Las excepciones esperan la refrendación del supervisor."
                  : "Cambios guardados. Ya rigen en la demo."}
              </p>
            )}
            {sucio && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={descartar}>
                  Descartar
                </Button>
                <Button onClick={guardar}>Guardar cambios</Button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmationModal
        open={pendienteEstado !== null && texto !== undefined}
        title={texto?.titulo ?? ""}
        descripcion={texto?.descripcion}
        rows={[
          { label: "Organismo", value: registro.config.nombre },
          { label: "ID", value: registro.codigo },
        ]}
        confirmLabel={texto?.boton ?? ""}
        cancelLabel="Volver"
        tone="danger"
        onConfirm={() => {
          if (pendienteEstado) aplicarEstado(pendienteEstado);
          setPendienteEstado(null);
        }}
        onCancel={() => setPendienteEstado(null)}
      />
    </div>
  );
}
