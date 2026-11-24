"use client";

import { useState } from "react";
import { USUARIOS_CAJA } from "@/lib/caja-datos";
import { errorBajaSucursal, nombreRepetido } from "@/lib/caja-reglas";
import { cajaStores, siguienteId, hoy, useCajas, usuarioActual, useSucursales } from "@/lib/caja-store";
import type { Sucursal } from "@/lib/caja-tipos";
import { FormField } from "@/components/ui/FormField";
import { nombreRoles } from "../comunes";
import { AbmCaja, ESTADOS_TRES, ModalFormulario, persistir, type Columna } from "./AbmCaja";

const ENTIDAD = "Sucursal";

// Usuarios habilitados en la sucursal con su rol (7.2). El Director y el Tesorero central, sin sucursal
// propia, figuran en Casa Central.
const usuariosDe = (sucursalId: string) =>
  USUARIOS_CAJA.filter((u) => u.sucursalId === sucursalId || (!u.sucursalId && sucursalId === "SUC-001"))
    .map((u) => `${u.nombre} (${nombreRoles(u)})`)
    .join(" · ") || "—";

const COLUMNAS: Columna<Sucursal>[] = [
  { clave: "nombre", label: "Nombre", valor: (s) => s.nombre },
  { clave: "direccion", label: "Dirección", valor: (s) => s.direccion },
  { clave: "ubicacion", label: "Localidad / Provincia", valor: (s) => `${s.localidad} / ${s.provincia}` },
  { clave: "contacto", label: "Contacto", valor: (s) => `${s.telefono} · ${s.mail}` },
  { clave: "usuarios", label: "Usuarios y roles", valor: (s) => usuariosDe(s.id) },
  { clave: "alta", label: "Alta", ancho: "w-36", valor: (s) => `${s.fechaAlta} · ${s.usuarioAlta}` },
];

function FormularioSucursal({ inicial, onClose }: { inicial: Sucursal | null; onClose: () => void }) {
  const sucursales = useSucursales();
  const [s, setS] = useState<Sucursal>(
    inicial ?? {
      id: "",
      nombre: "",
      direccion: "",
      localidad: "",
      provincia: "",
      codigoPostal: "",
      telefono: "",
      mail: "",
      estado: "ACTIVO",
      fechaAlta: "",
      usuarioAlta: "",
    }
  );
  const [intentado, setIntentado] = useState(false);
  const campo = (k: keyof Sucursal) => (v: string) => setS((x) => ({ ...x, [k]: v }));

  const errores: Partial<Record<keyof Sucursal, string>> = {};
  if (!s.nombre.trim()) errores.nombre = "Ingresá el nombre de la sucursal.";
  else if (nombreRepetido(s.nombre, sucursales, inicial?.id)) errores.nombre = "Ya existe una sucursal con ese nombre.";
  if (!s.direccion.trim()) errores.direccion = "Ingresá la dirección.";
  if (!s.localidad.trim()) errores.localidad = "Ingresá la localidad.";
  if (!s.provincia.trim()) errores.provincia = "Ingresá la provincia.";
  if (s.mail.trim() && !/^\S+@\S+\.\S+$/.test(s.mail.trim())) errores.mail = "Ingresá un mail válido.";
  const e = (k: keyof Sucursal) => (intentado ? errores[k] : undefined);

  const grabar = () => {
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    const limpio = { ...s, nombre: s.nombre.trim().replace(/\s+/g, " ") };
    persistir(
      cajaStores.sucursales,
      ENTIDAD,
      inicial,
      inicial
        ? limpio
        : {
            ...limpio,
            id: siguienteId("SUC", cajaStores.sucursales.get().map((x) => x.id)),
            fechaAlta: hoy(),
            usuarioAlta: usuarioActual().nombre,
          }
    );
    onClose();
  };

  return (
    <ModalFormulario titulo={inicial ? `Modificar ${inicial.nombre}` : "Nueva sucursal"} onClose={onClose} onGrabar={grabar}>
      <div className="grid gap-4 sm:grid-cols-2">
        {inicial && <FormField id="suc-id" label="ID de sucursal" value={inicial.id} onChange={() => {}} disabled hint="Lo asigna el sistema." />}
        <FormField id="suc-nombre" label="Nombre" required value={s.nombre} onChange={campo("nombre")} placeholder="Ej.: Sucursal Bariloche" error={e("nombre")} />
        <FormField id="suc-direccion" label="Dirección" required value={s.direccion} onChange={campo("direccion")} placeholder="Calle, número, piso y oficina" error={e("direccion")} className="sm:col-span-2" />
        <FormField id="suc-localidad" label="Localidad" required value={s.localidad} onChange={campo("localidad")} error={e("localidad")} />
        <FormField id="suc-provincia" label="Provincia" required value={s.provincia} onChange={campo("provincia")} error={e("provincia")} />
        <FormField id="suc-cp" label="Código postal" value={s.codigoPostal} onChange={campo("codigoPostal")} />
        <FormField id="suc-telefono" label="Teléfono" value={s.telefono} onChange={campo("telefono")} />
        <FormField id="suc-mail" label="Mail" value={s.mail} onChange={campo("mail")} error={e("mail")} className="sm:col-span-2" />
      </div>
    </ModalFormulario>
  );
}

export function Sucursales() {
  const sucursales = useSucursales();
  const cajas = useCajas();
  return (
    <div>
      <p className="mb-5 max-w-2xl text-sm text-ink-500">
        Sedes donde operan las cajas. Una sucursal con cajas activas no se puede suspender ni eliminar.
      </p>
      <AbmCaja<Sucursal>
        entidad={ENTIDAD}
        archivo="sucursales"
        singular="sucursal"
        plural="sucursales"
        nuevoLabel="Nueva sucursal"
        registros={sucursales}
        store={cajaStores.sucursales}
        columnas={COLUMNAS}
        estados={ESTADOS_TRES}
        nombreDe={(s) => s.nombre}
        errorAccion={(s, a) => (a.estado === "SUSPENDIDO" || a.estado === "ELIMINADO" ? errorBajaSucursal(s, cajas) : undefined)}
        formulario={(p) => <FormularioSucursal key={p.inicial?.id ?? "nuevo"} {...p} />}
      />
    </div>
  );
}
