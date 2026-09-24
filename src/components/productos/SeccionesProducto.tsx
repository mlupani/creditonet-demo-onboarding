"use client";

import { CANALES, ORGANISMOS, VENDEDORES, type ProductoConfig } from "@/lib/config";
import { CAMPOS_POST_OFERTA, obligatorioEfectivo } from "@/lib/campos-post-oferta";
import { PROVEEDORES_TOKENIZACION } from "@/lib/parametros";
import {
  CATEGORIAS_PRODUCTO,
  CONDICIONES_RENOVACION,
  MODALIDADES_COBRO,
  MODALIDADES_FIRMA,
  MOVIMIENTOS_MES,
  TIPOS_VENCIMIENTO,
  type ExtrasProducto,
  type ProductoAbm,
} from "@/lib/productos";
import { Banner } from "@/components/ui/Banner";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { MultiSelectField } from "@/components/ui/MultiSelectField";
import { SelectField } from "@/components/ui/SelectField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
import { CampoNumero, Panel, Subtitulo } from "./campos";
import { fechaAIso, isoAFecha } from "@/lib/format";
import {
  EditorDocumentos,
  EditorGestion,
  EditorMotor,
  EditorNotificaciones,
  EditorRecalculoNeto,
  EditorSeleccion,
  EditorTramos,
} from "./editores";
import { ESTADO_PRODUCTO_META } from "./ListaProductos";

export interface SeccionProps {
  p: ProductoAbm;
  set: (cambio: (p: ProductoAbm) => ProductoAbm) => void;
  errores: Record<string, string>;
  // Los errores sólo se muestran después del primer intento de guardar.
  ver: boolean;
}

// Atajos para editar la parte de config (la que lee el flujo) o la de ejemplo.
function useEditores(set: SeccionProps["set"]) {
  return {
    cf: (patch: Partial<ProductoConfig>) =>
      set((p) => ({ ...p, config: { ...p.config, ...patch } })),
    ex: (patch: Partial<ExtrasProducto>) => set((p) => ({ ...p, extras: { ...p.extras, ...patch } })),
  };
}

const alternar = (lista: string[], id: string, activo: boolean) =>
  activo ? [...lista.filter((x) => x !== id), id] : lista.filter((x) => x !== id);

function Grilla({ children, cols = 2 }: { children: React.ReactNode; cols?: 2 | 3 }) {
  return (
    <div className={`grid gap-4 ${cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>{children}</div>
  );
}

const NOTA_APLICA_ORGANISMOS =
  "Las reglas del producto se aplican a todos los organismos vinculados; cada organismo puede hacer excepciones.";

// --- 1. Datos generales ---

function DatosGenerales({ p, set, errores, ver }: SeccionProps) {
  const { cf, ex } = useEditores(set);
  const meta = ESTADO_PRODUCTO_META[p.config.estado];
  return (
    <Panel
      titulo="Datos generales"
      descripcion="Identificación, estado y vigencia del producto."
      vivo
      nota={NOTA_APLICA_ORGANISMOS}
    >
      <Grilla>
        <FormField
          id="p-codigo"
          label="ID"
          value={p.codigo}
          onChange={() => {}}
          disabled
          hint="Se asigna automáticamente."
        />
        <FormField
          id="p-nombre"
          label="Nombre"
          required
          value={p.config.nombre}
          onChange={(v) => cf({ nombre: v })}
          error={ver ? errores.nombre : undefined}
        />
      </Grilla>
      <FormField
        id="p-descripcion"
        label="Descripción"
        value={p.descripcion}
        onChange={(v) => set((x) => ({ ...x, descripcion: v }))}
      />
      <Grilla>
        <SelectField
          id="p-categoria"
          label="Tipo de producto"
          value={p.extras.categoria}
          onChange={(v) => ex({ categoria: v })}
          options={CATEGORIAS_PRODUCTO.map((c) => ({ value: c, label: c }))}
        />
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-700">Estado</p>
          <div className="flex items-center gap-3 rounded-lg border border-ink-200 bg-ink-25 px-3 py-2.5">
            <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
            <span className="text-xs text-ink-500">
              Activo, suspendido o eliminado: se cambia con los botones del encabezado.
            </span>
          </div>
        </div>
      </Grilla>
      <Grilla>
        <FormField
          id="p-vig-desde"
          label="Vigencia desde"
          type="date"
          required
          value={fechaAIso(p.config.vigenciaDesde)}
          onChange={(v) => cf({ vigenciaDesde: isoAFecha(v) })}
          error={ver ? errores.vigenciaDesde : undefined}
        />
        <FormField
          id="p-vig-hasta"
          label="Vigencia hasta"
          type="date"
          value={fechaAIso(p.config.vigenciaHasta)}
          onChange={(v) => cf({ vigenciaHasta: v ? isoAFecha(v) : null })}
          error={ver ? errores.vigenciaHasta : undefined}
          hint="Vacío: sin vencimiento. Fuera de la vigencia el producto no se ofrece."
        />
      </Grilla>
      <MoneyInput
        id="p-capital"
        label="Capital máximo"
        required
        value={p.config.capitalMaximo}
        onChange={(v) => cf({ capitalMaximo: v })}
        error={ver ? errores.capitalMaximo : undefined}
        hint="Tope general antes de aplicar los límites del riesgo, del plan y del salario (Producto §4)."
      />
    </Panel>
  );
}

// --- 2. Vencimientos ---

function Vencimientos({ p, set, errores, ver }: SeccionProps) {
  const { ex } = useEditores(set);
  return (
    <Panel
      titulo="Vencimientos"
      descripcion="Día de corte y modalidad de vencimiento de las cuotas."
      nota={`${NOTA_APLICA_ORGANISMOS} Valores de ejemplo: no alteran el cálculo de la demo.`}
    >
      <CampoNumero
        id="p-dia-corte"
        label="Día de corte del mes"
        min={1}
        value={p.extras.diaCorte}
        onChange={(v) => ex({ diaCorte: v })}
        error={ver ? errores.diaCorte : undefined}
        className="sm:max-w-xs"
      />
      <Grilla>
        <SelectField
          id="p-tipo-venc"
          label="Vencimiento"
          value={p.extras.tipoVencimiento}
          onChange={(v) => ex({ tipoVencimiento: v as ExtrasProducto["tipoVencimiento"] })}
          options={TIPOS_VENCIMIENTO}
        />
        {p.extras.tipoVencimiento === "FIJO" && (
          <CampoNumero
            id="p-dia-fijo"
            label="Día fijo de vencimiento"
            min={1}
            value={p.extras.diaVencimientoFijo}
            onChange={(v) => ex({ diaVencimientoFijo: v })}
            error={ver ? errores.diaVencimientoFijo : undefined}
          />
        )}
      </Grilla>
      <SelectField
        id="p-mov-mes"
        label="Movimiento por mes"
        value={p.extras.movimientoMes}
        onChange={(v) => ex({ movimientoMes: v as ExtrasProducto["movimientoMes"] })}
        options={MOVIMIENTOS_MES}
        hint="Supuesto a confirmar: cómo se mueve el vencimiento cuando no cae en un día hábil."
        className="sm:max-w-md"
      />
      <div className="space-y-3">
        <Subtitulo>Plazos del flujo</Subtitulo>
        <Grilla>
          <CampoNumero
            id="p-dias-condiciones"
            label="Validez de las condiciones"
            sufijo="días"
            value={p.extras.diasValidezCondiciones}
            onChange={(v) => ex({ diasValidezCondiciones: v })}
            hint="Desde que se presiona Solicitar."
          />
          <CampoNumero
            id="p-dias-observacion"
            label="Plazo para corregir una observación"
            sufijo="días"
            value={p.extras.diasPlazoObservacion}
            onChange={(v) => ex({ diasPlazoObservacion: v })}
          />
        </Grilla>
      </div>
    </Panel>
  );
}

// --- 3. Opciones generales ---

function Opciones({ p, set }: SeccionProps) {
  const { ex } = useEditores(set);
  return (
    <Panel
      titulo="Opciones generales"
      descripcion="Condiciones generales del producto."
      nota={`${NOTA_APLICA_ORGANISMOS} Valores de ejemplo.`}
    >
      <Checkbox
        checked={p.extras.permiteCreditosParalelos}
        onChange={(v) => ex({ permiteCreditosParalelos: v })}
        label="Permite producto en paralelo"
        description="El cliente puede tener este producto en más de un crédito a la vez."
      />
      <SelectField
        id="p-firma"
        label="Modalidad de firma"
        value={p.extras.modalidadFirma}
        onChange={(v) => ex({ modalidadFirma: v as ExtrasProducto["modalidadFirma"] })}
        options={MODALIDADES_FIRMA}
        className="sm:max-w-xs"
      />
      <Checkbox
        checked={p.extras.requiereChequeoTelefonico}
        onChange={(v) => ex({ requiereChequeoTelefonico: v })}
        label="Requiere chequeo telefónico"
        description="Después de la firma, el crédito pasa por chequeo telefónico antes de liquidarse."
      />
      <Checkbox
        checked={p.extras.seContabiliza}
        onChange={(v) => ex({ seContabiliza: v })}
        label="Se contabiliza"
        description="Al contabilizarse se imputa a un centro de costos."
      />
      {p.extras.seContabiliza && (
        <FormField
          id="p-centro-costos"
          label="Centro de costos"
          value={p.extras.centroCostos}
          onChange={(v) => ex({ centroCostos: v })}
          className="sm:max-w-md"
        />
      )}
      <Checkbox
        checked={p.extras.visibleDashboard}
        onChange={(v) => ex({ visibleDashboard: v })}
        label="Visible en dashboard"
      />
    </Panel>
  );
}

// --- 4. Gestión de préstamos ---

function Gestion({ p, set, errores, ver }: SeccionProps) {
  const { ex } = useEditores(set);
  return (
    <Panel
      titulo="Gestión de préstamos"
      descripcion="Activar o desactivar la gestión y datos de quien gestiona la cartera."
      nota={`${NOTA_APLICA_ORGANISMOS} Valores de ejemplo.`}
    >
      <EditorGestion
        idBase="p-gestion"
        valor={p.extras.gestionPrestamos}
        onChange={(v) => ex({ gestionPrestamos: v })}
        errores={
          ver ? { razonSocial: errores.gestionRazonSocial, cuit: errores.gestionCuit } : undefined
        }
      />
    </Panel>
  );
}

// --- 5. Datos financieros ---

function Financieros({ p, set }: SeccionProps) {
  const { ex } = useEditores(set);
  return (
    <Panel
      titulo="Datos financieros"
      descripcion="Conceptos que intervienen en el recálculo del sueldo neto."
      nota={`${NOTA_APLICA_ORGANISMOS} Hoy estos datos se cargan en el onboarding como información adicional, pero no recalculan el neto en la demo. La cuota la calcula el Plan de cuotas (Producto §10).`}
    >
      <EditorRecalculoNeto valor={p.extras.recalculoNeto} onChange={(v) => ex({ recalculoNeto: v })} />
    </Panel>
  );
}

// --- 6. Modalidades de cobro, canales y vendedores ---

function Cobro({ p, set, errores, ver }: SeccionProps) {
  const { ex } = useEditores(set);
  return (
    <Panel
      titulo="Modalidades de cobro, canales y vendedores"
      descripcion="Cómo se cobra, dónde se ofrece y quién lo vende."
      vivo
      nota="Los canales y los organismos deciden dónde aparece el producto en Solicitar crédito. Las modalidades y los vendedores son de ejemplo: el vendedor real sale de la sesión."
    >
      <MultiSelectField
        id="p-cobro"
        label="Modalidades de cobro habilitadas (desde Parámetros)"
        values={p.extras.modalidadesCobro}
        onChange={(v) => ex({ modalidadesCobro: v })}
        options={MODALIDADES_COBRO}
      />

      <div className="space-y-3">
        <Subtitulo>Canales habilitados</Subtitulo>
        <EditorSeleccion
          opciones={CANALES.map((c) => ({ value: c.id, label: c.nombre, detalle: c.detalle }))}
          valor={{ todos: p.extras.canalesTodos, ids: p.config.canales }}
          onChange={(v) => {
            set((x) => ({
              ...x,
              config: { ...x.config, canales: v.ids },
              extras: { ...x.extras, canalesTodos: v.todos },
            }));
          }}
        />
        {ver && errores.canales && <ValidationMessage tipo="error">{errores.canales}</ValidationMessage>}
      </div>

      <div className="space-y-3">
        <Subtitulo>Vendedores habilitados</Subtitulo>
        <EditorSeleccion
          opciones={VENDEDORES.map((v) => ({ value: v.id, label: v.nombre, detalle: v.detalle }))}
          valor={p.extras.vendedores}
          onChange={(v) => ex({ vendedores: v })}
        />
      </div>

      <div className="space-y-3">
        <Subtitulo>Organismos que lo ofrecen</Subtitulo>
        {p.organismos.length === 0 && (
          <Banner tone="warning" title="No se ofrece en ningún organismo">
            Mientras no lo habilites en al menos un organismo, no aparece en Solicitar crédito.
          </Banner>
        )}
        {ORGANISMOS.map((o) => (
          <Checkbox
            key={o.id}
            checked={p.organismos.includes(o.id)}
            onChange={(v) => set((x) => ({ ...x, organismos: alternar(x.organismos, o.id, v) }))}
            label={o.nombre}
            description={o.detalle}
          />
        ))}
      </div>
    </Panel>
  );
}

// --- 7. Intereses punitorios ---

function Punitorios({ p, set, errores, ver }: SeccionProps) {
  const { ex } = useEditores(set);
  return (
    <Panel
      titulo="Intereses punitorios"
      descripcion="Hasta 5 tramos de atraso, cada uno con su porcentaje, gracia y tope."
      nota={`${NOTA_APLICA_ORGANISMOS} Valores de ejemplo.`}
    >
      {ver && errores.tramos && <ValidationMessage tipo="error">{errores.tramos}</ValidationMessage>}
      <EditorTramos
        idBase="p-tramo"
        tramos={p.extras.tramosPunitorios}
        onChange={(v) => ex({ tramosPunitorios: v })}
      />
      <Checkbox
        checked={p.extras.modificarCarteraActiva}
        onChange={(v) => ex({ modificarCarteraActiva: v })}
        label="Modificar cartera activa"
        description="Aplica el cambio de punitorios desde el primer mes en curso, también a los créditos ya activos."
      />
    </Panel>
  );
}

// --- 8. Configuración del onboarding ---

const NAVEGACIONES = [
  { value: "LIBRE", label: "Libre: en cualquier orden" },
  { value: "SECUENCIAL", label: "Secuencial: no se avanza sin completar las obligatorias anteriores" },
];

function Onboarding({ p, set, errores, ver }: SeccionProps) {
  const { cf, ex } = useEditores(set);
  const ob = p.config.onboarding;
  const setOb = (patch: Partial<typeof ob>) => cf({ onboarding: { ...ob, ...patch } });
  const pantallas = [...ob.pantallas].sort((a, b) => a.orden - b.orden);

  function cambiarPantalla(id: string, patch: Partial<(typeof ob.pantallas)[number]>) {
    setOb({ pantallas: ob.pantallas.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  }

  // Mover intercambia el orden con la pantalla vecina.
  function mover(id: string, delta: -1 | 1) {
    const i = pantallas.findIndex((s) => s.id === id);
    const otra = pantallas[i + delta];
    if (!otra) return;
    setOb({
      pantallas: ob.pantallas.map((s) =>
        s.id === id ? { ...s, orden: otra.orden } : s.id === otra.id ? { ...s, orden: pantallas[i].orden } : s
      ),
    });
  }

  function cambiarCampo(id: string, obligatorio: boolean, porDefecto: boolean) {
    const mapa = { ...ob.camposObligatorios };
    if (obligatorio === porDefecto) delete mapa[id];
    else mapa[id] = obligatorio;
    setOb({ camposObligatorios: mapa });
  }

  return (
    <Panel
      titulo="Configuración del onboarding"
      descripcion="Pantallas P1 a P7, navegación, campos y permisos de operación (Producto §7 bis)."
      vivo
      nota={`${NOTA_APLICA_ORGANISMOS} Los cambios se reflejan en Solicitar crédito.`}
    >
      <div className="space-y-3">
        <Subtitulo>Pantallas / solapas</Subtitulo>
        {ver && errores.pantallas && (
          <ValidationMessage tipo="error">{errores.pantallas}</ValidationMessage>
        )}
        <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200">
          {pantallas.map((s, i) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => mover(s.id, -1)}
                    disabled={i === 0}
                    aria-label={`Subir ${s.label}`}
                    className="h-4 text-xs leading-none text-ink-400 hover:text-ink-800 disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(s.id, 1)}
                    disabled={i === pantallas.length - 1}
                    aria-label={`Bajar ${s.label}`}
                    className="h-4 text-xs leading-none text-ink-400 hover:text-ink-800 disabled:opacity-30"
                  >
                    ▼
                  </button>
                </div>
                <span className="w-7 text-center text-xs font-bold tabular-nums text-ink-400">
                  P{i + 1}
                </span>
              </div>
              <div className="min-w-0 flex-1 basis-56">
                <p className="text-sm font-semibold text-ink-900">{s.label}</p>
                <p className="text-xs text-ink-500">{s.descripcion}</p>
              </div>
              <div className="flex gap-5">
                <Checkbox
                  checked={s.visible}
                  onChange={(v) => cambiarPantalla(s.id, { visible: v })}
                  label="Habilitada"
                />
                <Checkbox
                  checked={s.obligatoria}
                  disabled={!s.visible}
                  onChange={(v) => cambiarPantalla(s.id, { obligatoria: v })}
                  label="Obligatoria"
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <SelectField
        id="p-navegacion"
        label="Navegación entre pantallas"
        value={ob.navegacion}
        onChange={(v) => setOb({ navegacion: v as typeof ob.navegacion })}
        options={NAVEGACIONES}
      />

      <div className="space-y-3">
        <Subtitulo>Campos obligatorios / opcionales</Subtitulo>
        <p className="text-xs text-ink-500">
          Marcado = obligatorio. Sólo se guardan los campos que se apartan del valor por defecto.
        </p>
        {(["personales", "laboral"] as const).map((pantalla) => {
          const campos = CAMPOS_POST_OFERTA.filter(
            (c) => c.pantalla === pantalla && c.origen !== "NO_MODIFICABLE"
          );
          return (
            <details key={pantalla} className="rounded-xl border border-ink-200 bg-white">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-ink-800">
                {pantalla === "personales" ? "Datos personales" : "Datos laborales"} ·{" "}
                {campos.length} campos
              </summary>
              <div className="grid gap-x-6 gap-y-3 border-t border-ink-100 px-4 py-4 sm:grid-cols-2">
                {campos.map((c) => (
                  <Checkbox
                    key={c.id}
                    checked={obligatorioEfectivo(c, ob.camposObligatorios)}
                    onChange={(v) => cambiarCampo(c.id, v, c.obligatorio)}
                    label={c.label}
                  />
                ))}
              </div>
            </details>
          );
        })}
      </div>

      <div className="space-y-3">
        <Subtitulo>Referencias, garantes y tokenización</Subtitulo>
        <Grilla>
          <CampoNumero
            id="p-ref-min"
            label="Referencias · mínimo"
            value={ob.referencias.minimo}
            onChange={(v) => setOb({ referencias: { ...ob.referencias, minimo: v } })}
            error={ver ? errores.referencias : undefined}
          />
          <CampoNumero
            id="p-ref-max"
            label="Referencias · máximo"
            value={ob.referencias.maximo}
            onChange={(v) => setOb({ referencias: { ...ob.referencias, maximo: v } })}
          />
          <CampoNumero
            id="p-gar-min"
            label="Garantes · mínimo"
            value={ob.garantes.minimo}
            onChange={(v) => setOb({ garantes: { ...ob.garantes, minimo: v } })}
            error={ver ? errores.garantes : undefined}
          />
          <CampoNumero
            id="p-gar-max"
            label="Garantes · máximo"
            value={ob.garantes.maximo}
            onChange={(v) => setOb({ garantes: { ...ob.garantes, maximo: v } })}
          />
          <CampoNumero
            id="p-tok-max"
            label="Tarjetas tokenizadas · máximo"
            value={ob.tokenizacion.maximoTarjetas}
            onChange={(v) => setOb({ tokenizacion: { ...ob.tokenizacion, maximoTarjetas: v } })}
            error={ver ? errores.tokenizacion : undefined}
          />
          <SelectField
            id="p-tok-proveedor"
            label="Proveedor de tokenización"
            value={ob.tokenizacion.proveedorId}
            onChange={(v) => setOb({ tokenizacion: { ...ob.tokenizacion, proveedorId: v } })}
            options={PROVEEDORES_TOKENIZACION.map((x) => ({ value: x.id, label: x.nombre }))}
          />
        </Grilla>
      </div>

      <div className="space-y-4">
        <Subtitulo>Permisos de operación</Subtitulo>
        <Checkbox
          checked={p.extras.permiteRenovacion}
          onChange={(v) => ex({ permiteRenovacion: v })}
          label="Permite renovación"
          description="La renovación cobra cargos de renovación."
        />
        {p.extras.permiteRenovacion && (
          <CampoNumero
            id="p-cargo-renov"
            label="Cargos de renovación"
            sufijo="%"
            step={0.1}
            value={p.extras.cargoRenovacionPct}
            onChange={(v) => ex({ cargoRenovacionPct: v })}
            className="sm:max-w-xs"
          />
        )}
        {p.extras.permiteRenovacion && (
          <Grilla>
            <SelectField
              id="p-cond-renov"
              label="Condición mínima para renovar"
              value={p.extras.condicionRenovacion}
              onChange={(v) => ex({ condicionRenovacion: v as ExtrasProducto["condicionRenovacion"] })}
              options={CONDICIONES_RENOVACION}
            />
            {p.extras.condicionRenovacion === "CUOTAS" ? (
              <CampoNumero
                id="p-renov-min-cuotas"
                label="Cuotas pagadas mínimas"
                min={1}
                value={p.extras.renovacionMinCuotasPagas}
                onChange={(v) => ex({ renovacionMinCuotasPagas: v })}
                error={ver ? errores.renovacionMinCuotasPagas : undefined}
              />
            ) : (
              <CampoNumero
                id="p-renov-min-pct"
                label="Porcentaje mínimo pagado"
                sufijo="%"
                min={0}
                value={p.extras.renovacionMinPctPagado}
                onChange={(v) => ex({ renovacionMinPctPagado: v })}
                error={ver ? errores.renovacionMinPctPagado : undefined}
              />
            )}
          </Grilla>
        )}
        <Checkbox
          checked={p.extras.permiteCancelacionAnticipada}
          onChange={(v) => ex({ permiteCancelacionAnticipada: v })}
          label="Permite cancelación anticipada"
          description="La cancelación anticipada cobra cargos."
        />
        {p.extras.permiteCancelacionAnticipada && (
          <CampoNumero
            id="p-cargo-cancel"
            label="Cargos de cancelación anticipada"
            sufijo="%"
            step={0.1}
            value={p.extras.cargoCancelacionPct}
            onChange={(v) => ex({ cargoCancelacionPct: v })}
            className="sm:max-w-xs"
          />
        )}
        <Checkbox
          checked={p.extras.permiteCambioPrimerVencimiento}
          onChange={(v) => ex({ permiteCambioPrimerVencimiento: v })}
          label="Permite cambio del primer vencimiento"
        />
        <Checkbox
          checked={p.config.permiteDeudaTerceros}
          onChange={(v) => cf({ permiteDeudaTerceros: v })}
          label="Permite cancelar deudas de terceros"
          description="Cambia el flujo real: habilita o no la cancelación de deudas con terceros en la oferta."
        />
      </div>
    </Panel>
  );
}

// --- 9. Legajo ---

function Legajo({ p, set }: SeccionProps) {
  const { cf } = useEditores(set);
  const ob = p.config.onboarding;
  return (
    <Panel
      titulo="Legajo"
      descripcion="Documentos que forman el legajo virtual, obligatoriedad y carga múltiple (Producto §7 bis)."
      vivo
      nota="El organismo puede reemplazar esta lista con su propia documentación."
    >
      <EditorDocumentos
        docs={ob.documentos}
        onChange={(documentos) => cf({ onboarding: { ...ob, documentos } })}
      />
    </Panel>
  );
}

// --- 10. Motor de riesgo ---

function Motor({ p, set }: SeccionProps) {
  const { cf } = useEditores(set);
  return (
    <Panel
      titulo="Motor de riesgo"
      descripcion="Qué grupo de reglas evalúa según el cliente (Producto §6)."
      vivo
      nota="El producto no ejecuta reglas de riesgo: sólo indica qué motor corresponde. Si el organismo define su propia asignación, pisa a la del producto."
    >
      <EditorMotor idBase="p-motor" valor={p.config.motor} onChange={(motor) => cf({ motor })} />
    </Panel>
  );
}

// --- 11. Notificaciones ---

function Notificaciones({ p, set }: SeccionProps) {
  const { ex } = useEditores(set);
  return (
    <Panel
      titulo="Notificaciones"
      descripcion="Avisos del onboarding (hasta 5 estados) y del crédito activo."
      nota={`${NOTA_APLICA_ORGANISMOS} Valores de ejemplo.`}
    >
      <EditorNotificaciones
        idBase="p-notif"
        valor={p.extras.notificaciones}
        onChange={(v) => ex({ notificaciones: v })}
      />
    </Panel>
  );
}

// --- Registro de secciones ---

export const SECCIONES: {
  id: string;
  label: string;
  vivo: boolean;
  Componente: (props: SeccionProps) => React.ReactNode;
}[] = [
  { id: "datos", label: "Datos generales", vivo: true, Componente: DatosGenerales },
  { id: "vencimientos", label: "Vencimientos", vivo: false, Componente: Vencimientos },
  { id: "opciones", label: "Opciones generales", vivo: false, Componente: Opciones },
  { id: "gestion", label: "Gestión de préstamos", vivo: false, Componente: Gestion },
  { id: "financieros", label: "Datos financieros", vivo: false, Componente: Financieros },
  { id: "cobro", label: "Cobro, canales y vendedores", vivo: true, Componente: Cobro },
  { id: "punitorios", label: "Intereses punitorios", vivo: false, Componente: Punitorios },
  { id: "onboarding", label: "Configuración del onboarding", vivo: true, Componente: Onboarding },
  { id: "legajo", label: "Legajo", vivo: true, Componente: Legajo },
  { id: "motor", label: "Motor de riesgo", vivo: true, Componente: Motor },
  { id: "notificaciones", label: "Notificaciones", vivo: false, Componente: Notificaciones },
];

// Sección donde se muestra cada error de validación.
export const SECCION_DE_ERROR: Record<string, string> = {
  nombre: "datos",
  capitalMaximo: "datos",
  vigenciaDesde: "datos",
  vigenciaHasta: "datos",
  diaCorte: "vencimientos",
  diaVencimientoFijo: "vencimientos",
  gestionRazonSocial: "gestion",
  gestionCuit: "gestion",
  canales: "cobro",
  tramos: "punitorios",
  pantallas: "onboarding",
  referencias: "onboarding",
  garantes: "onboarding",
  tokenizacion: "onboarding",
  renovacionMinCuotasPagas: "onboarding",
  renovacionMinPctPagado: "onboarding",
};
