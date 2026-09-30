"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import {
  crearMotivoObservacion,
  editarMotivoObservacion,
  eliminarMotivoObservacion,
  errorNombreMotivo,
  useMotivosObservacion,
  type MotivoObservacion,
} from "@/lib/motivos-observacion";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { IconPencil, IconPlus, IconTrash } from "@/components/icons";

// `null` = modal cerrado; `{ motivo: null }` = alta; `{ motivo }` = edición.
type Edicion = { motivo: MotivoObservacion | null } | null;

function MotivoModal({ edicion, onClose }: { edicion: Edicion; onClose: () => void }) {
  const motivo = edicion?.motivo ?? null;
  const [nombre, setNombre] = useState(motivo?.nombre ?? "");
  const [intentado, setIntentado] = useState(false);
  const error = errorNombreMotivo(nombre, motivo?.id);

  function guardar() {
    setIntentado(true);
    if (error) return;
    if (motivo) editarMotivoObservacion(motivo.id, nombre);
    else crearMotivoObservacion(nombre);
    onClose();
  }

  return (
    <Modal
      open={edicion !== null}
      onClose={onClose}
      title={motivo ? "Editar motivo" : "Nuevo motivo de observación"}
      maxWidth="max-w-md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar}>{motivo ? "Guardar" : "Agregar"}</Button>
        </div>
      }
    >
      <FormField
        id="motivo-observacion-nombre"
        label="Nombre del motivo"
        required
        value={nombre}
        onChange={setNombre}
        placeholder="Ej.: Agregar referencia"
        error={intentado ? error : undefined}
        hint="Es el texto que el analista elige al observar una solicitud."
      />
    </Modal>
  );
}

export function MotivosObservacion() {
  const { hidratado } = useApplication();
  const motivos = useMotivosObservacion();
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [baja, setBaja] = useState<MotivoObservacion | null>(null);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="animate-fade-in">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
          Módulo Créditos · Parámetros
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">
          Motivos de observación
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Tipificación de las observaciones. El analista elige uno de estos motivos al observar una
          solicitud; los cambios se aplican a las próximas observaciones.
        </p>
      </div>

      <div className="mt-6">
        <Button onClick={() => setEdicion({ motivo: null })}>
          <IconPlus width={16} height={16} />
          Nuevo motivo
        </Button>
      </div>

      <Card className="mt-5 overflow-hidden">
        {!hidratado ? (
          <p className="px-5 py-8 text-center text-sm text-ink-400">Cargando…</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {motivos.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex-1 text-sm font-medium text-ink-900">{m.nombre}</span>
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Editar ${m.nombre}`}
                  onClick={() => setEdicion({ motivo: m })}
                >
                  <IconPencil width={14} height={14} />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Dar de baja ${m.nombre}`}
                  disabled={motivos.length <= 1}
                  title={
                    motivos.length <= 1 ? "Tiene que quedar al menos un motivo vigente." : undefined
                  }
                  onClick={() => setBaja(m)}
                >
                  <IconTrash width={14} height={14} />
                  Baja
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* key: el formulario arranca limpio cada vez que se abre. */}
      <MotivoModal
        key={edicion ? (edicion.motivo?.id ?? "nuevo") : "cerrado"}
        edicion={edicion}
        onClose={() => setEdicion(null)}
      />
      <ConfirmationModal
        open={baja !== null}
        title="Dar de baja el motivo"
        descripcion="Deja de ofrecerse al observar. Las observaciones ya registradas conservan su motivo."
        rows={[{ label: "Motivo", value: baja?.nombre ?? "" }]}
        confirmLabel="Dar de baja"
        tone="danger"
        onCancel={() => setBaja(null)}
        onConfirm={() => {
          if (baja) eliminarMotivoObservacion(baja.id);
          setBaja(null);
        }}
      />
    </div>
  );
}
