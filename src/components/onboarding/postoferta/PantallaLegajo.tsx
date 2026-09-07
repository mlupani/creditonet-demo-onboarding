"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { Banner } from "@/components/ui/Banner";
import { Card, CardHeader } from "@/components/ui/Card";
import { DocumentChecklist } from "@/components/DocumentChecklist";
import { IconCheckCircle, IconFileText } from "@/components/icons";

export function PantallaLegajo() {
  const { app, subirDocumento } = useApplication();
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const docs = app.postOferta.legajo;
  const cargados = docs.filter((d) => d.estado === "CARGADO").length;
  const completo = cargados === docs.length;

  function subir(id: string) {
    setSubiendo(id);
    window.setTimeout(() => {
      subirDocumento("legajo", id);
      setSubiendo(null);
    }, 900);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Legajo virtual"
          description="Cargá los documentos requeridos para completar el legajo."
          icon={<IconFileText width={18} height={18} />}
          action={
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                completo
                  ? "border-success-200 bg-success-50 text-success-700"
                  : "border-warning-200 bg-warning-50 text-warning-700"
              }`}
            >
              {completo && <IconCheckCircle width={13} height={13} />}
              {cargados} de {docs.length} documentos completos
            </span>
          }
        />
        <div className="p-5 sm:p-6">
          <DocumentChecklist docs={docs} uploadingId={subiendo} onUpload={subir} />
        </div>
      </Card>

      <Banner tone={completo ? "success" : "info"}>
        {completo
          ? "Legajo completo."
          : "La carga de documentos es simulada. En el sistema real se validarían formato, tamaño y legibilidad."}
      </Banner>
    </div>
  );
}
