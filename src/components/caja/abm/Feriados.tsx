"use client";

import { useState } from "react";
import { cajaStores, siguienteId, useFeriados } from "@/lib/caja-store";
import type { Feriado } from "@/lib/caja-tipos";
import { FormField } from "@/components/ui/FormField";
import { AbmCaja, ESTADOS_TRES, ModalFormulario, persistir, type Columna } from "./AbmCaja";

const ENTIDAD = "Feriado";

const COLUMNAS: Columna<Feriado>[] = [
  { clave: "fecha", label: "Fecha", ancho: "w-36", valor: (f) => f.fecha },
  { clave: "descripcion", label: "Descripción", valor: (f) => f.descripcion },
];

function FormularioFeriado({ inicial, onClose }: { inicial: Feriado | null; onClose: () => void }) {
  const lista = useFeriados();
  const [fecha, setFecha] = useState(inicial?.fecha ?? "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [intentado, setIntentado] = useState(false);

  const errores: Record<string, string> = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) errores.fecha = "Ingresá la fecha del feriado.";
  else if (lista.some((f) => f.id !== inicial?.id && f.estado === "ACTIVO" && f.fecha === fecha)) errores.fecha = "Ya hay un feriado activo en esa fecha.";
  if (!descripcion.trim()) errores.descripcion = "Ingresá la descripción.";
  const e = (k: string) => (intentado ? errores[k] : undefined);

  const grabar = () => {
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    const base = { fecha, descripcion: descripcion.trim().replace(/\s+/g, " ") };
    persistir(
      cajaStores.feriados,
      ENTIDAD,
      inicial,
      inicial ? { ...inicial, ...base } : { ...base, id: siguienteId("FER", lista.map((f) => f.id)), estado: "ACTIVO" }
    );
    onClose();
  };

  return (
    <ModalFormulario titulo={inicial ? `Modificar feriado ${inicial.fecha}` : "Nuevo feriado"} onClose={onClose} onGrabar={grabar} maxWidth="max-w-md">
      <div className="space-y-4">
        {inicial && <FormField id="fer-id" label="ID" value={inicial.id} onChange={() => {}} disabled hint="Lo asigna el sistema." />}
        <FormField id="fer-fecha" label="Fecha" type="date" required value={fecha} onChange={setFecha} error={e("fecha")} />
        <FormField id="fer-desc" label="Descripción" required value={descripcion} onChange={setDescripcion} placeholder="Ej.: Navidad" error={e("descripcion")} />
      </div>
    </ModalFormulario>
  );
}

export function Feriados() {
  const lista = useFeriados();
  return (
    <div>
      <p className="mb-5 max-w-2xl text-sm text-ink-500">
        En feriado la caja no opera salvo excepción habilitada por el Tesorero. Propuesto en el avance 01, pendiente de confirmar.
      </p>
      <AbmCaja<Feriado>
        entidad={ENTIDAD}
        archivo="feriados"
        singular="feriado"
        plural="feriados"
        nuevoLabel="Nuevo feriado"
        registros={lista}
        store={cajaStores.feriados}
        columnas={COLUMNAS}
        estados={ESTADOS_TRES}
        nombreDe={(f) => `${f.fecha} · ${f.descripcion}`}
        errorAccion={(f, a) =>
          a.estado === "ACTIVO" && lista.some((x) => x.id !== f.id && x.estado === "ACTIVO" && x.fecha === f.fecha)
            ? "Ya hay un feriado activo en esa fecha."
            : undefined
        }
        formulario={(p) => <FormularioFeriado key={p.inicial?.id ?? "nuevo"} {...p} />}
      />
    </div>
  );
}
