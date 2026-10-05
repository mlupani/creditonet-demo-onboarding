"use client";

import { useState } from "react";
import { formatARS } from "@/lib/format";
import { crearXlsx } from "@/lib/xlsx";
import { useProductos, type ProductoAbm, type TramoPunitorio } from "@/lib/productos";
import {
  aplicarPunitorios,
  restaurarPunitorios,
  simular,
  useLogPunitorios,
  type RegistroPunitorios,
} from "@/lib/punitorios-cartera";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IconCheck } from "@/components/icons";
import { CampoNumero, Subtitulo } from "./campos";

const signo = (n: number) => (n > 0 ? "+" : "") + formatARS(n);

function Pasos({ pasos, actual }: { pasos: string[]; actual: number }) {
  return (
    <ol className="mb-5 flex flex-wrap items-center gap-2 text-xs font-semibold">
      {pasos.map((p, i) => (
        <li key={p} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full ${
              i < actual
                ? "bg-success-600 text-white"
                : i === actual
                  ? "bg-brand-600 text-white"
                  : "bg-ink-100 text-ink-400"
            }`}
          >
            {i < actual ? <IconCheck width={12} height={12} strokeWidth={3} /> : i + 1}
          </span>
          <span className={i === actual ? "text-ink-900" : "text-ink-400"}>{p}</span>
          {i < pasos.length - 1 && <span className="h-px w-6 bg-ink-200" />}
        </li>
      ))}
    </ol>
  );
}

function descargarXlsx(nombreArchivo: string, hoja: string, filas: string[][]) {
  const blob = new Blob([crearXlsx(hoja, filas) as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Modificar los punitorios de la cartera activa del producto, paso a paso: si el cambio es hacia
// atrás (toda la cartera histórica), qué tramos y con qué valor, descarga obligatoria del archivo
// con los créditos y confirmación. Cada aplicación queda como checkpoint (fecha y quién): se puede
// volver a la versión anterior cuando se quiera.
export function CarteraPunitorios({
  p,
  set,
}: {
  p: ProductoAbm;
  set: (cambio: (p: ProductoAbm) => ProductoAbm) => void;
}) {
  const productos = useProductos();
  const log = useLogPunitorios();
  const productoId = p.config.id;
  // Lo vigente en la cartera es lo guardado del producto, no lo que se está editando.
  const vigentes: TramoPunitorio[] = productos.find((x) => x.config.id === productoId)?.extras.tramosPunitorios ?? [];
  const registros = log.filter((r) => r.productoId === productoId);

  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState(0);
  const [retroactivo, setRetroactivo] = useState<boolean | null>(null);
  const [elegidos, setElegidos] = useState<number[]>([]);
  const [valores, setValores] = useState<Record<number, Partial<Pick<TramoPunitorio, "punitorioPct" | "montoTopeSinIva">>>>({});
  const [descargado, setDescargado] = useState(false);
  const [revisado, setRevisado] = useState(false);
  const [entiendo, setEntiendo] = useState(false);
  const [aRestaurar, setARestaurar] = useState<RegistroPunitorios | null>(null);

  // Sólo hacia atrás hay créditos que cambian, y por eso hay que bajar y revisar el archivo.
  const pasos = retroactivo === false
    ? ["Alcance", "Tramos", "Confirmar"]
    : ["Alcance", "Tramos", "Archivo de créditos", "Confirmar"];
  const etapa = pasos[paso];

  const nuevos = vigentes.map((t, i) =>
    elegidos.includes(i) ? { ...t, ...valores[i] } : t
  );
  const hayCambio = elegidos.some(
    (i) => nuevos[i].punitorioPct !== vigentes[i].punitorioPct || nuevos[i].montoTopeSinIva !== vigentes[i].montoTopeSinIva
  );
  const filas = simular(productoId, vigentes, nuevos, retroactivo !== false);
  const totalAjuste = filas.reduce((s, f) => s + f.ajuste, 0);

  function abrir() {
    setPaso(0);
    setRetroactivo(null);
    setElegidos([]);
    setValores({});
    setDescargado(false);
    setRevisado(false);
    setEntiendo(false);
    setAbierto(true);
  }

  function descargar() {
    descargarXlsx(
      `punitorios-cartera-${productoId}.xlsx`,
      "Créditos",
      [
        ["Crédito", "Cliente", "Días de mora", "Importe de la cuota", "Punitorio antes", "Punitorio después", "Se suma a la cuota actual"],
        ...filas.map((f) => [
          f.credito.numero,
          f.credito.cliente,
          String(f.credito.diasMora),
          String(f.credito.importeCuota),
          String(f.antes),
          String(f.despues),
          String(f.ajuste),
        ]),
        ["", "", "", "", "", "Total", String(totalAjuste)],
      ]
    );
    setDescargado(true);
  }

  const puedeSeguir =
    etapa === "Alcance" ? retroactivo !== null : etapa === "Tramos" ? hayCambio : revisado;

  function aplicar() {
    const r = aplicarPunitorios(productoId, nuevos, retroactivo !== false);
    if (r) set((x) => ({ ...x, extras: { ...x.extras, tramosPunitorios: r.tramosDespues } }));
    setAbierto(false);
  }

  function restaurar() {
    if (!aRestaurar) return;
    const r = restaurarPunitorios(aRestaurar.id);
    if (r) set((x) => ({ ...x, extras: { ...x.extras, tramosPunitorios: r.tramosDespues } }));
    setARestaurar(null);
  }

  const opciones = [
    {
      valor: true,
      titulo: "Sí, hacia atrás: toda la cartera histórica",
      detalle:
        "Se recalculan los punitorios de todos los créditos en mora desde su primer día de mora y la diferencia se suma como interés adicional a la cuota actual.",
    },
    {
      valor: false,
      titulo: "No, sólo desde ahora",
      detalle: "Los créditos conservan lo ya devengado; los nuevos valores rigen para los días de mora que vengan.",
    },
  ];

  return (
    <div className="space-y-4 rounded-xl border border-warning-300 bg-warning-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-72">
          <Subtitulo>Modificar cartera activa</Subtitulo>
          <p className="mt-1 text-xs text-ink-600">
            Cambia los punitorios de los créditos activos del producto. Es un cambio delicado: se hace
            paso a paso, hay que descargar el archivo con los créditos y confirmar. Cada aplicación queda
            como checkpoint y se puede volver a la versión anterior.
          </p>
        </div>
        <Button onClick={abrir}>Modificar punitorios…</Button>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-500">Checkpoints</p>
        {registros.length === 0 ? (
          <p className="text-xs text-ink-500">Todavía no se modificaron los punitorios de la cartera.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-ink-200 bg-white">
            <table className="w-full min-w-[44rem] text-left text-xs">
              <thead className="bg-ink-25 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Quién</th>
                  <th className="px-3 py-2">Acción</th>
                  <th className="px-3 py-2">Antes → después</th>
                  <th className="px-3 py-2 text-right">Ajuste total</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">Restaurar</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {registros.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-3 py-2 tabular-nums text-ink-700">{r.fecha}</td>
                    <td className="px-3 py-2 text-ink-700">{r.usuario}</td>
                    <td className="px-3 py-2">
                      <StatusBadge tone={r.accion === "RESTAURAR" ? "neutral" : "warning"}>
                        {r.accion === "RESTAURAR" ? "Restauración" : "Modificación"}
                      </StatusBadge>
                      <p className="mt-1 text-[11px] text-ink-500">
                        {r.retroactivo ? "Hacia atrás (cartera histórica)" : "Sólo desde ahora"}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-ink-700">
                      {r.cambios.length === 0
                        ? "Sin cambios de %"
                        : r.cambios.map((c) => (
                            <div key={c.tramo}>
                              Tramo {c.tramo} (día {c.desdeDia}+): {c.pctAntes !== c.pctDespues && <>{c.pctAntes} % → <strong>{c.pctDespues} %</strong> </>}{c.topeAntes !== c.topeDespues && <>tope {formatARS(c.topeAntes)} → <strong>{formatARS(c.topeDespues)}</strong></>}
                            </div>
                          ))}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{signo(r.ajusteTotal)}</td>
                    <td className="px-3 py-2 text-right">
                      {r.accion === "APLICAR" && (
                        <Button size="sm" variant="outline" onClick={() => setARestaurar(r)}>
                          Restaurar versión anterior
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={abierto}
        onClose={() => setAbierto(false)}
        title="Modificar punitorios de la cartera"
        maxWidth="max-w-2xl"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => (paso === 0 ? setAbierto(false) : setPaso(paso - 1))}>
              {paso === 0 ? "Cancelar" : "Volver"}
            </Button>
            {paso < pasos.length - 1 ? (
              <Button disabled={!puedeSeguir} onClick={() => setPaso(paso + 1)}>
                Siguiente
              </Button>
            ) : (
              <Button variant="success" disabled={!entiendo} onClick={aplicar}>
                Confirmar y aplicar
              </Button>
            )}
          </div>
        }
      >
        <Pasos pasos={pasos} actual={paso} />

        {etapa === "Alcance" && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-ink-800">¿Los cambios son hacia atrás, sobre toda la cartera histórica?</p>
            {opciones.map((o) => (
              <button
                key={String(o.valor)}
                type="button"
                onClick={() => setRetroactivo(o.valor)}
                className={`block w-full rounded-xl border p-4 text-left transition ${
                  retroactivo === o.valor ? "border-brand-400 bg-brand-50/50" : "border-ink-200 hover:border-ink-300"
                }`}
              >
                <p className="text-sm font-semibold text-ink-900">{o.titulo}</p>
                <p className="mt-1 text-xs text-ink-600">{o.detalle}</p>
              </button>
            ))}
          </div>
        )}

        {etapa === "Tramos" && (
          <div className="space-y-3">
            <p className="text-sm text-ink-600">
              Tildá los tramos que querés modificar y poné el % de punitorio sobre la tasa y el monto tope sin IVA que deben regir.
            </p>
            {vigentes.map((t, i) => {
              const activo = elegidos.includes(i);
              return (
                <div
                  key={i}
                  className={`grid items-center gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_22rem] ${
                    activo ? "border-brand-300 bg-brand-50/40" : "border-ink-200"
                  }`}
                >
                  <Checkbox
                    checked={activo}
                    onChange={(v) => setElegidos(v ? [...elegidos, i] : elegidos.filter((x) => x !== i))}
                    label={`Tramo ${i + 1} · desde el día ${t.desdeDia}`}
                    description={`Hoy: ${t.punitorioPct} % sobre la tasa · gracia ${t.diasGracia} d · tope ${formatARS(t.montoTopeSinIva)}`}
                  />
                  {activo && (
                    <div className="grid grid-cols-2 gap-3">
                      <CampoNumero
                        id={`cart-pct-${i}`}
                        label="Nuevo porcentaje de tasa"
                        sufijo="%"
                        step={0.5}
                        value={nuevos[i].punitorioPct}
                        onChange={(v) => setValores({ ...valores, [i]: { ...valores[i], punitorioPct: v } })}
                      />
                      <MoneyInput
                        id={`cart-tope-${i}`}
                        label="Nuevo tope sin IVA"
                        value={nuevos[i].montoTopeSinIva}
                        onChange={(v) => setValores({ ...valores, [i]: { ...valores[i], montoTopeSinIva: v } })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            {elegidos.length > 0 && !hayCambio && (
              <p className="text-xs text-warning-700">Los valores elegidos son iguales a los actuales: cambiá al menos uno.</p>
            )}
          </div>
        )}

        {etapa === "Archivo de créditos" && (
          <div className="space-y-4">
            <p className="text-sm text-ink-600">
              El impacto no se muestra en pantalla: descargá el Excel con los {filas.length} créditos activos en mora
              (punitorio antes, después y lo que se suma a la cuota actual) y revisalo antes de seguir.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant={descargado ? "outline" : "primary"} onClick={descargar}>
                {descargado ? "Descargar de nuevo" : "Descargar Excel"}
              </Button>
              {descargado ? (
                <span className="text-xs font-medium text-success-700">Archivo descargado.</span>
              ) : (
                <span className="text-xs text-ink-500">Es obligatorio para seguir.</span>
              )}
            </div>
            <Checkbox
              checked={revisado}
              onChange={setRevisado}
              disabled={!descargado}
              label="Descargué y revisé el archivo"
              description="Confirmo que los créditos y los importes son los esperados."
            />
          </div>
        )}

        {etapa === "Confirmar" && (
          <div className="space-y-4">
            <Banner tone="warning" title="Este cambio afecta a la cartera activa del producto">
              {retroactivo !== false ? (
                <>
                  Se recalculan los punitorios de {filas.length} créditos desde su primer día de mora y la
                  diferencia (<strong>{signo(totalAjuste)}</strong> en total) se suma a la cuota actual de cada
                  uno.
                </>
              ) : (
                <>Los nuevos valores rigen sólo para los días de mora que vengan; no se modifica lo ya devengado.</>
              )}{" "}
              Queda un checkpoint con la fecha y quién lo hizo, y podés volver a la versión anterior cuando quieras.
            </Banner>
            <ul className="space-y-1 text-sm text-ink-700">
              {nuevos.map((t, i) =>
                t.punitorioPct !== vigentes[i].punitorioPct || t.montoTopeSinIva !== vigentes[i].montoTopeSinIva ? (
                  <li key={i}>
                    Tramo {i + 1} (día {t.desdeDia}+): {vigentes[i].punitorioPct !== t.punitorioPct && <>{vigentes[i].punitorioPct} % → <strong>{t.punitorioPct} %</strong> </>}{vigentes[i].montoTopeSinIva !== t.montoTopeSinIva && <>tope {formatARS(vigentes[i].montoTopeSinIva)} → <strong>{formatARS(t.montoTopeSinIva)}</strong></>}
                  </li>
                ) : null
              )}
            </ul>
            <Checkbox
              checked={entiendo}
              onChange={setEntiendo}
              label="Confirmo los cambios sobre la cartera activa"
              description="Se aplican apenas confirmes."
            />
          </div>
        )}
      </Modal>

      <Modal
        open={!!aRestaurar}
        onClose={() => setARestaurar(null)}
        title="Restaurar versión anterior"
        maxWidth="max-w-md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setARestaurar(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={restaurar}>
              Restaurar
            </Button>
          </div>
        }
      >
        {aRestaurar && (
          <div className="space-y-2 text-sm text-ink-700">
            <p>
              Los tramos del producto vuelven a los que había antes de la modificación del{" "}
              <strong>{aRestaurar.fecha}</strong> de {aRestaurar.usuario}
              {aRestaurar.retroactivo ? " y se recalcula la cartera con ellos, sacando lo que se había sumado a las cuotas actuales" : ""}.
            </p>
            <p className="text-xs text-ink-500">Queda registrado como un nuevo checkpoint.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
