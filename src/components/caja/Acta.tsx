"use client";

import { useRef, type ReactNode } from "react";
import { useDenominaciones, nombreUsuario } from "@/lib/caja-store";
import { formatNumber } from "@/lib/format";
import { denominacionesDe } from "@/lib/caja-reglas";
import {
  ESTADO_ACTA_LABEL,
  NOMBRE_MONEDA,
  ROL_CAJA_LABEL,
  TIPO_ACTA_LABEL,
  monedasDe,
  type ActaConformidad,
  type Caja,
  type FirmaActa,
  type Moneda,
  type Recuento,
} from "@/lib/caja-tipos";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { IconPrinter } from "@/components/icons";
import { dinero, dineroConSigno } from "./comunes";

const ESTILO_IMPRESION = `
  body{font-family:system-ui,sans-serif;color:#111;margin:32px;font-size:13px}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:14px;margin:18px 0 6px}
  table{border-collapse:collapse;width:100%;margin-top:6px}
  th,td{border:1px solid #ccc;padding:5px 8px;text-align:left} td.n,th.n{text-align:right}
  dl{display:grid;grid-template-columns:200px 1fr;gap:4px 12px;margin:8px 0} dt{color:#555} dd{margin:0}
  .firma{margin-top:48px;display:flex;gap:48px} .firma div{border-top:1px solid #111;padding-top:4px;min-width:200px}
`;

// Abre un documento en una ventana limpia para imprimir o guardar como PDF.
export function imprimirDocumento(titulo: string, html: string, estiloExtra = "") {
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) return;
  w.document.write(`<html><head><title>${titulo}</title><style>${ESTILO_IMPRESION}${estiloExtra}</style></head><body>${html}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

// Acta imprimible: se abre en una ventana limpia para imprimir o guardar como PDF.
export function ActaModal({ open, onClose, titulo, children }: { open: boolean; onClose: () => void; titulo: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const imprimir = () => {
    if (ref.current) imprimirDocumento(titulo, ref.current.innerHTML);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={titulo}
      maxWidth="max-w-3xl"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button size="sm" variant="navyOutline" onClick={onClose}>
            Cerrar
          </Button>
          <Button size="sm" variant="success" onClick={imprimir}>
            <IconPrinter width={16} height={16} />
            Imprimir / PDF
          </Button>
        </div>
      }
    >
      <div ref={ref} className="text-sm text-ink-800">
        {children}
      </div>
    </Modal>
  );
}

export function ActaDatos({ filas }: { filas: [string, ReactNode][] }) {
  return (
    <dl className="my-2 grid grid-cols-[180px_1fr] gap-x-3 gap-y-1">
      {filas.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-500">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// Recuento, esperado, diferencia, responsable y supervisor de un conteo.
export function ActaRecuento({ caja, titulo, recuento }: { caja: Caja; titulo: string; recuento: Recuento }) {
  const denominaciones = useDenominaciones();
  const monedas = monedasDe(caja.moneda);
  return (
    <div>
      <h2 className="mt-4 text-sm font-bold text-ink-900">{titulo}</h2>
      <ActaDatos
        filas={[
          ["Contó", `${nombreUsuario(recuento.usuarioId)} · ${recuento.fechaHora}`],
          ...(recuento.aprobacion
            ? ([[recuento.aprobacion.resultado === "APROBADA" ? "Aprobó" : "Rechazó", `${nombreUsuario(recuento.aprobacion.supervisorId)} · ${recuento.aprobacion.fechaHora}${recuento.aprobacion.nota ? ` · ${recuento.aprobacion.nota}` : ""}`]] as [string, string][])
            : []),
        ]}
      />
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-ink-50 text-left">
            <th className="border border-ink-200 px-2 py-1">Moneda</th>
            <th className="n border border-ink-200 px-2 py-1 text-right">Contado</th>
            <th className="n border border-ink-200 px-2 py-1 text-right">Esperado</th>
            <th className="n border border-ink-200 px-2 py-1 text-right">Diferencia</th>
            <th className="border border-ink-200 px-2 py-1">Motivo</th>
          </tr>
        </thead>
        <tbody>
          {monedas.map((m) => {
            const ajuste = recuento.ajustes.find((a) => a.moneda === m);
            return (
              <tr key={m}>
                <td className="border border-ink-200 px-2 py-1">{NOMBRE_MONEDA[m]}</td>
                <td className="n border border-ink-200 px-2 py-1 text-right">{dinero(m, recuento.contado[m])}</td>
                <td className="n border border-ink-200 px-2 py-1 text-right">{dinero(m, recuento.esperado[m])}</td>
                <td className="n border border-ink-200 px-2 py-1 text-right">{dineroConSigno(m, recuento.diferencia[m])}</td>
                <td className="border border-ink-200 px-2 py-1">{ajuste ? `${ajuste.motivoId}${ajuste.nota ? ` · ${ajuste.nota}` : ""}` : recuento.diferencia[m] === 0 ? "—" : "Dentro de la tolerancia"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {monedas.map((m) => {
        const dens = denominacionesDe(denominaciones, m).filter((d) => (recuento.detalle[d.id] ?? 0) > 0);
        if (dens.length === 0) return null;
        return (
          <div key={m}>
            <h3 className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-500">Detalle en {NOMBRE_MONEDA[m].toLowerCase()}</h3>
            <table className="mt-1 w-full border-collapse text-sm">
              <tbody>
                {dens.map((d) => (
                  <tr key={d.id}>
                    <td className="border border-ink-200 px-2 py-1">{d.tipo === "BILLETE" ? "Billete" : "Moneda"} de {formatNumber(d.valor)}</td>
                    <td className="n border border-ink-200 px-2 py-1 text-right">{recuento.detalle[d.id]}</td>
                    <td className="n border border-ink-200 px-2 py-1 text-right">{dinero(m, (recuento.detalle[d.id] ?? 0) * d.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

const textoFirma = (f: FirmaActa | undefined, pendiente: string) =>
  f
    ? `${nombreUsuario(f.usuarioId)} (${ROL_CAJA_LABEL[f.rol]}) · ${f.conforme ? "Conforme" : "No conforme"} · ${f.fechaHora} · equipo ${f.equipo} · ${f.modalidad === "REMOTA" ? "firma remota" : "presencial"}${f.enNombreDe ? ` · en nombre de ${nombreUsuario(f.enNombreDe)}` : ""}`
    : pendiente;

// Acta de conformidad (v4) lista para imprimir o guardar como PDF: contenido del momento, las dos firmas
// con su llave (usuario, rol, fecha, hora, equipo y modalidad) y las leyendas de negativa o firma remota.
export function ActaConformidadModal({ acta, onClose }: { acta: ActaConformidad; onClose: () => void }) {
  const denominaciones = useDenominaciones();
  const c = acta.contenido;
  const monedas = (c.moneda ?? ["ARS"]) as Moneda[];
  const titulo = `${TIPO_ACTA_LABEL[acta.tipo]} · ${acta.id}`;
  return (
    <ActaModal open onClose={onClose} titulo={titulo}>
      <h1 className="text-lg font-bold">Acta de conformidad N° {acta.id}</h1>
      <p className="text-ink-600">{TIPO_ACTA_LABEL[acta.tipo]}</p>
      <ActaDatos
        filas={[
          ["Estado", ESTADO_ACTA_LABEL[acta.estado]],
          ["Sucursal / caja", `${acta.sucursalId}${acta.cajaId ? ` · ${acta.cajaId}` : ""}`],
          ["Fecha y hora", acta.fechaHora],
          ["Evento de origen", `${acta.eventoTipo.replace(/_/g, " ").toLowerCase()} ${acta.eventoId}`],
          ...(acta.referenciaActaId ? ([["Corrige o repite el acta", acta.referenciaActaId]] as [string, string][]) : []),
          ...(c.responsableFondosId ? ([["Responsable de los fondos", nombreUsuario(c.responsableFondosId)]] as [string, string][]) : []),
          ...(c.detectoId ? ([["Detectó", nombreUsuario(c.detectoId)]] as [string, string][]) : []),
          ...(c.motivoTexto ? ([["Motivo", c.motivoTexto]] as [string, string][]) : []),
          ...(c.observaciones || c.descripcion ? ([["Circunstancias", [c.descripcion, c.observaciones].filter(Boolean).join(" · ")]] as [string, string][]) : []),
        ]}
      />
      {c.contado && c.esperado && c.diferencia && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-ink-50 text-left">
              <th className="border border-ink-200 px-2 py-1">Moneda</th>
              <th className="n border border-ink-200 px-2 py-1 text-right">Contado</th>
              <th className="n border border-ink-200 px-2 py-1 text-right">Esperado</th>
              <th className="n border border-ink-200 px-2 py-1 text-right">Diferencia (faltante = deudora)</th>
            </tr>
          </thead>
          <tbody>
            {monedas.map((m) => (
              <tr key={m}>
                <td className="border border-ink-200 px-2 py-1">{NOMBRE_MONEDA[m]}</td>
                <td className="n border border-ink-200 px-2 py-1 text-right">{dinero(m, c.contado![m])}</td>
                <td className="n border border-ink-200 px-2 py-1 text-right">{dinero(m, c.esperado![m])}</td>
                <td className="n border border-ink-200 px-2 py-1 text-right">{dineroConSigno(m, c.diferencia![m])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {c.detalle &&
        monedas.map((m) => {
          const dens = denominacionesDe(denominaciones, m).filter((d) => (c.detalle?.[d.id] ?? 0) > 0);
          if (dens.length === 0) return null;
          return (
            <div key={m}>
              <h3 className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-500">Detalle en {NOMBRE_MONEDA[m].toLowerCase()}</h3>
              <table className="mt-1 w-full border-collapse text-sm">
                <tbody>
                  {dens.map((d) => (
                    <tr key={d.id}>
                      <td className="border border-ink-200 px-2 py-1">{d.tipo === "BILLETE" ? "Billete" : "Moneda"} de {formatNumber(d.valor)}</td>
                      <td className="n border border-ink-200 px-2 py-1 text-right">{c.detalle?.[d.id]}</td>
                      <td className="n border border-ink-200 px-2 py-1 text-right">{dinero(m, (c.detalle?.[d.id] ?? 0) * d.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      <h2 className="mt-4 text-sm font-bold text-ink-900">Firmas con llave de autorización</h2>
      <ActaDatos
        filas={[
          ["Firma 1", textoFirma(acta.firma1, "Pendiente")],
          ...(acta.firma1?.observaciones ? ([["Observaciones firma 1", acta.firma1.observaciones]] as [string, string][]) : []),
          ["Firma 2", textoFirma(acta.firma2, acta.estado === "ESCALADA" ? "No corresponde: acta escalada" : "Pendiente")],
          ...(acta.firma2?.observaciones ? ([["Observaciones firma 2", acta.firma2.observaciones]] as [string, string][]) : []),
        ]}
      />
      {acta.negativa && (
        <p className="mt-2 font-semibold">
          Negativa a firmar del responsable. Registró {nombreUsuario(acta.negativa.supervisorId)} el {acta.negativa.fechaHora}: {acta.negativa.observacion}
        </p>
      )}
      {acta.resolucion && (
        <p className="mt-2">
          Resolución del superior: {nombreUsuario(acta.resolucion.usuarioId)} · {acta.resolucion.decision === "AUTORIZAR" ? "autorizó el ajuste" : "pidió nueva verificación"} ·{" "}
          {acta.resolucion.fechaHora} · {acta.resolucion.observaciones}
        </p>
      )}
      {acta.rechazo && (
        <p className="mt-2 font-semibold">
          Acta rechazada por {nombreUsuario(acta.rechazo.usuarioId)} el {acta.rechazo.fechaHora}: {acta.rechazo.motivo}
        </p>
      )}
      {(acta.remota || acta.firma2?.modalidad === "REMOTA") && <p className="mt-2 font-semibold">Autorización remota — sin verificación física.</p>}
      {acta.ajusteIds && acta.ajusteIds.length > 0 && <p className="mt-2">Movimientos de ajuste generados: {acta.ajusteIds.join(", ")}.</p>}
      <ActaFirmas
        firmas={[
          `Firma 1: ${acta.firma1 ? nombreUsuario(acta.firma1.usuarioId) : "pendiente"}`,
          `Firma 2: ${acta.firma2 ? nombreUsuario(acta.firma2.usuarioId) : "pendiente"}`,
        ]}
      />
    </ActaModal>
  );
}

export function ActaFirmas({ firmas }: { firmas: string[] }) {
  return (
    <div className="mt-10 flex flex-wrap gap-10">
      {firmas.map((f) => (
        <div key={f} className="min-w-48 border-t border-ink-900 pt-1 text-xs text-ink-600">
          {f}
        </div>
      ))}
    </div>
  );
}
