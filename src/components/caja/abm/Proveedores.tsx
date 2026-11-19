"use client";

import { useState } from "react";
import { CUENTAS_CONTABLES } from "@/lib/caja-datos";
import { hoy, siguienteId, usuarioActual } from "@/lib/caja-store";
import { PROVINCIAS_ARGENTINA } from "@/lib/provincias-impuestos";
import { datosArca } from "@/lib/proveedores-operaciones";
import { formatearCuit, saldoProveedor, validarCuit } from "@/lib/proveedores-reglas";
import { provStores, useComprobantes, usePagosProveedor, useProveedores, useTiposComprobante } from "@/lib/proveedores-store";
import { CONDICION_IVA_LABEL, type CondicionIva, type Proveedor } from "@/lib/proveedores-tipos";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { dinero } from "../comunes";
import { AbmCaja, ESTADOS_TRES, ModalFormulario, persistir, type Columna } from "./AbmCaja";

const ENTIDAD = "Proveedor";

const cuentas = (prefijo: string) =>
  CUENTAS_CONTABLES.filter((c) => c.codigo.startsWith(prefijo)).map((c) => ({ value: c.codigo, label: `${c.codigo} · ${c.nombre}` }));
const cuentasPasivo = cuentas("2.");
const cuentasPerdida = cuentas("5.2");

function FormularioProveedor({ inicial, onClose }: { inicial: Proveedor | null; onClose: () => void }) {
  const lista = useProveedores();
  const tipos = useTiposComprobante();
  const [cuit, setCuit] = useState(inicial?.cuit ?? "");
  const [razonSocial, setRazonSocial] = useState(inicial?.razonSocial ?? "");
  const [fantasia, setFantasia] = useState(inicial?.fantasia ?? "");
  const [domicilio, setDomicilio] = useState(inicial?.domicilio ?? "");
  const [provincia, setProvincia] = useState(inicial?.provincia ?? "");
  const [codigoPostal, setCodigoPostal] = useState(inicial?.codigoPostal ?? "");
  const [tipoComprobanteId, setTipoComprobanteId] = useState(inicial?.tipoComprobanteId ?? "");
  const [condicionIva, setCondicionIva] = useState<CondicionIva>(inicial?.condicionIva ?? "RESPONSABLE_INSCRIPTO");
  const [iibb, setIibb] = useState(inicial?.iibb ?? "");
  const [cbu, setCbu] = useState(inicial?.cbu ?? "");
  const [telefono, setTelefono] = useState(inicial?.telefono ?? "");
  const [mail, setMail] = useState(inicial?.mail ?? "");
  const [cuentaPasivo, setCuentaPasivo] = useState(inicial?.cuentaPasivo ?? "");
  const [cuentaPerdida, setCuentaPerdida] = useState(inicial?.cuentaPerdida ?? "");
  const [intentado, setIntentado] = useState(false);
  const [avisoArca, setAvisoArca] = useState<string | null>(null);

  const errores: Record<string, string> = {};
  if (!validarCuit(cuit)) errores.cuit = "Ingresá un CUIT válido de 11 dígitos.";
  else if (lista.some((p) => p.id !== inicial?.id && p.estado !== "ELIMINADO" && p.cuit === cuit))
    errores.cuit = "Ya existe un proveedor con ese CUIT.";
  if (!razonSocial.trim()) errores.razonSocial = "Ingresá la razón social.";
  if (!provincia) errores.provincia = "Elegí la provincia.";
  if (!tipoComprobanteId) errores.tipoComprobanteId = "Elegí el tipo de comprobante habitual.";
  if (cbu && !/^\d{22}$/.test(cbu)) errores.cbu = "El CBU tiene 22 dígitos.";
  if (mail && !/^\S+@\S+\.\S+$/.test(mail)) errores.mail = "Ingresá un mail válido.";
  if (!cuentaPasivo) errores.cuentaPasivo = "Elegí la cuenta de pasivo.";
  if (!cuentaPerdida) errores.cuentaPerdida = "Elegí la cuenta de pérdida.";
  const e = (k: string) => (intentado ? errores[k] : undefined);

  const traerDatosArca = () => {
    const d = datosArca(cuit);
    if (!d) {
      setAvisoArca("El CUIT no es válido: no se pudo consultar el padrón.");
      return;
    }
    setRazonSocial(d.razonSocial);
    setDomicilio(d.domicilio);
    setProvincia(d.provincia);
    setCodigoPostal(d.codigoPostal);
    setCondicionIva(d.condicionIva);
    setAvisoArca("Datos completados desde el padrón de ARCA (simulado).");
  };

  const grabar = () => {
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    const base = {
      cuit,
      razonSocial: razonSocial.trim(),
      fantasia: fantasia.trim(),
      domicilio: domicilio.trim(),
      provincia,
      codigoPostal: codigoPostal.trim(),
      tipoComprobanteId,
      condicionIva,
      iibb: iibb.trim(),
      cbu,
      telefono: telefono.trim(),
      mail: mail.trim(),
      cuentaPasivo,
      cuentaPerdida,
    };
    persistir(
      provStores.proveedores,
      ENTIDAD,
      inicial,
      inicial
        ? { ...inicial, ...base }
        : { ...base, id: siguienteId("PRV", lista.map((p) => p.id)), estado: "ACTIVO", fechaAlta: hoy(), usuarioAlta: usuarioActual().nombre }
    );
    onClose();
  };

  return (
    <ModalFormulario titulo={inicial ? `Modificar ${inicial.razonSocial}` : "Nuevo proveedor"} onClose={onClose} onGrabar={grabar} maxWidth="max-w-3xl">
      <div className="space-y-4">
        {inicial && <FormField id="pv-id" label="ID" value={inicial.id} onChange={() => {}} disabled hint="Lo asigna el sistema." />}
        <div className="flex items-start gap-2">
          <FormField
            id="pv-cuit"
            label="CUIT"
            required
            value={cuit}
            onChange={(v) => {
              setCuit(v.replace(/\D/g, "").slice(0, 11));
              setAvisoArca(null);
            }}
            inputMode="numeric"
            placeholder="30697100128"
            error={e("cuit")}
            hint={validarCuit(cuit) ? formatearCuit(cuit) : "11 dígitos, sin guiones."}
            className="flex-1"
          />
          <Button variant="outline" className="mt-[1.65rem]" onClick={traerDatosArca}>
            Datos ARCA
          </Button>
        </div>
        {avisoArca && <p className="text-xs text-ink-500">{avisoArca}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="pv-razon" label="Razón social" required value={razonSocial} onChange={setRazonSocial} error={e("razonSocial")} />
          <FormField id="pv-fantasia" label="Nombre de fantasía" value={fantasia} onChange={setFantasia} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="pv-domicilio" label="Domicilio" value={domicilio} onChange={setDomicilio} className="sm:col-span-3" />
          <SelectField
            id="pv-provincia"
            label="Provincia"
            required
            value={provincia}
            onChange={setProvincia}
            options={PROVINCIAS_ARGENTINA.map((p) => ({ value: p, label: p }))}
            error={e("provincia")}
          />
          <FormField id="pv-cp" label="Código postal" value={codigoPostal} onChange={setCodigoPostal} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="pv-condicion"
            label="Condición de IVA"
            required
            value={condicionIva}
            onChange={(v) => setCondicionIva(v as CondicionIva)}
            options={Object.entries(CONDICION_IVA_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <SelectField
            id="pv-tipo"
            label="Tipo de comprobante habitual"
            required
            value={tipoComprobanteId}
            onChange={setTipoComprobanteId}
            options={tipos.filter((t) => t.estado === "ACTIVO" || t.id === inicial?.tipoComprobanteId).map((t) => ({ value: t.id, label: t.descripcion }))}
            error={e("tipoComprobanteId")}
          />
          <FormField id="pv-iibb" label="N° de Ingresos Brutos" value={iibb} onChange={setIibb} />
          <FormField id="pv-cbu" label="CBU" value={cbu} onChange={(v) => setCbu(v.replace(/\D/g, "").slice(0, 22))} inputMode="numeric" error={e("cbu")} hint="Para pagos por transferencia. 22 dígitos." />
          <FormField id="pv-tel" label="Teléfono" value={telefono} onChange={setTelefono} inputMode="tel" />
          <FormField id="pv-mail" label="Mail" value={mail} onChange={setMail} inputMode="email" error={e("mail")} />
          <SelectField id="pv-pasivo" label="Cuenta de pasivo" required value={cuentaPasivo} onChange={setCuentaPasivo} options={cuentasPasivo} error={e("cuentaPasivo")} />
          <SelectField id="pv-perdida" label="Cuenta de pérdida (imputación)" required value={cuentaPerdida} onChange={setCuentaPerdida} options={cuentasPerdida} error={e("cuentaPerdida")} />
        </div>
      </div>
    </ModalFormulario>
  );
}

export function Proveedores() {
  const lista = useProveedores();
  const comprobantes = useComprobantes();
  const pagos = usePagosProveedor();
  const tipos = useTiposComprobante();
  const saldo = (p: Proveedor) => saldoProveedor(p.id, comprobantes, pagos, tipos);

  const COLUMNAS: Columna<Proveedor>[] = [
    { clave: "cuit", label: "CUIT", valor: (p) => formatearCuit(p.cuit) },
    { clave: "razon", label: "Razón social", valor: (p) => p.razonSocial },
    { clave: "iva", label: "Condición de IVA", valor: (p) => CONDICION_IVA_LABEL[p.condicionIva] },
    { clave: "saldo", label: "Saldo", valor: saldo, render: (p) => dinero("ARS", saldo(p)) },
  ];

  return (
    <div>
      <p className="mb-5 max-w-2xl text-sm text-ink-500">
        Alta de proveedores. Son el primer dato de la carga de comprobantes y definen las cuentas contables que se imputan al pagar; la cuenta
        corriente se arma sola con los comprobantes y los pagos.
      </p>
      <AbmCaja<Proveedor>
        entidad={ENTIDAD}
        archivo="proveedores"
        singular="proveedor"
        plural="proveedores"
        nuevoLabel="Nuevo proveedor"
        registros={lista}
        store={provStores.proveedores}
        columnas={COLUMNAS}
        estados={ESTADOS_TRES}
        nombreDe={(p) => `${p.razonSocial} ${p.fantasia} ${p.cuit}`}
        errorAccion={(p, a) => {
          if (a.estado !== "SUSPENDIDO" && a.estado !== "ELIMINADO") return undefined;
          return saldo(p) !== 0 ? `El proveedor tiene un saldo pendiente de ${dinero("ARS", saldo(p))}.` : undefined;
        }}
        formulario={(p) => <FormularioProveedor key={p.inicial?.id ?? "nuevo"} {...p} />}
      />
    </div>
  );
}
