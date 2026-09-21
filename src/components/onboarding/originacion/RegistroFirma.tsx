"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useApplication } from "@/lib/application-context";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IconCheck, IconPencil, IconRefresh, IconTrash } from "@/components/icons";

// Lienzo para dibujar la firma con el mouse, el dedo o un lápiz.
function LienzoFirma({ onRegistrar }: { onRegistrar: (imagen: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  // Límites del trazo (en px de pantalla), para guardar la firma recortada.
  const limites = useRef({ minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 });
  const [hayTrazo, setHayTrazo] = useState(false);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = c.getBoundingClientRect();
    c.width = width * ratio;
    c.height = height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#101828";
  }, []);

  function punto(e: PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
    const l = limites.current;
    l.minX = Math.min(l.minX, p.x);
    l.minY = Math.min(l.minY, p.y);
    l.maxX = Math.max(l.maxX, p.x);
    l.maxY = Math.max(l.maxY, p.y);
    return p;
  }

  function empezar(e: PointerEvent<HTMLCanvasElement>) {
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dibujando.current = true;
    const { x, y } = punto(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Un toque sin arrastrar deja un punto.
    ctx.lineTo(x + 0.01, y);
    ctx.stroke();
    setHayTrazo(true);
  }

  function trazar(e: PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = punto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function terminar() {
    dibujando.current = false;
  }

  function borrar() {
    const c = canvas.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    limites.current = { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 };
    setHayTrazo(false);
  }

  // Guarda sólo la zona de la firma, con un margen, para que se lea bien en miniatura.
  function registrar() {
    const c = canvas.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const margen = 12;
    const { minX, minY, maxX, maxY } = limites.current;
    const x = Math.max(0, (minX - margen) * ratio);
    const y = Math.max(0, (minY - margen) * ratio);
    const w = Math.min(c.width - x, (maxX - minX + margen * 2) * ratio);
    const h = Math.min(c.height - y, (maxY - minY + margen * 2) * ratio);
    const recorte = document.createElement("canvas");
    recorte.width = w;
    recorte.height = h;
    recorte.getContext("2d")?.drawImage(c, x, y, w, h, 0, 0, w, h);
    onRegistrar(recorte.toDataURL("image/png"));
  }

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvas}
          aria-label="Espacio para dibujar la firma del cliente"
          onPointerDown={empezar}
          onPointerMove={trazar}
          onPointerUp={terminar}
          onPointerCancel={terminar}
          className="h-44 w-full cursor-crosshair touch-none rounded-xl border-2 border-dashed border-ink-300 bg-white"
        />
        {!hayTrazo && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-ink-300">
            Firmá acá con el dedo, el mouse o un lápiz
          </span>
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-ink-200"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={!hayTrazo}
          onClick={registrar}
        >
          <IconCheck width={16} height={16} strokeWidth={2.6} />
          Registrar firma
        </Button>
        <Button variant="outline" disabled={!hayTrazo} onClick={borrar}>
          <IconTrash width={16} height={16} />
          Borrar
        </Button>
      </div>
    </div>
  );
}

// Cliente nuevo: se le puede pedir una firma manuscrita durante la identificación. No es la
// firma electrónica del crédito: es un registro de la firma del cliente, que sirve de
// referencia para comparar después una firma física cargada al legajo.
export function RegistroFirma() {
  const { app, registrarFirma, borrarFirma } = useApplication();
  const firma = app.identificacion.firmaRegistrada;

  return (
    <Card>
      <CardHeader
        title="Registro de firma del cliente"
        description="Firma manuscrita de referencia, tomada durante la identificación."
        icon={<IconPencil width={18} height={18} />}
        action={<StatusBadge>Opcional · cliente nuevo</StatusBadge>}
      />
      <div className="space-y-4 p-5 sm:p-6">
        <Banner tone="info" title="No es la firma electrónica del crédito">
          Es un <strong>registro de firma</strong> del cliente. Sirve como referencia para
          comparar más adelante la <strong>firma física</strong> que se cargue al legajo. La firma
          electrónica del crédito es un proceso aparte.
        </Banner>

        {firma ? (
          <div>
            <div className="rounded-xl border border-success-200 bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- dibujo del cliente, sólo en memoria del navegador */}
              <img
                src={firma.imagen}
                alt="Firma registrada del cliente"
                className="mx-auto h-40 w-full max-w-md object-contain"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-success-700">
                <IconCheck width={15} height={15} strokeWidth={2.8} />
                Firma registrada · {firma.fecha}
              </p>
              <Button size="sm" variant="outline" onClick={borrarFirma}>
                <IconRefresh width={14} height={14} />
                Volver a firmar
              </Button>
            </div>
          </div>
        ) : (
          <LienzoFirma onRegistrar={registrarFirma} />
        )}
      </div>
    </Card>
  );
}
