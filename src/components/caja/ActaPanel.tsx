"use client";

import { useState } from "react";
import {
  actaDe,
  firmarActa,
  necesitaFirmaRemota,
  registrarNegativaAFirmar,
  resolverActaEscalada,
  solicitarFirmaRemota,
} from "@/lib/actas";
import { esSupervisor } from "@/lib/caja-reglas";
import { nombreUsuario, useActas, useUsuarioActual } from "@/lib/caja-store";
import {
  ESTADO_ACTA_LABEL,
  ROL_CAJA_LABEL,
  TIPO_ACTA_LABEL,
  type ActaConformidad,
  type EstadoActa,
  type FirmaActa,
  type Moneda,
} from "@/lib/caja-tipos";
import { firmaPorId } from "@/lib/llave";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NotaModal, datosDiferencia, dineroConSigno } from "./comunes";

const TONO: Record<EstadoActa, "success" | "warning" | "danger" | "info" | "neutral"> = {
  BORRADOR: "neutral",
  PEND_FIRMA_1: "warning",
  PEND_FIRMA_2: "warning",
  FIRMADA: "success",
  RECHAZADA: "danger",
  ESCALADA: "danger",
  RESUELTA: "info",
};

export const EstadoActaBadge = ({ estado }: { estado: EstadoActa }) => (
  <StatusBadge tone={TONO[estado]}>{ESTADO_ACTA_LABEL[estado]}</StatusBadge>
);

function FilaFirma({ titulo, f }: { titulo: string; f: FirmaActa | undefined }) {
  if (!f) return <li className="text-ink-400">{titulo}: pendiente</li>;
  return (
    <li className="text-ink-700">
      <span className="font-semibold text-ink-900">{titulo}:</span> {nombreUsuario(f.usuarioId)} ({ROL_CAJA_LABEL[f.rol]}) ·{" "}
      <span className={f.conforme ? "text-success-700" : "font-semibold text-danger-700"}>{f.conforme ? "Conforme" : "No conforme"}</span> ·{" "}
      {f.fechaHora} · {f.equipo} · {f.modalidad === "REMOTA" ? "remota" : "presencial"}
      {f.enNombreDe && <span className="font-semibold"> · en nombre de {nombreUsuario(f.enNombreDe)}</span>}
      {f.observaciones && <span className="block text-ink-500">Observaciones: {f.observaciones}</span>}
    </li>
  );
}

// Resumen del acta con sus firmas, la negativa, la resolución y la trazabilidad completa.
export function ActaResumen({ acta }: { acta: ActaConformidad }) {
  const c = acta.contenido;
  const dif = c.diferencia;
  const monedas = (c.moneda ?? ["ARS"]) as Moneda[];
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-ink-900">
          {acta.id} · {TIPO_ACTA_LABEL[acta.tipo]}
        </span>
        <EstadoActaBadge estado={acta.estado} />
        {acta.remota && <StatusBadge tone="warning">Autorización remota — sin verificación física</StatusBadge>}
      </div>
      <p className="text-ink-500">
        {acta.fechaHora} · evento {acta.eventoId}
        {acta.referenciaActaId && ` · corrige o repite el acta ${acta.referenciaActaId}`}
      </p>
      {c.descripcion && <p className="text-ink-700">{c.descripcion}</p>}
      {dif && (
        <ul className="space-y-0.5 text-ink-700">
          {monedas.map((m) => (
            <li key={m}>
              {m}: esperado {c.esperado ? dineroConSigno(m, c.esperado[m]).replace(/^\+/, "") : "—"} · contado {c.contado ? dineroConSigno(m, c.contado[m]).replace(/^\+/, "") : "—"} · diferencia{" "}
              <span className={dif[m] === 0 ? "" : "font-semibold"}>{dineroConSigno(m, dif[m])}</span>
              {dif[m] !== 0 && ` (${dif[m] < 0 ? "faltante, deudora" : "sobrante, acreedora"})`}
            </li>
          ))}
        </ul>
      )}
      {(c.responsableFondosId || c.detectoId) && (
        <p className="text-ink-700">
          {c.responsableFondosId && (
            <>
              Responsable de los fondos: <span className="font-semibold">{nombreUsuario(c.responsableFondosId)}</span>
            </>
          )}
          {c.detectoId && (
            <>
              {c.responsableFondosId && " · "}Detectó: <span className="font-semibold">{nombreUsuario(c.detectoId)}</span>
            </>
          )}
        </p>
      )}
      {(c.motivoTexto || c.observaciones) && (
        <p className="text-ink-700">
          {c.motivoTexto && <>Motivo: {c.motivoTexto}. </>}
          {c.observaciones && <>Circunstancias: {c.observaciones}</>}
        </p>
      )}
      <ul className="space-y-1">
        <FilaFirma titulo="Firma 1" f={acta.firma1} />
        <FilaFirma titulo="Firma 2" f={acta.firma2} />
      </ul>
      {acta.negativa && (
        <Banner tone="error" title="Negativa a firmar del responsable">
          Registró la negativa {nombreUsuario(acta.negativa.supervisorId)} el {acta.negativa.fechaHora}: {acta.negativa.observacion}
        </Banner>
      )}
      {acta.resolucion && (
        <p className="text-ink-700">
          Resolución del superior: {nombreUsuario(acta.resolucion.usuarioId)} ·{" "}
          {acta.resolucion.decision === "AUTORIZAR" ? "autorizó el ajuste" : "pidió nueva verificación"} · {acta.resolucion.fechaHora} ·{" "}
          {acta.resolucion.observaciones}
        </p>
      )}
      {acta.rechazo && (
        <p className="text-danger-700">
          Rechazada por {nombreUsuario(acta.rechazo.usuarioId)} el {acta.rechazo.fechaHora}: {acta.rechazo.motivo}
        </p>
      )}
      {acta.ajusteIds && acta.ajusteIds.length > 0 && <p className="text-ink-700">Movimientos de ajuste: {acta.ajusteIds.join(", ")}</p>}
    </div>
  );
}

type Modal =
  | "firmar1"
  | "disconforme1"
  | "enNombre1"
  | "negativa"
  | "autorizar"
  | "rechazar"
  | "conforme2"
  | "noConforme2"
  | "resolverAutorizar"
  | "resolverNueva";

interface Props {
  eventoTipo: string;
  eventoId: string;
  // Diferencia del evento, para mostrar el importe en la firma y para la matriz.
  diferencia?: Record<Moneda, number>;
  // Resuelven el flujo del evento (autorizar o rechazar el ajuste). Reciben la firma con llave.
  onAutorizar?: (nota: string, firmaId?: string) => string | null;
  onRechazar?: (nota: string, firmaId?: string) => string | null;
  autorizarLabel?: string;
  rechazarLabel?: string;
  // Reemplazo por emergencia: el supervisor puede firmar en nombre del cajero saliente.
  firmaEnNombre?: boolean;
}

// Panel de acta de un evento de caja: muestra el acta y ofrece, según su estado y quien actúa, firmar
// conforme o disconforme, registrar la negativa, autorizar o rechazar el ajuste, pedir la firma remota
// de Casa Central o resolver un acta escalada. Todo con la llave de autorización (R6).
export function ActaPanel({ eventoTipo, eventoId, diferencia, onAutorizar, onRechazar, autorizarLabel = "Autorizar ajuste", rechazarLabel = "Rechazar y repetir el recuento", firmaEnNombre }: Props) {
  const actas = useActas();
  const usuario = useUsuarioActual();
  const [modal, setModal] = useState<Modal | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const acta = actaDe(eventoTipo, eventoId, actas);
  if (!acta) return null;

  const datos = (operacion: string, extra: { cargadoPor?: string; remota?: boolean } = {}) => ({
    operacion,
    referencia: acta.id,
    ...(diferencia ? datosDiferencia(diferencia) : {}),
    ...extra,
  });
  const firmaDe = (firmaId?: string) => firmaPorId(firmaId);
  const sinFirma = "No se encontró la firma con llave.";
  const cierra = () => setModal(null);

  const firmar1 = (conforme: boolean, nota: string, firmaId?: string, enNombreDe?: string) => {
    const f = firmaDe(firmaId);
    if (!f) return sinFirma;
    const r = firmarActa(acta.id, { paso: 1, firma: f, conforme, observaciones: nota, enNombreDe });
    return r.ok ? null : r.error;
  };
  const firmar2 = (conforme: boolean, nota: string, firmaId?: string) => {
    const f = firmaDe(firmaId);
    if (!f) return sinFirma;
    const r = firmarActa(acta.id, { paso: 2, firma: f, conforme, observaciones: nota });
    return r.ok ? null : r.error;
  };
  const negativa = (nota: string, firmaId?: string) => {
    const f = firmaDe(firmaId);
    if (!f) return sinFirma;
    const r = registrarNegativaAFirmar(acta.id, { firma: f, observacion: nota });
    return r.ok ? null : r.error;
  };
  const resolver = (decision: "AUTORIZAR" | "NUEVA_VERIFICACION", nota: string, firmaId?: string) => {
    const f = firmaDe(firmaId);
    if (!f) return sinFirma;
    const r = resolverActaEscalada(acta.id, { firma: f, decision, observaciones: nota });
    if (!r.ok) return r.error;
    // Con la resolución del superior se aplica en el flujo del evento: autoriza el ajuste o lo rechaza.
    const siguiente = decision === "AUTORIZAR" ? onAutorizar : onRechazar;
    return siguiente ? siguiente(nota, firmaId) : null;
  };

  const esFirmante1 = !acta.firmante1Id || usuario.id === acta.firmante1Id;
  const sup = esSupervisor(usuario);
  const superior = usuario.roles.includes("TESORERO_CENTRAL") || usuario.roles.includes("DIRECTOR");
  const esDiferencia = acta.tipo === "DIFERENCIA";
  const remota = !!acta.remota;

  return (
    <div className="mt-3 rounded-xl border border-ink-200 bg-white p-4">
      <ActaResumen acta={acta} />
      {aviso && <p className="mt-2 text-xs text-ink-500">{aviso}</p>}

      {acta.estado === "PEND_FIRMA_1" && (
        <div className="mt-3 space-y-2">
          {esFirmante1 ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="success" onClick={() => setModal("firmar1")}>
                Firmar conforme
              </Button>
              {esDiferencia && (
                <Button size="sm" variant="outline" onClick={() => setModal("disconforme1")}>
                  Firmar disconforme
                </Button>
              )}
            </div>
          ) : (
            <p className="text-xs text-ink-500">
              La primera firma le corresponde a {nombreUsuario(acta.firmante1Id ?? "")}: cambiá a ese usuario en “Actuar como”.
            </p>
          )}
          {esDiferencia && sup && acta.firmante1Id !== usuario.id && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setModal("negativa")}>
                Registrar negativa a firmar
              </Button>
              {firmaEnNombre && (
                <Button size="sm" variant="outline" onClick={() => setModal("enNombre1")}>
                  Firmar en nombre del saliente
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {acta.estado === "PEND_FIRMA_2" && (
        <div className="mt-3 space-y-2">
          {remota && (
            <Banner tone="warning" title="Autorización remota — sin verificación física">
              Esta acta pide la segunda firma remota de Casa Central: firma un Supervisor de Casa Central con “Actuar como” (por ejemplo Raúl Molina). No equivale a la
              recepción del efectivo.
            </Banner>
          )}
          <div className="flex flex-wrap gap-2">
            {esDiferencia ? (
              !sup ? (
                <p className="text-xs text-ink-500">El ajuste lo autoriza un Supervisor distinto de quien cargó el recuento, con su llave (cambiá en “Actuar como”).</p>
              ) : onAutorizar && onRechazar ? (
                <>
                  <Button size="sm" variant="success" onClick={() => setModal("autorizar")}>
                    {autorizarLabel}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setModal("rechazar")}>
                    {rechazarLabel}
                  </Button>
                </>
              ) : onAutorizar ? (
                <Button size="sm" variant="success" onClick={() => setModal("autorizar")}>
                  {autorizarLabel}
                </Button>
              ) : (
                <p className="text-xs text-ink-500">El ajuste lo autoriza un supervisor desde la pantalla del evento.</p>
              )
            ) : (
              <>
                <Button size="sm" variant="success" onClick={() => setModal("conforme2")}>
                  Firmar conforme
                </Button>
                <Button size="sm" variant="outline" onClick={() => setModal("noConforme2")}>
                  Marcar No conforme
                </Button>
              </>
            )}
            {!remota && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const r = solicitarFirmaRemota(acta.id);
                  setAviso(r.ok ? "Se pidió la segunda firma remota de Casa Central y se avisó por mail." : r.error);
                }}
              >
                Sucursal con una sola persona: pedir firma remota
              </Button>
            )}
          </div>
          {!remota && necesitaFirmaRemota(acta.sucursalId, acta.firma1?.usuarioId) && (
            <p className="text-xs text-warning-700">No hay otro Supervisor o Tesorero habilitado en la sucursal: corresponde la firma remota de Casa Central.</p>
          )}
        </div>
      )}

      {acta.estado === "ESCALADA" && (
        <div className="mt-3 space-y-2">
          {superior ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="success" onClick={() => setModal("resolverAutorizar")}>
                Autorizar el ajuste
              </Button>
              <Button size="sm" variant="outline" onClick={() => setModal("resolverNueva")}>
                Pedir nueva verificación
              </Button>
            </div>
          ) : (
            <p className="text-xs text-ink-500">El acta está escalada: la resuelve el Tesorero central o el Director con su llave (cambiá en “Actuar como”).</p>
          )}
        </div>
      )}

      <NotaModal
        open={modal === "firmar1"}
        titulo={`Firmar el acta ${acta.id}`}
        descripcion={esDiferencia ? "Firmás conforme con la diferencia que se te atribuye, con tu llave." : "Firmás la conformidad con tu llave."}
        etiquetaNota="Observaciones (opcional)"
        confirmar="Firmar conforme"
        tono="success"
        llave={datos(`Firma 1 de ${TIPO_ACTA_LABEL[acta.tipo].toLowerCase()}`)}
        onClose={cierra}
        onConfirmar={(nota, firmaId) => firmar1(true, nota, firmaId)}
      />
      <NotaModal
        open={modal === "disconforme1"}
        titulo={`Firmar disconforme el acta ${acta.id}`}
        descripcion="Si no estás de acuerdo con la diferencia, firmás disconforme: tus observaciones son obligatorias y quedan en el acta."
        etiquetaNota="Observaciones"
        requerida
        confirmar="Firmar disconforme"
        tono="danger"
        llave={datos("Firma 1 disconforme de diferencia de caja")}
        onClose={cierra}
        onConfirmar={(nota, firmaId) => firmar1(false, nota, firmaId)}
      />
      <NotaModal
        open={modal === "enNombre1"}
        titulo="Firmar en nombre del cajero saliente"
        descripcion={`El saliente no puede contar ni firmar: firmás vos y queda marcado en el acta. La segunda firma tiene que ser de otro usuario.`}
        etiquetaNota="Observaciones"
        requerida
        confirmar="Firmar en su nombre"
        llave={datos("Firma en nombre del saliente (reemplazo por emergencia)", { cargadoPor: acta.firmante1Id })}
        onClose={cierra}
        onConfirmar={(nota, firmaId) => firmar1(true, nota, firmaId, acta.firmante1Id)}
      />
      <NotaModal
        open={modal === "negativa"}
        titulo="Registrar la negativa a firmar"
        descripcion="La negativa no elimina la diferencia ni registra una conformidad inexistente: el acta queda Escalada a un superior (Tesorero central o Director) y se envía el mail."
        etiquetaNota="Observación"
        requerida
        confirmar="Registrar negativa"
        tono="danger"
        llave={datos("Negativa a firmar un acta de diferencia", { cargadoPor: acta.firmante1Id })}
        onClose={cierra}
        onConfirmar={(nota, firmaId) => negativa(nota, firmaId)}
      />
      <NotaModal
        open={modal === "autorizar"}
        titulo={autorizarLabel}
        descripcion="Autorizás el ajuste con tu llave: se genera el movimiento de ajuste en el libro y el acta queda Firmada."
        etiquetaNota="Nota (opcional)"
        confirmar={autorizarLabel}
        tono="success"
        llave={datos("Autorización de ajuste por diferencia", { cargadoPor: acta.firma1?.usuarioId, remota })}
        onClose={cierra}
        onConfirmar={(nota, firmaId) => (onAutorizar ? onAutorizar(nota, firmaId) : null)}
      />
      <NotaModal
        open={modal === "rechazar"}
        titulo={rechazarLabel}
        descripcion="El acta queda Rechazada con tu motivo, se avisa por mail y se repite el recuento."
        etiquetaNota="Motivo del rechazo"
        requerida
        confirmar="Rechazar"
        tono="danger"
        llave={datos("Rechazo de ajuste por diferencia", { cargadoPor: acta.firma1?.usuarioId, remota })}
        onClose={cierra}
        onConfirmar={(nota, firmaId) => (onRechazar ? onRechazar(nota, firmaId) : null)}
      />
      <NotaModal
        open={modal === "conforme2"}
        titulo={`Firmar el acta ${acta.id}`}
        descripcion="Segunda firma de conformidad, con tu llave."
        etiquetaNota="Observaciones (opcional)"
        confirmar="Firmar conforme"
        tono="success"
        llave={datos(`Firma 2 de ${TIPO_ACTA_LABEL[acta.tipo].toLowerCase()}`, { cargadoPor: acta.firma1?.usuarioId, remota })}
        onClose={cierra}
        onConfirmar={(nota, firmaId) => firmar2(true, nota, firmaId)}
      />
      <NotaModal
        open={modal === "noConforme2"}
        titulo={`Marcar No conforme el acta ${acta.id}`}
        descripcion="El acta queda Rechazada con tu motivo, se repite el recuento y se envía el mail de alerta."
        etiquetaNota="Motivo"
        requerida
        confirmar="Marcar No conforme"
        tono="danger"
        llave={datos(`Firma 2 No conforme de ${TIPO_ACTA_LABEL[acta.tipo].toLowerCase()}`, { cargadoPor: acta.firma1?.usuarioId, remota })}
        onClose={cierra}
        onConfirmar={(nota, firmaId) => firmar2(false, nota, firmaId)}
      />
      <NotaModal
        open={modal === "resolverAutorizar"}
        titulo="Autorizar el ajuste (resolución del superior)"
        descripcion="Resolvés el acta escalada con tu llave: autorizás el ajuste y queda todo asentado en el acta."
        etiquetaNota="Observaciones"
        requerida
        confirmar="Autorizar el ajuste"
        tono="success"
        llave={datos("Resolución de acta escalada: autoriza el ajuste", { cargadoPor: acta.negativa?.supervisorId })}
        onClose={cierra}
        onConfirmar={(nota, firmaId) => resolver("AUTORIZAR", nota, firmaId)}
      />
      <NotaModal
        open={modal === "resolverNueva"}
        titulo="Pedir nueva verificación"
        descripcion="Resolvés el acta escalada pidiendo una nueva verificación: se repite el recuento."
        etiquetaNota="Observaciones"
        requerida
        confirmar="Pedir nueva verificación"
        tono="danger"
        llave={datos("Resolución de acta escalada: nueva verificación", { cargadoPor: acta.negativa?.supervisorId })}
        onClose={cierra}
        onConfirmar={(nota, firmaId) => resolver("NUEVA_VERIFICACION", nota, firmaId)}
      />
    </div>
  );
}
