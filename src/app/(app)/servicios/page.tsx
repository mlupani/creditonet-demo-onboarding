import { redirect } from "next/navigation";

// Servicios ahora es una solapa de Parámetros.
export default function ServiciosPage() {
  redirect("/parametros?solapa=servicios");
}
