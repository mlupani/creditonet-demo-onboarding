"use client";

import { useState } from "react";
import { diferenciaRecuento, denominacionesDe, monedasFueraDeTolerancia, recuentoSugerido, saldosCaja, totalRecuento } from "@/lib/caja-reglas";
import { useDenominaciones, useLibro, useMotivosDiferencia } from "@/lib/caja-store";
import { NOMBRE_MONEDA, monedasDe, type AjusteDiferencia, type Caja, type DetalleRecuento, type Moneda } from "@/lib/caja-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { dinero, dineroConSigno, ErrorBanner, CLASE_INPUT } from "./comunes";
import { formatNumber } from "@/lib/format";

// Cantidad de billetes y monedas por denominación activa, con subtotales y total por moneda.
// `ayuda` ofrece completar con un importe conocido: es una ayuda de la demo, no parte del circuito.
export function RecuentoForm({
  monedas,
  detalle,
  onChange,
  disabled,
  ayuda,
}: {
  monedas: Moneda[];
  detalle: DetalleRecuento;
  onChange: (d: DetalleRecuento) => void;
  disabled?: boolean;
  ayuda?: Partial<Record<Moneda, number>>;
}) {
  const denominaciones = useDenominaciones();
  const total = totalRecuento(detalle, denominaciones);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {monedas.map((m) => {
        const dens = denominacionesDe(denominaciones, m);
        return (
          <div key={m} className="rounded-xl border border-ink-200">
            <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-2.5">
              <h3 className="text-sm font-semibold text-ink-900">Recuento en {NOMBRE_MONEDA[m].toLowerCase()}</h3>
              {ayuda?.[m] !== undefined && !disabled && (
                <button
                  type="button"
                  onClick={() => {
                    const resto = { ...detalle };
                    for (const d of dens) delete resto[d.id];
                    onChange({ ...resto, ...recuentoSugerido(denominaciones, m, ayuda[m] ?? 0) });
                  }}
                  title="Ayuda de demo: carga el recuento exacto del importe conocido"
                  className="rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-[11px] font-semibold text-warning-700 hover:bg-warning-100"
                >
                  Autocompletar (ayuda de demo)
                </button>
              )}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  <th className="px-4 py-2 text-left">Denominación</th>
                  <th className="w-24 px-2 py-2 text-right">Cantidad</th>
                  <th className="w-32 px-4 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {dens.map((d) => {
                  const n = detalle[d.id] ?? 0;
                  return (
                    <tr key={d.id}>
                      <td className="px-4 py-1.5 text-ink-700">
                        {d.tipo === "BILLETE" ? "Billete" : "Moneda"} de {formatNumber(d.valor)}
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          disabled={disabled}
                          aria-label={`Cantidad de ${d.tipo === "BILLETE" ? "billetes" : "monedas"} de ${d.valor} ${m}`}
                          value={n === 0 ? "" : n}
                          placeholder="0"
                          onChange={(e) => {
                            const v = Math.max(0, Math.floor(Number(e.target.value) || 0));
                            onChange({ ...detalle, [d.id]: v });
                          }}
                          className="h-8 w-full rounded-md border border-ink-300 px-2 text-right text-sm tabular-nums outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-ink-50"
                        />
                      </td>
                      <td className="px-4 py-1.5 text-right tabular-nums text-ink-600">{dinero(m, n * d.valor)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-ink-200 bg-ink-25">
                  <td colSpan={2} className="px-4 py-2 text-sm font-semibold text-ink-900">
                    Total contado
                  </td>
                  <td className="px-4 py-2 text-right text-sm font-bold tabular-nums text-ink-900">{dinero(m, total[m])}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// Recuento ciego en dos pasos: se cuenta sin ver el esperado y recién después se revela y se calcula la
// diferencia por moneda. Si una moneda supera la tolerancia (y `conMotivos`), pide motivo para cada una.
export function FlujoRecuento({
  caja,
  confirmar,
  conMotivos = true,
  onConfirmar,
}: {
  caja: Caja;
  confirmar: string;
  conMotivos?: boolean;
  onConfirmar: (detalle: DetalleRecuento, ajustes: AjusteDiferencia[]) => string | null;
}) {
  const libro = useLibro();
  const denominaciones = useDenominaciones();
  const motivos = useMotivosDiferencia().filter((m) => m.estado === "ACTIVO");
  const monedas = monedasDe(caja.moneda);
  const [detalle, setDetalle] = useState<DetalleRecuento>({});
  const [revelado, setRevelado] = useState(false);
  const [ajustes, setAjustes] = useState<Partial<Record<Moneda, { motivoId: string; nota: string }>>>({});
  const [error, setError] = useState<string | null>(null);

  const contado = totalRecuento(detalle, denominaciones.filter((d) => monedas.includes(d.moneda)));
  const esperado = saldosCaja(libro, caja);
  const diferencia = diferenciaRecuento(contado, esperado, monedas);
  const fuera = conMotivos ? monedasFueraDeTolerancia(caja, diferencia) : [];
  const ayuda = Object.fromEntries(monedas.map((m) => [m, esperado[m]])) as Partial<Record<Moneda, number>>;

  const repetir = () => {
    setRevelado(false);
    setAjustes({});
    setError(null);
  };

  return (
    <div>
      <RecuentoForm monedas={monedas} detalle={detalle} onChange={setDetalle} disabled={revelado} ayuda={ayuda} />

      {!revelado ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => setRevelado(true)}>Ver diferencia</Button>
          <p className="text-xs text-ink-500">El saldo esperado se muestra recién después del recuento.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {monedas.map((m) => {
              const dif = diferencia[m];
              const supera = fuera.includes(m);
              return (
                <div key={m} className={`rounded-xl border p-4 ${dif === 0 ? "border-success-200 bg-success-50" : supera ? "border-danger-200 bg-danger-50" : "border-warning-200 bg-warning-50"}`}>
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-500">{NOMBRE_MONEDA[m]}</p>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-ink-500">Contado</dt>
                      <dd className="font-semibold tabular-nums">{dinero(m, contado[m])}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-500">Esperado</dt>
                      <dd className="font-semibold tabular-nums">{dinero(m, esperado[m])}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-500">Diferencia</dt>
                      <dd className="font-bold tabular-nums">{dineroConSigno(m, dif)}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs text-ink-600">
                    {dif === 0
                      ? "Sin diferencia."
                      : `${dif > 0 ? "Sobrante (acreedora)" : "Faltante (deudora)"}. ${
                          supera
                            ? "Supera la tolerancia: requiere motivo y autorización de un supervisor."
                            : "Dentro de la tolerancia: se registra igual."
                        }`}
                  </p>
                </div>
              );
            })}
          </div>

          {fuera.map((m) => (
            <div key={m} className="rounded-xl border border-ink-200 p-4">
              <p className="text-sm font-semibold text-ink-900">
                Diferencia en {NOMBRE_MONEDA[m].toLowerCase()}: {dineroConSigno(m, diferencia[m])}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-ink-700">Motivo de la diferencia</span>
                  <select
                    value={ajustes[m]?.motivoId ?? ""}
                    onChange={(e) => setAjustes((a) => ({ ...a, [m]: { motivoId: e.target.value, nota: a[m]?.nota ?? "" } }))}
                    aria-label={`Motivo de la diferencia en ${m}`}
                    className={CLASE_INPUT}
                  >
                    <option value="">Elegí un motivo…</option>
                    {motivos.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.descripcion}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-ink-700">Nota (opcional)</span>
                  <input
                    value={ajustes[m]?.nota ?? ""}
                    onChange={(e) => setAjustes((a) => ({ ...a, [m]: { motivoId: a[m]?.motivoId ?? "", nota: e.target.value } }))}
                    className={CLASE_INPUT}
                  />
                </label>
              </div>
            </div>
          ))}
          {fuera.length > 0 && (
            <Banner tone="warning">La caja queda pendiente de autorización y no puede operar hasta que un supervisor la apruebe.</Banner>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => {
                const lista: AjusteDiferencia[] = fuera.map((m) => ({
                  moneda: m,
                  importe: diferencia[m],
                  motivoId: ajustes[m]?.motivoId ?? "",
                  nota: ajustes[m]?.nota ?? "",
                }));
                const e = onConfirmar(detalle, lista);
                if (e) setError(e);
                else {
                  setDetalle({});
                  repetir();
                }
              }}
            >
              {confirmar}
            </Button>
            <Button variant="outline" onClick={repetir}>
              Repetir recuento
            </Button>
          </div>
        </div>
      )}
      <ErrorBanner error={error} />
    </div>
  );
}
