"use client";

import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useApplication } from "@/lib/application-context";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconCamera, IconCheck, IconCheckCircle, IconScanFace, IconUpload } from "@/components/icons";

function Retrato({
  etiqueta,
  live,
  children,
}: {
  etiqueta: string;
  live?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex-1">
      <div
        className={`relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl border ${
          live ? "border-brand-200 bg-brand-50" : "border-ink-200 bg-ink-100"
        }`}
      >
        {children}
        {live && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-danger-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            En vivo
          </span>
        )}
      </div>
      <p className="mt-1.5 text-center text-xs font-medium text-ink-500">{etiqueta}</p>
    </div>
  );
}

function Iniciales({ texto, live }: { texto: string; live?: boolean }) {
  return (
    <span
      className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold ${
        live ? "bg-brand-200 text-brand-700" : "bg-ink-300 text-ink-600"
      }`}
    >
      {texto}
    </span>
  );
}

// Cliente existente: se muestra la foto archivada para verificación presencial (Guía §3.1).
export function VerificacionPresencial() {
  const { app, verificarIdentidad } = useApplication();
  const [fotoPresente, setFotoPresente] = useState<string | null>(null);
  const inputSubir = useRef<HTMLInputElement>(null);
  const inputCapturar = useRef<HTMLInputElement>(null);

  if (!app.cliente) return null;
  const iniciales = `${app.cliente.nombre.charAt(0)}${app.cliente.apellido.charAt(0)}`;
  const verificada = app.identidadVerificada;

  function elegirFoto(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (archivo) setFotoPresente(URL.createObjectURL(archivo));
    e.target.value = "";
  }

  return (
    <Card>
      <CardHeader
        title="Verificación presencial"
        description="Compará la foto archivada con la persona presente y validá su identidad."
        icon={<IconScanFace width={18} height={18} />}
      />
      <div className="p-5 sm:p-6">
        <div className="mx-auto flex max-w-sm gap-4">
          <Retrato etiqueta="Foto archivada · 12/03/2022">
            {/* eslint-disable-next-line @next/next/no-img-element -- ilustración simulada, no una foto real */}
            <img
              src="/avatars/foto-archivada-cliente.png"
              alt="Foto archivada"
              className="h-full w-full object-cover"
            />
          </Retrato>
          <Retrato etiqueta="Persona presente" live>
            {fotoPresente ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto simulada, sólo en memoria del navegador
              <img
                src={fotoPresente}
                alt="Persona presente"
                className="h-full w-full object-cover"
              />
            ) : (
              <Iniciales texto={iniciales} live />
            )}
          </Retrato>
        </div>

        <div className="mx-auto mt-3 flex max-w-sm flex-wrap justify-center gap-2">
          <input
            ref={inputSubir}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={elegirFoto}
          />
          <input
            ref={inputCapturar}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={elegirFoto}
          />
          <Button size="sm" variant="outline" onClick={() => inputSubir.current?.click()}>
            <IconUpload width={14} height={14} />
            Subir foto
          </Button>
          <Button size="sm" variant="outline" onClick={() => inputCapturar.current?.click()}>
            <IconCamera width={14} height={14} />
            Capturar imagen
          </Button>
        </div>

        {verificada ? (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-success-200 bg-success-50 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success-600 text-white">
              <IconCheck width={16} height={16} strokeWidth={2.6} />
            </span>
            <div>
              <p className="text-sm font-bold text-success-700">Identidad verificada</p>
              <p className="text-xs text-success-700/80">
                El vendedor confirmó la coincidencia con la persona presente.
              </p>
            </div>
          </div>
        ) : (
          <Button className="mt-4 w-full sm:w-auto" size="lg" onClick={verificarIdentidad}>
            <IconCheckCircle width={17} height={17} />
            Identidad verificada
          </Button>
        )}
      </div>
    </Card>
  );
}
