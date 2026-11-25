"use client";

import { useState } from "react";
import { cajaStores, hoy, siguienteId, useAcuerdos, useCuentasBancarias, usuarioActual } from "@/lib/caja-store";
import type { AcuerdoBancario, CuentaBancaria } from "@/lib/caja-tipos";
import { isoAFecha } from "@/lib/format";
import { FormField } from "@/components/ui/FormField";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { SelectField } from "@/components/ui/SelectField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AbmCaja, ESTADOS_TRES, ModalFormulario, persistir, type Columna } from "./abm/AbmCaja";
import { PaginaCaja, dinero } from "./comunes";

const ENTIDAD = "Acuerdo bancario";
const DIAS_AVISO = 30;

const textoCuenta = (c: CuentaBancaria | undefined) => (c ? `${c.banco} · ${c.numero} (${c.moneda})` : "—");

// Días que faltan para el vencimiento, desde la fecha operativa de la demo.
const diasHasta = (fecha: string) => Math.round((Date.parse(`${fecha}T00:00:00`) - Date.parse(`${hoy()}T00:00:00`)) / 86400000);

function FormularioAcuerdo({ inicial, onClose }: { inicial: AcuerdoBancario | null; onClose: () => void }) {
  const lista = useAcuerdos();
  const cuentas = useCuentasBancarias().filter((c) => c.estado === "ACTIVO" || c.id === inicial?.cuentaId);
  const [cuentaId, setCuentaId] = useState(inicial?.cuentaId ?? "");
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoy());
  const [importe, setImporte] = useState(inicial?.importe ?? 0);
  const [tasa, setTasa] = useState(inicial ? String(inicial.tasa).replace(".", ",") : "");
  const [vencimiento, setVencimiento] = useState(inicial?.vencimiento ?? "");
  const [intentado, setIntentado] = useState(false);

  const tasaNum = Number(tasa.replace(",", "."));
  const errores: Record<string, string> = {};
  if (!cuentaId) errores.cuentaId = "Elegí la cuenta bancaria.";
  if (!fecha) errores.fecha = "Ingresá la fecha de otorgamiento.";
  if (!(importe > 0)) errores.importe = "Ingresá un importe mayor a cero.";
  if (tasa.trim() === "" || !Number.isFinite(tasaNum) || tasaNum < 0) errores.tasa = "Ingresá la tasa (por ejemplo 62,5).";
  if (!vencimiento) errores.vencimiento = "Ingresá el vencimiento.";
  else if (fecha && vencimiento <= fecha) errores.vencimiento = "El vencimiento debe ser posterior a la fecha del acuerdo.";
  const e = (k: string) => (intentado ? errores[k] : undefined);
  const moneda = cuentas.find((c) => c.id === cuentaId)?.moneda;

  const grabar = () => {
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    const base = { cuentaId, fecha, importe, tasa: tasaNum, vencimiento };
    persistir(
      cajaStores.acuerdos,
      ENTIDAD,
      inicial,
      inicial
        ? { ...inicial, ...base }
        : { ...base, id: siguienteId("ACU", lista.map((a) => a.id)), estado: "ACTIVO", fechaAlta: hoy(), usuarioAlta: usuarioActual().nombre }
    );
    onClose();
  };

  return (
    <ModalFormulario titulo={inicial ? `Modificar acuerdo ${inicial.id}` : "Nuevo acuerdo"} onClose={onClose} onGrabar={grabar} maxWidth="max-w-lg">
      <div className="grid gap-4 sm:grid-cols-2">
        {inicial && <FormField id="acu-id" label="ID" value={inicial.id} onChange={() => {}} disabled hint="Lo asigna el sistema." className="sm:col-span-2" />}
        <SelectField
          id="acu-cuenta"
          label="Cuenta bancaria"
          required
          value={cuentaId}
          onChange={setCuentaId}
          placeholder="Elegí una cuenta"
          options={cuentas.map((c) => ({ value: c.id, label: textoCuenta(c) }))}
          error={e("cuentaId")}
          className="sm:col-span-2"
        />
        <FormField id="acu-fecha" label="Fecha de otorgamiento" type="date" required value={fecha} onChange={setFecha} error={e("fecha")} />
        <FormField id="acu-venc" label="Vencimiento" type="date" required value={vencimiento} onChange={setVencimiento} error={e("vencimiento")} />
        <MoneyInput id="acu-importe" label={`Importe${moneda ? ` (${moneda})` : ""}`} required value={importe} onChange={setImporte} error={e("importe")} />
        <FormField id="acu-tasa" label="Tasa (%)" required inputMode="numeric" value={tasa} onChange={(v) => setTasa(v.replace(/[^\d,]/g, ""))} placeholder="Ej.: 62,5" error={e("tasa")} />
      </div>
    </ModalFormulario>
  );
}

export function PantallaAcuerdos() {
  const lista = useAcuerdos();
  const cuentas = useCuentasBancarias();
  const cuentaDe = (a: AcuerdoBancario) => cuentas.find((c) => c.id === a.cuentaId);

  const columnas: Columna<AcuerdoBancario>[] = [
    { clave: "cuenta", label: "Cuenta bancaria", valor: (a) => textoCuenta(cuentaDe(a)) },
    { clave: "fecha", label: "Fecha", valor: (a) => a.fecha, render: (a) => isoAFecha(a.fecha) },
    { clave: "importe", label: "Importe", valor: (a) => a.importe, render: (a) => dinero(cuentaDe(a)?.moneda ?? "ARS", a.importe) },
    { clave: "tasa", label: "Tasa", valor: (a) => a.tasa, render: (a) => `${String(a.tasa).replace(".", ",")} %` },
    {
      clave: "vencimiento",
      label: "Vencimiento",
      valor: (a) => a.vencimiento,
      render: (a) => {
        const d = diasHasta(a.vencimiento);
        return (
          <span className="inline-flex flex-wrap items-center gap-2">
            {isoAFecha(a.vencimiento)}
            {a.estado === "ACTIVO" && d < 0 && <StatusBadge tone="danger">Vencido</StatusBadge>}
            {a.estado === "ACTIVO" && d >= 0 && d <= DIAS_AVISO && <StatusBadge tone="warning">Vence en {d} {d === 1 ? "día" : "días"}</StatusBadge>}
          </span>
        );
      },
    },
  ];

  return (
    <PaginaCaja seccion="Bancos" titulo="Alta de acuerdos" descripcion="Registro de los acuerdos bancarios de cada cuenta: importe otorgado, tasa y vencimiento.">
      <AbmCaja<AcuerdoBancario>
        entidad={ENTIDAD}
        archivo="acuerdos-bancarios"
        singular="acuerdo"
        plural="acuerdos"
        nuevoLabel="Nuevo acuerdo"
        registros={lista}
        store={cajaStores.acuerdos}
        columnas={columnas}
        estados={ESTADOS_TRES}
        nombreDe={(a) => `${textoCuenta(cuentaDe(a))} · ${dinero(cuentaDe(a)?.moneda ?? "ARS", a.importe)}`}
        formulario={(p) => <FormularioAcuerdo key={p.inicial?.id ?? "nuevo"} {...p} />}
      />
    </PaginaCaja>
  );
}
