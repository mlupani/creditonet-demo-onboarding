"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { configEfectiva } from "@/lib/config";
import { nombreProveedor } from "@/lib/parametros";
import { isValidCard } from "@/lib/format";
import type { TipoTarjeta } from "@/lib/types";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatTelefono } from "@/lib/telefono";
import {
  IconCalendar,
  IconCheck,
  IconClock,
  IconCreditCard,
  IconKey,
  IconLandmark,
  IconSend,
  IconTrash,
  IconUser,
} from "@/components/icons";
import { detectarMarca, LogoMarcaCompacto, TarjetaAnimada } from "./TarjetaAnimada";

const FORM_VACIO = { tipo: "CREDITO" as TipoTarjeta, numero: "", vencimiento: "", nombreTitular: "", marca: "", cvv: "" };

// Pantalla 3 · Tokenización de tarjetas (Onboarding §6): una o varias tarjetas, por link de
// WhatsApp o carga presencial, con el proveedor configurado en el producto.
export function PantallaTokenizacion() {
  const { app, enviarLinkWhatsApp, simularCompletaCliente, tokenizarPresencial, quitarTarjeta } =
    useApplication();
  const [presencial, setPresencial] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [verReverso, setVerReverso] = useState(false);

  const cfg = configEfectiva(app.configuracion);
  const obligatoria = cfg.pantallas.find((p) => p.id === "tokenizacion")?.obligatoria ?? false;
  const { proveedorId } = cfg.tokenizacion;
  const tarjetas = app.postOferta.tarjetas;
  const tokenizadas = tarjetas.filter((t) => t.estado === "TOKENIZADA").length;
  const p = app.postOferta.personales;
  const celular = formatTelefono(p["telefono.pais"] ?? "", p["telefono.numero"] ?? "");
  const formCompleto =
    isValidCard(form.numero) &&
    /^\d{2}\/\d{2}$/.test(form.vencimiento.trim()) &&
    form.nombreTitular.trim().length >= 3 &&
    form.cvv.length >= 3;

  function conDemora(clave: string, accion: () => void, ms = 900) {
    setProcesando(clave);
    window.setTimeout(() => {
      accion();
      setProcesando(null);
    }, ms);
  }

  function detectarTipo(numero: string): "DEBITO" | "CREDITO" {
    if (!numero || numero.length < 6) return "CREDITO";
    const bin = parseInt(numero.slice(0, 6));
    // Visa débito típicamente: 402720-402723, 403000-404999, etc.
    if (numero[0] === "4") {
      return bin >= 402720 && bin <= 402723 ? "DEBITO" : "CREDITO";
    }
    // Por defecto Mastercard y otros son crédito
    return "CREDITO";
  }

  function formatearVencimiento(valor: string): string {
    const digitos = valor.replace(/\D/g, "").slice(0, 4);
    return digitos.length <= 2 ? digitos : `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  }

  function tokenizar() {
    const tipoDetectado = detectarTipo(form.numero);
    conDemora("presencial", () => {
      tokenizarPresencial({
        tipo: tipoDetectado,
        marca: detectarMarca(form.numero),
        numero: form.numero,
        nombreTitular: form.nombreTitular,
        vencimiento: form.vencimiento,
      });
      setForm(FORM_VACIO);
      setVerReverso(false);
      setPresencial(false);
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Tokenización de tarjetas"
          description="Tarjetas para el cobro automático de las cuotas. El cliente la carga desde un link o el vendedor la tokeniza con la tarjeta en mano."
          icon={<IconCreditCard width={18} height={18} />}
          action={
            <StatusBadge tone={obligatoria ? "danger" : "neutral"}>
              {obligatoria ? "Obligatoria" : "Opcional"}
            </StatusBadge>
          }
        />
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-200 bg-ink-25 px-3 py-2 text-xs">
            <span className="font-medium text-ink-600">
              <strong className="text-ink-900">{tokenizadas}</strong> tarjeta
              {tokenizadas === 1 ? "" : "s"} tokenizada{tokenizadas === 1 ? "" : "s"}
            </span>
            <span className="font-medium text-ink-600">{nombreProveedor(proveedorId)}</span>
          </div>

          {tarjetas.length > 0 && (
            <ul className="space-y-2">
              {tarjetas.map((t) => {
                const lista = t.estado === "TOKENIZADA";
                return (
                  <li
                    key={t.id}
                    className={`rounded-xl border px-4 py-3 ${
                      lista
                        ? "border-success-200 bg-success-50/60"
                        : "border-warning-200 bg-warning-50/60"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            lista ? "bg-success-600 text-white" : "bg-warning-100 text-warning-700"
                          }`}
                        >
                          {lista ? (
                            <IconCheck width={16} height={16} strokeWidth={2.6} />
                          ) : (
                            <IconClock width={16} height={16} />
                          )}
                        </span>
                        <div className="min-w-0">
                          {lista ? (
                            <>
                              <p className="flex items-center gap-2 text-sm font-bold text-ink-900">
                                <LogoMarcaCompacto marca={t.marca} />
                                {t.nombreTitular}
                              </p>
                              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600 mt-1">
                                <span className="font-mono">
                                  {t.primeros4 ?? "••••"} •• •••• {t.ultimos4}
                                </span>
                                <span>Vence {t.vencimiento ?? "--/--"}</span>
                                {t.tipo && (
                                  <span className="font-semibold">
                                    {t.tipo === "CREDITO" ? "Crédito" : "Débito"}
                                  </span>
                                )}
                              </p>
                              <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-500 mt-1">
                                <IconLandmark width={12} height={12} />
                                {t.emisor ?? "Emisor no informado"}·
                                <IconCalendar width={12} height={12} />
                                {t.fechaTokenizacion ?? "--"}·
                                <IconKey width={12} height={12} />
                                <span className="font-mono">{t.token}</span>·{" "}
                                {t.via === "WHATSAPP"
                                  ? "cargada por el cliente desde el link"
                                  : "carga presencial"}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-bold text-ink-900">
                                Link enviado por WhatsApp a {t.enviadoA}
                              </p>
                              <p className="text-xs text-warning-700">
                                Esperando que el cliente complete el formulario de tokenización.
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {!lista && (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={procesando === t.id}
                            disabled={procesando !== null}
                            onClick={() => conDemora(t.id, () => simularCompletaCliente(t.id))}
                          >
                            Simular que el cliente completó
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={procesando === t.id}
                          onClick={() => quitarTarjeta(t.id)}
                        >
                          <IconTrash width={14} height={14} />
                          {lista ? "Quitar" : "Cancelar"}
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              onClick={() => conDemora("whatsapp", enviarLinkWhatsApp, 700)}
              loading={procesando === "whatsapp"}
              disabled={!celular || procesando !== null}
            >
              {procesando !== "whatsapp" && <IconSend width={16} height={16} />}
              Enviar link por WhatsApp
            </Button>
            <Button
              variant="outline"
              onClick={() => setPresencial((v) => !v)}
              disabled={procesando !== null}
            >
              <IconUser width={16} height={16} />
              Carga presencial
            </Button>
          </div>
          <p className="text-xs text-ink-500">
            {celular
              ? `El link se envía al celular precargado ${celular}.`
              : "Cargá el teléfono del cliente en Datos personales para poder enviar el link."}
          </p>

          {presencial && (
            <div className="animate-fade-up rounded-xl border border-ink-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                Carga presencial · con la tarjeta en mano
              </p>
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                {/* Tarjeta Animada */}
                <div className="flex items-center justify-center">
                  <TarjetaAnimada
                    numero={form.numero}
                    vencimiento={form.vencimiento}
                    nombreTitular={form.nombreTitular}
                    marca={form.marca}
                    tipo={form.tipo}
                    cvv={form.cvv}
                    mostrarReverso={verReverso}
                  />
                </div>

                {/* Formulario */}
                <div className="space-y-3">
                  <FormField
                    id="tok-numero"
                    label="Número"
                    value={form.numero}
                    onChange={(v) => setForm((f) => ({ ...f, numero: v.replace(/\D/g, "").slice(0, 16) }))}
                    onFocus={() => setVerReverso(false)}
                    inputMode="numeric"
                    placeholder="4509953566233704"
                  />
                  <FormField
                    id="tok-nombre"
                    label="Nombre completo del titular"
                    value={form.nombreTitular}
                    onChange={(v) => setForm((f) => ({ ...f, nombreTitular: v.toUpperCase() }))}
                    onFocus={() => setVerReverso(false)}
                    placeholder="JUAN PÉREZ GÓMEZ"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      id="tok-venc"
                      label="Vencimiento"
                      value={form.vencimiento}
                      onChange={(v) => setForm((f) => ({ ...f, vencimiento: formatearVencimiento(v) }))}
                      onFocus={() => setVerReverso(false)}
                      inputMode="numeric"
                      placeholder="MM/AA"
                    />
                    <FormField
                      id="tok-cvv"
                      label="Código de seguridad"
                      type="password"
                      value={form.cvv}
                      onChange={(v) => setForm((f) => ({ ...f, cvv: v.replace(/\D/g, "").slice(0, 4) }))}
                      onFocus={() => setVerReverso(true)}
                      placeholder="123"
                    />
                  </div>
                  <Button
                    className="w-full mt-4"
                    onClick={tokenizar}
                    loading={procesando === "presencial"}
                    disabled={!formCompleto || procesando !== null}
                  >
                    {procesando !== "presencial" && <IconKey width={16} height={16} />}
                    Tokenizar tarjeta
                  </Button>
                  {!formCompleto && (
                    <p className="text-xs text-ink-500">
                      Completá número, nombre, vencimiento (MM/AA) y código para tokenizarla.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Banner tone="info">
        WhatsApp sólo se usa para compartir el link del formulario al número del cliente: no es un
        módulo integrado al flujo de onboarding. En la demo los tokens son ficticios y no se guarda
        ningún dato sensible de la tarjeta.
      </Banner>
    </div>
  );
}
