"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApplication } from "@/lib/application-context";
import type { EstadoProductoAbm } from "@/lib/config";
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
import { ESTADO_PRODUCTO_ABM_META, TEXTO_ACCION } from "./ListaProductos";
import { SECCIONES, SECCION_DE_ERROR } from "./SeccionesProducto";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBell,
  IconBriefcase,
  IconCalendar,
  IconCheckCircle,
  IconClipboardPlus,
  IconCreditCard,
  IconFileText,
  IconLoader,
  IconSettings,
  IconShieldCheck,
  IconWallet,
} from "@/components/icons";
import { useSidebarColapsado } from "@/lib/sidebar-colapsado";
import { NavSecciones, type ItemNav } from "@/components/ui/NavSecciones";

const ICONOS_SECCION: Record<string, ItemNav["icon"]> = {
  datos: IconFileText,
  vencimientos: IconCalendar,
  opciones: IconSettings,
  gestion: IconBriefcase,
  financieros: IconWallet,
  cobro: IconCreditCard,
  punitorios: IconAlertTriangle,
  onboarding: IconClipboardPlus,
  motor: IconShieldCheck,
  notificaciones: IconBell,
};

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
  const sidebarColapsado = useSidebarColapsado();
  const [guardado, setGuardado] = useState(false);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<EstadoProductoAbm | null>(null);

  const errores = validarProducto(borrador, todos);
  const seccionesConError = new Set(Object.keys(errores).map((k) => SECCION_DE_ERROR[k]));
  const sucio = JSON.stringify(borrador) !== JSON.stringify(registro);
  const activa = SECCIONES.find((s) => s.id === seccion) ?? SECCIONES[0];
  const meta = ESTADO_PRODUCTO_ABM_META[registro.config.estado];
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
  function aplicarEstado(estado: EstadoProductoAbm) {
    const r = cambiarEstadoProducto(registro.config.id, estado);
    if (!r.ok) {
      setErrorEstado(r.error);
      return;
    }
    setErrorEstado(null);
    setBorrador((b) => ({ ...b, config: { ...b.config, estado } }));
  }

  function pedirEstado(estado: EstadoProductoAbm) {
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
            {vigencia !== "VIGENTE" && (
              <StatusBadge tone="warning">
                {vigencia === "VENCIDA" ? "Vencida" : "Por iniciar"}
              </StatusBadge>
            )}
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
          {(registro.config.estado === "SUSPENDIDO" || registro.config.estado === "BORRADOR") && (
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

      {(errorEstado ||
        registro.config.estado !== "ACTIVO" ||
        vigencia !== "VIGENTE") && (
        <div className="mt-4 space-y-3">
          {errorEstado && (
            <Banner tone="error" title="No se pudo activar el producto">
              {errorEstado}
            </Banner>
          )}
          {registro.config.estado === "BORRADOR" && (
            <Banner tone="warning" title="Producto en borrador">
              No se ofrece en Solicitar crédito. Para activarlo tiene que estar vinculado al menos a un
              organismo.
            </Banner>
          )}
          {(registro.config.estado === "SUSPENDIDO" || registro.config.estado === "ELIMINADO") && (
            <Banner
              tone="warning"
              title={
                registro.config.estado === "ELIMINADO" ? "Producto eliminado" : "Producto suspendido"
              }
            >
              No se ofrece en Solicitar crédito. Las solicitudes que ya lo usan conservan su
              configuración.
            </Banner>
          )}
          {vigencia !== "VIGENTE" && (
            <Banner
              tone="warning"
              title={vigencia === "VENCIDA" ? "Vigencia vencida" : "Vigencia por iniciar"}
            >
              {registro.config.estado === "ACTIVO"
                ? "El producto está activo, pero hoy queda fuera de su vigencia y no se ofrece."
                : "Hoy queda fuera de su vigencia: aunque se active, no se ofrecería hasta que entre en rango."}
            </Banner>
          )}
        </div>
      )}

      <NavSecciones
        ariaLabel="Secciones del producto"
        items={SECCIONES.map((s) => ({
          id: s.id,
          label: s.label,
          icon: ICONOS_SECCION[s.id],
          extra:
            intentado && seccionesConError.has(s.id) ? (
              <span className="block h-2 w-2 rounded-full bg-danger-500" title="Tiene errores" />
            ) : s.vivo ? (
              <span
                className="block h-1.5 w-1.5 rounded-full bg-brand-500"
                title="Conectado al flujo de la demo"
              />
            ) : null,
        }))}
        activa={activa.id}
        onSelect={setSeccion}
        ancho="14.5rem"
        leyenda={
          <p className="flex items-center gap-1.5 px-3 text-[11px] text-ink-400">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Conectado al flujo
          </p>
        }
      >
          <SeccionActiva p={borrador} set={editar} errores={errores} ver={intentado} />
      </NavSecciones>

      {(sucio || guardado) && (
        <div className={`fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white/95 backdrop-blur ${sidebarColapsado ? "lg:left-16" : "lg:left-64"}`}>
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
