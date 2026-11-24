"use client";

import { useState } from "react";
import { CUENTAS_CONTABLES, TIPO_REFUERZO_ID } from "@/lib/caja-datos";
import { nombreRepetido } from "@/lib/caja-reglas";
import { cajaStores, siguienteId, useTiposMovimiento } from "@/lib/caja-store";
import { TIPO_CAJA_LABEL, type PuntaMovimiento, type TipoCaja, type TipoMovimientoTesoreria } from "@/lib/caja-tipos";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
import { AbmCaja, ESTADOS_TRES, ModalFormulario, persistir, type Columna } from "./AbmCaja";

const ENTIDAD = "Tipo de movimiento";

const TIPOS_CAJA = Object.keys(TIPO_CAJA_LABEL) as TipoCaja[];
const LABEL_PUNTA: Record<PuntaMovimiento, string> = { ...TIPO_CAJA_LABEL, BANCO: "Banco" };
const cuentas = CUENTAS_CONTABLES.map((c) => ({ value: c.codigo, label: `${c.codigo} · ${c.nombre}` }));

const COLUMNAS: Columna<TipoMovimientoTesoreria>[] = [
  { clave: "descripcion", label: "Descripción", valor: (t) => t.descripcion },
  { clave: "origenes", label: "Origen permitido", valor: (t) => (t.origenBanco ? "Banco (cuenta)" : t.origenes.map((o) => LABEL_PUNTA[o]).join(", ")) },
  { clave: "destinos", label: "Destino permitido", valor: (t) => t.destinos.map((o) => LABEL_PUNTA[o]).join(", ") },
  { clave: "autorizacion", label: "Autorización", ancho: "w-28", valor: (t) => (t.requiereAutorizacion ? "Sí" : "No") },
  { clave: "transito", label: "Cuenta de tránsito", valor: (t) => t.cuentaTransito },
];

const alternar = <T,>(lista: T[], valor: T, marcado: boolean) => (marcado ? [...lista, valor] : lista.filter((x) => x !== valor));

function FormularioTipo({ inicial, onClose }: { inicial: TipoMovimientoTesoreria | null; onClose: () => void }) {
  const lista = useTiposMovimiento();
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [origenes, setOrigenes] = useState<TipoCaja[]>(inicial?.origenes ?? []);
  const [destinos, setDestinos] = useState<PuntaMovimiento[]>(inicial?.destinos ?? []);
  const [requiere, setRequiere] = useState(inicial?.requiereAutorizacion ?? true);
  const [origenBanco, setOrigenBanco] = useState(inicial?.origenBanco ?? false);
  const [cuentaTransito, setCuentaTransito] = useState(inicial?.cuentaTransito ?? "");
  const [intentado, setIntentado] = useState(false);

  const errores: Record<string, string> = {};
  if (!descripcion.trim()) errores.descripcion = "Ingresá la descripción del tipo.";
  else if (nombreRepetido(descripcion, lista.map((t) => ({ id: t.id, nombre: t.descripcion })), inicial?.id))
    errores.descripcion = "Ya existe un tipo con esa descripción.";
  if (!origenBanco && origenes.length === 0) errores.origenes = "Elegí al menos un origen permitido.";
  if (destinos.length === 0) errores.destinos = "Elegí al menos un destino permitido.";
  if (!cuentaTransito) errores.cuenta = "Elegí la cuenta contable de tránsito.";
  const e = (k: string) => (intentado ? errores[k] : undefined);

  const grabar = () => {
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    const orden = (l: PuntaMovimiento[]) => [...TIPOS_CAJA, "BANCO" as const].filter((p) => l.includes(p));
    const base = {
      descripcion: descripcion.trim().replace(/\s+/g, " "),
      origenes: origenBanco ? [] : TIPOS_CAJA.filter((t) => origenes.includes(t)),
      destinos: orden(destinos),
      requiereAutorizacion: requiere,
      cuentaTransito,
      ...(origenBanco ? { origenBanco: true } : {}),
    };
    persistir(
      cajaStores.tipos,
      ENTIDAD,
      inicial,
      inicial ? { ...inicial, ...base } : { ...base, id: siguienteId("TMT", lista.map((t) => t.id)), estado: "ACTIVO" }
    );
    onClose();
  };

  return (
    <ModalFormulario titulo={inicial ? `Modificar ${inicial.descripcion}` : "Nuevo tipo de movimiento"} onClose={onClose} onGrabar={grabar} maxWidth="max-w-2xl">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {inicial && <FormField id="tmt-id" label="ID" value={inicial.id} onChange={() => {}} disabled hint="Lo asigna el sistema." />}
          <FormField id="tmt-desc" label="Descripción" required value={descripcion} onChange={setDescripcion} placeholder="Ej.: Remesa" error={e("descripcion")} />
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-ink-700">Origen permitido</legend>
          <div className="mt-2">
            <Checkbox
              label="Banco como origen"
              description="Pedido de refuerzo a banco: el tesoro pide fondos de una cuenta bancaria. Los destinos son los tesoros que los reciben."
              checked={origenBanco}
              onChange={setOrigenBanco}
            />
          </div>
          {!origenBanco && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {TIPOS_CAJA.map((t) => (
                <Checkbox key={t} label={TIPO_CAJA_LABEL[t]} checked={origenes.includes(t)} onChange={(v) => setOrigenes((l) => alternar(l, t, v))} />
              ))}
            </div>
          )}
          {e("origenes") && <div className="mt-2"><ValidationMessage tipo="error">{e("origenes")}</ValidationMessage></div>}
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium text-ink-700">Destino permitido</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {([...TIPOS_CAJA, "BANCO"] as PuntaMovimiento[]).map((t) => (
              <Checkbox key={t} label={LABEL_PUNTA[t]} checked={destinos.includes(t)} onChange={(v) => setDestinos((l) => alternar(l, t, v))} />
            ))}
          </div>
          {e("destinos") && <div className="mt-2"><ValidationMessage tipo="error">{e("destinos")}</ValidationMessage></div>}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="tmt-aut"
            label="Requiere autorización"
            required
            value={requiere ? "SI" : "NO"}
            onChange={(v) => setRequiere(v === "SI")}
            options={[{ value: "SI", label: "Sí" }, { value: "NO", label: "No" }]}
          />
          <SelectField id="tmt-cuenta" label="Cuenta contable de tránsito" required value={cuentaTransito} onChange={setCuentaTransito} options={cuentas} error={e("cuenta")} hint="Cuenta puente mientras el dinero está en camino." />
        </div>
      </div>
    </ModalFormulario>
  );
}

export function TiposMovimiento() {
  const lista = useTiposMovimiento();
  return (
    <div>
      <p className="mb-5 max-w-2xl text-sm text-ink-500">
        Cada tipo es un único movimiento con dos lados: la salida del origen y la recepción del destino. Define qué puntas admite y si necesita
        autorización de un supervisor.
      </p>
      <AbmCaja<TipoMovimientoTesoreria>
        entidad={ENTIDAD}
        archivo="tipos-movimiento-tesoreria"
        singular="tipo"
        plural="tipos"
        nuevoLabel="Nuevo tipo"
        registros={lista}
        store={cajaStores.tipos}
        columnas={COLUMNAS}
        estados={ESTADOS_TRES}
        nombreDe={(t) => t.descripcion}
        errorAccion={(t, a) =>
          t.id === TIPO_REFUERZO_ID && (a.estado === "SUSPENDIDO" || a.estado === "ELIMINADO")
            ? "Los pedidos de refuerzo generan el envío con este tipo, así que tiene que seguir activo."
            : undefined
        }
        formulario={(p) => <FormularioTipo key={p.inicial?.id ?? "nuevo"} {...p} />}
      />
    </div>
  );
}
