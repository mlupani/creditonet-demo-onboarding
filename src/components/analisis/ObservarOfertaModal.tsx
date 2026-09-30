"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { pantallasVisibles } from "@/lib/config";
import type { PantallaPostOfertaId } from "@/lib/types";
import { useMotivosObservacion } from "@/lib/motivos-observacion";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { MultiSelectField } from "@/components/ui/MultiSelectField";
import { SelectField } from "@/components/ui/SelectField";
import { AreaTexto, PANTALLAS_OBSERVABLES } from "./AnalisisCredito";

// Observar desde Confirmar oferta (COFE): el crédito vuelve al vendedor en estado Observado,
// igual que la observación del análisis. Las pantallas observables no tienen catálogo de
// campos, así que alcanza con motivo, pantallas y nota.
export function ObservarOfertaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { app, observarCredito } = useApplication();
  const motivosObservacion = useMotivosObservacion();
  const [motivo, setMotivo] = useState("");
  const [pantallas, setPantallas] = useState<PantallaPostOfertaId[]>([]);
  const [texto, setTexto] = useState("");
  const [intentado, setIntentado] = useState(false);

  const observables = pantallasVisibles(app.configuracion).filter((pv) =>
    PANTALLAS_OBSERVABLES.includes(pv.id)
  );
  const textoValido = texto.trim().length >= 5;

  function cerrar() {
    setMotivo("");
    setPantallas([]);
    setTexto("");
    setIntentado(false);
    onClose();
  }

  function confirmar() {
    setIntentado(true);
    if (!motivo || !textoValido || pantallas.length === 0) return;
    observarCredito(motivo, texto.trim(), pantallas, {});
    cerrar();
  }

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title="Observar la solicitud"
      maxWidth="max-w-md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button onClick={confirmar}>Devolver al canal de venta</Button>
        </div>
      }
    >
      <p className="text-sm text-ink-600">
        En lugar de confirmar la oferta, la solicitud vuelve a la bandeja del vendedor en estado
        Observado, con tus notas. Tendrá 15 días para corregir y reenviar.
      </p>
      <div className="mt-4">
        <SelectField
          id="motivo-observar-oferta"
          label="Motivo"
          required
          value={motivo}
          onChange={setMotivo}
          options={motivosObservacion.map((m) => ({ value: m.nombre, label: m.nombre }))}
          error={intentado && !motivo ? "Seleccioná un motivo." : undefined}
        />
      </div>
      <div className="mt-4">
        <MultiSelectField
          id="pantallas-observar-oferta"
          label="Pantallas a corregir"
          required
          placeholder="Seleccioná pantallas…"
          values={observables.filter((pv) => pantallas.includes(pv.id)).map((pv) => pv.label)}
          onChange={(labels) =>
            setPantallas(observables.filter((pv) => labels.includes(pv.label)).map((pv) => pv.id))
          }
          options={observables.map((pv) => pv.label)}
          error={
            intentado && pantallas.length === 0
              ? "Seleccioná al menos una pantalla a corregir."
              : undefined
          }
          hint="El vendedor sólo puede editar estas pantallas hasta que reenvíe."
        />
      </div>
      <AreaTexto
        id="texto-observar-oferta"
        label="Nota para el vendedor"
        value={texto}
        onChange={setTexto}
        invalido={intentado && !textoValido}
        placeholder="Ej.: Falta el recibo de sueldo del garante para confirmar la oferta."
        error="Ingresá al menos 5 caracteres para que el registro sea claro."
      />
    </Modal>
  );
}
