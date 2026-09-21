"use client";

import type { ReactNode } from "react";
import {
  ESTADOS_NOTIFICACION_ONBOARDING,
  type ExtrasProducto,
  type GestionPrestamos,
  type NotificacionesProducto,
  type ProductoAbm,
  type RecalculoNeto,
  type SeleccionLista,
  type TramoPunitorio,
} from "@/lib/productos";
import type { VistaOrganismo } from "@/lib/organismos";
import { formatARS } from "@/lib/format";
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
      <dl className="mt-3 grid gap-4 sm:grid-cols-2">
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
  disponible: "Disponible",
  extraccionesTransferencias: "Extracciones / transferencias",
  cuotasBuroExterno: "Cuotas de buró externo",
  noRemunerativosHorasExtra: "No remunerativos / horas extra",
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
        <span>
          <strong>
            {t.length} tramo{t.length === 1 ? "" : "s"}
          </strong>
          <span className="block text-xs text-ink-500">
            {t
              .map(
                (x) =>
                  `día ${x.desdeDia}+: ${x.punitorioPct} % s/tasa · gracia ${x.diasGracia} d · tope ${formatARS(x.montoTopeSinIva)}`
              )
              .join(" | ")}
          </span>
        </span>
      );
    }
    case "notif": {
      const n = valor as NotificacionesProducto;
      const onboarding = ESTADOS_NOTIFICACION_ONBOARDING.filter((e) => n.onboarding[e.id]).map(
        (e) => e.label
      );
      const activo = [
        n.creditoActivo.vencimiento && `vencimiento (${n.creditoActivo.diasAntesVencimiento} d)`,
        n.creditoActivo.pago && "pago",
        n.creditoActivo.mora && "mora",
        n.creditoActivo.cancelacion && "cancelación",
      ].filter(Boolean);
      return (
        <span>
          <span className="block">Onboarding: {onboarding.join(", ") || "sin avisos"}</span>
          <span className="block">Crédito activo: {activo.join(", ") || "sin avisos"}</span>
          <span className="block text-xs text-ink-500">{n.canales.join(", ") || "Sin medios"}</span>
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
      return <EditorTramos idBase={idBase} tramos={valor as TramoPunitorio[]} onChange={onChange} />;
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
