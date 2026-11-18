"use client";

import { useState } from "react";
import { cajaStores, siguienteId, useDenominaciones } from "@/lib/caja-store";
import { NOMBRE_MONEDA, SIMBOLO, type Denominacion, type Moneda } from "@/lib/caja-tipos";
import { formatNumber, onlyDigits } from "@/lib/format";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { AbmCaja, ModalFormulario, persistir, type Accion, type Columna, type EstadoDef } from "./AbmCaja";

const ENTIDAD = "Denominación";

const ESTADOS: EstadoDef[] = [
  { valor: "ACTIVA", label: "Activa", grupo: "Activas", tone: "success", abierto: true },
  { valor: "INACTIVA", label: "Inactiva", grupo: "Inactivas", tone: "neutral", abierto: false },
];

const acciones = (d: Denominacion): Accion[] =>
  d.estado === "ACTIVA" ? [{ estado: "INACTIVA", label: "Desactivar", peligro: true }] : [{ estado: "ACTIVA", label: "Activar" }];

const COLUMNAS: Columna<Denominacion>[] = [
  { clave: "moneda", label: "Moneda", valor: (d) => NOMBRE_MONEDA[d.moneda] },
  { clave: "tipo", label: "Tipo", valor: (d) => (d.tipo === "BILLETE" ? "Billete" : "Moneda") },
  { clave: "valor", label: "Valor", valor: (d) => d.valor, render: (d) => `${SIMBOLO[d.moneda]} ${formatNumber(d.valor)}` },
];

const nombreDe = (d: Denominacion) => `${d.tipo === "BILLETE" ? "Billete" : "Moneda"} de ${SIMBOLO[d.moneda]} ${formatNumber(d.valor)}`;

function FormularioDenominacion({ inicial, onClose }: { inicial: Denominacion | null; onClose: () => void }) {
  const lista = useDenominaciones();
  const [moneda, setMoneda] = useState<Moneda>(inicial?.moneda ?? "ARS");
  const [tipo, setTipo] = useState<Denominacion["tipo"]>(inicial?.tipo ?? "BILLETE");
  const [valor, setValor] = useState(inicial ? String(inicial.valor) : "");
  const [intentado, setIntentado] = useState(false);

  const numero = Number(onlyDigits(valor));
  let error: string | undefined;
  if (!(numero > 0)) error = "Ingresá un valor mayor a cero.";
  else if (lista.some((d) => d.id !== inicial?.id && d.moneda === moneda && d.tipo === tipo && d.valor === numero))
    error = "Ya existe esa denominación para la moneda y el tipo elegidos.";

  const grabar = () => {
    setIntentado(true);
    if (error) return;
    const base = { moneda, tipo, valor: numero };
    persistir(
      cajaStores.denominaciones,
      ENTIDAD,
      inicial,
      inicial ? { ...inicial, ...base } : { ...base, id: siguienteId("DEN", lista.map((d) => d.id)), estado: "ACTIVA" }
    );
    onClose();
  };

  return (
    <ModalFormulario titulo={inicial ? `Modificar ${nombreDe(inicial)}` : "Nueva denominación"} onClose={onClose} onGrabar={grabar} maxWidth="max-w-lg">
      <div className="grid gap-4 sm:grid-cols-2">
        {inicial && <FormField id="den-id" label="ID" value={inicial.id} onChange={() => {}} disabled hint="Lo asigna el sistema." className="sm:col-span-2" />}
        <SelectField id="den-moneda" label="Moneda" required value={moneda} onChange={(v) => setMoneda(v as Moneda)} options={[{ value: "ARS", label: "Pesos" }, { value: "USD", label: "Dólares" }]} />
        <SelectField id="den-tipo" label="Tipo" required value={tipo} onChange={(v) => setTipo(v as Denominacion["tipo"])} options={[{ value: "BILLETE", label: "Billete" }, { value: "MONEDA", label: "Moneda" }]} />
        <FormField
          id="den-valor"
          label="Valor"
          required
          inputMode="numeric"
          value={numero > 0 ? formatNumber(numero) : valor}
          onChange={setValor}
          placeholder="Ej.: 20.000"
          error={intentado ? error : undefined}
          hint="Sólo las denominaciones activas aparecen en los recuentos."
          className="sm:col-span-2"
        />
      </div>
    </ModalFormulario>
  );
}

export function Denominaciones() {
  const lista = useDenominaciones();
  return (
    <div>
      <p className="mb-5 max-w-2xl text-sm text-ink-500">
        Billetes y monedas que se cuentan en la apertura, el cierre, el arqueo y el relevo. Una denominación inactiva deja de ofrecerse en los
        recuentos.
      </p>
      <AbmCaja<Denominacion>
        entidad={ENTIDAD}
        archivo="denominaciones"
        singular="denominación"
        plural="denominaciones"
        nuevoLabel="Nueva denominación"
        registros={lista}
        store={cajaStores.denominaciones}
        columnas={COLUMNAS}
        estados={ESTADOS}
        nombreDe={nombreDe}
        acciones={acciones}
        formulario={(p) => <FormularioDenominacion key={p.inicial?.id ?? "nuevo"} {...p} />}
      />
    </div>
  );
}
