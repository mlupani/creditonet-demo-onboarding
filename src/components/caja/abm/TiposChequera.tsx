"use client";

import { useState } from "react";
import { cajaStores, hoy, siguienteId, useChequeras, useTiposChequera, usuarioActual } from "@/lib/caja-store";
import type { TipoChequera } from "@/lib/caja-tipos";
import { FormField } from "@/components/ui/FormField";
import { AbmCaja, ESTADOS_TRES, ModalFormulario, persistir, type Columna } from "./AbmCaja";

const ENTIDAD = "Tipo de chequera";

const COLUMNAS: Columna<TipoChequera>[] = [{ clave: "descripcion", label: "Descripción", valor: (t) => t.descripcion }];

function FormularioTipo({ inicial, onClose }: { inicial: TipoChequera | null; onClose: () => void }) {
  const lista = useTiposChequera();
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [intentado, setIntentado] = useState(false);

  let error: string | undefined;
  if (!descripcion.trim()) error = "Ingresá la descripción.";
  else if (lista.some((t) => t.id !== inicial?.id && t.estado !== "ELIMINADO" && t.descripcion.toLowerCase() === descripcion.trim().toLowerCase()))
    error = "Ya existe un tipo de chequera con esa descripción.";

  const grabar = () => {
    setIntentado(true);
    if (error) return;
    persistir(
      cajaStores.tiposChequera,
      ENTIDAD,
      inicial,
      inicial
        ? { ...inicial, descripcion: descripcion.trim() }
        : { id: siguienteId("TCH", lista.map((t) => t.id)), descripcion: descripcion.trim(), estado: "ACTIVO", fechaAlta: hoy(), usuarioAlta: usuarioActual().nombre }
    );
    onClose();
  };

  return (
    <ModalFormulario titulo={inicial ? `Modificar ${inicial.descripcion}` : "Nuevo tipo de chequera"} onClose={onClose} onGrabar={grabar} maxWidth="max-w-md">
      <div className="space-y-4">
        {inicial && <FormField id="tch-id" label="ID" value={inicial.id} onChange={() => {}} disabled hint="Lo asigna el sistema." />}
        <FormField id="tch-desc" label="Descripción" required value={descripcion} onChange={setDescripcion} placeholder="Ej.: Física, E-cheq" error={intentado ? error : undefined} />
      </div>
    </ModalFormulario>
  );
}

export function TiposChequera() {
  const lista = useTiposChequera();
  const chequeras = useChequeras();
  return (
    <div>
      <p className="mb-5 max-w-2xl text-sm text-ink-500">
        Tipos de chequera que se ofrecen en el alta de chequeras: física o e-cheq.
      </p>
      <AbmCaja<TipoChequera>
        entidad={ENTIDAD}
        archivo="tipos-chequera"
        singular="tipo de chequera"
        plural="tipos de chequera"
        nuevoLabel="Nuevo tipo"
        registros={lista}
        store={cajaStores.tiposChequera}
        columnas={COLUMNAS}
        estados={ESTADOS_TRES}
        nombreDe={(t) => t.descripcion}
        errorAccion={(t, a) => {
          if (a.estado !== "SUSPENDIDO" && a.estado !== "ELIMINADO") return undefined;
          const n = chequeras.filter((c) => c.tipoId === t.id && c.estado === "ACTIVO").length;
          return n > 0 ? `Lo usan ${n} ${n === 1 ? "chequera activa" : "chequeras activas"}.` : undefined;
        }}
        formulario={(p) => <FormularioTipo key={p.inicial?.id ?? "nuevo"} {...p} />}
      />
    </div>
  );
}
