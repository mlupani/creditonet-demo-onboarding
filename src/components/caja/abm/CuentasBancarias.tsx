"use client";

import { useState } from "react";
import { CUENTAS_CONTABLES } from "@/lib/caja-datos";
import { cajaStores, hoy, siguienteId, useCuentasBancarias, useMovimientosTesoreria, usuarioActual } from "@/lib/caja-store";
import { NOMBRE_MONEDA, TIPO_CUENTA_LABEL, type CuentaBancaria, type Moneda } from "@/lib/caja-tipos";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { AbmCaja, ESTADOS_TRES, ModalFormulario, persistir, type Columna } from "./AbmCaja";

const ENTIDAD = "Cuenta bancaria";

// Las cuentas contables de bancos son las del grupo 1.1.03.
const cuentasBanco = CUENTAS_CONTABLES.filter((c) => c.codigo.startsWith("1.1.03")).map((c) => ({
  value: c.codigo,
  label: `${c.codigo} · ${c.nombre}`,
}));

const COLUMNAS: Columna<CuentaBancaria>[] = [
  { clave: "banco", label: "Banco", valor: (c) => c.banco },
  { clave: "tipo", label: "Tipo", valor: (c) => TIPO_CUENTA_LABEL[c.tipo] },
  { clave: "numero", label: "Número", valor: (c) => c.numero },
  { clave: "moneda", label: "Moneda", valor: (c) => NOMBRE_MONEDA[c.moneda] },
  { clave: "cuenta", label: "Cuenta contable", valor: (c) => c.cuentaContable },
];

function FormularioCuenta({ inicial, onClose }: { inicial: CuentaBancaria | null; onClose: () => void }) {
  const lista = useCuentasBancarias();
  const [banco, setBanco] = useState(inicial?.banco ?? "");
  const [tipo, setTipo] = useState<CuentaBancaria["tipo"]>(inicial?.tipo ?? "CUENTA_CORRIENTE");
  const [numero, setNumero] = useState(inicial?.numero ?? "");
  const [cbu, setCbu] = useState(inicial?.cbu ?? "");
  const [moneda, setMoneda] = useState<Moneda>(inicial?.moneda ?? "ARS");
  const [cuentaContable, setCuentaContable] = useState(inicial?.cuentaContable ?? "");
  const [intentado, setIntentado] = useState(false);

  const errores: Record<string, string> = {};
  if (!banco.trim()) errores.banco = "Ingresá el banco.";
  if (!numero.trim()) errores.numero = "Ingresá el número de cuenta.";
  else if (lista.some((c) => c.id !== inicial?.id && c.estado !== "ELIMINADO" && c.banco.toLowerCase() === banco.trim().toLowerCase() && c.numero === numero.trim()))
    errores.numero = "Ya existe esa cuenta en ese banco.";
  if (cbu && !/^\d{22}$/.test(cbu)) errores.cbu = "El CBU tiene 22 dígitos.";
  if (!cuentaContable) errores.cuentaContable = "Elegí la cuenta contable.";
  const e = (k: string) => (intentado ? errores[k] : undefined);

  const grabar = () => {
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    const base = { banco: banco.trim(), tipo, numero: numero.trim(), cbu, moneda, cuentaContable };
    persistir(
      cajaStores.cuentasBancarias,
      ENTIDAD,
      inicial,
      inicial
        ? { ...inicial, ...base }
        : { ...base, id: siguienteId("CB", lista.map((c) => c.id)), estado: "ACTIVO", fechaAlta: hoy(), usuarioAlta: usuarioActual().nombre }
    );
    onClose();
  };

  return (
    <ModalFormulario titulo={inicial ? `Modificar ${inicial.banco} ${inicial.numero}` : "Nueva cuenta bancaria"} onClose={onClose} onGrabar={grabar} maxWidth="max-w-lg">
      <div className="space-y-4">
        {inicial && <FormField id="cb-id" label="ID" value={inicial.id} onChange={() => {}} disabled hint="Lo asigna el sistema." />}
        <FormField id="cb-banco" label="Banco" required value={banco} onChange={setBanco} placeholder="Ej.: Banco Nación" error={e("banco")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="cb-tipo"
            label="Tipo de cuenta"
            required
            value={tipo}
            onChange={(v) => setTipo(v as CuentaBancaria["tipo"])}
            options={Object.entries(TIPO_CUENTA_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <SelectField
            id="cb-moneda"
            label="Moneda"
            required
            value={moneda}
            onChange={(v) => setMoneda(v as Moneda)}
            options={[
              { value: "ARS", label: NOMBRE_MONEDA.ARS },
              { value: "USD", label: NOMBRE_MONEDA.USD },
            ]}
          />
        </div>
        <FormField id="cb-numero" label="Número de cuenta" required value={numero} onChange={setNumero} placeholder="0110-4412-90" error={e("numero")} />
        <FormField id="cb-cbu" label="CBU" value={cbu} onChange={(v) => setCbu(v.replace(/\D/g, "").slice(0, 22))} inputMode="numeric" error={e("cbu")} hint="22 dígitos. Opcional." />
        <SelectField id="cb-cuenta" label="Cuenta contable" required value={cuentaContable} onChange={setCuentaContable} options={cuentasBanco} error={e("cuentaContable")} />
      </div>
    </ModalFormulario>
  );
}

export function CuentasBancarias() {
  const lista = useCuentasBancarias();
  const movimientos = useMovimientosTesoreria();
  return (
    <div>
      <p className="mb-5 max-w-2xl text-sm text-ink-500">
        Cuentas bancarias de la empresa. Son el destino de los depósitos en banco de la tesorería y la base de la conciliación de
        acreditaciones.
      </p>
      <AbmCaja<CuentaBancaria>
        entidad={ENTIDAD}
        archivo="cuentas-bancarias"
        singular="cuenta"
        plural="cuentas"
        nuevoLabel="Nueva cuenta"
        registros={lista}
        store={cajaStores.cuentasBancarias}
        columnas={COLUMNAS}
        estados={ESTADOS_TRES}
        nombreDe={(c) => `${c.banco} · ${c.numero}`}
        errorAccion={(c, a) => {
          if (a.estado !== "SUSPENDIDO" && a.estado !== "ELIMINADO") return undefined;
          const pendientes = movimientos.filter((m) => m.destino.tipo === "BANCO" && m.destino.cuentaId === c.id && m.envio && !m.conciliacion);
          return pendientes.length > 0 ? `La cuenta tiene ${pendientes.length} ${pendientes.length === 1 ? "depósito" : "depósitos"} sin conciliar.` : undefined;
        }}
        formulario={(p) => <FormularioCuenta key={p.inicial?.id ?? "nuevo"} {...p} />}
      />
    </div>
  );
}
