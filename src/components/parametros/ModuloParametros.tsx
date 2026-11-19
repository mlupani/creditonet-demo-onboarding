"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MotivosObservacion } from "./MotivosObservacion";
import { ProvinciasImpuestos } from "./ProvinciasImpuestos";
import { Impositivos } from "./Impositivos";
import { ListaServicios } from "@/components/servicios/ListaServicios";
import { NavSecciones } from "@/components/ui/NavSecciones";
import { useRol } from "@/lib/rol-context";
import { solapaVisible } from "@/lib/navegacion";
import { Sucursales } from "@/components/caja/abm/Sucursales";
import { Cajas } from "@/components/caja/abm/Cajas";
import { Denominaciones } from "@/components/caja/abm/Denominaciones";
import { CuentasBancarias } from "@/components/caja/abm/CuentasBancarias";
import { Feriados } from "@/components/caja/abm/Feriados";
import { MotivosDiferencia } from "@/components/caja/abm/MotivosDiferencia";
import { TiposMovimiento } from "@/components/caja/abm/TiposMovimiento";
import { EstadosMovimiento } from "@/components/caja/abm/EstadosMovimiento";
import { TiposChequera } from "@/components/caja/abm/TiposChequera";
import { Proveedores } from "@/components/caja/abm/Proveedores";
import { TiposComprobante } from "@/components/caja/abm/TiposComprobante";
import { EstadosComprobante } from "@/components/caja/abm/EstadosComprobante";
import {
  IconAlertTriangle,
  IconBuilding,
  IconCalendar,
  IconFileText,
  IconLandmark,
  IconLock,
  IconMapPin,
  IconRows,
  IconSend,
  IconTable,
  IconWallet,
} from "@/components/icons";

const SOLAPAS = [
  { id: "motivos", label: "Motivos de observación", icon: IconFileText, Componente: MotivosObservacion },
  { id: "servicios", label: "Cargos/servicios", icon: IconWallet, Componente: ListaServicios },
  { id: "provincias", label: "Provincias (sellado)", icon: IconMapPin, Componente: ProvinciasImpuestos },
  { id: "impositivos", label: "Impositivos", icon: IconLandmark, Componente: Impositivos },
  { id: "sucursales", label: "Sucursales", icon: IconBuilding, Componente: Sucursales },
  { id: "cajas", label: "Cajas", icon: IconLock, Componente: Cajas },
  { id: "denominaciones", label: "Denominaciones", icon: IconTable, Componente: Denominaciones },
  { id: "cuentas-bancarias", label: "Bancos", icon: IconLandmark, Componente: CuentasBancarias },
  { id: "tipos-chequera", label: "Tipos de chequera", icon: IconFileText, Componente: TiposChequera },
  { id: "feriados", label: "Feriados", icon: IconCalendar, Componente: Feriados },
  { id: "motivos-diferencia", label: "Motivos de diferencia de caja", icon: IconAlertTriangle, Componente: MotivosDiferencia },
  { id: "tipos-movimiento", label: "Tipos de movimiento de tesorería", icon: IconSend, Componente: TiposMovimiento },
  { id: "estados-movimiento", label: "Estados de movimientos de tesorería", icon: IconRows, Componente: EstadosMovimiento },
  { id: "proveedores", label: "Proveedores", icon: IconBuilding, Componente: Proveedores },
  { id: "tipos-comprobante", label: "Tipos de comprobante", icon: IconFileText, Componente: TiposComprobante },
  { id: "estados-comprobante", label: "Estados de comprobantes", icon: IconRows, Componente: EstadosComprobante },
] as const;

// Módulo Parámetros: cada parámetro editable es una sección, con el mismo menú lateral que los
// demás módulos. La sección activa va en la URL (?solapa=servicios) para poder linkearla.
export function ModuloParametros() {
  const router = useRouter();
  const { rol } = useRol();
  const pathname = usePathname();
  const params = useSearchParams();
  const pedida = params.get("solapa");
  // Cambia sólo la solapa: el resto de la URL (por ejemplo, el rol de la demo) se conserva.
  const irA = (id: string) => {
    const q = new URLSearchParams(params.toString());
    q.set("solapa", id);
    router.replace(`${pathname}?${q.toString()}`);
  };
  const visibles = SOLAPAS.filter((s) => solapaVisible(rol, s.id));
  const activa = visibles.find((s) => s.id === pedida) ?? visibles[0] ?? SOLAPAS[0];
  const Activa = activa.Componente;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="animate-fade-in">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">{rol === "caja" ? "Módulo Caja y Bancos" : "Módulo Créditos"}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">Parámetros</h1>
      </div>

      <NavSecciones
        ariaLabel="Secciones de parámetros"
        items={visibles.map((s) => ({ id: s.id, label: s.label, icon: s.icon }))}
        activa={activa.id}
        onSelect={irA}
        ancho="14.5rem"
      >
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-ink-900">{activa.label}</h2>
          <Activa />
        </div>
      </NavSecciones>
    </div>
  );
}
