"use client";

import {
  CANALES,
  SISTEMAS_AMORTIZACION,
  motorAsignado,
  type AsignacionMotor,
  type OverridesOrganismo,
} from "@/lib/config";
import { CAMPOS_POST_OFERTA, getCampo, obligatorioEfectivo } from "@/lib/campos-post-oferta";
import { getMotor } from "@/lib/motores";
import { PROVEEDORES_TOKENIZACION, RUBROS, getTipoDocumento } from "@/lib/parametros";
import {
  MODALIDADES_COBRO,
  MODALIDADES_FIRMA,
  MOVIMIENTOS_MES,
  TIPOS_VENCIMIENTO,
  type ProductoAbm,
} from "@/lib/productos";
import type { VistaOrganismo } from "@/lib/organismos";
import { usePlanes } from "@/lib/planes";
import Link from "next/link";
import { VENDEDORES } from "@/lib/config";
import { formatARS } from "@/lib/format";
import { Banner } from "@/components/ui/Banner";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { SelectField } from "@/components/ui/SelectField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CampoNumero, Panel, Subtitulo, fechaAIso, isoAFecha } from "@/components/productos/campos";
import { EditorDocumentos, EditorMotor } from "@/components/productos/editores";
import { ESTADO_PRODUCTO_META } from "@/components/productos/ListaProductos";
import { FilaExtra, FilaHerencia, Si, type CampoExtra } from "./herencia";

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

function DatosGenerales({ o, set, errores, ver }: SeccionOrgProps) {
  const { cf } = useEditores(set);
  const ex = (patch: Partial<VistaOrganismo["extras"]>) =>
    set((x) => ({ ...x, extras: { ...x.extras, ...patch } }));
  return (
    <Panel
      titulo="Datos generales"
      descripcion="Identificación del organismo: empleador o ente pagador."
      vivo
      nota="El nombre, la descripción y la condición laboral se usan en Solicitar crédito y en la selección del motor."
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
      <FormField
        id="o-condicion"
        label="Condición laboral del colectivo"
        value={o.config.condicionLaboral}
        onChange={(v) => cf({ condicionLaboral: v })}
        hint="Participa en la selección del motor (Motor §9)."
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
          hint="Vacío: sin vencimiento. Fuera de la vigencia el organismo no se ofrece."
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
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="o-cuit" label="CUIT" value={o.extras.cuit} onChange={(v) => ex({ cuit: v })} />
        <SelectField
          id="o-rubro"
          label="Rubro"
          value={o.extras.rubro}
          onChange={(v) => ex({ rubro: v })}
          options={RUBROS.map((r) => ({ value: r, label: r }))}
        />
        <FormField
          id="o-contacto"
          label="Contacto"
          value={o.extras.contactoNombre}
          onChange={(v) => ex({ contactoNombre: v })}
        />
        <FormField
          id="o-email"
          label="Email de contacto"
          type="email"
          value={o.extras.contactoEmail}
          onChange={(v) => ex({ contactoEmail: v })}
        />
        <CampoNumero
          id="o-corte"
          label="Día de corte de haberes"
          value={o.extras.diaCorteHaberes}
          min={1}
          onChange={(v) => ex({ diaCorteHaberes: v })}
          hint="Valor de ejemplo."
        />
      </div>
    </Panel>
  );
}

// --- 2. Productos habilitados ---

function Productos({ o, productos, set }: SeccionOrgProps) {
  const { cf } = useEditores(set);
  const habilitados = o.config.productos;
  return (
    <Panel
      titulo="Productos habilitados"
      descripcion="Qué productos ofrece este organismo a su colectivo (Producto §5)."
      vivo
      nota="Sólo se pueden vincular productos activos. Las excepciones se definen después, producto por producto."
    >
      {habilitados.length === 0 && (
        <Banner tone="warning" title="El organismo no ofrece ningún producto">
          Mientras no habilites al menos uno, no se puede iniciar una solicitud con este organismo.
        </Banner>
      )}
      <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200">
        {productos
          .filter((p) => p.config.estado === "ACTIVO" || habilitados.includes(p.config.id))
          .map((p) => (
            <li key={p.config.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 basis-56">
                <Checkbox
                  checked={habilitados.includes(p.config.id)}
                  disabled={p.config.estado !== "ACTIVO" && !habilitados.includes(p.config.id)}
                  onChange={(v) =>
                    cf({
                      productos: v
                        ? [...habilitados.filter((x) => x !== p.config.id), p.config.id]
                        : habilitados.filter((x) => x !== p.config.id),
                    })
                  }
                  label={p.config.nombre}
                  description={`${p.codigo} · ${p.extras.categoria}`}
                />
              </div>
              <StatusBadge tone={ESTADO_PRODUCTO_META[p.config.estado].tone}>
                {ESTADO_PRODUCTO_META[p.config.estado].label}
              </StatusBadge>
            </li>
          ))}
      </ul>
    </Panel>
  );
}

// --- 2 bis. Planes de cuotas ---

function Planes({ o, set }: SeccionOrgProps) {
  const planes = usePlanes();
  const { cf } = useEditores(set);
  const vinculados = o.config.planes;
  const lista = planes
    .filter((p) => p.config.estado === "ACTIVO" || vinculados.includes(p.config.id))
    .sort(
      (a, b) =>
        a.config.prioridad - b.config.prioridad || a.config.nombre.localeCompare(b.config.nombre, "es")
    );
  return (
    <Panel
      titulo="Planes de cuotas"
      descripcion="Los planes asignados al organismo: condiciones financieras, límites y grilla de tasas."
      vivo
      nota="Un organismo puede tener varios planes. Para cada solicitud se usa el primero, por prioridad, que habilita la condición laboral, la situación BCRA y el perfil interno del cliente. La prioridad y la habilitación se definen en cada plan."
    >
      {vinculados.length === 0 && (
        <Banner tone="warning" title="El organismo no tiene planes de cuotas">
          Sin un plan que lo habilite, las solicitudes de este organismo se rechazan por falta de
          línea.
        </Banner>
      )}
      <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200">
        {lista.map((p) => {
          const c = p.config;
          const activo = c.estado === "ACTIVO";
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 basis-64">
                <Checkbox
                  checked={vinculados.includes(c.id)}
                  disabled={!activo && !vinculados.includes(c.id)}
                  onChange={(v) =>
                    cf({
                      planes: v
                        ? [...vinculados.filter((x) => x !== c.id), c.id]
                        : vinculados.filter((x) => x !== c.id),
                    })
                  }
                  label={c.nombre}
                  description={`${p.codigo} · Prioridad ${c.prioridad} · ${
                    SISTEMAS_AMORTIZACION.find((x) => x.value === c.sistema)?.label.split(" (")[0]
                  } · ${c.condicionesLaborales.join(", ")}`}
                />
              </div>
              <StatusBadge tone={ESTADO_PRODUCTO_META[c.estado].tone}>
                {ESTADO_PRODUCTO_META[c.estado].label}
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

// --- 3. Excepciones de vencimiento ---

const CAMPOS_VENCIMIENTO: CampoExtra[] = [
  { clave: "diaCorte", etiqueta: "Día de corte del mes", tipo: "num" },
  { clave: "tipoVencimiento", etiqueta: "Vencimiento", tipo: "select", opciones: TIPOS_VENCIMIENTO },
  { clave: "diaVencimientoFijo", etiqueta: "Día fijo de vencimiento", tipo: "num" },
  { clave: "movimientoMes", etiqueta: "Movimiento por mes", tipo: "select", opciones: MOVIMIENTOS_MES },
  { clave: "diasValidezCondiciones", etiqueta: "Validez de las condiciones", tipo: "num", sufijo: "días" },
  { clave: "diasPlazoObservacion", etiqueta: "Plazo para corregir una observación", tipo: "num", sufijo: "días" },
];

function Vencimiento(props: SeccionOrgProps) {
  return (
    <Panel
      titulo="Excepciones de vencimiento"
      descripcion="Plazos particulares de este organismo frente a los del producto."
      nota={NOTA_HERENCIA}
    >
      <Filas campos={CAMPOS_VENCIMIENTO} {...props} />
    </Panel>
  );
}

// --- 4. Permisos / estados ---

const CAMPOS_PERMISOS: CampoExtra[] = [
  { clave: "permiteCreditosParalelos", etiqueta: "Producto en paralelo", tipo: "bool" },
  { clave: "visibleDashboard", etiqueta: "Visible en dashboard", tipo: "bool" },
  { clave: "seContabiliza", etiqueta: "Se contabiliza", tipo: "bool" },
  { clave: "centroCostos", etiqueta: "Centro de costos", tipo: "texto" },
  { clave: "gestionPrestamos", etiqueta: "Gestión de préstamos", tipo: "gestion" },
  { clave: "permiteRenovacion", etiqueta: "Renovación", tipo: "bool" },
  { clave: "cargoRenovacionPct", etiqueta: "Cargos de renovación", tipo: "num", sufijo: "%", step: 0.1 },
  { clave: "permiteCancelacionAnticipada", etiqueta: "Cancelación anticipada", tipo: "bool" },
  { clave: "cargoCancelacionPct", etiqueta: "Cargos de cancelación anticipada", tipo: "num", sufijo: "%", step: 0.1 },
  { clave: "permiteCambioPrimerVencimiento", etiqueta: "Cambio del primer vencimiento", tipo: "bool" },
];

function Permisos(props: SeccionOrgProps) {
  const { o, p, set, errores, ver } = props;
  const { ov, quitarOv } = useEditores(set);
  const ovs = o.config.overrides;
  const meta = ESTADO_PRODUCTO_META[o.config.estado];
  return (
    <Panel
      titulo="Permisos / estados"
      descripcion="Qué operaciones admite el organismo y en qué estado está."
      vivo
      nota={`${NOTA_HERENCIA} La deuda de terceros y el capital máximo cambian el flujo real.`}
    >
      <div className="flex items-center gap-3 rounded-xl border border-ink-200 bg-ink-25 px-4 py-3">
        <span className="text-sm text-ink-600">Estado del organismo</span>
        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
        <span className="text-xs text-ink-500">
          Se cambia con los botones del encabezado. Sólo un organismo activo se ofrece.
        </span>
      </div>

      <FilaHerencia
        etiqueta="Cancelación de deudas de terceros"
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
      <FilaHerencia
        etiqueta="Capital máximo"
        productoNombre={p.config.nombre}
        heredado={<span className="font-semibold tabular-nums">{formatARS(p.config.capitalMaximo)}</span>}
        error={ver ? errores.capitalMaximo : undefined}
        editor={
          ovs.capitalMaximo !== undefined ? (
            <MoneyInput
              id="o-capital"
              label=""
              value={ovs.capitalMaximo}
              onChange={(v) => ov({ capitalMaximo: v })}
            />
          ) : null
        }
        onCrear={() => ov({ capitalMaximo: p.config.capitalMaximo })}
        onQuitar={() => quitarOv("capitalMaximo")}
      />
      <Filas campos={CAMPOS_PERMISOS} {...props} />
    </Panel>
  );
}

// --- 5. Motor de riesgo ---

function describirAsignacion(a: AsignacionMotor | null): string {
  if (!a) return "Sin asignación propia";
  const partes = [a.motorId ? getMotor(a.motorId).nombre : "Sin motor general"];
  if (a.distingueTipoCliente)
    partes.push(
      `nuevo: ${a.porTipoCliente.NUEVO ? getMotor(a.porTipoCliente.NUEVO).nombre : "—"} · existente: ${
        a.porTipoCliente.EXISTENTE ? getMotor(a.porTipoCliente.EXISTENTE).nombre : "—"
      }`
    );
  const cond = Object.entries(a.porCondicionLaboral);
  if (cond.length > 0)
    partes.push(cond.map(([c, id]) => `${c}: ${getMotor(id).nombre}`).join(" · "));
  return partes.join(" · ");
}

function Motor({ o, p, productos, set }: SeccionOrgProps) {
  const { cf } = useEditores(set);
  const motorOrg = o.config.motor;
  const condicion = o.config.condicionLaboral;
  // El organismo pisa al producto: si su asignación aplica al cliente, manda.
  const efectivo = (prod: ProductoAbm, tipo: "NUEVO" | "EXISTENTE") => {
    const delOrg = motorOrg ? motorAsignado(motorOrg, condicion, tipo) : null;
    if (delOrg) return { id: delOrg, origen: "organismo" };
    const delProd = motorAsignado(prod.config.motor, condicion, tipo);
    if (delProd) return { id: delProd, origen: "producto" };
    return { id: "motor-general", origen: "motor general" };
  };
  const habilitados = productos.filter((x) => o.config.productos.includes(x.config.id));
  return (
    <Panel
      titulo="Motor de riesgo"
      descripcion="Grupo de reglas de este organismo (Producto §6)."
      vivo
      nota="El organismo puede pisar la asignación del producto: si define la suya y aplica al cliente, manda; si no, rige la del producto."
    >
      <FilaHerencia
        etiqueta="Asignación de motor"
        ayuda="Por tipo de cliente y condición laboral."
        productoNombre={p.config.nombre}
        heredado={describirAsignacion(p.config.motor)}
        editor={
          motorOrg ? (
            <EditorMotor
              idBase="o-motor"
              valor={motorOrg}
              onChange={(motor) => cf({ motor })}
              placeholderGeneral="Sin motor general propio"
            />
          ) : null
        }
        onCrear={() => cf({ motor: structuredClone(p.config.motor) })}
        onQuitar={() => cf({ motor: null })}
      />
      <div className="space-y-2">
        <Subtitulo>Motor que se aplica hoy, por producto</Subtitulo>
        {habilitados.length === 0 ? (
          <p className="text-sm text-ink-500">El organismo no tiene productos habilitados.</p>
        ) : (
          <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200">
            {habilitados.map((prod) => {
              const nuevo = efectivo(prod, "NUEVO");
              const existente = efectivo(prod, "EXISTENTE");
              return (
                <li key={prod.config.id} className="px-4 py-3">
                  <p className="text-sm font-semibold text-ink-900">{prod.config.nombre}</p>
                  <p className="text-xs text-ink-500">
                    Cliente nuevo: {getMotor(nuevo.id).nombre} ({nuevo.origen}) · Cliente existente:{" "}
                    {getMotor(existente.id).nombre} ({existente.origen})
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Panel>
  );
}

// --- 6. Datos financieros ---

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
      descripcion="Variables financieras que el organismo activa o desactiva."
      nota={NOTA_HERENCIA}
    >
      <Filas campos={CAMPOS_FINANCIEROS} {...props} />
    </Panel>
  );
}

// --- 7. Punitorios ---

const CAMPOS_PUNITORIOS: CampoExtra[] = [
  { clave: "tramosPunitorios", etiqueta: "Punitorios", ayuda: "Hasta 5 tramos de atraso.", tipo: "tramos" },
  { clave: "modificarCarteraActiva", etiqueta: "Modificar cartera activa", tipo: "bool" },
  { clave: "modalidadesCobro", etiqueta: "Modalidades de cobro", tipo: "multi", opciones: MODALIDADES_COBRO },
];

function Punitorios(props: SeccionOrgProps) {
  return (
    <Panel
      titulo="Punitorios"
      descripcion="Cómo se cobra el atraso en este organismo."
      nota={NOTA_HERENCIA}
    >
      <Filas campos={CAMPOS_PUNITORIOS} {...props} />
    </Panel>
  );
}

// --- 8. Formulario / legajo ---

function Formulario({ o, p, set }: SeccionOrgProps) {
  const { ov, quitarOv } = useEditores(set);
  const ovs = o.config.overrides;
  const docsProducto = p.config.onboarding.documentos;
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
  const disponibles = CAMPOS_POST_OFERTA.filter(
    (c) => c.origen !== "NO_MODIFICABLE" && ovs.camposObligatorios?.[c.plantilla ?? c.id] === undefined
  );

  return (
    <Panel
      titulo="Formulario / legajo"
      descripcion="Documentación propia y obligatoriedad de campos del formulario."
      vivo
      nota={`${NOTA_HERENCIA} El organismo puede reemplazar la lista de documentos del producto y volver obligatorio u opcional un campo.`}
    >
      <FilaHerencia
        etiqueta="Documentación del legajo"
        ayuda="Con excepción, esta lista reemplaza a la del producto."
        productoNombre={p.config.nombre}
        heredado={
          <ul className="space-y-0.5">
            {docsProducto.map((d) => (
              <li key={d.tipoId}>
                {getTipoDocumento(d.tipoId).nombre}
                <span className="text-xs text-ink-500">
                  {d.obligatorio ? " · obligatorio" : " · opcional"}
                  {d.multiple ? " · varias imágenes" : ""}
                </span>
              </li>
            ))}
          </ul>
        }
        editor={
          ovs.documentos ? (
            <EditorDocumentos docs={ovs.documentos} onChange={(documentos) => ov({ documentos })} />
          ) : null
        }
        onCrear={() => ov({ documentos: structuredClone(docsProducto) })}
        onQuitar={() => quitarOv("documentos")}
      />

      <div className="space-y-3">
        <Subtitulo>Campos obligatorios</Subtitulo>
        {camposEx.map(([id, valor]) => {
          const campo = getCampo(id);
          const base = campo
            ? obligatorioEfectivo(campo, p.config.onboarding.camposObligatorios)
            : false;
          return (
            <FilaHerencia
              key={id}
              etiqueta={campo?.label ?? id}
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
        <SelectField
          id="o-campo-nuevo"
          label="Agregar excepción sobre un campo"
          value=""
          placeholder="Elegí un campo del formulario…"
          onChange={(id) => {
            const c = getCampo(id);
            if (c) setCampo(id, !obligatorioEfectivo(c, p.config.onboarding.camposObligatorios));
          }}
          options={disponibles.map((c) => ({
            value: c.id,
            label: `${c.label} (${c.pantalla === "personales" ? "personales" : "laborales"})`,
          }))}
        />
      </div>
    </Panel>
  );
}

// --- 9. Onboarding ---

function Onboarding({ o, p, set, errores, ver }: SeccionOrgProps) {
  const { ov, quitarOv } = useEditores(set);
  const ovs = o.config.overrides;
  const ob = p.config.onboarding;
  const pantallas = [...ob.pantallas].sort((a, b) => a.orden - b.orden);

  const setPantalla = (id: string, patch: { visible?: boolean; obligatoria?: boolean }) =>
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

  return (
    <Panel
      titulo="Onboarding"
      descripcion="Pantallas de la carga post-oferta, cantidades y tokenización."
      vivo
      nota={`${NOTA_HERENCIA} Los cambios se reflejan en Solicitar crédito.`}
    >
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
        <Subtitulo>Pantallas</Subtitulo>
        {pantallas.map((s) => {
          const propio = ovs.pantallas?.[s.id];
          const visible = propio?.visible ?? s.visible;
          const obligatoria = propio?.obligatoria ?? s.obligatoria;
          return (
            <FilaHerencia
              key={s.id}
              etiqueta={s.label}
              productoNombre={p.config.nombre}
              heredado={
                <span>
                  Habilitada <Si valor={s.visible} /> · Obligatoria <Si valor={s.obligatoria} />
                </span>
              }
              editor={
                propio ? (
                  <div className="flex flex-wrap gap-5">
                    <Checkbox
                      checked={visible}
                      onChange={(v) => setPantalla(s.id, { visible: v })}
                      label="Habilitada"
                    />
                    <Checkbox
                      checked={obligatoria}
                      disabled={!visible}
                      onChange={(v) => setPantalla(s.id, { obligatoria: v })}
                      label="Obligatoria"
                    />
                  </div>
                ) : null
              }
              onCrear={() => setPantalla(s.id, { visible: s.visible, obligatoria: s.obligatoria })}
              onQuitar={() => quitarPantalla(s.id)}
            />
          );
        })}
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
          heredado={`Hasta ${ob.tokenizacion.maximoTarjetas} tarjeta${ob.tokenizacion.maximoTarjetas === 1 ? "" : "s"} · ${
            PROVEEDORES_TOKENIZACION.find((x) => x.id === ob.tokenizacion.proveedorId)?.nombre ?? ob.tokenizacion.proveedorId
          }`}
          editor={
            ovs.tokenizacion ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <CampoNumero
                  id="o-tok-max"
                  label="Máximo de tarjetas"
                  value={ovs.tokenizacion.maximoTarjetas ?? ob.tokenizacion.maximoTarjetas}
                  onChange={(v) => ov({ tokenizacion: { ...ovs.tokenizacion, maximoTarjetas: v } })}
                />
                <SelectField
                  id="o-tok-prov"
                  label="Proveedor"
                  value={ovs.tokenizacion.proveedorId ?? ob.tokenizacion.proveedorId}
                  onChange={(v) => ov({ tokenizacion: { ...ovs.tokenizacion, proveedorId: v } })}
                  options={PROVEEDORES_TOKENIZACION.map((x) => ({ value: x.id, label: x.nombre }))}
                />
              </div>
            ) : null
          }
          onCrear={() => ov({ tokenizacion: { ...ob.tokenizacion } })}
          onQuitar={() => quitarOv("tokenizacion")}
        />
      </div>
    </Panel>
  );
}

// --- 10. Firma ---

const CAMPOS_FIRMA: CampoExtra[] = [
  {
    clave: "modalidadFirma",
    etiqueta: "Modalidad de firma",
    ayuda: "Electrónica, física o ambas.",
    tipo: "select",
    opciones: MODALIDADES_FIRMA,
  },
];

function Firma(props: SeccionOrgProps) {
  return (
    <Panel
      titulo="Firma"
      descripcion="Requerimientos de firma de la operación."
      nota={NOTA_HERENCIA}
    >
      <Filas campos={CAMPOS_FIRMA} {...props} />
    </Panel>
  );
}

// --- 11. Canales ---

function Canales({ o, p, set, errores, ver }: SeccionOrgProps) {
  const { cf } = useEditores(set);
  const propios = o.config.canales;
  const nombres = (ids: string[]) =>
    ids.map((id) => CANALES.find((c) => c.id === id)?.nombre ?? id).join(", ") || "Ninguno";
  return (
    <Panel
      titulo="Canales"
      descripcion="En qué canales se ofrece el organismo."
      vivo
      nota="Con excepción, el producto sólo se ofrece en los canales que ambos habilitan."
    >
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
    </Panel>
  );
}

// --- 12. Vendedores ---

const CAMPOS_VENDEDORES: CampoExtra[] = [
  {
    clave: "vendedores",
    etiqueta: "Vendedores habilitados",
    tipo: "seleccion",
    opciones: VENDEDORES.map((v) => ({ value: v.id, label: v.nombre, detalle: v.detalle })),
  },
];

function Vendedores(props: SeccionOrgProps) {
  return (
    <Panel
      titulo="Vendedores"
      descripcion="Quiénes pueden vender a este organismo."
      nota={`${NOTA_HERENCIA} El vendedor real sale de la sesión.`}
    >
      <Filas campos={CAMPOS_VENDEDORES} {...props} />
    </Panel>
  );
}

// --- 13. Notificaciones ---

const CAMPOS_NOTIFICACIONES: CampoExtra[] = [
  { clave: "notificaciones", etiqueta: "Avisos al cliente", tipo: "notif" },
];

function Notificaciones(props: SeccionOrgProps) {
  return (
    <Panel
      titulo="Notificaciones"
      descripcion="Avisos automáticos a los clientes de este organismo."
      nota={NOTA_HERENCIA}
    >
      <Filas campos={CAMPOS_NOTIFICACIONES} {...props} />
    </Panel>
  );
}

// --- Registro de secciones ---

export const SECCIONES_ORGANISMO: {
  id: string;
  label: string;
  // "organismo": datos del organismo. "producto": excepciones sobre el producto elegido.
  alcance: "organismo" | "producto";
  vivo: boolean;
  Componente: (props: SeccionOrgProps) => React.ReactNode;
}[] = [
  { id: "datos", alcance: "organismo", label: "Datos generales", vivo: true, Componente: DatosGenerales },
  { id: "productos", alcance: "organismo", label: "Productos habilitados", vivo: true, Componente: Productos },
  { id: "planes", alcance: "organismo", label: "Planes de cuotas", vivo: true, Componente: Planes },
  { id: "vencimiento", alcance: "producto", label: "Excepciones de vencimiento", vivo: false, Componente: Vencimiento },
  { id: "permisos", alcance: "producto", label: "Permisos / estados", vivo: true, Componente: Permisos },
  { id: "motor", alcance: "producto", label: "Motor de riesgo", vivo: true, Componente: Motor },
  { id: "financieros", alcance: "producto", label: "Datos financieros", vivo: true, Componente: Financieros },
  { id: "punitorios", alcance: "producto", label: "Punitorios", vivo: false, Componente: Punitorios },
  { id: "formulario", alcance: "producto", label: "Formulario / legajo", vivo: true, Componente: Formulario },
  { id: "onboarding", alcance: "producto", label: "Onboarding", vivo: true, Componente: Onboarding },
  { id: "firma", alcance: "producto", label: "Firma", vivo: false, Componente: Firma },
  { id: "canales", alcance: "producto", label: "Canales", vivo: true, Componente: Canales },
  { id: "vendedores", alcance: "producto", label: "Vendedores", vivo: false, Componente: Vendedores },
  { id: "notificaciones", alcance: "producto", label: "Notificaciones", vivo: false, Componente: Notificaciones },
];

// Sección donde se muestra cada error de validación.
export const SECCION_DE_ERROR_ORG: Record<string, string> = {
  nombre: "datos",
  vigenciaDesde: "datos",
  vigenciaHasta: "datos",
  capitalMaximo: "permisos",
  referencias: "onboarding",
  garantes: "onboarding",
  canales: "canales",
};

