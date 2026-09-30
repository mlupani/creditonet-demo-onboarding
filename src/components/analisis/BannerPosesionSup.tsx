import { Banner } from "@/components/ui/Banner";
import { leyendaPosesionSup } from "@/lib/posesion-sup";

// Aviso de modo consulta: el crédito está en manos del superior y el resto de los roles sólo lee.
export function BannerPosesionSup({ responsable }: { responsable?: string | null }) {
  return (
    <Banner tone="info" title={leyendaPosesionSup(responsable)}>
      Podés consultar el crédito, pero no realizar acciones sobre él (aprobar, rechazar, observar,
      cambiar la oferta ni reasignar) hasta que el superior lo libere.
    </Banner>
  );
}
