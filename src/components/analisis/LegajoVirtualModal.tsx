"use client";

import { useApplication } from "@/lib/application-context";
import { configEfectiva } from "@/lib/config";
import { getTipoDocumento } from "@/lib/parametros";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { IconCheck, IconFileText } from "@/components/icons";

export function LegajoVirtualModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { app } = useApplication();
  const cfg = configEfectiva(app.configuracion);
  const po = app.postOferta;
  const obligatorios = cfg.documentos.filter((d) => d.obligatorio);
  const cargados = obligatorios.filter((d) => (po.legajo[d.tipoId]?.length ?? 0) > 0).length;
  const garantes = po.garantes;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Legajo virtual"
      maxWidth="max-w-2xl"
      footer={
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      }
    >
      <p className="text-sm text-ink-600">
        Documentacion del credito {app.numeroCredito ?? "-"} - {cargados} de {obligatorios.length} obligatorios completos.
        {po.impresion ? ` - ${po.impresion.accion === "IMPRESO" ? "Impreso" : "Visualizado"} el ${po.impresion.fecha}` : " - Sin imprimir"}
      </p>

      <div className="mt-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Documentos del titular</p>
        <ul className="space-y-2">
          {cfg.documentos.map((d) => {
            const tipo = getTipoDocumento(d.tipoId);
            const lista = po.legajo[d.tipoId] ?? [];
            return (
              <li key={d.tipoId} className="rounded-lg border border-ink-200 bg-white px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-900">
                    {tipo.nombre}{" "}
                    <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${d.obligatorio ? "bg-danger-50 text-danger-700" : "bg-ink-100 text-ink-500"}`}>
                      {d.obligatorio ? "Obligatorio" : "Opcional"}
                    </span>
                  </span>
                  <span className="text-xs text-ink-500">{lista.length > 0 ? `${lista.length} archivo${lista.length === 1 ? "" : "s"}` : "Pendiente"}</span>
                </div>
                {lista.length > 0 ? (
                  <ul className="mt-1.5 space-y-1">
                    {lista.map((a) => (
                      <li key={a.id} className="flex items-center gap-1.5 text-xs text-success-700">
                        <IconCheck width={12} height={12} strokeWidth={2.6} />
                        {a.nombre} - {a.detalle}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-ink-400">Sin archivos adjuntos.</p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {garantes.length > 0 && (
        <div className="mt-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Documentacion de garantes</p>
          {garantes.map((g, idx) => {
            const nombre = [g.nombre, g.apellido].filter(Boolean).join(" ") || `Garante ${idx + 1}`;
            return (
              <div key={g.id} className="rounded-lg border border-ink-200 bg-ink-50/40 px-3 py-3">
                <p className="text-sm font-semibold text-ink-900">
                  {idx + 1}. {nombre} - DNI {g.dni || "-"}
                </p>
                <div className="mt-2">
                  <p className="text-xs font-semibold text-ink-700">
                    Recibo de sueldo <span className="text-danger-500">*</span>
                  </p>
                  {(g.reciboSueldo ?? []).length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {(g.reciboSueldo ?? []).map((a) => (
                        <li key={a.id} className="flex items-center gap-1.5 text-xs text-success-700">
                          <IconCheck width={12} height={12} strokeWidth={2.6} />
                          {a.nombre} - {a.detalle}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-warning-700">Pendiente - sin recibo cargado.</p>
                  )}
                </div>
                {(g.otrosDocumentos ?? []).length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-ink-700">Otros documentos</p>
                    <ul className="mt-1 space-y-1">
                      {(g.otrosDocumentos ?? []).map((a) => (
                        <li key={a.id} className="flex items-center gap-1.5 text-xs text-ink-600">
                          <IconFileText width={12} height={12} />
                          {a.nombre} - {a.detalle}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {app.identificacion.tipoCliente === "NUEVO" && (
        <p className="mt-4 rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 text-xs text-ink-500">
          {app.identificacion.firmaRegistrada ? "Firma de referencia registrada en la identificacion." : "Sin firma de referencia registrada."}
        </p>
      )}
    </Modal>
  );
}
