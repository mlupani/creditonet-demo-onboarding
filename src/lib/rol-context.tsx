"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fijarRolActivo } from "./actor";
import { ROL_POR_DEFECTO, parseRol, type Rol } from "./roles";

interface RolContextValue {
  rol: Rol;
  cambiarRol: (rol: Rol) => void;
}

const RolContext = createContext<RolContextValue | null>(null);

// El rol entra por ?rol=. Si la navegación interna pierde el parámetro, se repone con el rol
// vigente (que vive en el estado del provider) para que la URL siempre sea compartible.
export function RolProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const delParam = parseRol(params.get("rol"));
  const [rol, setRol] = useState<Rol>(delParam ?? ROL_POR_DEFECTO);

  if (delParam && delParam !== rol) setRol(delParam);

  useEffect(() => {
    fijarRolActivo(rol);
  }, [rol]);

  const conRol = useCallback(
    (r: Rol) => {
      const q = new URLSearchParams(params.toString());
      q.set("rol", r);
      return `${pathname}?${q.toString()}`;
    },
    [params, pathname]
  );

  useEffect(() => {
    if (!delParam) router.replace(conRol(rol));
  }, [delParam, rol, conRol, router]);

  const cambiarRol = useCallback(
    (r: Rol) => {
      setRol(r);
      router.replace(conRol(r));
    },
    [conRol, router]
  );

  const value = useMemo(() => ({ rol, cambiarRol }), [rol, cambiarRol]);
  return <RolContext.Provider value={value}>{children}</RolContext.Provider>;
}

export function useRol() {
  const ctx = useContext(RolContext);
  if (!ctx) throw new Error("useRol debe usarse dentro de <RolProvider>");
  return ctx;
}
