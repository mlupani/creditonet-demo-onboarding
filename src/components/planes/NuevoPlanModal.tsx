"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearPlan, usePlanes } from "@/lib/planes";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";

export function NuevoPlanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const planes = usePlanes();
  const [nombre, setNombre] = useState("");
  const [copiarDe, setCopiarDe] = useState("");
  const [intentado, setIntentado] = useState(false);

  const limpio = nombre.trim();
  const repetido = planes.some((p) => p.config.nombre.trim().toLowerCase() === limpio.toLowerCase());
  const error = !limpio
    ? "Ingresá el nombre del plan."
    : repetido
      ? "Ya existe un plan con ese nombre."
      : undefined;

  function cerrar() {
    setNombre("");
    setCopiarDe("");
    setIntentado(false);
    onClose();
  }

  function crear() {
    setIntentado(true);
    if (error) return;
    const id = crearPlan({ nombre: limpio, copiarDeId: copiarDe || null });
    cerrar();
    router.push(`/planes/${id}`);
  }

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title="Nuevo plan de cuotas"
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
          id="nuevo-plan-nombre"
          label="Nombre"
          required
          value={nombre}
          onChange={setNombre}
          placeholder="Ej.: Plan Personal 24 cuotas"
          error={intentado ? error : undefined}
        />
        <SelectField
          id="nuevo-plan-copiar"
          label="Partir de"
          value={copiarDe}
          onChange={setCopiarDe}
          placeholder="El primer plan (condiciones base)"
          options={planes
            .filter((p) => p.config.estado !== "ELIMINADO")
            .map((p) => ({ value: p.config.id, label: `Copiar de ${p.config.nombre}` }))}
          hint="Copia las condiciones, la habilitación y la grilla. Un plan nuevo no está asignado a ningún organismo."
        />
      </div>
    </Modal>
  );
}
