"use client";

import {
  SISTEMAS_AMORTIZACION,
  normalizarAsignacion,
  type OverridesOrganismo,
} from "@/lib/config";
import { textoVigencia, type ProductoAbm } from "@/lib/productos";
import {
  EXTRAS_POR_SECCION,
  excepcionesPorSeccion,
  type SeccionOrganismo,
  type VistaOrganismo,
} from "@/lib/organismos";
import { aplicarProductoVirtual, productoVirtual } from "@/lib/organismo-virtual";
import { SECCIONES, type SeccionProps } from "@/components/productos/SeccionesProducto";
import { usePlanes } from "@/lib/planes";
import Link from "next/link";
import { formatARS } from "@/lib/format";
import { Banner } from "@/components/ui/Banner";
import { FormField } from "@/components/ui/FormField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { SelectField } from "@/components/ui/SelectField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Panel } from "@/components/productos/campos";
import { fechaAIso, isoAFecha } from "@/lib/format";
import { EditorMotor } from "@/components/productos/editores";
import { ESTADO_PRODUCTO_ABM_META } from "@/components/productos/ListaProductos";
import {
  BarraHerencia,
  FilaDatosFinancieros,
  FilaHerencia,
  FilaNotificaciones,
  MarcoExcepcion,
} from "./herencia";

export interface SeccionOrgProps {
  o: VistaOrganismo;
  // Producto cuyas excepciones se editan (y contra el que se compara).
  p: ProductoAbm;
  productos: ProductoAbm[];
  set: (cambio: (o: VistaOrganismo) => VistaOrganismo) => void;
  errores: Record<string, string>;
  // Los errores sólo se muestran después del primer intento de guardar.
  ver: boolean;
}

type Overrides = OverridesOrganismo;
type ConfigVista = VistaOrganismo["config"];

function useEditores(set: SeccionOrgProps["set"]) {
  return {
    cf: (patch: Partial<ConfigVista>) =>
      set((x) => ({ ...x, config: { ...x.config, ...patch } })),
    ov: (patch: Partial<Overrides>) =>
      set((x) => ({ ...x, config: { ...x.config, overrides: { ...x.config.overrides, ...patch } } })),
    quitarOv: (clave: keyof Overrides) =>
      set((x) => {
        const { [clave]: _quitada, ...resto } = x.config.overrides;
        void _quitada;
        return { ...x, config: { ...x.config, overrides: resto } };
      }),
  };
}

// Sección del organismo que es la misma pantalla del producto: se le pasa el producto con las
// excepciones aplicadas y lo que se cambia vuelve como excepción. Arriba, cuántas excepciones tiene
// la sección y "Volver a heredar" para descartarlas todas.
function espejo(Seccion: (props: SeccionProps) => React.ReactNode, id: SeccionOrganismo) {
  return function SeccionEspejo({ o, p, set, errores, ver }: SeccionOrgProps) {
    const virtual = productoVirtual(o, p);
    const setVirtual: SeccionProps["set"] = (cambio) =>
      set((x) => aplicarProductoVirtual(x, p, cambio(productoVirtual(x, p))));
    const cantidad = excepcionesPorSeccion({
      overrides: o.config.overrides,
      motor: o.config.motor,
      canales: o.config.canales,
      extras: o.excepciones,
    })[id];
    return (
      <div className="space-y-3">
        <BarraHerencia
          cantidad={cantidad}
          productoNombre={p.config.nombre}
          onQuitar={() => set((x) => sinExcepciones(x, id))}
        />
        <Seccion p={virtual} set={setVirtual} errores={errores} ver={ver} organismo />
      </div>
    );
  };
}

// Descarta las excepciones de una sección (el capital máximo y los campos quitados tienen su propia sección).
function sinExcepciones(x: VistaOrganismo, id: SeccionOrganismo): VistaOrganismo {
  const claves: readonly string[] =
    id === "onboarding"
      ? EXTRAS_POR_SECCION.operaciones
      : (EXTRAS_POR_SECCION as Record<string, readonly string[]>)[id] ?? [];
  const excepciones = Object.fromEntries(Object.entries(x.excepciones).filter(([k]) => !claves.includes(k)));
  const { capitalMaximo, camposQuitados } = x.config.overrides;
  const overrides =
    id === "onboarding"
      ? {
          ...(capitalMaximo !== undefined ? { capitalMaximo } : {}),
          ...(camposQuitados !== undefined ? { camposQuitados } : {}),
        }
      : x.config.overrides;
  return {
    ...x,
    excepciones,
    config: { ...x.config, overrides, canales: id === "cobro" ? null : x.config.canales },
  };
}

const NOTA_HERENCIA =
  "Cada fila muestra lo que define el producto de referencia. Una excepción pisa ese valor sólo para este organismo.";

// --- 1. Datos generales ---

function DatosGenerales({ o, productos, set, errores, ver }: SeccionOrgProps) {
  const { cf } = useEditores(set);
  const producto = productos.find((x) => x.config.id === o.config.productos[0]);
  return (
    <Panel
      titulo="Datos generales"
      descripcion="Identificación y vigencia del organismo: empleador o ente pagador."
      vivo
      nota="La vigencia puede ser distinta a la del producto, pero el “hasta” no puede superarla."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="o-codigo" label="ID" value={o.codigo} onChange={() => {}} disabled />
        <FormField
          id="o-nombre"
          label="Nombre"
          required
          value={o.config.nombre}
          onChange={(v) => cf({ nombre: v })}
          error={ver ? errores.nombre : undefined}
        />
      </div>
      <FormField
        id="o-detalle"
        label="Descripción"
        value={o.config.detalle ?? ""}
        onChange={(v) => cf({ detalle: v })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="o-vig-desde"
          label="Vigencia desde"
          type="date"
          required
          value={fechaAIso(o.config.vigenciaDesde)}
          onChange={(v) => cf({ vigenciaDesde: isoAFecha(v) })}
          error={ver ? errores.vigenciaDesde : undefined}
        />
        <FormField
          id="o-vig-hasta"
          label="Vigencia hasta"
          type="date"
          value={fechaAIso(o.config.vigenciaHasta)}
          onChange={(v) => cf({ vigenciaHasta: v ? isoAFecha(v) : null })}
          error={ver ? errores.vigenciaHasta : undefined}
          hint={
            producto
              ? `No puede superar al producto (vigencia del producto: ${textoVigencia(producto.config)}).`
              : "No puede superar al producto. Vacío: sin vencimiento."
          }
        />
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-ink-200 bg-ink-25 px-3 py-2.5">
        <span className="text-sm font-medium text-ink-700">Estado</span>
        <StatusBadge tone={ESTADO_PRODUCTO_ABM_META[o.config.estado].tone}>
          {ESTADO_PRODUCTO_ABM_META[o.config.estado].label}
        </StatusBadge>
        <span className="text-xs text-ink-500">
          Borrador, activo, suspendido o eliminado: se cambia con los botones del encabezado.
        </span>
      </div>
    </Panel>
  );
}

// --- 2. Producto habilitado ---

function Producto({ o, productos, set }: SeccionOrgProps) {
  const actual = o.config.productos[0] ?? "";
  // Los borradores también se vinculan acá: es la única forma de poder activarlos.
  const vinculable = (p: ProductoAbm) =>
    p.config.estado === "ACTIVO" || p.config.estado === "BORRADOR" || p.config.id === actual;
  // Cambiar de producto descarta las excepciones del anterior.
  const elegir = (id: string) =>
    set((x) => ({
      ...x,
      config: { ...x.config, productos: id ? [id] : [], overrides: {}, motor: null, canales: null },
      excepciones: {},
    }));
  return (
    <Panel
      titulo="Producto habilitado"
      descripcion="El producto que ofrece este organismo a su colectivo (Producto §5)."
      vivo
      nota="Un organismo ofrece un solo producto. Sólo se pueden vincular productos activos o en borrador (un borrador necesita al menos un organismo para activarse). Las excepciones se definen sobre este producto, en las secciones de abajo."
    >
      {!actual && (
        <Banner tone="warning" title="El organismo no ofrece ningún producto">
          Mientras no elijas uno, no se puede iniciar una solicitud con este organismo.
        </Banner>
      )}
      <SelectField
        id="o-producto"
        label="Producto"
        value={actual}
        placeholder="Elegí un producto…"
        onChange={elegir}
        options={productos.filter(vinculable).map((p) => ({
          value: p.config.id,
          label: `${p.config.nombre} · ${p.codigo} · ${ESTADO_PRODUCTO_ABM_META[p.config.estado].label}`,
        }))}
        hint={actual ? "Al cambiar de producto se descartan las excepciones del anterior." : undefined}
        className="sm:max-w-xl"
      />
    </Panel>
  );
}

// --- 3. Planes de cuotas ---

function Planes({ o }: SeccionOrgProps) {
  const planes = usePlanes();
  const vinculados = o.config.planes;
  const lista = planes
    .filter((p) => vinculados.includes(p.config.id))
    .sort(
      (a, b) =>
        a.config.prioridad - b.config.prioridad || a.config.nombre.localeCompare(b.config.nombre, "es")
    );
  return (
    <Panel
      titulo="Planes de cuotas"
      descripcion="Los planes asignados al organismo, sólo lectura: condiciones financieras, límites y grilla de tasas."
      vivo
      nota="Un organismo puede tener varios planes. Para cada solicitud se usa el primero, por prioridad, que habilita la condición laboral, la situación BCRA y el perfil interno del cliente. La asignación al organismo, la prioridad y la habilitación se definen en cada plan."
    >
      {vinculados.length === 0 && (
        <Banner tone="warning" title="El organismo no tiene planes de cuotas">
          Sin un plan que lo habilite, las solicitudes de este organismo se rechazan por falta de
          línea. Asigná el organismo desde el plan de cuotas.
        </Banner>
      )}
      <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200">
        {lista.map((p) => {
          const c = p.config;
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 basis-64">
                <p className="text-sm font-semibold text-ink-900">{c.nombre}</p>
                <p className="text-xs text-ink-500">
                  {`${p.codigo} · Prioridad ${c.prioridad} · ${
                    SISTEMAS_AMORTIZACION.find((x) => x.value === c.sistema)?.label.split(" (")[0]
                  } · ${c.condicionesLaborales.join(", ")}`}
                </p>
              </div>
              <StatusBadge tone={ESTADO_PRODUCTO_ABM_META[c.estado].tone}>
                {ESTADO_PRODUCTO_ABM_META[c.estado].label}
              </StatusBadge>
              <Link
                href={`/planes/${c.id}`}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                Abrir plan
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

// --- 4. Capital máximo (dato general del producto) ---

function Capital({ o, p, set, errores, ver }: SeccionOrgProps) {
  const { ov, quitarOv } = useEditores(set);
  const capital = o.config.overrides.capitalMaximo;
  return (
    <Panel
      titulo="Capital máximo"
      descripcion="Tope general antes de aplicar los límites del riesgo, del plan y del salario (Producto §4)."
      vivo
      nota={`${NOTA_HERENCIA} Cambia el flujo real.`}
    >
      <FilaHerencia
        etiqueta="Capital máximo"
        productoNombre={p.config.nombre}
        heredado={
          <span className="font-semibold tabular-nums">
            {p.config.capitalMaximo === null ? "Sin capital máximo" : formatARS(p.config.capitalMaximo)}
          </span>
        }
        error={ver ? errores.capitalMaximo : undefined}
        editor={
          capital !== undefined ? (
            <MoneyInput id="o-capital" label="" value={capital} onChange={(v) => ov({ capitalMaximo: v })} />
          ) : null
        }
        onCrear={() => ov({ capitalMaximo: p.config.capitalMaximo ?? 1_000_000 })}
        onQuitar={() => quitarOv("capitalMaximo")}
      />
    </Panel>
  );
}

// --- 5-6. Vencimientos y Opciones generales: las mismas pantallas del producto ---

const Vencimientos = espejo(SECCIONES.find((x) => x.id === "vencimientos")!.Componente, "vencimientos");
const Opciones = espejo(SECCIONES.find((x) => x.id === "opciones")!.Componente, "opciones");

// --- 7. Datos financieros ---

function Financieros({ o, p, set }: SeccionOrgProps) {
  return (
    <Panel
      titulo="Datos financieros"
      descripcion="Datos financieros que el onboarding le pide al cliente."
      nota={NOTA_HERENCIA}
    >
      <FilaDatosFinancieros o={o} p={p} set={set} />
    </Panel>
  );
}

// --- 8-9. Cobro y punitorios: las mismas pantallas del producto ---

const Cobro = espejo(SECCIONES.find((x) => x.id === "cobro")!.Componente, "cobro");
const Punitorios = espejo(SECCIONES.find((x) => x.id === "punitorios")!.Componente, "punitorios");

// --- 10. Configuración del onboarding ---

const Onboarding = espejo(SECCIONES.find((x) => x.id === "onboarding")!.Componente, "onboarding");

// --- 11. Motor de riesgo ---

function Motor({ o, p, set, errores, ver }: SeccionOrgProps) {
  const { cf } = useEditores(set);
  const motorOrg = o.config.motor;
  return (
    <Panel
      titulo="Motor de riesgo"
      descripcion="Qué grupo de reglas evalúa según el cliente."
      vivo
      nota="La tabla viene del producto. Si se cambia algo, el organismo pasa a tener su propia asignación y el motor usa sólo esa."
    >
      <MarcoExcepcion
        etiqueta="Asignación de motor"
        ayuda="Por tipo de cliente, condición laboral, situación BCRA y situación en buró interno."
        excepcion={motorOrg !== null}
        onQuitar={() => cf({ motor: null })}
      >
        <div className="mt-4">
          <EditorMotor
            idBase="o-motor"
            valor={motorOrg ?? p.config.motor}
            // Si vuelve a quedar igual a la del producto, deja de ser propia.
            onChange={(motor) =>
              cf({
                motor:
                  JSON.stringify(normalizarAsignacion(motor)) === JSON.stringify(normalizarAsignacion(p.config.motor))
                    ? null
                    : motor,
              })
            }
            error={errores.motor}
            mostrarError={ver}
          />
        </div>
      </MarcoExcepcion>
    </Panel>
  );
}

// --- 12. Notificaciones ---

function Notificaciones({ o, p, set }: SeccionOrgProps) {
  return (
    <Panel
      titulo="Notificaciones"
      descripcion="Notificaciones que envía el producto, elegidas del catálogo global."
      nota={NOTA_HERENCIA}
    >
      <FilaNotificaciones o={o} p={p} set={set} />
    </Panel>
  );
}

// --- Registro de secciones ---
//
// Las del producto siguen el orden y los nombres de SECCIONES (SeccionesProducto.tsx); "Capital
// máximo" es el dato general del producto que admite excepción.

export const SECCIONES_ORGANISMO: {
  id: string;
  label: string;
  // "organismo": datos del organismo. "producto": excepciones sobre el producto elegido.
  alcance: "organismo" | "producto";
  vivo: boolean;
  Componente: (props: SeccionOrgProps) => React.ReactNode;
}[] = [
  { id: "datos", alcance: "organismo", label: "Datos generales", vivo: true, Componente: DatosGenerales },
  { id: "producto", alcance: "organismo", label: "Producto habilitado", vivo: true, Componente: Producto },
  { id: "planes", alcance: "organismo", label: "Planes de cuotas", vivo: true, Componente: Planes },
  { id: "capital", alcance: "producto", label: "Capital máximo", vivo: true, Componente: Capital },
  { id: "vencimientos", alcance: "producto", label: "Vencimientos", vivo: false, Componente: Vencimientos },
  { id: "opciones", alcance: "producto", label: "Opciones generales", vivo: false, Componente: Opciones },
  { id: "financieros", alcance: "producto", label: "Datos financieros", vivo: false, Componente: Financieros },
  { id: "cobro", alcance: "producto", label: "Cobro, canales y vendedores", vivo: true, Componente: Cobro },
  { id: "punitorios", alcance: "producto", label: "Intereses punitorios", vivo: false, Componente: Punitorios },
  { id: "onboarding", alcance: "producto", label: "Configuración del onboarding", vivo: true, Componente: Onboarding },
  { id: "motor", alcance: "producto", label: "Motor de riesgo", vivo: true, Componente: Motor },
  { id: "notificaciones", alcance: "producto", label: "Notificaciones", vivo: false, Componente: Notificaciones },
];

// Sección donde se muestra cada error de validación.
export const SECCION_DE_ERROR_ORG: Record<string, string> = {
  nombre: "datos",
  vigenciaDesde: "datos",
  vigenciaHasta: "datos",
  capitalMaximo: "capital",
  referencias: "onboarding",
  garantes: "onboarding",
  tokenizacion: "onboarding",
  documentos: "onboarding",
  canales: "cobro",
  motor: "motor",
};
