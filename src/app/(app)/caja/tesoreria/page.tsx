import { redirect } from "next/navigation";

// Movimientos de tesorería salió del menú de Caja: ahora es la vista Remesas de la Bandeja de autorizaciones.
export default function CajaTesoreriaPage() {
  redirect("/caja/bandeja?vista=remesas");
}
