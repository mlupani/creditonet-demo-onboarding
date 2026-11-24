import type { ReactNode } from "react";
import { CrudToolbar, type CrudToolbarProps } from "./CrudToolbar";

// Encabezado de una sección de ABM: título, bajada opcional y descripción de para qué sirve el
// parámetro y cuándo aplican los cambios.
export function SectionHeader({
  title,
  subtitle,
  description,
}: {
  title?: string;
  subtitle?: string;
  description?: string;
}) {
  if (!title && !subtitle && !description) return null;
  return (
    <header className="animate-fade-in space-y-2">
      {title && <h2 className="text-lg font-semibold text-ink-900">{title}</h2>}
      {subtitle && <p className="text-sm font-medium text-ink-700">{subtitle}</p>}
      {description && <p className="max-w-2xl text-sm text-ink-500">{description}</p>}
    </header>
  );
}

// Estructura estándar de un ABM, en orden: encabezado, barra de herramientas y contenido.
export function CrudSection({
  title,
  subtitle,
  description,
  toolbar,
  children,
}: {
  title?: string;
  subtitle?: string;
  description?: string;
  toolbar?: CrudToolbarProps;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <SectionHeader title={title} subtitle={subtitle} description={description} />
      {toolbar && <CrudToolbar {...toolbar} />}
      {children}
    </div>
  );
}
