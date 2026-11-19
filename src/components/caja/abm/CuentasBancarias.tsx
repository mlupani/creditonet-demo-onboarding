"use client";

import { useState } from "react";
import { CUENTAS_CONTABLES } from "@/lib/caja-datos";
import {
  cajaStores,
  hoy,
  siguienteId,
  useAcuerdos,
  useChequeras,
  useCuentasBancarias,
  useMovimientosTesoreria,
  usuarioActual,
} from "@/lib/caja-store";
import { NOMBRE_MONEDA, TIPO_CUENTA_LABEL, type CuentaBancaria, type Moneda } from "@/lib/caja-tipos";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { AbmCaja, ESTADOS_TRES, ModalFormulario, persistir, type Columna } from "./AbmCaja";

const ENTIDAD = "Cuenta bancaria";
const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Las cuentas contables de bancos son las del grupo 1.1.03.
const cuentasBanco = CUENTAS_CONTABLES.filter((c) => c.codigo.startsWith("1.1.03")).map((c) => ({
  value: c.codigo,
  label: `${c.codigo} · ${c.nombre}`,
}));

const COLUMNAS: Columna<CuentaBancaria>[] = [
  { clave: "banco", label: "Banco", valor: (c) => c.banco },
  { clave: "sucursalBanco", label: "Sucursal del banco", valor: (c) => c.sucursalBanco ?? "—" },
  { clave: "tipo", label: "Tipo", valor: (c) => TIPO_CUENTA_LABEL[c.tipo] },
  { clave: "numero", label: "Número", valor: (c) => c.numero },
  { clave: "moneda", label: "Moneda", valor: (c) => NOMBRE_MONEDA[c.moneda] },
  { clave: "oficial", label: "Oficial de cuenta", valor: (c) => c.oficialNombre ?? "—" },
  { clave: "cuenta", label: "Cuenta contable", valor: (c) => c.cuentaContable },
];

function FormularioCuenta({ inicial, onClose }: { inicial: CuentaBancaria | null; onClose: () => void }) {
  const lista = useCuentasBancarias();
  const [banco, setBanco] = useState(inicial?.banco ?? "");
  const [sucursalBanco, setSucursalBanco] = useState(inicial?.sucursalBanco ?? "");
  const [direccionBanco, setDireccionBanco] = useState(inicial?.direccionBanco ?? "");
  const [oficialNombre, setOficialNombre] = useState(inicial?.oficialNombre ?? "");
  const [oficialTelefono, setOficialTelefono] = useState(inicial?.oficialTelefono ?? "");
  const [oficialMail, setOficialMail] = useState(inicial?.oficialMail ?? "");
  const [mailSucursal, setMailSucursal] = useState(inicial?.mailSucursal ?? "");
  const [tipo, setTipo] = useState<CuentaBancaria["tipo"]>(inicial?.tipo ?? "CUENTA_CORRIENTE");
  const [numero, setNumero] = useState(inicial?.numero ?? "");
  const [cbu, setCbu] = useState(inicial?.cbu ?? "");
  const [alias, setAlias] = useState(inicial?.alias ?? "");
  const [fechaApertura, setFechaApertura] = useState(inicial?.fechaApertura ?? "");
  const [moneda, setMoneda] = useState<Moneda>(inicial?.moneda ?? "ARS");
  const [cuentaContable, setCuentaContable] = useState(inicial?.cuentaContable ?? "");
  const [intentado, setIntentado] = useState(false);

  const errores: Record<string, string> = {};
  if (!banco.trim()) errores.banco = "Ingresá el banco.";
  if (!numero.trim()) errores.numero = "Ingresá el número de cuenta.";
  else if (lista.some((c) => c.id !== inicial?.id && c.estado !== "ELIMINADO" && c.banco.toLowerCase() === banco.trim().toLowerCase() && c.numero === numero.trim()))
    errores.numero = "Ya existe esa cuenta en ese banco.";
  if (cbu && !/^\d{22}$/.test(cbu)) errores.cbu = "El CBU tiene 22 dígitos.";
  if (oficialMail && !MAIL.test(oficialMail.trim())) errores.oficialMail = "Ingresá un mail válido.";
  if (mailSucursal && !MAIL.test(mailSucursal.trim())) errores.mailSucursal = "Ingresá un mail válido.";
  if (fechaApertura && fechaApertura > hoy()) errores.fechaApertura = "La apertura no puede ser futura.";
  if (!cuentaContable) errores.cuentaContable = "Elegí la cuenta contable.";
  const e = (k: string) => (intentado ? errores[k] : undefined);

  const grabar = () => {
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    const base = {
      banco: banco.trim(),
      sucursalBanco: sucursalBanco.trim(),
      direccionBanco: direccionBanco.trim(),
      oficialNombre: oficialNombre.trim(),
      oficialTelefono: oficialTelefono.trim(),
      oficialMail: oficialMail.trim(),
      mailSucursal: mailSucursal.trim(),
      tipo,
      numero: numero.trim(),
      cbu,
      alias: alias.trim(),
      fechaApertura,
      moneda,
      cuentaContable,
    };
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
    <ModalFormulario titulo={inicial ? `Modificar ${inicial.banco} ${inicial.numero}` : "Nuevo banco"} onClose={onClose} onGrabar={grabar} maxWidth="max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        {inicial && <FormField id="cb-id" label="ID" value={inicial.id} onChange={() => {}} disabled hint="Lo asigna el sistema." className="sm:col-span-2" />}
        <FormField id="cb-banco" label="Banco" required value={banco} onChange={setBanco} placeholder="Ej.: Banco Nación" error={e("banco")} />
        <FormField id="cb-sucursal" label="Sucursal del banco" value={sucursalBanco} onChange={setSucursalBanco} hint="Donde está radicada la cuenta." />
        <FormField id="cb-direccion" label="Dirección de la sucursal" value={direccionBanco} onChange={setDireccionBanco} className="sm:col-span-2" />
        <FormField id="cb-oficial" label="Oficial de cuenta" value={oficialNombre} onChange={setOficialNombre} />
        <FormField id="cb-oficial-tel" label="Teléfono del oficial" value={oficialTelefono} onChange={setOficialTelefono} inputMode="tel" />
        <FormField id="cb-oficial-mail" label="Mail del oficial" value={oficialMail} onChange={setOficialMail} error={e("oficialMail")} />
        <FormField id="cb-mail-sucursal" label="Mail de la sucursal" value={mailSucursal} onChange={setMailSucursal} hint="Contacto general." error={e("mailSucursal")} />
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
        <FormField id="cb-numero" label="Número de cuenta" required value={numero} onChange={setNumero} placeholder="0110-4412-90" error={e("numero")} />
        <FormField id="cb-cbu" label="CBU" value={cbu} onChange={(v) => setCbu(v.replace(/\D/g, "").slice(0, 22))} inputMode="numeric" error={e("cbu")} hint="22 dígitos. Opcional." />
        <FormField id="cb-alias" label="Alias" value={alias} onChange={setAlias} />
        <FormField id="cb-apertura" label="Fecha de apertura de la cuenta" type="date" value={fechaApertura} onChange={setFechaApertura} error={e("fechaApertura")} />
        <SelectField id="cb-cuenta" label="Cuenta contable" required value={cuentaContable} onChange={setCuentaContable} options={cuentasBanco} error={e("cuentaContable")} className="sm:col-span-2" />
      </div>
    </ModalFormulario>
  );
}

export function CuentasBancarias() {
  const lista = useCuentasBancarias();
  const movimientos = useMovimientosTesoreria();
  const acuerdos = useAcuerdos();
  const chequeras = useChequeras();
  return (
    <div>
      <p className="mb-5 max-w-2xl text-sm text-ink-500">
        Bancos y cuentas bancarias de la empresa. Son el destino de los depósitos en banco de la tesorería, la base de la conciliación de
        acreditaciones y el origen de los acuerdos y las chequeras.
      </p>
      <AbmCaja<CuentaBancaria>
        entidad={ENTIDAD}
        archivo="bancos"
        singular="banco"
        plural="bancos"
        nuevoLabel="Nuevo banco"
        registros={lista}
        store={cajaStores.cuentasBancarias}
        columnas={COLUMNAS}
        estados={ESTADOS_TRES}
        nombreDe={(c) => `${c.banco} · ${c.numero}`}
        errorAccion={(c, a) => {
          if (a.estado !== "SUSPENDIDO" && a.estado !== "ELIMINADO") return undefined;
          const pendientes = movimientos.filter((m) => m.destino.tipo === "BANCO" && m.destino.cuentaId === c.id && m.envio && !m.conciliacion);
          if (pendientes.length > 0) return `La cuenta tiene ${pendientes.length} ${pendientes.length === 1 ? "depósito" : "depósitos"} sin conciliar.`;
          const ac = acuerdos.filter((x) => x.cuentaId === c.id && x.estado === "ACTIVO").length;
          if (ac > 0) return `La cuenta tiene ${ac} ${ac === 1 ? "acuerdo activo" : "acuerdos activos"}.`;
          const ch = chequeras.filter((x) => x.cuentaId === c.id && x.estado === "ACTIVO").length;
          if (ch > 0) return `La cuenta tiene ${ch} ${ch === 1 ? "chequera activa" : "chequeras activas"}.`;
          return undefined;
        }}
        formulario={(p) => <FormularioCuenta key={p.inicial?.id ?? "nuevo"} {...p} />}
      />
    </div>
  );
}
