"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { ChequeoCredito } from "@/components/chequeo/ChequeoCredito";
import { ListaChequeo } from "@/components/chequeo/ListaChequeo";
import { IconArrowLeft, IconCheck, IconLoader, IconX } from "@/components/icons";

export default function ChequeoPage() {
  const router = useRouter();
  const { app, hidratado } = useApplication();
  // La bandeja abre en la lista; "Abrir" entra al detalle del crédito.
  const [abierta, setAbierta] = useState(false);

  if (!hidratado) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-ink-400">
        <IconLoader width={24} height={24} />
      </div>
    );
  }

  const chequeo = app.chequeoTelefonico;
  const aprobado = app.estado === "PARA_LIQUIDAR" && chequeo?.resultado === "OK";
  const rechazado = app.estado === "RECHAZADO" && app.rechazo?.origen === "CHEQUEADOR";
  const pendiente = app.estado === "CHEQUEO_TELEFONICO" && chequeo !== null;

  const volver = (
    <Button variant="ghost" size="sm" onClick={() => setAbierta(false)} className="mb-3">
      <IconArrowLeft width={15} height={15} />
      Volver a la bandeja de chequeo
    </Button>
  );

  if (!abierta || !app.cliente || !app.numeroCredito || !(pendiente || aprobado || rechazado)) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="animate-fade-in">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
            Chequeador telefónico
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">
            Bandeja de chequeo telefónico
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Los créditos con firma verificada cuyo producto requiere chequeo llegan acá. Con un
            chequeo correcto pasan solos a liquidación.
          </p>
        </div>
        <div className="mt-6">
          <ListaChequeo onAbrir={() => setAbierta(true)} />
        </div>
      </div>
    );
  }

  if (aprobado || rechazado) {
    const ok = aprobado;
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        {volver}
        <Card className="animate-fade-up overflow-hidden">
          <div className={`px-6 py-10 text-center ${ok ? "bg-success-50" : "bg-danger-50"}`}>
            <span
              className={`mx-auto flex h-14 w-14 animate-pop items-center justify-center rounded-full text-white shadow-sm ${
                ok ? "bg-success-600" : "bg-danger-600"
              }`}
            >
              {ok ? (
                <IconCheck width={26} height={26} strokeWidth={2.6} />
              ) : (
                <IconX width={26} height={26} strokeWidth={2.6} />
              )}
            </span>
            <h1
              className={`mt-4 text-2xl font-bold tracking-tight ${
                ok ? "text-success-700" : "text-danger-700"
              }`}
            >
              {ok ? "Chequeo correcto" : "Chequeo no correcto"}
            </h1>
            <p
              className={`mx-auto mt-2 flex max-w-md flex-wrap items-center justify-center gap-2 text-sm ${
                ok ? "text-success-600" : "text-danger-600"
              }`}
            >
              {app.numeroCredito} · {ok ? "pasó automáticamente a liquidación" : "crédito rechazado"}
              <EstadoBadge estado={app.estado} />
            </p>
          </div>
          <div className="p-6">
            <Banner
              tone={ok ? "success" : "error"}
              title={ok ? "Comentario del chequeador" : `${app.rechazo?.codigos.join(", ")} · ${app.rechazo?.motivo}`}
            >
              {chequeo?.comentario}
            </Banner>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Button onClick={() => setAbierta(false)}>Volver a la bandeja de chequeo</Button>
              <Button variant="outline" onClick={() => router.push("/")}>
                Bandeja del canal de venta
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {volver}
      <div className="animate-fade-in">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
          Chequeador telefónico
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">
          Crédito {app.numeroCredito}
        </h1>
      </div>
      <div className="mt-6">
        <ChequeoCredito onSalir={() => setAbierta(false)} />
      </div>
    </div>
  );
}
