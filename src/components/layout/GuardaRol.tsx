"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRol } from "@/lib/rol-context";
import { ROLES, puedeVer } from "@/lib/roles";
import { IconLock } from "@/components/icons";

function NoPermitido() {
  const { rol } = useRol();
  const { sesion, inicio } = ROLES[rol];
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">
        <IconLock width={26} height={26} />
      </span>
      <h1 className="mt-5 text-lg font-semibold tracking-tight text-ink-900">No permitido</h1>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">
        Tu rol actual ({sesion.rol}) no tiene acceso a esta pantalla. Cambiá de usuario desde el
        header o volvé a tu pantalla de inicio.
      </p>
      <Link
        href={inicio}
        className="mt-5 inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
      >
        Ir a mi pantalla de inicio
      </Link>
    </div>
  );
}

export function GuardaRol({ children }: { children: React.ReactNode }) {
  const { rol } = useRol();
  const pathname = usePathname();
  return puedeVer(rol, pathname) ? children : <NoPermitido />;
}
