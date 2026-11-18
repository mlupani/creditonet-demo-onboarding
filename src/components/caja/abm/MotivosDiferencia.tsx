"use client";

import { useState } from "react";
import { CUENTAS_CONTABLES } from "@/lib/caja-datos";
import { nombreRepetido } from "@/lib/caja-reglas";
import { cajaStores, siguienteId, useMotivosDiferencia } from "@/lib/caja-store";
import type { MotivoDiferencia } from "@/lib/caja-tipos";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { AbmCaja, ESTADOS_TRES, ModalFormulario, persistir, type Columna } from "./AbmCaja";

const ENTIDAD = "Motivo de diferencia";

const cuentas = CUENTAS_CONTABLES.map((c) => ({ value: c.codigo, label: `${c.codigo} · ${c.nombre}` }));
const cuenta = (codigo: string) => {
  const c = CUENTAS_CONTABLES.find((x) => x.codigo === codigo);
  return c ? `${c.codigo} · ${c.nombre}` : codigo || "—";
};

const COLUMNAS: Columna<MotivoDiferencia>[] = [
  { clave: "descripcion", label: "Descripción", valor: (m) => m.descripcion },
  { clave: "sobrante", label: "Cuenta de sobrante", valor: (m) => cuenta(m.cuentaSobrante) },
  { clave: "faltante", label: "Cuenta de faltante", valor: (m) => cuenta(m.cuentaFaltante) },
];

function FormularioMotivo({ inicial, onClose }: { inicial: MotivoDiferencia | null; onClose: () => void }) {
  const lista = useMotivosDiferencia();
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [cuentaSobrante, setSobrante] = useState(inicial?.cuentaSobrante ?? "");
  const [cuentaFaltante, setFaltante] = useState(inicial?.cuentaFaltante ?? "");
  const [intentado, setIntentado] = useState(false);

  const errores: Record<string, string> = {};
  const normalizados = lista.map((m) => ({ id: m.id, nombre: m.descripcion }));
  if (!descripcion.trim()) errores.descripcion = "Ingresá la descripción del motivo.";
  else if (nombreRepetido(descripcion, normalizados, inicial?.id)) errores.descripcion = "Ya existe un motivo con esa descripción.";
  if (!cuentaSobrante) errores.sobrante = "Elegí la cuenta contable de sobrante.";
  if (!cuentaFaltante) errores.faltante = "Elegí la cuenta contable de faltante.";
  const e = (k: string) => (intentado ? errores[k] : undefined);

  const grabar = () => {
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    const base = { descripcion: descripcion.trim().replace(/\s+/g, " "), cuentaSobrante, cuentaFaltante };
    persistir(
      cajaStores.motivos,
      ENTIDAD,
      inicial,
      inicial ? { ...inicial, ...base } : { ...base, id: siguienteId("MDC", lista.map((m) => m.id)), estado: "ACTIVO" }
    );
    onClose();
  };

  return (
    <ModalFormulario titulo={inicial ? `Modificar ${inicial.descripcion}` : "Nuevo motivo de diferencia"} onClose={onClose} onGrabar={grabar} maxWidth="max-w-lg">
      <div className="space-y-4">
        {inicial && <FormField id="mdc-id" label="ID" value={inicial.id} onChange={() => {}} disabled hint="Lo asigna el sistema." />}
        <FormField id="mdc-desc" label="Descripción" required value={descripcion} onChange={setDescripcion} placeholder="Ej.: Error de vuelto, billete falso" error={e("descripcion")} />
        <SelectField id="mdc-sobrante" label="Cuenta contable de sobrante" required value={cuentaSobrante} onChange={setSobrante} options={cuentas} error={e("sobrante")} />
        <SelectField id="mdc-faltante" label="Cuenta contable de faltante" required value={cuentaFaltante} onChange={setFaltante} options={cuentas} error={e("faltante")} />
      </div>
    </ModalFormulario>
  );
}

export function MotivosDiferencia() {
  const lista = useMotivosDiferencia();
  return (
    <div>
      <p className="mb-5 max-w-2xl text-sm text-ink-500">
        Motivos que se eligen al cargar una diferencia de caja. Cada uno define la cuenta contable del sobrante y la del faltante para el
        movimiento de ajuste.
      </p>
      <AbmCaja<MotivoDiferencia>
        entidad={ENTIDAD}
        archivo="motivos-diferencia-caja"
        singular="motivo"
        plural="motivos"
        nuevoLabel="Nuevo motivo"
        registros={lista}
        store={cajaStores.motivos}
        columnas={COLUMNAS}
        estados={ESTADOS_TRES}
        nombreDe={(m) => m.descripcion}
        errorAccion={(m, a) =>
          (a.estado === "SUSPENDIDO" || a.estado === "ELIMINADO") && lista.filter((x) => x.estado === "ACTIVO" && x.id !== m.id).length === 0
            ? "Tiene que quedar al menos un motivo activo para cargar diferencias."
            : undefined
        }
        formulario={(p) => <FormularioMotivo key={p.inicial?.id ?? "nuevo"} {...p} />}
      />
    </div>
  );
}
