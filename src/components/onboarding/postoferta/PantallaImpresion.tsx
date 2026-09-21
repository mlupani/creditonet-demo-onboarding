"use client";

import { useState, type ReactNode } from "react";
import { useApplication } from "@/lib/application-context";
import {
  SISTEMAS_AMORTIZACION,
  configEfectiva,
  nombreOpcion,
  ORGANISMOS,
  PRODUCTOS,
} from "@/lib/config";
import {
  bancosDe,
  campoVisible,
  camposDe,
  SECCIONES,
  valorCampo,
  type PantallaConCampos,
} from "@/lib/campos-post-oferta";
import { getTipoDocumento } from "@/lib/parametros";
import { netoAAcreditar, planDeSolicitud } from "@/lib/credit";
import { formatARS, nombreApellido } from "@/lib/format";
import { estadoPantallasPostOferta } from "@/lib/validation";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import {
  IconCheck,
  IconCheckCircle,
  IconClock,
  IconEye,
  IconPrinter,
} from "@/components/icons";

function Fila({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="min-w-0 break-words text-right font-semibold tabular-nums text-ink-900">
        {value}
      </span>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mt-3 border-t border-ink-100 pt-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">{titulo}</p>
      {children}
    </div>
  );
}

// PDF del legajo: contiene los datos cargados en las pantallas anteriores (Onboarding §10).
function DocumentoLegajo() {
  const { app } = useApplication();
  const cfg = configEfectiva(app.configuracion);
  const po = app.postOferta;
  const o = app.oferta;
  const tokenizadas = po.tarjetas.filter((t) => t.estado === "TOKENIZADA");
  const sistema = (
    SISTEMAS_AMORTIZACION.find((s) => s.value === planDeSolicitud(app).sistema)?.label ?? ""
  )
    .split(" (")[0]
    .toLowerCase();

  const datos = (pantalla: PantallaConCampos) =>
    Array.from(new Set(camposDe(pantalla).map((c) => c.seccion))).map((seccion) => (
      <Bloque key={seccion} titulo={SECCIONES[seccion].titulo}>
        {camposDe(pantalla, seccion, po[pantalla])
          .filter((c) => campoVisible(app, c))
          .map((c) => {
          const valor =
            c.tipo === "multiselect"
              ? bancosDe(valorCampo(app, c)).join(", ")
              : valorCampo(app, c);
          return valor ? <Fila key={c.id} label={c.label} value={valor} /> : null;
        })}
      </Bloque>
    ));

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-xs">
      <p className="text-center text-xs font-bold uppercase tracking-widest text-ink-400">
        CreditoNet · Legajo de solicitud
      </p>
      <p className="mt-1 text-center font-mono text-sm font-semibold text-brand-700">
        ID de Crédito {app.numeroCredito} · ID de Cliente {app.numeroCliente}
      </p>
      <p className="mt-1 text-center text-xs text-ink-500">
        Incluye solicitud, pagaré y autorización de descuento de haberes.
      </p>

      <Bloque titulo="Condiciones del crédito">
        <Fila label="Producto" value={nombreOpcion(PRODUCTOS, app.configuracion.productoId)} />
        <Fila label="Organismo" value={nombreOpcion(ORGANISMOS, app.configuracion.organismoId)} />
        <Fila label="Plan de cuotas" value={planDeSolicitud(app).nombre} />
        <Fila label="Capital solicitado" value={formatARS(o.montoSolicitado)} />
        <Fila label="Acreditación neta" value={formatARS(netoAAcreditar(o))} />
        <Fila label="Plazo" value={`${o.plazo} cuotas de ${formatARS(o.valorCuota)}`} />
        <Fila label="TNA" value={`${o.tna}%`} />
        <Fila label="Total a pagar" value={formatARS(o.totalAPagar)} />
      </Bloque>

      {datos("personales")}
      {datos("laboral")}

      <Bloque titulo="Tarjetas tokenizadas">
        {tokenizadas.length > 0 ? (
          tokenizadas.map((t) => (
            <Fila key={t.id} label={`${t.marca} •••• ${t.ultimos4}`} value={t.token ?? ""} />
          ))
        ) : (
          <p className="py-1 text-sm text-ink-500">Sin tarjetas tokenizadas.</p>
        )}
      </Bloque>

      <Bloque titulo="Referencias personales">
        {po.referencias.map((r) => (
          <Fila
            key={r.id}
            label={`${nombreApellido(r) || "Sin nombre"} · ${r.vinculo || "sin vínculo"}`}
            value={r.email || "—"}
          />
        ))}
      </Bloque>

      {po.garantes.length > 0 && (
        <Bloque titulo="Garantes">
          {po.garantes.map((g) => (
            <Fila
              key={g.id}
              label={`${nombreApellido(g) || "Sin nombre"} · DNI ${g.dni || "—"}`}
              value={g.vinculo || "—"}
            />
          ))}
        </Bloque>
      )}

      <Bloque titulo="Documentación">
        {cfg.documentos.map((d) => {
          const n = po.legajo[d.tipoId]?.length ?? 0;
          return (
            <Fila
              key={d.tipoId}
              label={getTipoDocumento(d.tipoId).nombre}
              value={n > 0 ? `${n} archivo${n === 1 ? "" : "s"}` : "Pendiente"}
            />
          );
        })}
      </Bloque>

      <Bloque titulo="Términos y condiciones">
        <p className="mt-1 text-xs leading-relaxed text-ink-500">
          El presente legajo resume las condiciones de la operación. El sistema de amortización es
          {sistema}. El crédito queda sujeto a la aprobación final del área de
          análisis. Documento generado con fines de demostración.
        </p>
      </Bloque>
    </div>
  );
}

// Pantalla 7 · Impresión de legajo (Onboarding §10): imprimir o visualizar el PDF completo.
// Cualquiera de las dos acciones completa la pantalla.
export function PantallaImpresion() {
  const { app, registrarLegajo } = useApplication();
  const [procesando, setProcesando] = useState(false);
  const [viendo, setViendo] = useState(false);
  const registro = app.postOferta.impresion;
  const secciones = estadoPantallasPostOferta(app).filter((e) => e.id !== "impresion");

  function imprimir() {
    setProcesando(true);
    window.setTimeout(() => {
      registrarLegajo("IMPRESO");
      setProcesando(false);
    }, 1000);
  }

  function visualizar() {
    setViendo(true);
    registrarLegajo("VISUALIZADO");
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Impresión de legajo"
          description="PDF completo con los datos cargados en las pantallas anteriores, para lectura y firma del cliente."
          icon={<IconPrinter width={18} height={18} />}
        />
        <div className="p-5 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
            Contenido del legajo
          </p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            <li className="flex items-center gap-2 text-sm text-ink-700">
              <IconCheckCircle width={15} height={15} className="text-success-600" />
              Condiciones del crédito
            </li>
            {secciones.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm text-ink-700">
                {s.completa ? (
                  <IconCheckCircle width={15} height={15} className="text-success-600" />
                ) : (
                  <IconClock width={15} height={15} className="text-warning-600" />
                )}
                {s.label}
                {!s.completa && <span className="text-xs text-ink-400">· con pendientes</span>}
              </li>
            ))}
          </ul>

          {registro && (
            <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-success-200 bg-success-50 px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-600 text-white">
                <IconCheck width={16} height={16} strokeWidth={2.6} />
              </span>
              <div>
                <p className="text-sm font-bold text-success-700">
                  Documento disponible para el cliente
                </p>
                <p className="text-xs text-success-700/80">
                  legajo_{app.numeroCredito}.pdf ·{" "}
                  {registro.accion === "IMPRESO" ? "impreso" : "visualizado"} · {registro.fecha} ·
                  la pantalla quedó completa.
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button size="lg" onClick={imprimir} loading={procesando}>
              {!procesando && <IconPrinter width={16} height={16} />}
              Imprimir PDF
            </Button>
            <Button size="lg" variant="outline" onClick={visualizar} disabled={procesando}>
              <IconEye width={16} height={16} />
              Visualizar en pantalla
            </Button>
          </div>
        </div>
      </Card>

      <Banner tone="info">
        Al imprimir o visualizar el PDF la pantalla se marca como completa y queda registrada la
        disponibilidad del documento para el cliente.
      </Banner>

      <Modal
        open={viendo}
        onClose={() => setViendo(false)}
        title={`Legajo ${app.numeroCredito ?? ""}`}
        maxWidth="max-w-2xl"
        footer={
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setViendo(false)}>
              Cerrar
            </Button>
          </div>
        }
      >
        <DocumentoLegajo />
      </Modal>
    </div>
  );
}
