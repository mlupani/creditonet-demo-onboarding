import { Banner } from "@/components/ui/Banner";
import { LEYENDA_POSESION_SUP } from "@/lib/posesion-sup";

// Aviso de modo consulta: el crédito está en manos del superior y el resto de los roles sólo lee.
export function BannerPosesionSup() {
  return (
    <Banner tone="info" title={LEYENDA_POSESION_SUP}>
      Podés consultar el crédito, pero no realizar acciones sobre él (aprobar, rechazar, observar,
      cambiar la oferta ni reasignar) hasta que el superior lo libere.
    </Banner>
  );
}
