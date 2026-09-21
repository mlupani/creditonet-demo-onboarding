"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearOrganismo, useOrganismos } from "@/lib/organismos";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";

const BASE = "__base__";

export function NuevoOrganismoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const organismos = useOrganismos();
  const [nombre, setNombre] = useState("");
  const [detalle, setDetalle] = useState("");
  const [copiarDe, setCopiarDe] = useState(BASE);
  const [intentado, setIntentado] = useState(false);

  const limpio = nombre.trim();
  const repetido = organismos.some((o) => o.config.nombre.trim().toLowerCase() === limpio.toLowerCase());
  const error = !limpio
    ? "Ingresá el nombre del organismo."
    : repetido
      ? "Ya existe un organismo con ese nombre."
      : undefined;

  function cerrar() {
    setNombre("");
    setDetalle("");
    setCopiarDe(BASE);
    setIntentado(false);
    onClose();
  }

  function crear() {
    setIntentado(true);
    if (error) return;
    const id = crearOrganismo({
      nombre: limpio,
      detalle: detalle.trim(),
      copiarDeId: copiarDe === BASE ? null : copiarDe,
    });
    cerrar();
    router.push(`/organismos/${id}`);
  }

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title="Nuevo organismo"
      maxWidth="max-w-md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button onClick={crear}>Crear y configurar</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField
          id="nuevo-org-nombre"
          label="Nombre"
          required
          value={nombre}
          onChange={setNombre}
          placeholder="Ej.: Empleados de vialidad"
          error={intentado ? error : undefined}
        />
        <FormField
          id="nuevo-org-detalle"
          label="Descripción"
          value={detalle}
          onChange={setDetalle}
          placeholder="Sector, convenio y modalidad de descuento"
        />
        <SelectField
          id="nuevo-org-copiar"
          label="Partir de"
          value={copiarDe}
          onChange={setCopiarDe}
          options={[
            { value: BASE, label: "Sin excepciones (hereda todo del producto)" },
            ...organismos
              .filter((o) => o.config.estado !== "ELIMINADO")
              .map((o) => ({ value: o.config.id, label: `Copiar excepciones de ${o.config.nombre}` })),
          ]}
          hint="Un organismo nuevo no ofrece ningún producto hasta que los habilites."
        />
      </div>
    </Modal>
  );
}
