"use client";

import { useState } from "react";
import { cerrarSucursal, pendientesDeCaja, reabrirSucursal } from "@/lib/caja-operaciones";
import { cierreVigente, enTransito, esSupervisor, puedeAprobar } from "@/lib/caja-reglas";
import { useCajaDatos } from "@/lib/caja-store";
import { ESTADO_JORNADA_LABEL, esTesoro, type Caja } from "@/lib/caja-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { aError } from "./Jornada";
import { ErrorBanner, NotaModal, PaginaCaja, quien } from "./comunes";

export function PantallaCierreSucursal() {
  const { sucursales, cajas, jornadas, arqueos, cambiosTurno, cierresSucursal, usuario, fecha } = useCajaDatos();
  const supervisa = esSupervisor(usuario);
  const visibles = sucursales.filter(
    (s) => s.estado === "ACTIVO" && (supervisa || cajas.some((c) => c.sucursalId === s.id && c.estado === "ACTIVO" && esTesoro(c.tipo) && c.tesoreroId === usuario.id))
  );
  const [elegida, setElegida] = useState("");
  const sucursalId = visibles.some((s) => s.id === elegida) ? elegida : (visibles[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [reabriendo, setReabriendo] = useState(false);

  const cajasSuc = cajas.filter((c) => c.sucursalId === sucursalId && c.estado === "ACTIVO");
  const esTesoreroDeLaSucursal = cajasSuc.some((c) => esTesoro(c.tipo) && c.tesoreroId === usuario.id);
  const cierre = cierreVigente(cierresSucursal, sucursalId, fecha);
  const historial = cierresSucursal.filter((c) => c.sucursalId === sucursalId).sort((a, b) => b.id.localeCompare(a.id));

  const estadoCaja = (c: Caja) => {
    const hoyJ = jornadas.filter((j) => j.cajaId === c.id && j.fecha === fecha);
    const vigente = hoyJ.find((j) => j.estado !== "CERRADA");
    const cerrada = hoyJ.find((j) => j.estado === "CERRADA");
    const transitos = pendientesDeCaja(c.id).filter(enTransito);
    const arqueo = arqueos.some((a) => a.cajaId === c.id && a.estado === "EN_CURSO");
    const relevo = cambiosTurno.some((t) => t.cajaId === c.id && t.estado !== "COMPLETADO");
    const problemas = [
      ...(vigente ? [ESTADO_JORNADA_LABEL[vigente.estado]] : []),
      ...transitos.map((m) => `${m.id} ${m.estado === "EN_TRANSITO" ? "en tránsito" : "con incidencia"}`),
      ...(arqueo ? ["Arqueo en curso"] : []),
      ...(relevo ? ["Cambio de turno en curso"] : []),
    ];
    return { situacion: vigente ? ESTADO_JORNADA_LABEL[vigente.estado] : cerrada ? "Cerrada hoy" : "Sin abrir hoy", problemas };
  };
  const filas = cajasSuc.map((c) => ({ caja: c, ...estadoCaja(c) }));
  const listo = filas.every((f) => f.problemas.length === 0);

  const cerrar = () => setError(aError(cerrarSucursal(sucursalId)));

  return (
    <PaginaCaja
      titulo="Cierre de sucursal"
      descripcion="El tesorero confirma que todas las cajas de su sucursal cerraron y que no quedan tránsitos ni incidencias abiertas; entonces se bloquea la fecha operativa. La reapertura requiere autorización de un supervisor."
    >
      <p className="mb-4 inline-flex rounded-full border border-warning-200 bg-warning-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-700">
        Propuesto en el avance 01 (sugerencias), pendiente de confirmar
      </p>

      {visibles.length === 0 ? (
        <Card className="px-5 py-8 text-center text-sm text-ink-400">Tu usuario no es tesorero de ninguna sucursal activa.</Card>
      ) : (
        <>
          <div className="max-w-xs">
            <SelectField
              id="cs-sucursal"
              label="Sucursal"
              value={sucursalId}
              onChange={(v) => {
                setElegida(v);
                setError(null);
              }}
              options={visibles.map((s) => ({ value: s.id, label: s.nombre }))}
            />
          </div>

          {cierre ? (
            <Banner tone="success" title={`Fecha operativa ${cierre.fecha} cerrada`} className="mt-4">
              Cerró {quien(cierre.usuarioId)} el {cierre.fechaHora}. No se puede operar en las cajas de la sucursal hasta que un supervisor autorice la reapertura.
              {puedeAprobar(usuario, cierre.usuarioId) && (
                <div className="mt-3">
                  <Button size="sm" variant="outline" onClick={() => setReabriendo(true)}>
                    Autorizar reapertura
                  </Button>
                </div>
              )}
            </Banner>
          ) : (
            <Banner tone={listo ? "info" : "warning"} title={listo ? "Todo listo para cerrar la fecha" : "Todavía no se puede cerrar la fecha"} className="mt-4">
              {listo
                ? `Las cajas de la sucursal están cerradas y no hay tránsitos ni incidencias abiertas (fecha operativa ${fecha}).`
                : "Resolvé los pendientes de la lista antes de cerrar la fecha operativa."}
            </Banner>
          )}

          <Card className="mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                    <th className="px-3 py-2.5">Caja</th>
                    <th className="px-3 py-2.5">Jornada de hoy</th>
                    <th className="px-3 py-2.5">Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {filas.map((f) => (
                    <tr key={f.caja.id}>
                      <td className="px-3 py-3 font-semibold text-ink-900">{f.caja.nombre}</td>
                      <td className="px-3 py-3 text-ink-700">{f.situacion}</td>
                      <td className="px-3 py-3">
                        {f.problemas.length === 0 ? (
                          <StatusBadge tone="success">Sin pendientes</StatusBadge>
                        ) : (
                          <span className="flex flex-wrap gap-1.5">
                            {f.problemas.map((p) => (
                              <StatusBadge key={p} tone="warning">
                                {p}
                              </StatusBadge>
                            ))}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {!cierre && (
            <div className="mt-4">
              <Button
                onClick={cerrar}
                disabled={!esTesoreroDeLaSucursal}
                title={esTesoreroDeLaSucursal ? undefined : "Sólo el tesorero de la sucursal cierra la fecha operativa."}
              >
                Cerrar fecha operativa
              </Button>
              <ErrorBanner error={error} />
            </div>
          )}

          <h2 className="mt-8 text-xs font-bold uppercase tracking-widest text-ink-700">Historial de cierres</h2>
          <Card className="mt-2 overflow-hidden">
            {historial.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-ink-400">Esta sucursal todavía no cerró ninguna fecha.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead>
                    <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                      <th className="px-3 py-2.5">Fecha</th>
                      <th className="px-3 py-2.5">Cerró</th>
                      <th className="px-3 py-2.5">Estado</th>
                      <th className="px-3 py-2.5">Reapertura</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {historial.map((c) => (
                      <tr key={c.id}>
                        <td className="px-3 py-3 tabular-nums text-ink-900">{c.fecha}</td>
                        <td className="px-3 py-3 text-ink-700">
                          {quien(c.usuarioId)} · {c.fechaHora}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge tone={c.estado === "CERRADA" ? "success" : "warning"}>{c.estado === "CERRADA" ? "Cerrada" : "Reabierta"}</StatusBadge>
                        </td>
                        <td className="px-3 py-3 text-xs text-ink-600">
                          {c.reapertura ? `${quien(c.reapertura.supervisorId)} · ${c.reapertura.fechaHora} · ${c.reapertura.nota}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      <NotaModal
        open={reabriendo && !!cierre}
        titulo="Autorizar la reapertura"
        descripcion="La fecha vuelve a admitir operaciones en las cajas de la sucursal. Queda registrado quién la reabrió y por qué."
        etiquetaNota="Motivo de la reapertura"
        requerida
        confirmar="Reabrir la fecha"
        onClose={() => setReabriendo(false)}
        onConfirmar={(nota) => (cierre ? aError(reabrirSucursal(cierre.id, nota)) : null)}
      />
    </PaginaCaja>
  );
}
