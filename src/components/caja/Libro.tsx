"use client";

import { useState, type ReactNode } from "react";
import { USUARIOS_CAJA } from "@/lib/caja-datos";
import { nombreCaja, bancoTexto } from "@/lib/caja-operaciones";
import { auditar, nombreUsuario, useCajaDatos } from "@/lib/caja-store";
import {
  MEDIO_LABEL,
  MONEDAS,
  TIPO_CAJA_LABEL,
  monedasDe,
  type Caja,
  type MedioMovimiento,
  type Moneda,
  type MovimientoCaja,
  type TipoCaja,
} from "@/lib/caja-tipos";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CLASE_INPUT, Dato, PaginaCaja, descargarXlsx, dinero, sinAcentos } from "./comunes";

interface Filtros {
  sucursalId: string;
  cajaId: string;
  tipoCaja: string;
  desde: string;
  hasta: string;
  moneda: string;
  tipo: string;
  sentido: string;
  medio: string;
  estado: string;
  responsableId: string;
  texto: string;
  minimo: string;
  maximo: string;
  soloDiferencia: boolean;
}

const VACIOS: Filtros = {
  sucursalId: "",
  cajaId: "",
  tipoCaja: "",
  desde: "",
  hasta: "",
  moneda: "",
  tipo: "",
  sentido: "",
  medio: "",
  estado: "",
  responsableId: "",
  texto: "",
  minimo: "",
  maximo: "",
  soloDiferencia: false,
};

interface Fila {
  mov: MovimientoCaja;
  saldo: number;
}
interface Bloque {
  caja: Caja;
  moneda: Moneda;
  inicial: number;
  filas: Fila[];
  ingresos: number;
  egresos: number;
  final: number;
}

const cuenta = (m: MovimientoCaja) => m.medio === "EFECTIVO" && m.estado === "CONFIRMADO";

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</span>
      {children}
    </label>
  );
}

function calcularBloques(f: Filtros, cajas: Caja[], libro: MovimientoCaja[]): Bloque[] {
  const minimo = Number(f.minimo) || 0;
  const maximo = Number(f.maximo) || Infinity;
  const q = sinAcentos(f.texto.trim());
  const bloques: Bloque[] = [];
  for (const caja of cajas) {
    if ((f.sucursalId && caja.sucursalId !== f.sucursalId) || (f.cajaId && caja.id !== f.cajaId) || (f.tipoCaja && caja.tipo !== f.tipoCaja)) continue;
    for (const moneda of monedasDe(caja.moneda)) {
      if (f.moneda && f.moneda !== moneda) continue;
      const propios = libro.filter((m) => m.cajaId === caja.id && m.moneda === moneda);
      const inicial = f.desde ? propios.filter((m) => cuenta(m) && m.fecha < f.desde).reduce((s, m) => s + m.ingreso - m.egreso, 0) : 0;
      const movs = propios
        .filter((m) => {
          const importe = m.ingreso || m.egreso;
          return (
            (!f.desde || m.fecha >= f.desde) &&
            (!f.hasta || m.fecha <= f.hasta) &&
            (!f.tipo || m.tipo === f.tipo) &&
            (!f.sentido || (f.sentido === "ingreso" ? m.ingreso > 0 : m.egreso > 0)) &&
            (!f.medio || m.medio === f.medio) &&
            (!f.estado || m.estado === f.estado) &&
            (!f.responsableId || m.responsableId === f.responsableId || m.turnoUsuarioId === f.responsableId) &&
            (!q || sinAcentos(`${m.id} ${m.comprobante} ${m.descripcion} ${m.refId ?? ""}`).includes(q)) &&
            importe >= minimo &&
            importe <= maximo &&
            (!f.soloDiferencia || m.diferencia || m.incidencia)
          );
        })
        .sort((a, b) => `${a.fecha} ${a.hora} ${a.id}`.localeCompare(`${b.fecha} ${b.hora} ${b.id}`));
      let saldo = inicial;
      const filas = movs.map((mov) => {
        if (cuenta(mov)) saldo += mov.ingreso - mov.egreso;
        return { mov, saldo };
      });
      const efectivos = movs.filter(cuenta);
      bloques.push({
        caja,
        moneda,
        inicial,
        filas,
        ingresos: efectivos.reduce((s, m) => s + m.ingreso, 0),
        egresos: efectivos.reduce((s, m) => s + m.egreso, 0),
        final: saldo,
      });
    }
  }
  return bloques;
}

function DetalleFila({ mov, onClose }: { mov: MovimientoCaja; onClose: () => void }) {
  const { movimientos, libro } = useCajaDatos();
  const ref = mov.refId ?? mov.comprobante;
  const mt = movimientos.find((m) => m.id === ref);
  const vinculados = libro.filter((m) => m.id !== mov.id && ((mov.refId && m.refId === mov.refId) || (mov.diferencia && m.comprobante === mov.comprobante)));
  return (
    <Modal open onClose={onClose} title={`Movimiento ${mov.id}`} maxWidth="max-w-xl" footer={<Button onClick={onClose}>Cerrar</Button>}>
      <dl className="grid grid-cols-2 gap-3">
        <Dato label="Fecha y hora">{mov.fecha} {mov.hora}</Dato>
        <Dato label="Turno">{nombreUsuario(mov.turnoUsuarioId)}</Dato>
        <Dato label="Tipo">{mov.tipo}</Dato>
        <Dato label="Comprobante">{mov.comprobante}</Dato>
        <Dato label="Descripción">{mov.descripcion}</Dato>
        <Dato label="Medio">{MEDIO_LABEL[mov.medio]}</Dato>
        <Dato label="Importe">{mov.ingreso > 0 ? `Ingreso ${dinero(mov.moneda, mov.ingreso)}` : `Egreso ${dinero(mov.moneda, mov.egreso)}`}</Dato>
        <Dato label="Responsable">{nombreUsuario(mov.responsableId)}</Dato>
        {mov.nota && <Dato label="Nota">{mov.nota}</Dato>}
      </dl>
      {mt && (
        <div className="mt-4 rounded-lg border border-ink-200 p-3 text-sm">
          <p className="font-semibold text-ink-900">Movimiento de tesorería {mt.id}</p>
          <ul className="mt-1 space-y-0.5 text-ink-700">
            <li>Origen: {nombreCaja(mt.origenId)} · Destino: {mt.destino.tipo === "CAJA" ? nombreCaja(mt.destino.cajaId) : bancoTexto(mt.destino.cuentaId)}</li>
            <li>Solicitó: {nombreUsuario(mt.solicitanteId)} ({mt.fechaSolicitud})</li>
            {mt.autorizacion && <li>Autorización: {nombreUsuario(mt.autorizacion.supervisorId)} ({mt.autorizacion.fechaHora})</li>}
            {mt.envio && <li>Entrega: {nombreUsuario(mt.envio.usuarioId)} ({mt.envio.fechaHora})</li>}
            {mt.recepcion && <li>Recepción: {nombreUsuario(mt.recepcion.usuarioId)} ({mt.recepcion.fechaHora})</li>}
          </ul>
        </div>
      )}
      {vinculados.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-700">Movimientos vinculados</p>
          <ul className="mt-1 space-y-0.5 text-sm text-ink-700">
            {vinculados.map((v) => (
              <li key={v.id}>
                {v.id} · {nombreCaja(v.cajaId)} · {v.tipo} · {v.ingreso > 0 ? `+${dinero(v.moneda, v.ingreso)}` : `−${dinero(v.moneda, v.egreso)}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

export function PantallaLibro() {
  const { sucursales, cajas, libro } = useCajaDatos();
  const [f, setF] = useState<Filtros>(VACIOS);
  const [detalle, setDetalle] = useState<MovimientoCaja | null>(null);
  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setF((x) => ({ ...x, [k]: v }));
  const tiposMov = [...new Set(libro.map((m) => m.tipo))].sort();
  const bloques = calcularBloques(f, cajas, libro);
  const visibles = bloques.filter((b) => b.filas.length > 0 || (!f.texto && !f.tipo && !f.sentido && !f.medio && !f.estado && !f.responsableId && !f.minimo && !f.maximo && !f.soloDiferencia && !f.hasta));
  const consolidado = MONEDAS.map((m) => {
    const bs = bloques.filter((b) => b.moneda === m && (b.filas.length > 0 || b.inicial !== 0));
    return { moneda: m, bloques: bs.length, inicial: bs.reduce((s, b) => s + b.inicial, 0), ingresos: bs.reduce((s, b) => s + b.ingresos, 0), egresos: bs.reduce((s, b) => s + b.egresos, 0), final: bs.reduce((s, b) => s + b.final, 0) };
  }).filter((c) => c.bloques > 1);
  const periodo = `${f.desde || "inicio"} a ${f.hasta || "hoy"}`;

  const exportar = () => {
    const filas: string[][] = [["Caja", "Moneda", "Fecha", "Hora", "Turno", "Tipo", "Descripción", "Comprobante", "Ingreso", "Egreso", "Saldo acumulado", "Medio", "Responsable", "Estado"]];
    for (const b of bloques)
      for (const { mov, saldo } of b.filas)
        filas.push([b.caja.nombre, b.moneda, mov.fecha, mov.hora, nombreUsuario(mov.turnoUsuarioId), mov.tipo, mov.descripcion, mov.comprobante, String(mov.ingreso), String(mov.egreso), String(saldo), MEDIO_LABEL[mov.medio], nombreUsuario(mov.responsableId), mov.estado === "ANULADO" ? "Anulado" : "Confirmado"]);
    descargarXlsx("libro-de-caja.xlsx", "Libro de caja", filas);
    auditar("Exportación del libro de caja", "LIBRO", "ALTA", null, `Exportó ${filas.length - 1} movimientos a Excel (período ${periodo})`);
  };

  const cajasLista = cajas.filter((c) => !f.sucursalId || c.sucursalId === f.sucursalId);

  return (
    <PaginaCaja titulo="Libro de movimientos de caja" descripcion="Consulta, sin operación, de todo lo ocurrido en una caja o en todas, en formato de mayor de caja. Los confirmados no se borran ni se modifican; los cobros con tarjeta o transferencia figuran sin modificar el saldo de efectivo.">
      <Card>
        <CardHeader title="Filtros" action={<Button size="sm" variant="ghost" onClick={() => setF(VACIOS)}>Limpiar</Button>} />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Campo label="Sucursal">
            <select value={f.sucursalId} onChange={(e) => setF((x) => ({ ...x, sucursalId: e.target.value, cajaId: "" }))} className={CLASE_INPUT} aria-label="Sucursal">
              <option value="">Todas</option>
              {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Caja">
            <select value={f.cajaId} onChange={(e) => set("cajaId", e.target.value)} className={CLASE_INPUT} aria-label="Caja">
              <option value="">Todas</option>
              {cajasLista.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Tipo de caja">
            <select value={f.tipoCaja} onChange={(e) => set("tipoCaja", e.target.value)} className={CLASE_INPUT} aria-label="Tipo de caja">
              <option value="">Todos</option>
              {(Object.keys(TIPO_CAJA_LABEL) as TipoCaja[]).map((t) => <option key={t} value={t}>{TIPO_CAJA_LABEL[t]}</option>)}
            </select>
          </Campo>
          <Campo label="Moneda">
            <select value={f.moneda} onChange={(e) => set("moneda", e.target.value)} className={CLASE_INPUT} aria-label="Moneda">
              <option value="">Todas</option>
              <option value="ARS">Pesos</option>
              <option value="USD">Dólares</option>
            </select>
          </Campo>
          <Campo label="Desde">
            <input type="date" value={f.desde} onChange={(e) => set("desde", e.target.value)} className={CLASE_INPUT} aria-label="Fecha desde" />
          </Campo>
          <Campo label="Hasta">
            <input type="date" value={f.hasta} onChange={(e) => set("hasta", e.target.value)} className={CLASE_INPUT} aria-label="Fecha hasta" />
          </Campo>
          <Campo label="Tipo de movimiento">
            <select value={f.tipo} onChange={(e) => set("tipo", e.target.value)} className={CLASE_INPUT} aria-label="Tipo de movimiento">
              <option value="">Todos</option>
              {tiposMov.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Campo>
          <Campo label="Sentido">
            <select value={f.sentido} onChange={(e) => set("sentido", e.target.value)} className={CLASE_INPUT} aria-label="Sentido">
              <option value="">Ingresos y egresos</option>
              <option value="ingreso">Ingresos</option>
              <option value="egreso">Egresos</option>
            </select>
          </Campo>
          <Campo label="Medio">
            <select value={f.medio} onChange={(e) => set("medio", e.target.value)} className={CLASE_INPUT} aria-label="Medio">
              <option value="">Todos</option>
              {(Object.keys(MEDIO_LABEL) as MedioMovimiento[]).map((m) => <option key={m} value={m}>{MEDIO_LABEL[m]}</option>)}
            </select>
          </Campo>
          <Campo label="Estado">
            <select value={f.estado} onChange={(e) => set("estado", e.target.value)} className={CLASE_INPUT} aria-label="Estado">
              <option value="">Todos</option>
              <option value="CONFIRMADO">Confirmado</option>
              <option value="ANULADO">Anulado</option>
            </select>
          </Campo>
          <Campo label="Responsable o turno">
            <select value={f.responsableId} onChange={(e) => set("responsableId", e.target.value)} className={CLASE_INPUT} aria-label="Responsable">
              <option value="">Todos</option>
              {USUARIOS_CAJA.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Comprobante, ID de crédito o cliente">
            <input value={f.texto} onChange={(e) => set("texto", e.target.value)} className={CLASE_INPUT} aria-label="Comprobante, crédito o cliente" placeholder="Ej.: MT-0001" />
          </Campo>
          <Campo label="Importe mínimo">
            <input type="number" min={0} value={f.minimo} onChange={(e) => set("minimo", e.target.value)} className={CLASE_INPUT} aria-label="Importe mínimo" />
          </Campo>
          <Campo label="Importe máximo">
            <input type="number" min={0} value={f.maximo} onChange={(e) => set("maximo", e.target.value)} className={CLASE_INPUT} aria-label="Importe máximo" />
          </Campo>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink-700 lg:col-span-2">
            <input type="checkbox" checked={f.soloDiferencia} onChange={(e) => set("soloDiferencia", e.target.checked)} className="h-4 w-4" />
            Sólo movimientos con diferencia o incidencia
          </label>
        </div>
      </Card>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-ink-500">Período: {periodo}</p>
        <Button variant="outline" onClick={exportar}>Exportar a Excel</Button>
      </div>

      <div className="mt-3 space-y-5">
        {visibles.length === 0 && <Card className="px-5 py-8 text-center text-sm text-ink-400">Ningún movimiento coincide con los filtros.</Card>}
        {visibles.map((b) => (
          <Card key={`${b.caja.id}-${b.moneda}`} className="overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-100 bg-ink-25 px-5 py-3">
              <h2 className="text-sm font-bold text-ink-900">{b.caja.nombre} · {b.moneda === "ARS" ? "Pesos" : "Dólares"}</h2>
              <p className="text-sm text-ink-600">Saldo inicial: <strong className="tabular-nums">{dinero(b.moneda, b.inicial)}</strong></p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[70rem] text-sm">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                    <th className="px-3 py-2 text-left">Fecha y hora</th>
                    <th className="px-3 py-2 text-left">Turno</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">Descripción</th>
                    <th className="px-3 py-2 text-left">Comprobante</th>
                    <th className="px-3 py-2 text-right">Ingreso</th>
                    <th className="px-3 py-2 text-right">Egreso</th>
                    <th className="px-3 py-2 text-right">Saldo</th>
                    <th className="px-3 py-2 text-left">Medio</th>
                    <th className="px-3 py-2 text-left">Responsable</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {b.filas.length === 0 && (
                    <tr><td colSpan={11} className="px-3 py-4 text-center text-ink-400">Sin movimientos en el período.</td></tr>
                  )}
                  {b.filas.map(({ mov, saldo }) => (
                    <tr key={mov.id} onClick={() => setDetalle(mov)} className={`cursor-pointer hover:bg-ink-25 ${mov.estado === "ANULADO" ? "text-ink-400 line-through" : ""}`}>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{mov.fecha} {mov.hora}</td>
                      <td className="px-3 py-2">{nombreUsuario(mov.turnoUsuarioId)}</td>
                      <td className="px-3 py-2">{mov.tipo}</td>
                      <td className="px-3 py-2">{mov.descripcion}</td>
                      <td className="px-3 py-2 font-mono text-xs">{mov.comprobante}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{mov.ingreso > 0 ? dinero(mov.moneda, mov.ingreso) : ""}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{mov.egreso > 0 ? dinero(mov.moneda, mov.egreso) : ""}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{dinero(mov.moneda, saldo)}</td>
                      <td className="px-3 py-2">{MEDIO_LABEL[mov.medio]}</td>
                      <td className="px-3 py-2">{nombreUsuario(mov.responsableId)}</td>
                      <td className="px-3 py-2"><StatusBadge tone={mov.estado === "CONFIRMADO" ? "success" : "neutral"}>{mov.estado === "CONFIRMADO" ? "Confirmado" : "Anulado"}</StatusBadge></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-ink-200 bg-ink-25 text-sm font-semibold">
                    <td colSpan={5} className="px-3 py-2.5 text-ink-700">Totales (efectivo confirmado)</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{dinero(b.moneda, b.ingresos)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{dinero(b.moneda, b.egresos)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{dinero(b.moneda, b.final)}</td>
                    <td colSpan={3} className="px-3 py-2.5 text-ink-500">Saldo final</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        ))}

        {consolidado.map((c) => (
          <Card key={c.moneda} className="border-brand-200 bg-brand-50/40 px-5 py-4">
            <h2 className="text-sm font-bold text-ink-900">Consolidado · {c.moneda === "ARS" ? "Pesos" : "Dólares"} ({c.bloques} cajas)</h2>
            <dl className="mt-2 grid gap-3 sm:grid-cols-4">
              <Dato label="Saldo inicial">{dinero(c.moneda, c.inicial)}</Dato>
              <Dato label="Total de ingresos">{dinero(c.moneda, c.ingresos)}</Dato>
              <Dato label="Total de egresos">{dinero(c.moneda, c.egresos)}</Dato>
              <Dato label="Saldo final">{dinero(c.moneda, c.final)}</Dato>
            </dl>
          </Card>
        ))}
      </div>
      {detalle && <DetalleFila mov={detalle} onClose={() => setDetalle(null)} />}
    </PaginaCaja>
  );
}
