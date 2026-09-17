"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApplication } from "@/lib/application-context";
import { pantallasVisibles } from "@/lib/config";
import { estadoPantallasPostOferta, pendientesFinalizarCarga } from "@/lib/validation";
import { sumarDias } from "@/lib/format";
import type { PantallaPostOfertaId } from "@/lib/types";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { StepperLibre, type PasoLibre } from "@/components/ui/StepperLibre";
import { IconArrowRight, IconCheck, IconSend } from "@/components/icons";

import { PantallaLaboral } from "./PantallaLaboral";
import { PantallaPersonales } from "./PantallaPersonales";
import { PantallaTokenizacion } from "./PantallaTokenizacion";
import { PantallaReferencias } from "./PantallaReferencias";
import { PantallaGarantias } from "./PantallaGarantias";
import { PantallaLegajo } from "./PantallaLegajo";
import { PantallaImpresion } from "./PantallaImpresion";

const PANTALLAS: Record<PantallaPostOfertaId, () => React.ReactNode> = {
  laboral: PantallaLaboral,
  personales: PantallaPersonales,
  tokenizacion: PantallaTokenizacion,
  referencias: PantallaReferencias,
  garantias: PantallaGarantias,
  legajo: PantallaLegajo,
  impresion: PantallaImpresion,
};

export function PostOfertaShell() {
  const { app, pantallaActual, setPantallaActual, visitarPantalla, finalizarCarga } =
    useApplication();
  const [confirmar, setConfirmar] = useState(false);

  const visibles = useMemo(() => pantallasVisibles(app.configuracion), [app.configuracion]);
  const estados = useMemo(() => estadoPantallasPostOferta(app), [app]);
  const pendientes = useMemo(() => pendientesFinalizarCarga(app), [app]);
  const completadas = estados.filter((e) => e.completa).length;
  const observada = app.estado === "OBSERVADO";
  const obs = app.analista.observacion;
  // El analista puede señalar qué pantalla hay que corregir (reunión 11/09, 01:09).
  const pantallaObservada = observada ? (obs?.pantalla ?? null) : null;

  // Normaliza la pantalla actual si no está en las visibles.
  useEffect(() => {
    if (!visibles.some((p) => p.id === pantallaActual)) {
      setPantallaActual(visibles[0]?.id ?? "personales");
    }
  }, [visibles, pantallaActual, setPantallaActual]);

  useEffect(() => {
    visitarPantalla(pantallaActual);
  }, [pantallaActual, visitarPantalla]);

  // Al retomar una solicitud observada se abre directamente la pantalla señalada.
  const saltoHecho = useRef(false);
  useEffect(() => {
    if (!pantallaObservada || saltoHecho.current) return;
    saltoHecho.current = true;
    setPantallaActual(pantallaObservada);
  }, [pantallaObservada, setPantallaActual]);

  const pasos: PasoLibre[] = estados.map((e) => ({
    id: e.id,
    numero: e.numero,
    label: e.label,
    obligatoria: e.obligatoria,
    estado: e.estadoVisual,
    observada: e.id === pantallaObservada,
  }));

  const PantallaActiva = PANTALLAS[pantallaActual];
  const puedeFinalizar = pendientes.length === 0;
  const accionLabel = observada ? "Reenviar correcciones" : "Finalizar carga";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="animate-fade-in flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
            Solicitar crédito · Post-oferta
          </p>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">
            {app.cliente?.nombre} {app.cliente?.apellido}
            <span className="font-mono text-base font-semibold text-brand-700">
              {app.numeroCredito}
            </span>
            <EstadoBadge estado={app.estado} />
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {completadas} de {estados.length} pantallas completas. Podés navegar entre ellas en
            cualquier orden.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            size="lg"
            variant={puedeFinalizar ? "success" : "primary"}
            disabled={!puedeFinalizar}
            onClick={() => setConfirmar(true)}
          >
            {observada ? <IconSend width={16} height={16} /> : null}
            {accionLabel}
            {!observada && <IconArrowRight width={16} height={16} />}
          </Button>
          <p className="text-[11px] font-medium text-ink-400">
            {puedeFinalizar
              ? "Todas las pantallas obligatorias están en verde."
              : `Se habilita con el 100 % de las obligatorias en verde · ${pendientes.length} pendiente${
                  pendientes.length === 1 ? "" : "s"
                }`}
          </p>
        </div>
      </div>

      {observada && obs && (
        <div className="mt-5">
          <Banner tone="warning" title={`Observada por el analista · ${obs.motivo}`}>
            {obs.nota}{" "}
            {pantallaObservada &&
              `Está señalada en naranja la pantalla a corregir. `}
            Corregí lo necesario y reenviá la solicitud antes del{" "}
            <strong>{sumarDias(obs.fecha, 15)}</strong> (15 días) para que no expire.
          </Banner>
        </div>
      )}

      <div className="mt-5">
        <StepperLibre pasos={pasos} actual={pantallaActual} onSelect={setPantallaActual} />
      </div>

      <div key={pantallaActual} className="mt-6 animate-fade-up">
        <PantallaActiva />
      </div>

      <Modal
        open={confirmar}
        onClose={() => setConfirmar(false)}
        title={observada ? "Reenviar correcciones" : "Carga completa"}
        maxWidth="max-w-md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setConfirmar(false)}>
              Volver
            </Button>
            <Button
              variant="success"
              autoFocus
              onClick={() => {
                setConfirmar(false);
                finalizarCarga();
              }}
            >
              {observada ? "Reenviar a análisis" : "Enviar a análisis"}
            </Button>
          </div>
        }
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-600 text-white">
            <IconCheck width={20} height={20} strokeWidth={2.6} />
          </span>
          <p className="text-sm leading-relaxed text-ink-700">
            {observada
              ? "Las correcciones se reenvían al analista de riesgo. La solicitud pasa de Observado a En análisis."
              : "El crédito ha sido debidamente cargado y pasa a análisis de riesgo. La solicitud pasa de En trámite a En análisis."}
          </p>
        </div>
      </Modal>
    </div>
  );
}
