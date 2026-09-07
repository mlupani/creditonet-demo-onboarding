"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { nombreOpcion, ORGANISMOS, PRODUCTOS } from "@/lib/config";
import { netoAAcreditar } from "@/lib/credit";
import { formatARS, formatDNI } from "@/lib/format";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconCheck, IconPrinter } from "@/components/icons";

function Fila({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="font-semibold tabular-nums text-ink-900">{value}</span>
    </div>
  );
}

export function PantallaImpresion() {
  const { app, generarImpresion } = useApplication();
  const [procesando, setProcesando] = useState(false);
  const o = app.oferta;
  const generado = app.postOferta.impresionGenerada;

  function imprimir() {
    setProcesando(true);
    window.setTimeout(() => {
      generarImpresion();
      setProcesando(false);
    }, 1000);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Impresión de legajo"
          description="Vista previa del legajo para firma."
          icon={<IconPrinter width={18} height={18} />}
        />
        <div className="p-5 sm:p-6">
          <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-xs">
            <p className="text-center text-xs font-bold uppercase tracking-widest text-ink-400">
              CreditoNet · Legajo de solicitud
            </p>
            <p className="mt-1 text-center font-mono text-sm font-semibold text-brand-700">
              {app.numeroCredito}
            </p>

            <div className="mt-4 border-t border-ink-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                Datos del cliente
              </p>
              <Fila label="Nombre" value={`${app.cliente?.nombre} ${app.cliente?.apellido}`} />
              <Fila label="DNI" value={formatDNI(app.cliente?.dni ?? "")} />
              <Fila label="CUIL" value={app.cliente?.cuil ?? "—"} />
              <Fila
                label="Domicilio"
                value={app.postOferta.personales.domicilioCompleto || "—"}
              />
            </div>

            <div className="mt-3 border-t border-ink-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                Condiciones del crédito
              </p>
              <Fila
                label="Producto"
                value={nombreOpcion(PRODUCTOS, app.configuracion.productoId)}
              />
              <Fila
                label="Organismo"
                value={nombreOpcion(ORGANISMOS, app.configuracion.organismoId)}
              />
              <Fila label="Capital solicitado" value={formatARS(o.montoSolicitado)} />
              <Fila label="Neto a acreditar" value={formatARS(netoAAcreditar(o))} />
              <Fila label="Plazo" value={`${o.plazo} cuotas`} />
              <Fila label="Valor de cuota" value={formatARS(o.valorCuota)} />
              <Fila label="TNA" value={`${o.tna}%`} />
              <Fila label="Total a pagar" value={formatARS(o.totalAPagar)} />
            </div>

            <div className="mt-3 border-t border-ink-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                Plan de pagos
              </p>
              <p className="mt-1 text-sm text-ink-600">
                {o.plazo} cuotas mensuales, iguales y consecutivas de{" "}
                <strong className="text-ink-900">{formatARS(o.valorCuota)}</strong>. Primera cuota:{" "}
                <strong className="text-ink-900">{o.primeraCuotaVencimiento}</strong>.
              </p>
            </div>

            <div className="mt-3 border-t border-ink-100 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                Términos y condiciones
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                El presente legajo resume las condiciones de la operación. El sistema de
                amortización es francés con cuota fija. El crédito queda sujeto a la aprobación
                final del área de análisis. Documento generado con fines de demostración.
              </p>
            </div>
          </div>

          {generado ? (
            <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-success-200 bg-success-50 px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success-600 text-white">
                <IconCheck width={16} height={16} strokeWidth={2.6} />
              </span>
              <div>
                <p className="text-sm font-bold text-success-700">Legajo generado</p>
                <p className="text-xs text-success-700/80">
                  legajo_{app.numeroCredito}.pdf · la pantalla quedó marcada como completa.
                </p>
              </div>
            </div>
          ) : (
            <Button className="mt-4" size="lg" onClick={imprimir} loading={procesando}>
              {!procesando && <IconPrinter width={16} height={16} />}
              Imprimir legajo
            </Button>
          )}
        </div>
      </Card>

      <Banner tone="info">
        Al presionar <strong>Imprimir legajo</strong> se genera el PDF (simulado) y esta pantalla
        se marca automáticamente como completa.
      </Banner>
    </div>
  );
}
