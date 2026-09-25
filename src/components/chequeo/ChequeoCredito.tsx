"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { netoAAcreditar } from "@/lib/credit";
import { ORGANISMOS, PRODUCTOS, SESION_CHEQUEADOR, nombreOpcion } from "@/lib/config";
import {
  camposDe,
  campoVisible,
  valorCampo,
  valorCampoDisplay,
} from "@/lib/campos-post-oferta";
import { intentoActual } from "@/lib/firma";
import { intentosChequeo } from "@/lib/historial";
import { formatARS, formatDNI } from "@/lib/format";
import { TERMINOS } from "@/lib/terminologia";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { DatosCamposModal } from "@/components/analisis/ModalesAnalisis";
import { LegajoVirtualModal } from "@/components/analisis/LegajoVirtualModal";
import { ComentarioModal, ListaComentarios } from "@/components/bandeja/ModalesBandeja";
import {
  IconCheck,
  IconEye,
  IconFileText,
  IconPhone,
  IconUser,
  IconUsers,
} from "@/components/icons";

type Resultado = "OK" | "NO_OK" | "COMENTARIO";

const METODO_LABEL = { ELECTRONICA: "Electrónica", FISICA: "Manual" } as const;

const OPCIONES: { valor: Resultado; titulo: string; detalle: string }[] = [
  {
    valor: "OK",
    titulo: "Chequeo correcto",
    detalle: "El crédito pasa automáticamente a liquidación.",
  },
  {
    valor: "NO_OK",
    titulo: "No correcto → SUP",
    detalle:
      "No correcto (ej.: el cliente se arrepintió y no quiso el crédito). Pasa a un superior con tu comentario, que decide el cierre.",
  },
  {
    valor: "COMENTARIO",
    titulo: "Comentario canal de venta",
    detalle:
      "Deja un comentario para el canal de venta sin mover el crédito: sigue en chequeo.",
  },
];

function Telefono({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
      <span className="text-sm text-ink-500">{etiqueta}</span>
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums text-ink-900">
        <IconPhone width={14} height={14} className="text-brand-600" />
        {valor?.trim() || "—"}
      </span>
    </li>
  );
}

export function ChequeoCredito({ onSalir }: { onSalir: () => void }) {
  const { app, tomarChequeo, soltarChequeo, finalizarChequeo, enviarChequeoASuperior, agregarComentario } = useApplication();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [comentario, setComentario] = useState("");
  const [intentado, setIntentado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [consulta, setConsulta] = useState<"personales" | "laborales" | "comentario" | null>(null);
  const [legajoAbierto, setLegajoAbierto] = useState(false);
  if (!app.cliente || !app.chequeoTelefonico) return null;

  const cli = app.cliente;
  const o = app.oferta;
  const po = app.postOferta;
  const tomado = app.chequeoTelefonico.tomado;
  const firma = intentoActual(app.firmas);
  const comentarioValido = comentario.trim().length >= 5;
  const intentos = intentosChequeo(app.chequeoTelefonico);

  const filasDe = (campos: ReturnType<typeof camposDe>) =>
    campos
      .filter((c) => campoVisible(app, c))
      .map((c) => ({
        label: c.label,
        value: (valorCampoDisplay(app, c) || valorCampo(app, c) || "").trim() || "—",
      }));

  function pedirConfirmacion() {
    setIntentado(true);
    if (!resultado || resultado === "COMENTARIO" || !comentarioValido) return;
    setConfirmar(true);
  }

  function enviarComentario() {
    setIntentado(true);
    if (!comentarioValido) return;
    agregarComentario(comentario.trim(), SESION_CHEQUEADOR.nombre);
    setComentario("");
    setResultado(null);
    setIntentado(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink-900">Chequeo telefónico</h2>
          <p className="text-sm text-ink-500">
            {app.numeroCredito} · {cli.nombre} {cli.apellido}
          </p>
        </div>
        <EstadoBadge estado={app.estado} />
      </div>

      {intentos.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-ink-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-ink-900">
              Intentos registrados ({intentos.length})
            </h3>
          </div>
          <ol className="divide-y divide-ink-100">
            {intentos.map((it, i) => (
              <li key={`${it.fecha}-${i}`} className="px-5 py-2.5 text-sm">
                <span className="text-xs text-ink-400">
                  Intento {i + 1} · {it.fecha}
                </span>
                <p className="text-ink-800">{it.nota}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {!tomado && (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-sm font-semibold text-ink-900">Crédito pendiente de chequeo</p>
            <p className="text-xs text-ink-500">
              Tomalo para ver los teléfonos de contacto y registrar el resultado.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onSalir}>
              Volver
            </Button>
            <Button onClick={tomarChequeo}>Tomar chequeo</Button>
          </div>
        </Card>
      )}

      {tomado && (
        <>
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-ink-100 px-5 py-3">
              <IconPhone width={16} height={16} className="text-brand-600" />
              <h3 className="text-sm font-semibold text-ink-900">Teléfonos para el chequeo</h3>
            </div>
            <ul className="divide-y divide-ink-100">
              <Telefono etiqueta="Cliente" valor={cli.telefono} />
              {po.referencias.map((r) => (
                <Telefono
                  key={r.id}
                  etiqueta={`Referencia · ${r.vinculo} · ${r.nombre} ${r.apellido}`}
                  valor={r.telefono}
                />
              ))}
              {po.garantes.map((g) => (
                <Telefono
                  key={g.id}
                  etiqueta={`Garante · ${g.nombre} ${g.apellido}`}
                  valor={g.telefono}
                />
              ))}
            </ul>
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <dl className="space-y-2 text-sm">
                <p className="text-[11px] font-bold uppercase tracking-widest text-ink-400">
                  Cliente
                </p>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">Nombre</dt>
                  <dd className="font-semibold text-ink-900">
                    {cli.nombre} {cli.apellido}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">DNI</dt>
                  <dd className="font-semibold tabular-nums text-ink-900">{formatDNI(cli.dni)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">Producto</dt>
                  <dd className="font-semibold text-ink-900">
                    {nombreOpcion(PRODUCTOS, app.configuracion.productoId)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">Organismo</dt>
                  <dd className="font-semibold text-ink-900">
                    {nombreOpcion(ORGANISMOS, app.configuracion.organismoId)}
                  </dd>
                </div>
              </dl>
              <dl className="space-y-2 text-sm">
                <p className="text-[11px] font-bold uppercase tracking-widest text-ink-400">
                  Oferta y firma
                </p>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">Capital</dt>
                  <dd className="font-semibold tabular-nums text-ink-900">
                    {formatARS(o.montoSolicitado)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">Cuotas</dt>
                  <dd className="font-semibold tabular-nums text-ink-900">
                    {o.plazo} de {formatARS(o.valorCuota)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">{TERMINOS.saldoAcreditacion}</dt>
                  <dd className="font-semibold tabular-nums text-ink-900">
                    {formatARS(netoAAcreditar(o))}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-500">Firma verificada</dt>
                  <dd className="font-semibold text-ink-900">
                    {firma ? `${METODO_LABEL[firma.metodo]} · ${firma.fechaResultado ?? "—"}` : "—"}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
              <Button variant="outline" size="sm" onClick={() => setConsulta("personales")}>
                <IconUser width={15} height={15} />
                Datos personales
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConsulta("laborales")}>
                <IconUser width={15} height={15} />
                Datos laborales
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLegajoAbierto(true)}>
                <IconEye width={15} height={15} />
                Legajo virtual
              </Button>
            </div>
          </Card>

          {app.comentarios.length > 0 && (
            <Card className="px-5 pb-5 pt-1">
              <ListaComentarios titulo="Comentarios" />
            </Card>
          )}

          <Card className="space-y-4 p-4 sm:p-5">
            <div>
              <h3 className="text-sm font-semibold text-ink-900">Resultado del chequeo</h3>
              <p className="text-xs text-ink-500">
                Registrá el resultado de la llamada y un comentario para dejar constancia.
              </p>
            </div>
            <div role="radiogroup" aria-label="Resultado del chequeo" className="grid gap-2 sm:grid-cols-2">
              {OPCIONES.map((op) => {
                const activa = resultado === op.valor;
                return (
                  <button
                    key={op.valor}
                    type="button"
                    role="radio"
                    aria-checked={activa}
                    onClick={() => setResultado(op.valor)}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      activa
                        ? op.valor === "OK"
                          ? "border-success-500 bg-success-50"
                          : op.valor === "NO_OK"
                            ? "border-danger-500 bg-danger-50"
                            : "border-brand-500 bg-brand-50"
                        : "border-ink-300 bg-white hover:border-ink-400"
                    }`}
                  >
                    <p className="text-sm font-bold text-ink-900">{op.titulo}</p>
                    <p className="text-xs text-ink-500">{op.detalle}</p>
                  </button>
                );
              })}
            </div>
            {intentado && !resultado && (
              <p className="text-xs font-medium text-danger-600">Elegí el resultado del chequeo.</p>
            )}
            <div>
              <label htmlFor="comentario-chequeo" className="mb-1.5 block text-sm font-medium text-ink-700">
                Comentario
              </label>
              <textarea
                id="comentario-chequeo"
                rows={3}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder={
                  resultado === "COMENTARIO"
                    ? "Comentario para el canal de venta"
                    : resultado === "NO_OK"
                      ? "Qué pasó (ej.: el cliente se arrepintió y no quiso el crédito)"
                      : "Con quién hablaste y qué confirmó"
                }
                className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-sm shadow-xs outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
              {intentado && !comentarioValido && (
                <p className="mt-1.5 text-xs font-medium text-danger-600">
                  Ingresá un comentario de al menos 5 caracteres.
                </p>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  soltarChequeo();
                  onSalir();
                }}
              >
                Soltar chequeo
              </Button>
              {resultado === "COMENTARIO" ? (
                <Button variant="primary" onClick={enviarComentario}>
                  Enviar comentario
                </Button>
              ) : (
                <Button variant={resultado === "NO_OK" ? "danger" : "success"} onClick={pedirConfirmacion}>
                  {resultado === "NO_OK" ? (
                    <IconUsers width={16} height={16} />
                  ) : (
                    <IconCheck width={16} height={16} />
                  )}
                  {resultado === "NO_OK" ? "Enviar a SUP" : "Finalizar chequeo"}
                </Button>
              )}
            </div>
          </Card>
        </>
      )}

      {!tomado && (
        <Banner tone="info">
          {SESION_CHEQUEADOR.nombre}: al tomar el chequeo el crédito queda asignado a vos hasta
          que lo finalices o lo sueltes.
        </Banner>
      )}

      <DatosCamposModal
        open={consulta === "personales"}
        onClose={() => setConsulta(null)}
        titulo="Datos personales"
        filas={filasDe(camposDe("personales", undefined, po.personales))}
      />
      <DatosCamposModal
        open={consulta === "laborales"}
        onClose={() => setConsulta(null)}
        titulo="Datos laborales"
        filas={filasDe(camposDe("laboral", undefined, po.laboral))}
      />
      <ComentarioModal
        open={consulta === "comentario"}
        onClose={() => setConsulta(null)}
        autor={SESION_CHEQUEADOR.nombre}
        paraQuien="el canal de venta"
      />
      <LegajoVirtualModal open={legajoAbierto} onClose={() => setLegajoAbierto(false)} />
      <ConfirmationModal
        open={confirmar}
        title={resultado === "NO_OK" ? "Enviar a superior por no correcto" : "Finalizar chequeo telefónico"}
        descripcion={
          resultado === "OK"
            ? "El crédito pasa automáticamente a liquidación."
            : "El crédito pasa a un superior (SUP) como chequeo no correcto, con tu comentario. El superior decide el cierre."
        }
        rows={[
          { label: "ID de Crédito", value: app.numeroCredito ?? "—" },
          { label: "Resultado", value: resultado === "OK" ? "Correcto" : "No correcto → SUP" },
          { label: "Comentario", value: comentario.trim() },
        ]}
        confirmLabel={resultado === "NO_OK" ? "Enviar a SUP" : "Finalizar chequeo"}
        tone={resultado === "NO_OK" ? "danger" : "success"}
        onConfirm={() => {
          setConfirmar(false);
          if (resultado === "OK") finalizarChequeo("OK", comentario.trim());
          else if (resultado === "NO_OK") {
            enviarChequeoASuperior(comentario.trim());
            onSalir();
          }
        }}
        onCancel={() => setConfirmar(false)}
      />
    </div>
  );
}
