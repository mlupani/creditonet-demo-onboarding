"use client";

import {
  CANALES,
  SISTEMAS_AMORTIZACION,
  minimoDocumento,
  normalizarAsignacion,
  textoCombinacion,
  type AsignacionMotor,
  type OverridesOrganismo,
} from "@/lib/config";
import { CAMPOS_POST_OFERTA, getCampo } from "@/lib/campos-post-oferta";
import {
  TITULO_PANTALLA_CAMPOS,
  campoConfigurable,
  camposConfigurablesDe,
  esObligatorio,
} from "@/lib/campos-config";
import { getMotor } from "@/lib/motores";
import { tipoDeDocumento, nombreProveedor } from "@/lib/parametros";
import type { PantallaPostOfertaId } from "@/lib/types";
import {
  MODALIDADES_COBRO,
  CONDICIONES_RENOVACION,
  MODALIDADES_FIRMA,
  MOVIMIENTOS_MES,
  TIPOS_VENCIMIENTO,
  textoVigencia,
  vendedoresDeCanales,
  type ProductoAbm,
} from "@/lib/productos";
import type { VistaOrganismo } from "@/lib/organismos";
import { usePlanes } from "@/lib/planes";
import Link from "next/link";
import { formatARS } from "@/lib/format";
import { Banner } from "@/components/ui/Banner";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { SelectField } from "@/components/ui/SelectField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CampoNumero, Panel, Subtitulo } from "@/components/productos/campos";
import { fechaAIso, isoAFecha } from "@/lib/format";
import { EditorDocumentos, EditorTokenizacion, EditorMotor } from "@/components/productos/editores";
import { ESTADO_PRODUCTO_ABM_META, ESTADO_PRODUCTO_META } from "@/components/productos/ListaProductos";
import { FilaExtra, FilaHerencia, FilaSoloLectura, Si, type CampoExtra } from "./herencia";

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

const NOTA_HERENCIA =
  "Cada fila muestra lo que define el producto de referencia. Una excepción pisa ese valor sólo para este organismo.";

function Filas({ campos, o, p, set }: Pick<SeccionOrgProps, "o" | "p" | "set"> & { campos: CampoExtra[] }) {
  return (
    <div className="space-y-3">
      {campos.map((c) => (
        <FilaExtra key={c.clave} campo={c} o={o} p={p} set={set} />
      ))}
    </div>
  );
}

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
        <StatusBadge tone={ESTADO_PRODUCTO_META[o.config.estado].tone}>
          {ESTADO_PRODUCTO_META[o.config.estado].label}
        </StatusBadge>
        <span className="text-xs text-ink-500">
          Activo, suspendido o eliminado: se cambia con los botones del encabezado.
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

// --- 5. Vencimientos ---

const CAMPOS_VENCIMIENTOS: CampoExtra[] = [
  { clave: "diaCorte", etiqueta: "Día de corte del mes inclusive", tipo: "num" },
  {
    clave: "tipoVencimiento",
    etiqueta: "Vencimiento de la primer cuota",
    tipo: "select",
    opciones: TIPOS_VENCIMIENTO,
  },
  { clave: "diaVencimientoFijo", etiqueta: "Día fijo de vencimiento", tipo: "num" },
  { clave: "diasPrimerVencimiento", etiqueta: "Días hasta el vencimiento de la cuota 1", tipo: "num", sufijo: "días" },
  {
    clave: "movimientoMes",
    etiqueta: "Corrimiento del día del vencimiento de la cuota",
    tipo: "select",
    opciones: MOVIMIENTOS_MES,
  },
  { clave: "diasValidezCondiciones", etiqueta: "Plazo maximo para finalizacion de carga de onboarding (canal de venta)", tipo: "num", sufijo: "días hábiles (inclusive)" },
  { clave: "diasPlazoObservacion", etiqueta: "Plazo maximo dias habiles (inclusive) OBS / COFE", tipo: "num", sufijo: "días hábiles (inclusive)" },
];

function Vencimientos(props: SeccionOrgProps) {
  return (
    <Panel
      titulo="Vencimientos"
      descripcion="Día de corte y modalidad de vencimiento de las cuotas."
      nota={NOTA_HERENCIA}
    >
      <Filas campos={CAMPOS_VENCIMIENTOS} {...props} />
    </Panel>
  );
}

// --- 6. Opciones generales y Gestión de préstamos (sin excepción) ---

const CAMPOS_OPCIONES: CampoExtra[] = [
  { clave: "permiteCreditosParalelos", etiqueta: "Permite producto en paralelo", tipo: "bool" },
  { clave: "modalidadFirma", etiqueta: "Modalidad de firma", tipo: "select", opciones: MODALIDADES_FIRMA },
  { clave: "requiereChequeoTelefonico", etiqueta: "Requiere chequeo telefónico", tipo: "bool" },
  { clave: "seContabiliza", etiqueta: "Se contabiliza", tipo: "bool" },
  { clave: "centroCostos", etiqueta: "Centro de costos", tipo: "texto" },
  { clave: "visibleDashboard", etiqueta: "Visible en dashboard", tipo: "bool" },
];

const CLAVES_OPCIONES_CON_EXCEPCION = ["modalidadFirma", "requiereChequeoTelefonico"];

function Opciones({ o, p, set }: SeccionOrgProps) {
  return (
    <Panel
      titulo="Opciones generales"
      descripcion="Condiciones generales del producto."
      nota="La modalidad de firma y el chequeo telefónico admiten excepción por organismo. El resto rige igual para todos los organismos: no admite excepción."
    >
      <div className="space-y-3">
        {CAMPOS_OPCIONES.map((c) =>
          CLAVES_OPCIONES_CON_EXCEPCION.includes(c.clave) ? (
            <FilaExtra key={c.clave} campo={c} o={o} p={p} set={set} />
          ) : (
            <FilaSoloLectura key={c.clave} campo={c} p={p} />
          )
        )}
      </div>
    </Panel>
  );
}

const CAMPO_GESTION: CampoExtra = {
  clave: "gestionPrestamos",
  etiqueta: "Gestión de préstamos",
  ayuda: "Activar o desactivar la gestión y datos de quien gestiona la cartera.",
  tipo: "gestion",
};

function Gestion({ p }: SeccionOrgProps) {
  return (
    <Panel
      titulo="Gestión de préstamos"
      descripcion="Activar o desactivar la gestión y datos de quien gestiona la cartera."
      nota="Rige igual para todos los organismos: no admite excepción."
    >
      <FilaSoloLectura campo={CAMPO_GESTION} p={p} />
    </Panel>
  );
}

// --- 7. Datos financieros ---

const CAMPOS_FINANCIEROS: CampoExtra[] = [
  {
    clave: "recalculoNeto",
    etiqueta: "Recálculo del sueldo neto",
    ayuda: "Conceptos que intervienen en el recálculo.",
    tipo: "neto",
  },
];

function Financieros(props: SeccionOrgProps) {
  return (
    <Panel
      titulo="Datos financieros"
      descripcion="Conceptos que intervienen en el recálculo del sueldo neto."
      nota={NOTA_HERENCIA}
    >
      <Filas campos={CAMPOS_FINANCIEROS} {...props} />
    </Panel>
  );
}

// --- 8. Cobro, canales y vendedores ---

const CAMPOS_COBRO: CampoExtra[] = [
  {
    clave: "modalidadCobro",
    etiqueta: "Modalidad de cobro",
    tipo: "select",
    opciones: MODALIDADES_COBRO.map((m) => ({ value: m, label: m })),
  },
];

function Cobro(props: SeccionOrgProps) {
  const { o, p, set, errores, ver } = props;
  const { cf } = useEditores(set);
  const propios = o.config.canales;
  const nombres = (ids: string[]) =>
    ids.map((id) => CANALES.find((c) => c.id === id)?.nombre ?? id).join(", ") || "Ninguno";
  // Los vendedores que se ofrecen son los vinculados a los canales que rigen.
  const vendedores = vendedoresDeCanales(propios ?? p.config.canales);
  const campoVendedores: CampoExtra = {
    clave: "vendedores",
    etiqueta: "Vendedores habilitados",
    tipo: "seleccion",
    opciones: vendedores.map((v) => ({ value: v.id, label: v.nombre, detalle: v.detalle })),
  };
  return (
    <Panel
      titulo="Cobro, canales y vendedores"
      descripcion="Cómo se cobra, dónde se ofrece y quién lo vende."
      vivo
      nota={`${NOTA_HERENCIA} Con excepción de canales, el producto sólo se ofrece en los que ambos habilitan. El vendedor real sale de la sesión.`}
    >
      <Filas campos={CAMPOS_COBRO} o={o} p={p} set={set} />
      <FilaHerencia
        etiqueta="Canales habilitados"
        productoNombre={p.config.nombre}
        heredado={nombres(p.config.canales)}
        error={ver ? errores.canales : undefined}
        editor={
          propios ? (
            <div className="space-y-2">
              {CANALES.map((c) => (
                <Checkbox
                  key={c.id}
                  checked={propios.includes(c.id)}
                  onChange={(v) =>
                    cf({
                      canales: v
                        ? [...propios.filter((x) => x !== c.id), c.id]
                        : propios.filter((x) => x !== c.id),
                    })
                  }
                  label={c.nombre}
                  description={c.detalle}
                />
              ))}
            </div>
          ) : null
        }
        onCrear={() => cf({ canales: [...p.config.canales] })}
        onQuitar={() => cf({ canales: null })}
      />
      <Filas campos={[campoVendedores]} o={o} p={p} set={set} />
    </Panel>
  );
}

// --- 9. Intereses punitorios ---

const CAMPOS_PUNITORIOS: CampoExtra[] = [
  { clave: "tramosPunitorios", etiqueta: "Punitorios", ayuda: "Hasta 6 tramos de atraso.", tipo: "tramos" },
];

function Punitorios(props: SeccionOrgProps) {
  return (
    <Panel
      titulo="Intereses punitorios"
      descripcion="Hasta 6 tramos de atraso, cada uno con su porcentaje, gracia y tope."
      nota={NOTA_HERENCIA}
    >
      <Filas campos={CAMPOS_PUNITORIOS} {...props} />
    </Panel>
  );
}

// --- 10. Configuración del onboarding ---

const CAMPOS_OPERACIONES: CampoExtra[] = [
  { clave: "permiteRenovacion", etiqueta: "Permite renovación", tipo: "bool" },
  { clave: "condicionRenovacion", etiqueta: "Condición mínima para renovar", tipo: "select", opciones: CONDICIONES_RENOVACION },
  { clave: "renovacionMinPctPagado", etiqueta: "Porcentaje mínimo pagado para renovar", tipo: "num", sufijo: "%" },
  { clave: "renovacionMinCuotasPagas", etiqueta: "Cuotas pagadas mínimas para renovar", tipo: "num" },
  { clave: "permiteCancelacionAnticipada", etiqueta: "Permite cancelación anticipada", tipo: "bool" },
  { clave: "condicionCancelacion", etiqueta: "Condición mínima para cancelar", tipo: "select", opciones: CONDICIONES_RENOVACION },
  { clave: "cancelacionMinPctPagado", etiqueta: "Porcentaje mínimo pagado para cancelar", tipo: "num", sufijo: "%" },
  { clave: "cancelacionMinCuotasPagas", etiqueta: "Cuotas pagadas mínimas para cancelar", tipo: "num" },
  { clave: "permiteCambioPrimerVencimiento", etiqueta: "Permite cambio del primer vencimiento", tipo: "bool" },
  { clave: "permiteCorrimientoDesarrollo", etiqueta: "Permite corrimiento del desarrollo del préstamo", tipo: "bool" },
];

function Onboarding(props: SeccionOrgProps) {
  const { o, p, set, errores, ver } = props;
  const { ov, quitarOv } = useEditores(set);
  const ovs = o.config.overrides;
  const ob = p.config.onboarding;
  const pantallas = [...ob.pantallas].sort((a, b) => a.orden - b.orden);
  const docsProducto = ob.documentos;
  const baseObligatorios = ob.camposObligatorios;

  const setPantalla = (id: string, patch: { visible?: boolean }) =>
    ov({
      pantallas: {
        ...ovs.pantallas,
        [id]: { ...(ovs.pantallas?.[id as keyof typeof ovs.pantallas] ?? {}), ...patch },
      },
    });
  const quitarPantalla = (id: string) => {
    const { [id as keyof NonNullable<typeof ovs.pantallas>]: _q, ...resto } = ovs.pantallas ?? {};
    void _q;
    ov({ pantallas: resto });
  };

  const camposEx = Object.entries(ovs.camposObligatorios ?? {}).filter(
    (e): e is [string, boolean] => e[1] !== undefined
  );
  const setCampo = (id: string, valor: boolean) =>
    ov({ camposObligatorios: { ...ovs.camposObligatorios, [id]: valor } });
  const quitarCampo = (id: string) => {
    const { [id]: _quitado, ...resto } = ovs.camposObligatorios ?? {};
    void _quitado;
    ov({ camposObligatorios: resto });
  };
  // Campos de todas las pantallas del onboarding (los que exige el proveedor no se pueden relajar).
  const disponibles = (Object.keys(TITULO_PANTALLA_CAMPOS) as PantallaPostOfertaId[]).flatMap((pantalla) =>
    camposConfigurablesDe(pantalla)
      .filter((c) => !c.fijo && ovs.camposObligatorios?.[c.id] === undefined)
      .map((c) => ({ ...c, pantalla }))
  );

  return (
    <Panel
      titulo="Configuración del onboarding"
      descripcion="Pantallas, navegación, campos, legajo y permisos de operación (Producto §7 bis)."
      vivo
      nota={`${NOTA_HERENCIA} Los cambios se reflejan en Solicitar crédito.`}
    >
      <div className="space-y-3">
        <Subtitulo>Pantallas / solapas</Subtitulo>
        {pantallas.map((s) => {
          const propio = ovs.pantallas?.[s.id];
          const visible = propio?.visible ?? s.visible;
          return (
            <FilaHerencia
              key={s.id}
              etiqueta={s.label}
              productoNombre={p.config.nombre}
              heredado={
                <span>
                  Habilitada <Si valor={s.visible} />
                </span>
              }
              editor={
                propio ? (
                  <Checkbox
                    checked={visible}
                    onChange={(v) => setPantalla(s.id, { visible: v })}
                    label="Habilitada"
                    description="Una pantalla habilitada es obligatoria."
                  />
                ) : null
              }
              onCrear={() => setPantalla(s.id, { visible: s.visible })}
              onQuitar={() => quitarPantalla(s.id)}
            />
          );
        })}
      </div>

      <FilaHerencia
        etiqueta="Navegación entre pantallas"
        productoNombre={p.config.nombre}
        heredado={ob.navegacion === "LIBRE" ? "Libre: en cualquier orden" : "Secuencial"}
        editor={
          ovs.navegacion !== undefined ? (
            <SelectField
              id="o-navegacion"
              label=""
              value={ovs.navegacion}
              onChange={(v) => ov({ navegacion: v as "LIBRE" | "SECUENCIAL" })}
              options={[
                { value: "LIBRE", label: "Libre: en cualquier orden" },
                { value: "SECUENCIAL", label: "Secuencial" },
              ]}
            />
          ) : null
        }
        onCrear={() => ov({ navegacion: ob.navegacion })}
        onQuitar={() => quitarOv("navegacion")}
      />

      <div className="space-y-3">
        <Subtitulo>Campos obligatorios / opcionales</Subtitulo>
        {camposEx.map(([id, valor]) => {
          const encontrado = campoConfigurable(id);
          const base = encontrado ? esObligatorio(encontrado.campo, baseObligatorios) : false;
          return (
            <FilaHerencia
              key={id}
              etiqueta={
                encontrado
                  ? `${encontrado.campo.label} (${TITULO_PANTALLA_CAMPOS[encontrado.pantalla].toLowerCase()})`
                  : id
              }
              productoNombre={p.config.nombre}
              heredado={base ? "Obligatorio" : "Opcional"}
              editor={
                <Checkbox
                  checked={valor}
                  onChange={(v) => setCampo(id, v)}
                  label={valor ? "Obligatorio" : "Opcional"}
                />
              }
              onCrear={() => {}}
              onQuitar={() => quitarCampo(id)}
            />
          );
        })}
        <SelectField
          id="o-campo-nuevo"
          label="Agregar excepción sobre un campo"
          value=""
          placeholder="Elegí un campo del formulario…"
          onChange={(id) => {
            const c = campoConfigurable(id);
            if (c) setCampo(id, !esObligatorio(c.campo, baseObligatorios));
          }}
          options={disponibles.map((c) => ({
            value: c.id,
            label: `${c.label} (${TITULO_PANTALLA_CAMPOS[c.pantalla].toLowerCase()})`,
          }))}
        />
        <FilaHerencia
          etiqueta="Campos quitados del formulario"
          ayuda="Un campo quitado no se muestra ni se valida en la carga."
          productoNombre={p.config.nombre}
          heredado="Se muestran todos los campos"
          editor={
            ovs.camposQuitados ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {ovs.camposQuitados.length === 0 && (
                    <span className="text-xs text-ink-500">Todavía no se quitó ningún campo.</span>
                  )}
                  {ovs.camposQuitados.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        ov({ camposQuitados: (ovs.camposQuitados ?? []).filter((x) => x !== id) })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-warning-300 bg-white px-2.5 py-1 text-xs font-medium text-warning-700 hover:bg-warning-50"
                      aria-label={`Volver a mostrar ${getCampo(id)?.label ?? id}`}
                    >
                      {getCampo(id)?.label ?? id} ✕
                    </button>
                  ))}
                </div>
                <SelectField
                  id="o-campo-quitar"
                  label=""
                  value=""
                  placeholder="Quitar un campo…"
                  onChange={(id) =>
                    id && ov({ camposQuitados: [...(ovs.camposQuitados ?? []), id] })
                  }
                  options={CAMPOS_POST_OFERTA.filter(
                    (c) => c.origen !== "NO_MODIFICABLE" && !(ovs.camposQuitados ?? []).includes(c.id)
                  ).map((c) => ({
                    value: c.id,
                    label: `${c.label} (${c.pantalla === "personales" ? "personales" : "laborales"})`,
                  }))}
                />
              </div>
            ) : null
          }
          onCrear={() => ov({ camposQuitados: [] })}
          onQuitar={() => quitarOv("camposQuitados")}
        />
      </div>

      <div className="space-y-3">
        <Subtitulo>Referencias y garantes</Subtitulo>
        <FilaHerencia
          etiqueta="Referencias personales"
          productoNombre={p.config.nombre}
          heredado={`Mínimo ${ob.referencias.minimo} · máximo ${ob.referencias.maximo}`}
          error={ver ? errores.referencias : undefined}
          editor={
            ovs.referencias ? (
              <div className="grid grid-cols-2 gap-3">
                <CampoNumero
                  id="o-ref-min"
                  label="Mínimo"
                  value={ovs.referencias.minimo ?? ob.referencias.minimo}
                  onChange={(v) => ov({ referencias: { ...ovs.referencias, minimo: v } })}
                />
                <CampoNumero
                  id="o-ref-max"
                  label="Máximo"
                  value={ovs.referencias.maximo ?? ob.referencias.maximo}
                  onChange={(v) => ov({ referencias: { ...ovs.referencias, maximo: v } })}
                />
              </div>
            ) : null
          }
          onCrear={() => ov({ referencias: { ...ob.referencias } })}
          onQuitar={() => quitarOv("referencias")}
        />
        <FilaHerencia
          etiqueta="Garantes"
          productoNombre={p.config.nombre}
          heredado={`Mínimo ${ob.garantes.minimo} · máximo ${ob.garantes.maximo}`}
          error={ver ? errores.garantes : undefined}
          editor={
            ovs.garantes ? (
              <div className="grid grid-cols-2 gap-3">
                <CampoNumero
                  id="o-gar-min"
                  label="Mínimo"
                  value={ovs.garantes.minimo ?? ob.garantes.minimo}
                  onChange={(v) => ov({ garantes: { ...ovs.garantes, minimo: v } })}
                />
                <CampoNumero
                  id="o-gar-max"
                  label="Máximo"
                  value={ovs.garantes.maximo ?? ob.garantes.maximo}
                  onChange={(v) => ov({ garantes: { ...ovs.garantes, maximo: v } })}
                />
              </div>
            ) : null
          }
          onCrear={() => ov({ garantes: { ...ob.garantes } })}
          onQuitar={() => quitarOv("garantes")}
        />
      </div>

      <div className="space-y-3">
        <Subtitulo>Tokenización de tarjetas</Subtitulo>
        <FilaHerencia
          etiqueta="Tokenización"
          productoNombre={p.config.nombre}
          ayuda="Con excepción, esta lista de proveedores reemplaza a la del producto."
          heredado={
            ob.tokenizacion.proveedores.length === 0
              ? "Sin proveedores"
              : ob.tokenizacion.proveedores
                  .map(
                    (b) =>
                      `${nombreProveedor(b.proveedorId)}: mín. ${b.minimo} · máx. ${b.maximo}`
                  )
                  .join(" · ") + (ob.tokenizacion.obligatoria === false ? " · opcional" : "")
          }
          error={ver ? errores.tokenizacion : undefined}
          editor={
            ovs.tokenizacion ? (
              <div className="space-y-3">
                <Checkbox
                  checked={ovs.tokenizacion.obligatoria !== false}
                  onChange={(v) => ov({ tokenizacion: { ...ovs.tokenizacion!, obligatoria: v } })}
                  label="Tokenización obligatoria"
                  description="Si está deshabilitado, el cliente puede continuar sin tokenizar tarjeta."
                />
                <EditorTokenizacion
                  idBase="o-tok"
                  valor={ovs.tokenizacion}
                  onChange={(tokenizacion) => ov({ tokenizacion })}
                />
              </div>
            ) : null
          }
          onCrear={() => ov({ tokenizacion: structuredClone(ob.tokenizacion) })}
          onQuitar={() => quitarOv("tokenizacion")}
        />
      </div>

      <div className="space-y-3">
        <Subtitulo>Legajo</Subtitulo>
        <FilaHerencia
          etiqueta="Documentación del legajo"
          ayuda="Con excepción, esta lista reemplaza a la del producto."
          productoNombre={p.config.nombre}
          heredado={
            <ul className="space-y-0.5">
              {docsProducto.map((d) => (
                <li key={d.tipoId}>
                  {tipoDeDocumento(d).nombre}
                  <span className="text-xs text-ink-500">
                    {d.obligatorio ? " · obligatorio" : " · opcional"}
                    {` · ${d.obligatorio ? `mín. ${minimoDocumento(d)} · ` : ""}máx. ${d.maximo}`}
                  </span>
                </li>
              ))}
            </ul>
          }
          editor={
            ovs.documentos ? (
              <EditorDocumentos
                docs={ovs.documentos}
                onChange={(documentos) => ov({ documentos })}
                error={ver ? errores.documentos : undefined}
              />
            ) : null
          }
          onCrear={() => ov({ documentos: structuredClone(docsProducto) })}
          onQuitar={() => quitarOv("documentos")}
        />
      </div>

      <div className="space-y-3">
        <Subtitulo>Permisos de operación</Subtitulo>
        <Filas campos={CAMPOS_OPERACIONES} o={o} p={p} set={set} />
        <FilaHerencia
          etiqueta="Permite cancelar deudas de terceros"
          ayuda="Cambia el flujo real: habilita o no la cancelación de deudas con terceros en la oferta."
          productoNombre={p.config.nombre}
          heredado={<Si valor={p.config.permiteDeudaTerceros} />}
          editor={
            ovs.permiteDeudaTerceros !== undefined ? (
              <Checkbox
                checked={ovs.permiteDeudaTerceros}
                onChange={(v) => ov({ permiteDeudaTerceros: v })}
                label={ovs.permiteDeudaTerceros ? "Sí" : "No"}
              />
            ) : null
          }
          onCrear={() => ov({ permiteDeudaTerceros: p.config.permiteDeudaTerceros })}
          onQuitar={() => quitarOv("permiteDeudaTerceros")}
        />
      </div>
    </Panel>
  );
}

// --- 11. Motor de riesgo ---

function describirAsignacion(a: AsignacionMotor | null): string {
  if (!a) return "Sin asignación propia";
  const asignacion = normalizarAsignacion(a);
  const partes = [asignacion.motorId ? getMotor(asignacion.motorId).nombre : "Sin motor general"];
  if (asignacion.combinaciones.length > 0)
    partes.push(
      asignacion.combinaciones.map((c) => `${textoCombinacion(c)}: ${getMotor(c.motor).nombre}`).join(" · ")
    );
  return partes.join(" · ");
}

function Motor({ o, p, set, errores, ver }: SeccionOrgProps) {
  const { cf } = useEditores(set);
  const motorOrg = o.config.motor;
  return (
    <Panel
      titulo="Motor de riesgo"
      descripcion="Qué grupo de reglas evalúa según el cliente."
      vivo
      nota="El organismo puede pisar la asignación del producto: si define la suya y aplica al cliente, manda; si no, rige la del producto."
    >
      <FilaHerencia
        etiqueta="Asignación de motor"
        ayuda="Por tipo de cliente, condición laboral, situación BCRA y situación en buró interno."
        productoNombre={p.config.nombre}
        heredado={describirAsignacion(p.config.motor)}
        editor={
          motorOrg ? (
            <EditorMotor
              idBase="o-motor"
              valor={motorOrg}
              onChange={(motor) => cf({ motor })}
              placeholderGeneral="Sin motor general propio"
              error={errores.motor}
              mostrarError={ver}
            />
          ) : null
        }
        onCrear={() => cf({ motor: structuredClone(p.config.motor) })}
        onQuitar={() => cf({ motor: null })}
      />
    </Panel>
  );
}

// --- 12. Notificaciones ---

const CAMPOS_NOTIFICACIONES: CampoExtra[] = [
  { clave: "notificaciones", etiqueta: "Notificaciones", tipo: "notif" },
];

function Notificaciones(props: SeccionOrgProps) {
  return (
    <Panel
      titulo="Notificaciones"
      descripcion="Notificaciones que envía el producto, elegidas del catálogo global."
      nota={NOTA_HERENCIA}
    >
      <Filas campos={CAMPOS_NOTIFICACIONES} {...props} />
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
  { id: "gestion", alcance: "producto", label: "Gestión de préstamos", vivo: false, Componente: Gestion },
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
