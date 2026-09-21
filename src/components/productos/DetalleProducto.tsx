"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApplication } from "@/lib/application-context";
import type { EstadoProducto } from "@/lib/config";
import {
  cambiarEstadoProducto,
  estadoVigencia,
  guardarProducto,
  textoVigencia,
  useProductos,
  validarProducto,
  type ProductoAbm,
} from "@/lib/productos";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ESTADO_PRODUCTO_META, TEXTO_ACCION } from "./ListaProductos";
import { SECCIONES, SECCION_DE_ERROR } from "./SeccionesProducto";
import { IconArrowLeft, IconCheckCircle, IconLoader } from "@/components/icons";

export function DetalleProducto({ id }: { id: string }) {
  const router = useRouter();
  const { hidratado } = useApplication();
  const productos = useProductos();
  const registro = productos.find((p) => p.config.id === id);

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
            No existe el producto “{id}”
          </h1>
          <p className="mt-2 text-sm text-ink-500">Puede haber sido creado en otra sesión de la demo.</p>
          <div className="mt-6">
            <Button onClick={() => router.push("/productos")}>Volver a Productos</Button>
          </div>
        </Card>
      </div>
    );
  }

  return <Editor key={id} registro={registro} todos={productos} />;
}

function Editor({ registro, todos }: { registro: ProductoAbm; todos: ProductoAbm[] }) {
  const router = useRouter();
  const [borrador, setBorrador] = useState<ProductoAbm>(() => structuredClone(registro));
  const [seccion, setSeccion] = useState(SECCIONES[0].id);
  const [intentado, setIntentado] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [pendiente, setPendiente] = useState<EstadoProducto | null>(null);

  const errores = validarProducto(borrador, todos);
  const seccionesConError = new Set(Object.keys(errores).map((k) => SECCION_DE_ERROR[k]));
  const sucio = JSON.stringify(borrador) !== JSON.stringify(registro);
  const activa = SECCIONES.find((s) => s.id === seccion) ?? SECCIONES[0];
  const meta = ESTADO_PRODUCTO_META[registro.config.estado];
  const vigencia = estadoVigencia(registro.config);

  function editar(cambio: (p: ProductoAbm) => ProductoAbm) {
    setGuardado(false);
    setBorrador(cambio);
  }

  function guardar() {
    setIntentado(true);
    const primero = Object.keys(errores)[0];
    if (primero) {
      setSeccion(SECCION_DE_ERROR[primero] ?? SECCIONES[0].id);
      return;
    }
    guardarProducto(borrador);
    setGuardado(true);
    setIntentado(false);
  }

  function descartar() {
    setBorrador(structuredClone(registro));
    setIntentado(false);
  }

  // El estado se aplica directo: no forma parte de los cambios pendientes de guardar.
  function aplicarEstado(estado: EstadoProducto) {
    cambiarEstadoProducto(registro.config.id, estado);
    setBorrador((b) => ({ ...b, config: { ...b.config, estado } }));
  }

  function pedirEstado(estado: EstadoProducto) {
    if (estado === "ACTIVO" || registro.config.estado === "ELIMINADO") aplicarEstado(estado);
    else setPendiente(estado);
  }

  const texto = pendiente ? TEXTO_ACCION[pendiente] : undefined;
  const SeccionActiva = activa.Componente;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-28 sm:px-6 lg:px-8">
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => router.push("/productos")}>
        <IconArrowLeft width={15} height={15} />
        Volver a Productos
      </Button>

      <div className="animate-fade-in flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-600">
            Producto <span className="font-mono">{registro.codigo}</span>
          </p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-ink-900">
            {registro.config.nombre}
            <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {registro.extras.categoria} · Vigencia: {textoVigencia(registro.config)}
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
          title={registro.config.estado === "ELIMINADO" ? "Producto eliminado" : "Producto suspendido"}
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
            El producto está activo, pero hoy queda fuera de su vigencia y no se ofrece.
          </Banner>
        )
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[14.5rem_minmax(0,1fr)]">
        <nav aria-label="Secciones del producto" className="lg:sticky lg:top-20 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECCIONES.map((s) => {
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
                  intentado && Object.keys(errores).length > 0 ? "text-danger-600" : "text-ink-600"
                }`}
              >
                {intentado && Object.keys(errores).length > 0
                  ? `Hay ${Object.keys(errores).length} error${Object.keys(errores).length === 1 ? "" : "es"} para corregir antes de guardar.`
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
          { label: "Producto", value: registro.config.nombre },
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
