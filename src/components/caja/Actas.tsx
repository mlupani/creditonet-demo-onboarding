"use client";

import Link from "next/link";
import { useState } from "react";
import { actaDe, actasVisibles } from "@/lib/actas";
import { nombreUsuario, useActas, useCajas, useUsuarioActual } from "@/lib/caja-store";
import { ESTADO_ACTA_LABEL, TIPO_ACTA_LABEL, type ActaConformidad, type EstadoActa, type TipoActa } from "@/lib/caja-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ActaConformidadModal } from "./Acta";
import { ActaPanel, ActaResumen, EstadoActaBadge } from "./ActaPanel";
import { INPUT_COMPACTO, PanelVentana, TablaCompacta, Td, Th } from "./compacto";
import { PaginaCaja, descargarXlsx } from "./comunes";

// Pantalla donde se resuelve cada diferencia: el acta DIFERENCIA se firma desde la pantalla de su evento.
const PANTALLA_DEL_EVENTO: Record<string, { href: string; label: string }> = {
  JORNADA_APERTURA: { href: "/caja/apertura", label: "Apertura de caja" },
  JORNADA_CIERRE: { href: "/caja/cierre", label: "Cierre de caja" },
  ARQUEO: { href: "/caja/arqueo", label: "Arqueo de caja" },
  RELEVO: { href: "/caja/turno", label: "Cambio de turno" },
  RELEVO_CONFORMIDAD: { href: "/caja/turno", label: "Cambio de turno" },
};

const PENDIENTES: EstadoActa[] = ["PEND_FIRMA_1", "PEND_FIRMA_2", "ESCALADA"];

export function PantallaActas() {
  const actas = useActas();
  const cajas = useCajas();
  const usuario = useUsuarioActual();
  const [fCaja, setFCaja] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [pdf, setPdf] = useState<ActaConformidad | null>(null);

  const visibles = actasVisibles(usuario, actas, cajas);
  const nombreCaja = (id?: string) => (id ? (cajas.find((c) => c.id === id)?.nombre ?? id) : "—");
  const filtradas = visibles
    .filter((a) => (!fCaja || a.cajaId === fCaja) && (!fTipo || a.tipo === fTipo) && (!fEstado || a.estado === fEstado))
    .filter((a) => (!fDesde || a.fechaHora.slice(0, 10) >= fDesde) && (!fHasta || a.fechaHora.slice(0, 10) <= fHasta))
    .sort((a, b) => b.fechaHora.localeCompare(a.fechaHora) || b.id.localeCompare(a.id));
  const pendientes = visibles.filter((a) => PENDIENTES.includes(a.estado));
  const cajasConActas = cajas.filter((c) => visibles.some((a) => a.cajaId === c.id));

  const exportar = () =>
    descargarXlsx("actas-de-caja.xlsx", "Actas", [
      ["ID", "Fecha y hora", "Tipo", "Sucursal", "Caja", "Evento", "Estado", "Responsable de los fondos", "Firma 1", "Firma 2", "Remota", "Acta que corrige"],
      ...filtradas.map((a) => [
        a.id,
        a.fechaHora,
        TIPO_ACTA_LABEL[a.tipo],
        a.sucursalId,
        nombreCaja(a.cajaId),
        `${a.eventoTipo} ${a.eventoId}`,
        ESTADO_ACTA_LABEL[a.estado],
        a.contenido.responsableFondosId ? nombreUsuario(a.contenido.responsableFondosId) : "",
        a.firma1 ? `${nombreUsuario(a.firma1.usuarioId)} (${a.firma1.conforme ? "Conforme" : "No conforme"})` : "",
        a.firma2 ? `${nombreUsuario(a.firma2.usuarioId)} (${a.firma2.conforme ? "Conforme" : "No conforme"})` : "",
        a.remota || a.firma2?.modalidad === "REMOTA" ? "Sí" : "No",
        a.referenciaActaId ?? "",
      ]),
    ]);

  const detalle = (a: ActaConformidad) => {
    const vigente = actaDe(a.eventoTipo, a.eventoId, actas)?.id === a.id;
    const pantalla = PANTALLA_DEL_EVENTO[a.eventoTipo];
    return (
      <div className="space-y-3">
        <ActaResumen acta={a} />
        {vigente && PENDIENTES.includes(a.estado) && (
          <>
            {a.tipo === "DIFERENCIA" && pantalla && (
              <p className="text-xs text-ink-500">
                La diferencia se resuelve desde{" "}
                <Link href={pantalla.href} className="font-semibold text-brand-700 underline">
                  {pantalla.label}
                </Link>
                , donde el supervisor autoriza el ajuste o lo rechaza. Acá se firma, se registra la negativa y se resuelve el escalamiento.
              </p>
            )}
            <ActaPanel eventoTipo={a.eventoTipo} eventoId={a.eventoId} firmaEnNombre={a.tipo === "DIFERENCIA" && a.eventoTipo === "RELEVO"} />
          </>
        )}
      </div>
    );
  };

  return (
    <PaginaCaja
      titulo="Actas de caja"
      descripcion="Historial de actas de conformidad: apertura, arqueo, relevo, reemplazo y diferencias. Cada acta tiene dos firmantes distintos con su llave, es inalterable y se descarga en PDF."
    >
      {pendientes.length > 0 && (
        <Banner tone="warning" title={`${pendientes.length} ${pendientes.length === 1 ? "acta pendiente" : "actas pendientes"} de firma o de resolución`} className="mb-4">
          {pendientes.map((a) => `${a.id} (${TIPO_ACTA_LABEL[a.tipo].toLowerCase()} · ${ESTADO_ACTA_LABEL[a.estado].toLowerCase()})`).join(" · ")}
        </Banner>
      )}

      <PanelVentana
        titulo="Historial de actas · no se modifican ni se eliminan: una corrección es un acta nueva que referencia a la anterior"
        accion={
          <Button size="xs" variant="navyOutline" onClick={exportar}>
            Exportar a Excel
          </Button>
        }
      >
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <select value={fCaja} onChange={(e) => setFCaja(e.target.value)} aria-label="Filtrar por caja" className={`${INPUT_COMPACTO} w-60`}>
            <option value="">Caja: todas</option>
            {cajasConActas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} aria-label="Filtrar por tipo" className={`${INPUT_COMPACTO} w-64`}>
            <option value="">Tipo: todos</option>
            {(Object.keys(TIPO_ACTA_LABEL) as TipoActa[]).map((t) => (
              <option key={t} value={t}>
                {TIPO_ACTA_LABEL[t]}
              </option>
            ))}
          </select>
          <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} aria-label="Filtrar por estado" className={`${INPUT_COMPACTO} w-52`}>
            <option value="">Estado: todos</option>
            {(Object.keys(ESTADO_ACTA_LABEL) as EstadoActa[]).map((e) => (
              <option key={e} value={e}>
                {ESTADO_ACTA_LABEL[e]}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-[11px] text-ink-500">
            Desde
            <input type="date" value={fDesde} onChange={(e) => setFDesde(e.target.value)} aria-label="Fecha desde" className={`${INPUT_COMPACTO} w-36`} />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-ink-500">
            Hasta
            <input type="date" value={fHasta} onChange={(e) => setFHasta(e.target.value)} aria-label="Fecha hasta" className={`${INPUT_COMPACTO} w-36`} />
          </label>
        </div>
        {filtradas.length === 0 ? (
          <p className="py-4 text-center text-xs text-ink-400">No hay actas para los filtros elegidos.</p>
        ) : (
          <TablaCompacta etiqueta="Historial de actas" minWidth="min-w-[52rem]">
            <thead>
              <tr>
                <Th>Acta</Th>
                <Th>Fecha y hora</Th>
                <Th>Tipo</Th>
                <Th>Caja</Th>
                <Th>Firmantes</Th>
                <Th>Estado</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((a) => (
                <tr key={a.id}>
                  <Td className="font-mono font-bold text-brand-700">
                    {a.id}
                    {a.referenciaActaId && <span className="block text-[10px] font-medium text-ink-400">corrige {a.referenciaActaId}</span>}
                  </Td>
                  <Td className="tabular-nums">{a.fechaHora}</Td>
                  <Td>{TIPO_ACTA_LABEL[a.tipo]}</Td>
                  <Td>{nombreCaja(a.cajaId)}</Td>
                  <Td>
                    {a.firma1 ? nombreUsuario(a.firma1.usuarioId) : a.firmante1Id ? <span className="text-ink-400">{nombreUsuario(a.firmante1Id)} (pendiente)</span> : "—"}
                    {" · "}
                    {a.firma2 ? nombreUsuario(a.firma2.usuarioId) : <span className="text-ink-400">pendiente</span>}
                  </Td>
                  <Td>
                    <EstadoActaBadge estado={a.estado} />
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      <Button size="xs" variant="navyOutline" onClick={() => setAbierta(abierta === a.id ? null : a.id)}>
                        {abierta === a.id ? "Ocultar" : "Ver detalle"}
                      </Button>
                      <Button size="xs" variant="brandOutline" onClick={() => setPdf(a)}>
                        PDF
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TablaCompacta>
        )}
      </PanelVentana>

      {abierta && (
        <PanelVentana titulo={`Detalle del acta ${abierta}`} className="mt-4">
          {(() => {
            const a = actas.find((x) => x.id === abierta);
            return a ? detalle(a) : null;
          })()}
        </PanelVentana>
      )}
      {pdf && <ActaConformidadModal acta={actas.find((x) => x.id === pdf.id) ?? pdf} onClose={() => setPdf(null)} />}
    </PaginaCaja>
  );
}
