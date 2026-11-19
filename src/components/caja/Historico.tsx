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
import { auditar, useCajaDatos, useCuentasBancarias } from "@/lib/caja-store";
import { NOMBRE_MONEDA, type Moneda } from "@/lib/caja-tipos";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { imprimirDocumento } from "./Acta";
import { CLASE_INPUT, PaginaCaja, descargarXlsx, dinero } from "./comunes";

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
      <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{titulo}</legend>
      <label className="flex items-center gap-2 py-0.5 text-sm font-semibold text-ink-700">
        <input type="checkbox" checked={todas} onChange={(e) => onChange(e.target.checked ? opciones.map((o) => o.id) : [])} />
        Todas
      </label>
      {opciones.map((o) => (
        <label key={o.id} className="flex items-center gap-2 py-0.5 text-sm text-ink-700">
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead>
          <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            <th className="px-3 py-2.5">Fecha</th>
            <th className="px-3 py-2.5 text-right">Saldo inicial</th>
            <th className="px-3 py-2.5 text-right">Ingresos</th>
            <th className="px-3 py-2.5 text-right">Egresos</th>
            <th className="px-3 py-2.5 text-right">Saldo final</th>
            {onDetalle && <th className="px-3 py-2.5" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {filas.map((f) => (
            <tr key={f.periodo}>
              <td className="px-3 py-2.5 font-medium text-ink-900">{etiquetaPeriodo(f.periodo)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{dinero(moneda, f.inicial)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-success-700">{dinero(moneda, f.ingresos)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-danger-700">{dinero(moneda, f.egresos)}</td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-ink-900">{dinero(moneda, f.final)}</td>
              {onDetalle && (
                <td className="px-3 py-2.5 text-right">
                  <button type="button" onClick={() => onDetalle(f.periodo)} className="text-sm font-semibold text-brand-700 hover:underline">
                    Ver movimientos
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PantallaHistorico() {
  const d = useCajaDatos();
  const cuentas = useCuentasBancarias();
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
  const series = seriesDe({ cajas: d.cajas, cuentas, libro: d.libro, movimientos: d.movimientos }, cajaIds, cuentaIds, moneda);
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
      <Card className="p-5">
        <div className="flex flex-wrap gap-6">
          <Selector titulo="Cajas" opciones={cajasLista.map((c) => ({ id: c.id, label: c.nombre }))} elegidos={cajaIds} onChange={setCajaIds} />
          <Selector
            titulo="Cuentas bancarias"
            opciones={cuentasLista.map((c) => ({ id: c.id, label: `${c.banco} ${c.numero} · ${c.moneda}` }))}
            elegidos={cuentaIds}
            onChange={setCuentaIds}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-400">Desde</span>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" className={`${CLASE_INPUT} w-40`} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-400">Hasta</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" className={`${CLASE_INPUT} w-40`} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-400">Moneda</span>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda | "")} aria-label="Moneda" className={`${CLASE_INPUT} w-36`}>
              <option value="">Todas</option>
              <option value="ARS">{NOMBRE_MONEDA.ARS}</option>
              <option value="USD">{NOMBRE_MONEDA.USD}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-400">Periodicidad</span>
            <select value={periodicidad} onChange={(e) => setPeriodicidad(e.target.value as Periodicidad)} aria-label="Periodicidad" className={`${CLASE_INPUT} w-36`} disabled={unDia}>
              <option value="DIARIA">Diaria</option>
              <option value="MENSUAL">Mensual</option>
            </select>
          </label>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={exportarXlsx} disabled={rangoInvalido || series.length === 0}>
              Exportar a Excel
            </Button>
            <Button variant="outline" onClick={exportarPdf} disabled={rangoInvalido || series.length === 0}>
              Exportar a PDF
            </Button>
          </div>
        </div>
        {rangoInvalido && <p className="mt-3 text-sm text-danger-700">La fecha desde no puede ser posterior a la fecha hasta.</p>}
      </Card>

      {series.length === 0 && !rangoInvalido && (
        <p className="mt-6 rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-400">
          Elegí al menos una caja o una cuenta bancaria.
        </p>
      )}

      {unDia && series.length > 0 && (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-ink-100 px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-700">Saldos al {etiquetaPeriodo(desde)}</h2>
            <p className="mt-0.5 text-xs text-ink-500">Foto al cierre de ese día, de todas las cajas y cuentas elegidas.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  <th className="px-3 py-2.5">Tipo</th>
                  <th className="px-3 py-2.5">Caja o cuenta</th>
                  <th className="px-3 py-2.5">Moneda</th>
                  <th className="px-3 py-2.5 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {foto.map((f) => (
                  <tr key={f.serie.clave}>
                    <td className="px-3 py-2.5 text-ink-700">{f.serie.tipo === "CAJA" ? "Caja" : "Banco"}</td>
                    <td className="px-3 py-2.5 font-medium text-ink-900">{f.serie.nombre}</td>
                    <td className="px-3 py-2.5 text-ink-700">{NOMBRE_MONEDA[f.serie.moneda]}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-ink-900">{dinero(f.serie.moneda, f.saldo)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {MONEDA_LISTA.filter((m) => foto.some((f) => f.serie.moneda === m)).map((m) => (
                  <tr key={m} className="border-t border-ink-200 bg-ink-25 font-semibold text-ink-900">
                    <td className="px-3 py-2.5" colSpan={3}>
                      Total en {NOMBRE_MONEDA[m].toLowerCase()}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{dinero(m, foto.filter((f) => f.serie.moneda === m).reduce((s, f) => s + f.saldo, 0))}</td>
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {bloques.map((b) => (
        <Card key={b.serie.clave} className="mt-6 overflow-hidden">
          <div className="border-b border-ink-100 px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-700">{nombreSerie(b.serie)}</h2>
          </div>
          <TablaFilas moneda={b.serie.moneda} filas={b.filas} onDetalle={(periodo) => setDetalle({ serie: b.serie, periodo })} />
        </Card>
      ))}

      {MONEDA_LISTA.filter((m) => consolidado.some((c) => c.moneda === m)).map((m) => {
        const filas = consolidado.filter((c) => c.moneda === m);
        return (
          <Card key={m} className="mt-6 overflow-hidden border-brand-200">
            <div className="border-b border-ink-100 bg-brand-50 px-4 py-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-brand-800">
                Consolidado · {NOMBRE_MONEDA[m]} ({filas[0].series} cajas y cuentas)
              </h2>
            </div>
            <TablaFilas moneda={m} filas={filas} />
          </Card>
        );
      })}

      <Modal
        open={!!detalle}
        onClose={() => setDetalle(null)}
        title={detalle ? `Movimientos · ${etiquetaPeriodo(detalle.periodo)}` : ""}
        maxWidth="max-w-3xl"
        footer={<Button onClick={() => setDetalle(null)}>Cerrar</Button>}
      >
        {detalle && (
          <>
            <p className="mb-3 text-sm text-ink-600">{nombreSerie(detalle.serie)}</p>
            {movimientosDetalle.length === 0 ? (
              <p className="text-sm text-ink-400">No hubo movimientos en el período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead>
                    <tr className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                      <th className="px-3 py-2">Fecha y hora</th>
                      <th className="px-3 py-2">Descripción</th>
                      <th className="px-3 py-2">Comprobante</th>
                      <th className="px-3 py-2 text-right">Ingreso</th>
                      <th className="px-3 py-2 text-right">Egreso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {movimientosDetalle.map((m, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-ink-700">{`${m.fecha} ${m.hora}`.trim()}</td>
                        <td className="px-3 py-2 text-ink-900">{m.descripcion}</td>
                        <td className="px-3 py-2 text-ink-700">{m.comprobante}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{m.ingreso > 0 ? dinero(detalle.serie.moneda, m.ingreso) : ""}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{m.egreso > 0 ? dinero(detalle.serie.moneda, m.egreso) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Modal>
    </PaginaCaja>
  );
}
