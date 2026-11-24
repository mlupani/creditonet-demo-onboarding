"use client";

import { useFechaDemo, useHoraDemo, usuarioPorId } from "@/lib/caja-store";
import { CLAVE_DEMO } from "@/lib/control-datos";
import { codigoTemporal } from "@/lib/llave";

const ETIQUETA = "mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-500";
const INPUT =
  "h-8 w-full rounded-md border border-ink-300 bg-white px-2.5 text-xs text-ink-800 outline-none transition hover:border-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

// Clave y segundo factor del usuario que firma, con el cartel de la demo (el código temporal se muestra
// porque no hay celular: se deriva de la fecha y la hora simuladas). Lo comparten el modal de la llave y
// los modales de aprobación.
export function LlaveCampos({
  usuarioId,
  clave,
  codigo,
  onClave,
  onCodigo,
}: {
  usuarioId: string;
  clave: string;
  codigo: string;
  onClave: (v: string) => void;
  onCodigo: (v: string) => void;
}) {
  const fecha = useFechaDemo();
  const hora = useHoraDemo();
  const usuario = usuarioPorId(usuarioId);
  return (
    <div className="mt-3 space-y-2.5 rounded-lg border border-dashed border-ink-300 bg-ink-25 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-brand-700">Llave de autorización</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={ETIQUETA}>Clave</span>
          <input type="password" value={clave} onChange={(e) => onClave(e.target.value)} autoComplete="off" aria-label="Clave" className={INPUT} />
        </label>
        <label className="block">
          <span className={ETIQUETA}>Código temporal (segundo factor)</span>
          <input
            type="text"
            inputMode="numeric"
            value={codigo}
            onChange={(e) => onCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoComplete="off"
            aria-label="Código temporal"
            className={INPUT}
          />
        </label>
      </div>
      <p className="text-[11px] leading-snug text-ink-500">
        Demo: la clave de todos los usuarios es <span className="font-mono font-semibold">{CLAVE_DEMO}</span>. El código temporal de{" "}
        {usuario?.nombre ?? "—"} es{" "}
        <span className="font-mono font-semibold">{usuario ? codigoTemporal(usuario.id, fecha, hora) : "—"}</span> (en producción llega al
        celular; acá cambia con la fecha y la hora simuladas). La firma registra usuario, rol, fecha, hora, equipo, importe y operación.
      </p>
    </div>
  );
}
