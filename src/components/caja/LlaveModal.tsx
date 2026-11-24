"use client";

import { useState } from "react";
import { USUARIOS_CAJA } from "@/lib/caja-datos";
import { usuarioPorId } from "@/lib/caja-store";
import { ROL_CAJA_LABEL, type Moneda } from "@/lib/caja-tipos";
import type { Firma } from "@/lib/control-tipos";
import { esCasaCentral, firmar, rolDeFirma } from "@/lib/llave";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ErrorBanner } from "./comunes";
import { Campo, INPUT_COMPACTO } from "./compacto";
import { LlaveCampos } from "./LlaveCampos";

// Qué se está firmando. El usuario que cargó la operación (`cargadoPor`) no puede firmarla.
export interface DatosFirma {
  operacion: string;
  referencia: string;
  importe?: number;
  moneda?: Moneda;
  cargadoPor?: string;
  remota?: boolean;
}

// Pide la llave de autorización (R6) a un usuario y devuelve la firma registrada. Con `usuarioId` el
// firmante es fijo (el usuario que está actuando); sin él se elige de la lista, y con `datos.remota`
// sólo se ofrecen usuarios de Casa Central (segunda firma remota).
export function LlaveModal({
  open,
  titulo,
  descripcion,
  datos,
  usuarioId,
  confirmar = "Firmar",
  onFirmada,
  onClose,
}: {
  open: boolean;
  titulo: string;
  descripcion?: string;
  datos: DatosFirma;
  usuarioId?: string;
  confirmar?: string;
  // Devuelve un error para mostrar o null/undefined si salió bien.
  onFirmada: (firma: Firma) => string | null | void;
  onClose: () => void;
}) {
  const candidatos = USUARIOS_CAJA.filter((u) => u.id !== datos.cargadoPor && (!datos.remota || esCasaCentral(u)));
  const [elegido, setElegido] = useState("");
  const [clave, setClave] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const firmante = usuarioId ?? (candidatos.some((u) => u.id === elegido) ? elegido : (candidatos[0]?.id ?? ""));
  const usuario = usuarioPorId(firmante);

  const cerrar = () => {
    setClave("");
    setCodigo("");
    setError(null);
    onClose();
  };
  const confirmarFirma = () => {
    const r = firmar({ usuarioId: firmante, clave, codigo, ...datos });
    if (!r.ok) return setError(r.error);
    const e = onFirmada(r.firma);
    if (e) return setError(e);
    cerrar();
  };

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title={titulo}
      maxWidth="max-w-lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button size="sm" variant="navyOutline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button size="sm" variant="success" onClick={confirmarFirma}>{confirmar}</Button>
        </div>
      }
    >
      {descripcion && <p className="mb-3 text-xs text-ink-600">{descripcion}</p>}
      {datos.remota && (
        <Banner tone="warning" title="Autorización remota — sin verificación física" className="mb-3">
          La firma remota de Casa Central no equivale a la recepción ni a la verificación física del efectivo: queda marcada así en el acta.
        </Banner>
      )}
      {usuarioId ? (
        <p className="text-xs text-ink-700">
          Firma: <span className="font-semibold">{usuario?.nombre}</span>
          {usuario && <span className="text-ink-500"> · {ROL_CAJA_LABEL[rolDeFirma(usuario)]}</span>}
        </p>
      ) : (
        <Campo label="Usuario que firma">
          <select value={firmante} onChange={(e) => setElegido(e.target.value)} aria-label="Usuario que firma" className={INPUT_COMPACTO}>
            {candidatos.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} · {ROL_CAJA_LABEL[rolDeFirma(u)]}
              </option>
            ))}
          </select>
        </Campo>
      )}
      <LlaveCampos usuarioId={firmante} clave={clave} codigo={codigo} onClave={setClave} onCodigo={setCodigo} />
      <ErrorBanner error={error} titulo="No se pudo firmar" />
    </Modal>
  );
}
