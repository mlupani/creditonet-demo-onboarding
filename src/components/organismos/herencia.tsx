"use client";

import type { ReactNode } from "react";
import {
  asignadasDe,
  efectivasDe,
  quitadasDe,
  type DatosFinancierosPedidos,
  type ExtrasProducto,
  type GestionPrestamos,
  type NotificacionesProducto,
  type ProductoAbm,
  type RecalculoNeto,
  type SeleccionLista,
  type TramoPunitorio,
} from "@/lib/productos";
import type { VistaOrganismo } from "@/lib/organismos";
import { getPlantillasNotificacion } from "@/lib/plantillas-notificacion";
import { formatARS } from "@/lib/format";
import { TERMINOS } from "@/lib/terminologia";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { MultiSelectField } from "@/components/ui/MultiSelectField";
import { SelectField } from "@/components/ui/SelectField";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
import { CampoNumero } from "@/components/productos/campos";
import {
  EditorGestion,
  EditorNotificaciones,
  EditorRecalculoNeto,
  EditorSeleccion,
  EditorTramos,
} from "@/components/productos/editores";
import { IconSettings } from "@/components/icons";

// La herencia es el concepto central del organismo (Producto §2): no define su configuración
// completa, sólo las excepciones. Cada fila muestra el valor del producto y, si el organismo lo
// pisa, la excepción resaltada.

export function Si({ valor }: { valor: boolean }) {
  return valor ? (
    <span className="font-semibold text-success-700">✓ Sí</span>
  ) : (
    <span className="font-semibold text-danger-600">✕ No</span>
  );
}

export function FilaHerencia({
  etiqueta,
  ayuda,
  productoNombre,
  heredado,
  editor,
  onCrear,
  onQuitar,
  error,
  apilado,
}: {
  etiqueta: string;
  ayuda?: string;
  productoNombre: string;
  // Valor que rige por herencia (el del producto), ya formateado.
  heredado: ReactNode;
  // Control de edición de la excepción; null si el organismo hereda.
  editor: ReactNode | null;
  onCrear: () => void;
  onQuitar: () => void;
  error?: string;
  // Producto y organismo uno debajo del otro, cada uno a todo el ancho.
  apilado?: boolean;
}) {
  const excepcion = editor !== null;
  return (
    <div
      className={`rounded-xl border p-4 ${
        excepcion ? "border-warning-300 bg-warning-50/50" : "border-ink-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-900">{etiqueta}</p>
          {ayuda && <p className="text-xs text-ink-500">{ayuda}</p>}
        </div>
        {excepcion ? (
          <span className="shrink-0 rounded-full border border-warning-300 bg-warning-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-700">
            ⚠ Excepción del organismo
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-ink-200 bg-ink-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-500">
            Heredado del producto
          </span>
        )}
      </div>
      <dl className={`mt-3 grid gap-4 ${apilado ? "" : "sm:grid-cols-2"}`}>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Producto · {productoNombre}
          </dt>
          <dd className="mt-1 text-sm text-ink-700">{heredado}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Organismo
          </dt>
          <dd className="mt-1 text-sm text-ink-900">
            {editor ?? <span className="text-ink-500">Sin excepción: aplica lo del producto.</span>}
          </dd>
        </div>
      </dl>
      {error && <ValidationMessage tipo="error">{error}</ValidationMessage>}
      <div className="mt-3 flex justify-end">
        {excepcion ? (
          <Button variant="ghost" size="sm" onClick={onQuitar}>
            Volver a heredar
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={onCrear}>
            <IconSettings width={14} height={14} />
            Crear excepción
          </Button>
        )}
      </div>
    </div>
  );
}

// Valor del producto que el organismo no puede pisar (se muestra para espejar la sección).
export function FilaSoloLectura({ campo, p }: { campo: CampoExtra; p: ProductoAbm }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 rounded-xl border border-ink-200 bg-white px-4 py-3">
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm font-semibold text-ink-900">{campo.etiqueta}</p>
        {campo.ayuda && <p className="text-xs text-ink-500">{campo.ayuda}</p>}
      </div>
      <div className="min-w-0 flex-1 basis-56 text-sm text-ink-700">{texto(campo, p.extras[campo.clave])}</div>
      <span className="shrink-0 rounded-full border border-ink-200 bg-ink-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-500">
        Sin excepción
      </span>
    </div>
  );
}

// --- Filas sobre los valores de ejemplo del producto (`extras`) ---

export type CampoExtra = {
  clave: keyof ExtrasProducto;
  etiqueta: string;
  ayuda?: string;
} & (
  | { tipo: "bool" }
  | { tipo: "num"; sufijo?: string; step?: number }
  | { tipo: "texto" }
  | { tipo: "select"; opciones: { value: string; label: string }[] }
  | { tipo: "multi"; opciones: string[] }
  | { tipo: "seleccion"; opciones: { value: string; label: string; detalle?: string }[] }
  | { tipo: "tramos" }
  | { tipo: "notif" }
  | { tipo: "gestion" }
  | { tipo: "neto" }
);

const ETIQUETAS_NETO: Record<keyof RecalculoNeto, string> = {
  disponible: TERMINOS.disponible,
  saldoDiaAcreditacion: TERMINOS.saldoDiaAcreditacion,
  extraccionesTransferencias: TERMINOS.transferenciasExtracciones,
  cuotasBuroExterno: "Cuotas de buró externo",
  noRemunerativosHorasExtra: `${TERMINOS.conceptosNoRemunerativos} / horas extra`,
};

function texto(campo: CampoExtra, valor: unknown): ReactNode {
  switch (campo.tipo) {
    case "bool":
      return <Si valor={valor as boolean} />;
    case "num":
      return `${valor as number}${campo.sufijo ? ` ${campo.sufijo}` : ""}`;
    case "texto":
      return (valor as string) || "—";
    case "select":
      return campo.opciones.find((o) => o.value === valor)?.label ?? String(valor);
    case "multi": {
      const v = valor as string[];
      return v.length === 0 ? "Ninguno" : v.join(", ");
    }
    case "seleccion": {
      const v = valor as SeleccionLista;
      if (v.todos) return "Todos";
      return v.ids.length === 0
        ? "Ninguno"
        : v.ids.map((id) => campo.opciones.find((o) => o.value === id)?.label ?? id).join(", ");
    }
    case "tramos": {
      const t = valor as TramoPunitorio[];
      return (
        <div>
          <strong>
            {t.length} tramo{t.length === 1 ? "" : "s"}
          </strong>
          <ul className="mt-1 grid gap-1 text-xs text-ink-500 sm:grid-cols-2 lg:grid-cols-3">
            {t.map((x, i) => (
              <li key={i} className="rounded-lg border border-ink-100 bg-ink-50 px-2.5 py-1.5">
                <span className="font-semibold text-ink-700">Tramo {i + 1} · día {x.desdeDia}+</span>
                <span className="block">
                  {x.punitorioPct} % s/tasa · gracia {x.diasGracia} d · tope {formatARS(x.montoTopeSinIva)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "notif": {
      const asignadas = getPlantillasNotificacion().filter((x) => efectivasDe(valor as NotificacionesProducto).includes(x.id));
      const externas = asignadas.filter((x) => x.ambito === "EXTERNO").map((x) => x.nombre);
      const internas = asignadas.filter((x) => x.ambito === "INTERNO").map((x) => x.nombre);
      return (
        <span>
          <span className="block">Externas: {externas.join(", ") || "ninguna"}</span>
          <span className="block">Internas: {internas.join(", ") || "ninguna"}</span>
        </span>
      );
    }
    case "gestion": {
      const g = valor as GestionPrestamos;
      return g.activa ? (
        <span>
          <Si valor />
          <span className="block text-xs text-ink-500">
            {g.razonSocial || "Sin razón social"} · {g.cuit || "sin CUIT"}
          </span>
        </span>
      ) : (
        <Si valor={false} />
      );
    }
    case "neto": {
      const n = valor as RecalculoNeto;
      const incluidos = (Object.keys(n) as (keyof RecalculoNeto)[])
        .filter((k) => n[k])
        .map((k) => ETIQUETAS_NETO[k]);
      return incluidos.length === 0 ? "Ninguno interviene" : incluidos.join(", ");
    }
  }
}

function EditorExtra({
  campo,
  idBase,
  valor,
  onChange,
}: {
  campo: CampoExtra;
  idBase: string;
  valor: unknown;
  onChange: (valor: unknown) => void;
}) {
  switch (campo.tipo) {
    case "bool":
      return (
        <Checkbox
          checked={valor as boolean}
          onChange={onChange}
          label={(valor as boolean) ? "Sí" : "No"}
        />
      );
    case "num":
      return (
        <CampoNumero
          id={idBase}
          label=""
          value={valor as number}
          sufijo={campo.sufijo}
          step={campo.step}
          onChange={onChange}
        />
      );
    case "texto":
      return <FormField id={idBase} label="" value={valor as string} onChange={onChange} />;
    case "select":
      return (
        <SelectField
          id={idBase}
          label=""
          value={valor as string}
          onChange={onChange}
          options={campo.opciones}
        />
      );
    case "multi":
      return (
        <MultiSelectField
          id={idBase}
          label=""
          values={valor as string[]}
          onChange={onChange}
          options={campo.opciones}
          plural="opciones"
        />
      );
    case "seleccion":
      return (
        <EditorSeleccion
          opciones={campo.opciones}
          valor={valor as SeleccionLista}
          onChange={onChange}
        />
      );
    case "tramos":
      return <EditorTramos idBase={idBase} tramos={valor as TramoPunitorio[]} onChange={onChange} ancho />;
    case "notif":
      return (
        <EditorNotificaciones
          idBase={idBase}
          valor={valor as NotificacionesProducto}
          onChange={onChange}
        />
      );
    case "gestion":
      return (
        <EditorGestion idBase={idBase} valor={valor as GestionPrestamos} onChange={onChange} />
      );
    case "neto":
      return <EditorRecalculoNeto valor={valor as RecalculoNeto} onChange={onChange} />;
  }
}

// Una fila de excepción sobre un valor de ejemplo del producto.
export function FilaExtra({
  campo,
  o,
  p,
  set,
}: {
  campo: CampoExtra;
  o: VistaOrganismo;
  p: ProductoAbm;
  set: (cambio: (o: VistaOrganismo) => VistaOrganismo) => void;
}) {
  const heredado: unknown = p.extras[campo.clave];
  const propio: unknown = o.excepciones[campo.clave];
  const enExcepcion = propio !== undefined;
  const escribir = (valor: unknown) =>
    set((x) => ({ ...x, excepciones: { ...x.excepciones, [campo.clave]: valor } }));
  return (
    <FilaHerencia
      etiqueta={campo.etiqueta}
      ayuda={campo.ayuda}
      productoNombre={p.config.nombre}
      apilado={campo.tipo === "tramos"}
      heredado={texto(campo, heredado)}
      editor={
        enExcepcion ? (
          <EditorExtra campo={campo} idBase={`o-${campo.clave}`} valor={propio} onChange={escribir} />
        ) : null
      }
      onCrear={() => escribir(structuredClone(heredado))}
      onQuitar={() =>
        set((x) => {
          const { [campo.clave]: _quitada, ...resto } = x.excepciones;
          void _quitada;
          return { ...x, excepciones: resto };
        })
      }
    />
  );
}

const DATOS_FINANCIEROS: { clave: keyof DatosFinancierosPedidos; label: string; detalle: string }[] = [
  { clave: "ingresoBruto", label: "Ingreso bruto", detalle: "Haberes brutos mensuales." },
  { clave: "ingresoNeto", label: "Ingreso neto", detalle: "Ingreso mensual de bolsillo. Base del cálculo de RCI." },
  { clave: "disponible", label: TERMINOS.disponible, detalle: "Dinero que el cliente tiene libre para extraer de su cuenta." },
  { clave: "saldoDiaAcreditacion", label: TERMINOS.saldoDiaAcreditacion, detalle: "Saldo de la cuenta el día de la acreditación del sueldo." },
  { clave: "extraccionesTransferencias", label: TERMINOS.transferenciasExtracciones, detalle: "Movimientos que reducen el ingreso neto efectivo." },
];

// Datos financieros que se le piden al cliente: se ven tildados según el producto y la excepción
// es destildar los que este organismo no pide. "Volver a heredar" descarta la excepción.
export function FilaDatosFinancieros({
  o,
  p,
  set,
}: {
  o: VistaOrganismo;
  p: ProductoAbm;
  set: (cambio: (o: VistaOrganismo) => VistaOrganismo) => void;
}) {
  const heredado = p.extras.datosFinancieros;
  const propio = o.excepciones.datosFinancieros;
  const valor = propio ?? heredado;
  const marcar = (clave: keyof DatosFinancierosPedidos, v: boolean) =>
    set((x) => {
      const nuevo = { ...(x.excepciones.datosFinancieros ?? heredado), [clave]: v };
      // Si vuelve a coincidir con el producto, deja de ser excepción.
      const igual = DATOS_FINANCIEROS.every((d) => nuevo[d.clave] === heredado[d.clave]);
      const { datosFinancieros: _quitada, ...resto } = x.excepciones;
      void _quitada;
      return { ...x, excepciones: igual ? resto : { ...resto, datosFinancieros: nuevo } };
    });
  const quitar = () =>
    set((x) => {
      const { datosFinancieros: _quitada, ...resto } = x.excepciones;
      void _quitada;
      return { ...x, excepciones: resto };
    });
  return (
    <MarcoExcepcion
      etiqueta="Datos que se le piden al cliente"
      ayuda="Destildá los que este organismo no pide."
      excepcion={propio !== undefined}
      onQuitar={quitar}
    >
      <div className="mt-3 space-y-3">
        {DATOS_FINANCIEROS.map((d) => (
          <Checkbox
            key={d.clave}
            checked={valor[d.clave]}
            onChange={(v) => marcar(d.clave, v)}
            label={d.label}
            description={
              valor[d.clave] === heredado[d.clave] ? d.detalle : `${d.detalle} En el producto: ${heredado[d.clave] ? "se pide" : "no se pide"}.`
            }
          />
        ))}
      </div>
    </MarcoExcepcion>
  );
}

// Fila que se edita en el lugar, a todo el ancho: muestra lo del producto y, en cuanto se cambia
// algo, pasa a ser excepción del organismo. "Volver a heredar" descarta la excepción.
export function MarcoExcepcion({
  etiqueta,
  ayuda,
  excepcion,
  onQuitar,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  excepcion: boolean;
  onQuitar: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        excepcion ? "border-warning-300 bg-warning-50/50" : "border-ink-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-900">{etiqueta}</p>
          {ayuda && <p className="text-xs text-ink-500">{ayuda}</p>}
        </div>
        {excepcion ? (
          <span className="shrink-0 rounded-full border border-warning-300 bg-warning-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-700">
            ⚠ Excepción del organismo
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-ink-200 bg-ink-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-500">
            Heredado del producto
          </span>
        )}
      </div>
      {children}
      {excepcion && (
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onQuitar}>
            Volver a heredar
          </Button>
        </div>
      )}
    </div>
  );
}

// Mismas asignadas y mismas quitadas, sin importar el orden.
const mismasNotificaciones = (a: NotificacionesProducto, b: NotificacionesProducto) => {
  const clave = (n: NotificacionesProducto) =>
    JSON.stringify([[...asignadasDe(n)].sort(), [...quitadasDe(n)].sort()]);
  return clave(a) === clave(b);
};

// Notificaciones: vienen del producto y se modifican en el lugar; cualquier cambio queda como
// excepción del organismo.
export function FilaNotificaciones({
  o,
  p,
  set,
}: {
  o: VistaOrganismo;
  p: ProductoAbm;
  set: (cambio: (o: VistaOrganismo) => VistaOrganismo) => void;
}) {
  const heredado = p.extras.notificaciones;
  const propio = o.excepciones.notificaciones;
  const quitar = () =>
    set((x) => {
      const { notificaciones: _quitada, ...resto } = x.excepciones;
      void _quitada;
      return { ...x, excepciones: resto };
    });
  const cambiar = (valor: NotificacionesProducto) =>
    set((x) => {
      const { notificaciones: _quitada, ...resto } = x.excepciones;
      void _quitada;
      // Si vuelve a quedar igual a la del producto, deja de ser excepción.
      return { ...x, excepciones: mismasNotificaciones(valor, heredado) ? resto : { ...resto, notificaciones: valor } };
    });
  return (
    <MarcoExcepcion
      etiqueta="Notificaciones"
      ayuda="Las que envía el producto. Quitá o agregá las que cambian para este organismo."
      excepcion={propio !== undefined}
      onQuitar={quitar}
    >
      <div className="mt-4">
        <EditorNotificaciones
          idBase="o-notificaciones"
          valor={propio ?? heredado}
          onChange={cambiar}
          productoId={p.config.id}
        />
      </div>
    </MarcoExcepcion>
  );
}

// Encabezado de una sección del organismo que muestra la pantalla del producto: cuántas
// excepciones tiene y cómo descartarlas.
export function BarraHerencia({
  cantidad,
  productoNombre,
  onQuitar,
}: {
  cantidad: number;
  productoNombre: string;
  onQuitar: () => void;
}) {
  const excepcion = cantidad > 0;
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2.5 ${
        excepcion ? "border-warning-300 bg-warning-50/50" : "border-ink-200 bg-white"
      }`}
    >
      {excepcion ? (
        <span className="text-xs font-semibold text-warning-700">
          ⚠ {cantidad} {cantidad === 1 ? "excepción" : "excepciones"} del organismo sobre {productoNombre}
        </span>
      ) : (
        <span className="text-xs text-ink-500">Heredado de {productoNombre}: sin excepciones.</span>
      )}
      {excepcion && (
        <Button variant="ghost" size="sm" onClick={onQuitar}>
          Volver a heredar
        </Button>
      )}
    </div>
  );
}
