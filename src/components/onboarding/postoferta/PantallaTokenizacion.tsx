"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { MARCAS_TARJETA } from "@/lib/validation";
import type { TipoTarjeta } from "@/lib/types";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { SelectField } from "@/components/ui/SelectField";
import { DemoTag } from "@/components/ui/DemoTag";
import { IconCheck, IconCreditCard, IconKey, IconLoader } from "@/components/icons";

const TIPOS: { id: TipoTarjeta; label: string }[] = [
  { id: "DEBITO", label: "Tarjeta de débito" },
  { id: "PREPAGA", label: "Tarjeta prepaga" },
  { id: "CREDITO", label: "Tarjeta de crédito" },
];

export function PantallaTokenizacion() {
  const { app, patchTokenizacion, tokenizarTarjeta } = useApplication();
  const t = app.postOferta.tokenizacion;
  const [procesando, setProcesando] = useState(false);

  const completo =
    t.numero.replace(/\D/g, "").length >= 15 &&
    !!t.vencimiento.trim() &&
    !!t.marca.trim() &&
    t.cvv.trim().length >= 3;

  function tokenizar() {
    setProcesando(true);
    window.setTimeout(() => {
      tokenizarTarjeta();
      setProcesando(false);
    }, 900);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Tokenización de tarjeta"
          description="Medio de pago tokenizado por el proveedor configurado."
          icon={<IconCreditCard width={18} height={18} />}
          action={<DemoTag variant="config" detalle="Pantalla opcional para este producto. El proveedor de tokenización es simulado; no se envían datos reales." />}
        />
        <div className="p-5 sm:p-6">
          {t.tokenizada ? (
            <div className="rounded-xl border border-success-200 bg-success-50 p-5 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-600 text-white">
                <IconCheck width={24} height={24} strokeWidth={2.6} />
              </span>
              <p className="mt-3 text-sm font-bold text-success-700">Tarjeta tokenizada</p>
              <p className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-success-200 bg-white px-3 py-1 font-mono text-sm font-semibold text-ink-800">
                <IconKey width={14} height={14} className="text-success-600" />
                {t.token}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                Tipo de tarjeta
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {TIPOS.map((tipo) => (
                  <button
                    key={tipo.id}
                    type="button"
                    onClick={() => patchTokenizacion({ tipoTarjeta: tipo.id })}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                      t.tipoTarjeta === tipo.id
                        ? "border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600"
                        : "border-ink-200 bg-white text-ink-600 hover:border-brand-300"
                    }`}
                  >
                    {tipo.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-x-5 gap-y-1 sm:grid-cols-2">
                <FormField
                  id="tok-numero"
                  label="Número"
                  value={t.numero}
                  onChange={(v) => patchTokenizacion({ numero: v.replace(/[^\d ]/g, "").slice(0, 19) })}
                  inputMode="numeric"
                  placeholder="4509 9535 6623 3704"
                  className="sm:col-span-2"
                />
                <FormField
                  id="tok-venc"
                  label="Vencimiento"
                  value={t.vencimiento}
                  onChange={(v) => patchTokenizacion({ vencimiento: v })}
                  placeholder="MM/AA"
                />
                <SelectField
                  id="tok-marca"
                  label="Marca"
                  value={t.marca}
                  onChange={(v) => patchTokenizacion({ marca: v })}
                  options={MARCAS_TARJETA.map((m) => ({ value: m, label: m }))}
                />
                <FormField
                  id="tok-cvv"
                  label="Código de seguridad"
                  value={t.cvv}
                  onChange={(v) => patchTokenizacion({ cvv: v.replace(/\D/g, "").slice(0, 4) })}
                  inputMode="numeric"
                  placeholder="123"
                />
              </div>

              <div className="mt-4 flex items-center justify-between rounded-lg border border-ink-200 bg-ink-25 px-3 py-2 text-xs">
                <span className="font-medium text-ink-500">Proveedor de tokenización</span>
                <span className="rounded-full bg-warning-50 px-2 py-0.5 font-bold uppercase tracking-wide text-warning-700">
                  DEMO
                </span>
              </div>

              <Button
                className="mt-4"
                size="lg"
                onClick={tokenizar}
                loading={procesando}
                disabled={!completo || procesando}
              >
                {!procesando && <IconKey width={16} height={16} />}
                Tokenizar tarjeta
              </Button>
              {!completo && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
                  {procesando && <IconLoader width={12} height={12} />}
                  Completá los datos de la tarjeta para tokenizarla.
                </p>
              )}
            </>
          )}
        </div>
      </Card>

      <Banner tone="info">
        La tarjeta será tokenizada mediante el proveedor configurado. En la demo se usa un token
        ficticio y no se almacena ningún dato sensible.
      </Banner>
    </div>
  );
}
