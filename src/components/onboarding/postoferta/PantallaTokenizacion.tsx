"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { configEfectiva } from "@/lib/config";
import { MARCAS_TARJETA, nombreProveedor } from "@/lib/parametros";
import { isValidCard } from "@/lib/format";
import type { TipoTarjeta } from "@/lib/types";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DemoTag } from "@/components/ui/DemoTag";
import {
  IconCheck,
  IconClock,
  IconCreditCard,
  IconKey,
  IconSend,
  IconTrash,
  IconUser,
} from "@/components/icons";

const TIPOS: { id: TipoTarjeta; label: string }[] = [
  { id: "DEBITO", label: "Tarjeta de débito" },
  { id: "CREDITO", label: "Tarjeta de crédito" },
];

const FORM_VACIO = { tipo: "DEBITO" as TipoTarjeta, numero: "", vencimiento: "", marca: "", cvv: "" };

// Pantalla 3 · Tokenización de tarjetas (Onboarding §6): una o varias tarjetas, por link de
// WhatsApp o carga presencial, con el proveedor configurado en el producto.
export function PantallaTokenizacion() {
  const { app, enviarLinkWhatsApp, simularCompletaCliente, tokenizarPresencial, quitarTarjeta } =
    useApplication();
  const [presencial, setPresencial] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [procesando, setProcesando] = useState<string | null>(null);

  const cfg = configEfectiva(app.configuracion);
  const obligatoria = cfg.pantallas.find((p) => p.id === "tokenizacion")?.obligatoria ?? false;
  const { maximoTarjetas, proveedorId } = cfg.tokenizacion;
  const tarjetas = app.postOferta.tarjetas;
  const tokenizadas = tarjetas.filter((t) => t.estado === "TOKENIZADA").length;
  const lleno = tarjetas.length >= maximoTarjetas;
  const p = app.postOferta.personales;
  const celular = `${p["telefono.caracteristica"] ?? ""} ${p["telefono.numero"] ?? ""}`.trim();
  const formCompleto =
    isValidCard(form.numero) &&
    /^\d{2}\/\d{2}$/.test(form.vencimiento.trim()) &&
    !!form.marca &&
    form.cvv.length >= 3;

  function conDemora(clave: string, accion: () => void, ms = 900) {
    setProcesando(clave);
    window.setTimeout(() => {
      accion();
      setProcesando(null);
    }, ms);
  }

  function tokenizar() {
    conDemora("presencial", () => {
      tokenizarPresencial({ tipo: form.tipo, marca: form.marca, numero: form.numero });
      setForm(FORM_VACIO);
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
              <strong className="text-ink-900">{tokenizadas}</strong> tokenizada
              {tokenizadas === 1 ? "" : "s"} · hasta {maximoTarjetas} tarjeta
              {maximoTarjetas === 1 ? "" : "s"}
            </span>
            <span className="flex items-center gap-2 font-medium text-ink-600">
              {nombreProveedor(proveedorId)}
              <DemoTag
                variant="config"
                detalle="El proveedor tercero de tokenización, la obligatoriedad y la cantidad de tarjetas se configuran por producto, con excepciones del organismo. La integración es simulada."
              />
            </span>
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
                              <p className="text-sm font-bold text-ink-900">
                                {t.marca} •••• {t.ultimos4}{" "}
                                <span className="text-xs font-medium text-ink-500">
                                  · {t.tipo === "CREDITO" ? "Crédito" : "Débito"}
                                </span>
                              </p>
                              <p className="flex flex-wrap items-center gap-1.5 text-xs text-success-700">
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
              disabled={lleno || !celular || procesando !== null}
            >
              {procesando !== "whatsapp" && <IconSend width={16} height={16} />}
              Enviar link por WhatsApp
            </Button>
            <Button
              variant="outline"
              onClick={() => setPresencial((v) => !v)}
              disabled={lleno || procesando !== null}
            >
              <IconUser width={16} height={16} />
              Carga presencial
            </Button>
          </div>
          <p className="text-xs text-ink-500">
            {lleno
              ? `Se alcanzó el máximo de ${maximoTarjetas} tarjeta${maximoTarjetas === 1 ? "" : "s"} para esta configuración.`
              : celular
                ? `El link se envía al celular precargado ${celular}.`
                : "Cargá el teléfono del cliente en Datos personales para poder enviar el link."}
          </p>

          {presencial && !lleno && (
            <div className="animate-fade-up rounded-xl border border-ink-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                Carga presencial · con la tarjeta en mano
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {TIPOS.map((tipo) => (
                  <button
                    key={tipo.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, tipo: tipo.id }))}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                      form.tipo === tipo.id
                        ? "border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600"
                        : "border-ink-200 bg-white text-ink-600 hover:border-brand-300"
                    }`}
                  >
                    {tipo.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2">
                <FormField
                  id="tok-numero"
                  label="Número"
                  value={form.numero}
                  onChange={(v) => setForm((f) => ({ ...f, numero: v.replace(/[^\d ]/g, "").slice(0, 19) }))}
                  inputMode="numeric"
                  placeholder="4509 9535 6623 3704"
                  className="sm:col-span-2"
                />
                <FormField
                  id="tok-venc"
                  label="Vencimiento"
                  value={form.vencimiento}
                  onChange={(v) => setForm((f) => ({ ...f, vencimiento: v.slice(0, 5) }))}
                  placeholder="MM/AA"
                />
                <SelectField
                  id="tok-marca"
                  label="Marca"
                  value={form.marca}
                  onChange={(v) => setForm((f) => ({ ...f, marca: v }))}
                  options={MARCAS_TARJETA.map((m) => ({ value: m, label: m }))}
                />
                <FormField
                  id="tok-cvv"
                  label="Código de seguridad"
                  value={form.cvv}
                  onChange={(v) => setForm((f) => ({ ...f, cvv: v.replace(/\D/g, "").slice(0, 4) }))}
                  inputMode="numeric"
                  placeholder="123"
                />
              </div>
              <Button
                className="mt-4"
                onClick={tokenizar}
                loading={procesando === "presencial"}
                disabled={!formCompleto || procesando !== null}
              >
                {procesando !== "presencial" && <IconKey width={16} height={16} />}
                Tokenizar tarjeta
              </Button>
              {!formCompleto && (
                <p className="mt-2 text-xs text-ink-500">
                  Completá número, vencimiento (MM/AA), marca y código para tokenizarla.
                </p>
              )}
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
