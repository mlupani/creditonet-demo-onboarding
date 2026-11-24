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
import { Cifra, CampoLectura, PanelVentana, Pill, type Fase } from "./compacto";
import { NotaModal, datosDiferencia, dineroConSigno } from "./comunes";

const FASE: Record<EstadoActa, Fase> = {
  BORRADOR: "inicial",
  PEND_FIRMA_1: "espera",
  PEND_FIRMA_2: "espera",
  FIRMADA: "ok",
  RECHAZADA: "rechazo",
  ESCALADA: "rechazo",
  RESUELTA: "proceso",
};

export const EstadoActaBadge = ({ estado }: { estado: EstadoActa }) => (
  <Pill fase={FASE[estado]}>{ESTADO_ACTA_LABEL[estado]}</Pill>
);

// Recuadro punteado de una firma: quién firmó, con qué rol, cuándo, desde qué equipo y de qué modo.
function RecuadroFirma({ titulo, f, vacio, children }: { titulo: string; f: FirmaActa | undefined; vacio?: string; children?: React.ReactNode }) {
  return (
    <div className={`rounded-lg border border-dashed p-3 text-xs ${f ? (f.conforme ? "border-success-600 bg-success-50" : "border-danger-600 bg-danger-50") : "border-ink-300 bg-white"}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500">{titulo}</p>
      {f ? (
        <div className="mt-1 text-ink-700">
          <p>
            <span className="font-bold text-ink-900">{nombreUsuario(f.usuarioId)}</span> · llave ✔ ·{" "}
            <span className={f.conforme ? "font-bold text-success-700" : "font-bold text-danger-700"}>{f.conforme ? "Conforme" : "No conforme"}</span>
          </p>
          <p className="text-ink-500">
            {ROL_CAJA_LABEL[f.rol]} · {f.fechaHora} · {f.equipo} · {f.modalidad === "REMOTA" ? "remota" : "presencial"}
            {f.enNombreDe && <span className="font-semibold"> · en nombre de {nombreUsuario(f.enNombreDe)}</span>}
          </p>
          {f.observaciones && <p className="mt-0.5 text-ink-500">Observaciones: {f.observaciones}</p>}
        </div>
      ) : (
        <p className="mt-1 text-ink-400">{vacio ?? "Pendiente"}</p>
      )}
      {children && <div className="mt-2 space-y-1.5">{children}</div>}
    </div>
  );
}

// Resumen del acta con sus firmas, la negativa, la resolución y la trazabilidad completa. Las acciones
// de cada firma (`accionesFirma1`, `accionesFirma2`) se dibujan dentro de su recuadro.
export function ActaResumen({
  acta,
  accionesFirma1,
  accionesFirma2,
}: {
  acta: ActaConformidad;
  accionesFirma1?: React.ReactNode;
  accionesFirma2?: React.ReactNode;
}) {
  const c = acta.contenido;
  const dif = c.diferencia;
  const monedas = (c.moneda ?? ["ARS"]) as Moneda[];
  const sinSigno = (m: Moneda, v: number) => dineroConSigno(m, v).replace(/^\+/, "");
  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-ink-900">
          {acta.id} · {TIPO_ACTA_LABEL[acta.tipo]}
        </span>
        <EstadoActaBadge estado={acta.estado} />
        {acta.remota && <Pill fase="espera">Autorización remota — sin verificación física</Pill>}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <CampoLectura label="Tipo">{TIPO_ACTA_LABEL[acta.tipo]}</CampoLectura>
        <CampoLectura label="Fecha y hora">{acta.fechaHora}</CampoLectura>
        <CampoLectura label="Evento de origen">{acta.eventoId}</CampoLectura>
        {acta.referenciaActaId && <CampoLectura label="Corrige o repite el acta">{acta.referenciaActaId}</CampoLectura>}
      </div>
      {c.descripcion && <p className="text-ink-700">{c.descripcion}</p>}
      {dif &&
        monedas.map((m) => (
          <div key={m}>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-500">Moneda: {m}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Cifra label="Saldo esperado">{c.esperado ? sinSigno(m, c.esperado[m]) : "—"}</Cifra>
              <Cifra label="Contado">{c.contado ? sinSigno(m, c.contado[m]) : "—"}</Cifra>
              <Cifra label="Diferencia (faltante = deudora)" tono={dif[m] === 0 ? "neutro" : "malo"}>
                {dineroConSigno(m, dif[m])}
                {dif[m] !== 0 && <span className="ml-1.5 text-[11px] font-semibold">({dif[m] < 0 ? "faltante, deudora" : "sobrante, acreedora"})</span>}
              </Cifra>
            </div>
          </div>
        ))}
      {(c.responsableFondosId || c.detectoId || c.motivoTexto) && (
        <div className="grid gap-2 sm:grid-cols-3">
          {c.responsableFondosId && <CampoLectura label="Responsable de los fondos">{nombreUsuario(c.responsableFondosId)}</CampoLectura>}
          {c.detectoId && <CampoLectura label="Detectó la diferencia">{nombreUsuario(c.detectoId)}</CampoLectura>}
          {c.motivoTexto && <CampoLectura label="Motivo">{c.motivoTexto}</CampoLectura>}
        </div>
      )}
      {c.observaciones && <CampoLectura label="Observaciones · circunstancias">{c.observaciones}</CampoLectura>}
      <div className="grid gap-2 md:grid-cols-2">
        <RecuadroFirma titulo="Firma 1 — Responsable de los fondos" f={acta.firma1}>
          {accionesFirma1}
        </RecuadroFirma>
        <RecuadroFirma titulo="Firma 2 — Supervisor (intervención)" f={acta.firma2} vacio={acta.estado === "ESCALADA" ? "No corresponde: acta escalada" : undefined}>
          {accionesFirma2}
        </RecuadroFirma>
      </div>
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
        <p className="font-semibold text-danger-700">
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

  // Acciones de la primera firma (responsable de los fondos), dentro de su recuadro.
  const accionesFirma1 =
    acta.estado === "PEND_FIRMA_1" ? (
      <>
        {esFirmante1 ? (
          <div className="flex flex-wrap gap-1.5">
            <Button size="xs" variant="success" onClick={() => setModal("firmar1")}>
              Firmar conforme
            </Button>
            {esDiferencia && (
              <Button size="xs" variant="dangerOutline" onClick={() => setModal("disconforme1")}>
                Firmar disconforme
              </Button>
            )}
          </div>
        ) : (
          <p className="text-ink-500">
            La primera firma le corresponde a {nombreUsuario(acta.firmante1Id ?? "")}: cambiá a ese usuario en “Actuar como”.
          </p>
        )}
        {esDiferencia && sup && acta.firmante1Id !== usuario.id && (
          <div className="flex flex-wrap gap-1.5">
            <Button size="xs" variant="navyOutline" onClick={() => setModal("negativa")}>
              Registrar negativa a firmar
            </Button>
            {firmaEnNombre && (
              <Button size="xs" variant="navyOutline" onClick={() => setModal("enNombre1")}>
                Firmar en nombre del saliente
              </Button>
            )}
          </div>
        )}
      </>
    ) : undefined;

  // Acciones de la segunda firma (supervisor) y de la resolución del acta escalada.
  const accionesFirma2 =
    acta.estado === "PEND_FIRMA_2" ? (
      <>
        {remota && (
          <Banner tone="warning" title="Autorización remota — sin verificación física">
            Esta acta pide la segunda firma remota de Casa Central: firma un Supervisor de Casa Central con “Actuar como” (por ejemplo Raúl Molina). No equivale a la
            recepción del efectivo.
          </Banner>
        )}
        <div className="flex flex-wrap gap-1.5">
          {esDiferencia ? (
            !sup ? (
              <p className="text-ink-500">El ajuste lo autoriza un Supervisor distinto de quien cargó el recuento, con su llave (cambiá en “Actuar como”).</p>
            ) : onAutorizar && onRechazar ? (
              <>
                <Button size="xs" variant="success" onClick={() => setModal("autorizar")}>
                  {autorizarLabel}
                </Button>
                <Button size="xs" variant="dangerOutline" onClick={() => setModal("rechazar")}>
                  {rechazarLabel}
                </Button>
              </>
            ) : onAutorizar ? (
              <Button size="xs" variant="success" onClick={() => setModal("autorizar")}>
                {autorizarLabel}
              </Button>
            ) : (
              <p className="text-ink-500">El ajuste lo autoriza un supervisor desde la pantalla del evento.</p>
            )
          ) : (
            <>
              <Button size="xs" variant="success" onClick={() => setModal("conforme2")}>
                Firmar conforme
              </Button>
              <Button size="xs" variant="dangerOutline" onClick={() => setModal("noConforme2")}>
                Marcar No conforme
              </Button>
            </>
          )}
          {!remota && (
            <Button
              size="xs"
              variant="navyOutline"
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
          <p className="text-warning-700">No hay otro Supervisor o Tesorero habilitado en la sucursal: corresponde la firma remota de Casa Central.</p>
        )}
      </>
    ) : acta.estado === "ESCALADA" ? (
      superior ? (
        <div className="flex flex-wrap gap-1.5">
          <Button size="xs" variant="success" onClick={() => setModal("resolverAutorizar")}>
            Autorizar el ajuste
          </Button>
          <Button size="xs" variant="dangerOutline" onClick={() => setModal("resolverNueva")}>
            Pedir nueva verificación
          </Button>
        </div>
      ) : (
        <p className="text-ink-500">El acta está escalada: la resuelve el Tesorero central o el Director con su llave (cambiá en “Actuar como”).</p>
      )
    ) : undefined;

  return (
    <PanelVentana titulo={`ACTA N° ${acta.id} · ${TIPO_ACTA_LABEL[acta.tipo]}`} className="mt-3">
      <ActaResumen acta={acta} accionesFirma1={accionesFirma1} accionesFirma2={accionesFirma2} />
      {aviso && <p className="mt-2 text-xs text-ink-500">{aviso}</p>}

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
    </PanelVentana>
  );
}