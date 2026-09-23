"use client";

import { useEffect, useMemo, useState } from "react";
import { useApplication } from "@/lib/application-context";
import { configEfectiva, pantallasVisibles } from "@/lib/config";
import { estadoPantallasPostOferta, pendientesFinalizarCarga } from "@/lib/validation";
import { sumarDias } from "@/lib/format";
import type { PantallaPostOfertaId } from "@/lib/types";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { StepperLibre, type PasoLibre } from "@/components/ui/StepperLibre";
import { ValidationMessage } from "@/components/ui/ValidationMessage";
import { IconArrowRight, IconCheck, IconPencil, IconSend } from "@/components/icons";

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

const SIN_PANTALLAS: PantallaPostOfertaId[] = [];

// Corrección puntual: la pantalla observada se ve en sólo lectura hasta tocar Editar; al
// guardar queda corregida y se puede enviar nuevamente. El `key` al cambiar de pantalla la
// vuelve a dejar en sólo lectura.
function PantallaObservada({
  id,
  label,
  corregida,
  pendientes,
  onEditar,
  onGuardar,
}: {
  id: PantallaPostOfertaId;
  label: string;
  corregida: boolean;
  pendientes: number;
  onEditar: () => void;
  onGuardar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const Pantalla = PANTALLAS[id];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-300 bg-warning-50 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-warning-700">Pantalla observada · {label}</p>
          <p className="text-xs text-warning-700/80">
            {editando
              ? pendientes > 0
                ? `Completá los datos obligatorios pendientes (${pendientes}) para poder guardar.`
                : "Corregí lo que pidió el analista y guardá los cambios."
              : corregida
                ? "Corrección guardada. Ya podés enviarla nuevamente."
                : "Tocá Editar para corregirla."}
          </p>
        </div>
        {editando ? (
          <Button
            variant="success"
            disabled={pendientes > 0}
            onClick={() => {
              onGuardar();
              setEditando(false);
            }}
          >
            <IconCheck width={16} height={16} strokeWidth={2.6} />
            Guardar cambios
          </Button>
        ) : (
          <Button
            variant={corregida ? "outline" : "primary"}
            onClick={() => {
              onEditar();
              setEditando(true);
            }}
          >
            <IconPencil width={16} height={16} />
            {corregida ? "Editar de nuevo" : "Editar"}
          </Button>
        )}
      </div>
      <fieldset disabled={!editando} className={`mt-4 min-w-0 ${editando ? "" : "opacity-75"}`}>
        <Pantalla />
      </fieldset>
    </div>
  );
}

export function PostOfertaShell() {
  const {
    app,
    pantallaActual,
    setPantallaActual,
    visitarPantalla,
    finalizarCarga,
    guardarCorreccion,
    reabrirCorreccion,
  } = useApplication();
  const [confirmar, setConfirmar] = useState(false);

  const visibles = useMemo(() => pantallasVisibles(app.configuracion), [app.configuracion]);
  const estados = useMemo(() => estadoPantallasPostOferta(app), [app]);
  const pendientes = useMemo(() => pendientesFinalizarCarga(app), [app]);
  const completadas = estados.filter((e) => e.completa).length;
  const observada = app.estado === "OBSERVADO";
  const obs = app.analista.observacion;
  // Corrección puntual: si el analista señaló pantallas, es lo único que se puede editar y
  // el resto de la carga queda bloqueada hasta reenviar.
  const observadas = observada ? (obs?.pantallas ?? SIN_PANTALLAS) : SIN_PANTALLAS;
  const puntual = observadas.length > 0;
  const corregidas = app.analista.pantallasCorregidas;
  const todasCorregidas = observadas.every((id) => corregidas.includes(id));

  // Normaliza la pantalla actual si no está en las visibles.
  useEffect(() => {
    if (!visibles.some((p) => p.id === pantallaActual)) {
      setPantallaActual(visibles[0]?.id ?? "personales");
    }
  }, [visibles, pantallaActual, setPantallaActual]);

  useEffect(() => {
    visitarPantalla(pantallaActual);
  }, [pantallaActual, visitarPantalla]);

  // Con corrección puntual sólo se puede estar en una pantalla observada: al retomar se abre
  // la primera y no se puede salir a las bloqueadas.
  useEffect(() => {
    if (puntual && !observadas.includes(pantallaActual)) setPantallaActual(observadas[0]);
  }, [puntual, observadas, pantallaActual, setPantallaActual]);

  // Navegación secuencial (configurada en el producto o excepcionada por el organismo): no se
  // avanza más allá de la primera pantalla obligatoria que todavía no está completa.
  const secuencial = configEfectiva(app.configuracion).navegacion === "SECUENCIAL" && !puntual;
  const limiteSecuencial = secuencial
    ? estados.findIndex((e) => e.obligatoria && e.estadoVisual !== "COMPLETA")
    : -1;

  useEffect(() => {
    if (limiteSecuencial === -1) return;
    const i = estados.findIndex((e) => e.id === pantallaActual);
    if (i > limiteSecuencial) setPantallaActual(estados[limiteSecuencial].id);
  }, [limiteSecuencial, estados, pantallaActual, setPantallaActual]);

  const pasos: PasoLibre[] = estados.map((e, i) => ({
    id: e.id,
    numero: e.numero,
    label: e.label,
    obligatoria: e.obligatoria,
    estado: e.estadoVisual,
    observada: observadas.includes(e.id),
    bloqueada: puntual ? !observadas.includes(e.id) : limiteSecuencial !== -1 && i > limiteSecuencial,
  }));

  const PantallaActiva = PANTALLAS[pantallaActual];
  // En una corrección puntual sólo cuentan los pendientes de las pantallas que se corrigen.
  const pendientesEnvio = puntual
    ? pendientes.filter((p) => observadas.includes(p.pantallaId))
    : pendientes;
  const puedeFinalizar = pendientesEnvio.length === 0 && todasCorregidas;
  const accionLabel = puntual
    ? "Enviar nuevamente"
    : observada
      ? "Reenviar correcciones"
      : "Finalizar carga";
  const labelObservadas = visibles.filter((p) => observadas.includes(p.id)).map((p) => p.label);
  const estadoActual = estados.find((e) => e.id === pantallaActual);
  // Botón "Continuar" al pie de cada pantalla (Guía, igual que en originación): avanza a la
  // siguiente pantalla visible sólo si la actual no tiene pendientes.
  const indiceActual = estados.findIndex((e) => e.id === pantallaActual);
  const siguientePantalla =
    indiceActual >= 0 && indiceActual < estados.length - 1 ? estados[indiceActual + 1] : null;

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
            {puntual
              ? `Corrección puntual: sólo se puede editar ${
                  labelObservadas.length === 1 ? "la pantalla observada" : "las pantallas observadas"
                }. El resto de la carga está bloqueada.`
              : `${completadas} de ${estados.length} pantallas completas. ${
                  secuencial
                    ? "Se navega en orden: completá las obligatorias para avanzar."
                    : "Podés navegar entre ellas en cualquier orden."
                }`}
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
            {puntual
              ? puedeFinalizar
                ? "Corrección guardada: ya podés enviarla nuevamente."
                : "Editá y guardá la pantalla observada para enviar nuevamente."
              : puedeFinalizar
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
            {puntual &&
              `Corregí sólo: ${labelObservadas.join(", ")}. Las demás pantallas están bloqueadas. `}
            Editá, guardá y enviá nuevamente antes del{" "}
            <strong>{sumarDias(obs.fecha, 15)}</strong> (15 días) para que no expire.
          </Banner>
        </div>
      )}

      <div className="mt-5">
        <StepperLibre
          pasos={pasos}
          actual={pantallaActual}
          onSelect={setPantallaActual}
          leyendaBloqueo={
            secuencial ? "Se habilita al completar las obligatorias anteriores" : undefined
          }
        />
      </div>

      <div key={pantallaActual} className="mt-6 animate-fade-up">
        {puntual ? (
          <PantallaObservada
            id={pantallaActual}
            label={estadoActual?.label ?? ""}
            corregida={corregidas.includes(pantallaActual)}
            pendientes={estadoActual?.pendientes.length ?? 0}
            onEditar={() => reabrirCorreccion(pantallaActual)}
            onGuardar={() => guardarCorreccion(pantallaActual)}
          />
        ) : (
          <PantallaActiva />
        )}
        {!puntual && siguientePantalla && (
          <Card className="mt-6 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                {estadoActual && !estadoActual.completa ? (
                  <ValidationMessage tipo="warning" className="!mt-0 justify-start">
                    Completá los campos obligatorios de esta pantalla para continuar.
                  </ValidationMessage>
                ) : (
                  <p className="text-xs text-ink-500">
                    <span className="font-semibold text-ink-700">
                      Próximo: {siguientePantalla.label}
                    </span>
                  </p>
                )}
              </div>
              <Button
                size="lg"
                disabled={!estadoActual?.completa}
                onClick={() => setPantallaActual(siguientePantalla.id)}
                className="sm:w-auto"
              >
                Continuar
                <IconArrowRight width={16} height={16} />
              </Button>
            </div>
          </Card>
        )}
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
              {observada ? "Enviar nuevamente" : "Enviar a análisis"}
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
