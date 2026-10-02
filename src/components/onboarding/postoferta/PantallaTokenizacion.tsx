"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { configEfectiva, minimoTokenizacion } from "@/lib/config";
import { nombreProveedor } from "@/lib/parametros";
import { isValidCard } from "@/lib/format";
import { proveedorDeTarjeta, tarjetaValida } from "@/lib/validation";
import type { TipoTarjeta } from "@/lib/types";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
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
import { detectarMarca, TarjetaAnimada, TarjetaMini } from "./TarjetaAnimada";

const FORM_VACIO = { tipo: "CREDITO" as TipoTarjeta, numero: "", vencimiento: "", nombreTitular: "", marca: "", cvv: "" };

// Pantalla 3 · Tokenización de tarjetas (Onboarding §6): una o varias tarjetas, por link de
// WhatsApp o carga presencial, con el proveedor configurado en el producto.
export function PantallaTokenizacion() {
  const {
    app,
    enviarLinkWhatsApp,
    simularCompletaCliente,
    tokenizarPresencial,
    confirmarTarjetaGuardada,
    quitarTarjeta,
  } = useApplication();
  const [presencial, setPresencial] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [verReverso, setVerReverso] = useState(false);
  const [tarjetaAQuitar, setTarjetaAQuitar] = useState<string | null>(null);

  const [proveedorElegido, setProveedorElegido] = useState<string | null>(null);

  const cfg = configEfectiva(app.configuracion);
  const tarjetas = app.postOferta.tarjetas;
  // Un bloque por proveedor: mínimo (obligatorio) y máximo de tarjetas con ese proveedor.
  const bloques = cfg.tokenizacion.proveedores.map((b, i) => {
    const propias = tarjetas.filter((t) => proveedorDeTarjeta(t, i === 0, b.proveedorId));
    return {
      ...b,
      minimo: minimoTokenizacion(cfg.tokenizacion, b),
      nombre: nombreProveedor(b.proveedorId),
      total: propias.length,
      validas: propias.filter(tarjetaValida).length,
    };
  });
  const hayMinimo = bloques.some((b) => b.minimo > 0);
  // Proveedor de la próxima tarjeta: el elegido o el primero al que todavía le falta el mínimo.
  const bloqueActual =
    bloques.find((b) => b.proveedorId === proveedorElegido) ??
    bloques.find((b) => b.validas < b.minimo && b.total < b.maximo) ??
    bloques.find((b) => b.total < b.maximo) ??
    bloques[0];
  const proveedorId = bloqueActual?.proveedorId ?? "";
  const lleno = !bloqueActual || bloqueActual.total >= bloqueActual.maximo;
  const nombreDe = (t: { proveedorId?: string }) =>
    nombreProveedor(t.proveedorId ?? bloques[0]?.proveedorId ?? "");
  const p = app.postOferta.personales;
  const celular = formatTelefono(
    p["telefono.pais"] ?? "",
    p["telefono.caracteristica"] ?? "",
    p["telefono.numero"] ?? ""
  );
  const formCompleto =
    isValidCard(form.numero) &&
    /^\d{2}\/\d{2}$/.test(form.vencimiento.trim()) &&
    form.nombreTitular.trim().length >= 3 &&
    form.cvv.length >= 3;

  function ejecutarQuitar(id: string) {
    quitarTarjeta(id);
  }

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
        proveedorId,
        tipo: tipoDetectado,
        marca: detectarMarca(form.numero),
        numero: form.numero,
        nombreTitular: form.nombreTitular,
        vencimiento: form.vencimiento,
        cvv: form.cvv,
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
            <StatusBadge tone={hayMinimo ? "danger" : "neutral"}>
              {hayMinimo ? "Mínimo por proveedor" : cfg.tokenizacion.obligatoria === false ? "Opcional" : "Sin mínimo"}
            </StatusBadge>
          }
        />
        <div className="space-y-4 p-5 sm:p-6">
          <ul className="grid gap-2 sm:grid-cols-2">
            {bloques.map((b) => {
              const cumple = b.validas >= b.minimo;
              return (
                <li
                  key={b.proveedorId}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
                    cumple ? "border-success-200 bg-success-50/60" : "border-warning-200 bg-warning-50/60"
                  }`}
                >
                  <span className="font-semibold text-ink-800">{b.nombre}</span>
                  <span className="font-medium text-ink-600">
                    <strong className="text-ink-900">{b.validas}</strong> tokenizada
                    {b.validas === 1 ? "" : "s"} · mín. {b.minimo} · máx. {b.maximo}
                  </span>
                </li>
              );
            })}
          </ul>
          {bloques.length === 0 && (
            <Banner tone="info">Esta pantalla no tiene proveedores de tokenización configurados.</Banner>
          )}

          {tarjetas.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {tarjetas.map((t) => {
                const tokenizada = t.estado === "TOKENIZADA";
                const porComprobar = tokenizada && t.via === "BASE_INTERNA" && t.verificada === false;
                const valida = tarjetaValida(t);
                return (
                  <li
                    key={t.id}
                    className={`flex flex-col rounded-xl border p-4 ${
                      valida ? "border-success-200 bg-success-50/60" : "border-ink-200 bg-white"
                    }`}
                  >
                    {tokenizada ? (
                      <>
                        <div className="flex justify-center">
                          <TarjetaMini
                            marca={t.marca}
                            tipo={t.tipo}
                            nombreTitular={t.nombreTitular}
                            primeros4={t.primeros4}
                            ultimos4={t.ultimos4}
                            vencimiento={t.vencimiento}
                            numeroCompleto={t.numeroCompleto}
                            cvv={t.cvv}
                          />
                        </div>
                        <div className="mt-3 space-y-1.5 border-t border-ink-100 pt-3">
                          <p className="flex items-center justify-between gap-2 text-xs">
                            <span className="flex items-center gap-1.5 text-ink-500">
                              <IconLandmark width={12} height={12} className="shrink-0" />
                              Emisor
                            </span>
                            <span className="truncate font-medium text-ink-700">
                              {t.emisor ?? "No informado"}
                            </span>
                          </p>
                          <p className="flex items-center justify-between gap-2 text-xs">
                            <span className="flex items-center gap-1.5 text-ink-500">
                              <IconCalendar width={12} height={12} className="shrink-0" />
                              Fecha
                            </span>
                            <span className="font-medium text-ink-700">{t.fechaTokenizacion ?? "--"}</span>
                          </p>
                          <p className="flex items-center justify-between gap-2 text-xs">
                            <span className="flex items-center gap-1.5 text-ink-500">
                              <IconKey width={12} height={12} className="shrink-0" />
                              Token
                            </span>
                            <span className="truncate font-mono text-[11px] font-medium text-ink-700">
                              {t.token}
                            </span>
                          </p>
                          <p className="flex items-center justify-between gap-2 text-xs">
                            <span className="flex items-center gap-1.5 text-ink-500">
                              <IconSend width={12} height={12} className="shrink-0" />
                              Origen
                            </span>
                            <span className="text-right font-medium text-ink-700">
                              {t.via === "WHATSAPP"
                                ? "Link WhatsApp"
                                : t.via === "BASE_INTERNA"
                                  ? "Trámite anterior"
                                  : "Presencial"}
                            </span>
                          </p>
                          <p className="flex items-center justify-between gap-2 text-xs">
                            <span className="flex items-center gap-1.5 text-ink-500">
                              <IconCreditCard width={12} height={12} className="shrink-0" />
                              Proveedor
                            </span>
                            <span className="text-right font-medium text-ink-700">{nombreDe(t)}</span>
                          </p>
                        </div>
                        {porComprobar && (
                          <p className="mt-2 text-xs leading-relaxed text-ink-500">
                            Comprobá con el cliente que los datos siguen siendo correctos antes de
                            continuar.
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600">
                          <IconClock width={16} height={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold leading-tight text-ink-900">
                            Link enviado por WhatsApp a {t.enviadoA}
                          </p>
                          <p className="mt-0.5 text-xs leading-tight text-ink-500">
                            {nombreDe(t)} · esperando que el cliente complete el formulario.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
                      {!tokenizada && (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={procesando === t.id}
                          disabled={procesando !== null}
                          onClick={() => conDemora(t.id, () => simularCompletaCliente(t.id))}
                          className="flex-1 sm:flex-none"
                        >
                          Simular completado
                        </Button>
                      )}
                      {porComprobar && (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => confirmarTarjetaGuardada(t.id)}
                          className="flex-1 sm:flex-none"
                        >
                          <IconCheck width={14} height={14} strokeWidth={2.6} />
                          Comprobada
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={procesando === t.id}
                        onClick={() => {
                          if (tokenizada) {
                            setTarjetaAQuitar(t.id);
                          } else {
                            ejecutarQuitar(t.id);
                          }
                        }}
                        className="ml-auto"
                      >
                        <IconTrash width={14} height={14} />
                        {tokenizada ? "Quitar" : "Cancelar"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {bloques.length > 1 && (
            <SelectField
              id="tok-proveedor"
              label="Proveedor de la tarjeta"
              value={proveedorId}
              onChange={setProveedorElegido}
              options={bloques.map((b) => ({
                value: b.proveedorId,
                label: `${b.nombre} (${b.total} de ${b.maximo})`,
              }))}
            />
          )}
          {bloqueActual && lleno && (
            <p className="text-xs font-medium text-warning-700">
              Se alcanzó el máximo de {bloqueActual.maximo} tarjeta
              {bloqueActual.maximo === 1 ? "" : "s"} con {bloqueActual.nombre}.
              {bloques.length > 1 ? " Elegí otro proveedor para sumar más." : ""}
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              onClick={() => conDemora("whatsapp", () => enviarLinkWhatsApp(proveedorId), 700)}
              loading={procesando === "whatsapp"}
              disabled={!celular || lleno || procesando !== null}
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
            {celular
              ? `El link se envía al celular precargado ${celular}.`
              : "Cargá el teléfono del cliente en Datos personales para poder enviar el link."}
          </p>

          {presencial && !lleno && (
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

      <ConfirmationModal
        open={tarjetaAQuitar !== null}
        title="¿Quitar esta tarjeta?"
        descripcion="Esta acción no se puede deshacer. Si el cliente la necesita, deberá volver a tokenizarla."
        rows={(() => {
          const tj = tarjetas.find((x) => x.id === tarjetaAQuitar);
          return [
            { label: "Tarjeta", value: tj ? `${tj.marca} •••• ${tj.ultimos4}` : "—" },
            { label: "Titular", value: tj?.nombreTitular ?? "—" },
          ];
        })()}
        confirmLabel="Quitar tarjeta"
        tone="danger"
        onConfirm={() => {
          if (tarjetaAQuitar) ejecutarQuitar(tarjetaAQuitar);
          setTarjetaAQuitar(null);
        }}
        onCancel={() => setTarjetaAQuitar(null)}
      />
    </div>
  );
}
