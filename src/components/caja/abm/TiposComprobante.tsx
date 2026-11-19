"use client";

import { useState } from "react";
import { hoy, siguienteId, usuarioActual } from "@/lib/caja-store";
import { provStores, useComprobantes, useTiposComprobante } from "@/lib/proveedores-store";
import type { EfectoComprobante, TipoComprobante } from "@/lib/proveedores-tipos";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { AbmCaja, ESTADOS_TRES, ModalFormulario, persistir, type Columna } from "./AbmCaja";

const ENTIDAD = "Tipo de comprobante";

const EFECTO_LABEL: Record<EfectoComprobante, string> = {
  SUMA: "Suma deuda (factura, nota de débito)",
  RESTA: "Resta deuda (nota de crédito)",
};

const COLUMNAS: Columna<TipoComprobante>[] = [
  { clave: "descripcion", label: "Descripción", valor: (t) => t.descripcion },
  { clave: "efecto", label: "Efecto en la cuenta corriente", valor: (t) => EFECTO_LABEL[t.efecto] },
];

function FormularioTipo({ inicial, onClose }: { inicial: TipoComprobante | null; onClose: () => void }) {
  const lista = useTiposComprobante();
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [efecto, setEfecto] = useState<EfectoComprobante>(inicial?.efecto ?? "SUMA");
  const [intentado, setIntentado] = useState(false);

  const errores: Record<string, string> = {};
  if (!descripcion.trim()) errores.descripcion = "Ingresá la descripción.";
  else if (lista.some((t) => t.id !== inicial?.id && t.estado !== "ELIMINADO" && t.descripcion.toLowerCase() === descripcion.trim().toLowerCase()))
    errores.descripcion = "Ya existe un tipo con esa descripción.";

  const grabar = () => {
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    const base = { descripcion: descripcion.trim(), efecto };
    persistir(
      provStores.tiposComprobante,
      ENTIDAD,
      inicial,
      inicial
        ? { ...inicial, ...base }
        : { ...base, id: siguienteId("TCP", lista.map((t) => t.id)), estado: "ACTIVO", fechaAlta: hoy(), usuarioAlta: usuarioActual().nombre }
    );
    onClose();
  };

  return (
    <ModalFormulario titulo={inicial ? `Modificar ${inicial.descripcion}` : "Nuevo tipo de comprobante"} onClose={onClose} onGrabar={grabar} maxWidth="max-w-md">
      <div className="space-y-4">
        {inicial && <FormField id="tc-id" label="ID" value={inicial.id} onChange={() => {}} disabled hint="Lo asigna el sistema." />}
        <FormField
          id="tc-desc"
          label="Descripción"
          required
          value={descripcion}
          onChange={setDescripcion}
          placeholder="Ej.: Factura A"
          error={intentado ? errores.descripcion : undefined}
        />
        <SelectField
          id="tc-efecto"
          label="Efecto en la cuenta corriente"
          required
          value={efecto}
          onChange={(v) => setEfecto(v as EfectoComprobante)}
          options={Object.entries(EFECTO_LABEL).map(([value, label]) => ({ value, label }))}
        />
      </div>
    </ModalFormulario>
  );
}

export function TiposComprobante() {
  const lista = useTiposComprobante();
  const comprobantes = useComprobantes();
  return (
    <div>
      <p className="mb-5 max-w-2xl text-sm text-ink-500">
        Tipos de comprobante que se pueden cargar de un proveedor. Cada uno define si suma o resta deuda en la cuenta corriente.
      </p>
      <AbmCaja<TipoComprobante>
        entidad={ENTIDAD}
        archivo="tipos-comprobante"
        singular="tipo"
        plural="tipos"
        nuevoLabel="Nuevo tipo"
        registros={lista}
        store={provStores.tiposComprobante}
        columnas={COLUMNAS}
        estados={ESTADOS_TRES}
        nombreDe={(t) => t.descripcion}
        errorAccion={(t, a) => {
          if (a.estado !== "ELIMINADO") return undefined;
          const usados = comprobantes.filter((c) => c.tipoId === t.id).length;
          return usados > 0 ? `Tiene ${usados} ${usados === 1 ? "comprobante cargado" : "comprobantes cargados"}: no se puede eliminar.` : undefined;
        }}
        formulario={(p) => <FormularioTipo key={p.inicial?.id ?? "nuevo"} {...p} />}
      />
    </div>
  );
}
