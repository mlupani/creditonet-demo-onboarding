"use client";

import { useState } from "react";
import { useApplication } from "@/lib/application-context";
import { intentoActual, puedeRefirmar, requiereChequeoTelefonico } from "@/lib/firma";
import { intentosChequeo, textoChequeo } from "@/lib/historial";
import { HistorialCredito } from "@/components/HistorialCredito";
import { MOTIVOS_RECHAZO } from "@/lib/validation";
import { MAX_INTENTOS_FIRMA, type ResultadoFirma } from "@/lib/types";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { EstadoBadge } from "@/components/ui/StatusBadge";
import { SESION_SUPERVISOR } from "@/lib/config";
import { IconCheck, IconEye, IconRefresh, IconUsers, IconX } from "@/components/icons";

const RESULTADO_LABEL: Record<ResultadoFirma, string> = {
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  REFIRMA_SOLICITADA: "Refirma solicitada",
  RECHAZADA: "Rechazada",
};

const METODO_LABEL = { ELECTRONICA: "Electrónica", FISICA: "Manual" } as const;

// Tramo posterior a la aprobación: FEL (el cliente firma, en papel o en línea) → AFEL (firma
// aprobada) → chequeo telefónico, si el producto lo pide → para liquidar. Desde AFEL se puede
// volver a FEL por una firma inconsistente.
export function FirmaPanel({
  onRechazar,
}: {
  onRechazar: (codigo: string, motivo: string, observacion: string) => void;
}) {
  const {
    app,
    registrarFirmaCliente,
    confirmarChequeoFirma,
    verificarFirma,
    solicitarRefirma,
    enviarASuperior,
    aprobarSuperior,
    devolverChequeo,
  } = useApplication();
  const [modal, setModal] = useState<"refirma" | "rechazo" | "verFirma" | "superior" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [texto, setTexto] = useState("");
  const [intentado, setIntentado] = useState(false);

  const actual = intentoActual(app.firmas);
  const refirmaDisponible = puedeRefirmar(app.firmas);
  const chequeo = requiereChequeoTelefonico(app.configuracion);
  const segunda = actual?.n === MAX_INTENTOS_FIRMA;
  // Origen chequeo: el chequeador marcó no-correcto y lo mandó al superior.
  const supChequeo = app.estado === "SUPERIOR" && app.chequeoTelefonico?.resultado === "NO_OK";

  function abrirRechazo() {
    setMotivo("");
    setTexto("");
    setIntentado(false);
    setModal("rechazo");
  }

  function confirmarRechazo() {
    setIntentado(true);
    if (!motivo || texto.trim().length < 5) return;
    const m = MOTIVOS_RECHAZO.find((r) => r.codigo === motivo);
    onRechazar(motivo, m?.label ?? motivo, texto.trim());
    setModal(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink-900">Firma del crédito</h2>
          <p className="text-sm text-ink-500">
            {app.numeroCredito} · {app.cliente?.nombre} {app.cliente?.apellido}
          </p>
        </div>
        <EstadoBadge estado={app.estado} />
      </div>

      {app.estado === "EN_FIRMA" && (
        <Card className="space-y-3 p-4 sm:p-5">
          <Banner tone="info" title={`En firma (FEL)${segunda ? " · refirma" : ""}`}>
            {actual?.metodo === "FISICA"
              ? "Esperando que el cliente firme en papel. "
              : "Esperando que el cliente firme en línea. "}
            Cuando firme, el crédito pasa a AFEL (firma aprobada).
          </Banner>
          <Button onClick={registrarFirmaCliente}>
            {actual?.metodo === "FISICA" ? "Registrar firma manual recibida" : "Simular firma del cliente"}
          </Button>
        </Card>
      )}

      {app.estado === "FIRMADO" && (
        <Card className="space-y-3 p-4 sm:p-5">
          <Banner
            tone={segunda ? "warning" : "info"}
            title={`Firma aprobada (AFEL)${segunda ? " · segunda firma" : ""}`}
          >
            El cliente ya firmó.{" "}
            {chequeo
              ? "El producto requiere chequeo telefónico: al avanzar pasa al chequeador."
              : "El producto no requiere chequeo telefónico: al avanzar queda para liquidar."}{" "}
            {refirmaDisponible
              ? "Si la firma es inconsistente podés volver a FEL. Se permite una sola vez."
              : "Ya se usó la única refirma: si esta firma no es correcta, el crédito se rechaza."}{" "}
            {!app.firmaChequeada && "Antes de avanzar, chequeá la firma con \"Ver firma\"."}
          </Banner>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setModal("verFirma")}>
                <IconEye width={16} height={16} />
                Ver firma
              </Button>
              <Button variant="danger" onClick={abrirRechazo}>
                <IconX width={16} height={16} />
                Rechazar
              </Button>
              <Button
                variant="outline"
                onClick={() => setModal("superior")}
                disabled={!app.firmaChequeada}
                title="Pedir la aprobación de un superior antes de seguir"
              >
                <IconUsers width={16} height={16} />
                SUP
              </Button>
              {refirmaDisponible && (
                <Button variant="outline" onClick={() => setModal("refirma")}>
                  <IconRefresh width={16} height={16} />
                  Volver a FEL
                </Button>
              )}
            </div>
            <Button variant="success" onClick={verificarFirma} disabled={!app.firmaChequeada}>
              <IconCheck width={16} height={16} />
              {chequeo ? "Enviar a chequeo telefónico" : "Pasar a liquidar"}
            </Button>
          </div>
        </Card>
      )}

      {supChequeo && (
        <Card className="space-y-3 p-4 sm:p-5">
          <Banner tone="warning" title="Chequeo no correcto (SUP)">
            El chequeador marcó el chequeo como no correcto
            {app.aprobacionSuperior &&
              ` (enviado por ${app.aprobacionSuperior.enviadaPor} el ${app.aprobacionSuperior.fechaEnvio})`}
            : {app.chequeoTelefonico?.comentario} Lo común es rechazar y cerrar el crédito; como
            excepción se puede devolver a chequeo o aprobar a liquidación.
          </Banner>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="danger" onClick={abrirRechazo}>
                <IconX width={16} height={16} />
                Rechazar y cerrar
              </Button>
              <Button variant="outline" onClick={devolverChequeo}>
                <IconRefresh width={16} height={16} />
                Devolver a chequeo
              </Button>
            </div>
            <Button variant="success" onClick={aprobarSuperior}>
              <IconCheck width={16} height={16} />
              Aprobar a LIQ (excepción) · {SESION_SUPERVISOR.nombre}
            </Button>
          </div>
        </Card>
      )}

      {app.estado === "SUPERIOR" && !supChequeo && (
        <Card className="space-y-3 p-4 sm:p-5">
          <Banner tone="info" title="Aprobación de un superior (SUP)">
            La firma está verificada y el crédito espera el visto bueno de un superior de riesgo.{" "}
            {chequeo
              ? "Con su aprobación pasa al chequeador telefónico."
              : "Con su aprobación queda para liquidar."}
            {app.aprobacionSuperior &&
              ` Pedida por ${app.aprobacionSuperior.enviadaPor} (${app.aprobacionSuperior.fechaEnvio}).`}
          </Banner>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="danger" onClick={abrirRechazo}>
              <IconX width={16} height={16} />
              Rechazar
            </Button>
            <Button variant="success" onClick={aprobarSuperior}>
              <IconCheck width={16} height={16} />
              Aprobar como superior · {SESION_SUPERVISOR.nombre}
            </Button>
          </div>
        </Card>
      )}

      {app.estado === "CHEQUEO_TELEFONICO" && (
        <Card className="space-y-3 p-4 sm:p-5">
          <Banner tone="info" title="En chequeo telefónico">
            La firma está verificada y el crédito lo gestiona el chequeador desde su bandeja: si el
            chequeo es correcto pasa solo a liquidación y no vuelve a esta bandeja. El chequeador
            no puede rechazar; si no logra completarlo deja el intento registrado y el rechazo lo
            decide el analista desde acá.
          </Banner>
          <p className="text-sm text-ink-600">
            Estado del chequeo: <strong>{textoChequeo(app.chequeoTelefonico)}</strong>
          </p>
          {intentosChequeo(app.chequeoTelefonico).length > 0 ? (
            <div className="flex justify-end">
              <Button variant="danger" onClick={abrirRechazo}>
                <IconX width={16} height={16} />
                Rechazar
              </Button>
            </div>
          ) : (
            <p className="text-xs text-ink-500">
              Se puede rechazar una vez que el chequeador registre un intento sin completar.
            </p>
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-ink-900">Historial de firma</h3>
          <p className="text-xs text-ink-500">
            Hasta {MAX_INTENTOS_FIRMA} instancias: la firma original y una única refirma.
            {chequeo ? " El producto requiere chequeo telefónico." : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                <th className="px-4 py-2.5">Instancia</th>
                <th className="px-4 py-2.5">Método</th>
                <th className="px-4 py-2.5">Firmó el cliente</th>
                <th className="px-4 py-2.5">Resultado</th>
                <th className="px-4 py-2.5">Decisión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {app.firmas.map((f) => (
                <tr key={f.n}>
                  <td className="px-4 py-2.5 font-semibold text-ink-900">
                    {f.n === 1 ? "Firma original" : "Refirma"}
                  </td>
                  <td className="px-4 py-2.5 text-ink-700">{METODO_LABEL[f.metodo]}</td>
                  <td className="px-4 py-2.5 text-ink-700">{f.fechaFirma ?? "Pendiente"}</td>
                  <td className="px-4 py-2.5 text-ink-700">{RESULTADO_LABEL[f.resultado]}</td>
                  <td className="px-4 py-2.5 text-ink-700">{f.fechaResultado ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <HistorialCredito />

      <Modal
        open={modal === "verFirma"}
        onClose={() => setModal(null)}
        title="Ver firma"
        maxWidth="max-w-md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="danger"
              onClick={() => {
                setModal(null);
                abrirRechazo();
              }}
            >
              <IconX width={16} height={16} />
              Rechazar
            </Button>
            <Button
              variant="success"
              onClick={() => {
                confirmarChequeoFirma();
                setModal(null);
              }}
              autoFocus
            >
              <IconCheck width={16} height={16} />
              Confirmar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-600">
          Firma {actual ? METODO_LABEL[actual.metodo].toLowerCase() : ""} del cliente, recibida el{" "}
          {actual?.fechaFirma ?? "—"}. Confirmá si la firma es consistente con la identidad del
          cliente o rechazá la solicitud.
        </p>
        <div className="mt-4 flex h-32 items-center justify-center rounded-xl border border-dashed border-ink-300 bg-ink-25">
          <span className="font-serif text-2xl italic text-ink-700">
            {app.cliente?.nombre} {app.cliente?.apellido}
          </span>
        </div>
      </Modal>

      <ConfirmationModal
        open={modal === "superior"}
        title="Enviar a aprobación superior (SUP)"
        descripcion={`La firma queda verificada y el crédito espera el visto bueno de un superior. ${
          chequeo ? "Con su aprobación pasa al chequeo telefónico." : "Con su aprobación queda para liquidar."
        }`}
        rows={[
          { label: "ID de Crédito", value: app.numeroCredito ?? "—" },
          { label: "Firma", value: actual ? `Instancia ${actual.n} de ${MAX_INTENTOS_FIRMA}` : "—" },
        ]}
        confirmLabel="Enviar a SUP"
        onConfirm={() => {
          setModal(null);
          enviarASuperior();
        }}
        onCancel={() => setModal(null)}
      />

      <ConfirmationModal
        open={modal === "refirma"}
        title="Solicitar refirma"
        descripcion="El crédito vuelve a FEL para que el cliente firme de nuevo. Es la única refirma permitida: si la nueva firma también es incorrecta, sólo queda rechazar."
        rows={[
          { label: "ID de Crédito", value: app.numeroCredito ?? "—" },
          { label: "Firma actual", value: actual ? `Instancia ${actual.n} de ${MAX_INTENTOS_FIRMA}` : "—" },
        ]}
        confirmLabel="Solicitar refirma"
        onConfirm={() => {
          setModal(null);
          solicitarRefirma();
        }}
        onCancel={() => setModal(null)}
      />

      <Modal
        open={modal === "rechazo"}
        onClose={() => setModal(null)}
        title="Rechazar la solicitud"
        maxWidth="max-w-md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmarRechazo}>
              Confirmar rechazo
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-600">
          El rechazo es definitivo. Se registran el motivo codificado y la observación.
          {segunda && app.estado === "FIRMADO" ? " Una segunda firma incorrecta obliga al rechazo." : ""}
        </p>
        <div className="mt-4">
          <SelectField
            id="motivo-firma"
            label="Motivo codificado"
            required
            value={motivo}
            onChange={setMotivo}
            options={MOTIVOS_RECHAZO.map((m) => ({ value: m.codigo, label: `${m.codigo} · ${m.label}` }))}
            error={intentado && !motivo ? "Seleccioná un motivo." : undefined}
          />
        </div>
        <div className="mt-4">
          <label htmlFor="texto-firma" className="mb-1.5 block text-sm font-medium text-ink-700">
            Observación
          </label>
          <textarea
            id="texto-firma"
            rows={3}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Detallá qué está mal con la firma"
            className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-sm shadow-xs outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          {intentado && texto.trim().length < 5 && (
            <p className="mt-1.5 text-xs font-medium text-danger-600">
              Ingresá una observación de al menos 5 caracteres.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
