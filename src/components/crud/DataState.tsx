// Estados sin datos de un listado de ABM: cargando, vacío o sin resultados de la búsqueda.
export function DataState({
  kind,
  message,
}: {
  kind: "loading" | "empty" | "no-matches";
  message?: string;
}) {
  const porDefecto =
    kind === "loading" ? "Cargando…" : kind === "empty" ? "Todavía no hay registros." : "No hay resultados para la búsqueda.";
  return (
    <p role="status" className="px-5 py-8 text-center text-sm text-ink-400">
      {message ?? porDefecto}
    </p>
  );
}
