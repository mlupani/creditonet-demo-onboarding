"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useApplication } from "@/lib/application-context";
import { useRol } from "@/lib/rol-context";
import {
  contienePantalla,
  esGrupo,
  esProximamente,
  hrefPantalla,
  menuVisible,
  pantallaActiva,
  primeraPantalla,
  type IconoMenu,
  type MenuEntrada,
  type MenuGrupo,
  type MenuPantalla,
} from "@/lib/navegacion";
import { Tooltip } from "@/components/ui/Tooltip";
import { alternarSidebarColapsado, useSidebarColapsado } from "@/lib/sidebar-colapsado";
import {
  IconBarChart,
  IconChevronDown,
  IconChevronsLeft,
  IconChevronsRight,
  IconCreditCard,
  IconGitBranch,
  IconIdCard,
  IconLandmark,
  IconRefresh,
  IconSettings,
  IconUsers,
  IconWallet,
  IconX,
} from "@/components/icons";

const ICONOS: Record<IconoMenu, (props: { width?: number; height?: number }) => React.ReactNode> = {
  creditos: IconCreditCard,
  onboarding: IconIdCard,
  parametros: IconSettings,
  usuarios: IconUsers,
  caja: IconWallet,
  contable: IconLandmark,
  reportes: IconBarChart,
  flujo: IconGitBranch,
};

const PRONTO_TIP = "Módulo disponible próximamente en la demo";

// Grupos abiertos o cerrados a mano (por ruta del árbol); valen mientras no cambie la pantalla activa.
interface Toggles {
  activa?: MenuPantalla;
  abiertos: Record<string, boolean>;
}

// `compacto`: sidebar de escritorio colapsado, sólo íconos (la etiqueta pasa a tooltip). Cada módulo
// de primer nivel enlaza a su primera pantalla visible.
function NavList({ onNavigate, compacto }: { onNavigate?: () => void; compacto?: boolean }) {
  const pathname = usePathname();
  const solapa = useSearchParams().get("solapa");
  const { rol } = useRol();
  const items = menuVisible(rol);
  const activa = pantallaActiva(pathname, solapa);

  const [toggles, setToggles] = useState<Toggles>({ activa, abiertos: {} });
  // Al cambiar de pantalla se descartan los cambios manuales: los grupos de la nueva se abren solos.
  const cambio = toggles.activa !== activa;
  if (cambio) setToggles({ activa, abiertos: {} });
  const manuales = cambio ? {} : toggles.abiertos;

  const abierto = (clave: string, g: MenuGrupo) => manuales[clave] ?? contienePantalla(g, activa);
  const alternar = (clave: string, g: MenuGrupo) =>
    setToggles({ activa, abiertos: { ...manuales, [clave]: !abierto(clave, g) } });

  const proximo = (e: MenuEntrada, clave: string, anidado: boolean) => {
    const Icono = !anidado && "icono" in e && e.icono ? ICONOS[e.icono] : null;
    const contenido = (
      <span
        aria-label={compacto ? `${e.label} · próximamente` : undefined}
        title={!compacto && anidado ? "Disponible próximamente" : undefined}
        className={`flex cursor-not-allowed items-center gap-3 rounded-lg text-sm font-medium text-ink-400 ${
          anidado ? "min-h-7 px-3 py-1" : "py-2"
        } ${compacto ? "justify-center px-2.5" : anidado ? "w-full" : "w-full px-3"}`}
      >
        {Icono && <Icono />}
        {!compacto && (
          <>
            <span className="flex-1 truncate">{e.label}</span>
            {!anidado && (
              <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-400">
                Pronto
              </span>
            )}
          </>
        )}
      </span>
    );
    return (
      <li key={clave}>
        {compacto || !anidado ? (
          <Tooltip label={compacto ? `${e.label} · próximamente` : PRONTO_TIP}>{contenido}</Tooltip>
        ) : (
          contenido
        )}
      </li>
    );
  };

  // Opción interna (segundo nivel o posterior): más compacta, con borde guía por grupo.
  const anidada = (e: MenuEntrada, clave: string): React.ReactNode => {
    if (esProximamente(e)) return proximo(e, clave, true);
    if (esGrupo(e)) {
      const open = abierto(clave, e);
      return (
        <li key={clave}>
          <button
            type="button"
            onClick={() => alternar(clave, e)}
            aria-expanded={open}
            className={`flex min-h-7 w-full items-center gap-2 rounded-lg px-3 py-1 text-left text-sm font-medium transition hover:bg-ink-100 hover:text-ink-900 ${
              open ? "text-ink-900" : "text-ink-600"
            }`}
          >
            <span className="flex-1 truncate">{e.label}</span>
            <IconChevronDown
              width={14}
              height={14}
              className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
          <ul
            aria-label={e.label}
            hidden={!open}
            className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-ink-200 pl-2"
          >
            {e.children.map((c, i) => anidada(c, `${clave}/${i}`))}
          </ul>
        </li>
      );
    }
    const esActiva = e === activa;
    return (
      <li key={clave}>
        <Link
          href={hrefPantalla(e)}
          onClick={onNavigate}
          aria-current={esActiva ? "page" : undefined}
          className={`flex min-h-7 w-full items-center rounded-lg px-3 py-1 text-sm font-medium transition ${
            esActiva ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
          }`}
        >
          <span className="truncate">{e.label}</span>
        </Link>
      </li>
    );
  };

  const primerNivel = (e: MenuEntrada, indice: number): React.ReactNode => {
    const clave = String(indice);
    if (esProximamente(e)) return proximo(e, clave, false);
    const Icono = e.icono ? ICONOS[e.icono] : null;
    const contiene = contienePantalla(e, activa);

    // Colapsado: sólo el ícono, enlazado a la primera pantalla del módulo.
    if (compacto) {
      const destino = primeraPantalla(e);
      if (!destino) return proximo({ label: e.label, proximamente: true }, clave, false);
      return (
        <li key={clave}>
          <Tooltip label={e.label}>
            <Link
              href={hrefPantalla(destino)}
              onClick={onNavigate}
              aria-label={e.label}
              aria-current={contiene ? "page" : undefined}
              className={`relative flex items-center justify-center rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                contiene ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
              }`}
            >
              {contiene && (
                <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-600" />
              )}
              {Icono && <Icono />}
            </Link>
          </Tooltip>
        </li>
      );
    }

    if (esGrupo(e)) {
      const open = abierto(clave, e);
      return (
        <li key={clave}>
          <button
            type="button"
            onClick={() => alternar(clave, e)}
            aria-expanded={open}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition hover:bg-ink-100 hover:text-ink-900 ${
              contiene ? "text-brand-700" : "text-ink-600"
            }`}
          >
            {Icono && <Icono />}
            <span className="flex-1 truncate">{e.label}</span>
            <IconChevronDown
              width={16}
              height={16}
              className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
          <ul
            aria-label={e.label}
            hidden={!open}
            className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l border-ink-200 pl-3"
          >
            {e.children.map((c, i) => anidada(c, `${clave}/${i}`))}
          </ul>
        </li>
      );
    }

    // Pantalla suelta de primer nivel (Diagrama de flujo).
    const esActiva = e === activa;
    return (
      <li key={clave}>
        <Link
          href={hrefPantalla(e)}
          onClick={onNavigate}
          aria-current={esActiva ? "page" : undefined}
          className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
            esActiva ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
          }`}
        >
          {esActiva && (
            <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-600" />
          )}
          {Icono && <Icono />}
          {e.label}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="Menú principal" className={`flex-1 px-3 ${compacto ? "" : "scroll-thin overflow-y-auto"}`}>
      <ul className="flex flex-col gap-1">{items.map(primerNivel)}</ul>
    </nav>
  );
}

function SidebarContent({ onNavigate, compacto }: { onNavigate?: () => void; compacto?: boolean }) {
  const { reiniciarDemo } = useApplication();
  const reiniciar = () => {
    reiniciarDemo();
    onNavigate?.();
  };
  return (
    <div className="flex h-full flex-col py-5">
      <div className={`mb-6 flex items-center gap-2.5 ${compacto ? "justify-center px-3" : "px-5"}`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-base font-bold text-white shadow-sm">
          C
        </span>
        {!compacto && (
          <div>
            <p className="text-[15px] font-bold leading-tight tracking-tight text-ink-900">
              CreditoNet
            </p>
            <p className="text-[11px] font-medium text-ink-400">Módulo Onboarding</p>
          </div>
        )}
      </div>
      <NavList onNavigate={onNavigate} compacto={compacto} />
      {compacto ? (
        <div className="mt-auto flex justify-center px-3 pt-6">
          <Tooltip label="Reiniciar demo">
            <button
              onClick={reiniciar}
              aria-label="Reiniciar demo"
              className="rounded-lg border border-ink-200 p-2.5 text-ink-500 transition hover:border-ink-300 hover:bg-ink-50 hover:text-ink-700"
            >
              <IconRefresh />
            </button>
          </Tooltip>
        </div>
      ) : (
        <div className="mt-auto px-5 pt-6">
          <button
            onClick={reiniciar}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-500 transition hover:border-ink-300 hover:bg-ink-50 hover:text-ink-700"
          >
            Reiniciar demo
          </button>
          <p className="mt-3 text-center text-[11px] font-medium text-ink-400">
            Demo interactiva · v0.3
          </p>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { menuAbierto, setMenuAbierto } = useApplication();
  const colapsado = useSidebarColapsado();
  return (
    <>
      <aside
        className={`sticky top-0 z-40 hidden h-screen shrink-0 border-r border-ink-200 bg-white transition-[width] duration-200 lg:block ${
          colapsado ? "w-16" : "w-64"
        }`}
      >
        <SidebarContent compacto={colapsado} />
        <button
          onClick={alternarSidebarColapsado}
          aria-label={colapsado ? "Expandir menú lateral" : "Colapsar menú lateral"}
          aria-expanded={!colapsado}
          title={colapsado ? "Expandir menú" : "Colapsar menú"}
          className="absolute -right-3 top-6 flex h-6 w-6 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-500 shadow-sm transition hover:bg-ink-50 hover:text-ink-900"
        >
          {colapsado ? (
            <IconChevronsRight width={14} height={14} />
          ) : (
            <IconChevronsLeft width={14} height={14} />
          )}
        </button>
      </aside>

      {menuAbierto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-ink-900/50 backdrop-blur-[2px]"
            onClick={() => setMenuAbierto(false)}
            aria-hidden
          />
          <div className="relative flex h-full w-72 animate-fade-in bg-white shadow-lift">
            <button
              onClick={() => setMenuAbierto(false)}
              aria-label="Cerrar menú"
              className="absolute right-3 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100"
            >
              <IconX width={18} height={18} />
            </button>
            <div className="w-full overflow-y-auto scroll-thin">
              <SidebarContent onNavigate={() => setMenuAbierto(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
