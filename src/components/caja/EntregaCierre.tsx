"use client";

import { useState } from "react";
import { USUARIOS_CAJA } from "@/lib/caja-datos";
import { cajasVisibles, cierreVigente, estadoCustodia, receptoresDeEntrega } from "@/lib/caja-reglas";
import { nombreUsuario, useCajaDatos } from "@/lib/caja-store";
import { ESTADO_CUSTODIA_LABEL, monedasDe, type Caja, type Jornada } from "@/lib/caja-tipos";
import { recibirEntregaCierre, reabrirCaja } from "@/lib/cierre-diario";
import type { Firma } from "@/lib/control-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { PanelVentana, Pill, TablaCompacta, Td, Th } from "./compacto";
import { LlaveModal } from "./LlaveModal";
import { NotaModal, dinero } from "./comunes";

const aError = (r: { ok: boolean } & { error?: string }): string | null => (r.ok ? null : (r.error ?? "No se pudo completar la operación."));

// Entrega y recepción del efectivo al cerrar la caja (1.2). Cerrar la caja en el sistema no es lo mismo que
// entregar el efectivo: la caja queda "Cerrada en sistema" hasta que el tesorero (o un supervisor de la
// sucursal) firma la recepción junto con el cajero; recién entonces pasa a "Efectivo en custodia". También
// permite reabrir una caja cerrada, sólo con autorización de Casa Central (llave).
export function EntregaCierre({ cajaId }: { cajaId: string }) {
  const { cajas, jornadas, cierresSucursal, usuario, fecha } = useCajaDatos();
  const visibles = cajasVisibles(usuario, cajas);
  const ids = new Set(visibles.map((c) => c.id));
  const filas = jornadas
    .filter((j) => j.estado === "CERRADA" && j.cierre && ids.has(j.cajaId) && (j.fecha === fecha || !j.custodia))
    .map((j) => ({ jornada: j, caja: cajas.find((c) => c.id === j.cajaId) as Caja }))
    .filter((f) => f.caja);

  const [entregando, setEntregando] = useState<Jornada | null>(null);
  const [firmaEntrega, setFirmaEntrega] = useState<Firma | null>(null);
  const [reabriendo, setReabriendo] = useState<{ jornada: Jornada; fase: "motivo" | "llave"; motivo: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  if (filas.length === 0) return null;
  const entrega = entregando ? filas.find((f) => f.jornada.id === entregando.id) : undefined;
  const receptores = entrega ? receptoresDeEntrega(entrega.caja, entrega.jornada.cierre!.usuarioId, USUARIOS_CAJA) : undefined;
  const sinFisicos = !!receptores && receptores.fisicos.length === 0;
  const cierraReapertura = reabriendo ? cajas.find((c) => c.id === reabriendo.jornada.cajaId) : undefined;
  const resumen = (j: Jornada, c: Caja) => monedasDe(c.moneda).map((m) => dinero(m, j.cierre!.contado[m])).join(" y ");

  return (
    <PanelVentana titulo="Entrega y recepción del efectivo" className="mt-4">
      <div>
        <p className="mb-3 text-xs text-ink-500">
          Cerrar la caja en el sistema no es entregar el efectivo: el cajero y el tesorero firman el acta de entrega y recepción, y recién ahí el tesorero asume la custodia.
        </p>
        {aviso && (
          <Banner tone="success" title={aviso} className="mb-3">
            El efectivo quedó bajo la custodia del tesorero y la caja pasó a «{ESTADO_CUSTODIA_LABEL.CUSTODIA}».
          </Banner>
        )}
        <TablaCompacta etiqueta="Entrega y recepción del efectivo" minWidth="min-w-[40rem]">
          <thead>
            <tr>
              <Th>Caja</Th>
              <Th>Cerró</Th>
              <Th>Estado</Th>
              <Th derecha>Acción</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ jornada: j, caja: c }) => {
              const estado = estadoCustodia(j);
              const sucursalCerrada = !!cierreVigente(cierresSucursal, c.sucursalId, j.fecha);
              return (
                <tr key={j.id} className={c.id === cajaId ? "bg-brand-50/40" : undefined}>
                  <Td className="font-bold text-ink-900">
                    {c.nombre}
                    <span className="block text-[11px] font-normal text-ink-500">
                      {j.fecha} · {resumen(j, c)}
                    </span>
                  </Td>
                  <Td>{nombreUsuario(j.cierre!.usuarioId)}</Td>
                  <Td>
                    {estado === "CUSTODIA" && j.custodia ? (
                      <>
                        <Pill fase="ok">{ESTADO_CUSTODIA_LABEL.CUSTODIA}</Pill>
                        <span className="mt-1 block text-[11px] text-ink-500">
                          Recibió {nombreUsuario(j.custodia.recibeUsuarioId)} · {j.custodia.fechaHora} · {j.custodia.actaId}
                          {j.custodia.remota && " · autorización remota, sin verificación física"}
                        </span>
                      </>
                    ) : (
                      <Pill fase="espera">{ESTADO_CUSTODIA_LABEL.SISTEMA}</Pill>
                    )}
                  </Td>
                  <Td derecha>
                    <span className="inline-flex flex-wrap justify-end gap-1.5">
                      {estado === "SISTEMA" && (
                        <Button size="xs" variant="success" onClick={() => setEntregando(j)}>
                          Entregar y recibir
                        </Button>
                      )}
                      <Button
                        size="xs"
                        variant="navyOutline"
                        disabled={sucursalCerrada}
                        title={sucursalCerrada ? "La sucursal cerró la fecha: primero hay que reabrir el cierre diario." : undefined}
                        onClick={() => setReabriendo({ jornada: j, fase: "motivo", motivo: "" })}
                      >
                        Reabrir caja
                      </Button>
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TablaCompacta>
      </div>

      <LlaveModal
        open={!!entrega && !firmaEntrega}
        titulo="Firma de la entrega del efectivo"
        descripcion={entrega ? `${nombreUsuario(entrega.jornada.cierre!.usuarioId)} entrega el efectivo de ${entrega.caja.nombre} (${resumen(entrega.jornada, entrega.caja)}).` : undefined}
        datos={{ operacion: "Entrega del efectivo al cierre de caja", referencia: entregando?.id ?? "" }}
        usuarioId={entrega?.jornada.cierre!.usuarioId}
        confirmar="Firmar la entrega"
        onFirmada={(f) => {
          setFirmaEntrega(f);
        }}
        onClose={() => setEntregando(null)}
      />
      <LlaveModal
        open={!!entrega && !!firmaEntrega}
        titulo={sinFisicos ? "Recepción remota de Casa Central" : "Firma de la recepción del efectivo"}
        descripcion={
          sinFisicos
            ? "La sucursal no tiene otro usuario habilitado: firma de forma remota Casa Central. Queda marcado «sin verificación física» y el efectivo sigue bajo custodia del empleado hasta una recepción física."
            : "Recibe el efectivo el tesorero o un supervisor de la sucursal, que asume su custodia."
        }
        datos={{
          operacion: "Recepción del efectivo al cierre de caja",
          referencia: entregando?.id ?? "",
          cargadoPor: entrega?.jornada.cierre!.usuarioId,
          remota: sinFisicos,
        }}
        confirmar="Firmar la recepción"
        onFirmada={(f) => {
          if (!entrega || !firmaEntrega) return "Faltan las firmas.";
          const e = aError(recibirEntregaCierre(entrega.jornada.id, firmaEntrega.id, f.id));
          if (e) return e;
          setAviso(`Acta de entrega y recepción de ${entrega.caja.nombre} firmada`);
          setFirmaEntrega(null);
          setEntregando(null);
          return null;
        }}
        onClose={() => {
          setFirmaEntrega(null);
          setEntregando(null);
        }}
      />

      <NotaModal
        open={reabriendo?.fase === "motivo"}
        titulo="Reabrir la caja"
        descripcion="Sólo con autorización de Casa Central y con registro. La caja vuelve a Abierta: hay que cerrarla de nuevo y entregar el efectivo otra vez. No se edita ningún movimiento confirmado: las correcciones se hacen con ajustes."
        etiquetaNota="Motivo de la reapertura"
        requerida
        confirmar="Pedir la autorización"
        onClose={() => setReabriendo((r) => (r?.fase === "motivo" ? null : r))}
        onConfirmar={(nota) => {
          if (!nota.trim()) return "Indicá el motivo de la reapertura.";
          setReabriendo((r) => (r ? { ...r, fase: "llave", motivo: nota.trim() } : r));
          return null;
        }}
      />
      <LlaveModal
        open={reabriendo?.fase === "llave"}
        titulo="Autorización de la reapertura"
        descripcion={`Autoriza el Tesorero central o el Director con su llave${cierraReapertura ? ` (${cierraReapertura.nombre})` : ""}. Si pasaron más de los días hábiles del plazo, sólo el Director.`}
        datos={{ operacion: "Reapertura de caja cerrada", referencia: reabriendo?.jornada.id ?? "", cargadoPor: usuario.id }}
        confirmar="Autorizar la reapertura"
        onFirmada={(f) => {
          if (!reabriendo) return "Falta el motivo.";
          const e = aError(reabrirCaja(reabriendo.jornada.id, reabriendo.motivo, f.id));
          if (e) return e;
          setReabriendo(null);
          return null;
        }}
        onClose={() => setReabriendo(null)}
      />
    </PanelVentana>
  );
}
