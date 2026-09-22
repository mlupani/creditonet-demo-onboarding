// Reemplaza el asterisco de "campo obligatorio" por un badge en la esquina inferior derecha
// del control. Se ubica dentro de un contenedor `relative`.
export function RequiredBadge() {
  return (
    <span className="pointer-events-none absolute bottom-0 right-2 inline-flex translate-y-1 items-center rounded-full border border-danger-200 bg-danger-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-danger-600 shadow-xs">
      Obligatorio
    </span>
  );
}
