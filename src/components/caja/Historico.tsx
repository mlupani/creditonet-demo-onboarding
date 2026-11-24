"use client";

import { useState } from "react";
import {
  detallePeriodo,
  historicoSaldos,
  saldosAFecha,
  seriesDe,
  type BloqueHistorico,
  type ConsolidadoHistorico,
  type FiltroHistorico,
  type Periodicidad,
  type Serie,
} from "@/lib/caja-posicion";
import { auditar, useCajaDatos, useCheques, useCuentasBancarias } from "@/lib/caja-store";
import { NOMBRE_MONEDA, type Moneda } from "@/lib/caja-tipos";
import { usePagosProveedor } from "@/lib/proveedores-store";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { imprimirDocumento } from "./Acta";
import { Campo, INPUT_COMPACTO, PanelVentana, TablaCompacta, Td, Th } from "./compacto";
import { PaginaCaja, descargarXlsx, dinero } from "./comunes";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const etiquetaPeriodo = (p: string) => (p.length === 7 ? `${p.slice(5)}/${p.slice(0, 4)}` : p.split("-").reverse().join("/"));
const nombreSerie = (s: Serie) => `${s.tipo === "CAJA" ? "Caja" : "Banco"} · ${s.nombre} · ${NOMBRE_MONEDA[s.moneda]}`;

function Selector({
  titulo,
  opciones,
  elegidos,
  onChange,
}: {
  titulo: string;
  opciones: { id: string; label: string }[];
  elegidos: string[];
  onChange: (ids: string[]) => void;
}) {
  const todas = opciones.length > 0 && opciones.every((o) => elegidos.includes(o.id));
  return (
    <fieldset className="min-w-56 flex-1">
      <legend className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-500">{titulo}</legend>
      <label className="flex items-center gap-2 py-0.5 text-xs font-semibold text-ink-700">
        <input type="checkbox" checked={todas} onChange={(e) => onChange(e.target.checked ? opciones.map((o) => o.id) : [])} />
        Todas
      </label>
      {opciones.map((o) => (
        <label key={o.id} className="flex items-center gap-2 py-0.5 text-xs text-ink-700">
          <input
            type="checkbox"
            checked={elegidos.includes(o.id)}
            onChange={(e) => onChange(e.target.checked ? [...elegidos, o.id] : elegidos.filter((x) => x !== o.id))}
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

function htmlHistorico(titulo: string, subtitulo: string, bloques: BloqueHistorico[], consolidado: ConsolidadoHistorico[]): string {
  const num = (m: Moneda, v: number) => esc(dinero(m, v));
  const fila = (periodo: string, m: Moneda, f: { inicial: number; ingresos: number; egresos: number; final: number }) =>
    `<tr><td>${esc(etiquetaPeriodo(periodo))}</td><td class="n">${num(m, f.inicial)}</td><td class="n">${num(m, f.ingresos)}</td><td class="n">${num(m, f.egresos)}</td><td class="n">${num(m, f.final)}</td></tr>`;
  const cabecera = "<thead><tr><th>Fecha</th><th class=\"n\">Saldo inicial</th><th class=\"n\">Ingresos</th><th class=\"n\">Egresos</th><th class=\"n\">Saldo final</th></tr></thead>";
  const cuerpo = bloques
    .map((b) => `<h2>${esc(nombreSerie(b.serie))}</h2><table>${cabecera}<tbody>${b.filas.map((f) => fila(f.periodo, b.serie.moneda, f)).join("")}</tbody></table>`)
    .join("");
  const cons = consolidado.length
    ? MONEDA_LISTA.filter((m) => consolidado.some((c) => c.moneda === m))
        .map((m) => {
          const filas = consolidado.filter((c) => c.moneda === m);
          return `<h2>Consolidado · ${esc(NOMBRE_MONEDA[m])} (${filas[0].series} cuentas)</h2><table>${cabecera}<tbody>${filas.map((f) => fila(f.periodo, m, f)).join("")}</tbody></table>`;
        })
        .join("")
    : "";
  return `<h1>${esc(titulo)}</h1><p>${esc(subtitulo)}</p>${bloques.length === 0 ? "<p>No hay cajas ni cuentas para los filtros elegidos.</p>" : cuerpo + cons}`;
}
const MONEDA_LISTA: Moneda[] = ["ARS", "USD"];

function TablaFilas({
  moneda,
  filas,
  onDetalle,
}: {
  moneda: Moneda;
  filas: { periodo: string; inicial: number; ingresos: number; egresos: number; final: number }[];
  onDetalle?: (periodo: string) => void;
}) {
  return (
    <TablaCompacta etiqueta="Histórico de saldos" minWidth="min-w-[40rem]">
      <thead>
        <tr>
          <Th>Fecha</Th>
          <Th derecha>Saldo inicial</Th>
          <Th derecha>Ingresos</Th>
          <Th derecha>Egresos</Th>
          <Th derecha>Saldo final</Th>
          {onDetalle && <Th />}
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr key={f.periodo}>
            <Td className="font-medium text-ink-900">{etiquetaPeriodo(f.periodo)}</Td>
            <Td derecha>{dinero(moneda, f.inicial)}</Td>
            <Td derecha className="text-success-700">{dinero(moneda, f.ingresos)}</Td>
            <Td derecha className="text-danger-700">{dinero(moneda, f.egresos)}</Td>
            <Td derecha className="font-semibold text-ink-900">{dinero(moneda, f.final)}</Td>
            {onDetalle && (
              <Td className="text-right">
                <button type="button" onClick={() => onDetalle(f.periodo)} className="text-[11px] font-semibold text-brand-700 hover:underline">
                  Ver movimientos
                </button>
              </Td>
            )}
          </tr>
        ))}
      </tbody>
    </TablaCompacta>
  );
}

export function PantallaHistorico() {
  const d = useCajaDatos();
  const cuentas = useCuentasBancarias();
  const pagos = usePagosProveedor();
  const cheques = useCheques();
  const cajasLista = d.cajas.filter((c) => c.estado !== "ELIMINADO");
  const cuentasLista = cuentas.filter((c) => c.estado !== "ELIMINADO");

  const [cajaIds, setCajaIds] = useState<string[]>(() => cajasLista.map((c) => c.id));
  const [cuentaIds, setCuentaIds] = useState<string[]>(() => cuentasLista.map((c) => c.id));
  const [moneda, setMoneda] = useState<Moneda | "">("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>("DIARIA");
  const [detalle, setDetalle] = useState<{ serie: Serie; periodo: string } | null>(null);

  const filtro: FiltroHistorico = { desde, hasta, periodicidad };
  const series = seriesDe({ cajas: d.cajas, cuentas, libro: d.libro, movimientos: d.movimientos, pagos, cheques }, cajaIds, cuentaIds, moneda);
  const rangoInvalido = !!desde && !!hasta && desde > hasta;
  // Un solo día: se obtiene la foto de todas las cajas y cuentas al cierre de esa fecha.
  const unDia = !!desde && desde === hasta;
  const foto = unDia ? saldosAFecha(series, desde) : [];
  const { bloques, consolidado } = rangoInvalido || unDia ? { bloques: [], consolidado: [] } : historicoSaldos(series, filtro);
  const periodoTexto = `${desde || "inicio"} a ${hasta || "hoy"} · ${periodicidad === "DIARIA" ? "diaria" : "mensual"}`;

  const exportarXlsx = () => {
    if (unDia) {
      descargarXlsx(`saldos-al-${desde}.xlsx`, "Saldo a una fecha", [
        ["Fecha", "Tipo", "Caja o cuenta", "Moneda", "Saldo"],
        ...foto.map((f) => [desde, f.serie.tipo === "CAJA" ? "Caja" : "Banco", f.serie.nombre, f.serie.moneda, String(f.saldo)]),
      ]);
      auditar("Exportación del histórico de saldos", "HISTORICO", "ALTA", null, `Exportó la foto de saldos al ${desde} a Excel`);
      return;
    }
    const filas: string[][] = [["Fecha", "Tipo", "Caja o cuenta", "Moneda", "Saldo inicial", "Ingresos", "Egresos", "Saldo final"]];
    for (const b of bloques)
      for (const f of b.filas)
        filas.push([f.periodo, b.serie.tipo === "CAJA" ? "Caja" : "Banco", b.serie.nombre, b.serie.moneda, String(f.inicial), String(f.ingresos), String(f.egresos), String(f.final)]);
    for (const c of consolidado) filas.push([c.periodo, "Consolidado", `${c.series} cuentas`, c.moneda, String(c.inicial), String(c.ingresos), String(c.egresos), String(c.final)]);
    descargarXlsx("historico-de-saldos.xlsx", "Histórico de saldos", filas);
    auditar("Exportación del histórico de saldos", "HISTORICO", "ALTA", null, `Exportó ${filas.length - 1} filas a Excel (${periodoTexto})`);
  };

  const exportarPdf = () => {
    if (unDia) {
      const filas = foto
        .map((f) => `<tr><td>${esc(f.serie.tipo === "CAJA" ? "Caja" : "Banco")}</td><td>${esc(f.serie.nombre)}</td><td>${esc(NOMBRE_MONEDA[f.serie.moneda])}</td><td class="n">${esc(dinero(f.serie.moneda, f.saldo))}</td></tr>`)
        .join("");
      imprimirDocumento(
        "Saldos a una fecha",
        `<h1>Saldos al ${esc(etiquetaPeriodo(desde))}</h1><table><thead><tr><th>Tipo</th><th>Caja o cuenta</th><th>Moneda</th><th class="n">Saldo</th></tr></thead><tbody>${filas}</tbody></table>`
      );
      auditar("Exportación del histórico de saldos", "HISTORICO", "ALTA", null, `Exportó la foto de saldos al ${desde} a PDF`);
      return;
    }
    imprimirDocumento("Histórico de saldos", htmlHistorico("Histórico de saldos", `Período: ${periodoTexto}`, bloques, consolidado), "@page{size:landscape}");
    auditar("Exportación del histórico de saldos", "HISTORICO", "ALTA", null, `Exportó ${bloques.reduce((n, b) => n + b.filas.length, 0)} filas a PDF (${periodoTexto})`);
  };

  const movimientosDetalle = detalle ? detallePeriodo(detalle.serie, detalle.periodo, filtro) : [];

  return (
    <PaginaCaja
      seccion="Posición de caja y bancos"
      titulo="Histórico de saldos"
      descripcion="Evolución de los saldos de cajas y cuentas bancarias (no de cada operación: eso está en el Libro de movimientos). Elegí un solo día para ver la foto de todos los saldos a esa fecha."
    >
      <PanelVentana titulo="Filtros">
        <div className="flex flex-wrap gap-6">
          <Selector titulo="Cajas" opciones={cajasLista.map((c) => ({ id: c.id, label: c.nombre }))} elegidos={cajaIds} onChange={setCajaIds} />
          <Selector
            titulo="Cuentas bancarias"
            opciones={cuentasLista.map((c) => ({ id: c.id, label: `${c.banco} ${c.numero} · ${c.moneda}` }))}
            elegidos={cuentaIds}
            onChange={setCuentaIds}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Campo label="Desde">
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" className={`${INPUT_COMPACTO} w-36`} />
          </Campo>
          <Campo label="Hasta">
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" className={`${INPUT_COMPACTO} w-36`} />
          </Campo>
          <Campo label="Moneda">
            <select value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda | "")} aria-label="Moneda" className={`${INPUT_COMPACTO} w-32`}>
              <option value="">Todas</option>
              <option value="ARS">{NOMBRE_MONEDA.ARS}</option>
              <option value="USD">{NOMBRE_MONEDA.USD}</option>
            </select>
          </Campo>
          <Campo label="Periodicidad">
            <select value={periodicidad} onChange={(e) => setPeriodicidad(e.target.value as Periodicidad)} aria-label="Periodicidad" className={`${INPUT_COMPACTO} w-32`} disabled={unDia}>
              <option value="DIARIA">Diaria</option>
              <option value="MENSUAL">Mensual</option>
            </select>
          </Campo>
          <div className="ml-auto flex gap-1.5">
            <Button size="xs" variant="navyOutline" onClick={exportarXlsx} disabled={rangoInvalido || series.length === 0}>
              Exportar a Excel
            </Button>
            <Button size="xs" variant="navyOutline" onClick={exportarPdf} disabled={rangoInvalido || series.length === 0}>
              Exportar a PDF
            </Button>
          </div>
        </div>
        {rangoInvalido && <p className="mt-2 text-xs font-semibold text-danger-700">La fecha desde no puede ser posterior a la fecha hasta.</p>}
      </PanelVentana>

      {series.length === 0 && !rangoInvalido && (
        <p className="mt-4 rounded-md border border-dashed border-ink-200 px-4 py-4 text-center text-xs text-ink-400">
          Elegí al menos una caja o una cuenta bancaria.
        </p>
      )}

      {unDia && series.length > 0 && (
        <PanelVentana className="mt-4" titulo={`Saldos al ${etiquetaPeriodo(desde)} · foto al cierre de ese día, de todas las cajas y cuentas elegidas`}>
          <TablaCompacta etiqueta="Saldos a una fecha" minWidth="min-w-[32rem]">
            <thead>
              <tr>
                <Th>Tipo</Th>
                <Th>Caja o cuenta</Th>
                <Th>Moneda</Th>
                <Th derecha>Saldo</Th>
              </tr>
            </thead>
            <tbody>
              {foto.map((f) => (
                <tr key={f.serie.clave}>
                  <Td>{f.serie.tipo === "CAJA" ? "Caja" : "Banco"}</Td>
                  <Td className="font-medium text-ink-900">{f.serie.nombre}</Td>
                  <Td>{NOMBRE_MONEDA[f.serie.moneda]}</Td>
                  <Td derecha className="font-semibold text-ink-900">{dinero(f.serie.moneda, f.saldo)}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {MONEDA_LISTA.filter((m) => foto.some((f) => f.serie.moneda === m)).map((m) => (
                <tr key={m} className="bg-ink-25 font-semibold text-ink-900">
                  <Td colSpan={3}>Total en {NOMBRE_MONEDA[m].toLowerCase()}</Td>
                  <Td derecha>{dinero(m, foto.filter((f) => f.serie.moneda === m).reduce((s, f) => s + f.saldo, 0))}</Td>
                </tr>
              ))}
            </tfoot>
          </TablaCompacta>
        </PanelVentana>
      )}

      {bloques.map((b) => (
        <PanelVentana key={b.serie.clave} className="mt-4" titulo={nombreSerie(b.serie)}>
          <TablaFilas moneda={b.serie.moneda} filas={b.filas} onDetalle={(periodo) => setDetalle({ serie: b.serie, periodo })} />
        </PanelVentana>
      ))}

      {MONEDA_LISTA.filter((m) => consolidado.some((c) => c.moneda === m)).map((m) => {
        const filas = consolidado.filter((c) => c.moneda === m);
        return (
          <PanelVentana key={m} className="mt-4 border-brand-200" titulo={`Consolidado · ${NOMBRE_MONEDA[m]} (${filas[0].series} cajas y cuentas)`}>
            <TablaFilas moneda={m} filas={filas} />
          </PanelVentana>
        );
      })}

      <Modal
        open={!!detalle}
        onClose={() => setDetalle(null)}
        title={detalle ? `Movimientos · ${etiquetaPeriodo(detalle.periodo)}` : ""}
        maxWidth="max-w-3xl"
        footer={<Button size="sm" onClick={() => setDetalle(null)}>Cerrar</Button>}
      >
        {detalle && (
          <>
            <p className="mb-2 text-xs text-ink-600">{nombreSerie(detalle.serie)}</p>
            {movimientosDetalle.length === 0 ? (
              <p className="text-xs text-ink-400">No hubo movimientos en el período.</p>
            ) : (
              <TablaCompacta etiqueta="Movimientos del período" minWidth="min-w-[34rem]">
                <thead>
                  <tr>
                    <Th>Fecha y hora</Th>
                    <Th>Descripción</Th>
                    <Th>Comprobante</Th>
                    <Th derecha>Ingreso</Th>
                    <Th derecha>Egreso</Th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosDetalle.map((m, i) => (
                    <tr key={i}>
                      <Td>{`${m.fecha} ${m.hora}`.trim()}</Td>
                      <Td className="text-ink-900">{m.descripcion}</Td>
                      <Td>{m.comprobante}</Td>
                      <Td derecha className="text-success-700">{m.ingreso > 0 ? dinero(detalle.serie.moneda, m.ingreso) : ""}</Td>
                      <Td derecha className="text-danger-700">{m.egreso > 0 ? dinero(detalle.serie.moneda, m.egreso) : ""}</Td>
                    </tr>
                  ))}
                </tbody>
              </TablaCompacta>
            )}
          </>
        )}
      </Modal>
    </PaginaCaja>
  );
}
