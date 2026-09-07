"use client";

import { useApplication } from "@/lib/application-context";
import { OriginacionWizard } from "./originacion/OriginacionWizard";
import { TransicionEtapa } from "./TransicionEtapa";
import { PostOfertaShell } from "./postoferta/PostOfertaShell";
import { SolicitudEnviada } from "./SolicitudEnviada";
import { IconLoader } from "@/components/icons";

export function SolicitudFlow() {
  const { app, hidratado } = useApplication();

  if (!hidratado) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-ink-400">
        <IconLoader width={24} height={24} />
      </div>
    );
  }

  switch (app.etapa) {
    case "ORIGINACION":
      return <OriginacionWizard />;
    case "TRANSICION":
      return <TransicionEtapa />;
    case "POST_OFERTA":
      return <PostOfertaShell />;
    case "ENVIADA":
      return <SolicitudEnviada />;
    default:
      return <OriginacionWizard />;
  }
}
