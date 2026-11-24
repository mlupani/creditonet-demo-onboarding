"use client";

import { useState } from "react";
import { diferenciaRecuento, denominacionesDe, monedasFueraDeTolerancia, recuentoSugerido, saldosCaja, totalRecuento } from "@/lib/caja-reglas";
import { useDenominaciones, useLibro, useMotivosDiferencia } from "@/lib/caja-store";
import { NOMBRE_MONEDA, monedasDe, type AjusteDiferencia, type Caja, type DetalleRecuento, type Moneda } from "@/lib/caja-tipos";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Campo, Cifra, INPUT_COMPACTO, PanelVentana } from "./compacto";
import { dinero, dineroConSigno, ErrorBanner } from "./comunes";
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
    <div className="grid gap-3 lg:grid-cols-2">
      {monedas.map((m) => {
        const dens = denominacionesDe(denominaciones, m);
        return (
          <PanelVentana
            key={m}
            titulo={
              <span>
                Recuento en {NOMBRE_MONEDA[m].toLowerCase()} · total{" "}
                <span className="font-bold tabular-nums text-ink-900">{dinero(m, total[m])}</span>
              </span>
            }
            accion={
              ayuda?.[m] !== undefined && !disabled ? (
                <button
                  type="button"
                  onClick={() => {
                    const resto = { ...detalle };
                    for (const d of dens) delete resto[d.id];
                    onChange({ ...resto, ...recuentoSugerido(denominaciones, m, ayuda[m] ?? 0) });
                  }}
                  title="Ayuda de demo: carga el recuento exacto del importe conocido"
                  className="rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-[10px] font-semibold text-warning-700 hover:bg-warning-100"
                >
                  Autocompletar (ayuda de demo)
                </button>
              ) : undefined
            }
          >
            {/* Una celda por denominación (valor y cantidad). El subtotal no se repite por fila: el
                total de la moneda queda siempre a la vista en la barra de título. */}
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {dens.map((d) => {
                const n = detalle[d.id] ?? 0;
                const tipo = d.tipo === "BILLETE" ? "Billete" : "Moneda";
                return (
                  <label
                    key={d.id}
                    title={`${tipo} de ${formatNumber(d.valor)}${n > 0 ? ` · subtotal ${dinero(m, n * d.valor)}` : ""}`}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1 transition ${n > 0 ? "border-brand-300 bg-brand-50" : "border-ink-200 bg-white"}`}
                  >
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[11px] font-bold tabular-nums text-ink-800">{formatNumber(d.valor)}</span>
                      <span className="block text-[9px] font-semibold uppercase tracking-wide text-ink-400">{tipo}</span>
                    </span>
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
                      className={`${INPUT_COMPACTO} h-7 w-14 shrink-0 bg-white text-right tabular-nums`}
                    />
                  </label>
                );
              })}
            </div>
          </PanelVentana>
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
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm" variant="success" onClick={() => setRevelado(true)}>
            Ver diferencia
          </Button>
          <p className="text-xs text-ink-500">El saldo esperado se muestra recién después del recuento.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {monedas.map((m) => {
              const dif = diferencia[m];
              const supera = fuera.includes(m);
              return (
                <div
                  key={m}
                  className={`rounded-lg border p-3 ${dif === 0 ? "border-success-200 bg-success-50" : supera ? "border-danger-200 bg-danger-50" : "border-warning-200 bg-warning-50"}`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500">{NOMBRE_MONEDA[m]}</p>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    <Cifra label="Contado">{dinero(m, contado[m])}</Cifra>
                    <Cifra label="Esperado">{dinero(m, esperado[m])}</Cifra>
                    <Cifra label="Diferencia" tono={dif === 0 ? "bueno" : "malo"}>
                      {dineroConSigno(m, dif)}
                    </Cifra>
                  </div>
                  <p className="mt-1.5 text-[11px] text-ink-600">
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
            <PanelVentana key={m} titulo={`Diferencia en ${NOMBRE_MONEDA[m].toLowerCase()}: ${dineroConSigno(m, diferencia[m])}`}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo label="Motivo de la diferencia">
                  <select
                    value={ajustes[m]?.motivoId ?? ""}
                    onChange={(e) => setAjustes((a) => ({ ...a, [m]: { motivoId: e.target.value, nota: a[m]?.nota ?? "" } }))}
                    aria-label={`Motivo de la diferencia en ${m}`}
                    className={INPUT_COMPACTO}
                  >
                    <option value="">Elegí un motivo…</option>
                    {motivos.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.descripcion}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Nota (opcional)">
                  <input
                    value={ajustes[m]?.nota ?? ""}
                    onChange={(e) => setAjustes((a) => ({ ...a, [m]: { motivoId: a[m]?.motivoId ?? "", nota: e.target.value } }))}
                    className={INPUT_COMPACTO}
                  />
                </Campo>
              </div>
            </PanelVentana>
          ))}
          {fuera.length > 0 && (
            <Banner tone="warning">La caja queda pendiente de autorización y no puede operar hasta que un supervisor la apruebe.</Banner>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="success"
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
            <Button size="sm" variant="navyOutline" onClick={repetir}>
              Repetir recuento
            </Button>
          </div>
        </div>
      )}
      <ErrorBanner error={error} />
    </div>
  );
}
