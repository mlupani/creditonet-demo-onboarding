"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApplication } from "@/lib/application-context";
import { planOfrecible, type EstadoProducto } from "@/lib/config";
import { estadoVigencia, textoVigencia } from "@/lib/productos";
import {
  cambiarEstadoPlan,
  guardarPlan,
  usePlanes,
  validarPlan,
  type PlanAbm,
} from "@/lib/planes";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ESTADO_PRODUCTO_META } from "@/components/productos/ListaProductos";
import { SECCIONES_PLAN, SECCION_DE_ERROR_PLAN } from "./SeccionesPlan";
import { IconArrowLeft, IconCheckCircle, IconLoader } from "@/components/icons";

export const TEXTO_ACCION_PLAN: Partial<
  Record<EstadoProducto, { titulo: string; descripcion: string; boton: string }>
> = {
  SUSPENDIDO: {
    titulo: "¿Suspender el plan?",
    descripcion:
      "Deja de habilitar clientes: si el organismo no tiene otro plan que los admita, las solicitudes nuevas se rechazan por falta de línea. Las solicitudes ya evaluadas conservan su plan.",
    boton: "Suspender plan",
  },
  ELIMINADO: {
    titulo: "¿Eliminar el plan?",
    descripcion:
      "Deja de usarse y pasa a Eliminados. Se conserva para rotular las solicitudes históricas y se puede restaurar.",
    boton: "Eliminar plan",
  },
};

export function DetallePlan({ id }: { id: string }) {
  const router = useRouter();
  const { hidratado } = useApplication();
  const planes = usePlanes();
  const registro = planes.find((p) => p.config.id === id);

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
          <h1 className="text-xl font-bold tracking-tight text-ink-900">No existe el plan “{id}”</h1>
          <p className="mt-2 text-sm text-ink-500">Puede haber sido creado en otra sesión de la demo.</p>
          <div className="mt-6">
            <Button onClick={() => router.push("/planes")}>Volver a Planes de cuotas</Button>
          </div>
        </Card>
      </div>
    );
  }

  return <Editor key={id} registro={registro} todos={planes} />;
}

function Editor({ registro, todos }: { registro: PlanAbm; todos: PlanAbm[] }) {
  const router = useRouter();
  const [borrador, setBorrador] = useState<PlanAbm>(() => structuredClone(registro));
  const [seccion, setSeccion] = useState(SECCIONES_PLAN[0].id);
  const [intentado, setIntentado] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [pendiente, setPendiente] = useState<EstadoProducto | null>(null);

  const errores = validarPlan(borrador, todos);
  const seccionesConError = new Set(Object.keys(errores).map((k) => SECCION_DE_ERROR_PLAN[k]));
  const sucio = JSON.stringify(borrador) !== JSON.stringify(registro);
  const activa = SECCIONES_PLAN.find((s) => s.id === seccion) ?? SECCIONES_PLAN[0];
  const meta = ESTADO_PRODUCTO_META[registro.config.estado];
  const vigencia = estadoVigencia(registro.config);
  const cantErrores = Object.keys(errores).length;

  function editar(cambio: (p: PlanAbm) => PlanAbm) {
    setGuardado(false);
    setBorrador(cambio);
  }

  function guardar() {
    setIntentado(true);
    const primero = Object.keys(errores)[0];
    if (primero) {
      setSeccion(SECCION_DE_ERROR_PLAN[primero] ?? SECCIONES_PLAN[0].id);
      return;
    }
    guardarPlan(borrador);
    setGuardado(true);
    setIntentado(false);
  }

  function descartar() {
    setBorrador(structuredClone(registro));
    setIntentado(false);
  }

  // El estado se aplica directo: no forma parte de los cambios pendientes de guardar.
  function aplicarEstado(estado: EstadoProducto) {
    cambiarEstadoPlan(registro.config.id, estado);
    setBorrador((b) => ({ ...b, config: { ...b.config, estado } }));
  }

  function pedirEstado(estado: EstadoProducto) {
    if (estado === "ACTIVO" || registro.config.estado === "ELIMINADO") aplicarEstado(estado);
    else setPendiente(estado);
  }

  const texto = pendiente ? TEXTO_ACCION_PLAN[pendiente] : undefined;
  const SeccionActiva = activa.Componente;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-28 sm:px-6 lg:px-8">
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => router.push("/planes")}>
        <IconArrowLeft width={15} height={15} />
        Volver a Planes de cuotas
      </Button>

      <div className="animate-fade-in flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-600">
            Plan de cuotas <span className="font-mono">{registro.codigo}</span>
          </p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-ink-900">
            {registro.config.nombre}
            <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Prioridad {registro.config.prioridad} · Vigencia: {textoVigencia(registro.config)} ·{" "}
            {registro.organismos.length} organismo{registro.organismos.length === 1 ? "" : "s"}
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
          title={registro.config.estado === "ELIMINADO" ? "Plan eliminado" : "Plan suspendido"}
        >
          No habilita clientes nuevos. Las solicitudes ya evaluadas conservan su plan.
        </Banner>
      ) : (
        !planOfrecible(registro.config) && (
          <Banner
            tone="warning"
            title={vigencia === "VENCIDA" ? "Vigencia vencida" : "Vigencia por iniciar"}
          >
            El plan está activo, pero hoy queda fuera de su vigencia y no habilita clientes.
          </Banner>
        )
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[14.5rem_minmax(0,1fr)]">
        <nav aria-label="Secciones del plan" className="lg:sticky lg:top-20 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECCIONES_PLAN.map((s) => {
              const seleccionada = s.id === activa.id;
              const conError = intentado && seccionesConError.has(s.id);
              return (
                <li key={s.id} className="shrink-0">
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
          <p className="mt-3 hidden items-center gap-1.5 px-3 text-[11px] text-ink-400 lg:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Conectado al flujo
          </p>
        </nav>

        <div className="min-w-0">
          <SeccionActiva p={borrador} set={editar} errores={errores} ver={intentado} />
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
                  : "Tenés cambios sin guardar."}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm font-medium text-success-700">
                <IconCheckCircle width={16} height={16} />
                Cambios guardados. Ya rigen en la demo.
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
        open={pendiente !== null && texto !== undefined}
        title={texto?.titulo ?? ""}
        descripcion={texto?.descripcion}
        rows={[
          { label: "Plan", value: registro.config.nombre },
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
