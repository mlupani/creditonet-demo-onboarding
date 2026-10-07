"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import {
  crearProvinciasImpuestos,
  editarProvinciaImpuestos,
  eliminarProvinciaImpuestos,
  errorPorcentaje,
  parsearPorcentaje,
  provinciasSinCargar,
  useProvinciasImpuestos,
  type ProvinciaImpuestos,
} from "@/lib/provincias-impuestos";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { MultiSelectField } from "@/components/ui/MultiSelectField";
import { IconPencil, IconPlus, IconTrash } from "@/components/icons";

// `null` = modal cerrado; `{ registro: null }` = alta; `{ registro }` = edición.
type Edicion = { registro: ProvinciaImpuestos | null } | null;

const fmt = (n: number) => `${String(n).replace(".", ",")} %`;

function ProvinciaModal({ edicion, onClose }: { edicion: Edicion; onClose: () => void }) {
  const registro = edicion?.registro ?? null;
  const disponibles = provinciasSinCargar();
  const [provincias, setProvincias] = useState<string[]>([]);
  const [sellado, setSellado] = useState(registro ? String(registro.sellado).replace(".", ",") : "");
  const [intentado, setIntentado] = useState(false);

  const errorProvincias =
    !registro && provincias.length === 0 ? "Elegí al menos una provincia." : undefined;
  const errorSellado = errorPorcentaje(sellado, "el sellado");

  function guardar() {
    setIntentado(true);
    if (errorProvincias || errorSellado) return;
    const s = parsearPorcentaje(sellado) as number;
    if (registro) editarProvinciaImpuestos(registro.id, s);
    else crearProvinciasImpuestos(provincias, s);
    onClose();
  }

  return (
    <Modal
      open={edicion !== null}
      onClose={onClose}
      title={registro ? `Editar ${registro.provincia}` : "Cargar provincias"}
      maxWidth="max-w-md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar}>{registro ? "Guardar" : "Agregar"}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {!registro && (
          <MultiSelectField
            id="provincias-impuestos-provincias"
            label="Provincias"
            required
            values={provincias}
            onChange={setProvincias}
            options={disponibles}
            placeholder="Seleccioná provincias…"
            plural="provincias"
            femenino
            error={intentado ? errorProvincias : undefined}
            hint={
              disponibles.length === 0
                ? "Ya están cargadas todas las provincias."
                : "El sellado de abajo se aplica a todas las que elijas."
            }
          />
        )}
        <FormField
          id="provincias-impuestos-sellado"
          label="Sellado (%)"
          required
          inputMode="text"
          value={sellado}
          onChange={setSellado}
          placeholder="Ej.: 1,2"
          error={intentado ? errorSellado : undefined}
        />
      </div>
    </Modal>
  );
}

export function ProvinciasImpuestos() {
  const { hidratado } = useApplication();
  const lista = useProvinciasImpuestos();
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [baja, setBaja] = useState<ProvinciaImpuestos | null>(null);
  const completo = provinciasSinCargar().length === 0;

  return (
    <div>
      <div className="animate-fade-in">
        <p className="max-w-2xl text-sm text-ink-500">
          Alícuota de sellado de cada provincia. Se cargan de a varias provincias con el
          mismo valor y después se ajustan una por una. El IVA es nacional: está en Impositivos.
        </p>
      </div>

      <div className="mt-6">
        <Button
          disabled={completo}
          title={completo ? "Ya están cargadas todas las provincias." : undefined}
          onClick={() => setEdicion({ registro: null })}
        >
          <IconPlus width={16} height={16} />
          Cargar provincias
        </Button>
      </div>

      <Card className="mt-5 overflow-hidden">
        {!hidratado ? (
          <p className="px-5 py-8 text-center text-sm text-ink-400">Cargando…</p>
        ) : lista.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-400">No hay provincias cargadas.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            <li className="flex items-center gap-3 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
              <span className="flex-1">Provincia</span>
              <span className="w-20 text-right">Sellado</span>
              <span className="w-[11.5rem]" />
            </li>
            {lista.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex-1 text-sm font-medium text-ink-900">{p.provincia}</span>
                <span className="w-20 text-right text-sm text-ink-700">{fmt(p.sellado)}</span>
                <span className="flex w-[11.5rem] justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Editar ${p.provincia}`}
                    onClick={() => setEdicion({ registro: p })}
                  >
                    <IconPencil width={14} height={14} />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Dar de baja ${p.provincia}`}
                    onClick={() => setBaja(p)}
                  >
                    <IconTrash width={14} height={14} />
                    Baja
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* key: el formulario arranca limpio cada vez que se abre. */}
      <ProvinciaModal
        key={edicion ? (edicion.registro?.id ?? "nuevo") : "cerrado"}
        edicion={edicion}
        onClose={() => setEdicion(null)}
      />
      <ConfirmationModal
        open={baja !== null}
        title="Dar de baja la provincia"
        descripcion="Se quita su sellado. Podés volver a cargarla cuando quieras."
        rows={[
          { label: "Provincia", value: baja?.provincia ?? "" },
          { label: "Sellado", value: baja ? fmt(baja.sellado) : "" },
        ]}
        confirmLabel="Dar de baja"
        tone="danger"
        onCancel={() => setBaja(null)}
        onConfirm={() => {
          if (baja) eliminarProvinciaImpuestos(baja.id);
          setBaja(null);
        }}
      />
    </div>
  );
}
