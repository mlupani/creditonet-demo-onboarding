"use client";

import { useState } from "react";
import { cajaStores, hoy, siguienteId, useChequeras, useCuentasBancarias, useTiposChequera, usuarioActual } from "@/lib/caja-store";
import type { Chequera, CuentaBancaria } from "@/lib/caja-tipos";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { AbmCaja, ESTADOS_TRES, ModalFormulario, persistir, type Columna } from "./abm/AbmCaja";
import { PaginaCaja } from "./comunes";

const ENTIDAD = "Chequera";

const textoCuenta = (c: CuentaBancaria | undefined) => (c ? `${c.numero} (${c.moneda})` : "—");
const soloDigitos = (v: string) => v.replace(/\D/g, "").slice(0, 12);

function FormularioChequera({ inicial, onClose }: { inicial: Chequera | null; onClose: () => void }) {
  const lista = useChequeras();
  const tipos = useTiposChequera();
  const cuentas = useCuentasBancarias();
  const cuentaInicial = cuentas.find((c) => c.id === inicial?.cuentaId);
  const [tipoId, setTipoId] = useState(inicial?.tipoId ?? "");
  const [banco, setBanco] = useState(cuentaInicial?.banco ?? "");
  const [cuentaId, setCuentaId] = useState(inicial?.cuentaId ?? "");
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoy());
  const [desde, setDesde] = useState(inicial?.desde ?? "");
  const [hasta, setHasta] = useState(inicial?.hasta ?? "");
  const [intentado, setIntentado] = useState(false);

  const activas = cuentas.filter((c) => c.estado === "ACTIVO" || c.id === inicial?.cuentaId);
  const bancos = [...new Set(activas.map((c) => c.banco))].sort((a, b) => a.localeCompare(b, "es"));
  const cuentasDelBanco = activas.filter((c) => c.banco === banco);
  const tiposDisponibles = tipos.filter((t) => t.estado === "ACTIVO" || t.id === inicial?.tipoId);
  const esEcheq = tipos.find((t) => t.id === tipoId)?.descripcion.toLowerCase().replace("-", "") === "echeq";

  const errores: Record<string, string> = {};
  if (!tipoId) errores.tipoId = "Elegí el tipo de chequera.";
  if (!banco) errores.banco = "Elegí el banco.";
  if (!cuentaId) errores.cuentaId = "Elegí la cuenta.";
  if (!fecha) errores.fecha = "Ingresá la fecha de alta.";
  const d = Number(desde);
  const h = Number(hasta);
  if (!esEcheq && !desde) errores.desde = "Ingresá el número inicial.";
  if (!esEcheq && !hasta) errores.hasta = "Ingresá el número final.";
  if (desde && hasta && d > h) errores.hasta = "El número final debe ser mayor o igual al inicial.";
  if (esEcheq && !!desde !== !!hasta) errores.hasta = "Completá ambos extremos del rango o dejá los dos vacíos.";
  if (!errores.desde && !errores.hasta && desde && hasta) {
    const choca = lista.find(
      (c) => c.id !== inicial?.id && c.estado !== "ELIMINADO" && c.cuentaId === cuentaId && c.desde && c.hasta && d <= Number(c.hasta) && h >= Number(c.desde)
    );
    if (choca) errores.desde = `El rango se superpone con la chequera ${choca.id} (${choca.desde} a ${choca.hasta}).`;
  }
  const e = (k: string) => (intentado ? errores[k] : undefined);

  const grabar = () => {
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    const base = { tipoId, cuentaId, fecha, desde, hasta };
    persistir(
      cajaStores.chequeras,
      ENTIDAD,
      inicial,
      inicial
        ? { ...inicial, ...base }
        : { ...base, id: siguienteId("CHQ", lista.map((c) => c.id)), estado: "ACTIVO", fechaAlta: hoy(), usuarioAlta: usuarioActual().nombre }
    );
    onClose();
  };

  return (
    <ModalFormulario titulo={inicial ? `Modificar chequera ${inicial.id}` : "Nueva chequera"} onClose={onClose} onGrabar={grabar} maxWidth="max-w-lg">
      <div className="grid gap-4 sm:grid-cols-2">
        {inicial && <FormField id="chq-id" label="ID" value={inicial.id} onChange={() => {}} disabled hint="Lo asigna el sistema." className="sm:col-span-2" />}
        <SelectField
          id="chq-tipo"
          label="Tipo de chequera"
          required
          value={tipoId}
          onChange={setTipoId}
          placeholder="Elegí un tipo"
          options={tiposDisponibles.map((t) => ({ value: t.id, label: t.descripcion }))}
          error={e("tipoId")}
        />
        <FormField id="chq-fecha" label="Fecha de alta" type="date" required value={fecha} onChange={setFecha} error={e("fecha")} />
        <SelectField
          id="chq-banco"
          label="Banco"
          required
          value={banco}
          onChange={(v) => {
            setBanco(v);
            setCuentaId("");
          }}
          placeholder="Elegí un banco"
          options={bancos.map((b) => ({ value: b, label: b }))}
          error={e("banco")}
        />
        <SelectField
          id="chq-cuenta"
          label="Cuenta"
          required
          value={cuentaId}
          onChange={setCuentaId}
          placeholder={banco ? "Elegí una cuenta" : "Elegí primero el banco"}
          disabled={!banco}
          options={cuentasDelBanco.map((c) => ({ value: c.id, label: textoCuenta(c) }))}
          error={e("cuentaId")}
        />
        <FormField
          id="chq-desde"
          label="Número desde"
          required={!esEcheq}
          inputMode="numeric"
          value={desde}
          onChange={(v) => setDesde(soloDigitos(v))}
          error={e("desde")}
          hint={esEcheq ? "Opcional para e-cheq." : undefined}
        />
        <FormField id="chq-hasta" label="Número hasta" required={!esEcheq} inputMode="numeric" value={hasta} onChange={(v) => setHasta(soloDigitos(v))} error={e("hasta")} />
      </div>
    </ModalFormulario>
  );
}

export function PantallaChequeras() {
  const lista = useChequeras();
  const tipos = useTiposChequera();
  const cuentas = useCuentasBancarias();
  const cuentaDe = (c: Chequera) => cuentas.find((x) => x.id === c.cuentaId);

  const columnas: Columna<Chequera>[] = [
    { clave: "tipo", label: "Tipo", valor: (c) => tipos.find((t) => t.id === c.tipoId)?.descripcion ?? c.tipoId },
    { clave: "banco", label: "Banco", valor: (c) => cuentaDe(c)?.banco ?? "—" },
    { clave: "cuenta", label: "Cuenta", valor: (c) => textoCuenta(cuentaDe(c)) },
    { clave: "fecha", label: "Fecha de alta", valor: (c) => c.fecha },
    { clave: "desde", label: "Desde", valor: (c) => c.desde || "—" },
    { clave: "hasta", label: "Hasta", valor: (c) => c.hasta || "—" },
  ];

  return (
    <PaginaCaja seccion="Bancos" titulo="Alta de chequeras" descripcion="Registro de chequeras físicas y de e-cheq por cuenta bancaria, con su rango de numeración.">
      <AbmCaja<Chequera>
        entidad={ENTIDAD}
        archivo="chequeras"
        singular="chequera"
        plural="chequeras"
        nuevoLabel="Nueva chequera"
        registros={lista}
        store={cajaStores.chequeras}
        columnas={columnas}
        estados={ESTADOS_TRES}
        nombreDe={(c) => `${tipos.find((t) => t.id === c.tipoId)?.descripcion ?? ""} ${cuentaDe(c)?.banco ?? ""} ${textoCuenta(cuentaDe(c))}`.trim()}
        formulario={(p) => <FormularioChequera key={p.inicial?.id ?? "nuevo"} {...p} />}
      />
    </PaginaCaja>
  );
}
