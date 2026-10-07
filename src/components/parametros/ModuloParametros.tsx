"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MotivosObservacion } from "./MotivosObservacion";
import { ProvinciasImpuestos } from "./ProvinciasImpuestos";
import { Impositivos } from "./Impositivos";
import { ListaServicios } from "@/components/servicios/ListaServicios";
import { NavSecciones } from "@/components/ui/NavSecciones";
import { IconFileText, IconLandmark, IconMapPin, IconWallet } from "@/components/icons";

const SOLAPAS = [
  { id: "motivos", label: "Motivos de observación", icon: IconFileText, Componente: MotivosObservacion },
  { id: "servicios", label: "Cargos/servicios", icon: IconWallet, Componente: ListaServicios },
  { id: "provincias", label: "Provincias (sellado)", icon: IconMapPin, Componente: ProvinciasImpuestos },
  { id: "impositivos", label: "Impositivos", icon: IconLandmark, Componente: Impositivos },
] as const;

// Módulo Parámetros: cada parámetro editable es una sección, con el mismo menú lateral que los
// demás módulos. La sección activa va en la URL (?solapa=servicios) para poder linkearla.
export function ModuloParametros() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const pedida = params.get("solapa");
  // Cambia sólo la solapa: el resto de la URL (por ejemplo, el rol de la demo) se conserva.
  const irA = (id: string) => {
    const q = new URLSearchParams(params.toString());
    q.set("solapa", id);
    router.replace(`${pathname}?${q.toString()}`);
  };
  const activa = SOLAPAS.find((s) => s.id === pedida) ?? SOLAPAS[0];
  const Activa = activa.Componente;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="animate-fade-in">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Módulo Créditos</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">Parámetros</h1>
      </div>

      <NavSecciones
        ariaLabel="Secciones de parámetros"
        items={SOLAPAS.map((s) => ({ id: s.id, label: s.label, icon: s.icon }))}
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
