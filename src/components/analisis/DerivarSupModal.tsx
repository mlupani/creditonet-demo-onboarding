"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { ROLES, esSuperior, type Rol } from "@/lib/roles";
import { useRol } from "@/lib/rol-context";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { mostrarToast } from "@/lib/toast";

// SUP → otro SUP (creditonet-115): el superior a cargo pasa el caso a un colega, que queda como
// responsable; él pasa a sólo lectura. Sólo se ofrece al superior que tiene el caso.
export function BotonDerivarSup({ onDerivado }: { onDerivado?: () => void }) {
  const { derivarASuperior } = useApplication();
  const { rol } = useRol();
  const [abierto, setAbierto] = useState(false);
  const destinos = (Object.keys(ROLES) as Rol[]).filter((r) => esSuperior(r) && r !== rol);
  const [destino, setDestino] = useState<string>(destinos[0] ? ROLES[destinos[0]].sesion.nombre : "");
  if (!esSuperior(rol) || destinos.length === 0) return null;

  function confirmar() {
    derivarASuperior(destino);
    setAbierto(false);
    mostrarToast(`Solicitud derivada a ${destino}`);
    onDerivado?.();
  }

  return (
    <>
      <Button variant="outline" onClick={() => setAbierto(true)}>
        Derivar a otro SUP
      </Button>
      <Modal
        open={abierto}
        onClose={() => setAbierto(false)}
        title="Derivar a otro SUP"
        maxWidth="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmar} disabled={!destino}>
              Derivar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-600">
          El superior elegido queda a cargo de la solicitud y vos pasás a verla en modo consulta.
        </p>
        <div className="mt-3 space-y-2">
          {destinos.map((r) => {
            const nombre = ROLES[r].sesion.nombre;
            return (
              <label
                key={r}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-800 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
              >
                <input type="radio" name="destino-sup" checked={destino === nombre} onChange={() => setDestino(nombre)} />
                {nombre}
              </label>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
